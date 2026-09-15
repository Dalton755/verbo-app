import {
  ArrowLeft,
  LibraryBig,
} from "lucide-react";

import { useNavigate } from "react-router-dom";

function LivrosPage() {
  const navigate = useNavigate();

  return (
    <div className="app">
      <header className="topbar">
        <div className="module-header">
          <button
            type="button"
            className="back-button"
            onClick={() => navigate("/")}
          >
            <ArrowLeft size={18} />
            Biblioteca
          </button>

          <div>
            <span className="app-kicker">
              Livros
            </span>

            <h1>Sua estante</h1>
          </div>
        </div>
      </header>

      <main className="page-content module-page">
        <section className="module-page-intro">
          <p className="eyebrow">
            Leia. Marque. Continue.
          </p>

          <h2>
            Sua biblioteca cristã
            em qualquer tela.
          </h2>

          <p>
            PDFs transformados em uma experiência
            confortável de leitura para computador
            e celular.
          </p>
        </section>

        <section className="module-empty">
          <div className="empty-icon">
            <LibraryBig size={28} />
          </div>

          <h3>
            Sua estante começa aqui
          </h3>

          <p>
            Depois do Modo Pregação construiremos
            o leitor responsivo de livros.
          </p>
        </section>
      </main>
    </div>
  );
}

export default LivrosPage;