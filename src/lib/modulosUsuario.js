import { supabase } from "./supabase";

const MODULOS_VALIDOS = [
  "EBD",
  "SERMOES",
  "LIVROS",
  "TODOS",
];

const CHAVE_MODULO =
  "verbo_modulo_inicial";

const CHAVE_CADASTRO =
  "verbo_cadastro_modulo_pendente";

export function normalizarModulo(valor) {
  const codigo = String(
    valor ?? "",
  )
    .trim()
    .toUpperCase();

  return MODULOS_VALIDOS.includes(
    codigo,
  )
    ? codigo
    : null;
}

export function registrarCadastroModuloPendente(
  modulo,
) {
  const codigo =
    normalizarModulo(modulo) ??
    "TODOS";

  localStorage.setItem(
    CHAVE_MODULO,
    codigo,
  );

  localStorage.setItem(
    CHAVE_CADASTRO,
    "1",
  );

  return codigo;
}

export function existeCadastroModuloPendente() {
  return (
    localStorage.getItem(
      CHAVE_CADASTRO,
    ) === "1"
  );
}

export function obterModuloPendente() {
  return (
    normalizarModulo(
      localStorage.getItem(
        CHAVE_MODULO,
      ),
    ) ?? "TODOS"
  );
}

export function limparCadastroModuloPendente() {
  localStorage.removeItem(
    CHAVE_MODULO,
  );

  localStorage.removeItem(
    CHAVE_CADASTRO,
  );
}

export async function inicializarModulosUsuario(
  modulo = "TODOS",
) {
  const publico =
    normalizarModulo(modulo) ??
    "TODOS";

  const { error } =
    await supabase
      .schema("biblia_slides")
      .rpc(
        "inicializar_modulos_usuario",
        {
          p_publico: publico,
        },
      );

  if (error) {
    console.error(
      "Erro ao inicializar módulos do usuário:",
      error,
    );

    return {
      ok: false,
      error,
    };
  }

  return {
    ok: true,
    error: null,
  };
}

export async function concluirCadastroModuloPendente() {
  if (
    !existeCadastroModuloPendente()
  ) {
    return {
      ok: true,
      ignorado: true,
    };
  }

  const modulo =
    obterModuloPendente();

  const resultado =
    await inicializarModulosUsuario(
      modulo,
    );

  if (resultado.ok) {
    limparCadastroModuloPendente();
  }

  return resultado;
}
