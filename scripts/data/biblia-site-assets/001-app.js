window.addEventListener("error", function(ev){
  var v = document.getElementById("view");
  if(v) v.innerHTML = '<h1 class="bookname">Erro no script</h1>' +
    '<p class="note" style="margin-top:1.5rem">' + (ev.message || "") +
    '<br><br>linha ' + (ev.lineno || "?") + ', coluna ' + (ev.colno || "?") + '</p>';
});
(function(){
"use strict";

var SOURCES = {
  A:{file:"/data/alm1911m.json", label:"ortografia atualizada"},
  B:{file:"/data/alm1911.json",  label:"texto original de 1911"} };
var AT_COUNT = 39;

var state = { ver:"A", data:{}, book:18, chap:22, mode:"read", size:4 };
var norm = {}, TIT = {};

/* ---------- endereço real: /salmos/23/ ---------- */
function slug(n){
  return n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")
          .replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
}
function caminho(){
  var b = books()[state.book];
  return "/" + slug(b.n) + "/" + (state.chap + 1) + "/";
}
function verseVisivel(){
  var vs = view.querySelectorAll(".v"), lim = 130;
  for(var i=0;i<vs.length;i++) if(vs[i].getBoundingClientRect().bottom > lim) return i + 1;
  return 1;
}
function gravaURL(empurrar){
  if(state.mode !== "read") return;
  var v = verseVisivel(), u = caminho() + (v > 1 ? "#v" + v : "");
  try{ empurrar ? history.pushState(null, "", u) : history.replaceState(null, "", u); }catch(e){}
}
function leURL(){
  var m = /^\/([^\/]+)\/(\d+)\/?$/.exec(location.pathname);
  if(!m) return null;
  var bs = books();
  for(var i=0;i<bs.length;i++){
    if(slug(bs[i].n) === decodeURIComponent(m[1])){
      return { book:i, chap: Math.max(1, Math.min(bs[i].c.length, +m[2])) - 1,
               verse: (/^#v(\d+)$/.exec(location.hash) || [0,1])[1] };
    }
  }
  return null;
}
function irParaVersiculo(n){
  n = +n; if(!n || n < 2) return;
  var el = document.getElementById("v" + n);
  if(el) el.scrollIntoView({block:"start"});
}

var PREF = (function(){ try{ return JSON.parse(localStorage.getItem("ba.prefs")||"{}"); }
                        catch(e){ return {}; } })();
if(PREF.versao){ delete PREF.versao;
  try{ localStorage.setItem("ba.prefs", JSON.stringify(PREF)); }catch(e){} }
function salvaPref(k,v){
  PREF[k]=v;
  try{ localStorage.setItem("ba.prefs", JSON.stringify(PREF)); }catch(e){}
}


var $ = function(s){ return document.querySelector(s); };
var view = $("#view"), side = $("#side"), rail = $("#rail"), chaps = $("#chaps");

function strip(s){ return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,""); }
function esc(s){ return s.replace(/[&<>"]/g, function(c){
  return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]; }); }
function books(){ return state.data[state.ver]; }

function load(ver){
  if(state.data[ver]) return Promise.resolve();
  return fetch(SOURCES[ver].file)
    .then(function(r){ if(!r.ok) throw new Error(r.status); return r.json(); })
    .then(function(j){ state.data[ver] = j; });
}
function boom(e){
  view.innerHTML = '<h1 class="bookname">Erro</h1><p class="note" style="margin-top:1.5rem">'+
                   String(e && e.message ? e.message : e)+'</p>';
}
function fail(){
  view.innerHTML = '<h1 class="bookname">Texto não carregado</h1>' +
    '<p class="note" style="margin-top:1.5rem">Os arquivos do diretório <code>data/</code> precisam ' +
    'ser entregues por um servidor web. Na pasta do site, execute <code>python3 -m http.server</code> ' +
    'e acesse <code>localhost:8000</code>.</p>';
}

function buildSide(){
  var bs = books(), html = '<div class="side-label">Velho Testamento</div>';
  bs.forEach(function(b,i){
    if(i === AT_COUNT) html += '<div class="side-label">Novo Testamento</div>';
    html += '<button class="book" data-b="'+i+'">'+esc(b.n)+'</button>';
  });
  side.innerHTML = html;
}
function buildChaps(){
  var b = books()[state.book], html = "";
  for(var i=0;i<b.c.length;i++) html += '<button class="chap" data-c="'+i+'">'+(i+1)+'</button>';
  chaps.innerHTML = html;
}

function render(keep){
  var b = books()[state.book], vs = b.c[state.chap], html = "";
  html += '<div class="reader"><div class="track"><div class="fill" id="fill"></div></div>';
  html += '<h1 class="bookname">'+esc(b.n)+' '+(state.chap+1)+'</h1>';
  var tit = TIT[b.a] || {};
  if(tit.t && tit.t[state.chap]) html += '<p class="chapline">'+esc(tit.t[state.chap])+'</p>';
  var secs = {};
  if(tit.s && tit.s[state.chap]) tit.s[state.chap].forEach(function(p){ secs[p[0]] = p[1]; });
  html += '<div class="verses">';
  for(var i=0;i<vs.length;i++){
    if(secs[i+1]) html += '<h2 class="sec">'+esc(secs[i+1])+'</h2>';
    html += '<p class="v" id="v'+(i+1)+'"><button class="vn" data-v="'+(i+1)+
            '" title="Copiar versículo">'+(i+1)+'</button>'+esc(vs[i])+'</p>';
  }
  html += '</div><div class="pager">'+
          '<button class="pg" id="prev"'+(hasPrev()?'':' hidden')+'>← Anterior</button>'+
          '<button class="pg" id="next"'+(hasNext()?'':' hidden')+'>Próximo →</button>'+
          '</div></div>';
  view.innerHTML = html; state.mode = "read";
  document.body.classList.remove("home");

  side.querySelectorAll(".book").forEach(function(el){
    el.setAttribute("aria-current", +el.dataset.b === state.book ? "true" : "false"); });
  chaps.querySelectorAll(".chap").forEach(function(el){
    var on = +el.dataset.c === state.chap;
    el.setAttribute("aria-current", on ? "true" : "false");
    if(on) el.scrollIntoView({block:"nearest"}); });
  if(keep !== false) window.scrollTo(0,0);
  progress();
  document.title = b.n+" "+(state.chap+1)+
    (tit.t && tit.t[state.chap] ? " — "+tit.t[state.chap] : "")+" | Bíblia Almeida";
  gravaURL(true);
  $("#rtNum").textContent = state.chap + 1;
  $("#podPrev").disabled = !hasPrev();
  $("#podNext").disabled = !hasNext();
}

function hasPrev(){ return state.chap > 0 || state.book > 0; }
function hasNext(){ var bs = books();
  return state.chap < bs[state.book].c.length-1 || state.book < bs.length-1; }
function go(d){
  var bs = books();
  if(d < 0){
    if(state.chap > 0) state.chap--;
    else if(state.book > 0){ state.book--; state.chap = bs[state.book].c.length-1; buildChaps(); }
    else return;
  } else {
    if(state.chap < bs[state.book].c.length-1) state.chap++;
    else if(state.book < bs.length-1){ state.book++; state.chap = 0; buildChaps(); }
    else return;
  }
  render();
}

function progress(){
  var fill = document.getElementById("fill"), track = document.querySelector(".track");
  if(!fill || !track) return;
  var r = track.getBoundingClientRect(), vh = window.innerHeight, top = 110;
  var pct = (top - r.top) / Math.max(r.height - (vh - top - 40), 1);
  fill.style.height = Math.max(0, Math.min(1, pct)) * 100 + "%";
}

function index(){
  if(norm[state.ver]) return norm[state.ver];
  var out = [], bs = books();
  for(var b=0;b<bs.length;b++)
    for(var c=0;c<bs[b].c.length;c++){
      var vs = bs[b].c[c];
      for(var v=0;v<vs.length;v++) out.push([strip(vs[v]), b, c, v]);
    }
  norm[state.ver] = out; return out;
}

function search(term){
  var t = strip(term.trim());
  if(t.length < 2){ render(); return; }
  var idx = index(), hits = [], LIM = 120;
  for(var i=0;i<idx.length && hits.length<LIM;i++)
    if(idx[i][0].indexOf(t) !== -1) hits.push(idx[i]);
  var bs = books(), html = '<div class="hits"><div class="hits-head">'+
    hits.length+(hits.length===LIM?"+":"")+' resultado'+(hits.length===1?"":"s")+
    ' para "'+esc(term.trim())+'"</div>';
  if(!hits.length) html += '<p class="note" style="padding-top:1.5rem">Nenhuma ocorrência encontrada.</p>';
  hits.forEach(function(h){
    var raw = bs[h[1]].c[h[2]][h[3]];
    var plain = strip(raw), marked = "", last = 0, p;
    while((p = plain.indexOf(t, last)) !== -1){
      marked += esc(raw.slice(last, p)) + "<mark>" + esc(raw.slice(p, p+t.length)) + "</mark>";
      last = p + t.length;
    }
    marked += esc(raw.slice(last));
    html += '<button class="hit" data-b="'+h[1]+'" data-c="'+h[2]+'" data-v="'+h[3]+'">'+
            '<span class="hit-ref">'+esc(bs[h[1]].a)+" "+(h[2]+1)+":"+(h[3]+1)+'</span>'+
            '<p class="hit-txt">'+marked+'</p></button>';
  });
  view.innerHTML = html + '</div>'; state.mode = "search"; window.scrollTo(0,0);
}

side.addEventListener("click", function(e){
  var el = e.target.closest(".book"); if(!el) return;
  state.book = +el.dataset.b; state.chap = 0; $("#q").value = "";
  buildChaps(); render(); document.body.classList.remove("nav-open");
  if(books()[state.book].c.length > 1){ e.stopPropagation(); setRail(true); }
});
chaps.addEventListener("click", function(e){
  var el = e.target.closest(".chap"); if(!el) return;
  state.chap = +el.dataset.c; $("#q").value = ""; render(); setRail(false);
});
var railBtn = $("#railBtn");
function setRail(open){
  rail.hidden = !open;
  document.body.classList.toggle("rail-open", open);
  railBtn.setAttribute("aria-expanded", open ? "true" : "false");
  if(open){ var cur = chaps.querySelector('[aria-current="true"]');
            if(cur) cur.scrollIntoView({block:"center"}); }
}
function dropHint(){
  var h = document.getElementById("hint");
  if(!h) return;
  h.classList.add("out");
  setTimeout(function(){ if(h.parentNode) h.parentNode.removeChild(h); }, 600);
}
setTimeout(dropHint, 5000);
["touchstart","pointerdown","scroll","keydown"].forEach(function(ev){
  window.addEventListener(ev, dropHint, {once:true, passive:true});
});
railBtn.addEventListener("click", function(e){ e.stopPropagation(); dropHint(); setRail(rail.hidden); });
$("#podPrev").addEventListener("click", function(e){ e.stopPropagation(); dropHint(); go(-1); });
$("#podNext").addEventListener("click", function(e){ e.stopPropagation(); dropHint(); go(1); });
rail.addEventListener("click", function(e){ e.stopPropagation(); });
view.addEventListener("click", function(e){
  var hit = e.target.closest(".hit");
  if(hit){
    state.book = +hit.dataset.b; state.chap = +hit.dataset.c;
    var vn = +hit.dataset.v + 1; $("#q").value = "";
    buildChaps(); render();
    var el = document.getElementById("v"+vn);
    if(el){ el.scrollIntoView({block:"center"}); el.classList.add("lit");
            setTimeout(function(){ el.classList.remove("lit"); }, 2200); }
    return;
  }
  if(e.target.id === "prev"){ go(-1); return; }
  if(e.target.id === "next"){ go(1);  return; }
  var vn = e.target.closest(".vn");
  if(vn){
    var b = books()[state.book], n = +vn.dataset.v;
    var txt = '"'+b.c[state.chap][n-1]+'" — '+b.a+" "+(state.chap+1)+":"+n+" (Almeida)";
    if(navigator.clipboard) navigator.clipboard.writeText(txt);
    vn.textContent = "✓"; setTimeout(function(){ vn.textContent = n; }, 1000);
  }
});

var q = $("#q");
function searching(on){
  document.body.classList.toggle("searching", on);
  if(!on){ q.value = ""; q.blur(); render(); }
}
q.addEventListener("focus", function(){ document.body.classList.add("searching"); });
q.addEventListener("blur", function(){
  setTimeout(function(){ if(!q.value) document.body.classList.remove("searching"); }, 120);
});
$("#searchClose").addEventListener("click", function(){ searching(false); });

var t0;
$("#q").addEventListener("input", function(e){
  clearTimeout(t0); var val = e.target.value;
  t0 = setTimeout(function(){ search(val); }, 180);
});

function setVer(v){
  if(state.ver === v) return;
  load(v).then(function(){
    state.ver = v;
    ["A","B"].forEach(function(k){
      $("#v"+k).setAttribute("aria-pressed", v===k ? "true":"false"); });
    buildSide(); buildChaps();
    if(state.mode === "search" && $("#q").value) search($("#q").value); else render();
  }).catch(fail);
}
$("#vA").addEventListener("click", function(){ setVer("A"); });
$("#vB").addEventListener("click", function(){ setVer("B"); });

var SIZES = [15,16,17,18,19,20,21,23,25,27,30,34];
function setSize(d){
  state.size = Math.max(0, Math.min(SIZES.length-1, state.size + d));
  document.documentElement.style.setProperty("--fs-read", SIZES[state.size] + "px");
  salvaPref("corpo", SIZES[state.size]);
  $("#fsDown").disabled = state.size === 0;
  $("#fsUp").disabled   = state.size === SIZES.length-1;
  progress();
}
$("#fsUp").addEventListener("click", function(){ setSize(1); });
$("#fsDown").addEventListener("click", function(){ setSize(-1); });
$("#theme").addEventListener("click", function(){
  var d = document.documentElement.dataset.theme === "dark";
  document.documentElement.dataset.theme = d ? "light" : "dark";
  document.querySelector('meta[name=theme-color]').content = d ? "#FAFAF8" : "#101316";
  salvaPref("tema", d ? "light" : "dark");
});
$("#menuBtn").addEventListener("click", function(){ document.body.classList.toggle("nav-open"); });
$("#scrim").addEventListener("click", function(){
  document.body.classList.remove("nav-open"); setRail(false); });

var pop = $("#pop"), apoioBtn = $("#apoioBtn");
function setPop(open){ pop.hidden = !open;
  apoioBtn.setAttribute("aria-expanded", open ? "true" : "false"); }
apoioBtn.addEventListener("click", function(e){ e.stopPropagation(); setPop(pop.hidden); });
pop.addEventListener("click", function(e){ e.stopPropagation(); });
document.addEventListener("click", function(){ setPop(false); setRail(false); });

document.addEventListener("click", function(e){
  var k = e.target.closest && e.target.closest(".pix-key");
  if(!k) return;
  e.stopPropagation();
  if(navigator.clipboard) navigator.clipboard.writeText("40884704000199");
  var c = k.querySelector(".pix-cp");
  if(c){ c.textContent = "copiado";
         setTimeout(function(){ c.textContent = "copiar"; }, 1600); }
});

document.addEventListener("keydown", function(e){
  if(e.target.tagName === "INPUT"){
    if(e.key === "Escape") searching(false);
    return;
  }
  if(e.key === "ArrowLeft"  && state.mode === "read") go(-1);
  if(e.key === "ArrowRight" && state.mode === "read") go(1);
  if(e.key === "/"){ e.preventDefault(); $("#q").focus(); }
  if(e.key === "Escape"){ setPop(false); setRail(false); }
});
var tH;
window.addEventListener("scroll", function(){
  progress();
  clearTimeout(tH); tH = setTimeout(function(){ gravaURL(false); }, 300);
}, {passive:true});
window.addEventListener("resize", progress);
window.addEventListener("popstate", function(){
  var r = leURL(); if(!r) return;
  state.book = r.book; state.chap = r.chap;
  buildChaps(); render(); irParaVersiculo(r.verse);
});

(function(){
  var i = SIZES.indexOf(PREF.corpo);
  if(i >= 0) state.size = i;
  setSize(0);
})();

fetch("/data/titulos.json").then(function(r){ return r.ok ? r.json() : {}; })
  .catch(function(){ return {}; })
  .then(function(j){ TIT = j; return load("A"); })
  .then(function(){
    var r = leURL();
    if(r){ state.book = r.book; state.chap = r.chap; }
    else if(window.BOOT && typeof window.BOOT.b === "number"){ state.book = window.BOOT.b; state.chap = window.BOOT.c; }
    buildSide(); buildChaps();
    if(window.BOOT && typeof window.BOOT.livro === "number"){
      state.book = window.BOOT.livro; state.chap = 0;
      buildChaps(); document.body.classList.add("home"); return;
    }
    if(r || window.BOOT){ render(); if(r) irParaVersiculo(r.verse); }
    else document.body.classList.add("home");
  })
  .catch(boom);
})();
