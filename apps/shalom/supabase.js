import {createClient} from "@supabase/supabase-js";
const url=import.meta.env.VITE_SUPABASE_URL;
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if(!url||!key)throw new Error("Configuração do Supabase pendente para Shalom.");
export const supabase=createClient(url,key,{db:{schema:"shalom"},auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:"nethanel-shalom-auth"}});
export const SHALOM_BUCKET="shalom-livros";