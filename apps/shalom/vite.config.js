import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import {fileURLToPath} from "node:url";
const appDir=path.dirname(fileURLToPath(import.meta.url));
const sharedDir=path.resolve(appDir,"../../src");
const ownSupabase=path.resolve(appDir,"supabase.js");
const ownAuth=path.resolve(appDir,"auth.jsx");
export default defineConfig({
 root:appDir,publicDir:path.resolve(appDir,"public"),base:"/",
 plugins:[{
  name:"shalom-isolamento-compartilhado",enforce:"pre",
  resolveId(source,importer){
   if(!importer || !importer.startsWith(sharedDir))return null;
   if((source==="../lib/supabase"||source==="./supabase") && !importer.includes("/supabase.js"))return ownSupabase;
   if(source==="../contexts/AuthContext" && importer.endsWith("/pages/LivroPage.jsx"))return ownAuth;
   return null;
  },
  transform(code,id){
   if(id.endsWith("/src/pages/LivroPage.jsx"))return code.replaceAll('"biblia-slides-pdfs"','"shalom-livros"');
   if(id.endsWith("/src/lib/bibleApi.js"))return code.replace(/export const VERSAO_BIBLICA_PADRAO\s*=\s*"ALM1911_ATUAL";/, 'export const VERSAO_BIBLICA_PADRAO = "BLIVRE";');
   return null;
  }
 },react()],
 server:{fs:{allow:[path.resolve(appDir,"../..")]}},
 build:{outDir:path.resolve(appDir,"dist"),emptyOutDir:true}
});