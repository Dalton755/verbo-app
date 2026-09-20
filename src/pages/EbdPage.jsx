import {
    useEffect,
    useState,
} from "react";

import {
    ArrowLeft,
    BookOpen,
    CalendarDays,
    ChevronRight,
    MoreVertical,
    Pencil,
    Plus,
    Search,
    Trash2,
    X,
} from "lucide-react";

import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import verboLogoHorizontal from "../assets/verbo-logo-horizontal.png";

function EbdPage() {
    const navigate = useNavigate();
    const { user } = useAuth();

    const [carregando, setCarregando] = useState(true);
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState("");
    const [modalAberto, setModalAberto] = useState(false);
    const [trimestres, setTrimestres] = useState([]);
    const [
        trimestreEditando,
        setTrimestreEditando,
    ] = useState(null);

    const [
        menuTrimestreAberto,
        setMenuTrimestreAberto,
    ] = useState(null);

    const [
        excluindoTrimestre,
        setExcluindoTrimestre,
    ] = useState(null);

    const [form, setForm] = useState({
        numero: "1",
        ano: new Date().getFullYear().toString(),
        tema: "",
    });

    useEffect(() => {
        if (!user) return;

        async function carregarTrimestres() {
            setCarregando(true);
            setErro("");

            const {
                data,
                error,
            } = await supabase
                .from("trimestres")
                .select(`
                    id,
                    numero,
                    ano,
                    tema,
                    created_at
                `)
                .eq(
                    "usuario_id",
                    user.id,
                )
                .order(
                    "ano",
                    {
                        ascending: false,
                    },
                )
                .order(
                    "numero",
                    {
                        ascending: true,
                    },
                );

            if (error) {
                console.error(error);

                setErro(
                    "Não conseguimos carregar sua biblioteca.",
                );

                setCarregando(false);
                return;
            }

            const {
                data: aulasData,
                error: aulasError,
            } = await supabase
                .from("aulas")
                .select(
                    "trimestre_id",
                )
                .eq(
                    "usuario_id",
                    user.id,
                );

            if (aulasError) {
                console.error(
                    "Erro ao contar aulas:",
                    aulasError,
                );
            }

            const quantidadePorTrimestre = {};

            for (
                const aula of
                aulasData ?? []
            ) {
                quantidadePorTrimestre[
                    aula.trimestre_id
                ] =
                    (
                        quantidadePorTrimestre[
                        aula.trimestre_id
                        ] ?? 0
                    ) + 1;
            }

            setTrimestres(
                (data ?? []).map(
                    (item) => ({
                        ...item,

                        aulas:
                            quantidadePorTrimestre[
                            item.id
                            ] ?? 0,
                    }),
                ),
            );

            setCarregando(false);
        }

        carregarTrimestres();
    }, [user]);

    function abrirNovoTrimestre() {
        setTrimestreEditando(
            null,
        );

        setForm({
            numero: "1",

            ano:
                new Date()
                    .getFullYear()
                    .toString(),

            tema: "",
        });

        setErro("");

        setModalAberto(
            true,
        );
    }

    function abrirEdicaoTrimestre(
        trimestre,
    ) {
        setTrimestreEditando(
            trimestre,
        );

        setForm({
            numero:
                String(
                    trimestre.numero,
                ),

            ano:
                String(
                    trimestre.ano,
                ),

            tema:
                trimestre.tema ?? "",
        });

        setErro("");

        setMenuTrimestreAberto(
            null,
        );

        setModalAberto(
            true,
        );
    }

    function atualizarCampo(event) {
        const { name, value } = event.target;

        setForm((anterior) => ({
            ...anterior,
            [name]: value,
        }));
    }

    async function salvarTrimestre(
        event,
    ) {
        event.preventDefault();

        if (
            !form.tema.trim() ||
            !user
        ) {
            return;
        }

        setSalvando(true);
        setErro("");

        let resultado;

        if (trimestreEditando) {
            resultado =
                await supabase
                    .from(
                        "trimestres",
                    )
                    .update({
                        numero:
                            Number(
                                form.numero,
                            ),

                        ano:
                            Number(
                                form.ano,
                            ),

                        tema:
                            form.tema.trim(),
                    })
                    .eq(
                        "id",
                        trimestreEditando.id,
                    )
                    .eq(
                        "usuario_id",
                        user.id,
                    )
                    .select(`
                    id,
                    numero,
                    ano,
                    tema,
                    created_at
                `)
                    .single();
        } else {
            resultado =
                await supabase
                    .from(
                        "trimestres",
                    )
                    .insert({
                        usuario_id:
                            user.id,

                        numero:
                            Number(
                                form.numero,
                            ),

                        ano:
                            Number(
                                form.ano,
                            ),

                        tema:
                            form.tema.trim(),
                    })
                    .select(`
                    id,
                    numero,
                    ano,
                    tema,
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
                "Erro ao salvar trimestre:",
                error,
            );

            if (
                error.code ===
                "23505"
            ) {
                setErro(
                    `O ${form.numero}º trimestre de ${form.ano} já existe.`,
                );
            } else {
                setErro(
                    "Não conseguimos salvar o trimestre.",
                );
            }

            setSalvando(false);
            return;
        }

        if (trimestreEditando) {
            setTrimestres(
                (anteriores) =>
                    anteriores
                        .map(
                            (item) =>
                                item.id ===
                                    data.id
                                    ? {
                                        ...item,
                                        ...data,
                                    }
                                    : item,
                        )
                        .sort(
                            (a, b) => {
                                if (
                                    a.ano !==
                                    b.ano
                                ) {
                                    return (
                                        b.ano -
                                        a.ano
                                    );
                                }

                                return (
                                    a.numero -
                                    b.numero
                                );
                            },
                        ),
            );
        } else {
            setTrimestres(
                (anteriores) => {
                    const novos = [
                        ...anteriores,

                        {
                            ...data,
                            aulas: 0,
                        },
                    ];

                    return novos.sort(
                        (a, b) => {
                            if (
                                a.ano !==
                                b.ano
                            ) {
                                return (
                                    b.ano -
                                    a.ano
                                );
                            }

                            return (
                                a.numero -
                                b.numero
                            );
                        },
                    );
                },
            );
        }

        setModalAberto(false);
        setTrimestreEditando(null);

        setForm({
            numero: "1",

            ano:
                new Date()
                    .getFullYear()
                    .toString(),

            tema: "",
        });

        setSalvando(false);
    }

    async function excluirTrimestre(
        trimestre,
    ) {
        if (
            !user ||
            !trimestre?.id
        ) {
            return;
        }

        const confirmou =
            window.confirm(
                `Excluir "${trimestre.tema}"?\n\nTodas as aulas deste trimestre e seus PDFs serão removidos permanentemente. O espaço ocupado será liberado.`,
            );

        if (!confirmou) {
            return;
        }

        setExcluindoTrimestre(
            trimestre.id,
        );

        setErro("");

        /*
         * Busca todos os PDFs das aulas
         * antes de apagar o trimestre.
         */
        const {
            data: aulasDoTrimestre,
            error: aulasError,
        } = await supabase
            .from("aulas")
            .select(`
            id,
            storage_path
        `)
            .eq(
                "trimestre_id",
                trimestre.id,
            )
            .eq(
                "usuario_id",
                user.id,
            );

        if (aulasError) {
            console.error(
                "Erro ao localizar aulas:",
                aulasError,
            );

            setErro(
                "Não conseguimos localizar as aulas deste trimestre.",
            );

            setExcluindoTrimestre(
                null,
            );

            return;
        }

        const caminhos =
            (
                aulasDoTrimestre ??
                []
            )
                .map(
                    (aula) =>
                        aula.storage_path,
                )
                .filter(Boolean);

        /*
         * Remove os PDFs físicos.
         */
        if (
            caminhos.length > 0
        ) {
            const {
                error:
                storageError,
            } =
                await supabase.storage
                    .from(
                        "biblia-slides-pdfs",
                    )
                    .remove(
                        caminhos,
                    );

            if (storageError) {
                console.error(
                    "Erro ao remover PDFs:",
                    storageError,
                );

                setErro(
                    "Não conseguimos remover os PDFs. O trimestre não foi excluído.",
                );

                setExcluindoTrimestre(
                    null,
                );

                return;
            }
        }

        /*
         * Excluindo o trimestre,
         * o banco exclui as aulas
         * por ON DELETE CASCADE.
         */
        const {
            error:
            trimestreError,
        } = await supabase
            .from("trimestres")
            .delete()
            .eq(
                "id",
                trimestre.id,
            )
            .eq(
                "usuario_id",
                user.id,
            );

        if (trimestreError) {
            console.error(
                "Erro ao excluir trimestre:",
                trimestreError,
            );

            setErro(
                "Os PDFs foram removidos, mas ocorreu um erro ao excluir o trimestre.",
            );

            setExcluindoTrimestre(
                null,
            );

            return;
        }

        setTrimestres(
            (anteriores) =>
                anteriores.filter(
                    (item) =>
                        item.id !==
                        trimestre.id,
                ),
        );

        setMenuTrimestreAberto(
            null,
        );

        setExcluindoTrimestre(
            null,
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
                        onClick={() => navigate("/")}
                    >
                        <ArrowLeft size={18} />
                        Biblioteca
                    </button>

                    <div>
                        <span className="app-kicker">EBD</span>
                        <h1>Seus trimestres</h1>
                    </div>
                </div>


            </header>

            <main className="page-content">
                <section className="welcome">
                    <div>
                        <p className="eyebrow">Organize. Apresente. Ensine.</p>

                        <h2>
                            Sua EBD,
                            <br />
                            organizada para ensinar.
                        </h2>

                        <p className="welcome-text">
                            Organize seus trimestres, importe as aulas em PDF e apresente
                            com referências bíblicas interativas.
                        </p>
                    </div>
                </section>

                <section className="search-area">
                    <Search size={19} />

                    <input
                        type="text"
                        placeholder="Buscar uma aula ou trimestre"
                        aria-label="Buscar"
                    />
                </section>

                {erro && (
                    <div className="library-message">
                        {erro}
                    </div>
                )}

                <section className="section-heading section-heading-row">
                    <div>
                        <span>Biblioteca</span>
                        <h3>Trimestres</h3>
                    </div>

                    {trimestres.length > 0 && (
                        <button
                            className="secondary-button"
                            onClick={
                                abrirNovoTrimestre
                            }
                        >
                            <Plus size={18} />
                            Novo trimestre
                        </button>
                    )}
                </section>

                {carregando ? (
                    <section className="library-loading">
                        <div className="loading-dot" />
                        <p>Buscando suas aulas...</p>
                    </section>
                ) : trimestres.length === 0 ? (
                    <section className="empty-state">
                        <div className="empty-icon">
                            <BookOpen size={28} strokeWidth={1.8} />
                        </div>

                        <h3>Sua biblioteca começa aqui</h3>

                        <p>
                            Crie seu primeiro trimestre para começar a organizar suas aulas.
                        </p>

                        <button
                            className="primary-button"
                            onClick={
                                abrirNovoTrimestre
                            }
                        >
                            <Plus size={19} />
                            Criar primeiro trimestre
                        </button>

                        <button className="text-button">
                            Como funciona
                            <ChevronRight size={17} />
                        </button>
                    </section>
                ) : (
                    <section className="trimestres-grid">
                        {trimestres.map((trimestre) => (
                            <article
                                className="trimestre-card ebd-trimestre-manage"
                                key={
                                    trimestre.id
                                }
                            >
                                <button
                                    type="button"
                                    className="ebd-trimestre-main"
                                    onClick={() =>
                                        navigate(
                                            `/trimestres/${trimestre.id}`,
                                        )
                                    }
                                >
                                    <div className="trimestre-card-icon">
                                        <BookOpen
                                            size={21}
                                        />
                                    </div>

                                    <div className="trimestre-card-content">
                                        <span>
                                            {trimestre.numero}
                                            º trimestre ·{" "}
                                            {trimestre.ano}
                                        </span>

                                        <h3>
                                            {trimestre.tema}
                                        </h3>

                                        <p>
                                            {trimestre.aulas ===
                                                0
                                                ? "Nenhuma aula adicionada"
                                                : `${trimestre.aulas} ${trimestre.aulas ===
                                                    1
                                                    ? "aula"
                                                    : "aulas"
                                                }`}
                                        </p>
                                    </div>

                                    <ChevronRight
                                        size={20}
                                        className="trimestre-arrow"
                                    />
                                </button>

                                <div className="ebd-trimestre-menu-area">
                                    <button
                                        type="button"
                                        className="book-theme-menu-button"
                                        aria-label={`Opções de ${trimestre.tema}`}
                                        onClick={() =>
                                            setMenuTrimestreAberto(
                                                (atual) =>
                                                    atual ===
                                                        trimestre.id
                                                        ? null
                                                        : trimestre.id,
                                            )
                                        }
                                    >
                                        <MoreVertical
                                            size={19}
                                        />
                                    </button>

                                    {menuTrimestreAberto ===
                                        trimestre.id && (
                                            <div className="book-theme-menu">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        abrirEdicaoTrimestre(
                                                            trimestre,
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
                                                        excluindoTrimestre ===
                                                        trimestre.id
                                                    }
                                                    onClick={() =>
                                                        excluirTrimestre(
                                                            trimestre,
                                                        )
                                                    }
                                                >
                                                    <Trash2
                                                        size={16}
                                                    />

                                                    {excluindoTrimestre ===
                                                        trimestre.id
                                                        ? "Excluindo..."
                                                        : "Excluir"}
                                                </button>
                                            </div>
                                        )}
                                </div>
                            </article>
                        ))}
                    </section>
                )}
            </main>

            <div className="mobile-action">
                <button
                    className="primary-button"
                    onClick={
                        abrirNovoTrimestre
                    }
                >
                    <Plus size={19} />
                    Novo trimestre
                </button>
            </div>

            {modalAberto && (
                <div
                    className="modal-overlay"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            setModalAberto(false);
                        }
                    }}
                >
                    <div className="modal-card">
                        <div className="modal-header">
                            <div className="modal-icon">
                                <CalendarDays size={22} />
                            </div>

                            <button
                                className="modal-close"
                                onClick={() => setModalAberto(false)}
                                aria-label="Fechar"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="modal-heading">
                            <h2>
                                {trimestreEditando
                                    ? "Editar trimestre"
                                    : "Criar um trimestre"}
                            </h2>

                            <p>
                                Informe o período e o tema. Depois você poderá começar a
                                adicionar suas aulas.
                            </p>
                        </div>

                        <form className="trimestre-form" onSubmit={salvarTrimestre}>
                            <div className="form-row">
                                <label>
                                    Trimestre

                                    <select
                                        name="numero"
                                        value={form.numero}
                                        onChange={atualizarCampo}
                                    >
                                        <option value="1">1º trimestre</option>
                                        <option value="2">2º trimestre</option>
                                        <option value="3">3º trimestre</option>
                                        <option value="4">4º trimestre</option>
                                    </select>
                                </label>

                                <label>
                                    Ano

                                    <input
                                        name="ano"
                                        type="number"
                                        value={form.ano}
                                        onChange={atualizarCampo}
                                    />
                                </label>
                            </div>

                            <label>
                                Tema do trimestre

                                <input
                                    name="tema"
                                    type="text"
                                    value={form.tema}
                                    onChange={atualizarCampo}
                                    placeholder="Ex.: A Carta aos Romanos"
                                    autoFocus
                                />

                                <small>
                                    Use o título que você já utiliza nas suas aulas.
                                </small>
                            </label>

                            <div className="modal-actions">
                                <button
                                    type="button"
                                    className="secondary-button"
                                    onClick={() => setModalAberto(false)}
                                >
                                    Cancelar
                                </button>

                                <button
                                    type="submit"
                                    className="primary-button"
                                    disabled={!form.tema.trim() || salvando}
                                >
                                    {salvando
                                        ? "Salvando..."
                                        : trimestreEditando
                                            ? "Salvar alterações"
                                            : "Criar trimestre"}

                                    {!salvando && <ChevronRight size={18} />}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default EbdPage;