import {
  useEffect,
  useState,
} from "react";

import {
  ArrowLeft,
  BookOpen,
  LibraryBig,
  Mic2,
} from "lucide-react";

import { useNavigate } from "react-router-dom";

import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

import verboLogoHorizontal from "../assets/verbo-logo-horizontal.png";

const MODULOS = [
  {
    id: "0736ccca-d516-4392-a4a5-ab363783596d",
    codigo: "EBD",
    titulo: "VERBO EBD",
    descricao:
      "Organize seus trimestres, aulas e apresentações bíblicas.",
    icon: BookOpen,
  },
  {
    id: "6f21e907-f744-4235-9a7f-26e8e1fdb631",
    codigo: "SERMOES",
    titulo: "VERBO Sermões",
    descricao:
      "Organize seus sermões, esboços e materiais de pregação.",
    icon: Mic2,
  },
  {
    id: "dfe1b16e-f01b-44d7-a674-c6d2d3fcd61a",
    codigo: "LIVROS",
    titulo: "VERBO Livros",
    descricao:
      "Organize seus livros, PDFs e materiais de estudo.",
    icon: LibraryBig,
  },
];

function ModulosConfigPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [configuracao, setConfiguracao] =
    useState({});

  const [carregando, setCarregando] =
    useState(true);

  const [salvando, setSalvando] =
    useState("");

  const [erro, setErro] =
    useState("");

  useEffect(() => {
    if (!user) return;

    let ativo = true;

    async function carregarConfiguracao() {
      setCarregando(true);
      setErro("");

      const { data, error } =
        await supabase
          .schema("biblia_slides")
          .from("usuario_modulos_config")
          .select("modulo_id, ativo")
          .eq("user_id", user.id);

      if (!ativo) return;

      if (error) {
        console.error(
          "Erro ao carregar módulos:",
          error,
        );

        setErro(
          "Não conseguimos carregar suas preferências.",
        );

        setCarregando(false);
        return;
      }

      const mapa = {};

      for (const modulo of MODULOS) {
        mapa[modulo.id] = true;
      }

      for (const item of data ?? []) {
        mapa[item.modulo_id] =
          item.ativo !== false;
      }

      setConfiguracao(mapa);
      setCarregando(false);
    }

    carregarConfiguracao();

    return () => {
      ativo = false;
    };
  }, [user]);

  async function alterarModulo(moduloId) {
    if (!user || salvando) return;

    const valorAtual =
      configuracao[moduloId] !== false;

    const novoValor =
      !valorAtual;

    setSalvando(moduloId);
    setErro("");

    setConfiguracao((anterior) => ({
      ...anterior,
      [moduloId]: novoValor,
    }));

    const { error } =
      await supabase
        .schema("biblia_slides")
        .from("usuario_modulos_config")
        .upsert(
          {
            user_id: user.id,
            modulo_id: moduloId,
            ativo: novoValor,
          },
          {
            onConflict:
              "user_id,modulo_id",
          },
        );

    if (error) {
      console.error(
        "Erro ao alterar módulo:",
        error,
      );

      setConfiguracao(
        (anterior) => ({
          ...anterior,
          [moduloId]: valorAtual,
        }),
      );

      setErro(
        "Não foi possível salvar essa alteração.",
      );
    }

    setSalvando("");
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-brand-group">
          <img
            src={verboLogoHorizontal}
            alt="VERBO"
            className="topbar-verbo-logo"
          />

          <div>
            <span className="app-kicker">
              Personalize seu VERBO
            </span>

            <h1>Módulos</h1>
          </div>
        </div>

        <button
          type="button"
          className="icon-button"
          aria-label="Voltar"
          title="Voltar"
          onClick={() => navigate("/")}
        >
          <ArrowLeft size={20} />
        </button>
      </header>

      <main
        className="page-content"
        style={{
          maxWidth: "760px",
          margin: "0 auto",
          width: "100%",
        }}
      >
        <section
          style={{
            marginBottom: "22px",
          }}
        >
          <p
            style={{
              margin: 0,
              lineHeight: 1.6,
              opacity: 0.78,
            }}
          >
            Escolha o que você deseja ver na sua
            Biblioteca. Desativar um módulo não
            apaga nenhum conteúdo.
          </p>
        </section>

        {erro && (
          <div
            role="alert"
            style={{
              padding: "14px 16px",
              marginBottom: "16px",
              borderRadius: "14px",
              background:
                "rgba(220, 38, 38, 0.08)",
            }}
          >
            {erro}
          </div>
        )}

        {carregando ? (
          <p>
            Carregando seus módulos...
          </p>
        ) : (
          <section
            style={{
              display: "grid",
              gap: "14px",
            }}
          >
            {MODULOS.map((modulo) => {
              const Icon = modulo.icon;

              const estaAtivo =
                configuracao[
                  modulo.id
                ] !== false;

              const estaSalvando =
                salvando === modulo.id;

              return (
                <div
                  key={modulo.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    padding: "18px",
                    border:
                      "1px solid rgba(128, 128, 128, 0.18)",
                    borderRadius: "18px",
                    background:
                      "var(--card-bg, rgba(255,255,255,0.04))",
                  }}
                >
                  <div
                    style={{
                      width: "46px",
                      height: "46px",
                      minWidth: "46px",
                      borderRadius: "14px",
                      display: "grid",
                      placeItems: "center",
                      background:
                        "rgba(99, 102, 241, 0.10)",
                    }}
                  >
                    <Icon size={23} />
                  </div>

                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <strong
                      style={{
                        display: "block",
                        marginBottom: "5px",
                      }}
                    >
                      {modulo.titulo}
                    </strong>

                    <span
                      style={{
                        display: "block",
                        fontSize: "0.9rem",
                        lineHeight: 1.45,
                        opacity: 0.72,
                      }}
                    >
                      {modulo.descricao}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={estaSalvando}
                    onClick={() =>
                      alterarModulo(
                        modulo.id,
                      )
                    }
                    aria-pressed={estaAtivo}
                    style={{
                      border: 0,
                      borderRadius: "999px",
                      padding: "9px 14px",
                      cursor:
                        estaSalvando
                          ? "wait"
                          : "pointer",
                      fontWeight: 700,
                      background:
                        estaAtivo
                          ? "#16a34a"
                          : "rgba(128,128,128,0.18)",
                      color:
                        estaAtivo
                          ? "#fff"
                          : "inherit",
                      minWidth: "105px",
                    }}
                  >
                    {estaSalvando
                      ? "Salvando..."
                      : estaAtivo
                        ? "Ativado"
                        : "Desativado"}
                  </button>
                </div>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
}

export default ModulosConfigPage;
