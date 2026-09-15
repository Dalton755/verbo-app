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

function mediana(numeros = []) {
  if (numeros.length === 0) {
    return 12;
  }

  const ordenados = [
    ...numeros,
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
  pageWidth,
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

          const fontSize =
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
              transform[4],

            y:
              transform[5],

            width:
              Math.max(
                Number(
                  item.width,
                ) || 0,
                1,
              ),

            fontSize,
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
        elemento.fontSize *
          0.18,
      );

    let linha =
      linhas.find(
        (item) =>
          Math.abs(
            item.y -
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
    .map(
      (linha) => {
        const itens =
          linha.itens.sort(
            (a, b) =>
              a.x - b.x,
          );

        const segmentos = [];

        let atual = null;

        for (
          const item
          of itens
        ) {
          const gap =
            atual
              ? item.x -
                atual.endX
              : 0;

          const limiteGap =
            Math.max(
              18,
              pageWidth *
                0.025,
              item.fontSize *
                1.4,
            );

          if (
            !atual ||
            gap > limiteGap
          ) {
            atual = {
              texto:
                item.texto,

              x:
                item.x,

              y:
                linha.y,

              endX:
                item.x +
                item.width,

              fontSize:
                item.fontSize,
            };

            segmentos.push(
              atual,
            );
          } else {
            atual.texto =
              normalizarTexto(
                `${atual.texto} ${item.texto}`,
              );

            atual.fontSize =
              Math.max(
                atual.fontSize,
                item.fontSize,
              );

            atual.endX =
              Math.max(
                atual.endX,
                item.x +
                  item.width,
              );
          }
        }

        return {
          y:
            linha.y,

          segmentos,
        };
      });
}

function criarBlocos(
  linhas,
  pageWidth,
  numeroPagina,
) {
  const todosSegmentos =
    linhas.flatMap(
      (linha) =>
        linha.segmentos,
    );

  const tamanhoMediano =
    mediana(
      todosSegmentos.map(
        (item) =>
          item.fontSize,
      ),
    );

  const blocos = [];

  for (
    let indiceLinha = 0;
    indiceLinha <
    linhas.length;
    indiceLinha += 1
  ) {
    const linha =
      linhas[indiceLinha];

    const segmentos =
      linha.segmentos;

    /*
     * Detecta ficha técnica/tabela
     * nas páginas iniciais.
     */
    if (
      numeroPagina <= 2 &&
      segmentos.length >= 2
    ) {
      const esquerda =
        segmentos[0];

      const direita =
        segmentos[1];

      const pareceRotulo =
        esquerda.texto.length <=
          30 &&
        esquerda.x <
          pageWidth * 0.35 &&
        direita.x >
          esquerda.x +
            pageWidth *
              0.08;

      if (pareceRotulo) {
        let textoCampo =
          segmentos
            .slice(1)
            .map(
              (item) =>
                item.texto,
            )
            .join(" ");

        let proximaLinha =
          indiceLinha + 1;

        while (
          proximaLinha <
          linhas.length
        ) {
          const seguinte =
            linhas[
              proximaLinha
            ];

          if (
            seguinte.segmentos
              .length !== 1
          ) {
            break;
          }

          const segmento =
            seguinte
              .segmentos[0];

          const mesmaColuna =
            segmento.x >
              pageWidth *
                0.30 &&
            Math.abs(
              segmento.x -
                direita.x,
            ) <
              pageWidth *
                0.15;

          const distancia =
            linhas[
              proximaLinha -
                1
            ].y -
            seguinte.y;

          const perto =
            distancia <
            Math.max(
              segmento.fontSize *
                2.3,
              30,
            );

          if (
            !mesmaColuna ||
            !perto
          ) {
            break;
          }

          textoCampo =
            normalizarTexto(
              `${textoCampo} ${segmento.texto}`,
            );

          proximaLinha += 1;
        }

        blocos.push({
          tipo:
            "campo",

          rotulo:
            esquerda.texto,

          texto:
            normalizarTexto(
              textoCampo,
            ),
        });

        indiceLinha =
          proximaLinha - 1;

        continue;
      }
    }

    for (
      const segmento
      of segmentos
    ) {
      const texto =
        segmento.texto;

      const pareceItem =
        /^([•▪◦‣-]|\d+[.)]|[IVXLCDM]+[.)])\s+/iu
          .test(
            texto,
          );

      const maiusculoCurto =
        texto.length <
          120 &&
        texto ===
          texto.toLocaleUpperCase(
            "pt-BR",
          ) &&
        /[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/u
          .test(
            texto,
          );

      const fonteDestaque =
        segmento.fontSize >=
          tamanhoMediano *
            1.28;

      const pareceTitulo =
        texto.length <
          130 &&
        (
          fonteDestaque ||
          maiusculoCurto
        );

      const tipo =
        pareceTitulo
          ? "titulo"
          : pareceItem
            ? "item"
            : "texto";

      const ultimo =
        blocos[
          blocos.length - 1
        ];

      const mesmaColuna =
        ultimo &&
        typeof ultimo.x ===
          "number" &&
        Math.abs(
          ultimo.x -
            segmento.x,
        ) <=
          pageWidth *
            0.045;

      const distanciaVertical =
        ultimo &&
        typeof ultimo.y ===
          "number"
          ? ultimo.y -
            linha.y
          : Infinity;

      if (
        tipo === "texto" &&
        ultimo?.tipo ===
          "texto" &&
        mesmaColuna &&
        distanciaVertical <=
          Math.max(
            ultimo.fontSize,
            segmento.fontSize,
          ) *
            1.9
      ) {
        ultimo.texto =
          normalizarTexto(
            `${ultimo.texto} ${texto}`,
          );

        ultimo.y =
          linha.y;

        ultimo.fontSize =
          Math.max(
            ultimo.fontSize,
            segmento.fontSize,
          );

        continue;
      }

      blocos.push({
        tipo,

        texto,

        x:
          segmento.x,

        y:
          linha.y,

        fontSize:
          segmento.fontSize,
      });
    }
  }

  return blocos.filter(
    (bloco) =>
      bloco.texto,
  );
}

export async function processarPdfSermao(
  arquivo,
) {
  if (!arquivo) {
    throw new Error(
      "Arquivo PDF não informado.",
    );
  }

  const arrayBuffer =
    await arquivo.arrayBuffer();

  const pdf =
    await pdfjsLib
      .getDocument({
        data:
          new Uint8Array(
            arrayBuffer,
          ),
      })
      .promise;

  try {
    const paginas = [];

    for (
      let numero = 1;
      numero <= pdf.numPages;
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
            numero,
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