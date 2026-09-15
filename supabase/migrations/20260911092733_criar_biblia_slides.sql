


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "biblia_slides";


ALTER SCHEMA "biblia_slides" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "biblia_slides"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'biblia_slides', 'public'
    AS $$
begin
  insert into biblia_slides.profiles (
    id,
    nome,
    email
  )
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'nome',
      new.raw_user_meta_data ->> 'full_name',
      ''
    ),
    new.email
  )
  on conflict (id) do nothing;

  return new;
end;
$$;


ALTER FUNCTION "biblia_slides"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "biblia_slides"."proteger_tipo_acesso_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'biblia_slides', 'public'
    AS $$
begin

    /*
     * Usuário autenticado nunca pode
     * conceder licença a si mesmo.
     */
    if auth.role() = 'authenticated' then

        if tg_op = 'INSERT' then
            new.tipo_acesso := 'DEMO';

        elsif tg_op = 'UPDATE' then
            new.tipo_acesso := old.tipo_acesso;

        end if;

    end if;

    return new;
end;
$$;


ALTER FUNCTION "biblia_slides"."proteger_tipo_acesso_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "biblia_slides"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "biblia_slides"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "biblia_slides"."validar_limite_demo_aulas"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'biblia_slides', 'public'
    AS $$
declare
    v_tipo_acesso text;
    v_total_aulas integer;
begin
    select tipo_acesso
    into v_tipo_acesso
    from biblia_slides.profiles
    where id = new.usuario_id;

    if coalesce(v_tipo_acesso, 'DEMO') = 'DEMO' then
        select count(*)
        into v_total_aulas
        from biblia_slides.aulas
        where usuario_id = new.usuario_id;

        if v_total_aulas >= 3 then
            raise exception using
                errcode = 'P0001',
                message = 'LIMITE_DEMO_AULAS';
        end if;
    end if;

    return new;
end;
$$;


ALTER FUNCTION "biblia_slides"."validar_limite_demo_aulas"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "biblia_slides"."aulas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "trimestre_id" "uuid" NOT NULL,
    "numero" integer NOT NULL,
    "titulo" "text" NOT NULL,
    "arquivo_nome" "text",
    "storage_path" "text",
    "total_paginas" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ultima_pagina" integer DEFAULT 1 NOT NULL,
    CONSTRAINT "aulas_numero_check" CHECK (("numero" > 0)),
    CONSTRAINT "aulas_total_paginas_check" CHECK ((("total_paginas" IS NULL) OR ("total_paginas" > 0))),
    CONSTRAINT "aulas_ultima_pagina_check" CHECK (("ultima_pagina" > 0))
);


ALTER TABLE "biblia_slides"."aulas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "biblia_slides"."livro_destaques" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "livro_id" "uuid" NOT NULL,
    "pagina_inicio" integer NOT NULL,
    "bloco_inicio" integer NOT NULL,
    "offset_inicio" integer NOT NULL,
    "pagina_fim" integer NOT NULL,
    "bloco_fim" integer NOT NULL,
    "offset_fim" integer NOT NULL,
    "texto_selecionado" "text" NOT NULL,
    "cor" "text" DEFAULT 'AMARELO'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "livro_destaques_bloco_fim_check" CHECK (("bloco_fim" >= 0)),
    CONSTRAINT "livro_destaques_bloco_inicio_check" CHECK (("bloco_inicio" >= 0)),
    CONSTRAINT "livro_destaques_cor_check" CHECK (("cor" = ANY (ARRAY['AMARELO'::"text", 'VERDE'::"text", 'AZUL'::"text", 'ROSA'::"text"]))),
    CONSTRAINT "livro_destaques_offset_fim_check" CHECK (("offset_fim" >= 0)),
    CONSTRAINT "livro_destaques_offset_inicio_check" CHECK (("offset_inicio" >= 0)),
    CONSTRAINT "livro_destaques_pagina_fim_check" CHECK (("pagina_fim" > 0)),
    CONSTRAINT "livro_destaques_pagina_inicio_check" CHECK (("pagina_inicio" > 0))
);


