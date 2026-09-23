import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";

import {
    ArrowLeft,
    BookOpenText,
    ChevronLeft,
    ChevronRight,
    Expand,
    Minimize,
    X,
} from "lucide-react";

import {
    useNavigate,
    useParams,
} from "react-router-dom";

import * as pdfjsLib from "pdfjs-dist";

import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import {
    extrairReferenciasBiblicas,
    extrairContinuacoesBiblicas,
} from "../lib/bibleReferences";

import {
    buscarPassagemBiblica,
} from "../lib/bibleApi";

import DictionaryModal
    from "../components/DictionaryModal";

import DictionarySelectionAction
    from "../components/DictionarySelectionAction";

import BibleLinkedText
    from "../components/BibleLinkedText";

import {
    carregarMidiasPptx,
    revogarMidiasPptx,
} from "../lib/pptxProcessor";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

function ApresentacaoPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const { user } = useAuth();

    const canvasRef = useRef(null);
    const stageRef = useRef(null);

    const touchStartX = useRef(null);

    const [aula, setAula] = useState(null);
    const [trimestre, setTrimestre] = useState(null);

    const [pdf, setPdf] = useState(null);

    const [
        pptxPaginas,
        setPptxPaginas,
    ] = useState([]);

    const [
        pptxMidias,
        setPptxMidias,
    ] = useState({});

    const [paginaAtual, setPaginaAtual] = useState(1);
    const [totalPaginas, setTotalPaginas] = useState(0);

    const [carregando, setCarregando] = useState(true);
    const [renderizando, setRenderizando] = useState(false);
    const [erro, setErro] = useState("");

    const [telaCheia, setTelaCheia] = useState(false);

    const [slideSize, setSlideSize] = useState({
        width: 0,
        height: 0,
    });

    const [
        referenciasPagina,
        setReferenciasPagina,
    ] = useState([]);

    const [
        hotspotsBiblicos,
        setHotspotsBiblicos,
    ] = useState([]);

    const [
        itensCamadaTexto,
        setItensCamadaTexto,
    ] = useState([]);

    const [
        palavraDicionario,
        setPalavraDicionario,
    ] = useState("");

    const [
        referenciasAbertas,
        setReferenciasAbertas,
    ] = useState(false);

    const [
        referenciaAtiva,
        setReferenciaAtiva,
    ] = useState(null);

    const [
        passagemBiblica,
        setPassagemBiblica,
    ] = useState(null);

    const [
        carregandoPassagem,
        setCarregandoPassagem,
    ] = useState(false);

    const [
        erroPassagem,
        setErroPassagem,
    ] = useState("");

    useEffect(() => {
        return () => {
            revogarMidiasPptx(
                pptxMidias,
            );
        };
    }, [pptxMidias]);

    useEffect(() => {
        if (!user || !id) return;

        let ativo = true;

        async function carregarAula() {
            setCarregando(true);
            setErro("");

            const {
                data: aulaData,
                error: aulaError,
            } = await supabase
                .from("aulas")
                .select(`
                    id,
                    numero,
                    titulo,
                    arquivo_nome,
                    arquivo_tipo,
                    storage_path,
                    total_paginas,
                    ultima_pagina,
                    trimestre_id,
                    conteudo_processado
                    `)
                .eq("id", id)
                .eq("usuario_id", user.id)
                .single();

            if (!ativo) return;

            if (aulaError || !aulaData) {
                console.error(aulaError);
                setErro("Não conseguimos abrir esta aula.");
                setCarregando(false);
                return;
            }

            const {
                data: trimestreData,
                error: trimestreError,
            } = await supabase
                .from("trimestres")
                .select(`
                    id,
                    numero,
                    ano,
                    tema
                    `)
                .eq("id", aulaData.trimestre_id)
                .eq("usuario_id", user.id)
                .single();

            if (!ativo) return;

            if (trimestreError) {
                console.error(trimestreError);
                setErro("Não conseguimos identificar o trimestre.");
                setCarregando(false);
                return;
            }

            const formatoAula =
                aulaData.arquivo_tipo ??
                "pdf";

            if (
                formatoAula === "pptx"
            ) {
                const paginasPptx =
                    aulaData
                        .conteudo_processado
                        ?.paginas;

                if (
                    !Array.isArray(
                        paginasPptx,
                    ) ||
                    paginasPptx.length === 0
                ) {
                    setErro(
                        "Este PowerPoint ainda não possui conteúdo processado.",
                    );
                    setCarregando(false);
                    return;
                }

                const {
                    data:
                        pptxSignedData,
                    error:
                        pptxSignedError,
                } =
                    await supabase.storage
                        .from(
                            "biblia-slides-pdfs",
                        )
                        .createSignedUrl(
                            aulaData.storage_path,
                            60 * 60,
                        );

                if (!ativo) {
                    return;
                }

                let midias = {};

                if (
                    !pptxSignedError &&
                    pptxSignedData
                        ?.signedUrl
                ) {
                    try {
                        const resposta =
                            await fetch(
                                pptxSignedData
                                    .signedUrl,
                            );

                        if (
                            resposta.ok
                        ) {
                            const blob =
                                await resposta
                                    .blob();

                            midias =
                                await carregarMidiasPptx(
                                    blob,
                                    paginasPptx,
                                );
                        }
                    } catch (
                        error
                    ) {
                        console.warn(
                            "Não foi possível carregar todas as imagens do PowerPoint:",
                            error,
                        );
                    }
                }

                if (!ativo) {
                    revogarMidiasPptx(
                        midias,
                    );
                    return;
                }

                const paginaSalva =
                    Math.min(
                        Math.max(
                            aulaData
                                .ultima_pagina ??
                            1,
                            1,
                        ),
                        paginasPptx.length,
                    );

                setAula(aulaData);
                setTrimestre(
                    trimestreData,
                );
                setPdf(null);
                setPptxPaginas(
                    paginasPptx,
                );
                setPptxMidias(
                    midias,
                );
                setTotalPaginas(
                    paginasPptx.length,
                );
                setPaginaAtual(
                    paginaSalva,
                );
                setCarregando(false);
                return;
            }

            const {
                data: signedData,
                error: signedError,
            } = await supabase.storage
                .from("biblia-slides-pdfs")
                .createSignedUrl(
                    aulaData.storage_path,
                    60 * 60,
                );

            if (!ativo) return;

            if (signedError || !signedData?.signedUrl) {
                console.error(signedError);
                setErro("Não conseguimos carregar o arquivo da aula.");
                setCarregando(false);
                return;
            }

            try {
                const documento = await pdfjsLib
                    .getDocument({
                        url: signedData.signedUrl,
                    })
                    .promise;

                if (!ativo) {
                    documento.destroy();
                    return;
                }

                const paginaSalva = Math.min(
                    Math.max(aulaData.ultima_pagina ?? 1, 1),
                    documento.numPages,
                );

                setAula(aulaData);
                setTrimestre(trimestreData);
                setPdf(documento);
                setTotalPaginas(documento.numPages);
                setPaginaAtual(paginaSalva);
                setCarregando(false);

                if (
                    aulaData.total_paginas !== documento.numPages
                ) {
                    await supabase
                        .from("aulas")
                        .update({
                            total_paginas: documento.numPages,
                        })
                        .eq("id", aulaData.id)
                        .eq("usuario_id", user.id);
                }
            } catch (error) {
                console.error(error);

                if (!ativo) return;

                setErro("O PDF não pôde ser processado.");
                setCarregando(false);
            }
        }

        carregarAula();

        return () => {
            ativo = false;
        };
    }, [id, user]);

    const renderizarPagina = useCallback(
        async (numeroPagina) => {
            if (
                !pdf ||
                !canvasRef.current ||
                !stageRef.current
            ) {
                return;
            }

            setRenderizando(true);

            try {
                const pagina = await pdf.getPage(numeroPagina);

                const viewportBase = pagina.getViewport({
                    scale: 1,
                });

                const stage = stageRef.current;

                const larguraDisponivel =
                    Math.max(stage.clientWidth - 32, 200);

                const alturaDisponivel =
                    Math.max(stage.clientHeight - 32, 200);

                const escala = Math.min(
                    larguraDisponivel / viewportBase.width,
                    alturaDisponivel / viewportBase.height,
                );

                const viewport = pagina.getViewport({
                    scale: escala,
                });

                setSlideSize({
                    width: viewport.width,
                    height: viewport.height,
                });

                const textContent =
                    await pagina.getTextContent();

                const itensTexto =
                    textContent.items.filter(
                        (item) =>
                            typeof item?.str === "string" &&
                            item.str.trim(),
                    );

                const textoPagina = itensTexto
                    .map((item) => item.str)
                    .join(" ");

                const camadaTexto =
                    itensTexto.map(
                        (
                            item,
                            indice,
                        ) => {
                            const transform =
                                pdfjsLib.Util.transform(
                                    viewport.transform,
                                    item.transform,
                                );

                            const fontSize =
                                Math.max(
                                    Math.hypot(
                                        transform[2],
                                        transform[3],
                                    ),
                                    6,
                                );

                            const largura =
                                Math.max(
                                    Number(
                                        item.width,
                                    ) *
                                        escala,
                                    2,
                                );

                            const angulo =
                                Math.atan2(
                                    transform[1],
                                    transform[0],
                                ) *
                                (
                                    180 /
                                    Math.PI
                                );

                            return {
                                id:
                                    `${numeroPagina}-texto-${indice}`,

                                texto:
                                    item.str,

                                left:
                                    transform[4],

                                top:
                                    transform[5] -
                                    fontSize,

                                width:
                                    largura,

                                height:
                                    Math.max(
                                        fontSize *
                                            1.2,
                                        8,
                                    ),

                                fontSize,

                                angulo,
                            };
                        },
                    );

                setItensCamadaTexto(
                    camadaTexto,
                );

                const referenciasEncontradas =
                    extrairReferenciasBiblicas(
                        textoPagina,
                    );

                const hotspotsEncontrados = [];

                let contextoContinuacao = null;
                let permiteContinuacao = false;

                for (const item of itensTexto) {
                    let referenciasDoItem =
                        extrairReferenciasBiblicas(
                            item.str,
                        );

                    /*
                     * Exemplo que queremos entender:
                     *
                     * Jo 3.3; 20.22;
                     * 15.5; 2Co 5.17
                     *
                     * Se o bloco anterior terminar com ";",
                     * o próximo bloco pode herdar o livro.
                     */
                    if (
                        permiteContinuacao &&
                        contextoContinuacao
                    ) {
                        const herdadas =
                            extrairContinuacoesBiblicas(
                                item.str,
                                contextoContinuacao,
                            );

                        referenciasDoItem = [
                            ...referenciasDoItem,
                            ...herdadas,
                        ];
                    }

                    referenciasDoItem.sort(
                        (a, b) =>
                            (a.indiceInicio ?? 0) -
                            (b.indiceInicio ?? 0),
                    );

                    if (referenciasDoItem.length > 0) {
                        const transform =
                            pdfjsLib.Util.transform(
                                viewport.transform,
                                item.transform,
                            );

                        const alturaFonte = Math.max(
                            Math.hypot(
                                transform[2],
                                transform[3],
                            ),
                            14,
                        );

                        const larguraTotal = Math.max(
                            item.width * escala,
                            24,
                        );

                        const textoItem = item.str;

                        const totalCaracteres =
                            Math.max(
                                textoItem.length,
                                1,
                            );

                        for (
                            let indice = 0;
                            indice < referenciasDoItem.length;
                            indice += 1
                        ) {
                            const referencia =
                                referenciasDoItem[indice];

                            const inicio = Math.max(
                                referencia.indiceInicio ?? 0,
                                0,
                            );

                            const fim = Math.min(
                                referencia.indiceFim ??
                                totalCaracteres,
                                totalCaracteres,
                            );

                            const proporcaoInicio =
                                inicio / totalCaracteres;

                            const proporcaoLargura =
                                Math.max(
                                    fim - inicio,
                                    1,
                                ) / totalCaracteres;

                            const deslocamentoX =
                                larguraTotal *
                                proporcaoInicio;

                            const larguraReferencia =
                                larguraTotal *
                                proporcaoLargura;

                            hotspotsEncontrados.push({
                                ...referencia,

                                id:
                                    `${numeroPagina}-` +
                                    `${item.str}-` +
                                    `${inicio}-` +
                                    `${indice}`,

                                left:
                                    transform[4] +
                                    deslocamentoX -
                                    3,

                                top:
                                    transform[5] -
                                    alturaFonte -
                                    2,

                                width: Math.max(
                                    larguraReferencia + 6,
                                    22,
                                ),

                                height:
                                    alturaFonte + 4,
                            });
                        }
                    }

                    /*
                     * Só permite herança entre blocos quando
                     * o texto anterior terminou com ";".
                     */
                    const terminaComPontoEVirgula =
                        /;\s*$/.test(item.str);

                    if (
                        terminaComPontoEVirgula &&
                        referenciasDoItem.length > 0
                    ) {
                        const ultimaReferencia =
                            referenciasDoItem[
                            referenciasDoItem.length - 1
                            ];

                        contextoContinuacao = {
                            livro:
                                ultimaReferencia.livro,

                            livroApi:
                                ultimaReferencia.livroApi,
                        };

                        permiteContinuacao = true;
                    } else {
                        contextoContinuacao = null;
                        permiteContinuacao = false;
                    }
                }

                setReferenciasPagina(
                    referenciasEncontradas,
                );

                setHotspotsBiblicos(
                    hotspotsEncontrados,
                );

                const canvas = canvasRef.current;

                const contexto = canvas.getContext(
                    "2d",
                    {
                        alpha: false,
                    },
                );

                const outputScale =
                    window.devicePixelRatio || 1;

                canvas.width = Math.floor(
                    viewport.width * outputScale,
                );

                canvas.height = Math.floor(
                    viewport.height * outputScale,
                );

                canvas.style.width = `${Math.floor(
                    viewport.width,
                )}px`;

                canvas.style.height = `${Math.floor(
                    viewport.height,
                )}px`;

                await pagina.render({
                    canvasContext: contexto,
                    viewport,
                    transform:
                        outputScale !== 1
                            ? [
                                outputScale,
                                0,
                                0,
                                outputScale,
                                0,
                                0,
                            ]
                            : null,
                }).promise;
            } catch (error) {
                console.error(error);
                setErro("Não conseguimos exibir esta página.");
            } finally {
                setRenderizando(false);
            }
        },
        [pdf],
    );

    useEffect(() => {
        if (!pdf) return;

        renderizarPagina(paginaAtual);
    }, [
        pdf,
        paginaAtual,
        renderizarPagina,
    ]);

    useEffect(() => {
        if (
            (aula?.arquivo_tipo ??
                "pdf") !==
            "pptx"
        ) {
            return;
        }

        const slide =
            pptxPaginas[
                paginaAtual - 1
            ];

        const texto =
            (slide?.blocos ?? [])
                .map(
                    (bloco) =>
                        bloco.texto ??
                        "",
                )
                .join(" ");

        setReferenciasPagina(
            extrairReferenciasBiblicas(
                texto,
            ),
        );

        setHotspotsBiblicos([]);
        setItensCamadaTexto([]);
        setRenderizando(false);
    }, [
        aula?.arquivo_tipo,
        pptxPaginas,
        paginaAtual,
    ]);

    useEffect(() => {
        setReferenciasAbertas(false);
        setReferenciaAtiva(null);
        setPassagemBiblica(null);
        setErroPassagem("");
    }, [paginaAtual]);

    useEffect(() => {
        if (
            !aula?.id ||
            !user ||
            paginaAtual < 1
        ) {
            return;
        }

        async function salvarProgresso() {
            const { error } = await supabase
                .from("aulas")
                .update({
                    ultima_pagina: paginaAtual,
                })
                .eq("id", aula.id)
                .eq("usuario_id", user.id);

            if (error) {
                console.error(
                    "Erro ao salvar progresso da apresentação:",
                    error,
                );
            }
        }

        salvarProgresso();
    }, [
        paginaAtual,
        aula?.id,
        aula?.arquivo_tipo,
        user,
    ]);

    useEffect(() => {
        if (!pdf) return;

        let timer;

        function redimensionar() {
            clearTimeout(timer);

            timer = setTimeout(() => {
                renderizarPagina(paginaAtual);
            }, 120);
        }

        window.addEventListener(
            "resize",
            redimensionar,
        );

        return () => {
            clearTimeout(timer);

            window.removeEventListener(
                "resize",
                redimensionar,
            );
        };
    }, [
        pdf,
        paginaAtual,
        renderizarPagina,
    ]);

    const anterior = useCallback(() => {
        setPaginaAtual((pagina) =>
            Math.max(1, pagina - 1),
        );
    }, []);

    const proxima = useCallback(() => {
        setPaginaAtual((pagina) =>
            Math.min(totalPaginas, pagina + 1),
        );
    }, [totalPaginas]);

    useEffect(() => {
        function teclado(event) {

            if (referenciaAtiva) {
                if (event.key === "Escape") {
                    fecharReferencia();
                }

                return;
            }

            if (
                referenciasAbertas &&
                event.key === "Escape"
            ) {
                setReferenciasAbertas(false);
                return;
            }
            if (
                event.key === "ArrowRight" ||
                event.key === "PageDown" ||
                event.key === " "
            ) {
                event.preventDefault();
                proxima();
            }

            if (
                event.key === "ArrowLeft" ||
                event.key === "PageUp"
            ) {
                event.preventDefault();
                anterior();
            }

            if (event.key === "Home") {
                setPaginaAtual(1);
            }

            if (event.key === "End") {
                setPaginaAtual(totalPaginas);
            }
        }

        window.addEventListener(
            "keydown",
            teclado,
        );

        return () => {
            window.removeEventListener(
                "keydown",
                teclado,
            );
        };
    }, [
        anterior,
        proxima,
        totalPaginas,
        referenciaAtiva,
        referenciasAbertas,
    ]);

    useEffect(() => {
        function fullscreenChange() {
            setTelaCheia(
                Boolean(document.fullscreenElement),
            );

            setTimeout(() => {
                renderizarPagina(paginaAtual);
            }, 150);
        }

        document.addEventListener(
            "fullscreenchange",
            fullscreenChange,
        );

        return () => {
            document.removeEventListener(
                "fullscreenchange",
                fullscreenChange,
            );
        };
    }, [
        paginaAtual,
        renderizarPagina,
    ]);

    async function abrirReferencia(
        referencia,
    ) {
        setReferenciaAtiva(referencia);

        setReferenciasAbertas(false);

        setPassagemBiblica(null);
        setErroPassagem("");
        setCarregandoPassagem(true);

        try {
            const passagem =
                await buscarPassagemBiblica(
                    referencia,
                );

            setPassagemBiblica(passagem);
        } catch (error) {
            console.error(
                "Erro ao carregar referência:",
                error,
            );

            setErroPassagem(
                "Não conseguimos carregar o texto bíblico agora.",
            );
        } finally {
            setCarregandoPassagem(false);
        }
    }

    function fecharReferencia() {
        setReferenciaAtiva(null);
        setPassagemBiblica(null);
        setErroPassagem("");
    }

    async function alternarTelaCheia() {
        try {
            if (!document.fullscreenElement) {
                await document.documentElement.requestFullscreen();
            } else {
                await document.exitFullscreen();
            }
        } catch (error) {
            console.error(error);
        }
    }

    function voltar() {
        if (trimestre?.id) {
            navigate(`/trimestres/${trimestre.id}`);
            return;
        }

        navigate("/");
    }

    function touchStart(event) {
        touchStartX.current =
            event.touches[0]?.clientX ?? null;
    }

    function touchEnd(event) {
        if (touchStartX.current === null) return;

        const fim =
            event.changedTouches[0]?.clientX;

        if (fim === undefined) return;

        const diferenca =
            fim - touchStartX.current;

        if (Math.abs(diferenca) < 50) {
            touchStartX.current = null;
            return;
        }

        if (diferenca < 0) {
            proxima();
        } else {
            anterior();
        }

        touchStartX.current = null;
    }

    const slidePptxAtual =
        pptxPaginas[
            paginaAtual - 1
        ] ?? null;

    const larguraPptx =
        Number(
            slidePptxAtual
                ?.largura ??
            aula
                ?.conteudo_processado
                ?.slide
                ?.largura ??
            12192000,
        );

    const alturaPptx =
        Number(
            slidePptxAtual
                ?.altura ??
            aula
                ?.conteudo_processado
                ?.slide
                ?.altura ??
            6858000,
        );

    if (carregando) {
        return (
            <div className="presentation-loading">
                <div className="loading-dot" />

                <p>Preparando sua apresentação...</p>
            </div>
        );
    }

    if (
        erro &&
        !pdf &&
        pptxPaginas.length === 0
    ) {
        return (
            <div className="presentation-error">
                <p>{erro}</p>

                <button
                    className="secondary-button"
                    onClick={voltar}
                >
                    <ArrowLeft size={18} />
                    Voltar
                </button>
            </div>
        );
    }

    return (
        <div className="presentation-page">
            <header className="presentation-header">
                <button
                    className="presentation-back"
                    onClick={voltar}
                    title="Voltar para o trimestre"
                >
                    <ArrowLeft size={20} />
                </button>

                <div className="presentation-title">
                    <span>
                        Aula {aula?.numero}
                    </span>

                    <strong>
                        {aula?.titulo}
                    </strong>
                </div>

                <div className="presentation-actions">
                    {referenciasPagina.length > 0 && (
                        <div className="presentation-reference-menu">
                            <button
                                type="button"
                                className="presentation-bible-button"
                                title="Referências desta página"
                                onClick={() =>
                                    setReferenciasAbertas(
                                        (atual) => !atual,
                                    )
                                }
                            >
                                <BookOpenText size={19} />

                                <span>
                                    {referenciasPagina.length}
                                </span>
                            </button>

                            {referenciasAbertas && (
                                <div className="reference-popover">
                                    <span>
                                        Referências nesta página
                                    </span>

                                    {referenciasPagina.map(
                                        (referencia) => (
                                            <button
                                                key={
                                                    referencia.referencia
                                                }
                                                type="button"
                                                onClick={() =>
                                                    abrirReferencia(
                                                        referencia,
                                                    )
                                                }
                                            >
                                                {
                                                    referencia.referencia
                                                }
                                            </button>
                                        ),
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <button
                        className="presentation-fullscreen"
                        onClick={alternarTelaCheia}
                        title={
                            telaCheia
                                ? "Sair da tela cheia"
                                : "Tela cheia"
                        }
                    >
                        {telaCheia ? (
                            <Minimize size={20} />
                        ) : (
                            <Expand size={20} />
                        )}
                    </button>
                </div>
            </header>

            <main
                className="presentation-stage"
                ref={stageRef}
                onTouchStart={touchStart}
                onTouchEnd={touchEnd}
            >
                <button
                    className="presentation-side presentation-side-left"
                    onClick={anterior}
                    disabled={paginaAtual <= 1}
                    aria-label="Página anterior"
                >
                    <ChevronLeft size={26} />
                </button>

                <div className="pdf-page-container">
                    {(aula?.arquivo_tipo ??
                        "pdf") ===
                    "pptx" ? (
                        <div
                            className="pptx-slide-wrapper"
                            style={{
                                aspectRatio:
                                    `${larguraPptx} / ${alturaPptx}`,

                                background:
                                    slidePptxAtual
                                        ?.fundo ??
                                    "#ffffff",
                            }}
                        >
                            {(slidePptxAtual
                                ?.blocos ??
                                []).map(
                                (
                                    bloco,
                                    indice,
                                ) => {
                                    const left =
                                        (
                                            Number(
                                                bloco.x ??
                                                0,
                                            ) /
                                            larguraPptx
                                        ) *
                                        100;

                                    const top =
                                        (
                                            Number(
                                                bloco.y ??
                                                0,
                                            ) /
                                            alturaPptx
                                        ) *
                                        100;

                                    const width =
                                        (
                                            Number(
                                                bloco.largura ??
                                                larguraPptx,
                                            ) /
                                            larguraPptx
                                        ) *
                                        100;

                                    const height =
                                        (
                                            Number(
                                                bloco.altura ??
                                                0,
                                            ) /
                                            alturaPptx
                                        ) *
                                        100;

                                    const estiloBase = {
                                        left:
                                            `${left}%`,
                                        top:
                                            `${top}%`,
                                        width:
                                            `${Math.max(
                                                width,
                                                0.1,
                                            )}%`,
                                        height:
                                            `${Math.max(
                                                height,
                                                0.1,
                                            )}%`,
                                        zIndex:
                                            Number(
                                                bloco.zIndex ??
                                                indice,
                                            ) +
                                            1,
                                        transform:
                                            bloco.rotacao
                                                ? `rotate(${bloco.rotacao}deg)`
                                                : undefined,
                                    };

                                    if (
                                        bloco.tipo ===
                                        "imagem"
                                    ) {
                                        const src =
                                            pptxMidias[
                                                bloco.midiaPath
                                            ];

                                        if (!src) {
                                            return null;
                                        }

                                        return (
                                            <img
                                                key={
                                                    `${paginaAtual}-pptx-${indice}`
                                                }
                                                className="pptx-image-block"
                                                src={src}
                                                alt=""
                                                draggable="false"
                                                style={
                                                    estiloBase
                                                }
                                            />
                                        );
                                    }

                                    if (
                                        bloco.tipo ===
                                        "linha"
                                    ) {
                                        return (
                                            <div
                                                key={
                                                    `${paginaAtual}-pptx-${indice}`
                                                }
                                                className="pptx-line-block"
                                                style={{
                                                    ...estiloBase,

                                                    background:
                                                        bloco.cor,

                                                    minHeight:
                                                        `${Math.max(
                                                            Number(
                                                                bloco.espessura ??
                                                                12700,
                                                            ) /
                                                                9525,
                                                            1,
                                                        )}px`,
                                                }}
                                            />
                                        );
                                    }

                                    const tamanho =
                                        Number(
                                            bloco.tamanhoFonte ??
                                            24,
                                        );

                                    const borda =
                                        bloco.bordaCor
                                            ? `${Math.max(
                                                Number(
                                                    bloco.bordaLargura ??
                                                    9525,
                                                ) /
                                                    9525,
                                                1,
                                            )}px solid ${bloco.bordaCor}`
                                            : "none";

                                    const arredondamento =
                                        bloco.geometria ===
                                        "ellipse"
                                            ? "50%"
                                            : "0";

                                    if (
                                        bloco.tipo ===
                                        "forma"
                                    ) {
                                        return (
                                            <div
                                                key={
                                                    `${paginaAtual}-pptx-${indice}`
                                                }
                                                className="pptx-shape-block"
                                                style={{
                                                    ...estiloBase,

                                                    background:
                                                        bloco.preenchimento ??
                                                        "transparent",

                                                    border:
                                                        borda,

                                                    borderRadius:
                                                        arredondamento,
                                                }}
                                            />
                                        );
                                    }

                                    return (
                                        <div
                                            key={
                                                `${paginaAtual}-pptx-${indice}`
                                            }
                                            className="pptx-text-block"
                                            style={{
                                                ...estiloBase,

                                                background:
                                                    bloco.preenchimento ??
                                                    "transparent",

                                                border:
                                                    borda,

                                                borderRadius:
                                                    arredondamento,

                                                color:
                                                    bloco.corTexto ??
                                                    "#111827",

                                                fontFamily:
                                                    bloco.fonte
                                                        ? `"${bloco.fonte}", Arial, sans-serif`
                                                        : "Arial, sans-serif",

                                                fontWeight:
                                                    bloco.negrito
                                                        ? 700
                                                        : 400,

                                                fontStyle:
                                                    bloco.italico
                                                        ? "italic"
                                                        : "normal",

                                                textAlign:
                                                    bloco.alinhamento ??
                                                    "left",

                                                alignItems:
                                                    bloco.alinhamentoVertical ??
                                                    "flex-start",

                                                fontSize:
                                                    `${Math.max(
                                                        tamanho *
                                                            0.104,
                                                        0.78,
                                                    )}cqw`,
                                            }}
                                        >
                                            <BibleLinkedText
                                                texto={
                                                    bloco.texto ??
                                                    ""
                                                }
                                                onReferencia={
                                                    abrirReferencia
                                                }
                                            />
                                        </div>
                                    );
                                },
                            )}
                        </div>
                    ) : (
                        <div
                            className="pdf-slide-wrapper"
                            style={{
                                width: slideSize.width,
                                height: slideSize.height,
                            }}
                        >
                            <canvas
                                ref={canvasRef}
                                className={
                                    renderizando
                                        ? "pdf-canvas pdf-canvas-loading"
                                        : "pdf-canvas"
                                }
                            />

                            <div
                                className="presentation-text-layer"
                                aria-hidden="true"
                            >
                                {itensCamadaTexto.map(
                                    (item) => (
                                        <span
                                            key={
                                                item.id
                                            }
                                            style={{
                                                left:
                                                    item.left,
                                                top:
                                                    item.top,
                                                width:
                                                    item.width,
                                                height:
                                                    item.height,
                                                fontSize:
                                                    item.fontSize,
                                                transform:
                                                    Math.abs(
                                                        item.angulo,
                                                    ) >
                                                    0.5
                                                        ? `rotate(${item.angulo}deg)`
                                                        : undefined,
                                            }}
                                        >
                                            {item.texto}
                                        </span>
                                    ),
                                )}
                            </div>

                            <div className="bible-hotspot-layer">
                                {hotspotsBiblicos.map(
                                    (hotspot) => (
                                        <button
                                            key={hotspot.id}
                                            type="button"
                                            className="bible-reference-hotspot"
                                            style={{
                                                left: hotspot.left,
                                                top: hotspot.top,
                                                width: hotspot.width,
                                                height: hotspot.height,
                                            }}
                                            title={`Abrir ${hotspot.referencia}`}
                                            aria-label={`Abrir ${hotspot.referencia}`}
                                            onClick={(event) => {
                                                event.stopPropagation();

                                                abrirReferencia(
                                                    hotspot,
                                                );
                                            }}
                                        />
                                    ),
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <button
                    className="presentation-side presentation-side-right"
                    onClick={proxima}
                    disabled={paginaAtual >= totalPaginas}
                    aria-label="Próxima página"
                >
                    <ChevronRight size={26} />
                </button>
            </main>

            <DictionarySelectionAction
                containerSelector={
                    (aula?.arquivo_tipo ??
                        "pdf") ===
                    "pptx"
                        ? ".pptx-slide-wrapper"
                        : ".presentation-text-layer"
                }
                disabled={
                    renderizando
                }
                onOpen={
                    setPalavraDicionario
                }
            />

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

            <footer className="presentation-footer">
                <button
                    onClick={anterior}
                    disabled={paginaAtual <= 1}
                    aria-label="Anterior"
                >
                    <ChevronLeft size={20} />
                </button>

                <span>
                    {paginaAtual} / {totalPaginas}
                </span>

                <button
                    onClick={proxima}
                    disabled={paginaAtual >= totalPaginas}
                    aria-label="Próxima"
                >
                    <ChevronRight size={20} />
                </button>
            </footer>

            {referenciaAtiva && (
                <div
                    className="verse-overlay"
                    onMouseDown={(event) => {
                        if (
                            event.target ===
                            event.currentTarget
                        ) {
                            fecharReferencia();
                        }
                    }}
                >
                    <article className="verse-card">
                        <header className="verse-header">
                            <div>
                                <span>
                                    Referência bíblica
                                </span>

                                <h2>
                                    {
                                        referenciaAtiva.referencia
                                    }
                                </h2>
                            </div>

                            <button
                                type="button"
                                onClick={
                                    fecharReferencia
                                }
                                aria-label="Fechar"
                            >
                                <X size={20} />
                            </button>
                        </header>

                        <div className="verse-content">
                            {carregandoPassagem && (
                                <div className="verse-loading">
                                    <div className="loading-dot" />

                                    <p>
                                        Abrindo a Bíblia...
                                    </p>
                                </div>
                            )}

                            {erroPassagem && (
                                <div className="verse-error">
                                    {erroPassagem}
                                </div>
                            )}

                            {!carregandoPassagem &&
                                passagemBiblica?.versos?.map(
                                    (verso) => (
                                        <p
                                            key={`${verso.numero}-${verso.nome}`}
                                            className="verse-text"
                                        >
                                            <sup>
                                                {verso.numero}
                                            </sup>

                                            {verso.texto}
                                        </p>
                                    ),
                                )}
                        </div>

                        {passagemBiblica && (
                            <footer className="verse-footer">
                                <span>
                                    {
                                        passagemBiblica.traducao
                                    }
                                </span>

                                <span>
                                    Texto em domínio público
                                </span>
                            </footer>
                        )}
                    </article>
                </div>
            )}

            {erro && (
                <div className="presentation-toast">
                    {erro}
                </div>
            )}
        </div>
    );
}

export default ApresentacaoPage;