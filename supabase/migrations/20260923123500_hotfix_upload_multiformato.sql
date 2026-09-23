/*
 * VERBO — hotfix de upload multiformato
 *
 * Corrige duas incompatibilidades que só aparecem
 * no fluxo real com Supabase Storage:
 *
 * 1. reservas_upload ainda gravava application/pdf
 *    para EPUB, DOCX e PPTX;
 * 2. a policy do Storage aceitava somente application/pdf.
 *
 * A assinatura pública de reservar_upload permanece
 * inalterada para não quebrar clientes existentes.
 */

create or replace function biblia_slides.mime_arquivo_por_caminho(
  p_caminho text
)
returns text
language sql
immutable
strict
set search_path = pg_catalog, public, biblia_slides
as $$
  with dados as (
    select
      lower(split_part(p_caminho, '/', 2)) as modulo,
      lower(
        substring(
          p_caminho
          from '\\.([^.\\/]+)$'
        )
      ) as extensao
  )
  select
    case
      when modulo = 'livros'
       and extensao = 'pdf'
        then 'application/pdf'

      when modulo = 'livros'
       and extensao = 'epub'
        then 'application/epub+zip'

      when modulo = 'sermoes'
       and extensao = 'pdf'
        then 'application/pdf'

      when modulo = 'sermoes'
       and extensao = 'docx'
        then 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

      when modulo not in ('livros', 'sermoes')
       and extensao = 'pdf'
        then 'application/pdf'

      when modulo not in ('livros', 'sermoes')
       and extensao = 'pptx'
        then 'application/vnd.openxmlformats-officedocument.presentationml.presentation'

      else null
    end
  from dados;
$$;


create or replace function biblia_slides.normalizar_reserva_upload_content_type()
returns trigger
language plpgsql
set search_path = pg_catalog, public, biblia_slides
as $$
declare
  v_content_type text;
begin
  v_content_type :=
    biblia_slides.mime_arquivo_por_caminho(
      new.caminho
    );

  if v_content_type is null then
    raise exception
      'Formato de arquivo não permitido para este módulo.';
  end if;

  new.content_type :=
    v_content_type;

  return new;
end;
$$;


drop trigger if exists reservas_upload_normalizar_content_type
on biblia_slides.reservas_upload;

create trigger reservas_upload_normalizar_content_type
before insert or update of caminho, content_type
on biblia_slides.reservas_upload
for each row
execute function biblia_slides.normalizar_reserva_upload_content_type();


update biblia_slides.reservas_upload
set content_type =
  biblia_slides.mime_arquivo_por_caminho(
    caminho
  )
where
  biblia_slides.mime_arquivo_por_caminho(
    caminho
  ) is not null
  and content_type is distinct from
    biblia_slides.mime_arquivo_por_caminho(
      caminho
    );


create or replace function biblia_slides.upload_reservado_valido(
  p_bucket_id text,
  p_caminho text,
  p_metadata jsonb
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth, storage, biblia_slides
as $$
declare
  v_usuario_id uuid;
  v_content_length bigint;
  v_content_length_text text;
  v_mimetype text;
  v_mimetype_esperado text;
begin
  v_usuario_id :=
    auth.uid();

  if v_usuario_id is null then
    return false;
  end if;

  if p_bucket_id is distinct from
     'biblia-slides-pdfs' then
    return false;
  end if;

  if p_caminho is null
     or (storage.foldername(p_caminho))[1]
        is distinct from v_usuario_id::text then
    return false;
  end if;

  if not coalesce(
    biblia_slides.tem_licenca_ativa(),
    false
  ) then
    return false;
  end if;

  v_mimetype :=
    lower(
      p_metadata->>'mimetype'
    );

  v_mimetype_esperado :=
    biblia_slides.mime_arquivo_por_caminho(
      p_caminho
    );

  if v_mimetype_esperado is null then
    return false;
  end if;

  if v_mimetype is distinct from
     v_mimetype_esperado then
    return false;
  end if;

  v_content_length_text :=
    p_metadata->>'contentLength';

  if v_content_length_text is null
     or v_content_length_text !~ '^[0-9]+$' then
    return false;
  end if;

  v_content_length :=
    v_content_length_text::bigint;

  if v_content_length <= 0 then
    return false;
  end if;

  return exists (
    select 1
    from biblia_slides.reservas_upload as r
    where r.usuario_id = v_usuario_id
      and r.bucket_id = p_bucket_id
      and r.caminho = p_caminho
      and r.arquivo_bytes = v_content_length
      and r.content_type = v_mimetype_esperado
      and r.status = 'PENDENTE'
      and r.expira_em > now()
  );
end;
$$;