ALTER TABLE "biblia_slides"."livro_destaques" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "biblia_slides"."livro_marcadores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "livro_id" "uuid" NOT NULL,
    "pagina_logica" integer NOT NULL,
    "posicao" numeric DEFAULT 0 NOT NULL,
    "trecho" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "livro_marcadores_pagina_logica_check" CHECK (("pagina_logica" > 0)),
    CONSTRAINT "livro_marcadores_posicao_check" CHECK ((("posicao" >= (0)::numeric) AND ("posicao" <= (1)::numeric)))
);


ALTER TABLE "biblia_slides"."livro_marcadores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "biblia_slides"."livro_notas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "livro_id" "uuid" NOT NULL,
    "pagina_inicio" integer NOT NULL,
    "bloco_inicio" integer NOT NULL,
    "offset_inicio" integer NOT NULL,
    "pagina_fim" integer NOT NULL,
    "bloco_fim" integer NOT NULL,
    "offset_fim" integer NOT NULL,
    "texto_selecionado" "text" NOT NULL,
    "conteudo" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "livro_notas_bloco_fim_check" CHECK (("bloco_fim" >= 0)),
    CONSTRAINT "livro_notas_bloco_inicio_check" CHECK (("bloco_inicio" >= 0)),
    CONSTRAINT "livro_notas_offset_fim_check" CHECK (("offset_fim" >= 0)),
    CONSTRAINT "livro_notas_offset_inicio_check" CHECK (("offset_inicio" >= 0)),
    CONSTRAINT "livro_notas_pagina_fim_check" CHECK (("pagina_fim" > 0)),
    CONSTRAINT "livro_notas_pagina_inicio_check" CHECK (("pagina_inicio" > 0))
);


ALTER TABLE "biblia_slides"."livro_notas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "biblia_slides"."livros" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "titulo" "text" NOT NULL,
    "autor" "text",
    "arquivo_nome" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "total_paginas" integer,
    "ultima_pagina" integer DEFAULT 1 NOT NULL,
    "ultima_posicao" numeric DEFAULT 0 NOT NULL,
    "conteudo_processado" "jsonb",
    "processado_em" timestamp with time zone,
    "processador_versao" integer DEFAULT 1 NOT NULL,
    "tamanho_fonte" integer DEFAULT 20 NOT NULL,
    "espacamento" numeric DEFAULT 1.7 NOT NULL,
    "tema_leitura" "text" DEFAULT 'CLARO'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "modo_leitura" "text" DEFAULT 'ROLAGEM'::"text" NOT NULL,
    "paginas_por_vista" integer DEFAULT 1 NOT NULL,
    CONSTRAINT "livros_espacamento_check" CHECK ((("espacamento" >= 1.2) AND ("espacamento" <= 2.5))),
    CONSTRAINT "livros_modo_leitura_check" CHECK (("modo_leitura" = ANY (ARRAY['ROLAGEM'::"text", 'PAGINAS'::"text"]))),
    CONSTRAINT "livros_paginas_por_vista_check" CHECK (("paginas_por_vista" = ANY (ARRAY[1, 2]))),
    CONSTRAINT "livros_tamanho_fonte_check" CHECK ((("tamanho_fonte" >= 14) AND ("tamanho_fonte" <= 40))),
    CONSTRAINT "livros_tema_leitura_check" CHECK (("tema_leitura" = ANY (ARRAY['CLARO'::"text", 'ESCURO'::"text"]))),
    CONSTRAINT "livros_total_paginas_check" CHECK ((("total_paginas" IS NULL) OR ("total_paginas" > 0))),
    CONSTRAINT "livros_ultima_pagina_check" CHECK (("ultima_pagina" > 0)),
    CONSTRAINT "livros_ultima_posicao_check" CHECK ((("ultima_posicao" >= (0)::numeric) AND ("ultima_posicao" <= (1)::numeric)))
);


ALTER TABLE "biblia_slides"."livros" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "biblia_slides"."profiles" (
    "id" "uuid" NOT NULL,
    "nome" "text",
    "email" "text",
    "tipo_acesso" "text" DEFAULT 'DEMO'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profiles_tipo_acesso_check" CHECK (("tipo_acesso" = ANY (ARRAY['DEMO'::"text", 'LICENCIADO'::"text"])))
);


