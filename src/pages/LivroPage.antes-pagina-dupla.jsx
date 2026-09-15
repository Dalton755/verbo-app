import {
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import {
    ArrowLeft,
    ArrowLeftRight,
    BookOpen,
    ChevronLeft,
    ChevronRight,
    FileText,
    Minus,
    Moon,
    Plus,
    Rows3,
    Sun,
    UnfoldVertical,
} from "lucide-react";

import {
    useNavigate,
    useParams,
} from "react-router-dom";

import {
    supabase,
} from "../lib/supabase";

import {
    useAuth,
} from "../contexts/AuthContext";

import {
    buscarLivroCache,
    salvarLivroCache,
} from "../lib/bookCache";

import {
    processarPdfLivro,
} from "../lib/bookPdfProcessor";

import BibleLinkedText
    from "../components/BibleLinkedText";

import BiblePassageModal
    from "../components/BiblePassageModal";

function lerProgressoLivro(id) {
    if (!id) {
        return null;
    }

    try {
        const salvo =
            localStorage.getItem(
                `livro-progresso-${id}`,
            );

        if (!salvo) {
            return null;
        }

        return JSON.parse(
            salvo,
        );
    } catch (error) {
        console.warn(
            "Erro ao ler progresso do livro:",
            error,
        );

        return null;
    }
}

function LivroPage() {
    const { id } =
        useParams();

    const navigate =
        useNavigate();

    const { user } =
        useAuth();

    const chaveProgresso =
        `livro-progresso-${id}`;

    const cacheInicial =
        buscarLivroCache(id);

    const progressoInicial =
        lerProgressoLivro(id);

    const paginaRefs =
        useRef({});

    const pagedViewportRef =
        useRef(null);

    const pagedContentRef =
        useRef(null);

    const paginaLeituraAtualRef =
        useRef(1);

    const totalPaginasLeituraRef =
        useRef(1);

    const contadorPaginaRef =
        useRef(null);

    const botaoPaginaAnteriorRef =
        useRef(null);

    const botaoProximaPaginaRef =
        useRef(null);

    const barraProgressoRef =
        useRef(null);

    const salvarPaginaHorizontalTimerRef =
        useRef(null);

    const gestoPaginaRef =
        useRef({
            ativo: false,
            cancelado: false,
            horizontal: false,

            pointerId: null,

            inicioX: 0,
            inicioY: 0,

            atualX: 0,

            iniciadoEm: 0,
        });

    const restaurandoProgresso =
        useRef(true);

    const progressoAtualRef =
        useRef({
            pagina:
                Number(
                    progressoInicial
                        ?.pagina ??
                    cacheInicial
                        ?.livro
                        ?.ultima_pagina ??
                    1,
                ),

            posicao:
                Number(
                    progressoInicial
                        ?.posicao ??
                    cacheInicial
                        ?.livro
                        ?.ultima_posicao ??
                    0,
                ),

            scrollY:
                Number(
                    progressoInicial
                        ?.scrollY ??
                    0,
                ),
        });

    const [
        livro,
        setLivro,
    ] = useState(
        cacheInicial?.livro ??
        null,
    );

    const [
        paginas,
        setPaginas,
    ] = useState(
        cacheInicial?.paginas ??
        [],
    );

    const [
        carregando,
        setCarregando,
    ] = useState(
        !cacheInicial,
    );

    const [
        erro,
        setErro,
    ] = useState("");

    const [
        pdfUrl,
        setPdfUrl,
    ] = useState("");

    const [
        modoVisualizacao,
        setModoVisualizacao,
    ] = useState("texto");

    const [
        referenciaAtiva,
        setReferenciaAtiva,
    ] = useState(null);

    const [
        tamanhoFonte,
        setTamanhoFonte,
    ] = useState(
        Number(
            progressoInicial
                ?.tamanhoFonte ??
            cacheInicial
                ?.livro
                ?.tamanho_fonte ??
            20,
        ),
    );

    const [
        espacamento,
        setEspacamento,
    ] = useState(
        Number(
            progressoInicial
                ?.espacamento ??
            cacheInicial
                ?.livro
                ?.espacamento ??
            1.7,
        ),
    );

    const [
        temaLeitura,
        setTemaLeitura,
    ] = useState(
        progressoInicial
            ?.temaLeitura ??
        cacheInicial
            ?.livro
            ?.tema_leitura ??
        "CLARO",
    );

    const [
        modoLeitura,
        setModoLeitura,
    ] = useState(
        progressoInicial
            ?.modoLeitura ??
        cacheInicial
            ?.livro
            ?.modo_leitura ??
        "ROLAGEM",
    );

    const [
        paginaAtual,
        setPaginaAtual,
    ] = useState(
        Number(
            progressoInicial
                ?.pagina ??
            cacheInicial
                ?.livro
                ?.ultima_pagina ??
            1,
        ),
    );

    const [
        posicaoPagina,
        setPosicaoPagina,
    ] = useState(
        Number(
            progressoInicial
                ?.posicao ??
            cacheInicial
                ?.livro
                ?.ultima_posicao ??
            0,
        ),
    );

    const [
        paginaLeituraAtual,
        setPaginaLeituraAtual,
    ] = useState(1);

    const [
        totalPaginasLeitura,
        setTotalPaginasLeitura,
    ] = useState(1);

    const [
        paginacaoPronta,
        setPaginacaoPronta,
    ] = useState(false);

    function sincronizarControlesPagina(
        pagina,
        total,
    ) {
        if (
            contadorPaginaRef.current
        ) {
            contadorPaginaRef.current
                .textContent =
                `${pagina} / ${total}`;
        }

        if (
            botaoPaginaAnteriorRef
                .current
        ) {
            botaoPaginaAnteriorRef
                .current.disabled =
                pagina <= 1;
        }

        if (
            botaoProximaPaginaRef
                .current
        ) {
            botaoProximaPaginaRef
                .current.disabled =
                pagina >= total;
        }

        if (
            barraProgressoRef.current
        ) {
            const percentual =
                total > 1
                    ? (
                        (
                            pagina - 1
                        ) /
                        (
                            total - 1
                        )
                    ) * 100
                    : 0;

            barraProgressoRef.current
                .style.width =
                `${percentual}%`;
        }
    }


    function calcularPosicaoLogica(
        paginaLeitura,
        totalLeitura,
    ) {
        if (
            paginas.length === 0
        ) {
            return {
                pagina: 1,
                posicao: 0,
            };
        }

        if (
            totalLeitura <= 1
        ) {
            return {
                pagina: 1,
                posicao: 0,
            };
        }

        const proporcao =
            (
                paginaLeitura - 1
            ) /
            (
                totalLeitura - 1
            );

        /*
         * Última página visual =
         * fim da última página lógica.
         */
        if (
            paginaLeitura >=
            totalLeitura
        ) {
            return {
                pagina:
                    paginas.length,

                posicao: 1,
            };
        }

        const unidade =
            proporcao *
            paginas.length;

        const indice =
            Math.floor(
                unidade,
            );

        return {
            pagina:
                Math.min(
                    paginas.length,

                    Math.max(
                        1,
                        indice + 1,
                    ),
                ),

            posicao:
                Math.min(
                    1,

                    Math.max(
                        0,
                        unidade -
                        indice,
                    ),
                ),
        };
    }


    function salvarProgressoHorizontal(
        paginaLeitura,
    ) {
        const total =
            totalPaginasLeituraRef
                .current;

        const logico =
            calcularPosicaoLogica(
                paginaLeitura,
                total,
            );

        const novoProgresso = {
            ...(
                lerProgressoLivro(id) ??
                {}
            ),

            pagina:
                logico.pagina,

            posicao:
                Number(
                    logico.posicao
                        .toFixed(4),
                ),

            paginaLeitura,

            totalPaginasLeitura:
                total,

            largura:
                window.innerWidth,

            tamanhoFonte,

            espacamento,

            temaLeitura,

            modoLeitura:
                "PAGINAS",

            atualizadoEm:
                Date.now(),
        };

        /*
         * Fonte real do ponto de leitura.
         */
        progressoAtualRef.current =
            novoProgresso;

        /*
         * Salvamento local é imediato.
         */
        localStorage.setItem(
            chaveProgresso,

            JSON.stringify(
                novoProgresso,
            ),
        );

        /*
         * Supabase recebe debounce,
         * sem bloquear a troca.
         */
        if (
            salvarPaginaHorizontalTimerRef
                .current
        ) {
            clearTimeout(
                salvarPaginaHorizontalTimerRef
                    .current,
            );
        }

        salvarPaginaHorizontalTimerRef
            .current =
            setTimeout(
                async () => {
                    if (
                        !user ||
                        !livro?.id
                    ) {
                        return;
                    }

                    const {
                        error,
                    } = await supabase
                        .from("livros")
                        .update({
                            ultima_pagina:
                                logico.pagina,

                            ultima_posicao:
                                Number(
                                    logico
                                        .posicao
                                        .toFixed(
                                            4,
                                        ),
                                ),

                            tamanho_fonte:
                                tamanhoFonte,

                            espacamento,

                            tema_leitura:
                                temaLeitura,

                            modo_leitura:
                                "PAGINAS",
                        })
                        .eq(
                            "id",
                            livro.id,
                        )
                        .eq(
                            "usuario_id",
                            user.id,
                        );

                    if (error) {
                        console.error(
                            "Erro ao salvar página do livro:",
                            error,
                        );
                    }
                },
                350,
            );
    }


    function aplicarPaginaLeitura(
        numero,
        {
            salvar = true,
        } = {},
    ) {
        const total =
            Math.max(
                1,
                totalPaginasLeituraRef
                    .current,
            );

        const destino =
            Math.min(
                total,

                Math.max(
                    1,
                    Number(numero) ||
                    1,
                ),
            );

        /*
         * Atualiza imediatamente.
         * NÃO chama setState.
         */
        paginaLeituraAtualRef.current =
            destino;

        const conteudo =
            pagedContentRef.current;

        if (conteudo) {
            const deslocamento =
                (
                    destino - 1
                ) *
                100;

            conteudo.style.transform =
                `translate3d(-${deslocamento}vw, 0, 0)`;
        }

        sincronizarControlesPagina(
            destino,
            total,
        );

        if (salvar) {
            salvarProgressoHorizontal(
                destino,
            );
        }
    }



    useEffect(() => {
        if (
            !user ||
            !id
        ) {
            return;
        }

        let ativo = true;

        async function gerarUrlPdf(
            dadosLivro,
        ) {
            const {
                data: signed,
                error,
            } =
                await supabase.storage
                    .from(
                        "biblia-slides-pdfs",
                    )
                    .createSignedUrl(
                        dadosLivro
                            .storage_path,
                        60 * 60,
                    );

            if (
                !error &&
                ativo &&
                signed?.signedUrl
            ) {
                setPdfUrl(
                    signed.signedUrl,
                );
            }

            return {
                signed,
                error,
            };
        }

        async function carregar() {
            if (!cacheInicial) {
                setCarregando(true);
            }

            setErro("");

            const {
                data,
                error,
            } = await supabase
                .from("livros")
                .select(`
            id,
            titulo,
            autor,
            arquivo_nome,
            storage_path,
            total_paginas,
            ultima_pagina,
            ultima_posicao,
            tamanho_fonte,
            espacamento,
            tema_leitura,
            modo_leitura,
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

                if (!cacheInicial) {
                    setErro(
                        "Não conseguimos abrir este livro.",
                    );

                    setCarregando(false);
                }

                return;
            }

            /*
             * =================================
             * LIVRO JÁ PROCESSADO
             * =================================
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

                setLivro(
                    data,
                );

                setPaginas(
                    paginasProntas,
                );

                salvarLivroCache(
                    id,
                    {
                        livro:
                            data,

                        paginas:
                            paginasProntas,
                    },
                );

                const salvo =
                    lerProgressoLivro(
                        id,
                    );

                if (!salvo) {
                    setPaginaAtual(
                        Number(
                            data.ultima_pagina ??
                            1,
                        ),
                    );

                    setPosicaoPagina(
                        Number(
                            data.ultima_posicao ??
                            0,
                        ),
                    );

                    setTamanhoFonte(
                        Number(
                            data.tamanho_fonte ??
                            20,
                        ),
                    );

                    setEspacamento(
                        Number(
                            data.espacamento ??
                            1.7,
                        ),
                    );

                    setTemaLeitura(
                        data.tema_leitura ??
                        "CLARO",
                    );

                    setModoLeitura(
                        data.modo_leitura ??
                        "ROLAGEM",
                    );

                    progressoAtualRef.current = {
                        pagina:
                            Number(
                                data.ultima_pagina ??
                                1,
                            ),

                        posicao:
                            Number(
                                data.ultima_posicao ??
                                0,
                            ),

                        scrollY:
                            0,
                    };
                }

                setCarregando(
                    false,
                );

                /*
                 * PDF original é carregado
                 * em segundo plano.
                 */
                gerarUrlPdf(
                    data,
                );

                return;
            }

            /*
             * =================================
             * LIVRO ANTIGO AINDA NÃO PROCESSADO
             * =================================
             *
             * Ex.: O Deus da Aliança.
             */

            const {
                signed,
                error:
                signedError,
            } =
                await gerarUrlPdf(
                    data,
                );

            if (
                signedError ||
                !signed?.signedUrl
            ) {
                setErro(
                    "Não conseguimos abrir o PDF deste livro.",
                );

                setCarregando(
                    false,
                );

                return;
            }

            try {
                const resposta =
                    await fetch(
                        signed.signedUrl,
                    );

                if (!resposta.ok) {
                    throw new Error(
                        "Falha ao baixar PDF.",
                    );
                }

                const blob =
                    await resposta.blob();

                const processamento =
                    await processarPdfLivro(
                        blob,
                    );

                const conteudoProcessado = {
                    versao:
                        processamento.versao,

                    paginas:
                        processamento.paginas,
                };

                const livroAtualizado = {
                    ...data,

                    total_paginas:
                        processamento
                            .totalPaginas,

                    conteudo_processado:
                        conteudoProcessado,

                    processador_versao:
                        1,
                };

                if (!ativo) {
                    return;
                }

                setLivro(
                    livroAtualizado,
                );

                setPaginas(
                    processamento.paginas,
                );

                salvarLivroCache(
                    id,
                    {
                        livro:
                            livroAtualizado,

                        paginas:
                            processamento
                                .paginas,
                    },
                );

                const {
                    error:
                    processamentoError,
                } = await supabase
                    .from("livros")
                    .update({
                        total_paginas:
                            processamento
                                .totalPaginas,

                        conteudo_processado:
                            conteudoProcessado,

                        processado_em:
                            new Date()
                                .toISOString(),

                        processador_versao:
                            1,
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
                        "Erro ao persistir livro processado:",
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
                    "Não conseguimos preparar este livro para leitura.",
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

    /*
     * =================================
     * RESTAURAÇÃO DA POSIÇÃO
     * =================================
     */
    useLayoutEffect(() => {
        if (
            carregando ||
            paginas.length === 0 ||
            modoVisualizacao !==
            "texto" ||
            modoLeitura !==
            "ROLAGEM"
        ) {
            return;
        }

        restaurandoProgresso.current =
            true;

        const salvo =
            lerProgressoLivro(id);

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

            const diferenca =
                larguraSalva > 0
                    ? Math.abs(
                        window.innerWidth -
                        larguraSalva,
                    ) /
                    larguraSalva
                    : 1;

            /*
             * Mesmo aparelho/largura:
             * scroll exato.
             */
            if (
                salvo &&
                Number.isFinite(
                    scrollSalvo,
                ) &&
                diferenca < 0.12
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
             * Tela diferente:
             * página + percentual.
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
                        88,
                    ),

                behavior:
                    "auto",
            });
        }

        restaurar();

        const frame1 =
            requestAnimationFrame(
                restaurar,
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

            clearTimeout(
                timer,
            );
        };
    }, [
        carregando,
        paginas,
        modoVisualizacao,
        modoLeitura,
        id,
    ]);

    /*
     * =================================
     * SALVAR POSIÇÃO DURANTE SCROLL
     * =================================
     */
    useEffect(() => {
        if (
            paginas.length === 0 ||
            modoVisualizacao !==
            "texto" ||
            modoLeitura !==
            "ROLAGEM"
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

            let encontrada =
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
                    encontrada = {
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
                    encontrada = {
                        numero:
                            item.numero,

                        topo,

                        altura,
                    };
                }
            }

            if (!encontrada) {
                return;
            }

            const percentual =
                Math.min(
                    Math.max(
                        (
                            pontoLeitura -
                            encontrada.topo
                        ) /
                        encontrada.altura,
                        0,
                    ),
                    1,
                );

            const novoProgresso = {
                pagina:
                    encontrada.numero,

                posicao:
                    Number(
                        percentual
                            .toFixed(4),
                    ),

                scrollY:
                    window.scrollY,

                largura:
                    window.innerWidth,

                tamanhoFonte,

                espacamento,

                temaLeitura,

                modoLeitura,

                atualizadoEm:
                    Date.now(),
            };

            progressoAtualRef.current =
                novoProgresso;

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
        espacamento,
        temaLeitura,
        modoLeitura,
    ]);

    /*
 * =================================
 * PAGINAÇÃO RESPONSIVA
 * =================================
 */
    useLayoutEffect(() => {
        if (
            carregando ||
            paginas.length === 0 ||
            modoVisualizacao !==
            "texto" ||
            modoLeitura !==
            "PAGINAS"
        ) {
            setPaginacaoPronta(
                false,
            );

            return;
        }

        const viewport =
            pagedViewportRef.current;

        const content =
            pagedContentRef.current;

        if (
            !viewport ||
            !content
        ) {
            return;
        }

        let frame = null;

        function calcularPaginacao() {
            const larguraViewport =
                viewport.clientWidth;

            const larguraConteudo =
                content.clientWidth;

            if (
                larguraViewport <= 0 ||
                larguraConteudo <= 0
            ) {
                return;
            }

            /*
             * O conteúdo tem uma coluna
             * visível + colunas que excedem
             * horizontalmente.
             *
             * A distância entre o início
             * de uma coluna e a próxima é
             * exatamente a largura da tela.
             */
            const gap =
                Math.max(
                    larguraViewport -
                    larguraConteudo,
                    0,
                );

            const larguraTotal =
                content.scrollWidth +
                gap;

            const total =
                Math.max(
                    1,

                    Math.round(
                        larguraTotal /
                        larguraViewport,
                    ),
                );

            setTotalPaginasLeitura(
                total,

            );

            totalPaginasLeituraRef.current =
                total;

            const salvo =
                lerProgressoLivro(
                    id,
                );

            let paginaDestino = 1;

            /*
             * Se o usuário já estava em
             * Páginas no mesmo aparelho e
             * o layout é compatível,
             * restauramos a página exata.
             */
            const larguraSalva =
                Number(
                    salvo?.largura ??
                    0,
                );

            const diferencaLargura =
                larguraSalva > 0
                    ? Math.abs(
                        window.innerWidth -
                        larguraSalva,
                    ) /
                    larguraSalva
                    : 1;

            const mesmoTamanhoFonte =
                Number(
                    salvo?.tamanhoFonte,
                ) ===
                Number(
                    tamanhoFonte,
                );

            const mesmoEspacamento =
                Math.abs(
                    Number(
                        salvo?.espacamento ??
                        0,
                    ) -
                    Number(
                        espacamento,
                    ),
                ) < 0.01;

            const paginaSalva =
                Number(
                    salvo?.paginaLeitura,
                );

            if (
                salvo?.modoLeitura ===
                "PAGINAS" &&
                diferencaLargura <
                0.08 &&
                mesmoTamanhoFonte &&
                mesmoEspacamento &&
                Number.isFinite(
                    paginaSalva,
                ) &&
                paginaSalva >= 1 &&
                paginaSalva <= total
            ) {
                paginaDestino =
                    paginaSalva;
            } else {
                /*
                 * Se houve mudança de tela,
                 * fonte ou espaçamento,
                 * repaginamos mantendo o
                 * ponto lógico de leitura.
                 */
                const progresso =
                    progressoAtualRef
                        .current;

                const paginaLogica =
                    Math.min(
                        Math.max(
                            Number(
                                progresso
                                    ?.pagina ??
                                paginaAtual,
                            ),
                            1,
                        ),
                        paginas.length,
                    );

                const posicaoLogica =
                    Math.min(
                        Math.max(
                            Number(
                                progresso
                                    ?.posicao ??
                                posicaoPagina,
                            ),
                            0,
                        ),
                        1,
                    );

                const progressoNormalizado =
                    paginas.length > 0
                        ? (
                            (
                                paginaLogica -
                                1 +
                                posicaoLogica
                            ) /
                            paginas.length
                        )
                        : 0;

                paginaDestino =
                    Math.min(
                        total,

                        Math.max(
                            1,

                            Math.round(
                                progressoNormalizado *
                                Math.max(
                                    total - 1,
                                    0,
                                ),
                            ) + 1,
                        ),
                    );
            }

            paginaLeituraAtualRef.current =
                paginaDestino;

            setPaginaLeituraAtual(
                paginaDestino,
            );

            /*
             * Aqui setState é permitido porque
             * estamos preparando/repaginando o
             * livro, e não virando páginas.
             */
            requestAnimationFrame(
                () => {
                    aplicarPaginaLeitura(
                        paginaDestino,
                        {
                            salvar: false,
                        },
                    );
                },
            );

            /*
             * O modo horizontal não usa
             * scroll vertical da janela.
             */
            window.scrollTo({
                top: 0,
                behavior: "auto",
            });

            setPaginacaoPronta(
                true,
            );
        }

        function agendarCalculo() {
            if (frame) {
                cancelAnimationFrame(
                    frame,
                );
            }

            frame =
                requestAnimationFrame(
                    calcularPaginacao,
                );
        }

        /*
         * ResizeObserver faz o livro
         * repaginar quando a área
         * realmente muda.
         */
        function aoRedimensionar() {
            agendarCalculo();
        }

        window.addEventListener(
            "resize",
            aoRedimensionar,
        );

        agendarCalculo();

        return () => {
            window.removeEventListener(
                "resize",
                aoRedimensionar,
            );

            if (frame) {
                cancelAnimationFrame(
                    frame,
                );
            }
        };
    }, [
        carregando,
        paginas,
        modoVisualizacao,
        modoLeitura,
        tamanhoFonte,
        espacamento,
        id,
    ]);



    /*
 * =================================
 * TECLADO - MODO PÁGINAS
 * =================================
 */
    useEffect(() => {
        if (
            modoVisualizacao !==
            "texto" ||
            modoLeitura !==
            "PAGINAS"
        ) {
            return;
        }

        function teclado(event) {
            /*
             * Popup da Bíblia aberto:
             * não movimenta o livro.
             */
            if (referenciaAtiva) {
                return;
            }

            const alvo =
                event.target;

            const tag =
                alvo?.tagName
                    ?.toUpperCase();

            if (
                tag === "INPUT" ||
                tag === "TEXTAREA" ||
                tag === "SELECT" ||
                tag === "BUTTON" ||
                alvo?.isContentEditable
            ) {
                return;
            }

            switch (
            event.key
            ) {
                case "ArrowRight":
                case "PageDown":
                case " ":
                    event.preventDefault();

                    proximaPagina();

                    break;

                case "ArrowLeft":
                case "PageUp":
                    event.preventDefault();

                    paginaAnterior();

                    break;

                case "Home":
                    event.preventDefault();

                    irParaPaginaLeitura(
                        1,
                    );

                    break;

                case "End":
                    event.preventDefault();

                    irParaPaginaLeitura(
                        totalPaginasLeitura,
                    );

                    break;

                default:
                    break;
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
        modoVisualizacao,
        modoLeitura,
        referenciaAtiva,
        paginaLeituraAtual,
        totalPaginasLeitura,
    ]);

    /*
     * =================================
     * SUPABASE: PROGRESSO + PREFERÊNCIAS
     * =================================
     */
    useEffect(() => {
        if (
            !user ||
            !livro?.id ||
            restaurandoProgresso
                .current ||
            (
                modoVisualizacao ===
                "texto" &&
                modoLeitura ===
                "PAGINAS"
            )
        ) {
            return;
        }

        const timer =
            setTimeout(
                async () => {
                    const {
                        error,
                    } = await supabase
                        .from("livros")
                        .update({
                            ultima_pagina:
                                paginaAtual,

                            ultima_posicao:
                                Number(
                                    posicaoPagina
                                        .toFixed(4),
                                ),

                            tamanho_fonte:
                                tamanhoFonte,

                            espacamento,

                            tema_leitura:
                                temaLeitura,

                            modo_leitura:
                                modoLeitura,
                        })
                        .eq(
                            "id",
                            livro.id,
                        )
                        .eq(
                            "usuario_id",
                            user.id,
                        );

                    if (error) {
                        console.error(
                            "Erro ao salvar leitura:",
                            error,
                        );
                    }
                },
                350,
            );

        return () =>
            clearTimeout(
                timer,
            );
    }, [
        paginaAtual,
        posicaoPagina,
        tamanhoFonte,
        espacamento,
        temaLeitura,
        modoLeitura,
        livro?.id,
        user,
    ]);

    /*
     * Garantia ao sair.
     */
    useEffect(() => {
        if (
            !user ||
            !livro?.id
        ) {
            return;
        }

        return () => {
            const progresso =
                progressoAtualRef
                    .current;

            supabase
                .from("livros")
                .update({
                    ultima_pagina:
                        progresso.pagina,

                    ultima_posicao:
                        progresso.posicao,

                    tamanho_fonte:
                        tamanhoFonte,

                    espacamento,

                    tema_leitura:
                        temaLeitura,

                    modo_leitura:
                        modoLeitura,
                })
                .eq(
                    "id",
                    livro.id,
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
                                "Erro ao salvar livro ao sair:",
                                error,
                            );
                        }
                    },
                );
        };
    }, [
        livro?.id,
        user,
        tamanhoFonte,
        espacamento,
        temaLeitura,
        modoLeitura,
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

    function atualizarPreferenciaLocal(
        novosDados,
    ) {
        const atual =
            lerProgressoLivro(id) ??
            {
                pagina:
                    paginaAtual,

                posicao:
                    posicaoPagina,

                scrollY:
                    window.scrollY,

                largura:
                    window.innerWidth,
            };

        localStorage.setItem(
            chaveProgresso,

            JSON.stringify({
                ...atual,
                ...novosDados,

                atualizadoEm:
                    Date.now(),
            }),
        );
    }

    function alterarFonte(
        valor,
    ) {
        const novo =
            Math.min(
                Math.max(
                    tamanhoFonte +
                    valor,
                    14,
                ),
                40,
            );

        setTamanhoFonte(
            novo,
        );

        atualizarPreferenciaLocal({
            tamanhoFonte:
                novo,
        });
    }

    function alternarEspacamento() {
        const opcoes = [
            1.5,
            1.7,
            2,
        ];

        const atual =
            opcoes.findIndex(
                (valor) =>
                    Math.abs(
                        valor -
                        espacamento,
                    ) < 0.05,
            );

        const proximo =
            opcoes[
            (
                atual + 1
            ) %
            opcoes.length
            ];

        setEspacamento(
            proximo,
        );

        atualizarPreferenciaLocal({
            espacamento:
                proximo,
        });
    }

    function alternarTema() {
        const novoTema =
            temaLeitura ===
                "ESCURO"
                ? "CLARO"
                : "ESCURO";

        setTemaLeitura(
            novoTema,
        );

        atualizarPreferenciaLocal({
            temaLeitura:
                novoTema,
        });
    }

    function alterarModoLeitura(
        novoModo,
    ) {
        if (
            novoModo !==
            "ROLAGEM" &&
            novoModo !==
            "PAGINAS"
        ) {
            return;
        }

        if (
            novoModo ===
            modoLeitura
        ) {
            return;
        }

        const salvo =
            lerProgressoLivro(id) ??
            {};

        const progressoAtual = {
            ...salvo,

            pagina:
                progressoAtualRef
                    .current
                    ?.pagina ??
                paginaAtual,

            posicao:
                progressoAtualRef
                    .current
                    ?.posicao ??
                posicaoPagina,

            largura:
                window.innerWidth,

            tamanhoFonte,

            espacamento,

            temaLeitura,

            modoLeitura:
                novoModo,

            atualizadoEm:
                Date.now(),
        };

        /*
         * Quando saímos da rolagem,
         * guardamos o scroll exato.
         */
        if (
            novoModo ===
            "PAGINAS"
        ) {
            progressoAtual.scrollY =
                window.scrollY;
        }

        /*
         * Quando voltamos para Rolagem,
         * não podemos usar scrollY do
         * modo horizontal.
         *
         * O leitor restaurará usando
         * página lógica + posição.
         */
        if (
            novoModo ===
            "ROLAGEM"
        ) {
            delete progressoAtual
                .scrollY;

            delete progressoAtual
                .paginaLeitura;
        }

        localStorage.setItem(
            chaveProgresso,

            JSON.stringify(
                progressoAtual,
            ),
        );

        progressoAtualRef.current = {
            ...progressoAtual,
        };

        setModoLeitura(
            novoModo,
        );
    }

    function irParaPaginaLeitura(
        numero,
    ) {
        aplicarPaginaLeitura(
            numero,
        );
    }

    function paginaAnterior() {
        aplicarPaginaLeitura(
            paginaLeituraAtualRef
                .current -
            1,
        );
    }

    function proximaPagina() {
        aplicarPaginaLeitura(
            paginaLeituraAtualRef
                .current +
            1,
        );
    }

    function elementoInterativo(
        alvo,
    ) {
        if (
            !alvo ||
            typeof alvo.closest !==
            "function"
        ) {
            return false;
        }

        return Boolean(
            alvo.closest(
                [
                    "button",
                    "a",
                    "input",
                    "textarea",
                    "select",
                    "[role='button']",
                    ".sermon-bible-link",
                ].join(","),
            ),
        );
    }

    function iniciarArrastoPagina(
        event,
    ) {
        if (
            modoVisualizacao !==
            "texto" ||
            modoLeitura !==
            "PAGINAS" ||
            referenciaAtiva
        ) {
            return;
        }

        /*
         * Mouse continua usando
         * teclado/setas.
         *
         * Swipe fica para touch
         * e caneta.
         */
        if (
            event.pointerType ===
            "mouse"
        ) {
            return;
        }

        /*
         * Um toque numa referência,
         * botão ou outro controle
         * nunca inicia mudança de página.
         */
        if (
            elementoInterativo(
                event.target,
            )
        ) {
            return;
        }

        gestoPaginaRef.current = {
            ativo: true,
            cancelado: false,
            horizontal: false,

            pointerId:
                event.pointerId,

            inicioX:
                event.clientX,

            inicioY:
                event.clientY,

            atualX:
                event.clientX,

            iniciadoEm:
                performance.now(),
        };



        try {
            event.currentTarget
                .setPointerCapture(
                    event.pointerId,
                );
        } catch {
            // navegador pode não suportar
        }
    }

    function moverArrastoPagina(
        event,
    ) {
        const gesto =
            gestoPaginaRef.current;

        if (
            !gesto.ativo ||
            gesto.cancelado ||
            gesto.pointerId !==
            event.pointerId
        ) {
            return;
        }

        const deltaX =
            event.clientX -
            gesto.inicioX;

        const deltaY =
            event.clientY -
            gesto.inicioY;

        gesto.atualX =
            event.clientX;

        /*
         * Primeiro descobrimos se
         * a intenção foi realmente
         * horizontal.
         */
        if (!gesto.horizontal) {
            if (
                Math.abs(deltaX) <
                8 &&
                Math.abs(deltaY) <
                8
            ) {
                return;
            }

            /*
             * Movimento claramente
             * vertical: abandona o swipe.
             */
            if (
                Math.abs(deltaY) >
                Math.abs(deltaX)
            ) {
                gesto.cancelado =
                    true;

                return;
            }

            gesto.horizontal =
                true;

            pagedViewportRef.current
                ?.classList
                .add(
                    "dragging",
                );
        }

        let deslocamento =
            deltaX;

        /*
         * Resistência na primeira
         * página.
         */
        if (
            paginaLeituraAtual <= 1 &&
            deslocamento > 0
        ) {
            deslocamento *=
                0.22;
        }

        /*
         * Resistência na última
         * página.
         */
        if (
            paginaLeituraAtual >=
            totalPaginasLeitura &&
            deslocamento < 0
        ) {
            deslocamento *=
                0.22;
        }

        const limite =
            window.innerWidth *
            0.78;

        deslocamento =
            Math.min(
                limite,

                Math.max(
                    -limite,
                    deslocamento,
                ),
            );

        const conteudo =
            pagedContentRef.current;

        if (conteudo) {
            const base =
                (
                    paginaLeituraAtualRef
                        .current -
                    1
                ) *
                100;

            conteudo.style.transform =
                `translate3d(calc(-${base}vw + ${deslocamento}px), 0, 0)`;
        }
    }

    function finalizarArrastoPagina(
        event,
    ) {
        const gesto =
            gestoPaginaRef.current;

        if (
            !gesto.ativo ||
            gesto.pointerId !==
            event.pointerId
        ) {
            return;
        }

        const paginaAtualRef =
            paginaLeituraAtualRef
                .current;

        const total =
            totalPaginasLeituraRef
                .current;

        const deltaX =
            gesto.atualX -
            gesto.inicioX;

        const duracao =
            performance.now() -
            gesto.iniciadoEm;

        const limiteNormal =
            Math.min(
                95,
                window.innerWidth *
                0.18,
            );

        const swipeRapido =
            duracao <= 300 &&
            Math.abs(
                deltaX,
            ) >= 42;

        const deveVirar =
            Math.abs(
                deltaX,
            ) >=
            limiteNormal ||
            swipeRapido;

        let paginaDestino =
            paginaAtualRef;

        if (
            gesto.horizontal &&
            !gesto.cancelado &&
            deveVirar
        ) {
            if (
                deltaX < 0 &&
                paginaAtualRef <
                total
            ) {
                paginaDestino =
                    paginaAtualRef +
                    1;
            }

            if (
                deltaX > 0 &&
                paginaAtualRef >
                1
            ) {
                paginaDestino =
                    paginaAtualRef -
                    1;
            }
        }

        gestoPaginaRef.current = {
            ...gesto,

            ativo: false,
            horizontal: false,
        };

        pagedViewportRef.current
            ?.classList
            .remove(
                "dragging",
            );

        /*
         * O encaixe acontece imediatamente
         * no DOM. Nenhuma renderização
         * do livro.
         */
        aplicarPaginaLeitura(
            paginaDestino,
        );

        try {
            event.currentTarget
                .releasePointerCapture(
                    event.pointerId,
                );
        } catch {
            // sem problema
        }
    }

    function cancelarArrastoPagina() {
        gestoPaginaRef.current = {
            ...gestoPaginaRef.current,

            ativo: false,
            cancelado: true,
            horizontal: false,
        };

        pagedViewportRef.current
            ?.classList
            .remove(
                "dragging",
            );

        aplicarPaginaLeitura(
            paginaLeituraAtualRef
                .current,
            {
                salvar: false,
            },
        );
    }

    const progressoGeral =
        useMemo(() => {
            if (
                paginas.length === 0
            ) {
                return 0;
            }

            const base =
                Math.max(
                    paginaAtual - 1,
                    0,
                );

            return Math.min(
                100,
                Math.max(
                    0,
                    (
                        (
                            base +
                            posicaoPagina
                        ) /
                        paginas.length
                    ) *
                    100,
                ),
            );
        }, [
            paginaAtual,
            posicaoPagina,
            paginas.length,
        ]);

    if (carregando) {
        return (
            <div className="book-loading">
                <div className="loading-dot" />

                <p>
                    Abrindo livro...
                </p>
            </div>
        );
    }

    if (erro) {
        return (
            <div className="book-loading">
                <p>
                    {erro}
                </p>

                <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                        navigate(
                            "/livros",
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
                "book-reader",

                temaLeitura ===
                    "ESCURO"
                    ? "book-reader-dark"
                    : "",

                modoVisualizacao ===
                    "texto" &&
                    modoLeitura ===
                    "PAGINAS"
                    ? "book-reader-paginated"
                    : "",
            ]
                .filter(Boolean)
                .join(" ")}

            style={{
                "--book-font-size":
                    `${tamanhoFonte}px`,

                "--book-line-height":
                    espacamento,
            }}
        >
            <header className="book-toolbar">
                <button
                    type="button"
                    className="book-icon-button"
                    onClick={() =>
                        navigate(
                            "/livros",
                        )
                    }
                    aria-label="Voltar para estante"
                >
                    <ArrowLeft
                        size={20}
                    />
                </button>

                <div className="book-toolbar-title">
                    <span>
                        {livro?.autor ||
                            "Livro"}
                    </span>

                    <strong>
                        {livro?.titulo}
                    </strong>
                </div>

                <div className="book-toolbar-actions">
                    <div className="book-view-toggle">
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
                            <div className="book-reading-mode-toggle">
                                <button
                                    type="button"
                                    className={
                                        modoLeitura ===
                                            "ROLAGEM"
                                            ? "active"
                                            : ""
                                    }
                                    title="Rolagem vertical"
                                    onClick={() =>
                                        alterarModoLeitura(
                                            "ROLAGEM",
                                        )
                                    }
                                >
                                    <UnfoldVertical
                                        size={16}
                                    />

                                    <span>
                                        Rolagem
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    className={
                                        modoLeitura ===
                                            "PAGINAS"
                                            ? "active"
                                            : ""
                                    }
                                    title="Leitura por páginas"
                                    onClick={() =>
                                        alterarModoLeitura(
                                            "PAGINAS",
                                        )
                                    }
                                >
                                    <ArrowLeftRight
                                        size={16}
                                    />

                                    <span>
                                        Páginas
                                    </span>
                                </button>
                            </div>
                        )}

                    {modoVisualizacao ===
                        "texto" && (
                            <>
                                <button
                                    type="button"
                                    className="book-icon-button"
                                    title="Diminuir fonte"
                                    onClick={() =>
                                        alterarFonte(
                                            -2,
                                        )
                                    }
                                >
                                    <Minus
                                        size={18}
                                    />
                                </button>

                                <button
                                    type="button"
                                    className="book-icon-button"
                                    title="Aumentar fonte"
                                    onClick={() =>
                                        alterarFonte(
                                            2,
                                        )
                                    }
                                >
                                    <Plus
                                        size={18}
                                    />
                                </button>

                                <button
                                    type="button"
                                    className="book-icon-button"
                                    title="Espaçamento"
                                    onClick={
                                        alternarEspacamento
                                    }
                                >
                                    <Rows3
                                        size={18}
                                    />
                                </button>

                                <button
                                    type="button"
                                    className="book-icon-button"
                                    title="Tema"
                                    onClick={
                                        alternarTema
                                    }
                                >
                                    {temaLeitura ===
                                        "ESCURO" ? (
                                        <Sun
                                            size={18}
                                        />
                                    ) : (
                                        <Moon
                                            size={18}
                                        />
                                    )}
                                </button>
                            </>
                        )}
                </div>
            </header>

            <div className="book-progress">
                <div
                    ref={
                        barraProgressoRef
                    }
                    style={{
                        width:
                            `${progressoGeral}%`,
                    }}
                />
            </div>

            {modoVisualizacao ===
                "pdf" ? (
                <main className="book-pdf-original">
                    {pdfUrl ? (
                        <iframe
                            title={`PDF - ${livro?.titulo}`}
                            src={
                                `${pdfUrl}` +
                                `#page=${paginaAtual}` +
                                `&toolbar=0` +
                                `&navpanes=0`
                            }
                        />
                    ) : (
                        <div className="book-loading">
                            <p>
                                Abrindo PDF...
                            </p>
                        </div>
                    )}
                </main>
            ) : modoLeitura ===
                "PAGINAS" ? (
                <main
                    ref={
                        pagedViewportRef
                    }
                    className={[
                        "book-paged-viewport",

                        paginacaoPronta
                            ? "ready"
                            : "",
                    ]
                        .filter(Boolean)
                        .join(" ")}
                    onPointerDown={
                        iniciarArrastoPagina
                    }
                    onPointerMove={
                        moverArrastoPagina
                    }
                    onPointerUp={
                        finalizarArrastoPagina
                    }
                    onPointerCancel={
                        cancelarArrastoPagina
                    }
                >
                    <article
                        ref={
                            pagedContentRef
                        }
                        className="book-paged-content"
                        style={{
                            transform:
                                `translate3d(-${(
                                    paginaLeituraAtual -
                                    1
                                ) * 100}vw, 0, 0)`,
                        }}
                    >
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
                                    className="book-page book-page-paged"
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
                    </article>

                    <nav
                        className="book-page-navigation"
                        aria-label="Navegação do livro"
                    >
                        <button
                            type="button"
                            className="book-page-nav-button"
                            ref={
                                botaoPaginaAnteriorRef
                            }
                            onClick={
                                paginaAnterior
                            }
                            disabled={
                                paginaLeituraAtual <=
                                1
                            }
                            aria-label="Página anterior"
                        >
                            <ChevronLeft
                                size={21}
                            />
                        </button>

                        <span
                            ref={
                                contadorPaginaRef
                            }
                        >
                            {paginaLeituraAtual}
                            {" / "}
                            {totalPaginasLeitura}
                        </span>

                        <button
                            type="button"
                            ref={
                                botaoPaginaAnteriorRef
                            }
                            className="book-page-nav-button"
                            onClick={
                                proximaPagina
                            }
                            disabled={
                                paginaLeituraAtual >=
                                totalPaginasLeitura
                            }
                            aria-label="Próxima página"
                        >
                            <ChevronRight
                                size={21}
                            />
                        </button>
                    </nav>
                </main>
            ) : (
                <main className="book-content">
                    <header className="book-cover">
                        <span>
                            {livro?.autor ||
                                "Autor não informado"}
                        </span>

                        <h1>
                            {livro?.titulo}
                        </h1>

                        <p>
                            {paginas.length}
                            {" páginas"}
                        </p>
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
                                className="book-page"
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
            )}

            {modoVisualizacao ===
                "texto" &&
                modoLeitura ===
                "ROLAGEM" && (
                    <div className="book-status">
                        {Math.round(
                            progressoGeral,
                        )}
                        %
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

export default LivroPage;