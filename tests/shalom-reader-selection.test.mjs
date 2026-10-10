import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {patchShalomReaderSelection} from "../apps/shalom/readerSelectionPatch.js";

const source=readFileSync(new URL("../src/pages/LivroPage.jsx",import.meta.url),"utf8");
const transformed=patchShalomReaderSelection(source);
test("ações de seleção ficam ancoradas junto ao texto, acima das sugestões Android",()=>{
  assert.match(transformed,/--shalom-selection-toolbar-top/);
  assert.match(transformed,/reservaInferior = window.innerWidth <= 760 \? 165 : 72/);
});
test("paleta não perde a seleção ao tocar nos botões de nota ou cor",()=>{
  assert.match(transformed,/onPointerDownCapture=\{\(event\) => event.preventDefault\(\)\}/);
  assert.match(transformed,/onMouseDownCapture=\{\(event\) => event.preventDefault\(\)\}/);
});
test("paleta oferece nota e significado sem duas bolhas concorrentes",()=>{
  assert.match(transformed,/shalom-highlight-note-label/);
  assert.match(transformed,/shalom-highlight-meaning/);
  assert.match(transformed,/Boolean\(selecaoDestaque\)/);
});
test("não transforma conteúdo indevido e preserva código compartilhado",()=>{
  assert.match(source,/className="book-highlight-toolbar"/);
  assert.doesNotMatch(source,/--shalom-selection-toolbar-top/);
  assert.throws(()=>patchShalomReaderSelection("não é o leitor"),/expected 1 match/);
});
