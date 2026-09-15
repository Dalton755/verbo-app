-- =========================================================
-- TRIMESTRES
-- =========================================================

DROP POLICY IF EXISTS "trimestres_select_proprios"
ON biblia_slides.trimestres;

CREATE POLICY "trimestres_select_proprios"
ON biblia_slides.trimestres
FOR SELECT
TO authenticated
USING (
  usuario_id = auth.uid()
  AND biblia_slides.tem_licenca_ativa()
);

DROP POLICY IF EXISTS "trimestres_insert_proprios"
ON biblia_slides.trimestres;

CREATE POLICY "trimestres_insert_proprios"
ON biblia_slides.trimestres
FOR INSERT
TO authenticated
WITH CHECK (
  usuario_id = auth.uid()
  AND biblia_slides.tem_licenca_ativa()
);

DROP POLICY IF EXISTS "trimestres_update_proprios"
ON biblia_slides.trimestres;

CREATE POLICY "trimestres_update_proprios"
ON biblia_slides.trimestres
FOR UPDATE
TO authenticated
USING (
  usuario_id = auth.uid()
  AND biblia_slides.tem_licenca_ativa()
)
WITH CHECK (
  usuario_id = auth.uid()
  AND biblia_slides.tem_licenca_ativa()
);

DROP POLICY IF EXISTS "trimestres_delete_proprios"
ON biblia_slides.trimestres;

CREATE POLICY "trimestres_delete_proprios"
ON biblia_slides.trimestres
FOR DELETE
TO authenticated
USING (
  usuario_id = auth.uid()
  AND biblia_slides.tem_licenca_ativa()
);


-- =========================================================
-- AULAS
-- =========================================================

DROP POLICY IF EXISTS "aulas_select_proprias"
ON biblia_slides.aulas;

CREATE POLICY "aulas_select_proprias"
ON biblia_slides.aulas
FOR SELECT
TO authenticated
USING (
  usuario_id = auth.uid()
  AND biblia_slides.tem_licenca_ativa()
);

DROP POLICY IF EXISTS "aulas_insert_proprias"
ON biblia_slides.aulas;

CREATE POLICY "aulas_insert_proprias"
ON biblia_slides.aulas
FOR INSERT
TO authenticated
WITH CHECK (
  usuario_id = auth.uid()
  AND biblia_slides.tem_licenca_ativa()
);

DROP POLICY IF EXISTS "aulas_update_proprias"
ON biblia_slides.aulas;

CREATE POLICY "aulas_update_proprias"
ON biblia_slides.aulas
FOR UPDATE
TO authenticated
USING (
  usuario_id = auth.uid()
  AND biblia_slides.tem_licenca_ativa()
)
WITH CHECK (
  usuario_id = auth.uid()
  AND biblia_slides.tem_licenca_ativa()
);

DROP POLICY IF EXISTS "aulas_delete_proprias"
ON biblia_slides.aulas;

CREATE POLICY "aulas_delete_proprias"
ON biblia_slides.aulas
FOR DELETE
TO authenticated
USING (
  usuario_id = auth.uid()
  AND biblia_slides.tem_licenca_ativa()
);


-- =========================================================
-- SERMOES
-- =========================================================

DROP POLICY IF EXISTS "sermoes_select_proprios"
ON biblia_slides.sermoes;

CREATE POLICY "sermoes_select_proprios"
ON biblia_slides.sermoes
FOR SELECT
TO authenticated
USING (
  usuario_id = auth.uid()
  AND biblia_slides.tem_licenca_ativa()
);

DROP POLICY IF EXISTS "sermoes_insert_proprios"
ON biblia_slides.sermoes;

CREATE POLICY "sermoes_insert_proprios"
ON biblia_slides.sermoes
FOR INSERT
TO authenticated
WITH CHECK (
  usuario_id = auth.uid()
  AND biblia_slides.tem_licenca_ativa()
);

