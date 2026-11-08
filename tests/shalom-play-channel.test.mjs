import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {isShalomPlayOrigin,detectShalomPlayChannel,SHALOM_PLAY_PACKAGE,SHALOM_PLAY_SKU} from "../apps/shalom/playChannel.js";

test("Separação entre Play e web",()=>{
  assert.equal(SHALOM_PLAY_PACKAGE,"br.com.nethanel.shalom");
  assert.equal(SHALOM_PLAY_SKU,"shalom_mensal");
  assert.equal(isShalomPlayOrigin(),false);
  assert.equal(isShalomPlayOrigin("?platform=googleplay"),true);
  assert.equal(isShalomPlayOrigin("","android-app://br.com.nethanel.shalom/"),true);
  assert.equal(isShalomPlayOrigin("","android-app://br.com.nethanel.elo/"),false);
  assert.equal(isShalomPlayOrigin("","",true),true);
});
test("Canal preservado na sessão da TWA",()=>{
  const map=new Map();
  const win={location:{search:"?platform=googleplay"},document:{referrer:""},sessionStorage:{getItem:k=>map.get(k),setItem:(k,v)=>map.set(k,v)}};
  assert.equal(detectShalomPlayChannel(win),true);
  win.location.search="";
  assert.equal(detectShalomPlayChannel(win),true);
  assert.equal(detectShalomPlayChannel({location:{search:""},document:{referrer:""}}),false);
  assert.equal(detectShalomPlayChannel(null),false);
});
test("Nenhum checkout Asaas exposto no canal Play",()=>{
  const source=readFileSync(new URL("../apps/shalom/App.jsx",import.meta.url),"utf8");
  assert.match(source,/const checkoutEnabled=!googlePlayChannel &&/);
  assert.match(source,/if\(googlePlayChannel\)\{setPayError/);
  assert.match(source,/\{!googlePlayChannel&&podeIniciarCheckout/);
  assert.match(source,/\{!googlePlayChannel&&\(paymentLink/);
});
