import {
  abrirZip,
} from "./zipReader";

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
      "Não foi possível interpretar o arquivo PPTX.",
    );
  }

  return documento;
}

function numeroSlide(
  caminho,
) {
  const match =
    caminho.match(
      /slide(\d+)\.xml$/i,
    );

  return Number(
    match?.[1] ?? 0,
  );
}

function numeroAtributo(
  elemento,
  nome,
  fallback = 0,
) {
  return Number(
    elemento?.getAttribute(
      nome,
    ) ??
      fallback,
  );
}

function textoShape(
  shape,
) {
  return [
    ...shape
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
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function tamanhoFonteShape(
  shape,
) {
  const propriedadesRun =
    shape
      .getElementsByTagNameNS(
        "*",
        "rPr",
      )?.[0];

  const sz =
    Number(
      propriedadesRun
        ?.getAttribute(
          "sz",
        ) ?? 0,
    );

  return sz > 0
    ? sz / 100
    : 24;
}

export async function processarPptxAula(
  arquivo,
) {
  const zip =
    await abrirZip(
      arquivo,
    );

  let largura =
    12192000;

  let altura =
    6858000;

  if (
    zip.existe(
      "ppt/presentation.xml",
    )
  ) {
    const presentation =
      parserXml(
        await zip.texto(
          "ppt/presentation.xml",
        ),
      );

    const sldSz =
      presentation
        .getElementsByTagNameNS(
          "*",
          "sldSz",
        )?.[0];

    largura =
      numeroAtributo(
        sldSz,
        "cx",
        largura,
      );

    altura =
      numeroAtributo(
        sldSz,
        "cy",
        altura,
      );
  }

  const caminhos =
    zip
      .listar(
        "ppt/slides/",
      )
      .filter(
        (caminho) =>
          /\/slide\d+\.xml$/i
            .test(caminho),
      )
      .sort(
        (a, b) =>
          numeroSlide(a) -
          numeroSlide(b),
      );

  const paginas = [];

  for (
    const caminho
    of caminhos
  ) {
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
          "sp",
        ),
    ]
      .map((shape) => {
        const texto =
          textoShape(
            shape,
          );

        if (!texto) {
          return null;
        }

        const xfrm =
          shape
            .getElementsByTagNameNS(
              "*",
              "xfrm",
            )?.[0];

        const off =
          xfrm
            ?.getElementsByTagNameNS(
              "*",
              "off",
            )?.[0];

        const ext =
          xfrm
            ?.getElementsByTagNameNS(
              "*",
              "ext",
            )?.[0];

        return {
          tipo: "texto",
          texto,

          x:
            numeroAtributo(
              off,
              "x",
              0,
            ),

          y:
            numeroAtributo(
              off,
              "y",
              0,
            ),

          largura:
            numeroAtributo(
              ext,
              "cx",
              largura,
            ),

          altura:
            numeroAtributo(
              ext,
              "cy",
              altura,
            ),

          tamanhoFonte:
            tamanhoFonteShape(
              shape,
            ),
        };
      })
      .filter(Boolean);

    paginas.push({
      numero:
        paginas.length + 1,

      largura,
      altura,
      blocos,
    });
  }

  if (
    paginas.length === 0
  ) {
    throw new Error(
      "Não encontramos slides legíveis neste PPTX.",
    );
  }

  return {
    versao: 2,
    formato: "pptx",

    totalPaginas:
      paginas.length,

    paginas,

    slide: {
      largura,
      altura,
    },
  };
}
