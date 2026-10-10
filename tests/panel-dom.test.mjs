import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../apps/biblioteca');
const get=(name)=>readFileSync(path.join(root,name),'utf8');

test('componentes de admin.js possuem IDs no HTML',()=>{
  const html=get('admin.html');const js=get('admin.js');
  const ids=[...js.matchAll(/\$\('([^']+)'\)/g)].map(match=>match[1]);
  const expected=new Set(ids);
  const missing=[...expected].filter(id=>!html.includes(`id="${id}"`));
  assert.deepEqual(missing,[]);
});
test('componentes de main.js possuem IDs no HTML',()=>{
  const html=get('index.html');const js=get('main.js');
  const ids=[...js.matchAll(/byId\('([^']+)'\)/g)].map(match=>match[1]);
  const missing=[...new Set(ids)].filter(id=>!html.includes(`id="${id}"`));
  assert.deepEqual(missing,[]);
});
test('identidade Google tem um botão único',()=>{
  assert.equal((get('admin.html').match(/id="google-login"/g)||[]).length,1);
});
test('a interface admin não promove visitantes automaticamente',()=>{
  assert.equal(get('admin.js').includes("'verbo_admin_identidade'"),true);
  assert.equal(get('admin.js').includes('service_role:'),false);
});

test('configuração pública é importada como módulo e entra no bundle Vite',()=>{
  assert.match(get('admin.js'),/^import '\.\/config\.js';/);
  assert.match(get('main.js'),/^import '\.\/config\.js';/);
  assert.doesNotMatch(get('admin.html'),/<script src="\.\/config\.js"><\/script>/);
  assert.doesNotMatch(get('index.html'),/<script src="\.\/config\.js"><\/script>/);
});
test('botão de exclusão de rascunho possui confirmação, filtro de status e limpeza do Storage',()=>{
  const html=get('admin.html'),js=get('admin.js');
  for(const id of ['delete-backdrop','delete-draft','delete-confirm','delete-cancel','delete-message'])assert.ok(html.includes('id="'+id+'"'));
  assert.match(html,/role="alertdialog"/);
  assert.match(js,/item\.status==='rascunho'/);
  assert.match(js,/\.eq\('status','rascunho'\)\.select\('id'\)/);
  assert.match(js,/validateDraftDeletion/);
  assert.match(js,/\.remove\(paths\)/);
});

test('capas reais são apresentadas na biblioteca e podem ser revistas pelo gestor',()=>{
 const html=get('admin.html'),js=get('admin.js'),publicJs=get('main.js');
 for(const id of ['cover-generate','cover-choose','cover-upload','edit-cover-img','edit-cover-empty'])assert.ok(html.includes('id="'+id+'"'));
 assert.match(js,/renderPdfCoverPage/);
 assert.match(js,/persistMaterialCover/);
 assert.match(js,/\.upload\(path,blob/);
 assert.match(publicJs,/loadProtectedCover/);
 assert.match(publicJs,/storage\/v1\/object\/authenticated/);
 assert.match(js,/capa_url/);
});
