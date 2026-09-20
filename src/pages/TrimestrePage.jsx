import {
    useEffect,
    useMemo,
    useState,
} from "react";

import {
    ArrowLeft,
    BookOpen,
    ChevronRight,
    FileText,
    MoreVertical,
    Pencil,
    Plus,
    Trash2,
    Upload,
    X,
} from "lucide-react";

import {
    useNavigate,
    useParams,
} from "react-router-dom";

import { supabase } from "../lib/supabase";
import { uploadPdfSeguro } from "../lib/uploadPdfSeguro";
import { useAuth } from "../contexts/AuthContext";


function TrimestrePage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const { user } = useAuth();


    const [trimestre, setTrimestre] = useState(null);
    const [aulas, setAulas] = useState([]);

    const [carregando, setCarregando] = useState(true);
    const [modalAberto, setModalAberto] = useState(false);
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState("");

    const [numero, setNumero] = useState("1");
    const [titulo, setTitulo] = useState("");
    const [arquivo, setArquivo] = useState(null);

    const [
        aulaEditando,
        setAulaEditando,
    ] = useState(null);

    const [
        modalEditarAulaAberto,
        setModalEditarAulaAberto,
    ] = useState(false);

    const [
        numeroAulaEditando,
        setNumeroAulaEditando,
    ] = useState("");

    const [
        tituloAulaEditando,
        setTituloAulaEditando,
    ] = useState("");

    const [
        salvandoAulaEditada,
        setSalvandoAulaEditada,
    ] = useState(false);

    const [
        menuAulaAberto,
        setMenuAulaAberto,
    ] = useState(null);

    const [
        excluindoAula,
        setExcluindoAula,
    ] = useState(null);

    const [
        erroGerenciarAula,
        setErroGerenciarAula,
    ] = useState("");



    const [totalAulasUsuario, setTotalAulasUsuario] =
        useState(0);

    const [upgradeAberto, setUpgradeAberto] =
        useState(false);

    const [mensagemCheckout, setMensagemCheckout] =
        useState("");

    const proximoNumero = useMemo(() => {
        if (aulas.length === 0) return 1;

        return Math.max(
            ...aulas.map((aula) => Number(aula.numero)),
        ) + 1;
    }, [aulas]);



    useEffect(() => {
        if (!user || !id) return;

        async function carregar() {
            setCarregando(true);
            setErro("");

            const [
                trimestreResult,
                aulasResult,
                totalResult,
            ] = await Promise.all([
                supabase
                    .from("trimestres")
                    .select(`
                        id,
                        numero,
                        ano,
                        tema
                    `)
                    .eq("id", id)
                    .eq("usuario_id", user.id)
                    .single(),

                supabase
                    .from("aulas")
                    .select(`
                        id,
                        numero,
                        titulo,
                        arquivo_nome,
                        storage_path,
                        total_paginas,
                        created_at
                    `)
                    .eq("trimestre_id", id)
                    .eq("usuario_id", user.id)
                    .order("numero", {
                        ascending: true,
                    }),


                supabase
                    .from("aulas")
                    .select("id", {
                        count: "exact",
                        head: true,
                    })
                    .eq("usuario_id", user.id),
            ]);

            if (trimestreResult.error) {
                console.error(trimestreResult.error);
                setErro("Não conseguimos abrir este trimestre.");
                setCarregando(false);
                return;
            }

            if (aulasResult.error) {
                console.error(aulasResult.error);
                setErro("Não conseguimos carregar suas aulas.");
                setCarregando(false);
                return;
            }

            setTrimestre(trimestreResult.data);
            setAulas(aulasResult.data ?? []);



            setTotalAulasUsuario(
                totalResult.count ?? 0,
            );

            setCarregando(false);
        }

        carregar();
    }, [id, user]);

    function abrirEdicaoAula(
        aula,
    ) {
        setAulaEditando(
            aula,
        );

        setNumeroAulaEditando(
            String(
                aula.numero,
            ),
        );

        setTituloAulaEditando(
            aula.titulo ?? "",
        );

        setErroGerenciarAula("");

        setMenuAulaAberto(
            null,
        );

        setModalEditarAulaAberto(
            true,
        );
    }

    async function salvarEdicaoAula(
        event,
    ) {
        event.preventDefault();

        if (
            !user ||
            !aulaEditando?.id ||
            !tituloAulaEditando.trim() ||
            !numeroAulaEditando
        ) {
            return;
        }

        setSalvandoAulaEditada(
            true,
        );

        setErroGerenciarAula("");

        const {
            data,
            error,
        } = await supabase
            .from("aulas")
            .update({
                numero:
                    Number(
                        numeroAulaEditando,
                    ),

                titulo:
                    tituloAulaEditando.trim(),
            })
            .eq(
                "id",
                aulaEditando.id,
            )
            .eq(
                "usuario_id",
                user.id,
            )
            .select(`
            id,
            numero,
            titulo,
            arquivo_nome,
            storage_path,
            total_paginas,
            created_at
        `)
            .single();

        if (error) {
            console.error(
                "Erro ao editar aula:",
                error,
            );

            if (
                error.code ===
                "23505"
            ) {
                setErroGerenciarAula(
                    `A aula ${numeroAulaEditando} já existe neste trimestre.`,
                );
            } else {
                setErroGerenciarAula(
                    "Não conseguimos salvar as alterações.",
                );
            }

            setSalvandoAulaEditada(
                false,
            );

            return;
        }

        setAulas(
            (anteriores) =>
                anteriores
                    .map(
                        (aula) =>
                            aula.id ===
                                data.id
                                ? data
                                : aula,
                    )
                    .sort(
                        (a, b) =>
                            Number(
                                a.numero,
                            ) -
                            Number(
                                b.numero,
                            ),
                    ),
        );

        setModalEditarAulaAberto(
            false,
        );

        setAulaEditando(
            null,
        );

        setNumeroAulaEditando("");
        setTituloAulaEditando("");

        setSalvandoAulaEditada(
            false,
        );
    }

    async function salvarEdicaoAula(
        event,
    ) {
        event.preventDefault();

        if (
            !user ||
            !aulaEditando?.id ||
            !tituloAulaEditando.trim() ||
            !numeroAulaEditando
        ) {
            return;
        }

        setSalvandoAulaEditada(
            true,
        );

        setErroGerenciarAula("");

        const {
            data,
            error,
        } = await supabase
            .from("aulas")
            .update({
                numero:
                    Number(
                        numeroAulaEditando,
                    ),

                titulo:
                    tituloAulaEditando.trim(),
            })
            .eq(
                "id",
                aulaEditando.id,
            )
            .eq(
                "usuario_id",
                user.id,
            )
            .select(`
            id,
            numero,
            titulo,
            arquivo_nome,
            storage_path,
            total_paginas,
            created_at
        `)
            .single();

        if (error) {
            console.error(
                "Erro ao editar aula:",
                error,
            );

            if (
                error.code ===
                "23505"
            ) {
                setErroGerenciarAula(
                    `A aula ${numeroAulaEditando} já existe neste trimestre.`,
                );
            } else {
                setErroGerenciarAula(
                    "Não conseguimos salvar as alterações.",
                );
            }

            setSalvandoAulaEditada(
                false,
            );

            return;
        }

        setAulas(
            (anteriores) =>
                anteriores
                    .map(
                        (aula) =>
                            aula.id ===
                                data.id
                                ? data
                                : aula,
                    )
                    .sort(
                        (a, b) =>
                            Number(
                                a.numero,
                            ) -
                            Number(
                                b.numero,
                            ),
                    ),
        );

        setModalEditarAulaAberto(
            false,
        );

        setAulaEditando(
            null,
        );

        setNumeroAulaEditando("");
        setTituloAulaEditando("");

        setSalvandoAulaEditada(
            false,
        );
    }

    async function excluirAula(
        aula,
    ) {
        if (
            !user ||
            !aula?.id
        ) {
            return;
        }

        const confirmou =
            window.confirm(
                `Excluir a aula ${aula.numero} — "${aula.titulo}"?\n\nA aula e o PDF serão removidos permanentemente. O espaço ocupado será liberado.`,
            );

        if (!confirmou) {
            return;
        }

        setExcluindoAula(
            aula.id,
        );

        setErro("");

        /*
         * 1. Remove o PDF físico.
         */
        if (aula.storage_path) {
            const {
                error:
                storageError,
            } =
                await supabase.storage
                    .from(
                        "biblia-slides-pdfs",
                    )
                    .remove([
                        aula.storage_path,
                    ]);

            if (storageError) {
                console.error(
                    "Erro ao excluir PDF da aula:",
                    storageError,
                );

                setErro(
                    "Não conseguimos remover o PDF. A aula não foi excluída.",
                );

                setExcluindoAula(
                    null,
                );

                return;
            }
        }

        /*
         * 2. Remove a aula do banco.
         */
        const {
            error:
            aulaError,
        } = await supabase
            .from("aulas")
            .delete()
            .eq(
                "id",
                aula.id,
            )
            .eq(
                "usuario_id",
                user.id,
            );

        if (aulaError) {
            console.error(
                "Erro ao excluir aula:",
                aulaError,
            );

            setErro(
                "O PDF foi removido, mas ocorreu um erro ao excluir a aula do banco.",
            );

            setExcluindoAula(
                null,
            );

            return;
        }

        setAulas(
            (anteriores) =>
                anteriores.filter(
                    (item) =>
                        item.id !==
                        aula.id,
                ),
        );

        setTotalAulasUsuario(
            (total) =>
                Math.max(
                    0,
                    total - 1,
                ),
        );

        setMenuAulaAberto(
            null,
        );

        setExcluindoAula(
            null,
        );
    }

    function abrirImportacao() {
        setErro("");

        setNumero(String(proximoNumero));
        setTitulo("");
        setArquivo(null);
        setModalAberto(true);
    }

    async function importarAula(event) {
        event.preventDefault();

        if (
            !user ||
            !trimestre ||
            !titulo.trim() ||
            !arquivo
        ) {
            return;
        }

        if (arquivo.type !== "application/pdf") {
            setErro("Selecione um arquivo PDF.");
            return;
        }

        setSalvando(true);
        setErro("");

        const identificador = crypto.randomUUID();

        const storagePath =
            `${user.id}/${trimestre.id}/${identificador}.pdf`;

        /*
 * Reserva o espaço e envia
 * o PDF com quota protegida.
 */
        try {
            await uploadPdfSeguro({
                arquivo,
                caminho: storagePath,
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
            error: aulaError,
        } = await supabase
            .from("aulas")
            .insert({
                usuario_id: user.id,
                trimestre_id: trimestre.id,
                numero: Number(numero),
                titulo: titulo.trim(),
                arquivo_nome: arquivo.name,
                storage_path: storagePath,
            })
            .select(`
                id,
                numero,
                titulo,
                arquivo_nome,
                storage_path,
                total_paginas,
                created_at
            `)
            .single();

        if (aulaError) {
            console.error(aulaError);

            /*
             * O PDF já foi enviado e confirmado,
             * mas a aula não foi criada.
             * Portanto removemos o arquivo.
             */
            await supabase.storage
                .from("biblia-slides-pdfs")
                .remove([storagePath]);



            if (aulaError.code === "23505") {
                setErro(
                    `A aula ${numero} já existe neste trimestre.`,
                );
            } else {
                setErro(
                    "O PDF foi enviado, mas não conseguimos criar a aula.",
                );
            }



            setSalvando(false);
            return;
        }

        setAulas((anteriores) =>
            [...anteriores, data].sort(
                (a, b) => a.numero - b.numero,
            ),

        );

        setTotalAulasUsuario(
            (total) => total + 1,
        );

        setModalAberto(false);
        setSalvando(false);

        setTitulo("");
        setArquivo(null);
    }

    if (carregando) {
        return (
            <div className="loading-page">
                <div className="loading-dot" />
                <p>Abrindo seu trimestre...</p>
            </div>
        );
    }

    return (
        <div className="app">
            <header className="topbar trimestre-topbar">
                <button
                    className="back-button"
                    onClick={() => navigate("/")}
                >
                    <ArrowLeft size={19} />
                    Biblioteca
                </button>

                <span className="trimestre-topbar-periodo">
                    {trimestre?.numero}º trimestre · {trimestre?.ano}
                </span>
            </header>

            <main className="page-content trimestre-page">
                <section className="trimestre-hero">
                    <div>
                        <p className="eyebrow">
                            {trimestre?.numero}º trimestre · {trimestre?.ano}
                        </p>

                        <h1>{trimestre?.tema}</h1>

                        <p>
                            {aulas.length === 0
                                ? "Seu trimestre está pronto. Agora adicione sua primeira aula."
                                : `${aulas.length} ${aulas.length === 1 ? "aula organizada" : "aulas organizadas"
                                } neste trimestre.`}
                        </p>
                    </div>

                    {aulas.length > 0 && (
                        <button
                            className="primary-button desktop-import-button"
                            onClick={abrirImportacao}
                        >
                            <Plus size={18} />
                            Importar aula
                        </button>
                    )}
                </section>

                {erro && (
                    <div className="library-message">
                        {erro}
                    </div>
                )}

                {aulas.length === 0 ? (
                    <section className="empty-state trimestre-empty-state">
                        <div className="empty-icon">
                            <Upload size={27} strokeWidth={1.8} />
                        </div>

                        <h3>Adicione sua primeira aula</h3>

                        <p>
                            Selecione o PDF que você já utiliza. Nós cuidaremos da
                            organização e da apresentação.
                        </p>

                        <button
                            className="primary-button"
                            onClick={abrirImportacao}
                        >
                            <Upload size={18} />
                            Importar PDF
                        </button>
                    </section>
                ) : (
                    <section className="aulas-list">
                        {aulas.map((aula) => (
                            <article
                                key={
                                    aula.id
                                }
                                className="aula-card aula-card-manage"
                            >
                                <button
                                    type="button"
                                    className="aula-card-main"
                                    onClick={() =>
                                        navigate(
                                            `/aulas/${aula.id}/apresentar`,
                                        )
                                    }
                                >
                                    <div className="aula-numero">
                                        {String(
                                            aula.numero,
                                        ).padStart(
                                            2,
                                            "0",
                                        )}
                                    </div>

                                    <div className="aula-icon">
                                        <FileText
                                            size={21}
                                        />
                                    </div>

                                    <div className="aula-content">
                                        <span>
                                            Aula{" "}
                                            {aula.numero}
                                        </span>

                                        <h3>
                                            {aula.titulo}
                                        </h3>

                                        <p>
                                            {aula.arquivo_nome}
                                        </p>
                                    </div>

                                    <ChevronRight
                                        size={20}
                                        className="trimestre-arrow"
                                    />
                                </button>

                                <div className="aula-menu-area">
                                    <button
                                        type="button"
                                        className="book-theme-menu-button"
                                        aria-label={`Opções da aula ${aula.numero}`}
                                        onClick={() =>
                                            setMenuAulaAberto(
                                                (atual) =>
                                                    atual ===
                                                        aula.id
                                                        ? null
                                                        : aula.id,
                                            )
                                        }
                                    >
                                        <MoreVertical
                                            size={19}
                                        />
                                    </button>

                                    {menuAulaAberto ===
                                        aula.id && (
                                            <div className="book-theme-menu">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        abrirEdicaoAula(
                                                            aula,
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
                                                        excluindoAula ===
                                                        aula.id
                                                    }
                                                    onClick={() =>
                                                        excluirAula(
                                                            aula,
                                                        )
                                                    }
                                                >
                                                    <Trash2
                                                        size={16}
                                                    />

                                                    {excluindoAula ===
                                                        aula.id
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
                    onClick={abrirImportacao}
                >
                    <Plus size={19} />
                    Importar aula
                </button>
            </div>

            {modalEditarAulaAberto && (
                <div
                    className="modal-overlay"
                    onMouseDown={(
                        event,
                    ) => {
                        if (
                            event.target ===
                            event.currentTarget &&
                            !salvandoAulaEditada
                        ) {
                            setModalEditarAulaAberto(
                                false,
                            );
                        }
                    }}
                >
                    <div className="modal-card">
                        <div className="modal-header">
                            <div className="modal-icon">
                                <FileText
                                    size={22}
                                />
                            </div>

                            <button
                                type="button"
                                className="modal-close"
                                disabled={
                                    salvandoAulaEditada
                                }
                                onClick={() =>
                                    setModalEditarAulaAberto(
                                        false,
                                    )
                                }
                                aria-label="Fechar"
                            >
                                <X
                                    size={20}
                                />
                            </button>
                        </div>

                        <div className="modal-heading">
                            <span className="app-kicker">
                                Aula
                            </span>

                            <h2>
                                Editar aula
                            </h2>

                            <p>
                                Altere o número ou o título da aula.
                            </p>
                        </div>

                        <form
                            className="trimestre-form"
                            onSubmit={
                                salvarEdicaoAula
                            }
                        >
                            <div className="form-row aula-form-row">
                                <label>
                                    Número da aula

                                    <input
                                        type="number"
                                        min="1"
                                        value={
                                            numeroAulaEditando
                                        }
                                        onChange={(
                                            event,
                                        ) =>
                                            setNumeroAulaEditando(
                                                event
                                                    .target
                                                    .value,
                                            )
                                        }
                                    />
                                </label>

                                <label className="titulo-aula-field">
                                    Título

                                    <input
                                        type="text"
                                        value={
                                            tituloAulaEditando
                                        }
                                        onChange={(
                                            event,
                                        ) =>
                                            setTituloAulaEditando(
                                                event
                                                    .target
                                                    .value,
                                            )
                                        }
                                        autoFocus
                                    />
                                </label>
                            </div>

                            {erroGerenciarAula && (
                                <div className="library-message">
                                    {
                                        erroGerenciarAula
                                    }
                                </div>
                            )}

                            <div className="modal-actions">
                                <button
                                    type="button"
                                    className="secondary-button"
                                    disabled={
                                        salvandoAulaEditada
                                    }
                                    onClick={() =>
                                        setModalEditarAulaAberto(
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
                                        salvandoAulaEditada ||
                                        !tituloAulaEditando.trim() ||
                                        !numeroAulaEditando
                                    }
                                >
                                    {salvandoAulaEditada
                                        ? "Salvando..."
                                        : "Salvar alterações"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {modalAberto && (
                <div
                    className="modal-overlay"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget && !salvando) {
                            setModalAberto(false);
                        }
                    }}
                >
                    <div className="modal-card">
                        <div className="modal-header">
                            <div className="modal-icon">
                                <BookOpen size={22} />
                            </div>

                            <button
                                className="modal-close"
                                onClick={() => setModalAberto(false)}
                                disabled={salvando}
                                aria-label="Fechar"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="modal-heading">
                            <span className="app-kicker">
                                Adicionar uma aula
                            </span>

                            <h2>Importe seu PDF</h2>

                            <p>
                                Informe o título da aula e selecione o material que deseja
                                apresentar.
                            </p>
                        </div>

                        <form
                            className="trimestre-form"
                            onSubmit={importarAula}
                        >
                            <div className="form-row aula-form-row">
                                <label>
                                    Número da aula

                                    <input
                                        type="number"
                                        min="1"
                                        value={numero}
                                        onChange={(event) =>
                                            setNumero(event.target.value)
                                        }
                                    />
                                </label>

                                <label className="titulo-aula-field">
                                    Título

                                    <input
                                        type="text"
                                        value={titulo}
                                        onChange={(event) =>
                                            setTitulo(event.target.value)
                                        }
                                        placeholder="Ex.: O início da caminhada"
                                        autoFocus
                                    />
                                </label>
                            </div>

                            <label>
                                Arquivo PDF

                                <div className="pdf-picker">
                                    <input
                                        type="file"
                                        accept="application/pdf,.pdf"
                                        onChange={(event) =>
                                            setArquivo(
                                                event.target.files?.[0] ?? null,
                                            )
                                        }
                                    />

                                    <Upload size={21} />

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
                                                ).toFixed(1)} MB`
                                                : "Arquivo de até 50 MB"}
                                        </span>
                                    </div>
                                </div>
                            </label>

                            <div className="modal-actions">
                                <button
                                    type="button"
                                    className="secondary-button"
                                    onClick={() => setModalAberto(false)}
                                    disabled={salvando}
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
                                        ? "Importando..."
                                        : "Adicionar aula"}

                                    {!salvando && (
                                        <ChevronRight size={18} />
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

export default TrimestrePage;