DROP POLICY IF EXISTS "sermoes_update_proprios"
ON biblia_slides.sermoes;

CREATE POLICY "sermoes_update_proprios"
ON biblia_slides.sermoes
FOR UPDATE
TO authenticated
USING (
  usuario_id = auth.uid()
  AND biblia_slides.tem_licenca_ativa()
)
WITH CHECK (
  usuario_id = auth.uid()
  AND biblia_slides.tem_licenca_ativa()
);

DROP POLICY IF EXISTS "sermoes_delete_proprios"
ON biblia_slides.sermoes;

CREATE POLICY "sermoes_delete_proprios"
ON biblia_slides.sermoes
FOR DELETE
TO authenticated
USING (
  usuario_id = auth.uid()
  AND biblia_slides.tem_licenca_ativa()
);


-- =========================================================
-- LIVROS
-- =========================================================

DROP POLICY IF EXISTS "livros_select_proprios"
ON biblia_slides.livros;

CREATE POLICY "livros_select_proprios"
ON biblia_slides.livros
FOR SELECT
TO authenticated
USING (
  usuario_id = auth.uid()
  AND biblia_slides.tem_licenca_ativa()
);

DROP POLICY IF EXISTS "livros_insert_proprios"
ON biblia_slides.livros;

CREATE POLICY "livros_insert_proprios"
ON biblia_slides.livros
FOR INSERT
TO authenticated
WITH CHECK (
  usuario_id = auth.uid()
  AND biblia_slides.tem_licenca_ativa()
);

DROP POLICY IF EXISTS "livros_update_proprios"
ON biblia_slides.livros;

CREATE POLICY "livros_update_proprios"
ON biblia_slides.livros
FOR UPDATE
TO authenticated
USING (
  usuario_id = auth.uid()
  AND biblia_slides.tem_licenca_ativa()
)
WITH CHECK (
  usuario_id = auth.uid()
  AND biblia_slides.tem_licenca_ativa()
);

DROP POLICY IF EXISTS "livros_delete_proprios"
ON biblia_slides.livros;

CREATE POLICY "livros_delete_proprios"
ON biblia_slides.livros
FOR DELETE
TO authenticated
USING (
  usuario_id = auth.uid()
  AND biblia_slides.tem_licenca_ativa()
);


-- =========================================================
-- MARCADORES
-- =========================================================

DROP POLICY IF EXISTS "livro_marcadores_select_proprios"
ON biblia_slides.livro_marcadores;

CREATE POLICY "livro_marcadores_select_proprios"
ON biblia_slides.livro_marcadores
FOR SELECT
TO authenticated
USING (
  usuario_id = auth.uid()
  AND biblia_slides.tem_licenca_ativa()
);

DROP POLICY IF EXISTS "livro_marcadores_insert_proprios"
ON biblia_slides.livro_marcadores;

CREATE POLICY "livro_marcadores_insert_proprios"
ON biblia_slides.livro_marcadores
FOR INSERT
TO authenticated
WITH CHECK (
  usuario_id = auth.uid()
  AND biblia_slides.tem_licenca_ativa()
);

DROP POLICY IF EXISTS "livro_marcadores_delete_proprios"
ON biblia_slides.livro_marcadores;

CREATE POLICY "livro_marcadores_delete_proprios"
ON biblia_slides.livro_marcadores
FOR DELETE
TO authenticated
USING (
  usuario_id = auth.uid()
  AND biblia_slides.tem_licenca_ativa()
);


-- =========================================================
-- DESTAQUES
-- =========================================================

DROP POLICY IF EXISTS "livro_destaques_select_proprios"
ON biblia_slides.livro_destaques;

CREATE POLICY "livro_destaques_select_proprios"
ON biblia_slides.livro_destaques
FOR SELECT
TO authenticated
USING (
  usuario_id = auth.uid()
  AND biblia_slides.tem_licenca_ativa()
);

