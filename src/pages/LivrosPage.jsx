import {
    useEffect,
    useState,
} from "react";

import {
    ArrowLeft,
    BookOpen,
    ChevronRight,
    LibraryBig,
    Plus,
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
    salvarLivroCache,
} from "../lib/bookCache";

import {
    uploadPdfSeguro,
} from "../lib/uploadPdfSeguro";

import verboLogoHorizontal from "../assets/verbo-logo-horizontal.png";

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
        carregando,
        setCarregando,
    ] = useState(true);

    const [
        modalAberto,
        setModalAberto,
    ] = useState(false);

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
    ] = useState("");

    const [
        autor,
        setAutor,
    ] = useState("");

    const [
        arquivo,
        setArquivo,
    ] = useState(null);

    useEffect(() => {
        if (!user) {
            return;
        }

        let ativo = true;

        async function carregarLivros() {
            setCarregando(true);
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

    function abrirImportacao() {
        setErro("");

        setTitulo("");
        setAutor("");
        setArquivo(null);

        setModalAberto(true);
    }

    function fecharImportacao() {
        if (salvando) {
            return;
        }

        setModalAberto(false);
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

        /*
    * 1. Reserva o espaço e envia
    *    o PDF com quota protegida.
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

                arquivo_nome:
                    arquivo.name,

                storage_path:
                    storagePath,

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
                arquivo_nome,
                storage_path,
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

        setTitulo("");
        setAutor("");
        setArquivo(null);

        setModalAberto(false);
        setSalvando(false);
    }

    return (
        <div className="app">
            <header className="topbar">
                <div className="module-header module-header-verbo">
                    <img
                        src={verboLogoHorizontal}
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
                            Leia. Continue. Aprofunde.
                        </p>

                        <h2>
                            Sua biblioteca cristã
                            em qualquer tela.
                        </h2>

                        <p>
                            Importe seus livros em PDF
                            e continue a leitura de onde
                            parou, no computador ou no
                            celular.
                        </p>
                    </div>

                    {livros.length > 0 && (
                        <button
                            type="button"
                            className="primary-button desktop-import-button"
                            onClick={
                                abrirImportacao
                            }
                        >
                            <Plus size={18} />

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
                            Buscando seus livros...
                        </p>
                    </section>
                ) : livros.length === 0 ? (
                    <section className="module-empty">
                        <div className="empty-icon">
                            <LibraryBig
                                size={28}
                            />
                        </div>

                        <h3>
                            Sua estante começa aqui
                        </h3>

                        <p>
                            Importe um livro em PDF.
                            Depois ele será preparado
                            para uma leitura confortável
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
                ) : (
                    <section className="sermons-list">
                        {livros.map(
                            (livro) => (
                                <button
                                    key={
                                        livro.id
                                    }
                                    type="button"
                                    className="sermon-card"
                                    onClick={() =>
                                        navigate(
                                            `/livros/${livro.id}`,
                                        )
                                    }
                                >
                                    <div className="sermon-card-icon">
                                        <BookOpen
                                            size={21}
                                        />
                                    </div>

                                    <div className="sermon-card-content">
                                        <span>
                                            {livro.autor ||
                                                "Livro"}
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
                            ),
                        )}
                    </section>
                )}
            </main>

            <div className="mobile-action">
                <button
                    type="button"
                    className="primary-button"
                    onClick={
                        abrirImportacao
                    }
                >
                    <Plus size={19} />

                    Novo livro
                </button>
            </div>

            {modalAberto && (
                <divclassName="modal-overlay">
                    <div className="modal-card">
                        <div className="modal-header">
                            <div className="modal-icon">
                                <LibraryBig
                                    size={22}
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
                                <X size={20} />
                            </button>
                        </div>

                        <div className="modal-heading">
                            <span className="app-kicker">
                                Novo livro
                            </span>

                            <h2>
                                Adicione à sua estante
                            </h2>

                            <p>
                                Informe o título, o autor
                                e selecione o PDF.
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
                                Arquivo PDF

                                <div className="pdf-picker">
                                    <input
                                        type="file"
                                        accept="application/pdf,.pdf"
                                        onChange={(
                                            event,
                                        ) =>
                                            setArquivo(
                                                event
                                                    .target
                                                    .files?.[0] ??
                                                null,
                                            )
                                        }
                                    />

                                    <Upload
                                        size={21}
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
                                            size={18}
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