ALTER TABLE "biblia_slides"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "biblia_slides"."sermoes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "titulo" "text" NOT NULL,
    "tema" "text",
    "texto_base" "text",
    "arquivo_nome" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "total_paginas" integer,
    "ultima_pagina" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ultima_posicao" numeric DEFAULT 0 NOT NULL,
    "conteudo_processado" "jsonb",
    "processado_em" timestamp with time zone,
    "processador_versao" integer DEFAULT 1 NOT NULL,
    CONSTRAINT "sermoes_total_paginas_check" CHECK ((("total_paginas" IS NULL) OR ("total_paginas" > 0))),
    CONSTRAINT "sermoes_ultima_pagina_check" CHECK (("ultima_pagina" > 0)),
    CONSTRAINT "sermoes_ultima_posicao_check" CHECK ((("ultima_posicao" >= (0)::numeric) AND ("ultima_posicao" <= (1)::numeric)))
);


ALTER TABLE "biblia_slides"."sermoes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "biblia_slides"."trimestres" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "numero" integer NOT NULL,
    "ano" integer NOT NULL,
    "tema" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "trimestres_ano_check" CHECK ((("ano" >= 1900) AND ("ano" <= 2200))),
    CONSTRAINT "trimestres_numero_check" CHECK ((("numero" >= 1) AND ("numero" <= 4)))
);


ALTER TABLE "biblia_slides"."trimestres" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "biblia_slides"."versiculos" (
    "id" bigint NOT NULL,
    "livro_ordem" smallint NOT NULL,
    "livro_codigo" "text" NOT NULL,
    "livro_nome" "text" NOT NULL,
    "livro_slug" "text" NOT NULL,
    "capitulo" smallint NOT NULL,
    "versiculo" smallint NOT NULL,
    "texto" "text" NOT NULL,
    "versao" "text" DEFAULT 'ALM1911_ATUAL'::"text" NOT NULL,
    "fonte_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "versiculos_capitulo_check" CHECK (("capitulo" > 0)),
    CONSTRAINT "versiculos_versiculo_check" CHECK (("versiculo" > 0))
);


ALTER TABLE "biblia_slides"."versiculos" OWNER TO "postgres";


ALTER TABLE "biblia_slides"."versiculos" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "biblia_slides"."versiculos_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE ONLY "biblia_slides"."aulas"
    ADD CONSTRAINT "aulas_numero_unico_no_trimestre" UNIQUE ("trimestre_id", "numero");



ALTER TABLE ONLY "biblia_slides"."aulas"
    ADD CONSTRAINT "aulas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "biblia_slides"."livro_destaques"
    ADD CONSTRAINT "livro_destaques_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "biblia_slides"."livro_marcadores"
    ADD CONSTRAINT "livro_marcadores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "biblia_slides"."livro_notas"
    ADD CONSTRAINT "livro_notas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "biblia_slides"."livros"
    ADD CONSTRAINT "livros_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "biblia_slides"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "biblia_slides"."sermoes"
    ADD CONSTRAINT "sermoes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "biblia_slides"."trimestres"
    ADD CONSTRAINT "trimestres_id_usuario_unico" UNIQUE ("id", "usuario_id");



ALTER TABLE ONLY "biblia_slides"."trimestres"
    ADD CONSTRAINT "trimestres_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "biblia_slides"."trimestres"
    ADD CONSTRAINT "trimestres_usuario_periodo_unico" UNIQUE ("usuario_id", "numero", "ano");



ALTER TABLE ONLY "biblia_slides"."versiculos"
    ADD CONSTRAINT "versiculos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "biblia_slides"."versiculos"
    ADD CONSTRAINT "versiculos_referencia_unica" UNIQUE ("versao", "livro_codigo", "capitulo", "versiculo");



CREATE INDEX "idx_versiculos_referencia" ON "biblia_slides"."versiculos" USING "btree" ("livro_codigo", "capitulo", "versiculo");



CREATE INDEX "livro_destaques_livro_idx" ON "biblia_slides"."livro_destaques" USING "btree" ("usuario_id", "livro_id", "pagina_inicio", "bloco_inicio");



