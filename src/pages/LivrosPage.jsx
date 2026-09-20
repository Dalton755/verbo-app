import {
    useEffect,
    useState,
} from "react";

import {
    ArrowLeft,
    BookOpen,
    ChevronRight,
    FolderOpen,
    FolderPlus,
    LibraryBig,
    MoreVertical,
    Plus,
    Pencil,
    Trash2,
    Upload,
    X,
} from "lucide-react";

import {
    useNavigate,
} from "react-router-dom";

import {
    supabase,
} from "../lib/supabase";

import {
    useAuth,
} from "../contexts/AuthContext";

import {
    processarPdfLivro,
} from "../lib/bookPdfProcessor";

import {
    gerarCapaLivro,
} from "../lib/bookCover";

import {
    limparLivroCache,
    salvarLivroCache,
} from "../lib/bookCache";

import {
    uploadPdfSeguro,
} from "../lib/uploadPdfSeguro";

import verboLogoHorizontal from "../assets/verbo-logo-horizontal.png";

const STORAGE_MODAL =
    "verbo_livros_modal_aberto";

const STORAGE_TITULO =
    "verbo_livros_titulo";

const STORAGE_AUTOR =
    "verbo_livros_autor";

function LivrosPage() {
    const navigate =
        useNavigate();

    const { user } =
        useAuth();

    const [
        livros,
        setLivros,
    ] = useState([]);

    const [
        capasLivros,
        setCapasLivros,
    ] = useState({});

    const [
        temas,
        setTemas,
    ] = useState([]);

    const [
        temaSelecionado,
        setTemaSelecionado,
    ] = useState(null);

    const [
        modalTemaAberto,
        setModalTemaAberto,
    ] = useState(false);

    const [
        nomeTema,
        setNomeTema,
    ] = useState("");

    const [
        salvandoTema,
        setSalvandoTema,
    ] = useState(false);

    const [
        erroTema,
        setErroTema,
    ] = useState("");

    const [
        temaEditando,
        setTemaEditando,
    ] = useState(null);

    const [
        salvandoEdicaoTema,
        setSalvandoEdicaoTema,
    ] = useState(false);

    const [
        excluindoTema,
        setExcluindoTema,
    ] = useState(null);

    const [
        menuTemaAberto,
        setMenuTemaAberto,
    ] = useState(null);

    const [
        modalNovoLivroAberto,
        setModalNovoLivroAberto,
    ] = useState(false);

    const [
        temaDestinoLivros,
        setTemaDestinoLivros,
    ] = useState({});

    const [
        livroMovendo,
        setLivroMovendo,
    ] = useState(null);

    const [
        carregando,
        setCarregando,
    ] = useState(true);

    const [
        modalAberto,
        setModalAberto,
    ] = useState(() => {
        return (
            sessionStorage.getItem(
                STORAGE_MODAL,
            ) === "1"
        );
    });

    const [
        salvando,
        setSalvando,
    ] = useState(false);

    const [
        erro,
        setErro,
    ] = useState("");

    const [
        titulo,
        setTitulo,
    ] = useState(() => {
        return (
            sessionStorage.getItem(
                STORAGE_TITULO,
            ) ?? ""
        );
    });

    const [
        autor,
        setAutor,
    ] = useState(() => {
        return (
            sessionStorage.getItem(
                STORAGE_AUTOR,
            ) ?? ""
        );
    });

    const [
        temaNovoLivro,
        setTemaNovoLivro,
    ] = useState("");

    const [
        arquivo,
        setArquivo,
    ] = useState(null);


    const [
        menuLivroAberto,
        setMenuLivroAberto,
    ] = useState(null);

    const [
        livroEditando,
        setLivroEditando,
    ] = useState(null);

    const [
        tituloLivroEditando,
        setTituloLivroEditando,
    ] = useState("");

    const [
        autorLivroEditando,
        setAutorLivroEditando,
    ] = useState("");

    const [
        modalEditarLivroAberto,
        setModalEditarLivroAberto,
    ] = useState(false);

    const [
        salvandoLivroEditado,
        setSalvandoLivroEditado,
    ] = useState(false);

    const [
        excluindoLivro,
        setExcluindoLivro,
    ] = useState(null);

    const [
        erroGerenciarLivro,
        setErroGerenciarLivro,
    ] = useState("");

    useEffect(() => {
        if (!user) {
            return;
        }

        let ativo = true;

        async function carregarLivros() {
            setCarregando(true);
            setErro("");

            const {
                data: temasData,
                error: temasError,
            } = await supabase
                .from("temas_livros")
                .select(`
                    id,
                    nome,
                    created_at
                `)
                .eq(
                    "usuario_id",
                    user.id,
                )
                .order(
                    "nome",
                    {
                        ascending: true,
                    },
                );

            if (temasError) {
                console.error(
                    "Erro ao carregar temas:",
                    temasError,
                );
            }

            const {
                data,
                error,
            } = await supabase
                .from("livros")
                .select(`
                    id,
                    titulo,
                    autor,
                    tema_id,
                    arquivo_nome,
                    storage_path,
                    capa_path,
                    total_paginas,
                    ultima_pagina,
                    ultima_posicao,
                    created_at
                `)
                .eq(
                    "usuario_id",
                    user.id,
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
                    error,
                );

                setErro(
                    "Não conseguimos carregar seus livros.",
                );

                setCarregando(false);
                return;
            }

            setTemas(
                temasData ?? [],
            );

            setLivros(
                data ?? [],
            );

            setCarregando(false);
        }

        carregarLivros();

        return () => {
            ativo = false;
        };
    }, [user]);

    useEffect(() => {
        if (
            !user ||
            livros.length === 0
        ) {
            setCapasLivros({});
            return;
        }

        let ativo = true;

        async function carregarCapas() {
            const livrosComCapa =
                livros.filter(
                    (livro) =>
                        Boolean(
                            livro.capa_path,
                        ),
                );

            if (
                livrosComCapa.length === 0
            ) {
                if (ativo) {
                    setCapasLivros({});
                }

                return;
            }

            const resultados =
                await Promise.all(
                    livrosComCapa.map(
                        async (
                            livro,
                        ) => {
                            const {
                                data,
                                error,
                            } =
                                await supabase.storage
                                    .from(
                                        "verbo-capas",
                                    )
                                    .createSignedUrl(
                                        livro.capa_path,
                                        60 * 60,
                                    );

                            if (error) {
                                console.warn(
                                    `Erro ao carregar capa de ${livro.titulo}:`,
                                    error,
                                );

                                return null;
                            }

                            return [
                                livro.id,
                                data.signedUrl,
                            ];
                        },
                    ),
                );

            if (!ativo) {
                return;
            }

            setCapasLivros(
                Object.fromEntries(
                    resultados.filter(
                        Boolean,
                    ),
                ),
            );
        }

        carregarCapas();

        return () => {
            ativo = false;
        };
    }, [
        livros,
        user,
    ]);

    /*
     * Mantém o texto digitado caso o Android
     * remonte a página ao abrir o seletor
     * de arquivos.
     */
    useEffect(() => {
        if (!modalAberto) {
            return;
        }

        sessionStorage.setItem(
            STORAGE_TITULO,
            titulo,
        );
    }, [
        titulo,
        modalAberto,
    ]);

    useEffect(() => {
        if (!modalAberto) {
            return;
        }

        sessionStorage.setItem(
            STORAGE_AUTOR,
            autor,
        );
    }, [
        autor,
        modalAberto,
    ]);

    function limparRascunhoImportacao() {
        sessionStorage.removeItem(
            STORAGE_MODAL,
        );

        sessionStorage.removeItem(
            STORAGE_TITULO,
        );

        sessionStorage.removeItem(
            STORAGE_AUTOR,
        );
    }

    function abrirImportacao() {
        setErro("");

        setTitulo("");
        setAutor("");
        setTemaNovoLivro("");
        setArquivo(null);

        sessionStorage.setItem(
            STORAGE_MODAL,
            "1",
        );

        sessionStorage.setItem(
            STORAGE_TITULO,
            "",
        );

        sessionStorage.setItem(
            STORAGE_AUTOR,
            "",
        );

        setModalAberto(true);
    }

    function fecharImportacao() {
        if (salvando) {
            return;
        }

        limparRascunhoImportacao();

        setTitulo("");
        setAutor("");
        setTemaNovoLivro("");
        setArquivo(null);

        setModalAberto(false);
    }

    function selecionarArquivo(
        event,
    ) {
        const arquivoSelecionado =
            event.target
                .files?.[0] ??
            null;

        /*
         * Mantemos explicitamente o modal
         * marcado como aberto porque alguns
         * navegadores Android remontam partes
         * da interface ao voltar do seletor.
         */
        sessionStorage.setItem(
            STORAGE_MODAL,
            "1",
        );

        setArquivo(
            arquivoSelecionado,
        );
    }

    async function importarLivro(
        event,
    ) {
        event.preventDefault();

        if (
            !user ||
            !titulo.trim() ||
            !arquivo
        ) {
            return;
        }

        if (
            arquivo.type !==
            "application/pdf"
        ) {
            setErro(
                "Selecione um arquivo PDF.",
            );

            return;
        }

        const limite =
            50 *
            1024 *
            1024;

        if (
            arquivo.size >
            limite
        ) {
            setErro(
                "O PDF deve ter no máximo 50 MB.",
            );

            return;
        }

        setSalvando(true);
        setErro("");

        let capaGerada = null;

        try {
            capaGerada =
                await gerarCapaLivro(
                    arquivo,
                );
        } catch (error) {
            console.warn(
                "Não foi possível gerar a capa do livro:",
                error,
            );

            /*
             * A falha da capa não impede
             * a importação do livro.
             */
            capaGerada = null;
        }

        let processamento;

        try {
            processamento =
                await processarPdfLivro(
                    arquivo,
                );
        } catch (error) {
            console.error(
                "Erro ao preparar livro:",
                error,
            );

            setErro(
                "Não conseguimos preparar este PDF para leitura.",
            );

            setSalvando(false);
            return;
        }

        const conteudoProcessado = {
            versao:
                processamento.versao,

            paginas:
                processamento.paginas,
        };

        const identificador =
            crypto.randomUUID();

        const storagePath =
            `${user.id}/livros/${identificador}.pdf`;

        const capaPath =
            capaGerada
                ? `${user.id}/livros/${identificador}.webp`
                : null;

        /*
         * 1. Reserva o espaço e envia
         * o PDF com quota protegida.
         */
        try {
            await uploadPdfSeguro({
                arquivo,
                caminho:
                    storagePath,
            });
        } catch (error) {
            console.error(
                "Erro no upload seguro:",
                error,
            );

            setErro(
                error?.message ||
                "Não conseguimos enviar o PDF.",
            );

            setSalvando(false);
            return;
        }

        /*
 * Envia a miniatura da capa.
 * Se houver algum problema apenas com
 * a capa, o livro continua sendo importado.
 */
        let capaSalvaPath =
            null;

        if (
            capaGerada &&
            capaPath
        ) {
            const {
                error:
                capaUploadError,
            } =
                await supabase.storage
                    .from(
                        "verbo-capas",
                    )
                    .upload(
                        capaPath,
                        capaGerada.blob,
                        {
                            contentType:
                                "image/webp",

                            cacheControl:
                                "3600",

                            upsert:
                                false,
                        },
                    );

            if (capaUploadError) {
                console.warn(
                    "Não foi possível salvar a capa:",
                    capaUploadError,
                );
            } else {
                capaSalvaPath =
                    capaPath;
            }
        }

        /*
         * 2. Cria o livro no banco.
         */
        const {
            data,
            error: livroError,
        } = await supabase
            .from("livros")
            .insert({
                usuario_id:
                    user.id,

                titulo:
                    titulo.trim(),

                autor:
                    autor.trim() ||
                    null,

                tema_id:
                    temaNovoLivro ||
                    null,

                arquivo_nome:
                    arquivo.name,

                storage_path:
                    storagePath,

                capa_path:
                    capaSalvaPath,

                total_paginas:
                    processamento
                        .totalPaginas,

                ultima_pagina:
                    1,

                ultima_posicao:
                    0,

                conteudo_processado:
                    conteudoProcessado,

                processado_em:
                    new Date()
                        .toISOString(),

                processador_versao:
                    1,
            })
            .select(`
                id,
                titulo,
                autor,
                tema_id,
                arquivo_nome,
                storage_path,
                capa_path,
                total_paginas,
                ultima_pagina,
                ultima_posicao,
                conteudo_processado,
                processado_em,
                processador_versao,
                created_at
            `)
            .single();

        /*
         * Se banco falhar, remove o PDF
         * que acabou de ser enviado.
         */
        if (livroError) {
            console.error(
                livroError,
            );

            await supabase.storage
                .from(
                    "biblia-slides-pdfs",
                )
                .remove([
                    storagePath,
                ]);

            if (capaSalvaPath) {
                await supabase.storage
                    .from(
                        "verbo-capas",
                    )
                    .remove([
                        capaSalvaPath,
                    ]);
            }

            setErro(
                "O PDF foi enviado, mas não conseguimos criar o livro.",
            );

            setSalvando(false);
            return;
        }

        salvarLivroCache(
            data.id,
            {
                livro:
                    data,

                paginas:
                    conteudoProcessado
                        .paginas,
            },
        );

        setLivros(
            (anteriores) => [
                data,
                ...anteriores,
            ],
        );

        limparRascunhoImportacao();

        setTitulo("");
        setAutor("");
        setArquivo(null);

        setModalAberto(false);
        setSalvando(false);
    }

    async function salvarTema(
        event,
    ) {
        event.preventDefault();

        if (
            !user ||
            !nomeTema.trim()
        ) {
            return;
        }

        setSalvandoTema(true);
        setSalvandoEdicaoTema(
            Boolean(
                temaEditando,
            ),
        );

        setErroTema("");

        let resultado;

        if (temaEditando) {
            resultado =
                await supabase
                    .from(
                        "temas_livros",
                    )
                    .update({
                        nome:
                            nomeTema.trim(),
                    })
                    .eq(
                        "id",
                        temaEditando.id,
                    )
                    .eq(
                        "usuario_id",
                        user.id,
                    )
                    .select(`
                    id,
                    nome,
                    created_at
                `)
                    .single();
        } else {
            resultado =
                await supabase
                    .from(
                        "temas_livros",
                    )
                    .insert({
                        usuario_id:
                            user.id,

                        nome:
                            nomeTema.trim(),
                    })
                    .select(`
                    id,
                    nome,
                    created_at
                `)
                    .single();
        }

        const {
            data,
            error,
        } = resultado;

        if (error) {
            console.error(
                "Erro ao salvar tema:",
                error,
            );

            if (
                error.code ===
                "23505"
            ) {
                setErroTema(
                    "Você já possui um tema com esse nome.",
                );
            } else {
                setErroTema(
                    "Não conseguimos salvar este tema.",
                );
            }

            setSalvandoTema(false);
            setSalvandoEdicaoTema(false);

            return;
        }

        if (temaEditando) {
            setTemas(
                (anteriores) =>
                    anteriores
                        .map(
                            (
                                tema,
                            ) =>
                                tema.id ===
                                    data.id
                                    ? data
                                    : tema,
                        )
                        .sort(
                            (
                                a,
                                b,
                            ) =>
                                a.nome.localeCompare(
                                    b.nome,
                                    "pt-BR",
                                ),
                        ),
            );

            if (
                temaSelecionado?.id ===
                data.id
            ) {
                setTemaSelecionado(
                    data,
                );
            }
        } else {
            setTemas(
                (anteriores) =>
                    [
                        ...anteriores,
                        data,
                    ].sort(
                        (
                            a,
                            b,
                        ) =>
                            a.nome.localeCompare(
                                b.nome,
                                "pt-BR",
                            ),
                    ),
            );
        }

        setModalTemaAberto(
            false,
        );

        setNomeTema("");

        setSalvandoTema(false);
        setSalvandoEdicaoTema(false);

        setTimeout(() => {
            setTemaEditando(
                null,
            );
        }, 0);
    }

    async function excluirTema(
        tema,
    ) {
        const quantidadeLivros =
            livros.filter(
                (livro) =>
                    livro.tema_id ===
                    tema.id,
            ).length;

        const mensagem =
            quantidadeLivros > 0
                ? `Excluir o tema "${tema.nome}"?\n\nOs ${quantidadeLivros} livros deste tema não serão excluídos. Eles voltarão para "Sem tema".`
                : `Excluir o tema "${tema.nome}"?`;

        const confirmou =
            window.confirm(
                mensagem,
            );

        if (!confirmou) {
            return;
        }

        setExcluindoTema(
            tema.id,
        );

        setErro("");

        const {
            error,
        } = await supabase
            .from(
                "temas_livros",
            )
            .delete()
            .eq(
                "id",
                tema.id,
            )
            .eq(
                "usuario_id",
                user.id,
            );

        if (error) {
            console.error(
                "Erro ao excluir tema:",
                error,
            );

            setErro(
                "Não conseguimos excluir este tema.",
            );

            setExcluindoTema(null);

            return;
        }

        setTemas(
            (anteriores) =>
                anteriores.filter(
                    (item) =>
                        item.id !==
                        tema.id,
                ),
        );

        /*
         * O banco faz ON DELETE SET NULL.
         * Atualizamos também a tela imediatamente.
         */
        setLivros(
            (anteriores) =>
                anteriores.map(
                    (livro) =>
                        livro.tema_id ===
                            tema.id
                            ? {
                                ...livro,

                                tema_id:
                                    null,
                            }
                            : livro,
                ),
        );

        if (
            temaSelecionado?.id ===
            tema.id
        ) {
            setTemaSelecionado(
                null,
            );
        }

        setExcluindoTema(null);
    }

    function abrirNovoLivro() {
        setModalNovoLivroAberto(
            true,
        );
    }


    const livrosSemTema =
        livros.filter(
            (livro) =>
                !livro.tema_id,
        );

    async function moverLivroParaTema(
        livro,
    ) {
        const temaId =
            temaDestinoLivros[
            livro.id
            ];

        if (
            !user ||
            !temaId
        ) {
            return;
        }

        setLivroMovendo(
            livro.id,
        );

        const {
            error,
        } = await supabase
            .from("livros")
            .update({
                tema_id:
                    temaId,
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
                "Erro ao mover livro:",
                error,
            );

            setErro(
                "Não conseguimos mover este livro.",
            );

            setLivroMovendo(null);
            return;
        }

        setLivros(
            (anteriores) =>
                anteriores.map(
                    (item) =>
                        item.id ===
                            livro.id
                            ? {
                                ...item,

                                tema_id:
                                    temaId,
                            }
                            : item,
                ),
        );

        setTemaDestinoLivros(
            (anteriores) => {
                const novos = {
                    ...anteriores,
                };

                delete novos[
                    livro.id
                ];

                return novos;
            },
        );

        setLivroMovendo(null);
    }

    function abrirEdicaoTema(
        tema,
    ) {
        setTemaEditando(
            tema,
        );

        setNomeTema(
            tema.nome,
        );

        setErroTema("");

        setModalTemaAberto(
            true,
        );
    }

    function abrirEdicaoLivro(
        livro,
    ) {
        setLivroEditando(
            livro,
        );

        setTituloLivroEditando(
            livro.titulo ?? "",
        );

        setAutorLivroEditando(
            livro.autor ?? "",
        );

        setErroGerenciarLivro("");

        setModalEditarLivroAberto(
            true,
        );

        setMenuLivroAberto(
            null,
        );
    }

    function abrirEdicaoLivro(
        livro,
    ) {
        setLivroEditando(
            livro,
        );

        setTituloLivroEditando(
            livro.titulo ?? "",
        );

        setAutorLivroEditando(
            livro.autor ?? "",
        );

        setErroGerenciarLivro("");

        setModalEditarLivroAberto(
            true,
        );

        setMenuLivroAberto(
            null,
        );
    }

    async function salvarEdicaoLivro(
        event,
    ) {
        event.preventDefault();

        if (
            !user ||
            !livroEditando?.id ||
            !tituloLivroEditando.trim()
        ) {
            return;
        }

        setSalvandoLivroEditado(
            true,
        );

        setErroGerenciarLivro("");

        const {
            data,
            error,
        } = await supabase
            .from("livros")
            .update({
                titulo:
                    tituloLivroEditando.trim(),

                autor:
                    autorLivroEditando.trim() ||
                    null,
            })
            .eq(
                "id",
                livroEditando.id,
            )
            .eq(
                "usuario_id",
                user.id,
            )
            .select(`
            id,
            titulo,
            autor,
            tema_id,
            arquivo_nome,
            storage_path,
            capa_path,
            total_paginas,
            ultima_pagina,
            ultima_posicao,
            created_at
        `)
            .single();

        if (error) {
            console.error(
                "Erro ao editar livro:",
                error,
            );

            setErroGerenciarLivro(
                "Não conseguimos salvar as alterações.",
            );

            setSalvandoLivroEditado(
                false,
            );

            return;
        }

        setLivros(
            (anteriores) =>
                anteriores.map(
                    (livro) =>
                        livro.id ===
                            data.id
                            ? {
                                ...livro,
                                ...data,
                            }
                            : livro,
                ),
        );

        limparLivroCache(
            livroEditando.id,
        );

        setModalEditarLivroAberto(
            false,
        );

        setLivroEditando(
            null,
        );

        setTituloLivroEditando("");
        setAutorLivroEditando("");

        setSalvandoLivroEditado(
            false,
        );
    }

    async function excluirLivro(
        livro,
    ) {
        if (
            !user ||
            !livro?.id
        ) {
            return;
        }

        const confirmou =
            window.confirm(
                `Excluir "${livro.titulo}"?\n\nO livro e o PDF serão removidos permanentemente. O espaço ocupado será liberado.`,
            );

        if (!confirmou) {
            return;
        }

        setExcluindoLivro(
            livro.id,
        );

        setErroGerenciarLivro("");

        /*
         * 1. Remove o PDF físico do Storage.
         */
        if (livro.storage_path) {
            const {
                error:
                storageError,
            } =
                await supabase.storage
                    .from(
                        "biblia-slides-pdfs",
                    )
                    .remove([
                        livro.storage_path,
                    ]);

            if (storageError) {
                console.error(
                    "Erro ao excluir PDF:",
                    storageError,
                );

                setErroGerenciarLivro(
                    "Não conseguimos remover o PDF. O livro não foi excluído.",
                );

                setExcluindoLivro(
                    null,
                );

                return;
            }
        }

        /*
 * Remove também a capa do livro.
 */
        if (livro.capa_path) {
            const {
                error:
                capaError,
            } =
                await supabase.storage
                    .from(
                        "verbo-capas",
                    )
                    .remove([
                        livro.capa_path,
                    ]);

            if (capaError) {
                console.warn(
                    "Não foi possível remover a capa:",
                    capaError,
                );
            }
        }

        /*
         * 2. Remove o registro do livro.
         */
        const {
            error:
            livroError,
        } = await supabase
            .from("livros")
            .delete()
            .eq(
                "id",
                livro.id,
            )
            .eq(
                "usuario_id",
                user.id,
            );

        if (livroError) {
            console.error(
                "Erro ao excluir livro:",
                livroError,
            );

            setErroGerenciarLivro(
                "O PDF foi removido, mas ocorreu um erro ao remover o livro do banco.",
            );

            setExcluindoLivro(
                null,
            );

            return;
        }

        limparLivroCache(
            livro.id,
        );

        setLivros(
            (anteriores) =>
                anteriores.filter(
                    (item) =>
                        item.id !==
                        livro.id,
                ),
        );

        setMenuLivroAberto(
            null,
        );

        setExcluindoLivro(
            null,
        );
    }

    return (
        <div className="app">
            <header className="topbar">
                <div className="module-header module-header-verbo">
                    <img
                        src={
                            verboLogoHorizontal
                        }
                        alt="VERBO"
                        className="topbar-verbo-logo"
                    />

                    <button
                        type="button"
                        className="back-button"
                        onClick={() =>
                            navigate("/")
                        }
                    >
                        <ArrowLeft
                            size={18}
                        />

                        Biblioteca
                    </button>

                    <div>
                        <span className="app-kicker">
                            Livros
                        </span>

                        <h1>
                            Sua estante
                        </h1>
                    </div>
                </div>
            </header>

            <main className="page-content module-page">
                <section className="sermons-heading">
                    <div className="module-page-intro">
                        <p className="eyebrow">
                            Biblioteca
                        </p>

                        <h2>
                            Sua estante
                        </h2>

                        <p>
                            Organize seus livros por temas e continue a leitura de onde parou.
                        </p>
                    </div>

                    {livros.length >
                        0 && (
                            <button
                                type="button"
                                className="primary-button desktop-import-button"
                                onClick={
                                    abrirNovoLivro
                                }
                            >
                                <Plus
                                    size={18}
                                />

                                Novo livro
                            </button>
                        )}
                </section>

                {erro && (
                    <div className="library-message">
                        {erro}
                    </div>
                )}

                {carregando ? (
                    <section className="library-loading">
                        <div className="loading-dot" />

                        <p>
                            Buscando seus
                            livros...
                        </p>
                    </section>
                ) : livros.length ===
                    0 ? (
                    <section className="module-empty">
                        <div className="empty-icon">
                            <LibraryBig
                                size={28}
                            />
                        </div>

                        <h3>
                            Sua estante começa
                            aqui
                        </h3>

                        <p>
                            Importe um livro em
                            PDF. Depois ele será
                            preparado para uma
                            leitura confortável
                            em qualquer tela.
                        </p>

                        <button
                            type="button"
                            className="primary-button sermon-first-button"
                            onClick={
                                abrirImportacao
                            }
                        >
                            <Upload
                                size={18}
                            />

                            Importar livro
                        </button>
                    </section>
                ) : temaSelecionado ? (
                    <section>
                        <div className="books-theme-header">
                            <button
                                type="button"
                                className="secondary-button"
                                onClick={() =>
                                    setTemaSelecionado(
                                        null,
                                    )
                                }
                            >
                                <ArrowLeft
                                    size={17}
                                />

                                Estante
                            </button>

                            <div>
                                <span className="app-kicker">
                                    Tema
                                </span>

                                <h2>
                                    {
                                        temaSelecionado.nome
                                    }
                                </h2>
                            </div>
                        </div>

                        <section className="sermons-list">
                            {livros
                                .filter(
                                    (livro) => {
                                        if (
                                            temaSelecionado.id ===
                                            "SEM_TEMA"
                                        ) {
                                            return (
                                                !livro.tema_id
                                            );
                                        }

                                        return (
                                            livro.tema_id ===
                                            temaSelecionado.id
                                        );
                                    },
                                )
                                .map(
                                    (livro) => (
                                        <article
                                            key={
                                                livro.id
                                            }
                                            className="sermon-card book-card-manage"
                                        >
                                            <button
                                                type="button"
                                                className="book-card-main"
                                                onClick={() =>
                                                    navigate(
                                                        `/livros/${livro.id}`,
                                                    )
                                                }
                                            >
                                                <div className="book-cover-thumb">
                                                    {capasLivros[
                                                        livro.id
                                                    ] ? (
                                                        <img
                                                            src={
                                                                capasLivros[
                                                                livro.id
                                                                ]
                                                            }
                                                            alt={`Capa de ${livro.titulo}`}
                                                            loading="lazy"
                                                        />
                                                    ) : (
                                                        <div className="book-cover-placeholder">
                                                            <BookOpen
                                                                size={24}
                                                            />
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="sermon-card-content">
                                                    <span>
                                                        {livro.autor ||
                                                            "Autor não informado"}
                                                    </span>

                                                    <h3>
                                                        {livro.titulo}
                                                    </h3>

                                                    <p>
                                                        {livro.total_paginas
                                                            ? `${livro.total_paginas} páginas`
                                                            : livro.arquivo_nome}
                                                    </p>
                                                </div>

                                                <ChevronRight
                                                    size={20}
                                                    className="module-card-arrow-inline"
                                                />
                                            </button>

                                            <div className="book-item-menu-area">
                                                <button
                                                    type="button"
                                                    className="book-theme-menu-button"
                                                    aria-label={`Opções de ${livro.titulo}`}
                                                    onClick={() =>
                                                        setMenuLivroAberto(
                                                            (atual) =>
                                                                atual ===
                                                                    livro.id
                                                                    ? null
                                                                    : livro.id,
                                                        )
                                                    }
                                                >
                                                    <MoreVertical
                                                        size={19}
                                                    />
                                                </button>

                                                {menuLivroAberto ===
                                                    livro.id && (
                                                        <div className="book-theme-menu">
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    abrirEdicaoLivro(
                                                                        livro,
                                                                    )
                                                                }
                                                            >
                                                                <Pencil
                                                                    size={16}
                                                                />

                                                                Editar
                                                            </button>

                                                            <button
                                                                type="button"
                                                                className="danger"
                                                                disabled={
                                                                    excluindoLivro ===
                                                                    livro.id
                                                                }
                                                                onClick={() =>
                                                                    excluirLivro(
                                                                        livro,
                                                                    )
                                                                }
                                                            >
                                                                <Trash2
                                                                    size={16}
                                                                />

                                                                {excluindoLivro ===
                                                                    livro.id
                                                                    ? "Excluindo..."
                                                                    : "Excluir"}
                                                            </button>
                                                        </div>
                                                    )}
                                            </div>
                                        </article>
                                    ),
                                )}
                        </section>
                    </section>
                ) : (
                    <section className="books-themes-grid">
                        {temas.map(
                            (tema) => {
                                const quantidade =
                                    livros.filter(
                                        (livro) =>
                                            livro.tema_id ===
                                            tema.id,
                                    ).length;

                                return (
                                    <article
                                        key={tema.id}
                                        className="book-theme-card book-theme-modern"
                                    >
                                        <button
                                            type="button"
                                            className="book-theme-main"
                                            onClick={() =>
                                                setTemaSelecionado(
                                                    tema,
                                                )
                                            }
                                        >
                                            <div className="book-theme-icon">
                                                <FolderOpen
                                                    size={22}
                                                />
                                            </div>

                                            <div className="book-theme-info">
                                                <h3>
                                                    {tema.nome}
                                                </h3>

                                                <span>
                                                    {quantidade}
                                                    {" "}
                                                    {quantidade === 1
                                                        ? "livro"
                                                        : "livros"}
                                                </span>
                                            </div>

                                            <ChevronRight
                                                size={18}
                                                className="book-theme-arrow"
                                            />
                                        </button>

                                        <div className="book-theme-menu-area">
                                            <button
                                                type="button"
                                                className="book-theme-menu-button"
                                                aria-label={`Opções de ${tema.nome}`}
                                                onClick={(event) => {
                                                    event.stopPropagation();

                                                    setMenuTemaAberto(
                                                        (atual) =>
                                                            atual === tema.id
                                                                ? null
                                                                : tema.id,
                                                    );
                                                }}
                                            >
                                                <MoreVertical
                                                    size={19}
                                                />
                                            </button>

                                            {menuTemaAberto ===
                                                tema.id && (
                                                    <div className="book-theme-menu">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setMenuTemaAberto(
                                                                    null,
                                                                );

                                                                abrirEdicaoTema(
                                                                    tema,
                                                                );
                                                            }}
                                                        >
                                                            <Pencil
                                                                size={16}
                                                            />

                                                            Renomear
                                                        </button>

                                                        <button
                                                            type="button"
                                                            className="danger"
                                                            disabled={
                                                                excluindoTema ===
                                                                tema.id
                                                            }
                                                            onClick={() => {
                                                                setMenuTemaAberto(
                                                                    null,
                                                                );

                                                                excluirTema(
                                                                    tema,
                                                                );
                                                            }}
                                                        >
                                                            <Trash2
                                                                size={16}
                                                            />

                                                            Excluir
                                                        </button>
                                                    </div>
                                                )}
                                        </div>
                                    </article>
                                );
                            },
                        )}

                        {livros.some(
                            (livro) =>
                                !livro.tema_id,
                        ) && (
                                <button
                                    type="button"
                                    className="book-theme-card"
                                    onClick={() =>
                                        setTemaSelecionado({
                                            id:
                                                "SEM_TEMA",

                                            nome:
                                                "Sem tema",
                                        })
                                    }
                                >
                                    <div className="book-theme-icon">
                                        <BookOpen
                                            size={24}
                                        />
                                    </div>

                                    <div>
                                        <h3>
                                            Sem tema
                                        </h3>

                                        <span>
                                            {
                                                livros.filter(
                                                    (
                                                        livro,
                                                    ) =>
                                                        !livro.tema_id,
                                                ).length
                                            }
                                            {" livros"}
                                        </span>
                                    </div>

                                    <ChevronRight
                                        size={20}
                                    />
                                </button>
                            )}

                        <button
                            type="button"
                            className="book-theme-card book-theme-add"
                            onClick={() => {
                                setTemaEditando(
                                    null,
                                );

                                setNomeTema("");
                                setErroTema("");

                                setModalTemaAberto(
                                    true,
                                );
                            }}
                        >
                            <div className="book-theme-icon">
                                <FolderPlus
                                    size={24}
                                />
                            </div>

                            <div className="book-theme-info">
                                <h3>
                                    Novo tema
                                </h3>

                                <span>
                                    Criar uma nova categoria
                                </span>
                            </div>
                        </button>
                    </section>
                )}
            </main>

            <div className="mobile-action">
                <button
                    type="button"
                    className="primary-button"
                    onClick={
                        abrirNovoLivro
                    }
                >
                    <Plus size={19} />

                    Novo livro
                </button>
            </div>

            {modalTemaAberto && (
                <div
                    className="modal-overlay"
                    onMouseDown={(
                        event,
                    ) => {
                        if (
                            event.target ===
                            event.currentTarget &&
                            !salvandoTema
                        ) {
                            () => {
                                setModalTemaAberto(
                                    false,
                                );

                                setTemaEditando(
                                    null,
                                );

                                setNomeTema("");
                                setErroTema("");
                            }
                        }
                    }}
                >
                    <div className="modal-card">
                        <div className="modal-header">
                            <div className="modal-icon">
                                <FolderPlus
                                    size={22}
                                />
                            </div>

                            <button
                                type="button"
                                className="modal-close"
                                disabled={
                                    salvandoTema
                                }
                                onClick={() => {
                                    setTemaEditando(
                                        null,
                                    );

                                    setNomeTema("");
                                    setErroTema("");

                                    setModalTemaAberto(
                                        true,
                                    );
                                }}
                            >
                                <X
                                    size={20}
                                />
                            </button>
                        </div>

                        <div className="modal-heading">
                            <span className="app-kicker">
                                Estante
                            </span>

                            <h2>
                                {temaEditando
                                    ? "Editar tema"
                                    : "Novo tema"}
                            </h2>

                            <p>
                                {temaEditando
                                    ? "Altere o nome deste tema."
                                    : "Crie uma categoria para organizar seus livros."}
                            </p>
                        </div>

                        <form
                            className="trimestre-form"
                            onSubmit={
                                salvarTema
                            }
                        >
                            <label>
                                Nome do tema

                                <input
                                    type="text"
                                    value={
                                        nomeTema
                                    }
                                    onChange={(
                                        event,
                                    ) =>
                                        setNomeTema(
                                            event
                                                .target
                                                .value,
                                        )
                                    }
                                    placeholder="Ex.: Teologia"
                                    autoFocus
                                />
                            </label>

                            {erroTema && (
                                <div className="library-message">
                                    {erroTema}
                                </div>
                            )}

                            <div className="modal-actions">
                                <button
                                    type="button"
                                    className="secondary-button"
                                    disabled={
                                        salvandoTema
                                    }
                                    onClick={() => {
                                        setModalTemaAberto(
                                            false,
                                        );

                                        setNomeTema("");
                                        setErroTema("");

                                        setTimeout(() => {
                                            setTemaEditando(
                                                null,
                                            );
                                        }, 0);
                                    }}
                                >
                                    Cancelar
                                </button>

                                <button
                                    type="submit"
                                    className="primary-button"
                                    disabled={
                                        salvandoTema ||
                                        !nomeTema.trim()
                                    }
                                >
                                    {salvandoTema
                                        ? "Salvando..."
                                        : temaEditando
                                            ? "Salvar alterações"
                                            : "Criar tema"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {modalNovoLivroAberto && (
                <div
                    className="modal-overlay"
                    onMouseDown={(
                        event,
                    ) => {
                        if (
                            event.target ===
                            event.currentTarget &&
                            !livroMovendo
                        ) {
                            setModalNovoLivroAberto(
                                false,
                            );
                        }
                    }}
                >
                    <div className="modal-card books-add-modal">
                        <div className="modal-header">
                            <div className="modal-icon">
                                <LibraryBig
                                    size={22}
                                />
                            </div>

                            <button
                                type="button"
                                className="modal-close"
                                aria-label="Fechar"
                                disabled={
                                    Boolean(
                                        livroMovendo,
                                    )
                                }
                                onClick={() =>
                                    setModalNovoLivroAberto(
                                        false,
                                    )
                                }
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="modal-heading">
                            <span className="app-kicker">
                                Estante
                            </span>

                            <h2>
                                Novo livro
                            </h2>

                            <p>
                                Importe um novo PDF ou organize livros que ainda estão sem tema.
                            </p>
                        </div>

                        <button
                            type="button"
                            className="books-import-option"
                            onClick={() => {
                                setModalNovoLivroAberto(
                                    false,
                                );

                                abrirImportacao();
                            }}
                        >
                            <div className="book-theme-icon">
                                <Upload
                                    size={22}
                                />
                            </div>

                            <div>
                                <strong>
                                    Importar novo livro
                                </strong>

                                <span>
                                    Adicionar um novo PDF à sua estante
                                </span>
                            </div>

                            <ChevronRight
                                size={20}
                            />
                        </button>

                        {livrosSemTema.length >
                            0 && (
                                <div className="books-unorganized-section">
                                    <div className="books-unorganized-heading">
                                        <span className="app-kicker">
                                            Organizar
                                        </span>

                                        <h3>
                                            Livros sem tema
                                        </h3>

                                        <p>
                                            {livrosSemTema.length}
                                            {" "}
                                            {livrosSemTema.length ===
                                                1
                                                ? "livro aguardando organização"
                                                : "livros aguardando organização"}
                                        </p>
                                    </div>

                                    <div className="books-unorganized-list">
                                        {livrosSemTema.map(
                                            (livro) => (
                                                <article
                                                    key={
                                                        livro.id
                                                    }
                                                    className="book-unorganized-item"
                                                >
                                                    <div className="book-unorganized-info">
                                                        <BookOpen
                                                            size={19}
                                                        />

                                                        <div>
                                                            <strong>
                                                                {
                                                                    livro.titulo
                                                                }
                                                            </strong>

                                                            <span>
                                                                {livro.autor ||
                                                                    "Autor não informado"}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {temas.length >
                                                        0 ? (
                                                        <div className="book-move-controls">
                                                            <select
                                                                value={
                                                                    temaDestinoLivros[
                                                                    livro.id
                                                                    ] ??
                                                                    ""
                                                                }
                                                                disabled={
                                                                    livroMovendo ===
                                                                    livro.id
                                                                }
                                                                onChange={(
                                                                    event,
                                                                ) =>
                                                                    setTemaDestinoLivros(
                                                                        (
                                                                            anteriores,
                                                                        ) => ({
                                                                            ...anteriores,

                                                                            [livro.id]:
                                                                                event
                                                                                    .target
                                                                                    .value,
                                                                        }),
                                                                    )
                                                                }
                                                            >
                                                                <option value="">
                                                                    Escolher tema
                                                                </option>

                                                                {temas.map(
                                                                    (
                                                                        tema,
                                                                    ) => (
                                                                        <option
                                                                            key={
                                                                                tema.id
                                                                            }
                                                                            value={
                                                                                tema.id
                                                                            }
                                                                        >
                                                                            {
                                                                                tema.nome
                                                                            }
                                                                        </option>
                                                                    ),
                                                                )}
                                                            </select>

                                                            <button
                                                                type="button"
                                                                className="primary-button"
                                                                disabled={
                                                                    !temaDestinoLivros[
                                                                    livro.id
                                                                    ] ||
                                                                    livroMovendo ===
                                                                    livro.id
                                                                }
                                                                onClick={() =>
                                                                    moverLivroParaTema(
                                                                        livro,
                                                                    )
                                                                }
                                                            >
                                                                {livroMovendo ===
                                                                    livro.id
                                                                    ? "Movendo..."
                                                                    : "Mover"}
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className="book-no-theme-message">
                                                            Crie um tema para organizar este livro.
                                                        </span>
                                                    )}
                                                </article>
                                            ),
                                        )}
                                    </div>
                                </div>
                            )}
                    </div>
                </div>
            )}

            {modalEditarLivroAberto && (
                <div
                    className="modal-overlay"
                    onMouseDown={(
                        event,
                    ) => {
                        if (
                            event.target ===
                            event.currentTarget &&
                            !salvandoLivroEditado
                        ) {
                            setModalEditarLivroAberto(
                                false,
                            );
                        }
                    }}
                >
                    <div className="modal-card">
                        <div className="modal-header">
                            <div className="modal-icon">
                                <BookOpen
                                    size={22}
                                />
                            </div>

                            <button
                                type="button"
                                className="modal-close"
                                disabled={
                                    salvandoLivroEditado
                                }
                                onClick={() =>
                                    setModalEditarLivroAberto(
                                        false,
                                    )
                                }
                                aria-label="Fechar"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="modal-heading">
                            <span className="app-kicker">
                                Livro
                            </span>

                            <h2>
                                Editar livro
                            </h2>

                            <p>
                                Altere o nome ou o autor do livro.
                            </p>
                        </div>

                        <form
                            className="trimestre-form"
                            onSubmit={
                                salvarEdicaoLivro
                            }
                        >
                            <label>
                                Nome do livro

                                <input
                                    type="text"
                                    value={
                                        tituloLivroEditando
                                    }
                                    onChange={(
                                        event,
                                    ) =>
                                        setTituloLivroEditando(
                                            event
                                                .target
                                                .value,
                                        )
                                    }
                                    autoFocus
                                />
                            </label>

                            <label>
                                Autor

                                <span className="optional-field">
                                    Opcional
                                </span>

                                <input
                                    type="text"
                                    value={
                                        autorLivroEditando
                                    }
                                    onChange={(
                                        event,
                                    ) =>
                                        setAutorLivroEditando(
                                            event
                                                .target
                                                .value,
                                        )
                                    }
                                />
                            </label>

                            {erroGerenciarLivro && (
                                <div className="library-message">
                                    {
                                        erroGerenciarLivro
                                    }
                                </div>
                            )}

                            <div className="modal-actions">
                                <button
                                    type="button"
                                    className="secondary-button"
                                    disabled={
                                        salvandoLivroEditado
                                    }
                                    onClick={() =>
                                        setModalEditarLivroAberto(
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
                                        salvandoLivroEditado ||
                                        !tituloLivroEditando.trim()
                                    }
                                >
                                    {salvandoLivroEditado
                                        ? "Salvando..."
                                        : "Salvar alterações"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {modalAberto && (
                <div className="modal-overlay">
                    <div className="modal-card">
                        <div className="modal-header">
                            <div className="modal-icon">
                                <LibraryBig
                                    size={
                                        22
                                    }
                                />
                            </div>

                            <button
                                className="modal-close"
                                type="button"
                                onClick={
                                    fecharImportacao
                                }
                                disabled={
                                    salvando
                                }
                                aria-label="Fechar"
                            >
                                <X
                                    size={
                                        20
                                    }
                                />
                            </button>
                        </div>

                        <div className="modal-heading">
                            <span className="app-kicker">
                                Novo livro
                            </span>

                            <h2>
                                Adicione à sua
                                estante
                            </h2>

                            <p>
                                Informe o título,
                                o autor e selecione
                                o PDF.
                            </p>
                        </div>

                        <form
                            className="trimestre-form"
                            onSubmit={
                                importarLivro
                            }
                        >
                            <label>
                                Título do livro

                                <input
                                    type="text"
                                    value={
                                        titulo
                                    }
                                    onChange={(
                                        event,
                                    ) =>
                                        setTitulo(
                                            event
                                                .target
                                                .value,
                                        )
                                    }
                                    placeholder="Ex.: O Peregrino"
                                    autoFocus
                                />
                            </label>

                            <label>
                                Autor

                                <span className="optional-field">
                                    Opcional
                                </span>

                                <input
                                    type="text"
                                    value={
                                        autor
                                    }
                                    onChange={(
                                        event,
                                    ) =>
                                        setAutor(
                                            event
                                                .target
                                                .value,
                                        )
                                    }
                                    placeholder="Ex.: John Bunyan"
                                />
                            </label>

                            <label>
                                Tema

                                <span className="optional-field">
                                    Opcional
                                </span>

                                <select
                                    value={
                                        temaNovoLivro
                                    }
                                    onChange={(
                                        event,
                                    ) =>
                                        setTemaNovoLivro(
                                            event
                                                .target
                                                .value,
                                        )
                                    }
                                >
                                    <option value="">
                                        Sem tema
                                    </option>

                                    {temas.map(
                                        (tema) => (
                                            <option
                                                key={
                                                    tema.id
                                                }
                                                value={
                                                    tema.id
                                                }
                                            >
                                                {tema.nome}
                                            </option>
                                        ),
                                    )}
                                </select>
                            </label>

                            <label>
                                Arquivo PDF

                                <div className="pdf-picker">
                                    <input
                                        type="file"
                                        accept="application/pdf,.pdf"
                                        onChange={
                                            selecionarArquivo
                                        }
                                    />

                                    <Upload
                                        size={
                                            21
                                        }
                                    />

                                    <div>
                                        <strong>
                                            {arquivo
                                                ? arquivo.name
                                                : "Selecionar PDF"}
                                        </strong>

                                        <span>
                                            {arquivo
                                                ? `${(
                                                    arquivo.size /
                                                    1024 /
                                                    1024
                                                ).toFixed(
                                                    1,
                                                )} MB`
                                                : "Arquivo de até 50 MB"}
                                        </span>
                                    </div>
                                </div>
                            </label>

                            <div className="modal-actions">
                                <button
                                    type="button"
                                    className="secondary-button"
                                    onClick={
                                        fecharImportacao
                                    }
                                    disabled={
                                        salvando
                                    }
                                >
                                    Cancelar
                                </button>

                                <button
                                    type="submit"
                                    className="primary-button"
                                    disabled={
                                        salvando ||
                                        !titulo.trim() ||
                                        !arquivo
                                    }
                                >
                                    {salvando
                                        ? "Preparando livro..."
                                        : "Adicionar livro"}

                                    {!salvando && (
                                        <BookOpen
                                            size={
                                                18
                                            }
                                        />
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default LivrosPage;