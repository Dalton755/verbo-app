import {
    useEffect,
    useState,
} from "react";
import {
    ArrowLeft,
    BookOpen,
    ChevronRight,
    Plus,
    Search,
    X,
    CalendarDays,
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

            const { data, error } = await supabase
                .from("trimestres")
                .select(`
          id,
          numero,
          ano,
          tema,
          created_at
        `)
                .eq("usuario_id", user.id)
                .order("ano", {
                    ascending: false,
                })
                .order("numero", {
                    ascending: true,
                });

            if (error) {
                console.error(error);

                setErro(
                    "Não conseguimos carregar sua biblioteca.",
                );

                setCarregando(false);
                return;
            }

            setTrimestres(
                (data ?? []).map((item) => ({
                    ...item,
                    aulas: 0,
                })),
            );

            setCarregando(false);
        }

        carregarTrimestres();
    }, [user]);

    function atualizarCampo(event) {
        const { name, value } = event.target;

        setForm((anterior) => ({
            ...anterior,
            [name]: value,
        }));
    }

    async function criarTrimestre(event) {
        event.preventDefault();

        if (!form.tema.trim() || !user) return;

        setSalvando(true);
        setErro("");

        const { data, error } = await supabase
            .from("trimestres")
            .insert({
                usuario_id: user.id,
                numero: Number(form.numero),
                ano: Number(form.ano),
                tema: form.tema.trim(),
            })
            .select(`
        id,
        numero,
        ano,
        tema,
        created_at
      `)
            .single();

        setSalvando(false);

        if (error) {
            console.error(error);

            if (error.code === "23505") {
                setErro(
                    `O ${form.numero}º trimestre de ${form.ano} já existe.`,
                );

                return;
            }

            setErro(
                "Não conseguimos criar o trimestre. Tente novamente.",
            );

            return;
        }

        setTrimestres((anteriores) => {
            const novos = [
                ...anteriores,
                {
                    ...data,
                    aulas: 0,
                },
            ];

            return novos.sort((a, b) => {
                if (a.ano !== b.ano) {
                    return b.ano - a.ano;
                }

                return a.numero - b.numero;
            });
        });

        setForm({
            numero: "1",
            ano: new Date().getFullYear().toString(),
            tema: "",
        });

        setModalAberto(false);
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
                            onClick={() => setModalAberto(true)}
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
                            onClick={() => setModalAberto(true)}
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
                            <button
                                className="trimestre-card"
                                key={trimestre.id}
                                onClick={() =>
                                    navigate(`/trimestres/${trimestre.id}`)
                                }
                            >
                                <div className="trimestre-card-icon">
                                    <BookOpen size={21} />
                                </div>

                                <div className="trimestre-card-content">
                                    <span>
                                        {trimestre.numero}º trimestre · {trimestre.ano}
                                    </span>

                                    <h3>{trimestre.tema}</h3>

                                    <p>
                                        {trimestre.aulas === 0
                                            ? "Nenhuma aula adicionada"
                                            : `${trimestre.aulas} aulas`}
                                    </p>
                                </div>

                                <ChevronRight size={20} className="trimestre-arrow" />
                            </button>
                        ))}
                    </section>
                )}
            </main>

            <div className="mobile-action">
                <button
                    className="primary-button"
                    onClick={() => setModalAberto(true)}
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
                            <span className="app-kicker">Vamos organizar suas aulas</span>
                            <h2>Criar um trimestre</h2>

                            <p>
                                Informe o período e o tema. Depois você poderá começar a
                                adicionar suas aulas.
                            </p>
                        </div>

                        <form className="trimestre-form" onSubmit={criarTrimestre}>
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
                                    {salvando ? "Criando..." : "Criar trimestre"}

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