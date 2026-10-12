import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {shalomRecoveryRedirect,shalomRecoveryRequested} from "../apps/shalom/recoveryRedirect.js";

test("GitHub Pages usa raiz real e query para recuperar senha, nunca rota inexistente",()=>{
 assert.equal(shalomRecoveryRedirect("https://dalton755.github.io/verbo-app/shalom",true),
 "https://dalton755.github.io/verbo-app/shalom/?recuperar_senha=1");
 assert.equal(shalomRecoveryRedirect("https://dalton755.github.io/verbo-app/shalom/",true),
 "https://dalton755.github.io/verbo-app/shalom/?recuperar_senha=1");
 assert.equal(shalomRecoveryRequested("?recuperar_senha=1",true),true);
 assert.equal(shalomRecoveryRequested("?recuperar_senha=1",false),false);
});
test("Roteador BrowserRouter mantém rota normal",()=>{
 assert.equal(shalomRecoveryRedirect("https://shalom.nethanel.com.br",false),
 "https://shalom.nethanel.com.br/redefinir-senha");
});
test("Auth reage ao evento de recuperação da senha",()=>{
 const auth=readFileSync(new URL("../apps/shalom/auth.jsx",import.meta.url),"utf8");
 const app=readFileSync(new URL("../apps/shalom/App.jsx",import.meta.url),"utf8");
 assert.match(auth,/event==="PASSWORD_RECOVERY"/);
 assert.match(app,/shalomRecoveryRequested\(window.location.search,githubPagesPreview\)/);
});
