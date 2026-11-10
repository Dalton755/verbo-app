import { extrairReferenciasBiblicas } from "./bibleReferences.js";

// Agrupa itens do PDF.js por linha e mapeia a parte clicável aos fragmentos
// reais da página. Um livro e seus números podem estar em itens separados.
export function criarHotspotsBiblicosPdf({ itensTexto = [], viewport, numeroPagina, transformar }) {
    const linhas = [];
    for (const [indice, item] of itensTexto.entries()) {
        if (!item?.str?.trim()) continue;
        const matrix = transformar(viewport.transform, item.transform);
        const fontSize = Math.max(Math.hypot(matrix[2], matrix[3]), 8);
        const segmento = {
            id: indice, texto: item.str, left: matrix[4],
            baseline: matrix[5], top: matrix[5] - fontSize,
            width: Math.max(Number(item.width || 0) * viewport.scale, 2),
            height: fontSize * 1.25, fontSize,
        };
        const linha = linhas.find((l) =>
            Math.abs(l.baseline - segmento.baseline) <=
            Math.max(3, Math.min(l.fontSize, fontSize) * 0.45));
        if (linha) linha.segmentos.push(segmento);
        else linhas.push({ baseline: segmento.baseline, fontSize, segmentos: [segmento] });
    }

    const hotspots = [];
    const referencias = [];
    const referenciasUnicas = new Set();
    for (const linha of linhas) {
        const segmentos = linha.segmentos.sort((a, b) => a.left - b.left);
        let textoLinha = "";
        const indices = segmentos.map((s) => {
            if (textoLinha) textoLinha += " ";
            const inicio = textoLinha.length;
            textoLinha += s.texto;
            return { ...s, inicio, fim: textoLinha.length };
        });

        for (const referencia of extrairReferenciasBiblicas(textoLinha)) {
            let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
            for (const s of indices) {
                const inicio = Math.max(referencia.indiceInicio, s.inicio);
                const fim = Math.min(referencia.indiceFim, s.fim);
                if (fim <= inicio) continue;
                const tamanho = Math.max(s.texto.length, 1);
                const x0 = s.left + s.width * ((inicio - s.inicio) / tamanho);
                const x1 = s.left + s.width * ((fim - s.inicio) / tamanho);
                left = Math.min(left, x0); right = Math.max(right, x1);
                top = Math.min(top, s.top); bottom = Math.max(bottom, s.top + s.height);
            }
            if (!Number.isFinite(left) || right <= left) continue;
            hotspots.push({
                ...referencia, id: numeroPagina + "-biblica-" + hotspots.length,
                left: Math.max(0, left - 3), top: Math.max(0, top - 3),
                width: Math.max(right - left + 6, 22),
                height: Math.max(bottom - top + 6, 18),
            });
            if (!referenciasUnicas.has(referencia.referencia)) {
                referenciasUnicas.add(referencia.referencia);
                referencias.push(referencia);
            }
        }
    }
    return { referencias, hotspots };
}
