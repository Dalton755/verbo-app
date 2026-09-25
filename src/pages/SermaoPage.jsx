import {
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import {
    ArrowLeft,
    BookOpen,
    Bookmark,
    Bold,
    Italic,
    Redo2,
    Undo2,
    CalendarDays,
    Clock3,
    Expand,
    FileText,
    History,
    MapPin,
    Mic2,
    Minus,
    Moon,
    NotebookPen,
    Palette,
    Pause,
    Pencil,
    Play,
    Plus,
    RotateCcw,
    Square,
    Sun,
    Trash2,
    X,
} from "lucide-react";

import {
    useNavigate,
    useParams,
} from "react-router-dom";

import * as pdfjsLib
    from "pdfjs-dist";

import pdfWorker
    from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import {
    supabase,
} from "../lib/supabase";

import {
    useAuth,
} from "../contexts/AuthContext";

import BibleLinkedText
    from "../components/BibleLinkedText";

import BiblePassageModal
    from "../components/BiblePassageModal";

import DictionaryModal
    from "../components/DictionaryModal";

import DictionarySelectionAction
    from "../components/DictionarySelectionAction";

import {
    buscarSermaoCache,
    salvarSermaoCache,
} from "../lib/sermonCache";

pdfjsLib.GlobalWorkerOptions.workerSrc =
    pdfWorker;

function normalizarTexto(texto = "") {
    return texto
        .replace(/\s+/g, " ")
        .trim();
}

function textoChave(texto = "") {
    return String(texto ?? "")
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function mediana(numeros = []) {
    if (numeros.length === 0) {
        return 12;
    }

    const ordenados = [
        ...numeros,
    ].sort(
        (a, b) => a - b,
    );

    const meio =
        Math.floor(
            ordenados.length / 2,
        );

    if (
        ordenados.length % 2 === 0
    ) {
        return (
            ordenados[meio - 1] +
            ordenados[meio]
        ) / 2;
    }

    return ordenados[meio];
}

function agruparLinhas(
    items,
    pageWidth,
) {
    const elementos =
        items
            .filter(
                (item) =>
                    typeof item?.str ===
                    "string" &&
                    item.str.trim(),
            )
            .map(
                (item) => {
                    const transform =
                        item.transform;

                    const fontSize =
                        Math.max(
                            Math.hypot(
                                transform[2],
                                transform[3],
                            ),
                            1,
                        );

                    return {
                        texto:
                            normalizarTexto(
                                item.str,
                            ),

                        x:
                            transform[4],

                        y:
                            transform[5],

                        width:
                            Math.max(
                                Number(
                                    item.width,
                                ) || 0,
                                1,
                            ),

                        fontSize,
                    };
                },
            )
            .sort(
                (a, b) => {
                    const diferencaY =
                        b.y - a.y;

                    if (
                        Math.abs(
                            diferencaY,
                        ) > 2.5
                    ) {
                        return diferencaY;
                    }

                    return a.x - b.x;
                },
            );

    const linhas = [];

    for (
        const elemento
        of elementos
    ) {
        const tolerancia =
            Math.max(
                2.5,
                elemento.fontSize *
                0.18,
            );

        let linha =
            linhas.find(
                (item) =>
                    Math.abs(
                        item.y -
                        elemento.y,
                    ) <= tolerancia,
            );

        if (!linha) {
            linha = {
                y:
                    elemento.y,

                itens: [],
            };

            linhas.push(
                linha,
            );
        }

        linha.itens.push(
            elemento,
        );
    }

    return linhas
        .sort(
            (a, b) =>
                b.y - a.y,
        )
        .map(
            (linha) => {
                const itens =
                    linha.itens.sort(
                        (a, b) =>
                            a.x - b.x,
                    );

                const segmentos = [];

                let atual = null;

                for (
                    const item
                    of itens
                ) {
                    const gap =
                        atual
                            ? item.x -
                            atual.endX
                            : 0;

                    /*
                     * Espaços muito grandes na mesma
                     * altura normalmente indicam:
                     *
                     * coluna
                     * tabela
                     * caixa de texto separada
                     */
                    const limiteGap =
                        Math.max(
                            18,
                            pageWidth *
                            0.025,
                            item.fontSize *
                            1.4,
                        );

                    if (
                        !atual ||
                        gap > limiteGap
                    ) {
                        atual = {
                            texto:
                                item.texto,

                            x:
                                item.x,

                            y:
                                linha.y,

                            endX:
                                item.x +
                                item.width,

                            fontSize:
                                item.fontSize,
                        };

                        segmentos.push(
                            atual,
                        );
                    } else {
                        atual.texto =
                            normalizarTexto(
                                `${atual.texto} ${item.texto}`,
                            );

                        atual.fontSize =
                            Math.max(
                                atual.fontSize,
                                item.fontSize,
                            );

                        atual.endX =
                            Math.max(
                                atual.endX,
                                item.x +
                                item.width,
                            );
                    }
                }

                return {
                    y:
                        linha.y,

                    segmentos,
                };
            });
}

function criarBlocos(
    linhas,
    pageWidth,
    numeroPagina,
) {
    const todosSegmentos =
        linhas.flatMap(
            (linha) =>
                linha.segmentos,
        );

    const tamanhoMediano =
        mediana(
            todosSegmentos.map(
                (item) =>
                    item.fontSize,
            ),
        );

    const blocos = [];

    for (
        let indiceLinha = 0;
        indiceLinha <
        linhas.length;
        indiceLinha += 1
    ) {
        const linha =
            linhas[indiceLinha];

        const segmentos =
            linha.segmentos;

        /*
         * Detecta ficha/tabela.
         *
         * Exemplo:
         *
         * Tema       A presença...
         * Proposição Porque Deus...
         *
         * Limitamos principalmente às
         * páginas iniciais para não
         * confundir um sermão real
         * em duas colunas.
         */
        if (
            numeroPagina <= 2 &&
            segmentos.length >= 2
        ) {
            const esquerda =
                segmentos[0];

            const direita =
                segmentos[1];

            const pareceRotulo =
                esquerda.texto.length <=
                30 &&
                esquerda.x <
                pageWidth * 0.35 &&
                direita.x >
                esquerda.x +
                pageWidth *
                0.08;

            if (pareceRotulo) {
                let textoCampo =
                    segmentos
                        .slice(1)
                        .map(
                            (item) =>
                                item.texto,
                        )
                        .join(" ");

                let proximaLinha =
                    indiceLinha + 1;

                /*
                 * Se o conteúdo da célula direita
                 * quebrou em mais linhas, anexamos
                 * somente linhas que continuam
                 * naquela mesma coluna.
                 */
                while (
                    proximaLinha <
                    linhas.length
                ) {
                    const seguinte =
                        linhas[
                        proximaLinha
                        ];

                    if (
                        seguinte.segmentos
                            .length !== 1
                    ) {
                        break;
                    }

                    const segmento =
                        seguinte
                            .segmentos[0];

                    const mesmaColuna =
                        segmento.x >
                        pageWidth *
                        0.30 &&
                        Math.abs(
                            segmento.x -
                            direita.x,
                        ) <
                        pageWidth *
                        0.15;

                    const distancia =
                        linhas[
                            proximaLinha -
                            1
                        ].y -
                        seguinte.y;

                    const perto =
                        distancia <
                        Math.max(
                            segmento.fontSize *
                            2.3,
                            30,
                        );

                    if (
                        !mesmaColuna ||
                        !perto
                    ) {
                        break;
                    }

                    textoCampo =
                        normalizarTexto(
                            `${textoCampo} ${segmento.texto}`,
                        );

                    proximaLinha += 1;
                }

                blocos.push({
                    tipo:
                        "campo",

                    rotulo:
                        esquerda.texto,

                    texto:
                        normalizarTexto(
                            textoCampo,
                        ),
                });

                indiceLinha =
                    proximaLinha - 1;

                continue;
            }
        }

        for (
            const segmento
            of segmentos
        ) {
            const texto =
                segmento.texto;

            const pareceItem =
                /^([•▪◦‣-]|\d+[.)]|[IVXLCDM]+[.)])\s+/iu
                    .test(
                        texto,
                    );

            const maiusculoCurto =
                texto.length <
                120 &&
                texto ===
                texto.toLocaleUpperCase(
                    "pt-BR",
                ) &&
                /[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/u
                    .test(
                        texto,
                    );

            const fonteDestaque =
                segmento.fontSize >=
                tamanhoMediano *
                1.28;

            const pareceTitulo =
                texto.length <
                130 &&
                (
                    fonteDestaque ||
                    maiusculoCurto
                );

            const tipo =
                pareceTitulo
                    ? "titulo"
                    : pareceItem
                        ? "item"
                        : "texto";

            const ultimo =
                blocos[
                blocos.length - 1
                ];

            const mesmaColuna =
                ultimo &&
                typeof ultimo.x ===
                "number" &&
                Math.abs(
                    ultimo.x -
                    segmento.x,
                ) <=
                pageWidth *
                0.045;

            const distanciaVertical =
                ultimo &&
                    typeof ultimo.y ===
                    "number"
                    ? ultimo.y -
                    linha.y
                    : Infinity;

            /*
             * Une apenas linhas que parecem
             * continuação do mesmo parágrafo
             * E estão na mesma coluna.
             */
            if (
                tipo === "texto" &&
                ultimo?.tipo ===
                "texto" &&
                mesmaColuna &&
                distanciaVertical <=
                Math.max(
                    ultimo.fontSize,
                    segmento.fontSize,
                ) *
                1.9
            ) {
                ultimo.texto =
                    normalizarTexto(
                        `${ultimo.texto} ${texto}`,
                    );

                ultimo.y =
                    linha.y;

                ultimo.fontSize =
                    Math.max(
                        ultimo.fontSize,
                        segmento.fontSize,
                    );

                continue;
            }

            blocos.push({
                tipo,

                texto,

                x:
                    segmento.x,

                y:
                    linha.y,

                fontSize:
                    segmento.fontSize,
            });
        }
    }

    return blocos.filter(
        (bloco) =>
            bloco.texto,
    );
}

function ehDuplicadoDaCapa(
    bloco,
    paginaNumero,
    sermao,
) {
    if (
        paginaNumero !== 1 ||
        !bloco?.texto ||
        !sermao
    ) {
        return false;
    }

    const atual =
        textoChave(
            bloco.texto,
        );

    const titulo =
        textoChave(
            sermao.titulo,
        );

    const tema =
        textoChave(
            sermao.tema,
        );

    const textoBase =
        textoChave(
            sermao.texto_base,
        );

    if (
        atual &&
        titulo &&
        atual === titulo
    ) {
        return true;
    }

    if (
        atual &&
        tema &&
        atual === tema
    ) {
        return true;
    }

    if (
        atual &&
        textoBase &&
        (
            atual ===
            textoBase ||
            atual ===
            `texto base ${textoBase}`
        )
    ) {
        return true;
    }

    return false;
}

function lerProgressoSalvo(id) {
    if (!id) {
        return null;
    }

    try {
        const salvo =
            localStorage.getItem(
                `sermao-progresso-${id}`,
            );

        if (!salvo) {
            return null;
        }

        return JSON.parse(
            salvo,
        );
    } catch (error) {
        console.warn(
            "Erro ao ler progresso do sermão:",
            error,
        );

        return null;
    }
}

function BlocoEditorSermao({
    bloco,
    onChange,
    onAtivar,
    elemento = "p",
    className = "",
}) {
    const editorRef =
        useRef(null);

    useEffect(() => {
        const editor =
            editorRef.current;

        if (!editor) {
            return;
        }

        if (bloco.html) {
            editor.innerHTML =
                bloco.html;
        } else {
            editor.innerText =
                bloco.texto ?? "";
        }
    }, []);

    function atualizar() {
        const editor =
            editorRef.current;

        if (!editor) {
            return;
        }

        onChange({
            texto:
                editor.innerText,

            html:
                editor.innerHTML,
        });
    }

    const Elemento =
        elemento;

    return (
        <Elemento
            ref={editorRef}
            className={`sermon-inline-editor ${className}`}
            contentEditable
            suppressContentEditableWarning
            spellCheck
            onFocus={() =>
                onAtivar?.(
                    editorRef.current,
                )
            }
            onMouseUp={() =>
                onAtivar?.(
                    editorRef.current,
                )
            }
            onKeyUp={() =>
                onAtivar?.(
                    editorRef.current,
                )
            }
            onInput={atualizar}
        />
    );
}

function ConteudoRicoSermao({
    bloco,
    onReferencia,
}) {
    const html =
        bloco?.html?.trim();

    if (!html) {
        return (
            <BibleLinkedText
                texto={
                    bloco?.texto ??
                    ""
                }
                onReferencia={
                    onReferencia
                }
            />
        );
    }

    function renderizarNo(
        no,
        chave,
    ) {
        if (
            no.nodeType ===
            Node.TEXT_NODE
        ) {
            const texto =
                no.textContent ?? "";

            if (!texto) {
                return null;
            }

            return (
                <BibleLinkedText
                    key={chave}
                    texto={texto}
                    onReferencia={
                        onReferencia
                    }
                />
            );
        }

        if (
            no.nodeType !==
            Node.ELEMENT_NODE
        ) {
            return null;
        }

        const tag =
            no.tagName
                .toLowerCase();

        const filhos =
            Array.from(
                no.childNodes,
            ).map(
                (
                    filho,
                    indice,
                ) =>
                    renderizarNo(
                        filho,
                        `${chave}-${indice}`,
                    ),
            );

        if (
            tag === "strong" ||
            tag === "b"
        ) {
            return (
                <strong key={chave}>
                    {filhos}
                </strong>
            );
        }

        if (
            tag === "em" ||
            tag === "i"
        ) {
            return (
                <em key={chave}>
                    {filhos}
                </em>
            );
        }

        if (tag === "br") {
            return (
                <br key={chave} />
            );
        }

        if (
            tag === "div" ||
            tag === "p"
        ) {
            return (
                <span
                    key={chave}
                    style={{
                        display:
                            "block",
                    }}
                >
                    {filhos}
                </span>
            );
        }

        if (tag === "span") {
            const estilo = {};

            const backgroundColor =
                no.style
                    ?.backgroundColor;

            const color =
                no.style?.color;

            const fontSize =
                no.style
                    ?.fontSize;

            if (
                backgroundColor
            ) {
                estilo.backgroundColor =
                    backgroundColor;
            }

            if (color) {
                estilo.color =
                    color;
            }

            if (fontSize) {
                estilo.fontSize =
                    fontSize;
            }

            return (
                <span
                    key={chave}
                    style={estilo}
                >
                    {filhos}
                </span>
            );
        }

        return (
            <span key={chave}>
                {filhos}
            </span>
        );
    }

    const documento =
        new DOMParser()
            .parseFromString(
                `<div>${html}</div>`,
                "text/html",
            );

    const raiz =
        documento.body
            .firstElementChild;

    if (!raiz) {
        return (
            <BibleLinkedText
                texto={
                    bloco?.texto ??
                    ""
                }
                onReferencia={
                    onReferencia
                }
            />
        );
    }

    return Array.from(
        raiz.childNodes,
    ).map(
        (
            no,
            indice,
        ) =>
            renderizarNo(
                no,
                `rico-${indice}`,
            ),
    );
}

function SermaoPage() {
    const { id } =
        useParams();

    const chaveProgresso =
        `sermao-progresso-${id}`;

    const cacheInicial =
        buscarSermaoCache(id);

    const progressoLocalInicial =
        lerProgressoSalvo(id);

    const navigate =
        useNavigate();

    const { user } =
        useAuth();

    const paginaRefs =
        useRef({});

    const editorAtivoRef =
        useRef(null);

    const restaurandoProgresso =
        useRef(true);

    const progressoAtualRef =
        useRef({
            pagina:
                Number(
                    progressoLocalInicial
                        ?.pagina ??
                    cacheInicial
                        ?.sermao
                        ?.ultima_pagina ??
                    1,
                ),

            posicao:
                Number(
                    progressoLocalInicial
                        ?.posicao ??
                    cacheInicial
                        ?.sermao
                        ?.ultima_posicao ??
                    0,
                ),

            scrollY:
                Number(
                    progressoLocalInicial
                        ?.scrollY ??
                    0,
                ),
        });

    const [sermao, setSermao] =
        useState(
            cacheInicial?.sermao ??
            null,
        );

    const [paginas, setPaginas] =
        useState(
            cacheInicial?.paginas ??
            [],
        );

    const [
        modoEdicao,
        setModoEdicao,
    ] = useState(false);

    const [
        salvandoEdicao,
        setSalvandoEdicao,
    ] = useState(false);

    const [
        erroEdicao,
        setErroEdicao,
    ] = useState("");


    const [
        paletaEdicaoAberta,
        setPaletaEdicaoAberta,
    ] = useState(false);

    const [carregando, setCarregando] =
        useState(
            !cacheInicial,
        );

    const [pdfUrl, setPdfUrl] =
        useState("");

    const [
        modoVisualizacao,
        setModoVisualizacao,
    ] = useState("texto");



    const [erro, setErro] =
        useState("");

    const [
        referenciaAtiva,
        setReferenciaAtiva,
    ] = useState(null);

    const [
        palavraDicionario,
        setPalavraDicionario,
    ] = useState("");

    const [
        tamanhoFonte,
        setTamanhoFonte,
    ] = useState(
        Number(
            progressoLocalInicial
                ?.tamanhoFonte ??
            20,
        ),
    );

    const [
        paginaAtual,
        setPaginaAtual,
    ] = useState(
        Number(
            progressoLocalInicial
                ?.pagina ??
            cacheInicial
                ?.sermao
                ?.ultima_pagina ??
            1,
        ),
    );

    const [
        posicaoPagina,
        setPosicaoPagina,
    ] = useState(
        Number(
            progressoLocalInicial
                ?.posicao ??
            cacheInicial
                ?.sermao
                ?.ultima_posicao ??
            0,
        ),
    );

    const [
        telaCheia,
        setTelaCheia,
    ] = useState(false);

    const [
        modoPulpito,
        setModoPulpito,
    ] = useState(false);

    const [
        modoSermao,
        setModoSermao,
    ] = useState("preparar");

    const [
        historicoPregacoes,
        setHistoricoPregacoes,
    ] = useState([]);

    const [
        modalHistoricoAberto,
        setModalHistoricoAberto,
    ] = useState(false);

    const [
        modalRegistrarPregacao,
        setModalRegistrarPregacao,
    ] = useState(false);

    const [
        dataPregacao,
        setDataPregacao,
    ] = useState(
        new Date()
            .toISOString()
            .slice(0, 10),
    );

    const [
        localPregacao,
        setLocalPregacao,
    ] = useState("");

    const [
        eventoPregacao,
        setEventoPregacao,
    ] = useState("");

    const [
        observacoesPregacao,
        setObservacoesPregacao,
    ] = useState("");

    const [
        salvandoPregacao,
        setSalvandoPregacao,
    ] = useState(false);

    const [
        erroPregacao,
        setErroPregacao,
    ] = useState("");

    const [
        cronometroSegundos,
        setCronometroSegundos,
    ] = useState(0);

    const [
        cronometroRodando,
        setCronometroRodando,
    ] = useState(false);

    const [
        duracaoRegistro,
        setDuracaoRegistro,
    ] = useState(null);

    const cronometroInicioRef =
        useRef(null);

    const cronometroAcumuladoRef =
        useRef(0);

    const [
        marcadores,
        setMarcadores,
    ] = useState([]);

    const [
        modalMarcadorAberto,
        setModalMarcadorAberto,
    ] = useState(false);

    const [
        painelMarcadoresAberto,
        setPainelMarcadoresAberto,
    ] = useState(false);

    const [
        tituloMarcador,
        setTituloMarcador,
    ] = useState("");

    const [
        tipoMarcador,
        setTipoMarcador,
    ] = useState("MARCADOR");

    const [
        paginaMarcador,
        setPaginaMarcador,
    ] = useState(1);

    const [
        posicaoMarcador,
        setPosicaoMarcador,
    ] = useState(0);

    const [
        salvandoMarcador,
        setSalvandoMarcador,
    ] = useState(false);

    const [
        erroMarcador,
        setErroMarcador,
    ] = useState("");

    const [
        notasSermao,
        setNotasSermao,
    ] = useState([]);

    const [
        painelNotasAberto,
        setPainelNotasAberto,
    ] = useState(false);

    const [
        modalNotaAberto,
        setModalNotaAberto,
    ] = useState(false);

    const [
        notaEditando,
        setNotaEditando,
    ] = useState(null);

    const [
        tituloNota,
        setTituloNota,
    ] = useState("");

    const [
        conteudoNota,
        setConteudoNota,
    ] = useState("");

    const [
        notaVinculada,
        setNotaVinculada,
    ] = useState(false);

    const [
        paginaNota,
        setPaginaNota,
    ] = useState(null);

    const [
        posicaoNota,
        setPosicaoNota,
    ] = useState(null);

    const [
        salvandoNota,
        setSalvandoNota,
    ] = useState(false);

    const [
        erroNota,
        setErroNota,
    ] = useState("");


    useEffect(() => {
        if (!cronometroRodando) {
            return;
        }

        function atualizarCronometro() {
            if (
                !cronometroInicioRef.current
            ) {
                return;
            }

            const decorrido =
                Math.floor(
                    (
                        Date.now() -
                        cronometroInicioRef.current
                    ) / 1000,
                );

            setCronometroSegundos(
                cronometroAcumuladoRef
                    .current +
                decorrido,
            );
        }

        atualizarCronometro();

        const intervalo =
            window.setInterval(
                atualizarCronometro,
                1000,
            );

        return () => {
            window.clearInterval(
                intervalo,
            );
        };
    }, [
        cronometroRodando,
    ]);

    useEffect(() => {
        if (!user || !id) {
            return;
        }

        let ativo = true;

        function aplicarProgressoInicial(
            dados,
            totalPaginas,
        ) {
            const salvo =
                lerProgressoSalvo(id);

            let pagina =
                Math.min(
                    Math.max(
                        Number(
                            dados
                                ?.ultima_pagina ??
                            1,
                        ),
                        1,
                    ),
                    Math.max(
                        totalPaginas,
                        1,
                    ),
                );

            let posicao =
                Math.min(
                    Math.max(
                        Number(
                            dados
                                ?.ultima_posicao ??
                            0,
                        ),
                        0,
                    ),
                    1,
                );

            /*
             * O progresso local é mais recente
             * neste aparelho e tem prioridade.
             */
            if (
                salvo &&
                Number(salvo.pagina) >= 1 &&
                Number(salvo.pagina) <=
                totalPaginas
            ) {
                pagina =
                    Number(
                        salvo.pagina,
                    );

                posicao =
                    Math.min(
                        Math.max(
                            Number(
                                salvo.posicao ??
                                0,
                            ),
                            0,
                        ),
                        1,
                    );

                if (
                    Number(
                        salvo.tamanhoFonte,
                    ) >= 16 &&
                    Number(
                        salvo.tamanhoFonte,
                    ) <= 34
                ) {
                    setTamanhoFonte(
                        Number(
                            salvo.tamanhoFonte,
                        ),
                    );
                }
            }

            progressoAtualRef.current = {
                pagina,
                posicao,

                scrollY:
                    Number(
                        salvo?.scrollY ??
                        0,
                    ),
            };

            setPaginaAtual(
                pagina,
            );

            setPosicaoPagina(
                posicao,
            );
        }

        async function carregar() {
            /*
             * Se já existe cache em memória,
             * NÃO escondemos o sermão atrás
             * de uma tela de loading.
             */
            if (!cacheInicial) {
                setCarregando(true);
            }

            setErro("");

            const {
                data,
                error,
            } = await supabase
                .from("sermoes")
                .select(`
                id,
                titulo,
                tema,
                texto_base,
                arquivo_nome,
                arquivo_tipo,
                storage_path,
                total_paginas,
                ultima_pagina,
                ultima_posicao,
                conteudo_processado,
                conteudo_editado,
                editado_em,
                possui_edicao,
                processado_em,
                processador_versao
            `)
                .eq(
                    "id",
                    id,
                )
                .eq(
                    "usuario_id",
                    user.id,
                )
                .single();

            if (
                error ||
                !data
            ) {
                console.error(
                    error,
                );

                /*
                 * Se temos cache, continuamos
                 * usando o conteúdo já aberto.
                 */
                if (!cacheInicial) {
                    setErro(
                        "Não conseguimos abrir este sermão.",
                    );

                    setCarregando(
                        false,
                    );
                }

                return;
            }

            /*
             * ==================================
             * SERMÃO JÁ PROCESSADO
             * ==================================
             *
             * Aqui NÃO abrimos PDF.js.
             */
            const conteudoDisponivel =
                data.possui_edicao === true &&
                    data.conteudo_editado &&
                    Array.isArray(
                        data.conteudo_editado.paginas,
                    )
                    ? data.conteudo_editado
                    : data.conteudo_processado;

            if (
                conteudoDisponivel &&
                Array.isArray(
                    conteudoDisponivel.paginas,
                )
            ) {
                const paginasProntas =
                    conteudoDisponivel.paginas;

                if (!ativo) {
                    return;
                }

                setSermao(
                    data,
                );

                setPaginas(
                    paginasProntas,
                );

                aplicarProgressoInicial(
                    data,
                    paginasProntas.length,
                );

                salvarSermaoCache(
                    id,
                    {
                        sermao:
                            data,

                        paginas:
                            paginasProntas,
                    },
                );

                setCarregando(
                    false,
                );

                /*
                 * PDF mantém o botão de arquivo
                 * original. DOCX usa diretamente
                 * o conteúdo estruturado do VERBO.
                 */
                if (
                    (data.arquivo_tipo ??
                        "pdf") ===
                    "pdf"
                ) {
                    supabase.storage
                        .from(
                            "biblia-slides-pdfs",
                        )
                        .createSignedUrl(
                            data.storage_path,
                            60 * 60,
                        )
                        .then(
                            ({
                                data:
                                signedData,
                            }) => {
                                if (
                                    ativo &&
                                    signedData
                                        ?.signedUrl
                                ) {
                                    setPdfUrl(
                                        signedData
                                            .signedUrl,
                                    );
                                }
                            },
                        );
                }

                return;
            }

            /*
             * ==================================
             * PRIMEIRA PREPARAÇÃO
             * ==================================
             */

            const {
                data: signed,
                error: signedError,
            } =
                await supabase.storage
                    .from(
                        "biblia-slides-pdfs",
                    )
                    .createSignedUrl(
                        data.storage_path,
                        60 * 60,
                    );

            if (
                signedError ||
                !signed?.signedUrl
            ) {
                console.error(
                    signedError,
                );

                setErro(
                    "Não conseguimos abrir o PDF.",
                );

                setCarregando(
                    false,
                );

                return;
            }

            setPdfUrl(
                signed.signedUrl,
            );

            try {
                const pdf =
                    await pdfjsLib
                        .getDocument({
                            url:
                                signed
                                    .signedUrl,
                        })
                        .promise;

                const paginasExtraidas =
                    [];

                for (
                    let numero = 1;
                    numero <=
                    pdf.numPages;
                    numero += 1
                ) {
                    const pagina =
                        await pdf.getPage(
                            numero,
                        );

                    const conteudo =
                        await pagina
                            .getTextContent();

                    const viewport =
                        pagina.getViewport({
                            scale: 1,
                        });

                    const linhas =
                        agruparLinhas(
                            conteudo.items,
                            viewport.width,
                        );

                    paginasExtraidas.push({
                        numero,

                        blocos:
                            criarBlocos(
                                linhas,
                                viewport.width,
                                numero,
                            ),
                    });
                }

                if (!ativo) {
                    if (
                        pdf &&
                        typeof pdf.destroy ===
                        "function"
                    ) {
                        await pdf.destroy();
                    }

                    return;
                }

                const conteudoProcessado = {
                    versao: 1,

                    paginas:
                        paginasExtraidas,
                };

                const sermaoAtualizado = {
                    ...data,

                    total_paginas:
                        pdf.numPages,

                    conteudo_processado:
                        conteudoProcessado,

                    processador_versao:
                        1,
                };

                setSermao(
                    sermaoAtualizado,
                );

                setPaginas(
                    paginasExtraidas,
                );

                aplicarProgressoInicial(
                    sermaoAtualizado,
                    pdf.numPages,
                );

                salvarSermaoCache(
                    id,
                    {
                        sermao:
                            sermaoAtualizado,

                        paginas:
                            paginasExtraidas,
                    },
                );

                const {
                    error:
                    processamentoError,
                } = await supabase
                    .from("sermoes")
                    .update({
                        conteudo_processado:
                            conteudoProcessado,

                        processado_em:
                            new Date()
                                .toISOString(),

                        processador_versao:
                            1,

                        total_paginas:
                            pdf.numPages,
                    })
                    .eq(
                        "id",
                        data.id,
                    )
                    .eq(
                        "usuario_id",
                        user.id,
                    );

                if (
                    processamentoError
                ) {
                    console.error(
                        "Erro ao persistir sermão processado:",
                        processamentoError,
                    );
                }

                setCarregando(
                    false,
                );
            } catch (error) {
                console.error(
                    error,
                );

                setErro(
                    "Não conseguimos abrir este sermão.",
                );

                setCarregando(
                    false,
                );
            }
        }

        carregar();

        return () => {
            ativo = false;
        };
    }, [
        id,
        user,
    ]);


    useEffect(() => {
        if (
            !user ||
            !id
        ) {
            return;
        }

        let ativo = true;

        async function carregarHistorico() {
            const {
                data,
                error,
            } = await supabase
                .from(
                    "historico_pregacoes",
                )
                .select(`
                id,
                pregado_em,
                local,
                evento,
                observacoes,
                duracao_segundos,
                created_at
            `)
                .eq(
                    "usuario_id",
                    user.id,
                )
                .eq(
                    "sermao_id",
                    id,
                )
                .order(
                    "pregado_em",
                    {
                        ascending:
                            false,
                    },
                );

            if (!ativo) {
                return;
            }

            if (error) {
                console.error(
                    "Erro ao carregar histórico:",
                    error,
                );

                return;
            }

            setHistoricoPregacoes(
                data ?? [],
            );
        }

        carregarHistorico();

        return () => {
            ativo = false;
        };
    }, [
        user,
        id,
    ]);

    useEffect(() => {
        if (
            !user ||
            !id
        ) {
            return;
        }

        let ativo = true;

        async function carregarMarcadores() {
            const {
                data,
                error,
            } = await supabase
                .from(
                    "marcadores_sermao",
                )
                .select(`
                id,
                titulo,
                tipo,
                pagina,
                posicao,
                created_at
            `)
                .eq(
                    "usuario_id",
                    user.id,
                )
                .eq(
                    "sermao_id",
                    id,
                )
                .order(
                    "pagina",
                    {
                        ascending: true,
                    },
                )
                .order(
                    "posicao",
                    {
                        ascending: true,
                    },
                );

            if (!ativo) {
                return;
            }

            if (error) {
                console.error(
                    "Erro ao carregar marcadores:",
                    error,
                );

                return;
            }

            setMarcadores(
                data ?? [],
            );
        }

        carregarMarcadores();

        return () => {
            ativo = false;
        };
    }, [
        user,
        id,
    ]);

    useEffect(() => {
        if (
            !user ||
            !id
        ) {
            return;
        }

        let ativo = true;

        async function carregarNotas() {
            const {
                data,
                error,
            } = await supabase
                .from(
                    "notas_sermao",
                )
                .select(`
                id,
                titulo,
                conteudo,
                pagina,
                posicao,
                vinculada_posicao,
                created_at,
                updated_at
            `)
                .eq(
                    "usuario_id",
                    user.id,
                )
                .eq(
                    "sermao_id",
                    id,
                )
                .order(
                    "created_at",
                    {
                        ascending: false,
                    },
                );

            if (!ativo) {
                return;
            }

            if (error) {
                console.error(
                    "Erro ao carregar notas:",
                    error,
                );

                return;
            }

            setNotasSermao(
                data ?? [],
            );
        }

        carregarNotas();

        return () => {
            ativo = false;
        };
    }, [
        user,
        id,
    ]);

    useLayoutEffect(() => {
        if (
            carregando ||
            paginas.length === 0 ||
            modoVisualizacao !==
            "texto"
        ) {
            return;
        }

        restaurandoProgresso.current =
            true;

        const salvo =
            lerProgressoSalvo(id);

        const progresso =
            salvo ?? {
                pagina:
                    progressoAtualRef
                        .current
                        .pagina,

                posicao:
                    progressoAtualRef
                        .current
                        .posicao,

                scrollY:
                    progressoAtualRef
                        .current
                        .scrollY,
            };

        function restaurar() {
            const larguraSalva =
                Number(
                    salvo?.largura ??
                    0,
                );

            const scrollSalvo =
                Number(
                    salvo?.scrollY,
                );

            const diferencaLargura =
                larguraSalva > 0
                    ? Math.abs(
                        window
                            .innerWidth -
                        larguraSalva,
                    ) /
                    larguraSalva
                    : 1;

            /*
             * Mesmo aparelho / mesma largura:
             * volta exatamente ao scroll.
             */
            if (
                salvo &&
                Number.isFinite(
                    scrollSalvo,
                ) &&
                diferencaLargura <
                0.12
            ) {
                window.scrollTo({
                    top:
                        Math.max(
                            0,
                            scrollSalvo,
                        ),

                    behavior:
                        "auto",
                });

                return;
            }

            /*
             * Outra largura/tela:
             * usa página + percentual.
             */
            const numeroPagina =
                Number(
                    progresso.pagina ??
                    1,
                );

            const posicao =
                Number(
                    progresso.posicao ??
                    0,
                );

            const elemento =
                paginaRefs.current[
                numeroPagina
                ];

            if (!elemento) {
                return;
            }

            const rect =
                elemento
                    .getBoundingClientRect();

            const topo =
                window.scrollY +
                rect.top;

            const altura =
                Math.max(
                    elemento.offsetHeight,
                    1,
                );

            window.scrollTo({
                top:
                    Math.max(
                        0,
                        topo +
                        altura *
                        posicao -
                        90,
                    ),

                behavior:
                    "auto",
            });
        }

        /*
         * Executamos algumas vezes porque
         * fonte/layout podem ajustar altura
         * nos primeiros frames.
         */
        restaurar();

        const frame1 =
            requestAnimationFrame(
                restaurar,
            );

        const frame2 =
            requestAnimationFrame(
                () => {
                    requestAnimationFrame(
                        restaurar,
                    );
                },
            );

        const timer =
            setTimeout(
                () => {
                    restaurar();

                    restaurandoProgresso
                        .current =
                        false;
                },
                120,
            );

        return () => {
            cancelAnimationFrame(
                frame1,
            );

            cancelAnimationFrame(
                frame2,
            );

            clearTimeout(
                timer,
            );
        };
    }, [
        carregando,
        paginas,
        modoVisualizacao,
        id,
    ]);

    useEffect(() => {
        if (
            paginas.length === 0 ||
            modoVisualizacao !==
            "texto"
        ) {
            return;
        }

        let frame = null;

        function atualizarPosicao() {
            frame = null;

            if (
                restaurandoProgresso
                    .current
            ) {
                return;
            }

            const pontoLeitura =
                window.scrollY + 105;

            let paginaEncontrada =
                null;

            const referencias =
                Object.entries(
                    paginaRefs.current,
                )
                    .map(
                        ([
                            numero,
                            elemento,
                        ]) => ({
                            numero:
                                Number(
                                    numero,
                                ),

                            elemento,
                        }),
                    )
                    .filter(
                        (item) =>
                            item.elemento,
                    )
                    .sort(
                        (a, b) =>
                            a.numero -
                            b.numero,
                    );

            for (
                const item
                of referencias
            ) {
                const rect =
                    item.elemento
                        .getBoundingClientRect();

                const topo =
                    window.scrollY +
                    rect.top;

                const altura =
                    Math.max(
                        item.elemento
                            .offsetHeight,
                        1,
                    );

                const fim =
                    topo + altura;

                if (
                    pontoLeitura >= topo &&
                    pontoLeitura < fim
                ) {
                    paginaEncontrada = {
                        numero:
                            item.numero,

                        topo,

                        altura,
                    };

                    break;
                }

                if (
                    pontoLeitura >= fim
                ) {
                    paginaEncontrada = {
                        numero:
                            item.numero,

                        topo,

                        altura,
                    };
                }
            }

            if (!paginaEncontrada) {
                return;
            }

            const percentualPagina =
                Math.min(
                    Math.max(
                        (
                            pontoLeitura -
                            paginaEncontrada
                                .topo
                        ) /
                        paginaEncontrada
                            .altura,
                        0,
                    ),
                    1,
                );

            const novoProgresso = {
                pagina:
                    paginaEncontrada
                        .numero,

                posicao:
                    Number(
                        percentualPagina
                            .toFixed(4),
                    ),

                scrollY:
                    window.scrollY,

                largura:
                    window.innerWidth,

                tamanhoFonte,

                atualizadoEm:
                    Date.now(),
            };

            /*
             * REF: disponível imediatamente
             * inclusive durante unmount.
             */
            progressoAtualRef.current =
                novoProgresso;

            /*
             * LOCALSTORAGE:
             * não espera Supabase.
             */
            localStorage.setItem(
                chaveProgresso,

                JSON.stringify(
                    novoProgresso,
                ),
            );

            setPaginaAtual(
                novoProgresso.pagina,
            );

            setPosicaoPagina(
                novoProgresso.posicao,
            );
        }

        function aoRolar() {
            if (frame) {
                return;
            }

            frame =
                requestAnimationFrame(
                    atualizarPosicao,
                );
        }

        window.addEventListener(
            "scroll",
            aoRolar,
            {
                passive: true,
            },
        );

        /*
         * Não chamamos imediatamente aqui.
         * Primeiro deixamos a restauração
         * terminar.
         */

        return () => {
            window.removeEventListener(
                "scroll",
                aoRolar,
            );

            if (frame) {
                cancelAnimationFrame(
                    frame,
                );
            }
        };
    }, [
        paginas,
        modoVisualizacao,
        chaveProgresso,
        tamanhoFonte,
    ]);

    useEffect(() => {
        if (
            !user ||
            !sermao?.id ||
            !paginaAtual ||
            restaurandoProgresso.current ||
            modoVisualizacao !== "texto"
        ) {
            return;
        }

        const timer =
            setTimeout(
                async () => {
                    const {
                        error,
                    } = await supabase
                        .from("sermoes")
                        .update({
                            ultima_pagina:
                                paginaAtual,

                            ultima_posicao:
                                Number(
                                    posicaoPagina
                                        .toFixed(4),
                                ),
                        })
                        .eq(
                            "id",
                            sermao.id,
                        )
                        .eq(
                            "usuario_id",
                            user.id,
                        );

                    if (error) {
                        console.error(
                            "Erro ao salvar progresso:",
                            error,
                        );
                    }
                },
                300,
            );

        return () =>
            clearTimeout(timer);
    }, [
        paginaAtual,
        sermao?.id,
        user,
        posicaoPagina,
        modoVisualizacao,
    ]);

    useEffect(() => {
        if (
            !user ||
            !sermao?.id
        ) {
            return;
        }

        return () => {
            const progresso =
                progressoAtualRef
                    .current;

            supabase
                .from("sermoes")
                .update({
                    ultima_pagina:
                        progresso
                            .pagina,

                    ultima_posicao:
                        progresso
                            .posicao,
                })
                .eq(
                    "id",
                    sermao.id,
                )
                .eq(
                    "usuario_id",
                    user.id,
                )
                .then(
                    ({
                        error,
                    }) => {
                        if (error) {
                            console.error(
                                "Erro ao salvar progresso ao sair:",
                                error,
                            );
                        }
                    },
                );
        };
    }, [
        sermao?.id,
        user,
    ]);

    useEffect(() => {
        const anterior =
            window.history
                .scrollRestoration;

        window.history
            .scrollRestoration =
            "manual";

        return () => {
            window.history
                .scrollRestoration =
                anterior;
        };
    }, []);

    useEffect(() => {
        function mudouTelaCheia() {
            setTelaCheia(
                Boolean(
                    document.fullscreenElement,
                ),
            );
        }

        document.addEventListener(
            "fullscreenchange",
            mudouTelaCheia,
        );

        return () => {
            document.removeEventListener(
                "fullscreenchange",
                mudouTelaCheia,
            );
        };
    }, []);

    function clonarPaginas(
        valor,
    ) {
        return JSON.parse(
            JSON.stringify(
                valor ?? [],
            ),
        );
    }

    function executarComandoEditor(
        comando,
    ) {
        if (!modoEdicao) {
            return;
        }

        const editor =
            editorAtivoRef.current;

        if (!editor) {
            return;
        }

        /*
         * O botão da barra não pode
         * roubar a seleção do texto.
         */
        editor.focus();

        document.execCommand(
            comando,
            false,
            null,
        );

        /*
         * Força o editor a atualizar
         * texto + HTML no estado React.
         */
        editor.dispatchEvent(
            new Event(
                "input",
                {
                    bubbles: true,
                },
            ),
        );
    }

    function aplicarEstiloSelecao({
        tamanhoDelta = 0,
        corDestaque = null,
        removerDestaque = false,
    } = {}) {
        if (!modoEdicao) {
            return;
        }

        const editor =
            editorAtivoRef.current;

        const selecao =
            window.getSelection();

        if (
            !editor ||
            !selecao ||
            selecao.rangeCount === 0
        ) {
            return;
        }

        const range =
            selecao.getRangeAt(0);

        if (
            range.collapsed ||
            !editor.contains(
                range.commonAncestorContainer,
            )
        ) {
            return;
        }

        const fragmento =
            range.extractContents();

        const span =
            document.createElement(
                "span",
            );

        if (
            tamanhoDelta !== 0
        ) {
            const elementoBase =
                range.startContainer
                    .nodeType ===
                    Node.ELEMENT_NODE
                    ? range.startContainer
                    : range.startContainer
                        .parentElement;

            const tamanhoAtual =
                Number.parseFloat(
                    window
                        .getComputedStyle(
                            elementoBase ||
                            editor,
                        )
                        .fontSize,
                ) || 20;

            const novoTamanho =
                Math.min(
                    48,
                    Math.max(
                        12,
                        tamanhoAtual +
                        tamanhoDelta,
                    ),
                );

            span.style.fontSize =
                `${novoTamanho}px`;
        }

        if (corDestaque) {
            span.style.backgroundColor =
                corDestaque;

            span.style.borderRadius =
                "3px";

            span.style.padding =
                "0 1px";
        }

        if (removerDestaque) {
            span.style.backgroundColor =
                "transparent";
        }

        span.appendChild(
            fragmento,
        );

        range.insertNode(
            span,
        );

        const novoRange =
            document.createRange();

        novoRange.selectNodeContents(
            span,
        );

        selecao.removeAllRanges();

        selecao.addRange(
            novoRange,
        );

        editor.dispatchEvent(
            new Event(
                "input",
                {
                    bubbles: true,
                },
            ),
        );
    }

    function iniciarEdicao() {
        if (
            modoVisualizacao !==
            "texto"
        ) {
            setModoVisualizacao(
                "texto",
            );
        }

        setErroEdicao("");
        setModoEdicao(true);
    }

    function cancelarEdicao() {
        const conteudoSalvo =
            sermao?.possui_edicao ===
                true &&
                sermao?.conteudo_editado &&
                Array.isArray(
                    sermao
                        .conteudo_editado
                        .paginas,
                )
                ? sermao
                    .conteudo_editado
                    .paginas
                : sermao
                    ?.conteudo_processado
                    ?.paginas;

        if (
            Array.isArray(
                conteudoSalvo,
            )
        ) {
            setPaginas(
                clonarPaginas(
                    conteudoSalvo,
                ),
            );
        }

        setErroEdicao("");
        setModoEdicao(false);
    }

    function alterarTextoBloco(
        numeroPagina,
        indiceBloco,
        conteudo,
    ) {
        setPaginas(
            (anteriores) =>
                anteriores.map(
                    (pagina) => {
                        if (
                            pagina.numero !==
                            numeroPagina
                        ) {
                            return pagina;
                        }

                        return {
                            ...pagina,

                            blocos:
                                pagina.blocos.map(
                                    (
                                        bloco,
                                        indice,
                                    ) =>
                                        indice ===
                                            indiceBloco
                                            ? {
                                                ...bloco,

                                                texto:
                                                    conteudo
                                                        .texto,

                                                html:
                                                    conteudo
                                                        .html,
                                            }
                                            : bloco,
                                ),
                        };
                    },
                ),
        );
    }

    function adicionarBlocoDepois(
        numeroPagina,
        indiceBloco,
    ) {
        setPaginas(
            (anteriores) =>
                anteriores.map(
                    (pagina) => {
                        if (
                            pagina.numero !==
                            numeroPagina
                        ) {
                            return pagina;
                        }

                        const blocos =
                            [
                                ...pagina
                                    .blocos,
                            ];

                        blocos.splice(
                            indiceBloco +
                            1,
                            0,
                            {
                                tipo:
                                    "texto",

                                texto:
                                    "",

                                html:
                                    "",
                            },
                        );

                        return {
                            ...pagina,
                            blocos,
                        };
                    },
                ),
        );
    }

    function excluirBloco(
        numeroPagina,
        indiceBloco,
    ) {
        setPaginas(
            (anteriores) =>
                anteriores.map(
                    (pagina) => {
                        if (
                            pagina.numero !==
                            numeroPagina
                        ) {
                            return pagina;
                        }

                        return {
                            ...pagina,

                            blocos:
                                pagina.blocos.filter(
                                    (
                                        _bloco,
                                        indice,
                                    ) =>
                                        indice !==
                                        indiceBloco,
                                ),
                        };
                    },
                ),
        );
    }

    async function salvarEdicaoSermao() {
        if (
            !user ||
            !sermao?.id
        ) {
            return;
        }

        setSalvandoEdicao(true);
        setErroEdicao("");

        const agora =
            new Date()
                .toISOString();

        const conteudoEditado = {
            versao: 1,

            paginas:
                clonarPaginas(
                    paginas,
                ),
        };

        const {
            error,
        } = await supabase
            .from("sermoes")
            .update({
                conteudo_editado:
                    conteudoEditado,

                possui_edicao:
                    true,

                editado_em:
                    agora,
            })
            .eq(
                "id",
                sermao.id,
            )
            .eq(
                "usuario_id",
                user.id,
            );

        if (error) {
            console.error(
                "Erro ao salvar edição do sermão:",
                error,
            );

            setErroEdicao(
                "Não conseguimos salvar as alterações.",
            );

            setSalvandoEdicao(false);
            return;
        }

        const sermaoAtualizado = {
            ...sermao,

            conteudo_editado:
                conteudoEditado,

            possui_edicao:
                true,

            editado_em:
                agora,
        };

        setSermao(
            sermaoAtualizado,
        );

        salvarSermaoCache(
            id,
            {
                sermao:
                    sermaoAtualizado,

                paginas:
                    clonarPaginas(
                        paginas,
                    ),
            },
        );

        setModoEdicao(false);
        setSalvandoEdicao(false);
    }

    async function alternarTelaCheia() {
        try {
            if (
                !document.fullscreenElement
            ) {
                await document.documentElement
                    .requestFullscreen();
            } else {
                await document
                    .exitFullscreen();
            }
        } catch (error) {
            console.error(
                error,
            );
        }
    }

    function abrirNovaNota(
        vinculada = false,
    ) {
        setNotaEditando(null);

        setTituloNota("");
        setConteudoNota("");
        setErroNota("");

        setNotaVinculada(
            vinculada,
        );

        if (vinculada) {
            const progresso =
                progressoAtualRef.current;

            setPaginaNota(
                Number(
                    progresso?.pagina ??
                    paginaAtual ??
                    1,
                ),
            );

            setPosicaoNota(
                Number(
                    progresso?.posicao ??
                    posicaoPagina ??
                    0,
                ),
            );
        } else {
            setPaginaNota(null);
            setPosicaoNota(null);
        }

        setModalNotaAberto(
            true,
        );
    }

    function editarNota(
        nota,
    ) {
        setNotaEditando(
            nota,
        );

        setTituloNota(
            nota.titulo ?? "",
        );

        setConteudoNota(
            nota.conteudo ?? "",
        );

        setNotaVinculada(
            nota.vinculada_posicao ===
            true,
        );

        setPaginaNota(
            nota.pagina !== null
                ? Number(
                    nota.pagina,
                )
                : null,
        );

        setPosicaoNota(
            nota.posicao !== null
                ? Number(
                    nota.posicao,
                )
                : null,
        );

        setErroNota("");

        setModalNotaAberto(
            true,
        );
    }

    async function salvarNota(
        event,
    ) {
        event.preventDefault();

        if (
            !user ||
            !sermao?.id ||
            !conteudoNota.trim()
        ) {
            return;
        }

        setSalvandoNota(true);
        setErroNota("");

        const dadosNota = {
            usuario_id:
                user.id,

            sermao_id:
                sermao.id,

            titulo:
                tituloNota.trim() ||
                null,

            conteudo:
                conteudoNota.trim(),

            vinculada_posicao:
                notaVinculada,

            pagina:
                notaVinculada
                    ? paginaNota
                    : null,

            posicao:
                notaVinculada
                    ? Number(
                        Number(
                            posicaoNota ?? 0,
                        ).toFixed(6),
                    )
                    : null,

            updated_at:
                new Date()
                    .toISOString(),
        };

        let resultado;

        if (notaEditando) {
            resultado =
                await supabase
                    .from(
                        "notas_sermao",
                    )
                    .update(
                        dadosNota,
                    )
                    .eq(
                        "id",
                        notaEditando.id,
                    )
                    .eq(
                        "usuario_id",
                        user.id,
                    )
                    .select(`
                    id,
                    titulo,
                    conteudo,
                    pagina,
                    posicao,
                    vinculada_posicao,
                    created_at,
                    updated_at
                `)
                    .single();
        } else {
            resultado =
                await supabase
                    .from(
                        "notas_sermao",
                    )
                    .insert(
                        dadosNota,
                    )
                    .select(`
                    id,
                    titulo,
                    conteudo,
                    pagina,
                    posicao,
                    vinculada_posicao,
                    created_at,
                    updated_at
                `)
                    .single();
        }

        const {
            data,
            error,
        } = resultado;

        if (error) {
            console.error(
                "Erro ao salvar nota:",
                error,
            );

            setErroNota(
                "Não conseguimos salvar esta nota.",
            );

            setSalvandoNota(false);
            return;
        }

        if (notaEditando) {
            setNotasSermao(
                (anteriores) =>
                    anteriores.map(
                        (nota) =>
                            nota.id ===
                                data.id
                                ? data
                                : nota,
                    ),
            );
        } else {
            setNotasSermao(
                (anteriores) => [
                    data,
                    ...anteriores,
                ],
            );
        }

        setModalNotaAberto(false);
        setNotaEditando(null);

        setTituloNota("");
        setConteudoNota("");
        setNotaVinculada(false);

        setSalvandoNota(false);
    }

    async function excluirNota(
        nota,
    ) {
        const confirmar =
            window.confirm(
                "Excluir esta nota?",
            );

        if (!confirmar) {
            return;
        }

        const {
            error,
        } = await supabase
            .from(
                "notas_sermao",
            )
            .delete()
            .eq(
                "id",
                nota.id,
            )
            .eq(
                "usuario_id",
                user.id,
            );

        if (error) {
            console.error(
                "Erro ao excluir nota:",
                error,
            );

            return;
        }

        setNotasSermao(
            (anteriores) =>
                anteriores.filter(
                    (item) =>
                        item.id !==
                        nota.id,
                ),
        );
    }

    function irParaNota(
        nota,
    ) {
        if (
            !nota.vinculada_posicao ||
            nota.pagina === null
        ) {
            return;
        }

        setModoVisualizacao(
            "texto",
        );

        setPainelNotasAberto(
            false,
        );

        const pagina =
            Number(
                nota.pagina,
            );

        const posicao =
            Math.min(
                Math.max(
                    Number(
                        nota.posicao,
                    ) || 0,
                    0,
                ),
                1,
            );

        setPaginaAtual(
            pagina,
        );

        setPosicaoPagina(
            posicao,
        );

        requestAnimationFrame(
            () => {
                requestAnimationFrame(
                    () => {
                        const elemento =
                            paginaRefs
                                .current[
                            pagina
                            ];

                        if (!elemento) {
                            return;
                        }

                        const rect =
                            elemento
                                .getBoundingClientRect();

                        const topo =
                            window.scrollY +
                            rect.top;

                        const altura =
                            Math.max(
                                elemento
                                    .offsetHeight,
                                1,
                            );

                        window.scrollTo({
                            top:
                                Math.max(
                                    0,
                                    topo +
                                    altura *
                                    posicao -
                                    100,
                                ),

                            behavior:
                                "smooth",
                        });
                    },
                );
            },
        );
    }

    function nomeTipoMarcador(
        tipo,
    ) {
        const nomes = {
            MARCADOR:
                "Marcador",

            ENFASE:
                "Ênfase",

            APLICACAO:
                "Aplicação",

            ILUSTRACAO:
                "Ilustração",

            CONCLUSAO:
                "Conclusão",
        };

        return (
            nomes[tipo] ||
            "Marcador"
        );
    }

    function abrirNovoMarcador() {
        const progresso =
            progressoAtualRef.current;

        setPaginaMarcador(
            Number(
                progresso?.pagina ??
                paginaAtual ??
                1,
            ),
        );

        setPosicaoMarcador(
            Number(
                progresso?.posicao ??
                posicaoPagina ??
                0,
            ),
        );

        setTituloMarcador("");
        setTipoMarcador("MARCADOR");
        setErroMarcador("");

        setModalMarcadorAberto(
            true,
        );
    }

    async function salvarMarcador(
        event,
    ) {
        event.preventDefault();

        if (
            !user ||
            !sermao?.id
        ) {
            return;
        }

        const tituloFinal =
            tituloMarcador.trim() ||
            nomeTipoMarcador(
                tipoMarcador,
            );

        setSalvandoMarcador(
            true,
        );

        setErroMarcador("");

        const {
            data,
            error,
        } = await supabase
            .from(
                "marcadores_sermao",
            )
            .insert({
                usuario_id:
                    user.id,

                sermao_id:
                    sermao.id,

                titulo:
                    tituloFinal,

                tipo:
                    tipoMarcador,

                pagina:
                    paginaMarcador,

                posicao:
                    Number(
                        posicaoMarcador
                            .toFixed(6),
                    ),
            })
            .select(`
            id,
            titulo,
            tipo,
            pagina,
            posicao,
            created_at
        `)
            .single();

        if (error) {
            console.error(
                "Erro ao salvar marcador:",
                error,
            );

            setErroMarcador(
                "Não conseguimos salvar o marcador.",
            );

            setSalvandoMarcador(
                false,
            );

            return;
        }

        setMarcadores(
            (anteriores) =>
                [
                    ...anteriores,
                    data,
                ].sort(
                    (a, b) => {
                        if (
                            a.pagina !==
                            b.pagina
                        ) {
                            return (
                                a.pagina -
                                b.pagina
                            );
                        }

                        return (
                            Number(
                                a.posicao,
                            ) -
                            Number(
                                b.posicao,
                            )
                        );
                    },
                ),
        );

        setModalMarcadorAberto(
            false,
        );

        setSalvandoMarcador(
            false,
        );
    }

    function irParaMarcador(
        marcador,
    ) {
        setModoVisualizacao(
            "texto",
        );

        setPainelMarcadoresAberto(
            false,
        );

        const pagina =
            Number(
                marcador.pagina,
            );

        const posicao =
            Math.min(
                Math.max(
                    Number(
                        marcador.posicao,
                    ) || 0,
                    0,
                ),
                1,
            );

        setPaginaAtual(
            pagina,
        );

        setPosicaoPagina(
            posicao,
        );

        requestAnimationFrame(
            () => {
                requestAnimationFrame(
                    () => {
                        const elemento =
                            paginaRefs
                                .current[
                            pagina
                            ];

                        if (!elemento) {
                            return;
                        }

                        const rect =
                            elemento
                                .getBoundingClientRect();

                        const topo =
                            window.scrollY +
                            rect.top;

                        const altura =
                            Math.max(
                                elemento
                                    .offsetHeight,
                                1,
                            );

                        window.scrollTo({
                            top:
                                Math.max(
                                    0,
                                    topo +
                                    altura *
                                    posicao -
                                    100,
                                ),

                            behavior:
                                "smooth",
                        });
                    },
                );
            },
        );
    }

    async function excluirMarcador(
        marcador,
    ) {
        const confirmar =
            window.confirm(
                `Excluir o marcador "${marcador.titulo}"?`,
            );

        if (!confirmar) {
            return;
        }

        const {
            error,
        } = await supabase
            .from(
                "marcadores_sermao",
            )
            .delete()
            .eq(
                "id",
                marcador.id,
            )
            .eq(
                "usuario_id",
                user.id,
            );

        if (error) {
            console.error(
                "Erro ao excluir marcador:",
                error,
            );

            return;
        }

        setMarcadores(
            (anteriores) =>
                anteriores.filter(
                    (item) =>
                        item.id !==
                        marcador.id,
                ),
        );
    }

    function formatarCronometro(
        totalSegundos,
    ) {
        const horas =
            Math.floor(
                totalSegundos / 3600,
            );

        const minutos =
            Math.floor(
                (
                    totalSegundos % 3600
                ) / 60,
            );

        const segundos =
            totalSegundos % 60;

        const partes = [
            String(minutos).padStart(
                2,
                "0",
            ),
            String(segundos).padStart(
                2,
                "0",
            ),
        ];

        if (horas > 0) {
            partes.unshift(
                String(horas).padStart(
                    2,
                    "0",
                ),
            );
        }

        return partes.join(":");
    }

    function iniciarCronometro() {
        if (cronometroRodando) {
            return;
        }

        cronometroInicioRef.current =
            Date.now();

        setCronometroRodando(true);
    }

    function pausarCronometro() {
        if (
            !cronometroRodando ||
            !cronometroInicioRef.current
        ) {
            return;
        }

        const decorrido =
            Math.floor(
                (
                    Date.now() -
                    cronometroInicioRef.current
                ) / 1000,
            );

        cronometroAcumuladoRef.current +=
            decorrido;

        setCronometroSegundos(
            cronometroAcumuladoRef.current,
        );

        cronometroInicioRef.current =
            null;

        setCronometroRodando(false);
    }

    function zerarCronometro() {
        cronometroInicioRef.current =
            null;

        cronometroAcumuladoRef.current =
            0;

        setCronometroSegundos(0);
        setCronometroRodando(false);
    }

    function finalizarPregacao() {
        let duracao =
            cronometroSegundos;

        if (
            cronometroRodando &&
            cronometroInicioRef.current
        ) {
            const decorrido =
                Math.floor(
                    (
                        Date.now() -
                        cronometroInicioRef.current
                    ) / 1000,
                );

            duracao =
                cronometroAcumuladoRef
                    .current +
                decorrido;
        }

        setCronometroRodando(false);

        cronometroInicioRef.current =
            null;

        cronometroAcumuladoRef.current =
            duracao;

        setCronometroSegundos(
            duracao,
        );

        setDuracaoRegistro(
            duracao > 0
                ? duracao
                : null,
        );

        abrirRegistroPregacao(
            duracao,
        );
    }

    function abrirRegistroPregacao(
        duracao = null,
    ) {
        setDataPregacao(
            new Date()
                .toISOString()
                .slice(0, 10),
        );

        setLocalPregacao("");
        setEventoPregacao("");
        setObservacoesPregacao("");
        setErroPregacao("");

        setDuracaoRegistro(
            duracao,
        );

        setModalRegistrarPregacao(
            true,
        );
    }

    async function registrarPregacao(
        event,
    ) {
        event.preventDefault();

        if (
            !user ||
            !sermao?.id ||
            !dataPregacao
        ) {
            return;
        }

        setSalvandoPregacao(true);
        setErroPregacao("");

        const {
            data,
            error,
        } = await supabase
            .from(
                "historico_pregacoes",
            )
            .insert({
                usuario_id:
                    user.id,

                sermao_id:
                    sermao.id,

                pregado_em:
                    dataPregacao,

                local:
                    localPregacao
                        .trim() ||
                    null,

                evento:
                    eventoPregacao
                        .trim() ||
                    null,

                observacoes:
                    observacoesPregacao
                        .trim() ||
                    null,

                duracao_segundos:
                    duracaoRegistro,

            })
            .select(`
            id,
            pregado_em,
            local,
            evento,
            observacoes,
            duracao_segundos,
            created_at
        `)
            .single();

        if (error) {
            console.error(
                "Erro ao registrar pregação:",
                error,
            );

            setErroPregacao(
                "Não conseguimos registrar esta pregação.",
            );

            setSalvandoPregacao(false);
            return;
        }

        setHistoricoPregacoes(
            (anteriores) => [
                data,
                ...anteriores,
            ],
        );

        setModalRegistrarPregacao(
            false,
        );

        setDuracaoRegistro(null);

        zerarCronometro();

        setSalvandoPregacao(false);
    }

    const percentual =
        useMemo(() => {
            if (
                !sermao?.total_paginas
            ) {
                return 0;
            }

            return Math.round(
                (
                    paginaAtual /
                    sermao.total_paginas
                ) *
                100,
            );
        }, [
            paginaAtual,
            sermao,
        ]);

    if (carregando) {
        return (
            <div className="sermon-loading">
                <div className="loading-dot" />

                <p>
                    Abrindo sermão...
                </p>
            </div>
        );
    }

    if (erro) {
        return (
            <div className="sermon-loading">
                <p>
                    {erro}
                </p>

                <button
                    className="secondary-button"
                    onClick={() =>
                        navigate(
                            "/sermoes",
                        )
                    }
                >
                    Voltar
                </button>
            </div>
        );
    }

    return (
        <div
            className={[
                "sermon-reader",
                modoSermao === "pregar"
                    ? "sermon-reader-preaching"
                    : "",
                modoPulpito
                    ? "sermon-reader-pulpit"
                    : "",
            ]
                .filter(Boolean)
                .join(" ")}
            style={{
                "--sermon-font-size":
                    `${tamanhoFonte}px`,
            }}
        >
            <header
                className={
                    modoSermao === "pregar"
                        ? "sermon-toolbar sermon-toolbar-preaching"
                        : "sermon-toolbar"
                }
            >
                <button
                    type="button"
                    onClick={() =>
                        navigate(
                            "/sermoes",
                        )
                    }
                    aria-label="Voltar para sermões"
                    title="Voltar para sermões"
                >
                    <ArrowLeft
                        size={20}
                    />
                </button>

                <div className="sermon-toolbar-title">
                    <span>
                        {modoSermao === "pregar"
                            ? "Modo pregação"
                            : sermao?.tema ||
                            "Sermão"}
                    </span>

                    <strong>
                        {sermao?.titulo}
                    </strong>
                </div>

                {modoSermao ===
                    "pregar" && (
                    <button
                        type="button"
                        className="sermon-return-prepare"
                        onClick={() => {
                            setModoSermao(
                                "preparar",
                            );

                            setModoPulpito(
                                false,
                            );
                        }}
                    >
                        <Pencil
                            size={16}
                        />

                        <span>
                            Preparar
                        </span>
                    </button>
                )}
            </header>

            {modoSermao ===
                "preparar" &&
                !modoEdicao && (
                    <section
                        className="sermon-mode-launcher"
                        aria-label="Escolha como usar este sermão"
                    >
                        <button
                            type="button"
                            className="sermon-mode-card sermon-mode-card-active"
                        >
                            <span className="sermon-mode-card-icon">
                                <Pencil
                                    size={19}
                                />
                            </span>

                            <span className="sermon-mode-card-copy">
                                <strong>
                                    Preparar
                                </strong>

                                <small>
                                    Edite, marque e organize.
                                </small>
                            </span>

                            <span className="sermon-mode-card-state">
                                Modo atual
                            </span>
                        </button>

                        <button
                            type="button"
                            className="sermon-mode-card sermon-mode-card-preach"
                            disabled={
                                modoEdicao
                            }
                            onClick={() => {
                                setModoSermao(
                                    "pregar",
                                );

                                setModoVisualizacao(
                                    "texto",
                                );

                                setModoPulpito(
                                    false,
                                );
                            }}
                        >
                            <span className="sermon-mode-card-icon">
                                <Mic2
                                    size={19}
                                />
                            </span>

                            <span className="sermon-mode-card-copy">
                                <strong>
                                    Pregar
                                </strong>

                                <small>
                                    Leitura limpa para o púlpito.
                                </small>
                            </span>

                            <span className="sermon-mode-card-state">
                                Entrar
                            </span>
                        </button>
                    </section>
                )}

            {modoSermao ===
                "preparar" && (
                    <div className="sermon-context-toolbar">
                        <div className="sermon-view-toggle">
                            <button
                                type="button"
                                className={
                                    modoVisualizacao ===
                                        "texto"
                                        ? "active"
                                        : ""
                                }
                                onClick={() =>
                                    setModoVisualizacao(
                                        "texto",
                                    )
                                }
                            >
                                <FileText
                                    size={17}
                                />

                                <span>
                                    Texto
                                </span>
                            </button>

                            {(sermao?.arquivo_tipo ??
                                "pdf") ===
                                "pdf" && (
                                <button
                                    type="button"
                                    className={
                                        modoVisualizacao ===
                                            "pdf"
                                            ? "active"
                                            : ""
                                    }
                                    onClick={() =>
                                        setModoVisualizacao(
                                            "pdf",
                                        )
                                    }
                                >
                                    <BookOpen
                                        size={17}
                                    />

                                    <span>
                                        PDF
                                    </span>
                                </button>
                            )}
                        </div>

                        {modoVisualizacao ===
                            "texto" && (
                                <>
                                    <button
                                        type="button"
                                        title="Diminuir fonte"
                                        onClick={() =>
                                            setTamanhoFonte(
                                                (
                                                    atual,
                                                ) =>
                                                    Math.max(
                                                        16,
                                                        atual -
                                                        2,
                                                    ),
                                            )
                                        }
                                    >
                                        <Minus
                                            size={18}
                                        />
                                    </button>

                                    <button
                                        type="button"
                                        title="Aumentar fonte"
                                        onClick={() =>
                                            setTamanhoFonte(
                                                (
                                                    atual,
                                                ) =>
                                                    Math.min(
                                                        34,
                                                        atual +
                                                        2,
                                                    ),
                                            )
                                        }
                                    >
                                        <Plus
                                            size={18}
                                        />
                                    </button>
                                </>
                            )}

                        <button
                            type="button"
                            title="Marcar este ponto"
                            onClick={
                                abrirNovoMarcador
                            }
                        >
                            <Bookmark
                                size={18}
                            />
                        </button>

                        <button
                            type="button"
                            title="Ver marcadores"
                            onClick={() =>
                                setPainelMarcadoresAberto(
                                    true,
                                )
                            }
                        >
                            <Bookmark
                                size={18}
                                fill={
                                    marcadores.length >
                                        0
                                        ? "currentColor"
                                        : "none"
                                }
                            />
                        </button>

                        <button
                            type="button"
                            title="Notas"
                            onClick={() =>
                                setPainelNotasAberto(
                                    true,
                                )
                            }
                        >
                            <NotebookPen
                                size={18}
                            />
                        </button>

                        <button
                            type="button"
                            title="Histórico"
                            onClick={() =>
                                setModalHistoricoAberto(
                                    true,
                                )
                            }
                        >
                            <History
                                size={18}
                            />
                        </button>

                        <button
                            type="button"
                            title="Registrar pregação"
                            onClick={
                                abrirRegistroPregacao
                            }
                        >
                            <CalendarDays
                                size={18}
                            />
                        </button>

                        <button
                            type="button"
                            title="Tela cheia"
                            onClick={
                                alternarTelaCheia
                            }
                        >
                            <Expand
                                size={18}
                            />
                        </button>

                        {modoVisualizacao ===
                            "texto" &&
                            !modoEdicao && (
                                <button
                                    type="button"
                                    title="Editar sermão"
                                    onClick={
                                        iniciarEdicao
                                    }
                                >
                                    <Pencil
                                        size={18}
                                    />

                                    <span>
                                        Editar
                                    </span>
                                </button>
                            )}
                    </div>
                )}

            {modoSermao ===
                "preparar" &&
                modoEdicao && (
                    <div className="sermon-edit-toolbar">
                        <button
                            type="button"
                            title="Desfazer"
                            onMouseDown={(
                                event,
                            ) =>
                                event.preventDefault()
                            }
                            onClick={() =>
                                executarComandoEditor(
                                    "undo",
                                )
                            }
                        >
                            <Undo2
                                size={18}
                            />
                        </button>

                        <button
                            type="button"
                            title="Refazer"
                            onMouseDown={(
                                event,
                            ) =>
                                event.preventDefault()
                            }
                            onClick={() =>
                                executarComandoEditor(
                                    "redo",
                                )
                            }
                        >
                            <Redo2
                                size={18}
                            />
                        </button>

                        <span className="sermon-toolbar-divider" />

                        <button
                            type="button"
                            title="Negrito"
                            onMouseDown={(
                                event,
                            ) =>
                                event.preventDefault()
                            }
                            onClick={() =>
                                executarComandoEditor(
                                    "bold",
                                )
                            }
                        >
                            <Bold
                                size={18}
                            />
                        </button>

                        <button
                            type="button"
                            title="Itálico"
                            onMouseDown={(
                                event,
                            ) =>
                                event.preventDefault()
                            }
                            onClick={() =>
                                executarComandoEditor(
                                    "italic",
                                )
                            }
                        >
                            <Italic
                                size={18}
                            />
                        </button>

                        <span className="sermon-toolbar-divider" />

                        <button
                            type="button"
                            title="Diminuir texto selecionado"
                            onMouseDown={(
                                event,
                            ) =>
                                event.preventDefault()
                            }
                            onPointerDown={(
                                event,
                            ) =>
                                event.preventDefault()
                            }
                            onClick={() =>
                                aplicarEstiloSelecao({
                                    tamanhoDelta: -2,
                                })
                            }
                        >
                            <span className="sermon-editor-font-button">
                                A−
                            </span>
                        </button>

                        <button
                            type="button"
                            title="Aumentar texto selecionado"
                            onMouseDown={(
                                event,
                            ) =>
                                event.preventDefault()
                            }
                            onPointerDown={(
                                event,
                            ) =>
                                event.preventDefault()
                            }
                            onClick={() =>
                                aplicarEstiloSelecao({
                                    tamanhoDelta: 2,
                                })
                            }
                        >
                            <span className="sermon-editor-font-button">
                                A+
                            </span>
                        </button>

                        <button
                            type="button"
                            title="Destacar texto"
                            className={
                                paletaEdicaoAberta
                                    ? "active"
                                    : ""
                            }
                            onMouseDown={(
                                event,
                            ) =>
                                event.preventDefault()
                            }
                            onPointerDown={(
                                event,
                            ) =>
                                event.preventDefault()
                            }
                            onClick={() =>
                                setPaletaEdicaoAberta(
                                    (atual) =>
                                        !atual,
                                )
                            }
                        >
                            <Palette
                                size={18}
                            />
                        </button>

                        <div className="sermon-edit-spacer" />

                        <button
                            type="button"
                            className="sermon-editor-cancel"
                            disabled={
                                salvandoEdicao
                            }
                            onClick={
                                cancelarEdicao
                            }
                        >
                            Cancelar
                        </button>

                        <button
                            type="button"
                            className="sermon-editor-save"
                            disabled={
                                salvandoEdicao
                            }
                            onClick={
                                salvarEdicaoSermao
                            }
                        >
                            {salvandoEdicao
                                ? "Salvando..."
                                : "Salvar"}
                        </button>
                    </div>
                )}

            {modoSermao ===
                "pregar" && (
                    <div className="sermon-preach-panel">
                        <div className="sermon-preach-session">
                            <div className="sermon-preach-time-card">
                                <span>
                                    <Clock3
                                        size={15}
                                    />

                                    Tempo
                                </span>

                                <strong>
                                    {formatarCronometro(
                                        cronometroSegundos,
                                    )}
                                </strong>
                            </div>

                            <div className="sermon-preach-session-actions">
                                {!cronometroRodando ? (
                                    <button
                                        type="button"
                                        className="sermon-preach-primary-action"
                                        onClick={
                                            iniciarCronometro
                                        }
                                    >
                                        <Play
                                            size={17}
                                        />

                                        <span>
                                            Iniciar
                                        </span>
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        className="sermon-preach-primary-action"
                                        onClick={
                                            pausarCronometro
                                        }
                                    >
                                        <Pause
                                            size={17}
                                        />

                                        <span>
                                            Pausar
                                        </span>
                                    </button>
                                )}

                                <button
                                    type="button"
                                    className="sermon-preach-icon-action"
                                    title="Zerar cronômetro"
                                    aria-label="Zerar cronômetro"
                                    onClick={
                                        zerarCronometro
                                    }
                                >
                                    <RotateCcw
                                        size={17}
                                    />
                                </button>

                                <button
                                    type="button"
                                    className="sermon-preach-finish-action"
                                    onClick={
                                        finalizarPregacao
                                    }
                                >
                                    <Square
                                        size={14}
                                    />

                                    <span>
                                        Finalizar
                                    </span>
                                </button>
                            </div>
                        </div>

                        <div className="sermon-preach-tools">
                            <button
                                type="button"
                                className={
                                    modoPulpito
                                        ? "sermon-preach-tool active"
                                        : "sermon-preach-tool"
                                }
                                onClick={() =>
                                    setModoPulpito(
                                        (
                                            atual,
                                        ) =>
                                            !atual,
                                    )
                                }
                            >
                                {modoPulpito ? (
                                    <Sun
                                        size={17}
                                    />
                                ) : (
                                    <Moon
                                        size={17}
                                    />
                                )}

                                <span>
                                    {modoPulpito
                                        ? "Claro"
                                        : "Púlpito"}
                                </span>
                            </button>

                            <button
                                type="button"
                                className="sermon-preach-tool"
                                onClick={
                                    alternarTelaCheia
                                }
                            >
                                <Expand
                                    size={17}
                                />

                                <span>
                                    Tela cheia
                                </span>
                            </button>

                            <button
                                type="button"
                                className="sermon-preach-tool"
                                onClick={
                                    abrirNovoMarcador
                                }
                            >
                                <Bookmark
                                    size={17}
                                />

                                <span>
                                    Marcar
                                </span>
                            </button>

                            <button
                                type="button"
                                className="sermon-preach-tool"
                                onClick={() =>
                                    setPainelMarcadoresAberto(
                                        true,
                                    )
                                }
                            >
                                <Bookmark
                                    size={17}
                                    fill={
                                        marcadores.length >
                                            0
                                            ? "currentColor"
                                            : "none"
                                    }
                                />

                                <span>
                                    Marcadores
                                </span>
                            </button>
                        </div>
                    </div>
                )}

            {modoSermao ===
                "preparar" &&
                modoEdicao &&
                paletaEdicaoAberta && (
                    <div className="sermon-highlight-palette">
                        <button
                            type="button"
                            title="Amarelo"
                            className="highlight-yellow"
                            onMouseDown={(
                                event,
                            ) =>
                                event.preventDefault()
                            }
                            onPointerDown={(
                                event,
                            ) =>
                                event.preventDefault()
                            }
                            onClick={() => {
                                aplicarEstiloSelecao({
                                    corDestaque:
                                        "#fff59d",
                                });

                                setPaletaEdicaoAberta(
                                    false,
                                );
                            }}
                        />

                        <button
                            type="button"
                            title="Verde"
                            className="highlight-green"
                            onMouseDown={(
                                event,
                            ) =>
                                event.preventDefault()
                            }
                            onPointerDown={(
                                event,
                            ) =>
                                event.preventDefault()
                            }
                            onClick={() => {
                                aplicarEstiloSelecao({
                                    corDestaque:
                                        "#c8e6c9",
                                });

                                setPaletaEdicaoAberta(
                                    false,
                                );
                            }}
                        />

                        <button
                            type="button"
                            title="Azul"
                            className="highlight-blue"
                            onMouseDown={(
                                event,
                            ) =>
                                event.preventDefault()
                            }
                            onPointerDown={(
                                event,
                            ) =>
                                event.preventDefault()
                            }
                            onClick={() => {
                                aplicarEstiloSelecao({
                                    corDestaque:
                                        "#bbdefb",
                                });

                                setPaletaEdicaoAberta(
                                    false,
                                );
                            }}
                        />

                        <button
                            type="button"
                            title="Rosa"
                            className="highlight-pink"
                            onMouseDown={(
                                event,
                            ) =>
                                event.preventDefault()
                            }
                            onPointerDown={(
                                event,
                            ) =>
                                event.preventDefault()
                            }
                            onClick={() => {
                                aplicarEstiloSelecao({
                                    corDestaque:
                                        "#f8bbd0",
                                });

                                setPaletaEdicaoAberta(
                                    false,
                                );
                            }}
                        />

                        <button
                            type="button"
                            title="Roxo"
                            className="highlight-purple"
                            onMouseDown={(
                                event,
                            ) =>
                                event.preventDefault()
                            }
                            onPointerDown={(
                                event,
                            ) =>
                                event.preventDefault()
                            }
                            onClick={() => {
                                aplicarEstiloSelecao({
                                    corDestaque:
                                        "#e1bee7",
                                });

                                setPaletaEdicaoAberta(
                                    false,
                                );
                            }}
                        />

                        <button
                            type="button"
                            className="highlight-clear"
                            title="Remover destaque"
                            onMouseDown={(
                                event,
                            ) =>
                                event.preventDefault()
                            }
                            onPointerDown={(
                                event,
                            ) =>
                                event.preventDefault()
                            }
                            onClick={() => {
                                aplicarEstiloSelecao({
                                    removerDestaque:
                                        true,
                                });

                                setPaletaEdicaoAberta(
                                    false,
                                );
                            }}
                        >
                            ×
                        </button>
                    </div>
                )}

            <DictionarySelectionAction
                containerSelector=".sermon-content"
                disabled={
                    modoVisualizacao !==
                        "texto" ||
                    modoEdicao
                }
                onOpen={
                    setPalavraDicionario
                }
            />

            <div className="sermon-progress">
                <div
                    style={{
                        width:
                            `${percentual}%`,
                    }}
                />
            </div>



            {modoVisualizacao ===
                "pdf" ? (
                <main className="sermon-pdf-original">
                    {pdfUrl && (
                        <iframe
                            title={`PDF - ${sermao?.titulo}`}
                            src={
                                `${pdfUrl}` +
                                `#page=${paginaAtual}` +
                                `&toolbar=0` +
                                `&navpanes=0`
                            }
                        />
                    )}
                </main>
            ) : (
                <main className="sermon-content">
                    <header className="sermon-cover">
                        {sermao?.tema && (
                            <span>
                                {sermao.tema}
                            </span>
                        )}

                        <h1>
                            {sermao?.titulo}
                        </h1>

                        {sermao?.texto_base && (
                            <p>
                                Texto base:{" "}
                                {
                                    sermao.texto_base
                                }
                            </p>
                        )}
                    </header>

                    {paginas.map(
                        (pagina) => (
                            <section
                                key={
                                    pagina.numero
                                }
                                data-page={
                                    pagina.numero
                                }
                                ref={(
                                    elemento,
                                ) => {
                                    paginaRefs.current[
                                        pagina.numero
                                    ] = elemento;
                                }}
                                className="sermon-pdf-page"
                            >
                                {pagina.blocos
                                    .filter(
                                        (bloco) =>
                                            !ehDuplicadoDaCapa(
                                                bloco,
                                                pagina.numero,
                                                sermao,
                                            ),
                                    )
                                    .map(
                                        (
                                            bloco,
                                            indice,
                                        ) => {
                                            if (modoEdicao) {
                                                if (
                                                    bloco.tipo ===
                                                    "campo"
                                                ) {
                                                    return (
                                                        <div
                                                            key={indice}
                                                            className="sermon-meta-field"
                                                        >
                                                            <span>
                                                                {bloco.rotulo}
                                                            </span>

                                                            <BlocoEditorSermao
                                                                bloco={bloco}
                                                                onAtivar={(
                                                                    elemento,
                                                                ) => {
                                                                    editorAtivoRef.current =
                                                                        elemento;
                                                                }}
                                                                onChange={(
                                                                    conteudo,
                                                                ) =>
                                                                    alterarTextoBloco(
                                                                        pagina.numero,
                                                                        indice,
                                                                        conteudo,
                                                                    )
                                                                }
                                                            />
                                                        </div>
                                                    );
                                                }

                                                if (
                                                    bloco.tipo ===
                                                    "titulo"
                                                ) {
                                                    return (
                                                        <BlocoEditorSermao
                                                            key={indice}
                                                            bloco={bloco}
                                                            elemento="h2"
                                                            onAtivar={(
                                                                elemento,
                                                            ) => {
                                                                editorAtivoRef.current =
                                                                    elemento;
                                                            }}
                                                            onChange={(
                                                                conteudo,
                                                            ) =>
                                                                alterarTextoBloco(
                                                                    pagina.numero,
                                                                    indice,
                                                                    conteudo,
                                                                )
                                                            }
                                                        />
                                                    );
                                                }

                                                if (
                                                    bloco.tipo ===
                                                    "item"
                                                ) {
                                                    return (
                                                        <BlocoEditorSermao
                                                            key={indice}
                                                            bloco={bloco}
                                                            className="sermon-list-item"
                                                            onAtivar={(
                                                                elemento,
                                                            ) => {
                                                                editorAtivoRef.current =
                                                                    elemento;
                                                            }}
                                                            onChange={(
                                                                conteudo,
                                                            ) =>
                                                                alterarTextoBloco(
                                                                    pagina.numero,
                                                                    indice,
                                                                    conteudo,
                                                                )
                                                            }
                                                        />
                                                    );
                                                }

                                                return (
                                                    <BlocoEditorSermao
                                                        key={indice}
                                                        bloco={bloco}
                                                        onAtivar={(
                                                            elemento,
                                                        ) => {
                                                            editorAtivoRef.current =
                                                                elemento;
                                                        }}
                                                        onChange={(
                                                            conteudo,
                                                        ) =>
                                                            alterarTextoBloco(
                                                                pagina.numero,
                                                                indice,
                                                                conteudo,
                                                            )
                                                        }
                                                    />
                                                );
                                            }
                                            if (
                                                bloco.tipo ===
                                                "campo"
                                            ) {
                                                return (
                                                    <div
                                                        key={
                                                            indice
                                                        }
                                                        className="sermon-meta-field"
                                                    >
                                                        <span>
                                                            {
                                                                bloco.rotulo
                                                            }
                                                        </span>

                                                        <p>
                                                            <ConteudoRicoSermao
                                                                bloco={bloco}
                                                                onReferencia={
                                                                    setReferenciaAtiva
                                                                }
                                                            />
                                                        </p>
                                                    </div>
                                                );
                                            }

                                            if (
                                                bloco.tipo ===
                                                "titulo"
                                            ) {
                                                return (
                                                    <h2
                                                        key={
                                                            indice
                                                        }
                                                    >
                                                        <ConteudoRicoSermao
                                                            bloco={bloco}
                                                            onReferencia={
                                                                setReferenciaAtiva
                                                            }
                                                        />
                                                    </h2>
                                                );
                                            }

                                            if (
                                                bloco.tipo ===
                                                "item"
                                            ) {
                                                return (
                                                    <p
                                                        key={
                                                            indice
                                                        }
                                                        className="sermon-list-item"
                                                    >
                                                        <ConteudoRicoSermao
                                                            bloco={bloco}
                                                            onReferencia={
                                                                setReferenciaAtiva
                                                            }
                                                        />
                                                    </p>
                                                );
                                            }

                                            return (
                                                <p
                                                    key={
                                                        indice
                                                    }
                                                >
                                                    <ConteudoRicoSermao
                                                        bloco={bloco}
                                                        onReferencia={
                                                            setReferenciaAtiva
                                                        }
                                                    />
                                                </p>
                                            );
                                        },
                                    )}
                            </section>
                        ),
                    )}
                </main>
            )}

            {modoVisualizacao ===
                "texto" && (
                    <div className="sermon-status">
                        <span>
                            Página{" "}
                            {paginaAtual}
                            {" de "}
                            {
                                paginas.length
                            }
                        </span>
                    </div>
                )}

            {modalNotaAberto && (
                <div
                    className="modal-overlay"
                    onMouseDown={(
                        event,
                    ) => {
                        if (
                            event.target ===
                            event.currentTarget &&
                            !salvandoNota
                        ) {
                            setModalNotaAberto(
                                false,
                            );
                        }
                    }}
                >
                    <div className="modal-card">
                        <div className="modal-header">
                            <div className="modal-icon">
                                <NotebookPen
                                    size={22}
                                />
                            </div>

                            <button
                                type="button"
                                className="modal-close"
                                aria-label="Fechar"
                                disabled={
                                    salvandoNota
                                }
                                onClick={() =>
                                    setModalNotaAberto(
                                        false,
                                    )
                                }
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="modal-heading">
                            <span className="app-kicker">
                                Notas
                            </span>

                            <h2>
                                {notaEditando
                                    ? "Editar nota"
                                    : "Nova nota"}
                            </h2>

                            <p>
                                Registre uma ideia,
                                aplicação ou observação
                                para este sermão.
                            </p>
                        </div>

                        <form
                            className="trimestre-form"
                            onSubmit={
                                salvarNota
                            }
                        >
                            <label>
                                Título

                                <span className="optional-field">
                                    Opcional
                                </span>

                                <input
                                    type="text"
                                    value={
                                        tituloNota
                                    }
                                    onChange={(
                                        event,
                                    ) =>
                                        setTituloNota(
                                            event
                                                .target
                                                .value,
                                        )
                                    }
                                    placeholder="Ex.: Aplicação final"
                                />
                            </label>

                            <label>
                                Nota

                                <textarea
                                    value={
                                        conteudoNota
                                    }
                                    onChange={(
                                        event,
                                    ) =>
                                        setConteudoNota(
                                            event
                                                .target
                                                .value,
                                        )
                                    }
                                    placeholder="Escreva sua observação..."
                                    rows={6}
                                    required
                                />
                            </label>

                            <label className="sermon-note-position-option">
                                <input
                                    type="checkbox"
                                    checked={
                                        notaVinculada
                                    }
                                    onChange={(
                                        event,
                                    ) => {
                                        const ativo =
                                            event
                                                .target
                                                .checked;

                                        setNotaVinculada(
                                            ativo,
                                        );

                                        if (ativo) {
                                            const progresso =
                                                progressoAtualRef
                                                    .current;

                                            setPaginaNota(
                                                Number(
                                                    progresso
                                                        ?.pagina ??
                                                    paginaAtual ??
                                                    1,
                                                ),
                                            );

                                            setPosicaoNota(
                                                Number(
                                                    progresso
                                                        ?.posicao ??
                                                    posicaoPagina ??
                                                    0,
                                                ),
                                            );
                                        } else {
                                            setPaginaNota(
                                                null,
                                            );

                                            setPosicaoNota(
                                                null,
                                            );
                                        }
                                    }}
                                />

                                <div>
                                    <strong>
                                        Vincular ao ponto atual
                                    </strong>

                                    <span>
                                        Ao abrir esta nota,
                                        será possível voltar
                                        exatamente para este
                                        trecho.
                                    </span>
                                </div>
                            </label>

                            {notaVinculada && (
                                <div className="sermon-note-position-info">
                                    <Bookmark
                                        size={16}
                                    />

                                    <span>
                                        Página{" "}
                                        {paginaNota}
                                    </span>
                                </div>
                            )}

                            {erroNota && (
                                <div className="library-message">
                                    {erroNota}
                                </div>
                            )}

                            <div className="modal-actions">
                                <button
                                    type="button"
                                    className="secondary-button"
                                    disabled={
                                        salvandoNota
                                    }
                                    onClick={() =>
                                        setModalNotaAberto(
                                            false,
                                        )
                                    }
                                >
                                    Cancelar
                                </button>

                                <button
                                    type="submit"
                                    className="primary-button"
                                    disabled={
                                        salvandoNota ||
                                        !conteudoNota.trim()
                                    }
                                >
                                    {salvandoNota
                                        ? "Salvando..."
                                        : notaEditando
                                            ? "Salvar alterações"
                                            : "Salvar nota"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {painelNotasAberto && (
                <div
                    className="modal-overlay"
                    onMouseDown={(
                        event,
                    ) => {
                        if (
                            event.target ===
                            event.currentTarget
                        ) {
                            setPainelNotasAberto(
                                false,
                            );
                        }
                    }}
                >
                    <div className="modal-card sermon-notes-modal">
                        <div className="modal-header">
                            <div className="modal-icon">
                                <NotebookPen
                                    size={22}
                                />
                            </div>

                            <button
                                type="button"
                                className="modal-close"
                                aria-label="Fechar"
                                onClick={() =>
                                    setPainelNotasAberto(
                                        false,
                                    )
                                }
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="modal-heading">
                            <span className="app-kicker">
                                Preparação
                            </span>

                            <h2>
                                Notas do sermão
                            </h2>

                            <p>
                                {notasSermao.length}
                                {" "}
                                {notasSermao.length === 1
                                    ? "nota salva"
                                    : "notas salvas"}
                            </p>
                        </div>

                        {notasSermao.length ===
                            0 ? (
                            <div className="sermon-history-empty">
                                Nenhuma nota foi
                                criada para este
                                sermão.
                            </div>
                        ) : (
                            <div className="sermon-notes-list">
                                {notasSermao.map(
                                    (nota) => (
                                        <article
                                            key={
                                                nota.id
                                            }
                                            className="sermon-note-item"
                                        >
                                            <div className="sermon-note-item-top">
                                                <div>
                                                    <span>
                                                        {nota.vinculada_posicao
                                                            ? `Página ${nota.pagina}`
                                                            : "Nota geral"}
                                                    </span>

                                                    <strong>
                                                        {nota.titulo ||
                                                            "Sem título"}
                                                    </strong>
                                                </div>

                                                <div className="sermon-note-item-actions">
                                                    <button
                                                        type="button"
                                                        title="Editar"
                                                        onClick={() => {
                                                            setPainelNotasAberto(
                                                                false,
                                                            );

                                                            editarNota(
                                                                nota,
                                                            );
                                                        }}
                                                    >
                                                        <Pencil
                                                            size={16}
                                                        />
                                                    </button>

                                                    <button
                                                        type="button"
                                                        title="Excluir"
                                                        onClick={() =>
                                                            excluirNota(
                                                                nota,
                                                            )
                                                        }
                                                    >
                                                        <Trash2
                                                            size={16}
                                                        />
                                                    </button>
                                                </div>
                                            </div>

                                            <p>
                                                {nota.conteudo}
                                            </p>

                                            {nota.vinculada_posicao && (
                                                <button
                                                    type="button"
                                                    className="sermon-note-go"
                                                    onClick={() =>
                                                        irParaNota(
                                                            nota,
                                                        )
                                                    }
                                                >
                                                    <Bookmark
                                                        size={15}
                                                    />

                                                    Ir para este ponto
                                                </button>
                                            )}
                                        </article>
                                    ),
                                )}
                            </div>
                        )}

                        <div className="modal-actions">
                            <button
                                type="button"
                                className="secondary-button"
                                onClick={() =>
                                    setPainelNotasAberto(
                                        false,
                                    )
                                }
                            >
                                Fechar
                            </button>

                            <button
                                type="button"
                                className="primary-button"
                                onClick={() => {
                                    setPainelNotasAberto(
                                        false,
                                    );

                                    abrirNovaNota(
                                        false,
                                    );
                                }}
                            >
                                <Plus size={17} />
                                Nova nota
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {modalMarcadorAberto && (
                <div
                    className="modal-overlay"
                    onMouseDown={(
                        event,
                    ) => {
                        if (
                            event.target ===
                            event.currentTarget &&
                            !salvandoMarcador
                        ) {
                            setModalMarcadorAberto(
                                false,
                            );
                        }
                    }}
                >
                    <div className="modal-card">
                        <div className="modal-header">
                            <div className="modal-icon">
                                <Bookmark
                                    size={22}
                                />
                            </div>

                            <button
                                type="button"
                                className="modal-close"
                                aria-label="Fechar"
                                disabled={
                                    salvandoMarcador
                                }
                                onClick={() =>
                                    setModalMarcadorAberto(
                                        false,
                                    )
                                }
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="modal-heading">
                            <span className="app-kicker">
                                Marcadores
                            </span>

                            <h2>
                                Marcar este ponto
                            </h2>

                            <p>
                                Página{" "}
                                {paginaMarcador}
                                {" · "}
                                posição atual do
                                sermão.
                            </p>
                        </div>

                        <form
                            className="trimestre-form"
                            onSubmit={
                                salvarMarcador
                            }
                        >
                            <label>
                                Tipo

                                <select
                                    value={
                                        tipoMarcador
                                    }
                                    onChange={(
                                        event,
                                    ) =>
                                        setTipoMarcador(
                                            event
                                                .target
                                                .value,
                                        )
                                    }
                                >
                                    <option value="MARCADOR">
                                        Marcador
                                    </option>

                                    <option value="ENFASE">
                                        Ênfase
                                    </option>

                                    <option value="APLICACAO">
                                        Aplicação
                                    </option>

                                    <option value="ILUSTRACAO">
                                        Ilustração
                                    </option>

                                    <option value="CONCLUSAO">
                                        Conclusão
                                    </option>
                                </select>
                            </label>

                            <label>
                                Nome
                                <span className="optional-field">
                                    Opcional
                                </span>

                                <input
                                    type="text"
                                    value={
                                        tituloMarcador
                                    }
                                    onChange={(
                                        event,
                                    ) =>
                                        setTituloMarcador(
                                            event
                                                .target
                                                .value,
                                        )
                                    }
                                    placeholder="Ex.: Destacar esta aplicação"
                                />
                            </label>

                            {erroMarcador && (
                                <div className="library-message">
                                    {erroMarcador}
                                </div>
                            )}

                            <div className="modal-actions">
                                <button
                                    type="button"
                                    className="secondary-button"
                                    disabled={
                                        salvandoMarcador
                                    }
                                    onClick={() =>
                                        setModalMarcadorAberto(
                                            false,
                                        )
                                    }
                                >
                                    Cancelar
                                </button>

                                <button
                                    type="submit"
                                    className="primary-button"
                                    disabled={
                                        salvandoMarcador
                                    }
                                >
                                    {salvandoMarcador
                                        ? "Salvando..."
                                        : "Salvar marcador"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {painelMarcadoresAberto && (
                <div
                    className="modal-overlay"
                    onMouseDown={(
                        event,
                    ) => {
                        if (
                            event.target ===
                            event.currentTarget
                        ) {
                            setPainelMarcadoresAberto(
                                false,
                            );
                        }
                    }}
                >
                    <div className="modal-card sermon-markers-modal">
                        <div className="modal-header">
                            <div className="modal-icon">
                                <Bookmark
                                    size={22}
                                />
                            </div>

                            <button
                                type="button"
                                className="modal-close"
                                aria-label="Fechar"
                                onClick={() =>
                                    setPainelMarcadoresAberto(
                                        false,
                                    )
                                }
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="modal-heading">
                            <span className="app-kicker">
                                Navegação
                            </span>

                            <h2>
                                Marcadores
                            </h2>

                            <p>
                                {marcadores.length}
                                {" "}
                                {marcadores.length === 1
                                    ? "ponto salvo"
                                    : "pontos salvos"}
                            </p>
                        </div>

                        {marcadores.length ===
                            0 ? (
                            <div className="sermon-history-empty">
                                Nenhum ponto foi
                                marcado neste
                                sermão.
                            </div>
                        ) : (
                            <div className="sermon-markers-list">
                                {marcadores.map(
                                    (marcador) => (
                                        <article
                                            key={
                                                marcador.id
                                            }
                                            className="sermon-marker-item"
                                        >
                                            <button
                                                type="button"
                                                className="sermon-marker-main"
                                                onClick={() =>
                                                    irParaMarcador(
                                                        marcador,
                                                    )
                                                }
                                            >
                                                <div className="sermon-marker-icon">
                                                    <Bookmark
                                                        size={17}
                                                    />
                                                </div>

                                                <div>
                                                    <span>
                                                        {nomeTipoMarcador(
                                                            marcador.tipo,
                                                        )}
                                                    </span>

                                                    <strong>
                                                        {marcador.titulo}
                                                    </strong>

                                                    <small>
                                                        Página{" "}
                                                        {
                                                            marcador.pagina
                                                        }
                                                    </small>
                                                </div>
                                            </button>

                                            <button
                                                type="button"
                                                className="sermon-marker-delete"
                                                aria-label="Excluir marcador"
                                                title="Excluir marcador"
                                                onClick={() =>
                                                    excluirMarcador(
                                                        marcador,
                                                    )
                                                }
                                            >
                                                <Trash2
                                                    size={17}
                                                />
                                            </button>
                                        </article>
                                    ),
                                )}
                            </div>
                        )}

                        <div className="modal-actions">
                            <button
                                type="button"
                                className="secondary-button"
                                onClick={() =>
                                    setPainelMarcadoresAberto(
                                        false,
                                    )
                                }
                            >
                                Fechar
                            </button>

                            <button
                                type="button"
                                className="primary-button"
                                onClick={() => {
                                    setPainelMarcadoresAberto(
                                        false,
                                    );

                                    abrirNovoMarcador();
                                }}
                            >
                                <Plus size={17} />
                                Novo marcador
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {modalRegistrarPregacao && (
                <div
                    className="modal-overlay"
                    onMouseDown={(event) => {
                        if (
                            event.target ===
                            event.currentTarget &&
                            !salvandoPregacao
                        ) {
                            setModalRegistrarPregacao(
                                false,
                            );
                        }
                    }}
                >
                    <div className="modal-card">
                        <div className="modal-header">
                            <div className="modal-icon">
                                <CalendarDays
                                    size={22}
                                />
                            </div>

                            <button
                                type="button"
                                className="modal-close"
                                aria-label="Fechar"
                                disabled={
                                    salvandoPregacao
                                }
                                onClick={() =>
                                    setModalRegistrarPregacao(
                                        false,
                                    )
                                }
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="modal-heading">
                            <span className="app-kicker">
                                Histórico
                            </span>

                            <h2>
                                Registrar pregação
                            </h2>

                            <p>
                                Salve quando e onde
                                este sermão foi
                                pregado.
                            </p>
                            {duracaoRegistro !==
                                null && (
                                    <div className="sermon-timer-summary">
                                        <Clock3 size={17} />

                                        <span>
                                            Duração da pregação
                                        </span>

                                        <strong>
                                            {formatarCronometro(
                                                duracaoRegistro,
                                            )}
                                        </strong>
                                    </div>
                                )}

                        </div>

                        <form
                            className="trimestre-form"
                            onSubmit={
                                registrarPregacao
                            }
                        >
                            <label>
                                Data

                                <input
                                    type="date"
                                    value={
                                        dataPregacao
                                    }
                                    onChange={(
                                        event,
                                    ) =>
                                        setDataPregacao(
                                            event
                                                .target
                                                .value,
                                        )
                                    }
                                    required
                                />
                            </label>

                            <label>
                                Local
                                <span className="optional-field">
                                    Opcional
                                </span>

                                <input
                                    type="text"
                                    value={
                                        localPregacao
                                    }
                                    onChange={(
                                        event,
                                    ) =>
                                        setLocalPregacao(
                                            event
                                                .target
                                                .value,
                                        )
                                    }
                                    placeholder="Ex.: ADVE Vila Élida"
                                />
                            </label>

                            <label>
                                Culto ou evento
                                <span className="optional-field">
                                    Opcional
                                </span>

                                <input
                                    type="text"
                                    value={
                                        eventoPregacao
                                    }
                                    onChange={(
                                        event,
                                    ) =>
                                        setEventoPregacao(
                                            event
                                                .target
                                                .value,
                                        )
                                    }
                                    placeholder="Ex.: Culto de ensino"
                                />
                            </label>

                            <label>
                                Observações
                                <span className="optional-field">
                                    Opcional
                                </span>

                                <textarea
                                    value={
                                        observacoesPregacao
                                    }
                                    onChange={(
                                        event,
                                    ) =>
                                        setObservacoesPregacao(
                                            event
                                                .target
                                                .value,
                                        )
                                    }
                                    placeholder="Ex.: Ênfase maior na aplicação final"
                                    rows={4}
                                />
                            </label>

                            {erroPregacao && (
                                <div className="library-message">
                                    {erroPregacao}
                                </div>
                            )}

                            <div className="modal-actions">
                                <button
                                    type="button"
                                    className="secondary-button"
                                    disabled={
                                        salvandoPregacao
                                    }
                                    onClick={() =>
                                        setModalRegistrarPregacao(
                                            false,
                                        )
                                    }
                                >
                                    Cancelar
                                </button>

                                <button
                                    type="submit"
                                    className="primary-button"
                                    disabled={
                                        salvandoPregacao ||
                                        !dataPregacao
                                    }
                                >
                                    {salvandoPregacao
                                        ? "Salvando..."
                                        : "Registrar"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {modalHistoricoAberto && (
                <div
                    className="modal-overlay"
                    onMouseDown={(event) => {
                        if (
                            event.target ===
                            event.currentTarget
                        ) {
                            setModalHistoricoAberto(
                                false,
                            );
                        }
                    }}
                >
                    <div className="modal-card sermon-history-modal">
                        <div className="modal-header">
                            <div className="modal-icon">
                                <History
                                    size={22}
                                />
                            </div>

                            <button
                                type="button"
                                className="modal-close"
                                aria-label="Fechar"
                                onClick={() =>
                                    setModalHistoricoAberto(
                                        false,
                                    )
                                }
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="modal-heading">
                            <span className="app-kicker">
                                Histórico
                            </span>

                            <h2>
                                Pregações realizadas
                            </h2>

                            <p>
                                {historicoPregacoes.length}
                                {" "}
                                {historicoPregacoes.length === 1
                                    ? "registro"
                                    : "registros"}
                            </p>
                        </div>

                        {historicoPregacoes.length ===
                            0 ? (
                            <div className="sermon-history-empty">
                                Este sermão ainda
                                não possui pregações
                                registradas.
                            </div>
                        ) : (
                            <div className="sermon-history-list">
                                {historicoPregacoes.map(
                                    (item) => (
                                        <article
                                            key={
                                                item.id
                                            }
                                            className="sermon-history-item"
                                        >
                                            <div className="sermon-history-date">
                                                <CalendarDays
                                                    size={17}
                                                />

                                                <strong>
                                                    {new Date(
                                                        `${item.pregado_em}T12:00:00`,
                                                    ).toLocaleDateString(
                                                        "pt-BR",
                                                    )}
                                                </strong>
                                            </div>

                                            {item.local && (
                                                <div>
                                                    <MapPin
                                                        size={15}
                                                    />

                                                    <span>
                                                        {item.local}
                                                    </span>
                                                </div>
                                            )}

                                            {item.evento && (
                                                <p>
                                                    {item.evento}
                                                </p>
                                            )}

                                            {item.duracao_segundos !==
                                                null && (
                                                    <div>
                                                        <Clock3
                                                            size={15}
                                                        />

                                                        <span>
                                                            {Math.round(
                                                                item.duracao_segundos /
                                                                60,
                                                            )}
                                                            {" min"}
                                                        </span>
                                                    </div>
                                                )}

                                            {item.observacoes && (
                                                <small>
                                                    {item.observacoes}
                                                </small>
                                            )}
                                        </article>
                                    ),
                                )}
                            </div>
                        )}

                        <div className="modal-actions">
                            <button
                                type="button"
                                className="secondary-button"
                                onClick={() =>
                                    setModalHistoricoAberto(
                                        false,
                                    )
                                }
                            >
                                Fechar
                            </button>

                            <button
                                type="button"
                                className="primary-button"
                                onClick={() => {
                                    setModalHistoricoAberto(
                                        false,
                                    );

                                    abrirRegistroPregacao();
                                }}
                            >
                                <Plus size={17} />
                                Registrar pregação
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <DictionaryModal
                aberto={
                    Boolean(
                        palavraDicionario,
                    )
                }
                palavra={
                    palavraDicionario
                }
                onClose={() =>
                    setPalavraDicionario(
                        "",
                    )
                }
            />

            <BiblePassageModal
                referencia={
                    referenciaAtiva
                }
                onClose={() =>
                    setReferenciaAtiva(
                        null,
                    )
                }
            />
        </div>
    );
}

export default SermaoPage;