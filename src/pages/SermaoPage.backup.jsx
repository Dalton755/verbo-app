import {
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import {
    ArrowLeft,
    Expand,
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

pdfjsLib.GlobalWorkerOptions.workerSrc =
    pdfWorker;

function normalizarTexto(texto = "") {
    return texto
        .replace(/\s+/g, " ")
        .trim();
}

function agruparLinhas(items) {
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

                        fontSize,
                    };
                },
            )
            .sort(
                (a, b) => {
                    const difY =
                        b.y - a.y;

                    if (
                        Math.abs(difY) >
                        2.5
                    ) {
                        return difY;
                    }

                    return a.x - b.x;
                },
            );

    const linhas = [];

    for (
        const elemento
        of elementos
    ) {
        let linha =
            linhas.find(
                (item) =>
                    Math.abs(
                        item.y -
                        elemento.y,
                    ) <= 2.5,
            );

        if (!linha) {
            linha = {
                y:
                    elemento.y,

                itens: [],
            };

            linhas.push(linha);
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

                return {
                    texto:
                        normalizarTexto(
                            itens
                                .map(
                                    (item) =>
                                        item.texto,
                                )
                                .join(" "),
                        ),

                    y:
                        linha.y,

                    fontSize:
                        Math.max(
                            ...itens.map(
                                (item) =>
                                    item.fontSize,
                            ),
                        ),
                };
            },
        );
}

function criarBlocos(linhas) {
    if (
        linhas.length === 0
    ) {
        return [];
    }

    const tamanhos =
        linhas
            .map(
                (linha) =>
                    linha.fontSize,
            )
            .sort(
                (a, b) =>
                    a - b,
            );

    const tamanhoMediano =
        tamanhos[
        Math.floor(
            tamanhos.length /
            2,
        )
        ] || 12;

    const blocos = [];

    let blocoAtual = null;

    for (
        let indice = 0;
        indice < linhas.length;
        indice += 1
    ) {
        const linha =
            linhas[indice];

        const anterior =
            linhas[
            indice - 1
            ];

        const distancia =
            anterior
                ? anterior.y -
                linha.y
                : 0;

        const destaque =
            linha.fontSize >=
            tamanhoMediano *
            1.28;

        const curta =
            linha.texto.length <
            100;

        const pareceTitulo =
            destaque &&
            curta;

        const quebra =
            !blocoAtual ||
            pareceTitulo ||
            (
                anterior &&
                distancia >
                Math.max(
                    anterior.fontSize,
                    linha.fontSize,
                ) *
                1.75
            );

        if (quebra) {
            blocoAtual = {
                tipo:
                    pareceTitulo
                        ? "titulo"
                        : "texto",

                fontSize:
                    linha.fontSize,

                linhas: [
                    linha.texto,
                ],
            };

            blocos.push(
                blocoAtual,
            );
        } else {
            blocoAtual.linhas.push(
                linha.texto,
            );
        }
    }

    return blocos
        .map(
            (bloco) => ({
                ...bloco,

                texto:
                    normalizarTexto(
                        bloco.linhas.join(
                            " ",
                        ),
                    ),
            }),
        )
        .filter(
            (bloco) =>
                bloco.texto,
        );
}

function SermaoPage() {
    const { id } =
        useParams();

    const navigate =
        useNavigate();

    const { user } =
        useAuth();

    const paginaRefs =
        useRef({});

    const restaurouProgresso =
        useRef(false);

    const [sermao, setSermao] =
        useState(null);

    const [paginas, setPaginas] =
        useState([]);

    const [carregando, setCarregando] =
        useState(true);

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
          ultima_pagina
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

                    const linhas =
                        agruparLinhas(
                            conteudo.items,
                        );

                    paginasExtraidas.push({
                        numero,

                        blocos:
                            criarBlocos(
                                linhas,
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

                setPaginaAtual(
                    Math.min(
                        Math.max(
                            data.ultima_pagina ??
                            1,
                            1,
                        ),
                        pdf.numPages,
                    ),
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
            restaurouProgresso.current
        ) {
            return;
        }

        restaurouProgresso.current =
            true;

        const destino =
            paginaRefs.current[
            paginaAtual
            ];

        if (destino) {
            setTimeout(() => {
                destino.scrollIntoView({
                    block: "start",
                });
            }, 80);
        }
    }, [
        carregando,
        paginas,
        paginaAtual,
    ]);

    useEffect(() => {
        if (
            paginas.length === 0
        ) {
            return;
        }

        const observer =
            new IntersectionObserver(
                (entries) => {
                    const visiveis =
                        entries
                            .filter(
                                (entry) =>
                                    entry.isIntersecting,
                            )
                            .sort(
                                (a, b) =>
                                    b.intersectionRatio -
                                    a.intersectionRatio,
                            );

                    if (
                        visiveis.length ===
                        0
                    ) {
                        return;
                    }

                    const numero =
                        Number(
                            visiveis[0].target
                                .dataset.page,
                        );

                    if (numero) {
                        setPaginaAtual(
                            numero,
                        );
                    }
                },
                {
                    threshold: [
                        0.2,
                        0.4,
                        0.6,
                    ],
                },
            );

        Object.values(
            paginaRefs.current,
        ).forEach(
            (elemento) => {
                if (elemento) {
                    observer.observe(
                        elemento,
                    );
                }
            },
        );

        return () => {
            observer.disconnect();
        };
    }, [
        paginas,
    ]);

    useEffect(() => {
        if (
            !user ||
            !sermao?.id ||
            !paginaAtual
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
                500,
            );

        return () =>
            clearTimeout(timer);
    }, [
        paginaAtual,
        sermao?.id,
        user,
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
                            {pagina.blocos.map(
                                (
                                    bloco,
                                    indice,
                                ) =>
                                    bloco.tipo ===
                                        "titulo" ? (
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
                                    ) : (
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
                                    ),
                            )}
                        </section>
                    ),
                )}
            </main>

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