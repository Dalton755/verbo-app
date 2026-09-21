import { supabase } from "./supabase";

const CHAVE_OAUTH =
  "verbo-oauth-pendente";

const CHAVE_MODULO =
  "verbo-modulo-inicial";

export function normalizarModuloInicial(
  valor,
) {
  const codigo = String(
    valor ?? "",
  )
    .trim()
    .toUpperCase();

  if (
    [
      "EBD",
      "SERMOES",
      "LIVROS",
    ].includes(codigo)
  ) {
    return codigo;
  }

  return "TODOS";
}

export function salvarOAuthPendente(
  modulo,
) {
  localStorage.setItem(
    CHAVE_OAUTH,
    "1",
  );

  localStorage.setItem(
    CHAVE_MODULO,
    normalizarModuloInicial(
      modulo,
    ),
  );
}

export function existeOAuthPendente() {
  return (
    localStorage.getItem(
      CHAVE_OAUTH,
    ) === "1"
  );
}

export function obterModuloInicial() {
  return normalizarModuloInicial(
    localStorage.getItem(
      CHAVE_MODULO,
    ),
  );
}

export function limparOAuthPendente() {
  localStorage.removeItem(
    CHAVE_OAUTH,
  );

  localStorage.removeItem(
    CHAVE_MODULO,
  );
}

export async function inicializarModulosOAuth(
  modulo,
) {
  const { error } =
    await supabase
      .schema("biblia_slides")
      .rpc(
        "inicializar_modulos_usuario",
        {
          p_publico:
            normalizarModuloInicial(
              modulo,
            ),
        },
      );

  if (error) {
    console.error(
      "Erro ao inicializar módulos:",
      error,
    );

    return {
      ok: false,
      error,
    };
  }

  return {
    ok: true,
  };
}
