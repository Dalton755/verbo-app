import React,{lazy,Suspense,useCallback,useEffect,useRef,useState} from "react";
import {BrowserRouter,HashRouter,Routes,Route,Navigate,useNavigate,useLocation} from "react-router-dom";
import {BookOpen,BookPlus,Search,Home,Library,UserRound,Plus,UploadCloud,ArrowRight,ChevronRight,X,LogOut,Eye,EyeOff,Bookmark,Highlighter,NotebookPen,ExternalLink,RefreshCw} from "lucide-react";
import {ShalomAuthProvider,useAuth} from "./auth.jsx";
import {ShalomAccessProvider,useShalomAccess} from "./access.jsx";
import {limparCacheShalom} from "./bookCache.js";
import {acessoSimuladoVencido} from "./accessRules.js";
import {supabase,SHALOM_BUCKET} from "./supabase.js";
import {processarArquivoLivro} from "../../src/lib/bookFileProcessor.js";
import {extrairMetadadosShalom} from "./metadata.js";
import {gerarCapaLivro} from "../../src/lib/bookCover.js";
import {formatoArquivo} from "../../src/lib/fileFormats.js";
const Reader=lazy(()=>import("../../src/pages/LivroPage.jsx"));
// GitHub Pages oferece prévia estável; a Vercel é reservada para produção.
const githubPagesPreview=import.meta.env.VITE_SHALOM_GITHUB_PAGES==="true";
const AppRouter=githubPagesPreview?HashRouter:BrowserRouter;
const authReturnBase=(import.meta.env.VITE_SHALOM_AUTH_BASE_URL||window.location.origin).replace(/\/+$/,"");
// Retira a query de simulação somente ao escolher voltar para o acesso real.
function sairDaSimulacao(){
  window.location.assign(window.location.pathname+"#/estante");
}
// Máscara brasileira visível: CPF 000.000.000-00 ou CNPJ 00.000.000/0000-00.
// Somente os dígitos são enviados ao checkout; o documento não é persistido.
function formatarDocumento(valor){
  const digitos=String(valor||"").replace(/\D/g,"").slice(0,14);
  if(digitos.length<=11){
    return digitos.replace(/^(\d{3})(\d)/,"$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/,"$1.$2.$3")
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/,"$1.$2.$3-$4");
  }
  return digitos.replace(/^(\d{2})(\d)/,"$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/,"$1.$2.$3")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/,"$1.$2.$3/$4")
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/,"$1.$2.$3/$4-$5");
}
function Brand({compact=false}){return <div className="shalom-brand"><div className="shalom-logo"><BookOpen size={compact?19:23} strokeWidth={1.8}/></div><div><strong>shalom<span>.</span></strong>{!compact&&<small>Um tempo de paz para ler</small>}</div></div>}
function Login(){const {user,loading}=useAuth(),navigate=useNavigate();const [mode,setMode]=useState("entrar"),[email,setEmail]=useState(""),[password,setPassword]=useState(""),[name,setName]=useState(""),[showPass,setShowPass]=useState(false),[busy,setBusy]=useState(false),[info,setInfo]=useState("");
 useEffect(()=>{if(!loading&&user)navigate("/",{replace:true})},[user,loading,navigate]);
 async function submit(e){e.preventDefault();setBusy(true);setInfo("");try{
  if(mode==="recuperar"){const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:authReturnBase+"/redefinir-senha"});if(error)throw error;setInfo("Enviamos o link de recuperação para seu e-mail.");return;}
  if(mode==="criar"){const {data,error}=await supabase.auth.signUp({email,password,options:{data:{full_name:name},emailRedirectTo:authReturnBase+"/"}});if(error)throw error;if(!data.session){setInfo("Confira seu e-mail para confirmar sua conta.");return;}}
  else {const {error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;}
  navigate("/",{replace:true})
 }catch(e){setInfo(e.message||"Não foi possível continuar.")}finally{setBusy(false)}}
 async function google(){setBusy(true);setInfo("");
 const manterSimulacao=acessoSimuladoVencido(window.location.search,githubPagesPreview);
 const redirectTo=authReturnBase+"/"+(manterSimulacao?"?simular_vencimento=1":"");
 const {error}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo}});
 if(error){setInfo("Login Google indisponível: confira a configuração do provedor.");setBusy(false)}}
 return <div className="shalom-login"><header className="login-header"><Brand/></header><main className="login-layout"><section className="login-copy"><span className="eyebrow">LEITURA COM PROPÓSITO</span><h1>Seus livros.<br/><em>Seu momento.</em></h1><p>Biblioteca pessoal, referências bíblicas e anotações em uma experiência feita para você simplesmente ler.</p><div className="login-features"><span><Bookmark size={17}/> Marcadores</span><span><Highlighter size={17}/> Destaques</span><span><NotebookPen size={17}/> Notas</span></div></section><section className="login-panel"><div className="login-panel-head"><span className="eyebrow">BEM-VINDO AO SHALOM</span><h2>{mode==="criar"?"Crie sua conta":mode==="recuperar"?"Recuperar senha":"Sua biblioteca começa aqui"}</h2><p>Uma conta para os apps de leitura, EBD e sermões da Nethanel.</p></div><form onSubmit={submit}>{mode==="criar"&&<label>Seu nome<input value={name} onChange={e=>setName(e.target.value)} placeholder="Como prefere ser chamado" required/></label>}<label>E-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="voce@email.com" required autoComplete="email"/></label>{mode!=="recuperar"&&<label>Senha<div className="pass-row"><input type={showPass?"text":"password"} value={password} minLength={6} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo de 6 caracteres" required autoComplete={mode==="criar"?"new-password":"current-password"}/><button type="button" aria-label="Mostrar senha" onClick={()=>setShowPass(!showPass)}>{showPass?<EyeOff size={19}/>:<Eye size={19}/>}</button></div></label>}<button className="button-main full" disabled={busy}>{busy?"Processando...":mode==="criar"?"Criar conta":mode==="recuperar"?"Enviar link":"Entrar na biblioteca"} <ArrowRight size={18}/></button></form>{mode!=="recuperar"&&<><div className="divider"><span>ou</span></div><button className="google-button" disabled={busy} onClick={google}>Continuar com Google</button></>}{info&&<div role="status" className="form-info">{info}</div>}<div className="auth-switch">{mode!=="entrar"&&<button onClick={()=>{setMode("entrar");setInfo("")}}>Já tenho conta</button>}{mode==="entrar"&&<><button onClick={()=>{setMode("criar");setInfo("")}}>Criar conta</button><button onClick={()=>{setMode("recuperar");setInfo("")}}>Esqueci a senha</button></>}</div></section></main><footer className="login-foot">Shalom, um produto Nethanel Tecnologia · <strong>R$ 5,99/mês</strong></footer></div>
}
function Reset(){const [pass,setPass]=useState(""),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);async function save(e){e.preventDefault();setBusy(true);const {error}=await supabase.auth.updateUser({password:pass});setMessage(error?.message||"Senha alterada. Você já pode voltar à biblioteca.");setBusy(false)}return <div className="reset-page"><Brand/><form onSubmit={save}><h1>Nova senha</h1><input type="password" minLength={6} value={pass} onChange={e=>setPass(e.target.value)} required/><button className="button-main" disabled={busy}>Salvar senha</button><p>{message}</p></form></div>}
function BottomNav(){const navigate=useNavigate(),loc=useLocation();if(loc.pathname.startsWith("/livros/")||loc.pathname==="/login"||loc.pathname==="/redefinir-senha")return null;return <nav className="shalom-bottom" aria-label="Menu principal"><button className={loc.pathname==="/"?"active":""} onClick={()=>navigate("/")}><Home size={20}/><span>Início</span></button><button className={loc.pathname==="/estante"?"active":""} onClick={()=>navigate("/estante")}><Library size={20}/><span>Estante</span></button><button className={loc.pathname==="/conta"?"active":""} onClick={()=>navigate("/conta")}><UserRound size={20}/><span>Conta</span></button></nav>}
function Promo(){const [promo,setPromo]=useState(null),[open,setOpen]=useState(false);useEffect(()=>{const last=Number(localStorage.getItem("shalom-promo-visto")||0);if(Date.now()-last<24*60*60*1000)return;let active=true;let timeout;supabase.from("promocoes").select("id,titulo,descricao,url").eq("ativo",true).order("prioridade").limit(1).then(({data})=>{if(active&&data?.length){setPromo(data[0]);timeout=setTimeout(()=>setOpen(true),16000)}});return()=>{active=false;clearTimeout(timeout)}},[]);function dismiss(){setOpen(false);localStorage.setItem("shalom-promo-visto",String(Date.now()))}if(!promo||!open)return null;return <div className="shalom-promo" role="complementary"><button className="promo-close" aria-label="Fechar indicação" onClick={dismiss}><X size={15}/></button><span>OUTRO APP NETHANEL</span><strong>{promo.titulo}</strong><p>{promo.descricao}</p><a href={promo.url} target="_blank" rel="noopener noreferrer" onClick={dismiss}>Conhecer <ExternalLink size={14}/></a></div>}
function HomePage({mode="home"}){const {user}=useAuth(),{active,refresh:refreshAccess,status:accessStatus,simulado}=useShalomAccess(),navigate=useNavigate(),fileRef=useRef(null),[books,setBooks]=useState([]),[coverUrls,setCoverUrls]=useState({}),[groups,setGroups]=useState([]),[group,setGroup]=useState("todos"),[search,setSearch]=useState(""),[busy,setBusy]=useState(true),[importing,setImporting]=useState(false),[error,setError]=useState(""),[notice,setNotice]=useState(""),[uploadStep,setUploadStep]=useState("");const [selectedFile,setSelectedFile]=useState(null),[title,setTitle]=useState(""),[author,setAuthor]=useState(""),[groupId,setGroupId]=useState("");
 const reload=useCallback(async()=>{if(!user)return;setBusy(true);setError("");const [{data,error:dbError},{data:folderData}]=await Promise.all([supabase.rpc("listar_estante"),supabase.from("temas_livros").select("id,nome").eq("usuario_id",user.id).order("nome")]);if(dbError)setError("Não foi possível acessar sua estante. Confira a exposição do schema shalom na API do Supabase.");setBooks(data||[]);setGroups(folderData||[]);setBusy(false);if(!data?.length)return;const urls=await Promise.all(data.filter(b=>b.capa_path).map(async b=>{const {data:url}=await supabase.storage.from(SHALOM_BUCKET).createSignedUrl(b.capa_path,3600);return [b.id,url?.signedUrl]}));setCoverUrls(Object.fromEntries(urls.filter(x=>x[1])));},[user]);
 useEffect(()=>{reload()},[reload]);const shown=books.filter(b=>(group==="todos"||b.tema_id===group)&&[b.titulo,b.autor].join(" ").toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")));const continuing=books.find(b=>b.ultima_pagina>1)||books[0];
 async function chooseFile(file){if(!file)return;if(!active){navigate("/conta");return;}setNotice("");setError("");if(!/\.(pdf|epub)$/i.test(file.name)){setError("Selecione um PDF ou EPUB.");return;}if(file.size>50*1024*1024){setError("O limite por arquivo é 50 MB.");return;}setSelectedFile(file);setTitle(file.name.replace(/\.(pdf|epub)$/i,"").replace(/[-_]/g," "));setAuthor("");setImporting(true);try{const format=formatoArquivo(file);const data=format==="pdf"?await extrairMetadadosShalom(file):await processarArquivoLivro(file);setTitle(data.titulo||data.metadados?.titulo||file.name.replace(/\.(pdf|epub)$/i,""));setAuthor(data.autor||data.metadados?.autor||"")}catch(e){console.debug("Metadados indisponíveis",e)}}
 async function upload(e){e.preventDefault();if(!selectedFile||!user)return;const {data:entitled,error:accessError}=await supabase.rpc("tem_assinatura_vigente");if(accessError||entitled!==true){setError("Seu acesso precisa ser renovado para importar livros.");setImporting(false);navigate("/conta");return;}setUploadStep("Preparando livro...");setError("");let storagePath=null,coverPath=null;try{const format=formatoArquivo(selectedFile);const processed=await processarArquivoLivro(selectedFile);if(!Array.isArray(processed.paginas)||!processed.paginas.length)throw new Error("O livro não contém páginas legíveis. PDFs digitalizados como imagem ainda não são compatíveis.");const id=crypto.randomUUID();storagePath=`${user.id}/livros/${id}.${format}`;setUploadStep("Enviando arquivo...");const {error:upError}=await supabase.storage.from(SHALOM_BUCKET).upload(storagePath,selectedFile,{upsert:false,contentType:format==="epub"?"application/epub+zip":"application/pdf"});if(upError)throw upError;if(format==="pdf"){try{const capa=await gerarCapaLivro(selectedFile);coverPath=`${user.id}/livros/${id}.webp`;const {error:coverError}=await supabase.storage.from(SHALOM_BUCKET).upload(coverPath,capa.blob,{contentType:"image/webp"});if(coverError)coverPath=null}catch{coverPath=null;}}setUploadStep("Organizando sua estante...");const {error:insertError}=await supabase.from("livros").insert({id,usuario_id:user.id,titulo:title.trim()||selectedFile.name,autor:author.trim()||null,arquivo_nome:selectedFile.name,arquivo_tipo:format,storage_path:storagePath,capa_path:coverPath,tema_id:groupId||null,total_paginas:processed.totalPaginas,ultima_pagina:1,conteudo_processado:{versao:processed.versao,formato:format,paginas:processed.paginas},processado_em:new Date().toISOString(),processador_versao:processed.versao||1});if(insertError)throw insertError;setImporting(false);setSelectedFile(null);setGroupId("");setNotice("Seu livro foi adicionado. Boa leitura!");await reload();navigate("/livros/"+id)}catch(e){setError(e.message||"O arquivo não foi salvo.");if(storagePath)await supabase.storage.from(SHALOM_BUCKET).remove([storagePath,...(coverPath?[coverPath]:[])]);}finally{setUploadStep("")}}
 async function createGroup(){if(!active){navigate("/conta");return;}const name=window.prompt("Nome da coleção");if(!name?.trim())return;const {data,error:e}=await supabase.from("temas_livros").insert({usuario_id:user.id,nome:name.trim()}).select("id,nome").single();if(e){setError(e.message);return;}setGroups(prev=>[...prev,data]);setGroupId(data.id)}
 async function deleteBook(b){if(!active){navigate("/conta");return;}if(!window.confirm(`Excluir "${b.titulo}" da sua biblioteca?`))return;const {data,error:e}=await supabase.from("livros").select("storage_path,capa_path").eq("id",b.id).eq("usuario_id",user.id).single();if(e||!data)return setError("Não foi possível excluir o livro.");const {error:de}=await supabase.from("livros").delete().eq("id",b.id).eq("usuario_id",user.id);if(de)return setError(de.message);await supabase.storage.from(SHALOM_BUCKET).remove([data.storage_path,...(data.capa_path?[data.capa_path]:[])]);reload();}
 return <div className="shalom-app"><header className="shalom-header"><Brand/><div className="header-actions"><span className="price-pill">R$ 5,99/mês</span><button type="button" className="icon-button" onClick={()=>navigate("/conta")} aria-label="Minha conta"><UserRound size={21}/></button></div></header><main className="shalom-main">
    {accessStatus==="inactive"&&<section className="shalom-expired-banner" role="status">
      <div><strong>{simulado?"Simulação de vencimento — apenas prévia":"Sua biblioteca continua aqui."}</strong><p>{simulado?"Este teste não altera sua assinatura real nem remove seus livros. A leitura fica bloqueada somente nesta simulação.":"Seu período terminou. Livros, marcadores e anotações continuam salvos. Renove para voltar a ler."}</p></div>
      {simulado
        ?<button type="button" className="button-main" onClick={sairDaSimulacao}>Sair da simulação <ArrowRight size={16}/></button>
        :<button type="button" className="button-main" onClick={()=>navigate("/conta")}>Renovar por R$ 5,99 <ArrowRight size={16}/></button>}
    </section>}
    {accessStatus==="error"&&<section className="shalom-expired-banner shalom-access-error" role="alert">
      <div><strong>Não foi possível verificar a assinatura.</strong><p>Confira a conexão. Seus arquivos estão preservados.</p></div>
      <button type="button" className="button-outline" onClick={refreshAccess}>Tentar novamente</button>
    </section>}
    {mode==="home"?<><section className="hero-row"><div><span className="eyebrow">SUA BIBLIOTECA PESSOAL</span><h1>Um bom livro.<br/><em>Um novo olhar.</em></h1><p>Abra, leia e continue exatamente de onde parou.</p><button className="button-main" onClick={()=>active?fileRef.current?.click():navigate("/conta")}><Plus size={19}/> Adicionar livro</button></div><div className="hero-art"><BookOpen size={94} strokeWidth={0.9}/><span>shalom.</span></div></section>{books.length>0&&continuing&&<section className="continue-card" onClick={()=>navigate("/livros/"+continuing.id)}><span className="eyebrow">CONTINUE DE ONDE PAROU</span><div><div><h2>{continuing.titulo}</h2><p>{continuing.autor||"Sua leitura"} · Página {continuing.ultima_pagina||1} de {continuing.total_paginas||"—"}</p></div><span className="continue-icon"><ArrowRight size={21}/></span></div><div className="progress-line"><span style={{width:`${Math.min(100,100*(continuing.ultima_pagina||1)/(continuing.total_paginas||1))}%`}}/></div></section>}</>:<section className="shelf-top"><span className="eyebrow">ORGANIZE SUAS LEITURAS</span><h1>Minha estante<span>.</span></h1><p>Seu espaço, seus livros, seu ritmo.</p></section>}<section className="shelf"><div className="section-head"><div><span className="eyebrow">COLEÇÃO PARTICULAR</span><h2>{mode==="home"?"Minha estante":"Todos os livros"} <small>{books.length}</small></h2></div><button className="button-outline" onClick={()=>active?fileRef.current?.click():navigate("/conta")}><BookPlus size={18}/> Adicionar</button></div>{books.length>0&&<div className="shelf-filters"><div className="search-input"><Search size={18}/><input placeholder="Buscar título ou autor" value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="filters-scroll"><button className={group==="todos"?"selected":""} onClick={()=>setGroup("todos")}>Todos</button>{groups.map(g=><button key={g.id} className={group===g.id?"selected":""} onClick={()=>setGroup(g.id)}>{g.nome}</button>)}</div></div>}{error&&<p className="inline-error" role="alert">{error}</p>}{notice&&<p className="inline-success">{notice}</p>}{busy?<div className="empty-state"><RefreshCw className="spin" size={25}/><p>Organizando seus livros...</p></div>:books.length===0?<div className="empty-state"><div className="empty-icon"><BookOpen size={35}/></div><h3>Sua próxima leitura começa aqui</h3><p>Importe seu primeiro PDF ou EPUB. O Shalom organiza o livro e prepara uma experiência de leitura com referências, notas e destaques.</p><button className="button-main" onClick={()=>active?fileRef.current?.click():navigate("/conta")}><UploadCloud size={19}/> Importar meu primeiro livro</button><span>Simples. Sem configurações complicadas.</span></div>:shown.length===0?<div className="empty-state"><p>Nenhum livro encontrado nessa busca.</p></div>:<div className="book-grid">{shown.map(b=><article key={b.id} className="shelf-book"><button className="book-open" onClick={()=>navigate("/livros/"+b.id)} aria-label={"Abrir "+b.titulo}><div className="book-cover">{coverUrls[b.id]?<img src={coverUrls[b.id]} alt="" loading="lazy"/>:<BookOpen size={39} strokeWidth={1.2}/>}<span>{b.arquivo_tipo?.toUpperCase()||"LIVRO"}</span></div><div className="book-data"><strong>{b.titulo}</strong><small>{b.autor||"Autor não identificado"}</small><p>Página {b.ultima_pagina||1} <ChevronRight size={14}/></p></div></button>{active&&<button className="book-delete" title="Remover livro" onClick={()=>deleteBook(b)}>Excluir</button>}</article>)}</div>}</section><section className="value-strip"><div><BookOpen size={20}/><span>Leitura em páginas</span></div><div><Bookmark size={20}/><span>Marcadores e notas</span></div><div><Highlighter size={20}/><span>Referências bíblicas</span></div></section></main><BottomNav/><Promo/><input ref={fileRef} type="file" accept=".pdf,.epub,application/pdf,application/epub+zip" hidden onChange={e=>{chooseFile(e.target.files?.[0]);e.target.value=""}}/>{importing&&<div className="shalom-modal-backdrop" role="dialog" aria-modal="true" aria-label="Adicionar livro"><form className="shalom-modal" onSubmit={upload}><button type="button" className="modal-close" onClick={()=>{if(!uploadStep){setImporting(false);setSelectedFile(null)}}}><X size={20}/></button><span className="eyebrow">NOVO LIVRO</span><h2>Prepare sua leitura</h2><p>Confira os dados reconhecidos automaticamente.</p><label>Título<input value={title} onChange={e=>setTitle(e.target.value)} required/></label><label>Autor (opcional)<input value={author} onChange={e=>setAuthor(e.target.value)}/></label><label>Coleção<div className="collection-row"><select value={groupId} onChange={e=>setGroupId(e.target.value)}><option value="">Sem coleção</option>{groups.map(g=><option key={g.id} value={g.id}>{g.nome}</option>)}</select><button type="button" onClick={createGroup} aria-label="Criar coleção"><Plus size={19}/></button></div></label><p className="file-name">{selectedFile?.name}</p>{error&&<p role="alert" className="form-info">{error}</p>}<button type="submit" className="button-main full" disabled={Boolean(uploadStep)}>{uploadStep||"Importar e começar a ler"} <ArrowRight size={17}/></button></form></div>}</div>}
function dataBr(valor){
  const partes=String(valor||"").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : "—";
}
function Account(){
 const {user}=useAuth(),{refresh:refreshAccess,simulado}=useShalomAccess(),navigate=useNavigate();
 const [subscription,setSubscription]=useState(null);
 const [name,setName]=useState(user.user_metadata?.full_name||"");
 const [document,setDocument]=useState("");
 const [showCheckout,setShowCheckout]=useState(false);
 const [busy,setBusy]=useState(false);
 const [payError,setPayError]=useState("");
 const [paymentLink,setPaymentLink]=useState(null);
 const [pix,setPix]=useState(null);
 const [pixBusy,setPixBusy]=useState(false);
 const [pixInfo,setPixInfo]=useState("");
 const [pixCopied,setPixCopied]=useState(false);
 const [showCancelConfirm,setShowCancelConfirm]=useState(false);
 const [cancelBusy,setCancelBusy]=useState(false);
 const [cancelError,setCancelError]=useState("");
 const [cancelNotice,setCancelNotice]=useState("");
 const pixFetchedRef=useRef(null);
 const checkoutEnabled=import.meta.env.VITE_SHALOM_CHECKOUT_SANDBOX_ENABLED==="true";
 const loadSubscription=useCallback(async()=>{
   const {data,error}=await supabase.from("assinaturas")
     .select("status,valor_mensal,validade_ate,proximo_vencimento,ultimo_pagamento_em,cancelada_em,asaas_ambiente,pagamento_url,asaas_subscription_id,ultimo_pagamento_id")
     .eq("usuario_id",user.id).maybeSingle();
   if(!error) {setSubscription(data);await refreshAccess();}
 },[user.id,refreshAccess]);
 useEffect(()=>{loadSubscription()},[loadSubscription]);
 const fetchPix=useCallback(async()=>{
   setPixBusy(true);setPixInfo("");setPixCopied(false);
   try{
     const {data,error}=await supabase.functions.invoke("shalom-checkout",{
       body:{action:"get-pix"}
     });
     if(error){
       let info=data;
       if(!info && error.context && typeof error.context.json==="function"){
         try{info=await error.context.json()}catch{/* status de erro sem JSON */}
       }
       throw new Error(info?.message||"Não foi possível consultar o QR Code Pix.");
     }
     if(data?.available && (data.encodedImage||data.payload)){
       setPix(data);
     }else{
       setPix(null);
       setPixInfo(data?.message||"O QR Code não está disponível para esta cobrança.");
     }
   }catch(error){setPix(null);setPixInfo(error.message||"O QR Code Pix não está disponível.");}
   finally{setPixBusy(false);}
 },[]);
 useEffect(()=>{
   const id=subscription?.ultimo_pagamento_id;
   if(!checkoutEnabled || subscription?.status!=="pending" || !id) return;
   if(pixFetchedRef.current===id)return;
   pixFetchedRef.current=id;
   fetchPix();
 },[checkoutEnabled,subscription?.status,subscription?.ultimo_pagamento_id,fetchPix]);
 async function copyPix(){
   if(!pix?.payload)return;
   try{
     await navigator.clipboard.writeText(pix.payload);
     setPixCopied(true);
     setPixInfo("");
   }catch{
     setPixCopied(false);
     setPixInfo("Não foi possível copiar automaticamente. Selecione o código abaixo para copiar.");
   }
 }
 async function pay(e){
   e.preventDefault();
   if(!checkoutEnabled){
     setPayError("O pagamento via Asaas está sendo preparado em ambiente de testes. Nenhuma cobrança real foi criada.");
     return;
   }
   if(!showCheckout){setShowCheckout(true);return;}
   setBusy(true);setPayError("");setPaymentLink(null);setPix(null);setPixInfo("");
   try{
     const {data,error}=await supabase.functions.invoke("shalom-checkout",{
       body:{nome:name.trim(),cpfCnpj:document.replace(/\D/g,"")}
     });
     if(error){
       // Em erros HTTP, supabase-js fornece o corpo original em error.context,
       // não necessariamente em data. Mostrar validação segura do Sandbox.
       let detail=data;
       if(!detail && error.context && typeof error.context.json==="function"){
         try { detail=await error.context.json(); } catch { /* sem JSON */ }
       }
       const etapa=({cliente:"cliente",assinatura:"assinatura",cobranca:"cobrança"})[detail?.etapa]||"pagamento";
       const message=detail?.message||"O serviço de pagamento ainda não está disponível.";
       const code=typeof detail?.providerCode==="string" && detail.providerCode!=="unknown_error"
         ? " ("+detail.providerCode+")" : "";
       throw new Error(message+" — Etapa: "+etapa+code);
     }
     if(data?.invoiceUrl){
       const url=new URL(data.invoiceUrl);
       const valid=url.protocol==="https:" &&
         (url.hostname==="asaas.com" || url.hostname.endsWith(".asaas.com") ||
          url.hostname==="asaas.com.br" || url.hostname.endsWith(".asaas.com.br"));
       if(!valid) throw new Error("O link de pagamento não foi reconhecido.");
       setPaymentLink(url.href);
     }
     if(data?.status==="pending"&&!data?.invoiceUrl){
       setPayError(data.message||"Aguardando a geração do pagamento de teste.");
     }
     await loadSubscription();
   }catch(error){setPayError(error.message||"Não foi possível preparar o Pix de teste.");}
   finally{setBusy(false);}
 }
 async function cancelRecurring(){
   if(!checkoutEnabled || cancelBusy || !showCancelConfirm)return;
   setCancelBusy(true);setCancelError("");setCancelNotice("");
   try{
     const {data,error}=await supabase.functions.invoke("shalom-cancelar-assinatura",{
       body:{confirmar:true}
     });
     if(error){
       let info=data;
       if(!info && error.context && typeof error.context.json==="function"){
         try {info=await error.context.json()} catch { /* sem JSON */ }
       }
       throw new Error(info?.message||"Não foi possível confirmar o cancelamento. Tente novamente.");
     }
     if(data?.status!=="canceled") throw new Error("Não foi possível confirmar o cancelamento.");
     setCancelNotice("Renovação cancelada. Seu acesso já pago permanece até a data informada.");
     setShowCancelConfirm(false);
     await loadSubscription();
   }catch(error){
     setCancelError(error.message||"Ocorreu um erro no cancelamento.");
   }finally{setCancelBusy(false);}
 }
 async function signout(){limparCacheShalom();await supabase.auth.signOut();navigate("/login",{replace:true})}
 const recorrenciaCancelada=subscription?.status==="canceled";
 const assinaturaValida=["active","canceled"].includes(subscription?.status) &&
   subscription?.validade_ate && new Date(subscription.validade_ate).getTime()>Date.now();
 const aguardandoPagamento=subscription?.status==="pending" && !!subscription?.ultimo_pagamento_id;
 useEffect(()=>{
   if(!aguardandoPagamento)return;
   const timer=window.setInterval(loadSubscription,30000);
   return ()=>window.clearInterval(timer);
 },[aguardandoPagamento,loadSubscription]);
 const podeIniciarCheckout=!assinaturaValida && !aguardandoPagamento;
 const podeCancelar=checkoutEnabled && !recorrenciaCancelada &&
   ["active","pending","past_due"].includes(subscription?.status) &&
   !!subscription?.asaas_subscription_id;
 const status=recorrenciaCancelada
   ? assinaturaValida ? "Cancelada · acesso mantido" : "Cancelada · período encerrado"
   : assinaturaValida?"Ativa":subscription?.status==="active"?"Validade encerrada":
     subscription?.status==="pending"&&!subscription?.asaas_subscription_id?"Cadastro iniciado · assinatura não criada":
     subscription?.status==="pending"&&!subscription?.ultimo_pagamento_id?"Assinatura criada · aguardando cobrança":
     subscription?.status==="pending"?"Pagamento pendente":subscription?.status==="past_due"?"Pagamento vencido":"Não ativada";
 return <div className="shalom-app">
  <header className="shalom-header"><Brand/><button onClick={()=>navigate("/")} className="button-outline">Voltar</button></header>
  <main className="shalom-main account-content">
   <span className="eyebrow">SUA CONTA SHALOM</span>
   <h1>Meu espaço<span>.</span></h1>
   <div className="account-card"><div className="avatar"><UserRound size={26}/></div>
    <div><strong>{user.user_metadata?.full_name||"Leitor Shalom"}</strong><p>{user.email}</p></div>
   </div>
   <div className="plan-card">
    {simulado&&<p className="shalom-plan-awaiting"><strong>Modo de teste:</strong> você está simulando uma assinatura vencida no GitHub. O status abaixo mostra sua assinatura REAL, que não foi alterada. Para sair da simulação, abra a prévia sem o parâmetro simular_vencimento.</p>}
    <span className="eyebrow">ASSINATURA SHALOM</span>
    <h2>Leitura sem distrações.</h2>
    <p>Acesso à biblioteca, PDF e EPUB, destaques, notas e referências bíblicas.</p>
    <div className="plan-price">R$ 5,99 <small>/mês</small></div>
    <p className={assinaturaValida?"plan-state shalom-plan-status-active":"plan-state"}>Status: {status}</p>
    {assinaturaValida&&<section className="shalom-plan-confirmed" role="status" aria-label="Benefício de assinatura">
      <strong>{recorrenciaCancelada?"✓ Renovação cancelada":"✓ Assinatura ativada com sucesso"}</strong>
      <p>{recorrenciaCancelada
        ?"Você continua com acesso durante o período já pago. Não haverá novas cobranças dessa recorrência."
        :"Seu Shalom está ativo. Continue aproveitando sua biblioteca e os recursos de estudo."}</p>
      <div className="shalom-plan-dates">
        <div><span>Seu acesso vai até</span><b>{dataBr(subscription?.validade_ate)}</b></div>
        {!recorrenciaCancelada&&<div><span>Próxima cobrança prevista</span><b>{dataBr(subscription?.proximo_vencimento)}</b></div>}
      </div>
      {!recorrenciaCancelada&&<small>A renovação mensal por Pix convencional exige um novo pagamento; não há débito automático.</small>}
      {recorrenciaCancelada&&<small>O período pago permanece disponível até a validade registrada. Depois disso, você poderá contratar novamente.</small>}
    </section>}
    {aguardandoPagamento&&<div className="shalom-plan-awaiting" role="status">A cobrança já foi gerada. Aguarde a confirmação do Pix de teste ou atualize o status abaixo.</div>}
    {recorrenciaCancelada&&!assinaturaValida&&<p className="shalom-plan-awaiting">Sua assinatura terminou. Para voltar a usar os recursos premium após sua validade, faça uma nova contratação.</p>}
    {checkoutEnabled&&<div className="shalom-sandbox-warning">Ambiente de teste Asaas · Pix fictício. Não realize pagamentos reais.</div>}
    {podeIniciarCheckout&&showCheckout&&checkoutEnabled&&<form id="shalom-checkout-form" className="shalom-checkout-form" onSubmit={pay}>
      <label>Nome completo<input value={name} onChange={e=>setName(e.target.value)} required minLength={3} autoComplete="name"/></label>
      <label>CPF ou CNPJ<input inputMode="numeric" type="text" autoComplete="off" value={document} maxLength={18} onChange={e=>setDocument(formatarDocumento(e.target.value))} required placeholder="000.000.000-00" aria-label="CPF ou CNPJ"/></label>
      <button type="submit" className="button-main" disabled={busy}>{busy?"Preparando Pix de teste...":"Gerar Pix de teste"} <ArrowRight size={17}/></button>
    </form>}
    {podeIniciarCheckout&&!showCheckout&&<button className="button-main" onClick={pay} disabled={busy}>
       {checkoutEnabled?(subscription?.status==="canceled"||subscription?.status==="past_due"||subscription?.status==="active"?"Renovar assinatura · Pix teste":"Testar assinatura Pix"):"Assinar com Pix"} <ArrowRight size={17}/>
     </button>}
    {checkoutEnabled && subscription?.status==="pending" && subscription?.ultimo_pagamento_id && <>
      <section className="shalom-pix-box" aria-label="Pagamento Pix de teste">
        <span className="eyebrow">PIX DE TESTE · SANDBOX</span>
        <h3>Sua cobrança de R$ 5,99</h3>
        <p>Este Pix é fictício. Não tente pagá-lo com seu aplicativo bancário real.</p>
        {pixBusy&&<div role="status" className="shalom-pix-loading"><RefreshCw size={18} className="spin"/> Preparando QR Code Pix...</div>}
        {pix?.encodedImage&&<img className="shalom-pix-qr" src={"data:image/png;base64,"+pix.encodedImage} alt="QR Code Pix de teste do Shalom"/>}
        {pix?.expirationDate&&<small className="shalom-pix-expiry">Validade do código: {pix.expirationDate}</small>}
        {pix?.payload&&<div className="shalom-pix-copy"><label>Pix Copia e Cola<textarea readOnly rows={2} value={pix.payload} onFocus={e=>e.target.select()}/></label><button type="button" className="button-main" onClick={copyPix}>{pixCopied?"Código copiado":"Copiar Pix"}</button></div>}
        {pixInfo&&<p className="shalom-pix-note" role="status">{pixInfo}</p>}
        {!pixBusy&&<button type="button" className="button-outline shalom-pix-refresh" onClick={fetchPix}>Atualizar QR Code Pix</button>}
        <button type="button" className="shalom-pix-status" onClick={loadSubscription}>Atualizar status da assinatura</button>
      </section>
    </>}
    {(paymentLink||subscription?.pagamento_url)&&subscription?.status!=="active"&&
      <a href={paymentLink||subscription?.pagamento_url} target="_blank" rel="noopener noreferrer" className="button-outline shalom-payment-link">Abrir cobrança no Asaas Sandbox <ExternalLink size={16}/></a>}
    {payError&&<div role="status" className="form-info">{payError}</div>}
    {podeCancelar&&<section className="shalom-cancel-section" aria-label="Gerenciar assinatura">
      <h3>Gerenciar assinatura</h3>
      {!showCancelConfirm&&<button className="shalom-cancel-link" type="button" onClick={()=>{setCancelError("");setShowCancelConfirm(true)}}>Cancelar renovação da assinatura</button>}
      {showCancelConfirm&&<div className="shalom-cancel-confirm">
        <p>Deseja realmente cancelar? O Asaas deixará de gerar novas cobranças. Você manterá acesso ao período já pago{subscription?.validade_ate?" até "+dataBr(subscription.validade_ate):""}. Essa operação encerra a recorrência.</p>
        <div className="shalom-cancel-actions">
          <button className="button-outline" type="button" disabled={cancelBusy} onClick={()=>setShowCancelConfirm(false)}>Manter assinatura</button>
          <button className="shalom-cancel-danger" type="button" disabled={cancelBusy} onClick={cancelRecurring}>{cancelBusy?"Cancelando...":"Confirmar cancelamento"}</button>
        </div>
      </div>}
      {cancelError&&<p role="alert" className="shalom-cancel-error">{cancelError}</p>}
    </section>}
    {cancelNotice&&<p role="status" className="shalom-cancel-success">{cancelNotice}</p>}
    {!assinaturaValida&&<p className="shalom-payment-note">Pix mensal convencional: uma nova cobrança é gerada a cada mês e o usuário realiza o pagamento. Para débito automático é necessária autorização específica de Pix Automático.</p>}
   </div>
   <button onClick={signout} className="signout"><LogOut size={19}/> Sair da conta</button>
  </main><BottomNav/>
 </div>;
}
function PremiumReader(){
 const {status,refresh,simulado}=useShalomAccess();
 const navigate=useNavigate();
 if(status==="loading")return <div className="shalom-loading"><Brand/><p>Verificando sua assinatura...</p></div>;
 if(status==="error")return <div className="shalom-access-screen"><BookOpen size={40}/><h2>Não conseguimos confirmar seu acesso</h2><p>Verifique sua conexão e tente novamente. Sua leitura está preservada.</p><button className="button-main" onClick={refresh}>Verificar novamente</button><button className="button-outline" onClick={()=>navigate("/estante")}>Voltar à estante</button></div>;
 if(status!=="active")return <div className="shalom-access-screen"><BookOpen size={40}/>
  <span className="eyebrow">{simulado?"SIMULAÇÃO · GITHUB PAGES":"SUA BIBLIOTECA ESTÁ SALVA"}</span>
  <h2>{simulado?"Leitura bloqueada no teste.":"Continue de onde parou."}</h2>
  <p>{simulado
    ?"Esta tela reproduz o vencimento sem alterar sua assinatura real. Seus livros e suas anotações continuam salvos."
    :<>Seu período de acesso terminou. Renove por <strong>R$ 5,99/mês</strong> para abrir seus livros, referências e anotações.</>}</p>
  {simulado
    ?<button className="button-main" onClick={sairDaSimulacao}>Voltar ao acesso normal <ArrowRight size={16}/></button>
    :<button className="button-main" onClick={()=>navigate("/conta")}>Renovar assinatura <ArrowRight size={16}/></button>}
  <button className="button-outline" onClick={()=>navigate("/estante")}>Ver minha estante</button>
 </div>;
 return <Suspense fallback={<div className="shalom-loading">Abrindo seu livro...</div>}><Reader/></Suspense>;
}
function Root(){const {user,loading}=useAuth(),loc=useLocation();if(loading)return <div className="shalom-loading"><Brand/><p>Preparando sua biblioteca...</p></div>;if(!user&&loc.pathname!=="/login"&&loc.pathname!=="/redefinir-senha")return <Navigate to="/login" replace/>;if(user&&loc.pathname==="/login")return <Navigate to="/" replace/>;return <Routes><Route path="/login" element={<Login/>}/><Route path="/redefinir-senha" element={<Reset/>}/><Route path="/" element={<HomePage/>}/><Route path="/estante" element={<HomePage mode="shelf"/>}/><Route path="/livros" element={<Navigate to="/estante" replace/>}/><Route path="/livros/:id" element={<PremiumReader/>}/><Route path="/conta" element={<Account/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes>}
export default function App(){return <AppRouter><ShalomAuthProvider><ShalomAccessProvider><Root/></ShalomAccessProvider></ShalomAuthProvider></AppRouter>}