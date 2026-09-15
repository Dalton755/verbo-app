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
    Bookmark,
    BookmarkPlus,
    ChevronLeft,
    ChevronRight,
    FileText,
    Minus,
    Moon,
    Plus,
    Rows3,
    Sun,
    UnfoldVertical,
    Trash2,
    X,
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

import BookLinkedText
    from "../components/BookLinkedText";

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

    const passoPaginaRef =
        useRef(
            window.innerWidth,
        );

    const paginasPorVistaRef =
        useRef(1);

    const contadorPaginaRef =
        useRef(null);

    const botaoPaginaAnteriorRef =
        useRef(null);

    const botaoProximaPaginaRef =
        useRef(null);

    const barraProgressoRef =
        useRef(null);

    const botaoMarcadoresRef =
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



    const [
        paginasPorVista,
        setPaginasPorVista,
    ] = useState(
        Number(
            progressoInicial
                ?.paginasPorVista ??
            cacheInicial
                ?.livro
                ?.paginas_por_vista ??
            1,
        ) === 2
            ? 2
            : 1,
    );

    const [
        telaLarga,
        setTelaLarga,
    ] = useState(
        () =>
            window.innerWidth >=
            1024,
    );

    const paginasPorVistaEfetivas =
        telaLarga
            ? paginasPorVista
            : 1;

    paginasPorVistaRef.current =
        paginasPorVistaEfetivas;


    const [
        marcadores,
        setMarcadores,
    ] = useState([]);

    const [
        marcadoresAbertos,
        setMarcadoresAbertos,
    ] = useState(false);

    const [
        salvandoMarcador,
        setSalvandoMarcador,
    ] = useState(false);

    const [
        destaques,
        setDestaques,
    ] = useState([]);

    const [
        selecaoDestaque,
        setSelecaoDestaque,
    ] = useState(null);

    const [
        salvandoDestaque,
        setSalvandoDestaque,
    ] = useState(false);

    function sincronizarControlesPagina(
        pagina,
        total,
    ) {
        const quantidade =
            paginasPorVistaRef
                .current;

        const paginaFinal =
            Math.min(
                total,
                pagina +
                quantidade -
                1,
            );

        if (
            contadorPaginaRef.current
        ) {
            contadorPaginaRef.current
                .textContent =
                paginaFinal > pagina
                    ? `${pagina}â€“${paginaFinal} / ${total}`
                    : `${pagina} / ${total}`;
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
                paginaFinal >= total;
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
         * Ãšltima pÃ¡gina visual =
         * fim da Ãºltima pÃ¡gina lÃ³gica.
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

        atualizarEstadoBotaoMarcador(
            logico.pagina,
            logico.posicao,
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

            paginasPorVista:
                paginasPorVistaRef
                    .current,

            atualizadoEm:
                Date.now(),
        };

        /*
         * Fonte real do ponto de leitura.
         */
        progressoAtualRef.current =
            novoProgresso;

        atualizarEstadoBotaoMarcador(
            novoProgresso.pagina,
            novoProgresso.posicao,
        );

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

                            paginas_por_vista:
                                paginasPorVista,
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
                            "Erro ao salvar pÃ¡gina do livro:",
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

        const quantidade =
            Math.max(
                1,
                paginasPorVistaRef
                    .current,
            );

        let destino =
            Math.min(
                total,

                Math.max(
                    1,
                    Number(numero) ||
                    1,
                ),
            );

        /*
         * Em modo de duas pÃ¡ginas,
         * a pÃ¡gina inicial do par
         * serÃ¡ sempre:
         *
         * 1â€“2
         * 3â€“4
         * 5â€“6
         */
        if (
            quantidade === 2
        ) {
            destino =
                Math.floor(
                    (
                        destino - 1
                    ) /
                    2,
                ) *
                2 +
                1;
        }

        paginaLeituraAtualRef.current =
            destino;

        const conteudo =
            pagedContentRef.current;

        if (conteudo) {
            const passo =
                passoPaginaRef.current ||
                window.innerWidth;

            const indiceGrupo =
                Math.floor(
                    (
                        destino - 1
                    ) /
                    quantidade,
                );

            const deslocamento =
                indiceGrupo *
                passo *
                quantidade;

            conteudo.style.transform =
                `translate3d(-${deslocamento}px, 0, 0)`;
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
        function verificarTela() {
            setTelaLarga(
                window.innerWidth >=
                1024,
            );
        }

        window.addEventListener(
            "resize",
            verificarTela,
        );

        return () => {
            window.removeEventListener(
                "resize",
                verificarTela,
            );
        };
    }, []);



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
            paginas_por_vista,
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
                        "NÃ£o conseguimos abrir este livro.",
                    );

                    setCarregando(false);
                }

                return;
            }

            /*
             * =================================
             * LIVRO JÃ PROCESSADO
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

                    setPaginasPorVista(
                        Number(
                            data.paginas_por_vista,
                        ) === 2
                            ? 2
                            : 1,
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
                 * PDF original Ã© carregado
                 * em segundo plano.
                 */
                gerarUrlPdf(
                    data,
                );

                return;
            }

            /*
             * =================================
             * LIVRO ANTIGO AINDA NÃƒO PROCESSADO
             * =================================
             *
             * Ex.: O Deus da AlianÃ§a.
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
                    "NÃ£o conseguimos abrir o PDF deste livro.",
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
                    "NÃ£o conseguimos preparar este livro para leitura.",
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

        async function carregarMarcadores() {
            const {
                data,
                error,
            } = await supabase
                .from(
                    "livro_marcadores",
                )
                .select(`
                id,
                pagina_logica,
                posicao,
                trecho,
                created_at
            `)
                .eq(
                    "usuario_id",
                    user.id,
                )
                .eq(
                    "livro_id",
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
                    "Erro ao carregar marcadores:",
                    error,
                );

                return;
            }

            const lista =
                data ?? [];

            setMarcadores(
                lista,
            );

            requestAnimationFrame(
                () => {
                    atualizarEstadoBotaoMarcador(
                        progressoAtualRef
                            .current
                            ?.pagina ??
                        1,

                        progressoAtualRef
                            .current
                            ?.posicao ??
                        0,

                        lista,
                    );
                },
            );
        }

        carregarMarcadores();

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

        async function carregarDestaques() {
            const {
                data,
                error,
            } = await supabase
                .from(
                    "livro_destaques",
                )
                .select(`
                id,
                pagina_inicio,
                bloco_inicio,
                offset_inicio,
                pagina_fim,
                bloco_fim,
                offset_fim,
                texto_selecionado,
                cor,
                created_at
            `)
                .eq(
                    "usuario_id",
                    user.id,
                )
                .eq(
                    "livro_id",
                    id,
                )
                .order(
                    "created_at",
                    {
                        ascending: true,
                    },
                );

            if (!ativo) {
                return;
            }

            if (error) {
                console.error(
                    "Erro ao carregar destaques:",
                    error,
                );

                return;
            }

            setDestaques(
                data ?? [],
            );
        }

        carregarDestaques();

        return () => {
            ativo = false;
        };
    }, [
        id,
        user,
    ]);

    /*
     * =================================
     * RESTAURAÃ‡ÃƒO DA POSIÃ‡ÃƒO
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
             * pÃ¡gina + percentual.
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
     * SALVAR POSIÃ‡ÃƒO DURANTE SCROLL
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

                paginasPorVista,

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
        paginasPorVista,
    ]);

    /*
 * =================================
 * PAGINAÃ‡ÃƒO RESPONSIVA
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
             * O conteÃºdo tem uma coluna
             * visÃ­vel + colunas que excedem
             * horizontalmente.
             *
             * A distÃ¢ncia entre o inÃ­cio
             * de uma coluna e a prÃ³xima Ã©
             * exatamente a largura da tela.
             */
            const estilos =
                window.getComputedStyle(
                    content,
                );

            const larguraColuna =
                parseFloat(
                    estilos.columnWidth,
                ) ||
                larguraConteudo;

            const gapColuna =
                parseFloat(
                    estilos.columnGap,
                ) || 0;

            const passoColuna =
                larguraColuna +
                gapColuna;

            passoPaginaRef.current =
                passoColuna;

            const total =
                Math.max(
                    1,

                    Math.round(
                        (
                            content.scrollWidth +
                            gapColuna
                        ) /
                        passoColuna,
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
             * Se o usuÃ¡rio jÃ¡ estava em
             * PÃ¡ginas no mesmo aparelho e
             * o layout Ã© compatÃ­vel,
             * restauramos a pÃ¡gina exata.
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

            const mesmaQuantidadePorVista =
                Number(
                    salvo?.paginasPorVista ??
                    1,
                ) ===
                paginasPorVistaEfetivas;

            if (
                salvo?.modoLeitura ===
                "PAGINAS" &&
                diferencaLargura <
                0.08 &&
                mesmoTamanhoFonte &&
                mesmoEspacamento &&
                mesmaQuantidadePorVista &&
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
                 * Se houve mudanÃ§a de tela,
                 * fonte ou espaÃ§amento,
                 * repaginamos mantendo o
                 * ponto lÃ³gico de leitura.
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

            if (
                paginasPorVistaEfetivas ===
                2
            ) {
                paginaDestino =
                    Math.floor(
                        (
                            paginaDestino -
                            1
                        ) /
                        2,
                    ) *
                    2 +
                    1;
            }

            paginaLeituraAtualRef.current =
                paginaDestino;

            setPaginaLeituraAtual(
                paginaDestino,
            );

            /*
             * Aqui setState Ã© permitido porque
             * estamos preparando/repaginando o
             * livro, e nÃ£o virando pÃ¡ginas.
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
             * O modo horizontal nÃ£o usa
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
         * repaginar quando a Ã¡rea
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
        paginasPorVistaEfetivas,
        id,
    ]);



    /*
 * =================================
 * TECLADO - MODO PÃGINAS
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
             * Popup da BÃ­blia aberto:
             * nÃ£o movimenta o livro.
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
     * SUPABASE: PROGRESSO + PREFERÃŠNCIAS
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

                            paginas_por_vista:
                                paginasPorVista,
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

                    paginas_por_vista:
                        paginasPorVista,
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

    function encontrarMarcadorNoPonto(
        pagina,
        posicao,
        lista = marcadores,
    ) {
        const paginaNumero =
            Number(
                pagina ?? 1,
            );

        const posicaoNumero =
            Number(
                posicao ?? 0,
            );

        return (
            lista.find(
                (marcador) =>
                    Number(
                        marcador
                            .pagina_logica,
                    ) ===
                    paginaNumero &&
                    Math.abs(
                        Number(
                            marcador
                                .posicao ??
                            0,
                        ) -
                        posicaoNumero,
                    ) <= 0.025,
            ) ??
            null
        );
    }

    function atualizarEstadoBotaoMarcador(
        pagina,
        posicao,
        lista = marcadores,
    ) {
        const botao =
            botaoMarcadoresRef
                .current;

        if (!botao) {
            return;
        }

        const encontrado =
            encontrarMarcadorNoPonto(
                pagina,
                posicao,
                lista,
            );

        botao.classList.toggle(
            "bookmarked",
            Boolean(
                encontrado,
            ),
        );

        botao.title =
            encontrado
                ? "Este ponto estÃ¡ marcado"
                : "Marcadores";
    }

    function calcularPercentualMarcador(
        marcador,
    ) {
        if (
            !marcador ||
            paginas.length === 0
        ) {
            return 0;
        }

        const pagina =
            Math.min(
                paginas.length,

                Math.max(
                    1,
                    Number(
                        marcador
                            .pagina_logica ??
                        1,
                    ),
                ),
            );

        const posicao =
            Math.min(
                1,

                Math.max(
                    0,
                    Number(
                        marcador
                            .posicao ??
                        0,
                    ),
                ),
            );

        const percentual =
            (
                (
                    pagina -
                    1 +
                    posicao
                ) /
                paginas.length
            ) *
            100;

        return Math.min(
            100,

            Math.max(
                0,
                Math.round(
                    percentual,
                ),
            ),
        );
    }

    function obterTrechoMarcador(
        pagina,
        posicao,
    ) {
        const dadosPagina =
            paginas.find(
                (item) =>
                    item.numero ===
                    pagina,
            );

        if (!dadosPagina) {
            return "";
        }

        const texto =
            dadosPagina.blocos
                .map(
                    (bloco) =>
                        bloco.texto,
                )
                .filter(Boolean)
                .join(" ")
                .replace(
                    /\s+/g,
                    " ",
                )
                .trim();

        if (!texto) {
            return "";
        }

        const indice =
            Math.floor(
                texto.length *
                Math.min(
                    1,
                    Math.max(
                        0,
                        posicao,
                    ),
                ),
            );

        const inicio =
            Math.max(
                0,
                indice - 45,
            );

        const fim =
            Math.min(
                texto.length,
                indice + 115,
            );

        let trecho =
            texto.slice(
                inicio,
                fim,
            );

        if (inicio > 0) {
            trecho =
                `â€¦${trecho}`;
        }

        if (
            fim <
            texto.length
        ) {
            trecho =
                `${trecho}â€¦`;
        }

        return trecho;
    }

    async function adicionarMarcador() {
        if (
            !user ||
            !livro?.id ||
            salvandoMarcador
        ) {
            return;
        }

        const progresso =
            progressoAtualRef
                .current;

        const pagina =
            Math.min(
                paginas.length,

                Math.max(
                    1,
                    Number(
                        progresso
                            ?.pagina ??
                        1,
                    ),
                ),
            );

        const posicao =
            Math.min(
                1,

                Math.max(
                    0,
                    Number(
                        progresso
                            ?.posicao ??
                        0,
                    ),
                ),
            );

        const marcadorExistente =
            encontrarMarcadorNoPonto(
                pagina,
                posicao,
            );

        if (marcadorExistente) {
            atualizarEstadoBotaoMarcador(
                pagina,
                posicao,
            );

            return;
        }

        const trecho =
            obterTrechoMarcador(
                pagina,
                posicao,
            );

        setSalvandoMarcador(
            true,
        );

        const {
            data,
            error,
        } = await supabase
            .from(
                "livro_marcadores",
            )
            .insert({
                usuario_id:
                    user.id,

                livro_id:
                    livro.id,

                pagina_logica:
                    pagina,

                posicao:
                    Number(
                        posicao
                            .toFixed(4),
                    ),

                trecho:
                    trecho ||
                    null,
            })
            .select(`
            id,
            pagina_logica,
            posicao,
            trecho,
            created_at
        `)
            .single();

        setSalvandoMarcador(
            false,
        );

        if (error) {
            console.error(
                "Erro ao criar marcador:",
                error,
            );

            return;
        }

        setMarcadores(
            (atuais) => {
                const novaLista = [
                    data,
                    ...atuais,
                ];

                atualizarEstadoBotaoMarcador(
                    pagina,
                    posicao,
                    novaLista,
                );

                return novaLista;
            },
        );
    }

    async function excluirMarcador(
        marcadorId,
    ) {
        if (
            !user ||
            !marcadorId
        ) {
            return;
        }

        const {
            error,
        } = await supabase
            .from(
                "livro_marcadores",
            )
            .delete()
            .eq(
                "id",
                marcadorId,
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
            (atuais) => {
                const novaLista =
                    atuais.filter(
                        (item) =>
                            item.id !==
                            marcadorId,
                    );

                atualizarEstadoBotaoMarcador(
                    progressoAtualRef
                        .current
                        ?.pagina ??
                    1,

                    progressoAtualRef
                        .current
                        ?.posicao ??
                    0,

                    novaLista,
                );

                return novaLista;
            },
        );
    }

    function abrirMarcador(
        marcador,
    ) {
        if (
            !marcador ||
            paginas.length === 0
        ) {
            return;
        }

        const pagina =
            Math.min(
                paginas.length,

                Math.max(
                    1,
                    Number(
                        marcador
                            .pagina_logica,
                    ),
                ),
            );

        const posicao =
            Math.min(
                1,

                Math.max(
                    0,
                    Number(
                        marcador
                            .posicao ??
                        0,
                    ),
                ),
            );

        const novoProgresso = {
            ...(
                lerProgressoLivro(
                    id,
                ) ??
                {}
            ),

            pagina,

            posicao,

            tamanhoFonte,

            espacamento,

            temaLeitura,

            modoLeitura,

            paginasPorVista,

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

        setMarcadoresAbertos(
            false,
        );

        /*
         * MODO PÃGINAS
         */
        if (
            modoVisualizacao ===
            "texto" &&
            modoLeitura ===
            "PAGINAS"
        ) {
            const total =
                totalPaginasLeituraRef
                    .current;

            const progressoNormalizado =
                (
                    pagina -
                    1 +
                    posicao
                ) /
                paginas.length;

            let paginaVisual =
                Math.round(
                    progressoNormalizado *
                    Math.max(
                        total - 1,
                        0,
                    ),
                ) + 1;

            paginaVisual =
                Math.min(
                    total,

                    Math.max(
                        1,
                        paginaVisual,
                    ),
                );

            aplicarPaginaLeitura(
                paginaVisual,
            );

            return;
        }

        /*
         * MODO ROLAGEM
         */
        setModoVisualizacao(
            "texto",
        );

        setModoLeitura(
            "ROLAGEM",
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

                        if (
                            !elemento
                        ) {
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
                                    88,
                                ),

                            behavior:
                                "auto",
                        });
                    },
                );
            },
        );
    }

    function compararPosicao(
        paginaA,
        blocoA,
        paginaB,
        blocoB,
    ) {
        if (
            paginaA !==
            paginaB
        ) {
            return (
                paginaA -
                paginaB
            );
        }

        return (
            blocoA -
            blocoB
        );
    }


    function obterDestaquesDoBloco(
        paginaNumero,
        blocoIndice,
        tamanhoTexto,
    ) {
        return destaques
            .filter(
                (destaque) => {
                    const depoisDoInicio =
                        compararPosicao(
                            paginaNumero,
                            blocoIndice,
                            Number(
                                destaque
                                    .pagina_inicio,
                            ),
                            Number(
                                destaque
                                    .bloco_inicio,
                            ),
                        ) >= 0;

                    const antesDoFim =
                        compararPosicao(
                            paginaNumero,
                            blocoIndice,
                            Number(
                                destaque
                                    .pagina_fim,
                            ),
                            Number(
                                destaque
                                    .bloco_fim,
                            ),
                        ) <= 0;

                    return (
                        depoisDoInicio &&
                        antesDoFim
                    );
                },
            )
            .map(
                (destaque) => {
                    const mesmoInicio =
                        paginaNumero ===
                        Number(
                            destaque
                                .pagina_inicio,
                        ) &&
                        blocoIndice ===
                        Number(
                            destaque
                                .bloco_inicio,
                        );

                    const mesmoFim =
                        paginaNumero ===
                        Number(
                            destaque
                                .pagina_fim,
                        ) &&
                        blocoIndice ===
                        Number(
                            destaque
                                .bloco_fim,
                        );

                    return {
                        id:
                            destaque.id,

                        cor:
                            destaque.cor,

                        inicio:
                            mesmoInicio
                                ? Number(
                                    destaque
                                        .offset_inicio,
                                )
                                : 0,

                        fim:
                            mesmoFim
                                ? Number(
                                    destaque
                                        .offset_fim,
                                )
                                : tamanhoTexto,
                    };
                },
            )
            .filter(
                (destaque) =>
                    destaque.fim >
                    destaque.inicio,
            );
    }

    function encontrarElementoBloco(
        no,
    ) {
        if (!no) {
            return null;
        }

        const elemento =
            no.nodeType ===
                Node.ELEMENT_NODE
                ? no
                : no.parentElement;

        return (
            elemento?.closest(
                "[data-book-text-block='true']",
            ) ??
            null
        );
    }


    function calcularOffsetNoBloco(
        elementoBloco,
        no,
        offset,
    ) {
        if (
            !elementoBloco ||
            !no
        ) {
            return 0;
        }

        const range =
            document.createRange();

        range.selectNodeContents(
            elementoBloco,
        );

        try {
            range.setEnd(
                no,
                offset,
            );
        } catch {
            return 0;
        }

        return range
            .toString()
            .length;
    }

    function capturarSelecaoDestaque() {
        /*
         * Destaques sÃ³ existem no modo
         * Texto. Nunca no PDF original.
         */
        if (
            modoVisualizacao !==
            "texto"
        ) {
            setSelecaoDestaque(
                null,
            );

            return;
        }

        const selection =
            window.getSelection();

        if (
            !selection ||
            selection.rangeCount ===
            0 ||
            selection.isCollapsed
        ) {
            setSelecaoDestaque(
                null,
            );

            return;
        }

        const range =
            selection.getRangeAt(
                0,
            );

        const blocoInicio =
            encontrarElementoBloco(
                range.startContainer,
            );

        const blocoFim =
            encontrarElementoBloco(
                range.endContainer,
            );

        if (
            !blocoInicio ||
            !blocoFim
        ) {
            setSelecaoDestaque(
                null,
            );

            return;
        }

        const paginaInicio =
            Number(
                blocoInicio.dataset
                    .bookPage,
            );

        const indiceBlocoInicio =
            Number(
                blocoInicio.dataset
                    .bookBlock,
            );

        const paginaFim =
            Number(
                blocoFim.dataset
                    .bookPage,
            );

        const indiceBlocoFim =
            Number(
                blocoFim.dataset
                    .bookBlock,
            );

        if (
            !Number.isFinite(
                paginaInicio,
            ) ||
            !Number.isFinite(
                indiceBlocoInicio,
            ) ||
            !Number.isFinite(
                paginaFim,
            ) ||
            !Number.isFinite(
                indiceBlocoFim,
            )
        ) {
            return;
        }

        const offsetInicio =
            calcularOffsetNoBloco(
                blocoInicio,
                range.startContainer,
                range.startOffset,
            );

        const offsetFim =
            calcularOffsetNoBloco(
                blocoFim,
                range.endContainer,
                range.endOffset,
            );

        const textoSelecionado =
            selection
                .toString()
                .replace(
                    /\s+/g,
                    " ",
                )
                .trim();

        if (
            textoSelecionado.length <
            2
        ) {
            setSelecaoDestaque(
                null,
            );

            return;
        }

        setSelecaoDestaque({
            paginaInicio,
            blocoInicio:
                indiceBlocoInicio,

            offsetInicio,

            paginaFim,
            blocoFim:
                indiceBlocoFim,

            offsetFim,

            textoSelecionado,
        });
    }

    useEffect(() => {
        let timer = null;

        function verificarSelecao() {
            if (timer) {
                clearTimeout(
                    timer,
                );
            }

            timer =
                setTimeout(
                    capturarSelecaoDestaque,
                    120,
                );
        }

        document.addEventListener(
            "selectionchange",
            verificarSelecao,
        );

        return () => {
            document.removeEventListener(
                "selectionchange",
                verificarSelecao,
            );

            if (timer) {
                clearTimeout(
                    timer,
                );
            }
        };
    }, [
        modoVisualizacao,
    ]);

    async function salvarDestaque(
        cor,
    ) {
        if (
            !user ||
            !livro?.id ||
            !selecaoDestaque ||
            salvandoDestaque
        ) {
            return;
        }

        setSalvandoDestaque(
            true,
        );

        const {
            data,
            error,
        } = await supabase
            .from(
                "livro_destaques",
            )
            .insert({
                usuario_id:
                    user.id,

                livro_id:
                    livro.id,

                pagina_inicio:
                    selecaoDestaque
                        .paginaInicio,

                bloco_inicio:
                    selecaoDestaque
                        .blocoInicio,

                offset_inicio:
                    selecaoDestaque
                        .offsetInicio,

                pagina_fim:
                    selecaoDestaque
                        .paginaFim,

                bloco_fim:
                    selecaoDestaque
                        .blocoFim,

                offset_fim:
                    selecaoDestaque
                        .offsetFim,

                texto_selecionado:
                    selecaoDestaque
                        .textoSelecionado,

                cor,
            })
            .select(`
            id,
            pagina_inicio,
            bloco_inicio,
            offset_inicio,
            pagina_fim,
            bloco_fim,
            offset_fim,
            texto_selecionado,
            cor,
            created_at
        `)
            .single();

        setSalvandoDestaque(
            false,
        );

        if (error) {
            console.error(
                "Erro ao salvar destaque:",
                error,
            );

            return;
        }

        setDestaques(
            (atuais) => [
                ...atuais,
                data,
            ],
        );

        setSelecaoDestaque(
            null,
        );

        const selection =
            window.getSelection();

        selection?.removeAllRanges();
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
         * Quando saÃ­mos da rolagem,
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
         * nÃ£o podemos usar scrollY do
         * modo horizontal.
         *
         * O leitor restaurarÃ¡ usando
         * pÃ¡gina lÃ³gica + posiÃ§Ã£o.
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

    function alterarPaginasPorVista(
        quantidade,
    ) {
        if (
            quantidade !== 1 &&
            quantidade !== 2
        ) {
            return;
        }

        if (
            quantidade ===
            paginasPorVista
        ) {
            return;
        }

        /*
         * Mantemos o ponto lÃ³gico,
         * mas descartamos o nÃºmero
         * visual antigo porque o livro
         * serÃ¡ repaginado.
         */
        const salvo =
            lerProgressoLivro(id) ??
            {};

        const novoProgresso = {
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

            paginasPorVista:
                quantidade,

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

        delete novoProgresso
            .paginaLeitura;

        delete novoProgresso
            .totalPaginasLeitura;

        localStorage.setItem(
            chaveProgresso,

            JSON.stringify(
                novoProgresso,
            ),
        );

        progressoAtualRef.current = {
            ...novoProgresso,
        };

        setPaginasPorVista(
            quantidade,
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
            paginasPorVistaRef
                .current,
        );
    }

    function proximaPagina() {
        aplicarPaginaLeitura(
            paginaLeituraAtualRef
                .current +
            paginasPorVistaRef
                .current,
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
         * Um toque numa referÃªncia,
         * botÃ£o ou outro controle
         * nunca inicia mudanÃ§a de pÃ¡gina.
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
            // navegador pode nÃ£o suportar
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
         * a intenÃ§Ã£o foi realmente
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
         * ResistÃªncia na primeira
         * pÃ¡gina.
         */
        if (
            paginaLeituraAtual <= 1 &&
            deslocamento > 0
        ) {
            deslocamento *=
                0.22;
        }

        /*
         * ResistÃªncia na Ãºltima
         * pÃ¡gina.
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
            const quantidade =
                paginasPorVistaRef
                    .current;

            const passo =
                passoPaginaRef.current ||
                window.innerWidth;

            const indiceGrupo =
                Math.floor(
                    (
                        paginaLeituraAtualRef
                            .current -
                        1
                    ) /
                    quantidade,
                );

            const base =
                indiceGrupo *
                passo *
                quantidade;

            conteudo.style.transform =
                `translate3d(${(-base + deslocamento)}px, 0, 0)`;
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
                    paginasPorVistaRef
                        .current;

            }

            if (
                deltaX > 0 &&
                paginaAtualRef >
                1
            ) {
                paginaDestino =
                    paginaAtualRef -
                    paginasPorVistaRef
                        .current;
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
         * no DOM. Nenhuma renderizaÃ§Ã£o
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

    const marcadorPontoAtual =
        encontrarMarcadorNoPonto(
            progressoAtualRef
                .current
                ?.pagina ??
            1,

            progressoAtualRef
                .current
                ?.posicao ??
            0,
        );

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
                modoVisualizacao ===
                    "texto" &&
                    modoLeitura ===
                    "PAGINAS" &&
                    paginasPorVistaEfetivas ===
                    2
                    ? "book-reader-two-pages"
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
                        "texto" &&
                        modoLeitura ===
                        "PAGINAS" &&
                        telaLarga && (
                            <div className="book-spread-toggle">
                                <button
                                    type="button"
                                    className={
                                        paginasPorVista ===
                                            1
                                            ? "active"
                                            : ""
                                    }
                                    title="Uma pÃ¡gina"
                                    onClick={() =>
                                        alterarPaginasPorVista(
                                            1,
                                        )
                                    }
                                >
                                    1
                                </button>

                                <button
                                    type="button"
                                    className={
                                        paginasPorVista ===
                                            2
                                            ? "active"
                                            : ""
                                    }
                                    title="Duas pÃ¡ginas"
                                    onClick={() =>
                                        alterarPaginasPorVista(
                                            2,
                                        )
                                    }
                                >
                                    2
                                </button>
                            </div>
                        )}

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
                                    title="Leitura por pÃ¡ginas"
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
                                        PÃ¡ginas
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
                                    title="EspaÃ§amento"
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
                                    ref={
                                        botaoMarcadoresRef
                                    }
                                    className="book-icon-button"
                                    title="Marcadores"
                                    onClick={() =>
                                        setMarcadoresAbertos(
                                            true,
                                        )
                                    }
                                >
                                    <Bookmark
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
                                                    data-book-text-block="true"
                                                    data-book-page={
                                                        pagina.numero
                                                    }
                                                    data-book-block={
                                                        indice
                                                    }
                                                >
                                                    <BookLinkedText
                                                        texto={
                                                            bloco.texto
                                                        }
                                                        onReferencia={
                                                            setReferenciaAtiva
                                                        }
                                                        destaques={
                                                            obterDestaquesDoBloco(
                                                                pagina.numero,
                                                                indice,
                                                                bloco.texto.length,
                                                            )
                                                        }
                                                    />
                                                </h2>
                                            ) : (
                                                <p
                                                    key={
                                                        indice
                                                    }
                                                    data-book-text-block="true"
                                                    data-book-page={
                                                        pagina.numero
                                                    }
                                                    data-book-block={
                                                        indice
                                                    }
                                                >
                                                    <BookLinkedText
                                                        texto={
                                                            bloco.texto
                                                        }
                                                        onReferencia={
                                                            setReferenciaAtiva
                                                        }
                                                        destaques={
                                                            obterDestaquesDoBloco(
                                                                pagina.numero,
                                                                indice,
                                                                bloco.texto.length,
                                                            )
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
                        aria-label="NavegaÃ§Ã£o do livro"
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

                            aria-label="PÃ¡gina anterior"
                        >
                            <ChevronLeft
                                size={21}
                            />
                        </button>

                        <span
                            ref={
                                contadorPaginaRef
                            }
                        />

                        <button
                            type="button"
                            ref={
                                botaoProximaPaginaRef
                            }
                            className="book-page-nav-button"
                            onClick={
                                proximaPagina
                            }

                            aria-label="PrÃ³xima pÃ¡gina"
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
                                "Autor nÃ£o informado"}
                        </span>

                        <h1>
                            {livro?.titulo}
                        </h1>

                        <p>
                            {paginas.length}
                            {" pÃ¡ginas"}
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
                                                data-book-text-block="true"
                                                data-book-page={
                                                    pagina.numero
                                                }
                                                data-book-block={
                                                    indice
                                                }
                                            >
                                                <BookLinkedText
                                                    texto={
                                                        bloco.texto
                                                    }
                                                    onReferencia={
                                                        setReferenciaAtiva
                                                    }
                                                    destaques={
                                                        obterDestaquesDoBloco(
                                                            pagina.numero,
                                                            indice,
                                                            bloco.texto.length,
                                                        )
                                                    }
                                                />
                                            </h2>
                                        ) : (
                                            <p
                                                key={
                                                    indice
                                                }
                                                data-book-text-block="true"
                                                data-book-page={
                                                    pagina.numero
                                                }
                                                data-book-block={
                                                    indice
                                                }
                                            >
                                                <BookLinkedText
                                                    texto={
                                                        bloco.texto
                                                    }
                                                    onReferencia={
                                                        setReferenciaAtiva
                                                    }
                                                    destaques={
                                                        obterDestaquesDoBloco(
                                                            pagina.numero,
                                                            indice,
                                                            bloco.texto.length,
                                                        )
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

            {selecaoDestaque && (
                <div className="book-highlight-toolbar">
                    <button
                        type="button"
                        className="
                book-highlight-color
                book-highlight-color-yellow
            "
                        title="Amarelo"
                        aria-label="Destacar em amarelo"
                        disabled={
                            salvandoDestaque
                        }
                        onClick={() =>
                            salvarDestaque(
                                "AMARELO",
                            )
                        }
                    />

                    <button
                        type="button"
                        className="
                book-highlight-color
                book-highlight-color-green
            "
                        title="Verde"
                        aria-label="Destacar em verde"
                        disabled={
                            salvandoDestaque
                        }
                        onClick={() =>
                            salvarDestaque(
                                "VERDE",
                            )
                        }
                    />

                    <button
                        type="button"
                        className="
                book-highlight-color
                book-highlight-color-blue
            "
                        title="Azul"
                        aria-label="Destacar em azul"
                        disabled={
                            salvandoDestaque
                        }
                        onClick={() =>
                            salvarDestaque(
                                "AZUL",
                            )
                        }
                    />

                    <button
                        type="button"
                        className="
                book-highlight-color
                book-highlight-color-pink
            "
                        title="Rosa"
                        aria-label="Destacar em rosa"
                        disabled={
                            salvandoDestaque
                        }
                        onClick={() =>
                            salvarDestaque(
                                "ROSA",
                            )
                        }
                    />

                    <button
                        type="button"
                        className="book-highlight-cancel"
                        title="Cancelar"
                        aria-label="Cancelar destaque"
                        onClick={() => {
                            setSelecaoDestaque(
                                null,
                            );

                            window
                                .getSelection()
                                ?.removeAllRanges();
                        }}
                    >
                        <X size={16} />
                    </button>
                </div>
            )}

            {marcadoresAbertos && (
                <div
                    className="book-bookmarks-overlay"
                    onMouseDown={(
                        event,
                    ) => {
                        if (
                            event.target ===
                            event.currentTarget
                        ) {
                            setMarcadoresAbertos(
                                false,
                            );
                        }
                    }}
                >
                    <aside className="book-bookmarks-panel">
                        <header className="book-bookmarks-header">
                            <div>
                                <span>
                                    Livro
                                </span>

                                <h2>
                                    Marcadores
                                </h2>
                            </div>

                            <button
                                type="button"
                                className="book-icon-button"
                                onClick={() =>
                                    setMarcadoresAbertos(
                                        false,
                                    )
                                }
                                aria-label="Fechar marcadores"
                            >
                                <X
                                    size={19}
                                />
                            </button>
                        </header>

                        <button
                            type="button"
                            className={[
                                "book-add-bookmark",

                                marcadorPontoAtual
                                    ? "already-bookmarked"
                                    : "",
                            ]
                                .filter(Boolean)
                                .join(" ")}
                            onClick={
                                adicionarMarcador
                            }
                            disabled={
                                salvandoMarcador ||
                                Boolean(
                                    marcadorPontoAtual,
                                )
                            }
                        >
                            <BookmarkPlus
                                size={18}
                            />

                            {salvandoMarcador
                                ? "Salvando..."
                                : marcadorPontoAtual
                                    ? "Ponto jÃ¡ marcado"
                                    : "Marcar este ponto"}
                        </button>

                        {marcadores.length ===
                            0 ? (
                            <div className="book-bookmarks-empty">
                                <Bookmark
                                    size={25}
                                />

                                <strong>
                                    Nenhum marcador
                                </strong>

                                <p>
                                    Salve pontos importantes
                                    para voltar a eles
                                    rapidamente.
                                </p>
                            </div>
                        ) : (
                            <div className="book-bookmarks-list">
                                {marcadores.map(
                                    (
                                        marcador,
                                    ) => (
                                        <div
                                            key={
                                                marcador.id
                                            }
                                            className="book-bookmark-item"
                                        >
                                            <button
                                                type="button"
                                                className="book-bookmark-open"
                                                onClick={() =>
                                                    abrirMarcador(
                                                        marcador,
                                                    )
                                                }
                                            >
                                                <Bookmark
                                                    size={17}
                                                />

                                                <div>
                                                    <strong>
                                                        {calcularPercentualMarcador(
                                                            marcador,
                                                        )}
                                                        % do livro
                                                    </strong>

                                                    <p>
                                                        {marcador
                                                            .trecho ||
                                                            "Ponto salvo do livro"}
                                                    </p>
                                                </div>
                                            </button>

                                            <button
                                                type="button"
                                                className="book-bookmark-delete"
                                                onClick={() =>
                                                    excluirMarcador(
                                                        marcador.id,
                                                    )
                                                }
                                                aria-label="Excluir marcador"
                                            >
                                                <Trash2
                                                    size={16}
                                                />
                                            </button>
                                        </div>
                                    ),
                                )}
                            </div>
                        )}
                    </aside>
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
