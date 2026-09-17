import {
    useEffect,
    useState,
} from "react";

import {
    ArrowLeft,
    ChevronRight,
    FileText,
    Mic2,
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
    processarPdfSermao,
} from "../lib/sermonPdfProcessor";

import {
    salvarSermaoCache,
} from "../lib/sermonCache";

import {
    uploadPdfSeguro,
} from "../lib/uploadPdfSeguro";

import verboLogoHorizontal from "../assets/verbo-logo-horizontal.png";

function SermoesPage() {
    const navigate = useNavigate();

    const { user } = useAuth();

    const [sermoes, setSermoes] =
        useState([]);

    const [series, setSeries] =
        useState([]);

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
            arquivo.type !==
            "application/pdf"
        ) {
            setErro(
                "Selecione um arquivo PDF.",
            );

            return;
        }

        setSalvando(true);
        setErro("");

        let processamento;

        try {
            processamento =
                await processarPdfSermao(
                    arquivo,
                );
        } catch (error) {
            console.error(
                "Erro ao preparar PDF:",
                error,
            );

            setErro(
                "Não conseguimos preparar este PDF para o Modo Pregação.",
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
            `${user.id}/sermoes/${identificador}.pdf`;

        /*
 * Reserva o espaço e envia
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
                tema,
                texto_base,
                serie_id,
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
                "O PDF foi enviado, mas não conseguimos criar o sermão.",
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
                            Importe seus esboços em PDF e
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
                            {series.map(
                                (serie) => (
                                    <button
                                        key={
                                            serie.id
                                        }
                                        type="button"
                                        className="sermon-series-chip"
                                        title={
                                            serie.descricao ||
                                            serie.nome
                                        }
                                    >
                                        {serie.nome}
                                    </button>
                                ),
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
                    <section className="sermons-list">
                        {sermoes.map(
                            (sermao) => (
                                <button
                                    key={
                                        sermao.id
                                    }
                                    type="button"
                                    className="sermon-card"
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
                                                "Sermão"
                                                }`
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
                            ),
                        )}
                    </section>
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

                                    {series.map(
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
                                Arquivo PDF

                                <div className="pdf-picker">
                                    <input
                                        type="file"
                                        accept="application/pdf,.pdf"
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