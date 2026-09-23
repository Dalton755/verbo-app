/*
 * VERBO — correção da leitura de extensão no hotfix multiformato.
 *
 * A versão anterior usava uma expressão regular que, no Postgres
 * do projeto, retornava NULL para as extensões. Esta versão usa
 * reverse/split_part, mantendo o mesmo contrato público.
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
        reverse(
          split_part(
            reverse(p_caminho),
            '.',
            1
          )
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
