import {
  abrirZip,
  resolverCaminhoZip,
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

function primeiro(
  elemento,
  nome,
) {
  return elemento
    ?.getElementsByTagNameNS(
      "*",
      nome,
    )?.[0] ?? null;
}

function filhoDireto(
  elemento,
  nome,
) {
  return [
    ...(elemento?.children ?? []),
  ].find(
    (item) =>
      item.localName === nome,
  ) ?? null;
}

function corRgb(
  container,
  tema,
  fallback = null,
) {
  if (!container) {
    return fallback;
  }

  const srgb =
    primeiro(
      container,
      "srgbClr",
    );

  if (
    srgb?.getAttribute(
      "val",
    )
  ) {
    return (
      "#" +
      srgb
        .getAttribute("val")
        .toUpperCase()
    );
  }

  const scheme =
    primeiro(
      container,
      "schemeClr",
    );

  const nome =
    scheme?.getAttribute(
      "val",
    );

  if (
    nome &&
    tema[nome]
  ) {
    return tema[nome];
  }

  return fallback;
}

async function carregarTema(
  zip,
) {
  const fallback = {
    dk1: "#000000",
    lt1: "#FFFFFF",
    dk2: "#44546A",
    lt2: "#E7E6E6",
    accent1: "#4472C4",
    accent2: "#ED7D31",
    accent3: "#A5A5A5",
    accent4: "#FFC000",
    accent5: "#5B9BD5",
    accent6: "#70AD47",
    hlink: "#0563C1",
    folHlink: "#954F72",
  };

  const caminho =
    zip
      .listar("ppt/theme/")
      .find(
        (item) =>
          /theme\d+\.xml$/i
            .test(item),
      );

  if (!caminho) {
    return fallback;
  }

  try {
    const documento =
      parserXml(
        await zip.texto(
          caminho,
        ),
      );

    const esquema =
      primeiro(
        documento,
        "clrScheme",
      );

    if (!esquema) {
      return fallback;
    }

    const tema = {
      ...fallback,
    };

    [
      ...esquema.children,
    ].forEach(
      (item) => {
        const nome =
          item.localName;

        const cor =
          corRgb(
            item,
            fallback,
          );

        if (
          nome &&
          cor
        ) {
          tema[nome] =
            cor;
        }
      },
    );

    return tema;
  } catch {
    return fallback;
  }
}

function xfrmElemento(
  elemento,
) {
  return primeiro(
    elemento,
    "xfrm",
  );
}

function contextoRaiz() {
  return {
    escalaX: 1,
    escalaY: 1,
    translacaoX: 0,
    translacaoY: 0,
  };
}

function transformarGeometria(
  valor,
  contexto,
) {
  return {
    x:
      contexto.translacaoX +
      contexto.escalaX *
        valor.x,

    y:
      contexto.translacaoY +
      contexto.escalaY *
        valor.y,

    largura:
      contexto.escalaX *
      valor.largura,

    altura:
      contexto.escalaY *
      valor.altura,

    rotacao:
      valor.rotacao,
  };
}

function contextoGrupo(
  grupo,
  contextoPai,
) {
  const grpSpPr =
    filhoDireto(
      grupo,
      "grpSpPr",
    );

  const xfrm =
    primeiro(
      grpSpPr,
      "xfrm",
    );

  const off =
    primeiro(
      xfrm,
      "off",
    );

  const ext =
    primeiro(
      xfrm,
      "ext",
    );

  const chOff =
    primeiro(
      xfrm,
      "chOff",
    );

  const chExt =
    primeiro(
      xfrm,
      "chExt",
    );

  const grupoX =
    numeroAtributo(
      off,
      "x",
      0,
    );

  const grupoY =
    numeroAtributo(
      off,
      "y",
      0,
    );

  const grupoLargura =
    numeroAtributo(
      ext,
      "cx",
      1,
    );

  const grupoAltura =
    numeroAtributo(
      ext,
      "cy",
      1,
    );

  const origemFilhosX =
    numeroAtributo(
      chOff,
      "x",
      0,
    );

  const origemFilhosY =
    numeroAtributo(
      chOff,
      "y",
      0,
    );

  const larguraFilhos =
    Math.max(
      numeroAtributo(
        chExt,
        "cx",
        grupoLargura,
      ),
      1,
    );

  const alturaFilhos =
    Math.max(
      numeroAtributo(
        chExt,
        "cy",
        grupoAltura,
      ),
      1,
    );

  const escalaGrupoX =
    grupoLargura /
    larguraFilhos;

  const escalaGrupoY =
    grupoAltura /
    alturaFilhos;

  return {
    escalaX:
      contextoPai.escalaX *
      escalaGrupoX,

    escalaY:
      contextoPai.escalaY *
      escalaGrupoY,

    translacaoX:
      contextoPai.translacaoX +
      contextoPai.escalaX *
        (
          grupoX -
          origemFilhosX *
            escalaGrupoX
        ),

    translacaoY:
      contextoPai.translacaoY +
      contextoPai.escalaY *
        (
          grupoY -
          origemFilhosY *
            escalaGrupoY
        ),
  };
}

function geometria(
  elemento,
  larguraSlide,
  alturaSlide,
  contexto =
    contextoRaiz(),
  fallback = null,
) {
  const xfrm =
    xfrmElemento(
      elemento,
    );

  const off =
    primeiro(
      xfrm,
      "off",
    );

  const ext =
    primeiro(
      xfrm,
      "ext",
    );

  const bruta = {
    x:
      numeroAtributo(
        off,
        "x",
        fallback?.x ?? 0,
      ),

    y:
      numeroAtributo(
        off,
        "y",
        fallback?.y ?? 0,
      ),

    largura:
      numeroAtributo(
        ext,
        "cx",
        fallback?.largura ??
          larguraSlide,
      ),

    altura:
      numeroAtributo(
        ext,
        "cy",
        fallback?.altura ??
          alturaSlide,
      ),

    rotacao:
      numeroAtributo(
        xfrm,
        "rot",
        0,
      ) / 60000,
  };

  return transformarGeometria(
    bruta,
    contexto,
  );
}

function preenchimentoShape(
  shape,
  tema,
) {
  const spPr =
    filhoDireto(
      shape,
      "spPr",
    );

  if (!spPr) {
    return null;
  }

  if (
    filhoDireto(
      spPr,
      "noFill",
    )
  ) {
    return null;
  }

  const solidFill =
    filhoDireto(
      spPr,
      "solidFill",
    );

  return corRgb(
    solidFill,
    tema,
    null,
  );
}

function bordaShape(
  shape,
  tema,
) {
  const spPr =
    filhoDireto(
      shape,
      "spPr",
    );

  const linha =
    filhoDireto(
      spPr,
      "ln",
    );

  if (
    !linha ||
    filhoDireto(
      linha,
      "noFill",
    )
  ) {
    return {
      cor: null,
      largura: 0,
    };
  }

  return {
    cor:
      corRgb(
        filhoDireto(
          linha,
          "solidFill",
        ),
        tema,
        null,
      ),

    largura:
      numeroAtributo(
        linha,
        "w",
        0,
      ),
  };
}

function textoShape(
  shape,
) {
  const paragrafos = [
    ...shape
      .getElementsByTagNameNS(
        "*",
        "p",
      ),
  ];

  return paragrafos
    .map(
      (paragrafo) =>
        [
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
          .join(""),
    )
    .filter(
      (texto) =>
        texto.length > 0,
    )
    .join("\n")
    .trim();
}

function propriedadesTexto(
  shape,
  tema,
) {
  const runs = [
    ...shape
      .getElementsByTagNameNS(
        "*",
        "r",
      ),
  ];

  let rPr = null;

  for (
    const run
    of runs
  ) {
    const texto =
      [
        ...run
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
        .join("")
        .trim();

    if (!texto) {
      continue;
    }

    rPr =
      primeiro(
        run,
        "rPr",
      );

    if (rPr) {
      break;
    }
  }

  if (!rPr) {
    rPr =
      primeiro(
        shape,
        "endParaRPr",
      );
  }

  const sz =
    numeroAtributo(
      rPr,
      "sz",
      2400,
    );

  const latin =
    primeiro(
      rPr,
      "latin",
    );

  const pPr =
    primeiro(
      shape,
      "pPr",
    );

  const bodyPr =
    primeiro(
      shape,
      "bodyPr",
    );

  const alinhamento =
    pPr?.getAttribute(
      "algn",
    ) ??
    "l";

  const ancora =
    bodyPr?.getAttribute(
      "anchor",
    ) ??
    "t";

  const mapaAlinhamento = {
    l: "left",
    ctr: "center",
    r: "right",
    just: "justify",
  };

  const mapaAncora = {
    t: "flex-start",
    ctr: "center",
    b: "flex-end",
  };

  return {
    tamanhoFonte:
      sz > 0
        ? sz / 100
        : 24,

    corTexto:
      corRgb(
        primeiro(
          rPr,
          "solidFill",
        ),
        tema,
        tema.dk1 ??
          "#000000",
      ),

    fonte:
      latin?.getAttribute(
        "typeface",
      ) ||
      "Arial",

    negrito:
      rPr?.getAttribute(
        "b",
      ) === "1",

    italico:
      rPr?.getAttribute(
        "i",
      ) === "1",

    alinhamento:
      mapaAlinhamento[
        alinhamento
      ] ??
      "left",

    alinhamentoVertical:
      mapaAncora[
        ancora
      ] ??
      "flex-start",
  };
}

function tipoGeometria(
  shape,
) {
  return (
    primeiro(
      shape,
      "prstGeom",
    )
      ?.getAttribute(
        "prst",
      ) ??
    "rect"
  );
}

function blocoShape(
  shape,
  larguraSlide,
  alturaSlide,
  tema,
  zIndex,
  contexto,
  geometriaFallback = null,
) {
  const texto =
    textoShape(
      shape,
    );

  const fill =
    preenchimentoShape(
      shape,
      tema,
    );

  const borda =
    bordaShape(
      shape,
      tema,
    );

  if (
    !texto &&
    !fill &&
    !borda.cor
  ) {
    return null;
  }

  return {
    tipo:
      texto
        ? "texto"
        : "forma",

    texto:
      texto || null,

    ...geometria(
      shape,
      larguraSlide,
      alturaSlide,
      contexto,
      geometriaFallback,
    ),

    ...propriedadesTexto(
      shape,
      tema,
    ),

    preenchimento:
      fill,

    bordaCor:
      borda.cor,

    bordaLargura:
      borda.largura,

    geometria:
      tipoGeometria(
        shape,
      ),

    zIndex,
  };
}

function chavePlaceholder(
  shape,
) {
  const ph =
    primeiro(
      shape,
      "ph",
    );

  if (!ph) {
    return null;
  }

  return `${
    ph.getAttribute("type") ??
    "body"
  }:${
    ph.getAttribute("idx") ??
    "0"
  }`;
}

async function dadosLayoutSlide(
  zip,
  relacoes,
  larguraSlide,
  alturaSlide,
  tema,
) {
  const relacaoLayout = [
    ...relacoes.values(),
  ].find(
    (item) =>
      item.tipo.includes(
        "slideLayout",
      ),
  );

  if (
    !relacaoLayout?.caminho ||
    !zip.existe(
      relacaoLayout.caminho,
    )
  ) {
    return {
      geometrias:
        new Map(),
      fundo: null,
    };
  }

  try {
    const documento =
      parserXml(
        await zip.texto(
          relacaoLayout.caminho,
        ),
      );

    const geometrias =
      new Map();

    const spTree =
      primeiro(
        documento,
        "spTree",
      );

    [
      ...(spTree?.children ?? []),
    ]
      .filter(
        (elemento) =>
          elemento.localName ===
          "sp",
      )
      .forEach(
        (shape) => {
          const chave =
            chavePlaceholder(
              shape,
            );

          if (!chave) {
            return;
          }

          geometrias.set(
            chave,
            geometria(
              shape,
              larguraSlide,
              alturaSlide,
            ),
          );
        },
      );

    return {
      geometrias,

      fundo:
        fundoSlide(
          documento,
          tema,
          null,
        ),
    };
  } catch {
    return {
      geometrias:
        new Map(),
      fundo: null,
    };
  }
}

function relacoesSlide(
  documento,
  caminhoSlide,
) {
  const mapa =
    new Map();

  if (!documento) {
    return mapa;
  }

  [
    ...documento
      .getElementsByTagNameNS(
        "*",
        "Relationship",
      ),
  ].forEach(
    (item) => {
      const id =
        item.getAttribute(
          "Id",
        );

      const target =
        item.getAttribute(
          "Target",
        );

      const tipo =
        item.getAttribute(
          "Type",
        ) ?? "";

      if (
        id &&
        target
      ) {
        mapa.set(
          id,
          {
            tipo,
            caminho:
              resolverCaminhoZip(
                caminhoSlide,
                target,
              ),
          },
        );
      }
    },
  );

  return mapa;
}

function blocoImagem(
  pic,
  larguraSlide,
  alturaSlide,
  relacoes,
  zIndex,
  contexto,
) {
  const blip =
    primeiro(
      pic,
      "blip",
    );

  const relId =
    blip?.getAttributeNS(
      "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
      "embed",
    ) ??
    blip?.getAttribute(
      "r:embed",
    );

  const relacao =
    relacoes.get(
      relId,
    );

  if (
    !relacao?.caminho
  ) {
    return null;
  }

  const srcRect =
    primeiro(
      pic,
      "srcRect",
    );

  return {
    tipo: "imagem",

    ...geometria(
      pic,
      larguraSlide,
      alturaSlide,
      contexto,
    ),

    midiaPath:
      relacao.caminho,

    crop: {
      esquerda:
        numeroAtributo(
          srcRect,
          "l",
          0,
        ),

      direita:
        numeroAtributo(
          srcRect,
          "r",
          0,
        ),

      topo:
        numeroAtributo(
          srcRect,
          "t",
          0,
        ),

      base:
        numeroAtributo(
          srcRect,
          "b",
          0,
        ),
    },

    zIndex,
  };
}

function blocoLinha(
  shape,
  larguraSlide,
  alturaSlide,
  tema,
  zIndex,
  contexto,
) {
  const linha =
    primeiro(
      shape,
      "ln",
    );

  const cor =
    corRgb(
      primeiro(
        linha,
        "solidFill",
      ),
      tema,
      null,
    );

  if (!cor) {
    return null;
  }

  return {
    tipo: "linha",

    ...geometria(
      shape,
      larguraSlide,
      alturaSlide,
      contexto,
    ),

    cor,
    espessura:
      numeroAtributo(
        linha,
        "w",
        12700,
      ),

    zIndex,
  };
}

function fundoSlide(
  documento,
  tema,
  fallback = "#FFFFFF",
) {
  const cSld =
    primeiro(
      documento,
      "cSld",
    );

  const bg =
    filhoDireto(
      cSld,
      "bg",
    );

  const bgPr =
    primeiro(
      bg,
      "bgPr",
    );

  const solid =
    primeiro(
      bgPr,
      "solidFill",
    );

  return (
    corRgb(
      solid,
      tema,
      null,
    ) ??
    fallback
  );
}

function mimeMidia(
  caminho,
) {
  const extensao =
    caminho
      .split(".")
      .pop()
      ?.toLowerCase();

  const tipos = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
  };

  return (
    tipos[extensao] ??
    "application/octet-stream"
  );
}

export async function carregarMidiasPptx(
  arquivoOuBlob,
  paginas,
) {
  const zip =
    await abrirZip(
      arquivoOuBlob,
    );

  const caminhos =
    new Set();

  (paginas ?? [])
    .forEach(
      (pagina) => {
        (
          pagina?.blocos ??
          []
        ).forEach(
          (bloco) => {
            if (
              bloco?.tipo ===
                "imagem" &&
              bloco.midiaPath
            ) {
              caminhos.add(
                bloco.midiaPath,
              );
            }
          },
        );
      },
    );

  const resultado = {};

  for (
    const caminho
    of caminhos
  ) {
    if (
      !zip.existe(
        caminho,
      )
    ) {
      continue;
    }

    const bytes =
      await zip.bytes(
        caminho,
      );

    const blob =
      new Blob(
        [bytes],
        {
          type:
            mimeMidia(
              caminho,
            ),
        },
      );

    resultado[caminho] =
      URL.createObjectURL(
        blob,
      );
  }

  return resultado;
}

export function revogarMidiasPptx(
  midias,
) {
  Object.values(
    midias ?? {},
  ).forEach(
    (url) => {
      if (
        typeof url ===
          "string" &&
        url.startsWith(
          "blob:",
        )
      ) {
        URL.revokeObjectURL(
          url,
        );
      }
    },
  );
}

export async function processarPptxAula(
  arquivo,
) {
  const zip =
    await abrirZip(
      arquivo,
    );

  const tema =
    await carregarTema(
      zip,
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
      primeiro(
        presentation,
        "sldSz",
      );

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

    const numero =
      numeroSlide(
        caminho,
      );

    const relPath =
      `ppt/slides/_rels/slide${numero}.xml.rels`;

    const relDoc =
      zip.existe(
        relPath,
      )
        ? parserXml(
            await zip.texto(
              relPath,
            ),
          )
        : null;

    const relacoes =
      relacoesSlide(
        relDoc,
        caminho,
      );

    const dadosLayout =
      await dadosLayoutSlide(
        zip,
        relacoes,
        largura,
        altura,
        tema,
      );

    const spTree =
      primeiro(
        documento,
        "spTree",
      );

    const blocos = [];

    let proximoZIndex = 0;

    function processarElemento(
      elemento,
      contexto,
    ) {
      if (!elemento) {
        return;
      }

      if (
        elemento.localName ===
        "grpSp"
      ) {
        const contextoFilhos =
          contextoGrupo(
            elemento,
            contexto,
          );

        [
          ...elemento.children,
        ].forEach(
          (filho) => {
            if (
              filho.localName ===
                "nvGrpSpPr" ||
              filho.localName ===
                "grpSpPr"
            ) {
              return;
            }

            processarElemento(
              filho,
              contextoFilhos,
            );
          },
        );

        return;
      }

      let bloco = null;

      if (
        elemento.localName ===
        "sp"
      ) {
        bloco =
          blocoShape(
            elemento,
            largura,
            altura,
            tema,
            proximoZIndex,
            contexto,
            dadosLayout
              .geometrias
              .get(
                chavePlaceholder(
                  elemento,
                ),
              ) ??
              null,
          );
      } else if (
        elemento.localName ===
        "pic"
      ) {
        bloco =
          blocoImagem(
            elemento,
            largura,
            altura,
            relacoes,
            proximoZIndex,
            contexto,
          );
      } else if (
        elemento.localName ===
        "cxnSp"
      ) {
        bloco =
          blocoLinha(
            elemento,
            largura,
            altura,
            tema,
            proximoZIndex,
            contexto,
          );
      }

      proximoZIndex += 1;

      if (bloco) {
        blocos.push(
          bloco,
        );
      }
    }

    const contexto =
      contextoRaiz();

    [
      ...(spTree?.children ?? []),
    ].forEach(
      (elemento) =>
        processarElemento(
          elemento,
          contexto,
        ),
    );

    paginas.push({
      numero:
        paginas.length + 1,

      largura,
      altura,

      fundo:
        fundoSlide(
          documento,
          tema,
          dadosLayout.fundo ??
            "#FFFFFF",
        ),

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
    versao: 3,
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
