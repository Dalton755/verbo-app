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
    Expand,
    FileText,
    Maximize2,
    Minus,
    Plus,
    Shrink,
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

function SermaoPage() {
    const { id } =
        useParams();

    const cacheInicial =
        buscarSermaoCache(id);

    const navigate =
        useNavigate();

    const { user } =
        useAuth();

    const paginaRefs =
        useRef({});

    const restaurouProgresso =
        useRef(false);

    const restaurandoProgresso =
        useRef(true);

    const paginaSalvaRef =
        useRef(1);

    const posicaoSalvaRef =
        useRef(0);

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
    ] = useState(20);

    const [
        paginaAtual,
        setPaginaAtual,
    ] = useState(1);

    const [
        posicaoPagina,
        setPosicaoPagina,
    ] = useState(0);

    const [
        telaCheia,
        setTelaCheia,
    ] = useState(false);

    const [
        modoPulpito,
        setModoPulpito,
    ] = useState(false);

    useEffect(() => {
        if (!user || !id) {
            return;
        }

        let ativo = true;

        async function carregar() {
            setCarregando(true);
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
                console.error(error);

                setErro(
                    "Não conseguimos abrir este sermão.",
                );

                /*
 * Se o sermão já foi processado,
 * não precisamos mais baixar
 * e interpretar o PDF.
 */
                if (
                    data.conteudo_processado &&
                    Array.isArray(
                        data.conteudo_processado
                            .paginas,
                    )
                ) {
                    const paginasProntas =
                        data.conteudo_processado
                            .paginas;

                    if (!ativo) {
                        return;
                    }

                    setSermao(data);

                    setPaginas(
                        paginasProntas,
                    );

                    salvarSermaoCache(
                        id,
                        {
                            sermao: data,
                            paginas:
                                paginasProntas,
                        },
                    );

                    setCarregando(false);

                    return;
                }

                setCarregando(false);
                return;
            }

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

                setCarregando(false);
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
                                signed.signedUrl,
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
                        await pagina.getTextContent();

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
                        typeof pdf.destroy === "function"
                    ) {
                        await pdf.destroy();
                    }

                    return;
                }

                setSermao(data);
                setPaginas(
                    paginasExtraidas,
                );

                const conteudoProcessado = {
                    versao: 1,

                    paginas:
                        paginasExtraidas,
                };

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

                const sermaoAtualizado = {
                    ...data,

                    total_paginas:
                        pdf.numPages,

                    conteudo_processado:
                        conteudoProcessado,
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
                            paginasExtraidas,
                    },
                );

                const paginaInicial =
                    Math.min(
                        Math.max(
                            data.ultima_pagina ?? 1,
                            1,
                        ),
                        pdf.numPages,
                    );

                const posicaoInicial =
                    Math.min(
                        Math.max(
                            Number(
                                data.ultima_posicao ?? 0,
                            ),
                            0,
                        ),
                        1,
                    );

                paginaSalvaRef.current =
                    paginaInicial;

                posicaoSalvaRef.current =
                    posicaoInicial;

                setPaginaAtual(
                    paginaInicial,
                );

                setPosicaoPagina(
                    posicaoInicial,
                );

                if (
                    data.total_paginas !==
                    pdf.numPages
                ) {
                    await supabase
                        .from("sermoes")
                        .update({
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
                }

                setCarregando(
                    false,
                );
            } catch (error) {
                console.error(
                    error,
                );

                setErro(
                    "Não conseguimos preparar o Modo Pregação.",
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
            carregando ||
            paginas.length === 0 ||
            restaurouProgresso.current ||
            modoVisualizacao !== "texto"
        ) {
            return;
        }

        const pagina =
            paginaSalvaRef.current;

        const posicao =
            posicaoSalvaRef.current;

        const destino =
            paginaRefs.current[
            pagina
            ];

        if (!destino) {
            return;
        }

        restaurouProgresso.current =
            true;

        restaurandoProgresso.current =
            true;

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const rect =
                    destino.getBoundingClientRect();

                const topoPagina =
                    window.scrollY +
                    rect.top;

                const alturaPagina =
                    destino.offsetHeight;

                /*
                 * 86px compensa toolbar +
                 * barra de progresso.
                 */
                const destinoScroll =
                    topoPagina +
                    alturaPagina *
                    posicao -
                    86;

                window.scrollTo({
                    top:
                        Math.max(
                            0,
                            destinoScroll,
                        ),

                    behavior: "auto",
                });

                setTimeout(() => {
                    restaurandoProgresso.current =
                        false;
                }, 180);
            });
        });
    }, [
        carregando,
        paginas,
        modoVisualizacao,
    ]);

    useEffect(() => {
        if (
            paginas.length === 0 ||
            modoVisualizacao !== "texto"
        ) {
            return;
        }

        let frame = null;

        function atualizarPosicao() {
            frame = null;

            if (
                restaurandoProgresso.current
            ) {
                return;
            }

            /*
             * Linha imaginária logo abaixo
             * da toolbar.
             */
            const pontoLeitura =
                window.scrollY + 105;

            let paginaEncontrada = null;

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
                                Number(numero),

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

                /*
                 * Se passamos da página,
                 * mantemos a última encontrada.
                 */
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

            const percentual =
                Math.min(
                    Math.max(
                        (
                            pontoLeitura -
                            paginaEncontrada.topo
                        ) /
                        paginaEncontrada.altura,
                        0,
                    ),
                    1,
                );

            setPaginaAtual(
                (atual) =>
                    atual ===
                        paginaEncontrada.numero
                        ? atual
                        : paginaEncontrada.numero,
            );

            setPosicaoPagina(
                (atual) =>
                    Math.abs(
                        atual -
                        percentual,
                    ) >= 0.005
                        ? percentual
                        : atual,
            );
        }

        function scroll() {
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
            scroll,
            {
                passive: true,
            },
        );

        atualizarPosicao();

        return () => {
            window.removeEventListener(
                "scroll",
                scroll,
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
                    Preparando o Modo Pregação...
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