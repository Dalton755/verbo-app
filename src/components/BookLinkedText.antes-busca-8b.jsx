import {
    StickyNote,
} from "lucide-react";

import {
    extrairReferenciasBiblicas,
} from "../lib/bibleReferences";


function classeCorDestaque(
    cor,
) {
    switch (cor) {
        case "VERDE":
            return "book-highlight-green";

        case "AZUL":
            return "book-highlight-blue";

        case "ROSA":
            return "book-highlight-pink";

        case "AMARELO":
        default:
            return "book-highlight-yellow";
    }
}


function BookLinkedText({
    texto,
    onReferencia,
    onDestaque,
    onNota,
    destaques = [],
    notas = [],
}) {
    const referencias =
        extrairReferenciasBiblicas(
            texto,
        );

    const limites =
        new Set([
            0,
            texto.length,
        ]);

    referencias.forEach(
        (referencia) => {
            limites.add(
                referencia.indiceInicio,
            );

            limites.add(
                referencia.indiceFim,
            );
        },
    );

    destaques.forEach(
        (destaque) => {
            limites.add(
                Math.max(
                    0,
                    destaque.inicio,
                ),
            );

            limites.add(
                Math.min(
                    texto.length,
                    destaque.fim,
                ),
            );
        },
    );

    /*
     * Precisamos quebrar o texto
     * exatamente onde uma nota
     * termina para colocar seu
     * pequeno marcador ali.
     */
    notas.forEach(
        (nota) => {
            limites.add(
                Math.min(
                    texto.length,

                    Math.max(
                        0,
                        Number(
                            nota.fim,
                        ),
                    ),
                ),
            );
        },
    );

    const pontos =
        Array.from(
            limites,
        )
            .filter(
                (valor) =>
                    valor >= 0 &&
                    valor <=
                    texto.length,
            )
            .sort(
                (a, b) =>
                    a - b,
            );

    const partes = [];

    for (
        let indice = 0;
        indice <
        pontos.length - 1;
        indice += 1
    ) {
        const inicio =
            pontos[indice];

        const fim =
            pontos[indice + 1];

        if (
            fim <= inicio
        ) {
            continue;
        }

        const conteudo =
            texto.slice(
                inicio,
                fim,
            );

        const referencia =
            referencias.find(
                (item) =>
                    inicio >=
                        item.indiceInicio &&
                    fim <=
                        item.indiceFim,
            );

        const destaque =
            destaques.find(
                (item) =>
                    inicio >=
                        item.inicio &&
                    fim <=
                        item.fim,
            );

        const classeDestaque =
            destaque
                ? `book-text-highlight ${classeCorDestaque(
                    destaque.cor,
                )}`
                : "";

        if (referencia) {
            partes.push(
                <button
                    key={`parte-${inicio}-${fim}`}
                    type="button"
                    className={[
                        "sermon-bible-link",
                        classeDestaque,
                    ]
                        .filter(Boolean)
                        .join(" ")}
                    onClick={() =>
                        onReferencia(
                            referencia,
                        )
                    }
                >
                    {conteudo}
                </button>,
            );
        } else {
            partes.push(
                <span
                    key={`parte-${inicio}-${fim}`}
                    className={
                        classeDestaque
                    }
                    data-highlight-id={
                        destaque?.id ??
                        undefined
                    }
                    onClick={
                        destaque &&
                        onDestaque
                            ? () => {
                                const selection =
                                    window.getSelection();

                                if (
                                    selection &&
                                    !selection.isCollapsed
                                ) {
                                    return;
                                }

                                onDestaque({
                                    id:
                                        destaque.id,

                                    cor:
                                        destaque.cor,
                                });
                            }
                            : undefined
                    }
                >
                    {conteudo}
                </span>,
            );
        }

        /*
         * Uma ou mais notas podem
         * terminar neste mesmo ponto.
         */
        const notasNestePonto =
            notas.filter(
                (nota) =>
                    Number(
                        nota.fim,
                    ) === fim,
            );

        notasNestePonto.forEach(
            (nota) => {
                partes.push(
                    <button
                        key={`nota-${nota.id}`}
                        type="button"
                        className="book-note-anchor"
                        title="Abrir nota"
                        aria-label="Abrir nota"
                        onClick={(event) => {
                            event.stopPropagation();

                            onNota?.(
                                nota,
                            );
                        }}
                    >
                        <StickyNote
                            size={12}
                        />
                    </button>,
                );
            },
        );
    }

    return partes;
}


export default BookLinkedText;