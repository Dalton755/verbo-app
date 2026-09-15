import * as pdfjsLib
  from "pdfjs-dist";

import pdfWorker
  from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  pdfWorker;

function normalizarTexto(texto = "") {
  return texto
    .replace(/\s+/g, " ")
    .trim();
}

function mediana(valores = []) {
  if (valores.length === 0) {
    return 12;
  }

  const ordenados = [
    ...valores,
  ].sort(
    (a, b) => a - b,
  );

  const meio =
    Math.floor(
      ordenados.length / 2,
    );

  if (
    ordenados.length % 2 === 0
  ) {
    return (
      ordenados[meio - 1] +
      ordenados[meio]
    ) / 2;
  }

  return ordenados[meio];
}

function agruparLinhas(
  items,
  larguraPagina,
) {
  const elementos =
    items
      .filter(
        (item) =>
          typeof item?.str ===
            "string" &&
          item.str.trim(),
      )
      .map(
        (item) => {
          const transform =
            item.transform;

          const tamanhoFonte =
            Math.max(
              Math.hypot(
                transform[2],
                transform[3],
              ),
              1,
            );

          return {
            texto:
              normalizarTexto(
                item.str,
              ),

            x:
              Number(
                transform[4],
              ),

            y:
              Number(
                transform[5],
              ),

            largura:
              Math.max(
                Number(
                  item.width,
                ) || 0,
                1,
              ),

            tamanhoFonte,
          };
        },
      )
      .sort(
        (a, b) => {
          const diferencaY =
            b.y - a.y;

          if (
            Math.abs(
              diferencaY,
            ) > 2.5
          ) {
            return diferencaY;
          }

          return a.x - b.x;
        },
      );

  const linhas = [];

  for (
    const elemento
    of elementos
  ) {
    const tolerancia =
      Math.max(
        2.5,
        elemento.tamanhoFonte *
          0.18,
      );

    let linha =
      linhas.find(
        (atual) =>
          Math.abs(
            atual.y -
              elemento.y,
          ) <= tolerancia,
      );

    if (!linha) {
      linha = {
        y:
          elemento.y,

        itens: [],
      };

      linhas.push(
        linha,
      );
    }

    linha.itens.push(
      elemento,
    );
  }

  return linhas
    .sort(
      (a, b) =>
        b.y - a.y,
    )
    .flatMap(
      (linha) => {
        const itens =
          linha.itens.sort(
            (a, b) =>
              a.x - b.x,
          );

        const segmentos = [];

        let segmentoAtual = null;

        for (
          const item
          of itens
        ) {
          const distancia =
            segmentoAtual
              ? item.x -
                segmentoAtual.fimX
              : 0;

          const limite =
            Math.max(
              20,
              larguraPagina *
                0.03,
              item.tamanhoFonte *
                1.6,
            );

          /*
           * Um espaço horizontal muito
           * grande provavelmente representa
           * outra coluna ou outro bloco.
           */
          if (
            !segmentoAtual ||
            distancia > limite
          ) {
            segmentoAtual = {
              texto:
                item.texto,

              x:
                item.x,

              y:
                linha.y,

              fimX:
                item.x +
                item.largura,

              tamanhoFonte:
                item.tamanhoFonte,
            };

            segmentos.push(
              segmentoAtual,
            );
          } else {
            segmentoAtual.texto =
              normalizarTexto(
                `${segmentoAtual.texto} ${item.texto}`,
              );

            segmentoAtual.fimX =
              Math.max(
                segmentoAtual.fimX,
                item.x +
                  item.largura,
              );

            segmentoAtual.tamanhoFonte =
              Math.max(
                segmentoAtual
                  .tamanhoFonte,

                item.tamanhoFonte,
              );
          }
        }

        return segmentos;
      },
    );
}

