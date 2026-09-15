INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'biblia-slides-pdfs',
  'biblia-slides-pdfs',
  false,
  52428800,
  ARRAY['application/pdf']
)
ON CONFLICT (id)
DO UPDATE SET
  name = EXCLUDED.name,
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;


DROP POLICY IF EXISTS
  "biblia_slides_storage_select"
ON storage.objects;

CREATE POLICY
  "biblia_slides_storage_select"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'biblia-slides-pdfs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);


DROP POLICY IF EXISTS
  "biblia_slides_storage_insert"
ON storage.objects;

CREATE POLICY
  "biblia_slides_storage_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'biblia-slides-pdfs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);


DROP POLICY IF EXISTS
  "biblia_slides_storage_update"
ON storage.objects;

CREATE POLICY
  "biblia_slides_storage_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'biblia-slides-pdfs'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'biblia-slides-pdfs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);


DROP POLICY IF EXISTS
  "biblia_slides_storage_delete"
ON storage.objects;

CREATE POLICY
  "biblia_slides_storage_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'biblia-slides-pdfs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
