import {
  supabase,
} from "./supabase";

const CACHE_PREFIX =
  "verbo-dicionario:v1:";

const CACHE_TTL =
  30 *
  24 *
  60 *
  60 *
  1000;

export function normalizarPalavraSelecionada(
  valor,
) {
  return String(
    valor ?? "",
  )
    .replace(
      /\s+/g,
      " ",
    )
    .trim()
    .replace(
      /^[^\p{L}\p{M}]+/gu,
      "",
    )
    .replace(
      /[^\p{L}\p{M}]+$/gu,
      "",
    );
}

export function ehUmaPalavraSelecionada(
  valor,
) {
  const palavra =
    normalizarPalavraSelecionada(
      valor,
    );

  if (
    !palavra ||
    palavra.length > 80 ||
    /\s/u.test(palavra)
  ) {
    return false;
  }

  return /^\p{L}[\p{L}\p{M}]*(?:[-’'][\p{L}\p{M}]+)*$/u.test(
    palavra,
  );
}

function chaveCache(
  palavra,
) {
  return (
    CACHE_PREFIX +
    palavra
      .toLocaleLowerCase(
        "pt-BR",
      )
  );
}

function lerCache(
  palavra,
  {
    aceitarExpirado = false,
  } = {},
) {
  try {
    const bruto =
      localStorage.getItem(
        chaveCache(
          palavra,
        ),
      );

    if (!bruto) {
      return null;
    }

    const salvo =
      JSON.parse(bruto);

    const criadoEm =
      Number(
        salvo?.criadoEm ??
          0,
      );

    if (
      !aceitarExpirado &&
      (
        !criadoEm ||
        Date.now() -
          criadoEm >
          CACHE_TTL
      )
    ) {
      return null;
    }

    return salvo?.dados ??
      null;
  } catch {
    return null;
  }
}

function salvarCache(
  palavra,
  dados,
) {
  try {
    localStorage.setItem(
      chaveCache(
        palavra,
      ),
      JSON.stringify({
        criadoEm:
          Date.now(),

        dados,
      }),
    );
  } catch {
    // Cache é uma otimização.
  }
}

export async function buscarSignificadoPalavra(
  valor,
) {
  const palavra =
    normalizarPalavraSelecionada(
      valor,
    );

  if (
    !ehUmaPalavraSelecionada(
      palavra,
    )
  ) {
    throw new Error(
      "SELECAO_NAO_E_PALAVRA",
    );
  }

  const cache =
    lerCache(
      palavra,
    );

  if (cache) {
    return cache;
  }

  const {
    data,
    error,
  } =
    await supabase.functions
      .invoke(
        "dicionario-palavra",
        {
          body: {
            palavra,
          },
        },
      );

  if (error) {
    const cacheAntigo =
      lerCache(
        palavra,
        {
          aceitarExpirado:
            true,
        },
      );

    if (cacheAntigo) {
      return cacheAntigo;
    }

    throw error;
  }

  const resposta =
    data ?? {
      palavra,
      encontrado: false,
      entradas: [],
    };

  salvarCache(
    palavra,
    resposta,
  );

  return resposta;
}