function unirTexto(
  anterior,
  atual,
) {
  if (
    anterior.endsWith("-") &&
    /^[a-záéíóúâêôãõç]/u
      .test(atual)
  ) {
    return (
      anterior.slice(
        0,
        -1,
      ) +
      atual
    );
  }

  return `${anterior} ${atual}`;
}

function criarBlocos(
  linhas,
  larguraPagina,
) {
  if (
    linhas.length === 0
  ) {
    return [];
  }

  const fonteMediana =
    mediana(
      linhas.map(
        (linha) =>
          linha.tamanhoFonte,
      ),
    );

  const blocos = [];

  for (
    const linha
    of linhas
  ) {
    const texto =
      normalizarTexto(
        linha.texto,
      );

    if (!texto) {
      continue;
    }

    const textoCurto =
      texto.length <= 140;

    const fonteMaior =
      linha.tamanhoFonte >=
        fonteMediana * 1.28;

    const somenteMaiusculas =
      texto.length <= 100 &&
      texto ===
        texto.toLocaleUpperCase(
          "pt-BR",
        ) &&
      /[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/u
        .test(texto);

    const pareceTitulo =
      textoCurto &&
      (
        fonteMaior ||
        somenteMaiusculas
      );

    if (pareceTitulo) {
      blocos.push({
        tipo:
          "titulo",

        texto,

        x:
          linha.x,

        y:
          linha.y,

        tamanhoFonte:
          linha.tamanhoFonte,
      });

      continue;
    }

    const ultimo =
      blocos[
        blocos.length - 1
      ];

    const mesmaColuna =
      ultimo?.tipo ===
        "texto" &&
      typeof ultimo.x ===
        "number" &&
      Math.abs(
        ultimo.x -
          linha.x,
      ) <=
        larguraPagina *
          0.05;

    const distanciaVertical =
      ultimo &&
      typeof ultimo.y ===
        "number"
        ? ultimo.y -
          linha.y
        : Infinity;

    const linhaProxima =
      distanciaVertical <=
        Math.max(
          ultimo?.tamanhoFonte ||
            fonteMediana,

          linha.tamanhoFonte,
        ) *
          1.9;

    if (
      ultimo?.tipo ===
        "texto" &&
      mesmaColuna &&
      linhaProxima
    ) {
      ultimo.texto =
        normalizarTexto(
          unirTexto(
            ultimo.texto,
            texto,
          ),
        );

      ultimo.y =
        linha.y;

      ultimo.tamanhoFonte =
        Math.max(
          ultimo.tamanhoFonte,
          linha.tamanhoFonte,
        );

      continue;
    }

    blocos.push({
      tipo:
        "texto",

      texto,

      x:
        linha.x,

      y:
        linha.y,

      tamanhoFonte:
        linha.tamanhoFonte,
    });
  }

  return blocos;
}

export async function processarPdfLivro(
  arquivo,
) {
  if (!arquivo) {
    throw new Error(
      "Arquivo PDF não informado.",
    );
  }

  const buffer =
    await arquivo.arrayBuffer();

  const pdf =
    await pdfjsLib
      .getDocument({
        data:
          new Uint8Array(
            buffer,
          ),
      })
      .promise;

  try {
    const paginas = [];

    for (
      let numero = 1;
      numero <=
        pdf.numPages;
      numero += 1
    ) {
      const pagina =
        await pdf.getPage(
          numero,
        );

      const conteudo =
        await pagina
          .getTextContent();

      const viewport =
        pagina.getViewport({
          scale: 1,
        });

      const linhas =
        agruparLinhas(
          conteudo.items,
          viewport.width,
        );

      paginas.push({
        numero,

        blocos:
          criarBlocos(
            linhas,
            viewport.width,
          ),
      });
    }

    return {
      versao: 1,

      totalPaginas:
        pdf.numPages,

      paginas,
    };
  } finally {
    if (
      pdf &&
      typeof pdf.destroy ===
        "function"
    ) {
      await pdf.destroy();
    }
  }
}