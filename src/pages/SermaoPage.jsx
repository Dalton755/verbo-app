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
    CalendarDays,
    Clock3,
    Expand,
    FileText,
    History,
    MapPin,
    Maximize2,
    Minus,
    Plus,
    Shrink,
    Pause,
    Play,
    RotateCcw,
    Square,
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
    return texto
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
                storage_path,
                total_paginas,
                ultima_pagina,
                ultima_posicao,
                conteudo_processado,
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
            if (
                data.conteudo_processado &&
                Array.isArray(
                    data
                        .conteudo_processado
                        .paginas,
                )
            ) {
                const paginasProntas =
                    data
                        .conteudo_processado
                        .paginas;

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
                 * Geramos a URL do PDF em
                 * segundo plano apenas para
                 * o botão "PDF original".
                 *
                 * Não bloqueia o Modo Pregação.
                 */
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
            className={
                modoPulpito
                    ? "sermon-reader sermon-reader-pulpit"
                    : "sermon-reader"
            }
            style={{
                "--sermon-font-size":
                    `${tamanhoFonte}px`,
            }}
        >
            <header className="sermon-toolbar">
                <button
                    type="button"
                    onClick={() =>
                        navigate(
                            "/sermoes",
                        )
                    }
                    aria-label="Voltar"
                >
                    <ArrowLeft
                        size={20}
                    />
                </button>

                <div className="sermon-toolbar-title">
                    <span>
                        {sermao?.tema ||
                            "Sermão"}
                    </span>

                    <strong>
                        {sermao?.titulo}
                    </strong>
                </div>

                <div className="sermon-toolbar-actions">
                    <div className="sermon-view-toggle">
                        <button
                            type="button"
                            className={
                                modoVisualizacao ===
                                    "texto"
                                    ? "active"
                                    : ""
                            }
                            title="Modo texto"
                            onClick={() =>
                                setModoVisualizacao(
                                    "texto",
                                )
                            }
                        >
                            <FileText
                                size={16}
                            />

                            <span>
                                Texto
                            </span>
                        </button>

                        <button
                            type="button"
                            className={
                                modoVisualizacao ===
                                    "pdf"
                                    ? "active"
                                    : ""
                            }
                            title="PDF original"
                            onClick={() =>
                                setModoVisualizacao(
                                    "pdf",
                                )
                            }
                        >
                            <BookOpen
                                size={16}
                            />

                            <span>
                                PDF
                            </span>
                        </button>
                    </div>
                    {modoVisualizacao ===
                        "texto" && (
                            <>
                                <button
                                    type="button"
                                    title="Diminuir fonte"
                                    onClick={() =>
                                        setTamanhoFonte(
                                            (atual) =>
                                                Math.max(
                                                    16,
                                                    atual - 2,
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
                                            (atual) =>
                                                Math.min(
                                                    34,
                                                    atual + 2,
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
                        title="Histórico de pregações"
                        onClick={() =>
                            setModalHistoricoAberto(
                                true,
                            )
                        }
                    >
                        <History size={18} />
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
                        title="Modo púlpito"
                        onClick={() =>
                            setModoPulpito(
                                (atual) =>
                                    !atual,
                            )
                        }
                    >
                        {modoPulpito ? (
                            <Shrink
                                size={18}
                            />
                        ) : (
                            <Maximize2
                                size={18}
                            />
                        )}
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
                </div>
            </header>

            <div className="sermon-progress">
                <div
                    style={{
                        width:
                            `${percentual}%`,
                    }}
                />
            </div>

            <div
                className={`sermon-timer ${cronometroRodando
                        ? "sermon-timer-running"
                        : ""
                    }`}
            >
                <div className="sermon-timer-time">
                    <Clock3 size={17} />

                    <strong>
                        {formatarCronometro(
                            cronometroSegundos,
                        )}
                    </strong>
                </div>

                <div className="sermon-timer-actions">
                    {!cronometroRodando ? (
                        <button
                            type="button"
                            title="Iniciar cronômetro"
                            onClick={
                                iniciarCronometro
                            }
                        >
                            <Play size={17} />
                        </button>
                    ) : (
                        <button
                            type="button"
                            title="Pausar cronômetro"
                            onClick={
                                pausarCronometro
                            }
                        >
                            <Pause size={17} />
                        </button>
                    )}

                    <button
                        type="button"
                        title="Zerar cronômetro"
                        disabled={
                            cronometroSegundos ===
                            0 &&
                            !cronometroRodando
                        }
                        onClick={
                            zerarCronometro
                        }
                    >
                        <RotateCcw
                            size={16}
                        />
                    </button>

                    <button
                        type="button"
                        title="Finalizar pregação"
                        disabled={
                            cronometroSegundos ===
                            0 &&
                            !cronometroRodando
                        }
                        onClick={
                            finalizarPregacao
                        }
                    >
                        <Square size={15} />
                    </button>
                </div>
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
                                                            <BibleLinkedText
                                                                texto={
                                                                    bloco.texto
                                                                }
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
                                                        <BibleLinkedText
                                                            texto={
                                                                bloco.texto
                                                            }
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
                                                        <BibleLinkedText
                                                            texto={
                                                                bloco.texto
                                                            }
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
                                                    <BibleLinkedText
                                                        texto={
                                                            bloco.texto
                                                        }
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