import test from "node:test";
import assert from "node:assert/strict";

import {
    extrairReferenciasBiblicas,
    extrairContinuacoesBiblicas,
} from "../src/lib/bibleReferences.js";
import { criarHotspotsBiblicosPdf } from "../src/lib/pdfBibleHotspots.js";

test("reconhece referências normais e espaçadas de slides em PDF", () => {
    const exemplos = [
        ["Efésios 4:7–16", ["Efésios 4:7-16"]],
        ["E F É S I O S  4 : 7 – 1 6", ["Efésios 4:7-16"]],
        ["1  CO R Í N T I O S  1 2 : 4 – 1 1", ["1 Coríntios 12:4-11"]],
        ["R O M A N O S  1 2 : 6 – 8", ["Romanos 12:6-8"]],
        ["1  P E D R O  4 : 1 0", ["1 Pedro 4:10"]],
        ["Ê XO D O  3 1 : 1 – 5", ["Êxodo 31:1-5"]],
        ["J U Í Z E S  1 4 : 6", ["Juízes 14:6"]],
        ["1  S A M U E L  1 6 : 1 3", ["1 Samuel 16:13"]],
        ["ATO S  1 8", ["Atos 18"]],
        ["Jo 3.3; 20.22; 15.5; 2Co 5.17", [
            "João 3:3", "João 20:22", "João 15:5", "2 Coríntios 5:17",
        ]],
    ];
    for (const [texto, esperadas] of exemplos) {
        const refs = extrairReferenciasBiblicas(texto);
        assert.deepEqual(refs.map((r) => r.referencia), esperadas, texto);
        for (const r of refs) {
            assert.equal(texto.slice(r.indiceInicio, r.indiceFim), r.textoOriginal);
        }
    }
});

test("reconhece várias passagens na mesma linha e continuações de capítulo", () => {
    const exemplos = [
        ["1  CO R Í N T I O S  1 2 : 7  ·  G Á L ATA S  5 : 2 2 – 2 3", [
            "1 Coríntios 12:7", "Gálatas 5:22-23",
        ]],
        ["1  CO R Í N T I O S  1 : 1 1  ·  1 4 : 2 6 – 3 3", [
            "1 Coríntios 1:11", "1 Coríntios 14:26-33",
        ]],
        ["1 CORÍNTIOS 14:5, 27–28", ["1 Coríntios 14:5,27-28"]],
    ];
    for (const [texto, esperado] of exemplos) {
        assert.deepEqual(extrairReferenciasBiblicas(texto).map((r) => r.referencia), esperado);
    }
    const lista = extrairReferenciasBiblicas("1 CORÍNTIOS 14:5, 27–28")[0];
    assert.deepEqual(lista.versiculosExtras, [27, 28]);

    assert.equal(extrairReferenciasBiblicas("Atos 2")[0].capituloCompleto, true);
    assert.equal(extrairContinuacoesBiblicas(
        "1 4 : 2 6 – 3 3", { livro: "1 Coríntios", livroApi: "1 Corinthians" },
    )[0].referencia, "1 Coríntios 14:26-33");
});

test("mantém links repetidos em posições distintas do PDF", () => {
    const texto = "João 3:16 e João 3:16";
    const refs = extrairReferenciasBiblicas(texto);
    assert.equal(refs.length, 2);
    assert.notEqual(refs[0].indiceInicio, refs[1].indiceInicio);
});

test("cria hotspots com geometria correta quando a referência é fragmentada", () => {
    const itensTexto = [
        { str: "1  CO R Í N T I O S", width: 150, transform: [12, 0, 0, 12, 20, 120] },
        { str: "1 2 : 4 – 1 1", width: 120, transform: [12, 0, 0, 12, 174, 120] },
        { str: "R O M A N O S  1 2 : 6 – 8", width: 190, transform: [12, 0, 0, 12, 20, 170] },
    ];
    const result = criarHotspotsBiblicosPdf({
        itensTexto, numeroPagina: 3,
        viewport: { transform: [1, 0, 0, 1, 0, 0], scale: 1 },
        transformar: (_viewport, item) => item,
    });
    assert.deepEqual(result.referencias.map((r) => r.referencia), [
        "1 Coríntios 12:4-11", "Romanos 12:6-8",
    ]);
    assert.equal(result.hotspots.length, 2);
    assert.ok(result.hotspots.every((h) => h.width > 0 && h.height > 0));
    assert.ok(result.hotspots[0].width > 250);
});
