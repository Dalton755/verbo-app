import {defineConfig} from "vite";
import {patchReaderPagination} from "./readerPaginationPatch.js";
import {patchShalomBibleApi} from "./bibleApiPatch.js";
import react from "@vitejs/plugin-react";
import path from "node:path";
import {fileURLToPath} from "node:url";
const appDir=path.dirname(fileURLToPath(import.meta.url));
const sharedDir=path.resolve(appDir,"../../src");
const ownSupabase=path.resolve(appDir,"supabase.js");
const ownAuth=path.resolve(appDir,"auth.jsx");
const ownDictionary=path.resolve(appDir,"dictionaryService.js");
export default defineConfig({
 root:appDir,publicDir:path.resolve(appDir,"public"),base:"/",
 plugins:[{
  name:"shalom-isolamento-compartilhado",enforce:"pre",
  resolveId(source,importer){
   if(!importer || !importer.startsWith(sharedDir))return null;
   if((source==="../lib/supabase"||source==="./supabase") && !importer.includes("/supabase.js"))return ownSupabase;
   if(source==="../contexts/AuthContext" && importer.endsWith("/pages/LivroPage.jsx"))return ownAuth;
   if(source==="../lib/dictionaryService" || source==="./dictionaryService")return ownDictionary;
   return null;
  },
  transform(code,id){
   if(id.endsWith("/src/pages/LivroPage.jsx"))return patchReaderPagination(code.replaceAll('"biblia-slides-pdfs"','"shalom-livros"'));
   if(id.endsWith("/src/lib/bibleApi.js"))return patchShalomBibleApi(code);
   if(id.endsWith("/src/components/DictionaryModal.jsx"))return code
     .replace("Fonte: Dicionário Aberto", 'Fonte: {resultado?.fonte || "Dicionário Aberto"}')
     .replace("{palavraLimpa}\n              </h2>", '{palavraLimpa}\n              </h2>\n              {resultado?.formaBase && <small className="shalom-dictionary-form">Definição de “{resultado.formaBase}” (singular)</small>}');
   return null;
  }
 },react()],
 server:{fs:{allow:[path.resolve(appDir,"../..")]}},
 build:{outDir:path.resolve(appDir,"dist"),emptyOutDir:true}
});