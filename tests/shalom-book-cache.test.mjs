import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {buscarLivroCache,salvarLivroCache,limparCacheShalom} from "../apps/shalom/bookCache.js";
import {patchShalomBookCache} from "../apps/shalom/bookCachePatch.js";
test("conteúdo em memória pertence somente ao titular da conta",()=>{
  limparCacheShalom();
  salvarLivroCache("leitor-A","livro-1",{paginas:["Conteúdo privado A"]});
  assert.deepEqual(buscarLivroCache("leitor-A","livro-1"),{paginas:["Conteúdo privado A"]});
  assert.equal(buscarLivroCache("leitor-B","livro-1"),null);
  assert.equal(buscarLivroCache(null,"livro-1"),null);
  limparCacheShalom();
  assert.equal(buscarLivroCache("leitor-A","livro-1"),null);
});
test("patch só altera acesso ao cache do leitor Shalom",()=>{
  const source=readFileSync(new URL("../src/pages/LivroPage.jsx",import.meta.url),"utf8");
  const result=patchShalomBookCache(source);
  assert.match(result,/buscarLivroCache\(user\?\.id, id\)/);
  assert.equal((result.match(/salvarLivroCache\(\s*user\?\.id,/g)||[]).length,2);
  assert.ok(source.includes("buscarLivroCache(id)"));
  assert.throws(()=>patchShalomBookCache("não sou o leitor"),/busca não encontrada/);
});