CREATE INDEX "livro_marcadores_livro_idx" ON "biblia_slides"."livro_marcadores" USING "btree" ("usuario_id", "livro_id", "created_at" DESC);



CREATE INDEX "livro_notas_livro_idx" ON "biblia_slides"."livro_notas" USING "btree" ("usuario_id", "livro_id", "pagina_inicio", "bloco_inicio");



CREATE OR REPLACE TRIGGER "aulas_set_updated_at" BEFORE UPDATE ON "biblia_slides"."aulas" FOR EACH ROW EXECUTE FUNCTION "biblia_slides"."set_updated_at"();



CREATE OR REPLACE TRIGGER "aulas_validar_limite_demo" BEFORE INSERT ON "biblia_slides"."aulas" FOR EACH ROW EXECUTE FUNCTION "biblia_slides"."validar_limite_demo_aulas"();



CREATE OR REPLACE TRIGGER "livro_notas_set_updated_at" BEFORE UPDATE ON "biblia_slides"."livro_notas" FOR EACH ROW EXECUTE FUNCTION "biblia_slides"."set_updated_at"();



CREATE OR REPLACE TRIGGER "livros_set_updated_at" BEFORE UPDATE ON "biblia_slides"."livros" FOR EACH ROW EXECUTE FUNCTION "biblia_slides"."set_updated_at"();



CREATE OR REPLACE TRIGGER "profiles_proteger_tipo_acesso" BEFORE INSERT OR UPDATE ON "biblia_slides"."profiles" FOR EACH ROW EXECUTE FUNCTION "biblia_slides"."proteger_tipo_acesso_profile"();



CREATE OR REPLACE TRIGGER "profiles_set_updated_at" BEFORE UPDATE ON "biblia_slides"."profiles" FOR EACH ROW EXECUTE FUNCTION "biblia_slides"."set_updated_at"();



CREATE OR REPLACE TRIGGER "sermoes_set_updated_at" BEFORE UPDATE ON "biblia_slides"."sermoes" FOR EACH ROW EXECUTE FUNCTION "biblia_slides"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trimestres_set_updated_at" BEFORE UPDATE ON "biblia_slides"."trimestres" FOR EACH ROW EXECUTE FUNCTION "biblia_slides"."set_updated_at"();



ALTER TABLE ONLY "biblia_slides"."aulas"
    ADD CONSTRAINT "aulas_trimestre_usuario_fk" FOREIGN KEY ("trimestre_id", "usuario_id") REFERENCES "biblia_slides"."trimestres"("id", "usuario_id") ON DELETE CASCADE;



ALTER TABLE ONLY "biblia_slides"."aulas"
    ADD CONSTRAINT "aulas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "biblia_slides"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "biblia_slides"."livro_destaques"
    ADD CONSTRAINT "livro_destaques_livro_id_fkey" FOREIGN KEY ("livro_id") REFERENCES "biblia_slides"."livros"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "biblia_slides"."livro_destaques"
    ADD CONSTRAINT "livro_destaques_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "biblia_slides"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "biblia_slides"."livro_marcadores"
    ADD CONSTRAINT "livro_marcadores_livro_id_fkey" FOREIGN KEY ("livro_id") REFERENCES "biblia_slides"."livros"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "biblia_slides"."livro_marcadores"
    ADD CONSTRAINT "livro_marcadores_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "biblia_slides"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "biblia_slides"."livro_notas"
    ADD CONSTRAINT "livro_notas_livro_id_fkey" FOREIGN KEY ("livro_id") REFERENCES "biblia_slides"."livros"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "biblia_slides"."livro_notas"
    ADD CONSTRAINT "livro_notas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "biblia_slides"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "biblia_slides"."livros"
    ADD CONSTRAINT "livros_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "biblia_slides"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "biblia_slides"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "biblia_slides"."sermoes"
    ADD CONSTRAINT "sermoes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "biblia_slides"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "biblia_slides"."trimestres"
    ADD CONSTRAINT "trimestres_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "biblia_slides"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE "biblia_slides"."aulas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "aulas_delete_proprias" ON "biblia_slides"."aulas" FOR DELETE TO "authenticated" USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "aulas_insert_proprias" ON "biblia_slides"."aulas" FOR INSERT TO "authenticated" WITH CHECK (("usuario_id" = "auth"."uid"()));



