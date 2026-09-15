import {
  ArrowLeft,
  BookOpen,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

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

function LivroPage() {
  const { id } =
    useParams();

  const navigate =
    useNavigate();

  const { user } =
    useAuth();

  const [
    livro,
    setLivro,
  ] = useState(null);

  const [
    carregando,
    setCarregando,
  ] = useState(true);

  const [
    erro,
    setErro,
  ] = useState("");

  useEffect(() => {
    if (
      !user ||
      !id
    ) {
      return;
    }

    let ativo = true;

    async function carregarLivro() {
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
          tamanho_fonte,
          espacamento,
          tema_leitura,
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

      if (!ativo) {
        return;
      }

      if (
        error ||
        !data
      ) {
        console.error(
          error,
        );

        setErro(
          "Não conseguimos abrir este livro.",
        );

        setCarregando(false);
        return;
      }

      setLivro(
        data,
      );

      setCarregando(
        false,
      );
    }

    carregarLivro();

    return () => {
      ativo = false;
    };
  }, [
    id,
    user,
  ]);

  if (carregando) {
    return (
      <div className="sermon-loading">
        <div className="loading-dot" />

        <p>
          Abrindo livro...
        </p>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="sermon-loading">
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
    <div className="app">
      <header className="topbar">
        <div className="module-header">
          <button
            type="button"
            className="back-button"
            onClick={() =>
              navigate(
                "/livros",
              )
            }
          >
            <ArrowLeft
              size={18}
            />

            Estante
          </button>

          <div>
            <span className="app-kicker">
              {livro?.autor ||
                "Livro"}
            </span>

            <h1>
              {livro?.titulo}
            </h1>
          </div>
        </div>
      </header>

      <main className="page-content module-page">
        <section className="module-empty">
          <div className="empty-icon">
            <BookOpen
              size={28}
            />
          </div>

          <h3>
            {livro?.titulo}
          </h3>

          <p>
            {livro?.autor
              ? `Autor: ${livro.autor}`
              : livro?.arquivo_nome}
          </p>

          <p>
            O Modo Leitura será
            conectado nesta tela.
          </p>
        </section>
      </main>
    </div>
  );
}

export default LivroPage;