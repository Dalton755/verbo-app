const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "POST, OPTIONS",
};

function responder(
  body: unknown,
  status = 200,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type":
          "application/json; charset=utf-8",
      },
    },
  );
}

function decodificarEntidades(
  valor: string,
) {
  const mapa: Record<
    string,
    string
  > = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
  };

  return valor
    .replace(
      /&#x([0-9a-f]+);/gi,
      (
        _,
        codigo: string,
      ) =>
        String.fromCodePoint(
          parseInt(
            codigo,
            16,
          ),
        ),
    )
    .replace(
      /&#([0-9]+);/g,
      (
        _,
        codigo: string,
      ) =>
        String.fromCodePoint(
          parseInt(
            codigo,
            10,
          ),
        ),
    )
    .replace(
      /&([a-z]+);/gi,
      (
        inteiro,
        nome: string,
      ) =>
        mapa[
          nome.toLowerCase()
        ] ?? inteiro,
    );
}

function limparXml(
  valor: string,
) {
  return decodificarEntidades(
    String(
      valor ?? "",
    )
      .replace(
        /<br\s*\/?\s*>/gi,
        "\n",
      )
      .replace(
        /<\/p\s*>/gi,
        "\n",
      )
      .replace(
        /<[^>]+>/g,
        " ",
      )
      .replace(
        /_([^_]+)_/g,
        "$1",
      ),
  )
    .replace(
      /[ \t]+/g,
      " ",
    )
    .replace(
      / *\n */g,
      "\n",
    )
    .replace(
      /\n{2,}/g,
      "\n",
    )
    .trim();
}

function extrairTodos(
  xml: string,
  tag: string,
) {
  const regex =
    new RegExp(
      `<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`,
      "gi",
    );

  const valores: string[] =
    [];

  let match:
    RegExpExecArray |
    null;

  while (
    (
      match =
        regex.exec(xml)
    )
  ) {
    const limpo =
      limparXml(
        match[1],
      );

    if (limpo) {
      valores.push(
        limpo,
      );
    }
  }

  return valores;
}

function unicos(
  valores: string[],
) {
  return [
    ...new Set(
      valores
        .map(
          (item) =>
            item.trim(),
        )
        .filter(Boolean),
    ),
  ];
}

function parsearEntrada(
  item: {
    word?: string;
    xml?: string;
  },
) {
  const xml =
    String(
      item?.xml ?? "",
    );

  const ortografia =
    extrairTodos(
      xml,
      "orth",
    )[0] ??
    item?.word ??
    "";

  const classes =
    unicos(
      extrairTodos(
        xml,
        "gramGrp",
      ),
    );

  const definicoes =
    unicos(
      extrairTodos(
        xml,
        "def",
      )
        .flatMap(
          (definicao) =>
            definicao
              .split(/\n+/)
              .map(
                (linha) =>
                  linha.trim(),
              ),
        )
        .filter(
          (linha) =>
            linha.length >
            0,
        ),
    )
      .slice(
        0,
        8,
      );

  if (
    definicoes.length ===
    0
  ) {
    return null;
  }

  return {
    palavra:
      ortografia,
    classe:
      classes
        .slice(
          0,
          3,
        )
        .join(
          " · ",
        ),
    definicoes,
  };
}

function limparPalavra(
  valor: unknown,
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

Deno.serve(
  async (req) => {
    if (
      req.method ===
      "OPTIONS"
    ) {
      return new Response(
        "ok",
        {
          headers:
            corsHeaders,
        },
      );
    }

    if (
      req.method !==
      "POST"
    ) {
      return responder(
        {
          error:
            "METHOD_NOT_ALLOWED",
        },
        405,
      );
    }

    let body:
      Record<
        string,
        unknown
      > = {};

    try {
      body =
        await req.json();
    } catch {
      return responder(
        {
          error:
            "BODY_INVALIDO",
        },
        400,
      );
    }

    const palavra =
      limparPalavra(
        body.palavra,
      );

    if (
      !palavra ||
      palavra.length > 80 ||
      /\s/u.test(
        palavra,
      ) ||
      !/^\p{L}[\p{L}\p{M}]*(?:[-’'][\p{L}\p{M}]+)*$/u.test(
        palavra,
      )
    ) {
      return responder(
        {
          error:
            "PALAVRA_INVALIDA",
        },
        400,
      );
    }

    const controller =
      new AbortController();

    const timer =
      setTimeout(
        () =>
          controller.abort(),
        8000,
      );

    try {
      const resposta =
        await fetch(
          "https://api.dicionario-aberto.net/word/" +
            encodeURIComponent(
              palavra,
            ),
          {
            method: "GET",
            headers: {
              Accept:
                "application/json",
            },
            signal:
              controller.signal,
          },
        );

      if (!resposta.ok) {
        return responder(
          {
            error:
              "DICIONARIO_INDISPONIVEL",
          },
          502,
        );
      }

      const bruto =
        await resposta.json();

      const lista =
        Array.isArray(
          bruto,
        )
          ? bruto
          : [];

      const entradas =
        lista
          .map(
            parsearEntrada,
          )
          .filter(
            Boolean,
          )
          .slice(
            0,
            5,
          );

      return responder({
        palavra,
        encontrado:
          entradas.length >
          0,
        entradas,
        fonte:
          "Dicionário Aberto",
      });
    } catch (error) {
      console.error(
        "Erro no dicionário:",
        error,
      );

      return responder(
        {
          error:
            "DICIONARIO_INDISPONIVEL",
        },
        502,
      );
    } finally {
      clearTimeout(
        timer,
      );
    }
  },
);