CREATE POLICY "aulas_select_proprias" ON "biblia_slides"."aulas" FOR SELECT TO "authenticated" USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "aulas_update_proprias" ON "biblia_slides"."aulas" FOR UPDATE TO "authenticated" USING (("usuario_id" = "auth"."uid"())) WITH CHECK (("usuario_id" = "auth"."uid"()));



ALTER TABLE "biblia_slides"."livro_destaques" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "livro_destaques_delete_proprios" ON "biblia_slides"."livro_destaques" FOR DELETE TO "authenticated" USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "livro_destaques_insert_proprios" ON "biblia_slides"."livro_destaques" FOR INSERT TO "authenticated" WITH CHECK ((("usuario_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "biblia_slides"."livros" "l"
  WHERE (("l"."id" = "livro_destaques"."livro_id") AND ("l"."usuario_id" = "auth"."uid"()))))));



CREATE POLICY "livro_destaques_select_proprios" ON "biblia_slides"."livro_destaques" FOR SELECT TO "authenticated" USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "livro_destaques_update_proprios" ON "biblia_slides"."livro_destaques" FOR UPDATE TO "authenticated" USING (("usuario_id" = "auth"."uid"())) WITH CHECK ((("usuario_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "biblia_slides"."livros" "l"
  WHERE (("l"."id" = "livro_destaques"."livro_id") AND ("l"."usuario_id" = "auth"."uid"()))))));



ALTER TABLE "biblia_slides"."livro_marcadores" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "livro_marcadores_delete_proprios" ON "biblia_slides"."livro_marcadores" FOR DELETE TO "authenticated" USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "livro_marcadores_insert_proprios" ON "biblia_slides"."livro_marcadores" FOR INSERT TO "authenticated" WITH CHECK ((("usuario_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "biblia_slides"."livros" "l"
  WHERE (("l"."id" = "livro_marcadores"."livro_id") AND ("l"."usuario_id" = "auth"."uid"()))))));



CREATE POLICY "livro_marcadores_select_proprios" ON "biblia_slides"."livro_marcadores" FOR SELECT TO "authenticated" USING (("usuario_id" = "auth"."uid"()));



ALTER TABLE "biblia_slides"."livro_notas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "livro_notas_delete_proprias" ON "biblia_slides"."livro_notas" FOR DELETE TO "authenticated" USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "livro_notas_insert_proprias" ON "biblia_slides"."livro_notas" FOR INSERT TO "authenticated" WITH CHECK ((("usuario_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "biblia_slides"."livros" "l"
  WHERE (("l"."id" = "livro_notas"."livro_id") AND ("l"."usuario_id" = "auth"."uid"()))))));



CREATE POLICY "livro_notas_select_proprias" ON "biblia_slides"."livro_notas" FOR SELECT TO "authenticated" USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "livro_notas_update_proprias" ON "biblia_slides"."livro_notas" FOR UPDATE TO "authenticated" USING (("usuario_id" = "auth"."uid"())) WITH CHECK ((("usuario_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "biblia_slides"."livros" "l"
  WHERE (("l"."id" = "livro_notas"."livro_id") AND ("l"."usuario_id" = "auth"."uid"()))))));



ALTER TABLE "biblia_slides"."livros" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "livros_delete_proprios" ON "biblia_slides"."livros" FOR DELETE TO "authenticated" USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "livros_insert_proprios" ON "biblia_slides"."livros" FOR INSERT TO "authenticated" WITH CHECK (("usuario_id" = "auth"."uid"()));



CREATE POLICY "livros_select_proprios" ON "biblia_slides"."livros" FOR SELECT TO "authenticated" USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "livros_update_proprios" ON "biblia_slides"."livros" FOR UPDATE TO "authenticated" USING (("usuario_id" = "auth"."uid"())) WITH CHECK (("usuario_id" = "auth"."uid"()));



CREATE POLICY "profile_insert_proprio" ON "biblia_slides"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "profile_select_proprio" ON "biblia_slides"."profiles" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



