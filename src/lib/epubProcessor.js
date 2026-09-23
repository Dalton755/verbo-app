import {
  abrirZip,
  resolverCaminhoZip,
} from "./zipReader";

function parserXml(
  conteudo,
  tipo = "application/xml",
) {
  const documento =
    new DOMParser()
      .parseFromString(
        conteudo,
        tipo,
      );

  if (
    documento.querySelector(
      "parsererror",
    )
  ) {
    throw new Error(
      "Não foi possível interpretar o EPUB.",
    );
  }

  return documento;
}

function textoElemento(
  elemento,
) {
  return String(
    elemento?.textContent ?? "",
  )
    .replace(/\s+/g, " ")
    .trim();
}

function blocosDoDocumento(
  documento,
) {
  const seletor =
    "h1,h2,h3,h4,h5,h6,p,li,blockquote";

  return [
    ...documento.querySelectorAll(
      seletor,
    ),
  ]
    .map((elemento) => {
      const texto =
        textoElemento(
          elemento,
        );

      if (!texto) {
        return null;
      }

      const tag =
        elemento.tagName
          ?.toLocaleLowerCase(
            "pt-BR",
          );

      const tipo =
        tag?.startsWith("h")
          ? "titulo"
          : tag === "li"
            ? "item"
            : "texto";

      return {
        tipo,
        texto,
      };
    })
    .filter(Boolean);
}

export async function processarEpubLivro(
  arquivo,
) {
  const zip =
    await abrirZip(
      arquivo,
    );

  const containerXml =
    await zip.texto(
      "META-INF/container.xml",
    );

  const container =
    parserXml(
      containerXml,
    );

  const rootfile =
    container
      .getElementsByTagNameNS(
        "*",
        "rootfile",
      )?.[0];

  const opfPath =
    rootfile?.getAttribute(
      "full-path",
    );

  if (!opfPath) {
    throw new Error(
      "O EPUB não informa o arquivo principal.",
    );
  }

  const opf =
    parserXml(
      await zip.texto(
        opfPath,
      ),
    );

  const titulo =
    textoElemento(
      opf
        .getElementsByTagNameNS(
          "*",
          "title",
        )?.[0],
    );

  const autor =
    textoElemento(
      opf
        .getElementsByTagNameNS(
          "*",
          "creator",
        )?.[0],
    );

  const manifest =
    new Map();

  [
    ...opf.getElementsByTagNameNS(
      "*",
      "item",
    ),
  ].forEach((item) => {
    const id =
      item.getAttribute("id");

    const href =
      item.getAttribute(
        "href",
      );

    if (
      id &&
      href
    ) {
      manifest.set(
        id,
        {
          href,
          mediaType:
            item.getAttribute(
              "media-type",
            ),
        },
      );
    }
  });

  const spine = [
    ...opf.getElementsByTagNameNS(
      "*",
      "itemref",
    ),
  ];

  const paginas = [];

  for (
    const itemref
    of spine
  ) {
    const idref =
      itemref.getAttribute(
        "idref",
      );

    const item =
      manifest.get(
        idref,
      );

    if (!item?.href) {
      continue;
    }

    const caminho =
      resolverCaminhoZip(
        opfPath,
        item.href.split("#")[0],
      );

    if (
      !zip.existe(
        caminho,
      )
    ) {
      continue;
    }

    const xhtml =
      await zip.texto(
        caminho,
      );

    const documento =
      parserXml(
        xhtml,
        "application/xhtml+xml",
      );

    const blocos =
      blocosDoDocumento(
        documento,
      );

    if (
      blocos.length === 0
    ) {
      continue;
    }

    paginas.push({
      numero:
        paginas.length + 1,
      blocos,
    });
  }

  if (
    paginas.length === 0
  ) {
    throw new Error(
      "Não encontramos capítulos legíveis neste EPUB.",
    );
  }

  return {
    versao: 2,
    formato: "epub",

    totalPaginas:
      paginas.length,

    paginas,

    metadados: {
      titulo:
        titulo || null,
      autor:
        autor || null,
    },
  };
}
