import {
    useEffect,
    useState,
} from "react";

import {
    ArrowLeft,
    ChevronRight,
    FileText,
    Mic2,
    MoreVertical,
    Plus,
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
    processarArquivoSermao,
} from "../lib/sermonFileProcessor";

import {
    arquivoPermitido,
    formatoArquivo,
    FORMATOS_SUPORTADOS,
} from "../lib/fileFormats";

import {
    limparSermaoCache,
    salvarSermaoCache,
} from "../lib/sermonCache";

import {
    uploadArquivoSeguro,
} from "../lib/uploadArquivoSeguro";

import verboLogoHorizontal from "../assets/verbo-logo-horizontal.png";

function SermoesPage() {
    const navigate = useNavigate();

    const { user } = useAuth();

    const [sermoes, setSermoes] =
        useState([]);

    const [series, setSeries] =
        useState([]);

    const [serieFiltro, setSerieFiltro] =
        useState("TODAS");

    const [modalSerieAberto, setModalSerieAberto] =
        useState(false);

    const [nomeSerie, setNomeSerie] =
        useState("");

    const [descricaoSerie, setDescricaoSerie] =
        useState("");

    const [salvandoSerie, setSalvandoSerie] =
        useState(false);

    const [erroSerie, setErroSerie] =
        useState("");

    const [carregando, setCarregando] =
        useState(true);

    const [modalAberto, setModalAberto] =
        useState(false);

    const [salvando, setSalvando] =
        useState(false);

    const [erro, setErro] =
        useState("");

    const [
        menuSermaoAberto,
        setMenuSermaoAberto,
    ] = useState(null);

    const [
        excluindoSermao,
        setExcluindoSermao,
    ] = useState(null);

    const [titulo, setTitulo] =
        useState("");

    const [tema, setTema] =
        useState("");

    const [textoBase, setTextoBase] =
        useState("");


    const [serieId, setSerieId] =
        useState("");

    const [arquivo, setArquivo] =
        useState(null);

    useEffect(() => {
        if (!user) return;

        async function carregarSermoes() {
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
                    serie_id,
                    arquivo_nome,
                    storage_path,
                    total_paginas,
                    ultima_pagina,
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

            if (error) {
                console.error(error);

                setErro(
                    "Não conseguimos carregar seus sermões.",
                );

                setCarregando(false);
                return;
            }

            setSermoes(
                data ?? [],
            );

            setCarregando(false);
        }

        async function carregarSeries() {
            const {
                data,
                error,
            } = await supabase
                .from("series_sermoes")
                .select(`
                    id,
                    nome,
                    descricao,
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

            if (error) {
                console.error(
                    "Erro ao carregar séries:",
                    error,
                );

                return;
            }

            setSeries(
                data ?? [],
            );
        }

        carregarSermoes();
        carregarSeries();
    }, [user]);

    function abrirNovaSerie() {
        setNomeSerie("");
        setDescricaoSerie("");
        setErroSerie("");

        setModalSerieAberto(true);
    }

    async function criarSerie(event) {
        event.preventDefault();

        if (
            !user ||
            !nomeSerie.trim()
        ) {
            return;
        }

        setSalvandoSerie(true);
        setErroSerie("");

        const {
            data,
            error,
        } = await supabase
            .from("series_sermoes")
            .insert({
                usuario_id:
                    user.id,

                nome:
                    nomeSerie.trim(),

                descricao:
                    descricaoSerie.trim() ||
                    null,
            })
            .select(`
            id,
            nome,
            descricao,
            created_at
        `)
            .single();

        if (error) {
            console.error(
                "Erro ao criar série:",
                error,
            );

            if (
                error.code ===
                "23505"
            ) {
                setErroSerie(
                    "Você já possui uma série com esse nome.",
                );
            } else {
                setErroSerie(
                    "Não conseguimos criar a série agora.",
                );
            }

            setSalvandoSerie(false);
            return;
        }

        setSeries(
            (anteriores) =>
                [...anteriores, data].sort(
                    (a, b) =>
                        a.nome.localeCompare(
                            b.nome,
                            "pt-BR",
                        ),
                ),
        );

        setNomeSerie("");
        setDescricaoSerie("");
        setModalSerieAberto(false);
        setSalvandoSerie(false);
    }

    function abrirImportacao() {
        setTitulo("");
        setTema("");
        setTextoBase("");
        setSerieId("");
        setArquivo(null);

        setModalAberto(true);
    }

    async function importarSermao(event) {
        event.preventDefault();

        if (
            !user ||
            !titulo.trim() ||
            !arquivo
        ) {
            return;
        }

        if (
            !arquivoPermitido(
                arquivo,
                "sermoes",
            )
        ) {
            setErro(
                "Selecione um arquivo PDF ou DOCX.",
            );

            return;
        }

        const formato =
            formatoArquivo(
                arquivo,
            );

        setSalvando(true);
        setErro("");

        let processamento;

        try {
            processamento =
                await processarArquivoSermao(
                    arquivo,
                );
        } catch (error) {
            console.error(
                "Erro ao preparar arquivo:",
                error,
            );

            setErro(
                "Não conseguimos preparar este arquivo para o Modo Pregação.",
            );

            setSalvando(false);
            return;
        }

        const conteudoProcessado = {
            versao:
                processamento.versao,

            formato:
                processamento.formato ??
                formato,

            paginas:
                processamento.paginas,
        };

        const identificador =
            crypto.randomUUID();

        const storagePath =
            `${user.id}/sermoes/${identificador}.${formato}`;

        /*
 * Reserva o espaço e envia
 * o arquivo com quota protegida.
 */
        try {
            await uploadArquivoSeguro({
                arquivo,
                caminho:
                    storagePath,

                formatosPermitidos:
                    FORMATOS_SUPORTADOS
                        .sermoes
                        .extensoes,
            });
        } catch (error) {
            console.error(
                "Erro no upload seguro:",
                error,
            );

            setErro(
                error?.message ||
                "Não conseguimos enviar o arquivo.",
            );

            setSalvando(false);
            return;
        }

        const {
            data,
            error: sermaoError,
        } = await supabase
            .from("sermoes")
            .insert({
                usuario_id:
                    user.id,

                titulo:
                    titulo.trim(),

                tema:
                    tema.trim() ||
                    null,

                texto_base:
                    textoBase.trim() ||
                    null,

                serie_id:
                    serieId ||
                    null,

                arquivo_nome:
                    arquivo.name,

                arquivo_tipo:
                    formato,

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
                    processamento
                        .versao ?? 1,
            })
            .select(`
                id,
                titulo,
                tema,
                texto_base,
                serie_id,
                arquivo_nome,
                arquivo_tipo,
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

        if (sermaoError) {
            console.error(
                sermaoError,
            );

            await supabase.storage
                .from(
                    "biblia-slides-pdfs",
                )
                .remove([
                    storagePath,
                ]);

            setErro(
                "O arquivo foi enviado, mas não conseguimos criar o sermão.",
            );

            setSalvando(false);
            return;
        }

        /*
 * O sermão acabou de ser processado.
 * Já deixamos tudo em memória para
 * a primeira abertura ser imediata.
 */
        salvarSermaoCache(
            data.id,
            {
                sermao:
                    data,

                paginas:
                    conteudoProcessado
                        .paginas,
            },
        );

        setSermoes(
            (anteriores) => [
                data,
                ...anteriores,
            ],
        );

        setModalAberto(false);

        setTitulo("");
        setTema("");
        setTextoBase("");
        setSerieId("");
        setArquivo(null);

        setSalvando(false);
    }

    async function excluirSermao(
        sermao,
    ) {
        if (
            !user ||
            !sermao?.id
        ) {
            return;
        }

        const confirmou =
            window.confirm(
                `Excluir "${sermao.titulo}"?\n\nO sermão e o arquivo serão removidos permanentemente. O espaço ocupado será liberado.`,
            );

        if (!confirmou) {
            return;
        }

        setExcluindoSermao(
            sermao.id,
        );

        setErro("");

        /*
         * 1. Remove o PDF do Storage.
         */
        if (sermao.storage_path) {
            const {
                error:
                storageError,
            } =
                await supabase.storage
                    .from(
                        "biblia-slides-pdfs",
                    )
                    .remove([
                        sermao.storage_path,
                    ]);

            if (storageError) {
                console.error(
                    "Erro ao remover arquivo do sermão:",
                    storageError,
                );

                setErro(
                    "Não conseguimos remover o arquivo. O sermão não foi excluído.",
                );

                setExcluindoSermao(
                    null,
                );

                return;
            }
        }

        /*
         * 2. Remove o registro do banco.
         */
        const {
            error:
            sermaoError,
        } = await supabase
            .from("sermoes")
            .delete()
            .eq(
                "id",
                sermao.id,
            )
            .eq(
                "usuario_id",
                user.id,
            );

        if (sermaoError) {
            console.error(
                "Erro ao excluir sermão:",
                sermaoError,
            );

            setErro(
                "O arquivo foi removido, mas ocorreu um erro ao excluir o sermão do banco.",
            );

            setExcluindoSermao(
                null,
            );

            return;
        }

        limparSermaoCache(
            sermao.id,
        );

        setSermoes(
            (anteriores) =>
                anteriores.filter(
                    (item) =>
                        item.id !==
                        sermao.id,
                ),
        );

        setMenuSermaoAberto(
            null,
        );

        setExcluindoSermao(
            null,
        );
    }

    function nomeDaSerie(serieIdAtual) {
        if (!serieIdAtual) {
            return "";
        }

        return (
            series.find(
                (serie) =>
                    serie.id ===
                    serieIdAtual,
            )?.nome ?? ""
        );
    }

    const sermoesFiltrados =
        serieFiltro === "TODAS"
            ? sermoes
            : sermoes.filter(
                (sermao) =>
                    sermao.serie_id ===
                    serieFiltro,
            );

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
                        <ArrowLeft size={18} />
                        Biblioteca
                    </button>

                    <div>
                        <span className="app-kicker">
                            Sermões
                        </span>

                        <h1>
                            Seus sermões
                        </h1>
                    </div>
                </div>
            </header>

            <main className="page-content module-page">
                <section className="sermons-heading">
                    <div className="module-page-intro">
                        <p className="eyebrow">
                            Prepare. Pregue. Continue.
                        </p>

                        <h2>
                            Seus sermões prontos
                            para o púlpito.
                        </h2>

                        <p>
                            Importe seus esboços em PDF ou DOCX e
                            use uma experiência preparada
                            especificamente para pregação.
                        </p>
                    </div>

                    <div className="sermons-heading-actions">
                        <button
                            type="button"
                            className="secondary-button"
                            onClick={
                                abrirNovaSerie
                            }
                        >
                            <Plus size={17} />
                            Nova série
                        </button>

                        {sermoes.length > 0 && (
                            <button
                                type="button"
                                className="primary-button desktop-import-button"
                                onClick={
                                    abrirImportacao
                                }
                            >
                                <Plus size={18} />
                                Novo sermão
                            </button>
                        )}
                    </div>
                </section>

                {series.length > 0 && (
                    <section className="sermon-series-preview">
                        <div className="sermon-series-preview-heading">
                            <span>
                                Suas séries
                            </span>

                            <strong>
                                {series.length}
                            </strong>
                        </div>

                        <div className="sermon-series-chips">
                            <button
                                type="button"
                                className={`sermon-series-chip ${serieFiltro === "TODAS"
                                    ? "sermon-series-chip-active"
                                    : ""
                                    }`}
                                onClick={() =>
                                    setSerieFiltro("TODAS")
                                }
                            >
                                Todos
                            </button>

                            {series.map(
                                (serie) => {
                                    const quantidade =
                                        sermoes.filter(
                                            (sermao) =>
                                                sermao.serie_id ===
                                                serie.id,
                                        ).length;

                                    return (
                                        <button
                                            key={serie.id}
                                            type="button"
                                            className={`sermon-series-chip ${serieFiltro ===
                                                serie.id
                                                ? "sermon-series-chip-active"
                                                : ""
                                                }`}
                                            title={
                                                serie.descricao ||
                                                serie.nome
                                            }
                                            onClick={() =>
                                                setSerieFiltro(
                                                    serie.id,
                                                )
                                            }
                                        >
                                            <span>
                                                {serie.nome}
                                            </span>

                                            <strong>
                                                {quantidade}
                                            </strong>
                                        </button>
                                    );
                                },
                            )}
                        </div>
                    </section>
                )}

                {erro && (
                    <div className="library-message">
                        {erro}
                    </div>
                )}

                {carregando ? (
                    <section className="library-loading">
                        <div className="loading-dot" />

                        <p>
                            Buscando seus sermões...
                        </p>
                    </section>
                ) : sermoes.length === 0 ? (
                    <section className="module-empty">
                        <div className="empty-icon">
                            <Mic2 size={28} />
                        </div>

                        <h3>
                            Seu primeiro sermão
                            começa aqui
                        </h3>

                        <p>
                            Importe o PDF que você já
                            utiliza. Depois vamos
                            prepará-lo para o Modo
                            Pregação.
                        </p>

                        <button
                            className="primary-button sermon-first-button"
                            onClick={
                                abrirImportacao
                            }
                        >
                            <Upload size={18} />
                            Importar sermão
                        </button>
                    </section>
                ) : (
                    <>
                        {sermoesFiltrados.length === 0 ? (
                            <section className="module-empty">
                                <div className="empty-icon">
                                    <Mic2 size={28} />
                                </div>

                                <h3>
                                    Nenhum sermão nesta série
                                </h3>

                                <p>
                                    Adicione um novo sermão
                                    ou escolha outra série.
                                </p>

                                <button
                                    type="button"
                                    className="secondary-button"
                                    onClick={() =>
                                        setSerieFiltro(
                                            "TODAS",
                                        )
                                    }
                                >
                                    Ver todos os sermões
                                </button>
                            </section>
                        ) : (
                            <section className="sermons-list">
                                {sermoesFiltrados.map(
                                    (sermao) => (
                                        <article
                                            key={
                                                sermao.id
                                            }
                                            className="sermon-card sermon-card-manage"
                                        >
                                            <button
                                                type="button"
                                                className="sermon-card-main"
                                                onClick={() =>
                                                    navigate(
                                                        `/sermoes/${sermao.id}`,
                                                    )
                                                }
                                            >
                                                <div className="sermon-card-icon">
                                                    <FileText
                                                        size={21}
                                                    />
                                                </div>

                                                <div className="sermon-card-content">
                                                    <span>
                                                        {nomeDaSerie(
                                                            sermao.serie_id,
                                                        )
                                                            ? `${nomeDaSerie(
                                                                sermao.serie_id,
                                                            )} · ${sermao.tema ||
                                                            "Sermão"}`
                                                            : sermao.tema ||
                                                            "Sermão"}
                                                    </span>

                                                    <h3>
                                                        {sermao.titulo}
                                                    </h3>

                                                    <p>
                                                        {sermao.texto_base
                                                            ? `Texto base: ${sermao.texto_base}`
                                                            : sermao.arquivo_nome}
                                                    </p>
                                                </div>

                                                <ChevronRight
                                                    size={20}
                                                    className="module-card-arrow-inline"
                                                />
                                            </button>

                                            <div className="sermon-item-menu-area">
                                                <button
                                                    type="button"
                                                    className="book-theme-menu-button"
                                                    aria-label={`Opções de ${sermao.titulo}`}
                                                    onClick={() =>
                                                        setMenuSermaoAberto(
                                                            (atual) =>
                                                                atual ===
                                                                    sermao.id
                                                                    ? null
                                                                    : sermao.id,
                                                        )
                                                    }
                                                >
                                                    <MoreVertical
                                                        size={19}
                                                    />
                                                </button>

                                                {menuSermaoAberto ===
                                                    sermao.id && (
                                                        <div className="book-theme-menu">
                                                            <button
                                                                type="button"
                                                                className="danger"
                                                                disabled={
                                                                    excluindoSermao ===
                                                                    sermao.id
                                                                }
                                                                onClick={() =>
                                                                    excluirSermao(
                                                                        sermao,
                                                                    )
                                                                }
                                                            >
                                                                <Trash2
                                                                    size={16}
                                                                />

                                                                {excluindoSermao ===
                                                                    sermao.id
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
                        )}
                    </>
                )}
            </main>

            <div className="mobile-action">
                <button
                    className="primary-button"
                    onClick={
                        abrirImportacao
                    }
                >
                    <Plus size={19} />
                    Novo sermão
                </button>
            </div>

            {modalAberto && (
                <div
                    className="modal-overlay"
                    onMouseDown={(
                        event,
                    ) => {
                        if (
                            event.target ===
                            event.currentTarget &&
                            !salvando
                        ) {
                            setModalAberto(
                                false,
                            );
                        }
                    }}
                >
                    <div className="modal-card">
                        <div className="modal-header">
                            <div className="modal-icon">
                                <Mic2 size={22} />
                            </div>

                            <button
                                className="modal-close"
                                type="button"
                                onClick={() =>
                                    setModalAberto(
                                        false,
                                    )
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
                                Novo sermão
                            </span>

                            <h2>
                                Importe seu esboço
                            </h2>

                            <p>
                                Só precisamos das
                                informações principais.
                                O restante fica por conta
                                do seu PDF.
                            </p>
                        </div>

                        <form
                            className="trimestre-form"
                            onSubmit={
                                importarSermao
                            }
                        >
                            <label>
                                Título do sermão

                                <input
                                    type="text"
                                    value={titulo}
                                    onChange={(
                                        event,
                                    ) =>
                                        setTitulo(
                                            event.target
                                                .value,
                                        )
                                    }
                                    placeholder="Ex.: A graça que nos alcança"
                                    autoFocus
                                />
                            </label>

                            <label>
                                Tema
                                <span className="optional-field">
                                    Opcional
                                </span>

                                <input
                                    type="text"
                                    value={tema}
                                    onChange={(
                                        event,
                                    ) =>
                                        setTema(
                                            event.target
                                                .value,
                                        )
                                    }
                                    placeholder="Ex.: Graça"
                                />
                            </label>

                            <label>
                                Texto base
                                <span className="optional-field">
                                    Opcional
                                </span>

                                <input
                                    type="text"
                                    value={
                                        textoBase
                                    }
                                    onChange={(
                                        event,
                                    ) =>
                                        setTextoBase(
                                            event.target
                                                .value,
                                        )
                                    }
                                    placeholder="Ex.: Romanos 5:8"
                                />
                            </label>

                            <div className="form-field">
                                <label htmlFor="sermon-series">
                                    Série
                                </label>

                                <select
                                    id="sermon-series"
                                    value={serieId}
                                    onChange={(event) =>
                                        setSerieId(
                                            event.target.value,
                                        )
                                    }
                                >
                                    <option value="">
                                        Sem série
                                    </option>

                                    {sermoesFiltrados.map(
                                        (serie) => (
                                            <option
                                                key={serie.id}
                                                value={serie.id}
                                            >
                                                {serie.nome}
                                            </option>
                                        ),
                                    )}
                                </select>

                                <small>
                                    Opcional. Agrupe sermões que fazem
                                    parte de uma mesma sequência.
                                </small>
                            </div>

                            <label>
                                Arquivo PDF ou DOCX

                                <div className="pdf-picker">
                                    <input
                                        type="file"
                                        accept={
                                            FORMATOS_SUPORTADOS
                                                .sermoes
                                                .accept
                                        }
                                        onClick={(event) => {
                                            event.currentTarget.value = "";
                                        }}
                                        onChange={(
                                            event,
                                        ) =>
                                            setArquivo(
                                                event.target
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
                                                : "Selecionar PDF ou DOCX"}
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
                                    onClick={() =>
                                        setModalAberto(
                                            false,
                                        )
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
                                        ? "Preparando sermão..."
                                        : "Adicionar sermão"}

                                    {!salvando && (
                                        <ChevronRight
                                            size={18}
                                        />
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {modalSerieAberto && (
                <div
                    className="modal-overlay"
                    onMouseDown={(
                        event,
                    ) => {
                        if (
                            event.target ===
                            event.currentTarget &&
                            !salvandoSerie
                        ) {
                            setModalSerieAberto(
                                false,
                            );
                        }
                    }}
                >
                    <div className="modal-card sermon-series-modal">
                        <div className="modal-header">
                            <div className="modal-icon">
                                <FileText size={22} />
                            </div>

                            <button
                                className="modal-close"
                                type="button"
                                onClick={() =>
                                    setModalSerieAberto(
                                        false,
                                    )
                                }
                                disabled={
                                    salvandoSerie
                                }
                                aria-label="Fechar"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="modal-heading">
                            <span className="app-kicker">
                                Organização
                            </span>

                            <h2>
                                Nova série
                            </h2>

                            <p>
                                Agrupe sermões relacionados
                                em uma mesma série.
                            </p>
                        </div>

                        <form
                            className="trimestre-form"
                            onSubmit={
                                criarSerie
                            }
                        >
                            <label>
                                Nome da série

                                <input
                                    type="text"
                                    value={
                                        nomeSerie
                                    }
                                    onChange={(
                                        event,
                                    ) =>
                                        setNomeSerie(
                                            event.target
                                                .value,
                                        )
                                    }
                                    placeholder="Ex.: Efésios"
                                    autoFocus
                                    required
                                />
                            </label>

                            <label>
                                Descrição

                                <span className="optional-field">
                                    Opcional
                                </span>

                                <input
                                    type="text"
                                    value={
                                        descricaoSerie
                                    }
                                    onChange={(
                                        event,
                                    ) =>
                                        setDescricaoSerie(
                                            event.target
                                                .value,
                                        )
                                    }
                                    placeholder="Ex.: Série expositiva em Efésios"
                                />
                            </label>

                            {erroSerie && (
                                <div className="library-message">
                                    {erroSerie}
                                </div>
                            )}

                            <div className="modal-actions">
                                <button
                                    type="button"
                                    className="secondary-button"
                                    onClick={() =>
                                        setModalSerieAberto(
                                            false,
                                        )
                                    }
                                    disabled={
                                        salvandoSerie
                                    }
                                >
                                    Cancelar
                                </button>

                                <button
                                    type="submit"
                                    className="primary-button"
                                    disabled={
                                        salvandoSerie ||
                                        !nomeSerie.trim()
                                    }
                                >
                                    {salvandoSerie
                                        ? "Criando..."
                                        : "Criar série"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default SermoesPage;