CREATE POLICY "profile_update_proprio" ON "biblia_slides"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



ALTER TABLE "biblia_slides"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "biblia_slides"."sermoes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sermoes_delete_proprios" ON "biblia_slides"."sermoes" FOR DELETE TO "authenticated" USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "sermoes_insert_proprios" ON "biblia_slides"."sermoes" FOR INSERT TO "authenticated" WITH CHECK (("usuario_id" = "auth"."uid"()));



CREATE POLICY "sermoes_select_proprios" ON "biblia_slides"."sermoes" FOR SELECT TO "authenticated" USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "sermoes_update_proprios" ON "biblia_slides"."sermoes" FOR UPDATE TO "authenticated" USING (("usuario_id" = "auth"."uid"())) WITH CHECK (("usuario_id" = "auth"."uid"()));



ALTER TABLE "biblia_slides"."trimestres" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trimestres_delete_proprios" ON "biblia_slides"."trimestres" FOR DELETE TO "authenticated" USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "trimestres_insert_proprios" ON "biblia_slides"."trimestres" FOR INSERT TO "authenticated" WITH CHECK (("usuario_id" = "auth"."uid"()));



CREATE POLICY "trimestres_select_proprios" ON "biblia_slides"."trimestres" FOR SELECT TO "authenticated" USING (("usuario_id" = "auth"."uid"()));



CREATE POLICY "trimestres_update_proprios" ON "biblia_slides"."trimestres" FOR UPDATE TO "authenticated" USING (("usuario_id" = "auth"."uid"())) WITH CHECK (("usuario_id" = "auth"."uid"()));



ALTER TABLE "biblia_slides"."versiculos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "versiculos_leitura" ON "biblia_slides"."versiculos" FOR SELECT TO "authenticated" USING (true);



GRANT USAGE ON SCHEMA "biblia_slides" TO "anon";
GRANT USAGE ON SCHEMA "biblia_slides" TO "authenticated";
GRANT USAGE ON SCHEMA "biblia_slides" TO "service_role";



GRANT ALL ON FUNCTION "biblia_slides"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "biblia_slides"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "biblia_slides"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "biblia_slides"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "biblia_slides"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "biblia_slides"."set_updated_at"() TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "biblia_slides"."aulas" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "biblia_slides"."aulas" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "biblia_slides"."aulas" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "biblia_slides"."livro_destaques" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "biblia_slides"."livro_destaques" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "biblia_slides"."livro_destaques" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "biblia_slides"."livro_marcadores" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "biblia_slides"."livro_marcadores" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "biblia_slides"."livro_marcadores" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "biblia_slides"."livro_notas" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "biblia_slides"."livro_notas" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "biblia_slides"."livro_notas" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "biblia_slides"."livros" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "biblia_slides"."livros" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "biblia_slides"."livros" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "biblia_slides"."profiles" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "biblia_slides"."profiles" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "biblia_slides"."profiles" TO "service_role";



GRANT INSERT("id") ON TABLE "biblia_slides"."profiles" TO "authenticated";



GRANT INSERT("nome"),UPDATE("nome") ON TABLE "biblia_slides"."profiles" TO "authenticated";



GRANT INSERT("email"),UPDATE("email") ON TABLE "biblia_slides"."profiles" TO "authenticated";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "biblia_slides"."sermoes" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "biblia_slides"."sermoes" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "biblia_slides"."sermoes" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "biblia_slides"."trimestres" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "biblia_slides"."trimestres" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "biblia_slides"."trimestres" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "biblia_slides"."versiculos" TO "anon";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "biblia_slides"."versiculos" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "biblia_slides"."versiculos" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "biblia_slides"."versiculos_id_seq" TO "anon";
GRANT SELECT,USAGE ON SEQUENCE "biblia_slides"."versiculos_id_seq" TO "authenticated";
GRANT SELECT,USAGE ON SEQUENCE "biblia_slides"."versiculos_id_seq" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "biblia_slides" GRANT SELECT,USAGE ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "biblia_slides" GRANT SELECT,USAGE ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "biblia_slides" GRANT SELECT,USAGE ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "biblia_slides" GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "biblia_slides" GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "biblia_slides" GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO "service_role";