DROP POLICY IF EXISTS "livro_destaques_insert_proprios"
ON biblia_slides.livro_destaques;

CREATE POLICY "livro_destaques_insert_proprios"
ON biblia_slides.livro_destaques
FOR INSERT
TO authenticated
WITH CHECK (
  usuario_id = auth.uid()
  AND biblia_slides.tem_licenca_ativa()
);

DROP POLICY IF EXISTS "livro_destaques_update_proprios"
ON biblia_slides.livro_destaques;

CREATE POLICY "livro_destaques_update_proprios"
ON biblia_slides.livro_destaques
FOR UPDATE
TO authenticated
USING (
  usuario_id = auth.uid()
  AND biblia_slides.tem_licenca_ativa()
)
WITH CHECK (
  usuario_id = auth.uid()
  AND biblia_slides.tem_licenca_ativa()
);

DROP POLICY IF EXISTS "livro_destaques_delete_proprios"
ON biblia_slides.livro_destaques;

CREATE POLICY "livro_destaques_delete_proprios"
ON biblia_slides.livro_destaques
FOR DELETE
TO authenticated
USING (
  usuario_id = auth.uid()
  AND biblia_slides.tem_licenca_ativa()
);


-- =========================================================
-- NOTAS
-- =========================================================

DROP POLICY IF EXISTS "livro_notas_select_proprias"
ON biblia_slides.livro_notas;

CREATE POLICY "livro_notas_select_proprias"
ON biblia_slides.livro_notas
FOR SELECT
TO authenticated
USING (
  usuario_id = auth.uid()
  AND biblia_slides.tem_licenca_ativa()
);

DROP POLICY IF EXISTS "livro_notas_insert_proprias"
ON biblia_slides.livro_notas;

CREATE POLICY "livro_notas_insert_proprias"
ON biblia_slides.livro_notas
FOR INSERT
TO authenticated
WITH CHECK (
  usuario_id = auth.uid()
  AND biblia_slides.tem_licenca_ativa()
);

DROP POLICY IF EXISTS "livro_notas_update_proprias"
ON biblia_slides.livro_notas;

CREATE POLICY "livro_notas_update_proprias"
ON biblia_slides.livro_notas
FOR UPDATE
TO authenticated
USING (
  usuario_id = auth.uid()
  AND biblia_slides.tem_licenca_ativa()
)
WITH CHECK (
  usuario_id = auth.uid()
  AND biblia_slides.tem_licenca_ativa()
);

DROP POLICY IF EXISTS "livro_notas_delete_proprias"
ON biblia_slides.livro_notas;

CREATE POLICY "livro_notas_delete_proprias"
ON biblia_slides.livro_notas
FOR DELETE
TO authenticated
USING (
  usuario_id = auth.uid()
  AND biblia_slides.tem_licenca_ativa()
);


-- =========================================================
-- STORAGE
-- =========================================================

DROP POLICY IF EXISTS "biblia_slides_storage_select"
ON storage.objects;

CREATE POLICY "biblia_slides_storage_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'biblia-slides-pdfs'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND biblia_slides.tem_licenca_ativa()
);

DROP POLICY IF EXISTS "biblia_slides_storage_insert"
ON storage.objects;

CREATE POLICY "biblia_slides_storage_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'biblia-slides-pdfs'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND biblia_slides.tem_licenca_ativa()
);

DROP POLICY IF EXISTS "biblia_slides_storage_update"
ON storage.objects;

CREATE POLICY "biblia_slides_storage_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'biblia-slides-pdfs'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND biblia_slides.tem_licenca_ativa()
)
WITH CHECK (
  bucket_id = 'biblia-slides-pdfs'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND biblia_slides.tem_licenca_ativa()
);

DROP POLICY IF EXISTS "biblia_slides_storage_delete"
ON storage.objects;

CREATE POLICY "biblia_slides_storage_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'biblia-slides-pdfs'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND biblia_slides.tem_licenca_ativa()
);
