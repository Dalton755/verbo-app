import {
  extrairReferenciasBiblicas,
} from "../lib/bibleReferences";

function BibleLinkedText({
  texto,
  onReferencia,
}) {
  const referencias =
    extrairReferenciasBiblicas(
      texto,
    );

  if (
    referencias.length === 0
  ) {
    return texto;
  }

  const partes = [];

  let cursor = 0;

  referencias
    .sort(
      (a, b) =>
        a.indiceInicio -
        b.indiceInicio,
    )
    .forEach(
      (
        referencia,
        indice,
      ) => {
        const inicio =
          referencia.indiceInicio;

        const fim =
          referencia.indiceFim;

        if (inicio > cursor) {
          partes.push(
            <span
              key={`texto-${indice}`}
            >
              {texto.slice(
                cursor,
                inicio,
              )}
            </span>,
          );
        }

        partes.push(
          <button
            key={`ref-${indice}-${inicio}`}
            type="button"
            className="sermon-bible-link"
            onClick={() =>
              onReferencia(
                referencia,
              )
            }
          >
            {texto.slice(
              inicio,
              fim,
            )}
          </button>,
        );

        cursor = Math.max(
          cursor,
          fim,
        );
      },
    );

  if (
    cursor < texto.length
  ) {
    partes.push(
      <span key="texto-final">
        {texto.slice(cursor)}
      </span>,
    );
  }

  return partes;
}

export default BibleLinkedText;