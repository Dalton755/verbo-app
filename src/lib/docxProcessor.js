import {
  abrirZip,
} from "./zipReader";

function normalizar(
  texto = "",
) {
  return String(texto)
    .replace(/\s+/g, " ")
    .trim();
}

function parserXml(
  conteudo,
) {
  const documento =
    new DOMParser()
      .parseFromString(
        conteudo,
        "application/xml",
      );

  if (
    documento.querySelector(
      "parsererror",
    )
  ) {
    throw new Error(
      "Não foi possível interpretar o arquivo DOCX.",
    );
  }

  return documento;
}

function atributoVal(
  elemento,
) {
  if (!elemento) {
    return "";
  }

  return (
    elemento.getAttribute(
      "w:val",
    ) ||
    elemento.getAttribute(
      "val",
    ) ||
    [
      ...elemento.attributes,
    ].find(
      (item) =>
        item.localName ===
        "val",
    )?.value ||
    ""
  );
}

function paragrafoTodoEmNegrito(
  paragrafo,
) {
  const runs = [
    ...paragrafo
      .getElementsByTagNameNS(
        "*",
        "r",
      ),
  ].filter((run) =>
    [
      ...run
        .getElementsByTagNameNS(
          "*",
          "t",
        ),
    ].some(
      (item) =>
        String(
          item.textContent ?? "",
        ).trim(),
    ),
  );

  if (
    runs.length === 0
  ) {
    return false;
  }

  return runs.every(
    (run) => {
      const propriedades =
        run
          .getElementsByTagNameNS(
            "*",
            "rPr",
          )?.[0];

      if (!propriedades) {
        return false;
      }

      return Boolean(
        propriedades
          .getElementsByTagNameNS(
            "*",
            "b",
          )?.[0],
      );
    },
  );
}

function pareceTituloSermão(
  texto,
) {
  const normalizado =
    normalizar(texto);

  if (!normalizado) {
    return false;
  }

  if (
    /^(tema|texto|introdução|conclusão)\s*:/i
      .test(normalizado)
  ) {
    return true;
  }

  if (
    /^(?:[IVXLCDM]+|\d+)\s*[-–—]\s+/i
      .test(normalizado)
  ) {
    return true;
  }

  return false;
}

function tipoParagrafo(
  paragrafo,
  texto,
) {
  const estilo =
    atributoVal(
      paragrafo
        .getElementsByTagNameNS(
          "*",
          "pStyle",
        )?.[0],
    )
      .toLocaleLowerCase(
        "pt-BR",
      );

  if (
    estilo.includes(
      "heading",
    ) ||
    estilo.includes(
      "titulo",
    ) ||
    estilo.includes(
      "title",
    ) ||
    paragrafoTodoEmNegrito(
      paragrafo,
    ) ||
    pareceTituloSermão(
      texto,
    )
  ) {
    return "titulo";
  }

  const numeracao =
    paragrafo
      .getElementsByTagNameNS(
        "*",
        "numPr",
      )?.[0];

  return numeracao
    ? "item"
    : "texto";
}

function paginar(
  blocos,
) {
  const paginas = [];

  let atual = [];
  let caracteres = 0;

  function concluir() {
    if (
      atual.length === 0
    ) {
      return;
    }

    paginas.push({
      numero:
        paginas.length + 1,
      blocos: atual,
    });

    atual = [];
    caracteres = 0;
  }

  blocos.forEach(
    (bloco) => {
      const tamanho =
        bloco.texto.length;

      if (
        atual.length >= 22 ||
        caracteres + tamanho >
          6500
      ) {
        concluir();
      }

      atual.push(bloco);

      caracteres +=
        tamanho;
    },
  );

  concluir();

  return paginas;
}

export async function processarDocxSermao(
  arquivo,
) {
  const zip =
    await abrirZip(
      arquivo,
    );

  const caminho =
    "word/document.xml";

  if (
    !zip.existe(
      caminho,
    )
  ) {
    throw new Error(
      "O DOCX não possui um documento de texto válido.",
    );
  }

  const documento =
    parserXml(
      await zip.texto(
        caminho,
      ),
    );

  const blocos = [
    ...documento
      .getElementsByTagNameNS(
        "*",
        "p",
      ),
  ]
    .map((paragrafo) => {
      const partes = [
        ...paragrafo
          .getElementsByTagNameNS(
            "*",
            "t",
          ),
      ]
        .map(
          (item) =>
            item.textContent ??
            "",
        )
        .join("");

      const texto =
        normalizar(
          partes,
        );

      if (!texto) {
        return null;
      }

      return {
        tipo:
          tipoParagrafo(
            paragrafo,
            texto,
          ),
        texto,
      };
    })
    .filter(Boolean);

  if (
    blocos.length === 0
  ) {
    throw new Error(
      "Não encontramos texto legível neste DOCX.",
    );
  }

  const paginas =
    paginar(blocos);

  return {
    versao: 2,
    formato: "docx",

    totalPaginas:
      paginas.length,

    paginas,
  };
}
