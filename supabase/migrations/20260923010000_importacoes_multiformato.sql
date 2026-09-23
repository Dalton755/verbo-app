/*
 * VERBO — importações multiformato
 *
 * Livros: PDF + EPUB
 * Sermões: PDF + DOCX
 * EBD: PDF + PPTX
 */

update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'application/epub+zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
]
where id = 'biblia-slides-pdfs';


alter table biblia_slides.livros
  add column if not exists arquivo_tipo text;

update biblia_slides.livros
set arquivo_tipo = 'pdf'
where arquivo_tipo is null;

alter table biblia_slides.livros
  alter column arquivo_tipo set default 'pdf';

alter table biblia_slides.livros
  alter column arquivo_tipo set not null;

alter table biblia_slides.livros
  drop constraint if exists livros_arquivo_tipo_check;

alter table biblia_slides.livros
  add constraint livros_arquivo_tipo_check
  check (
    arquivo_tipo in (
      'pdf',
      'epub'
    )
  );


alter table biblia_slides.sermoes
  add column if not exists arquivo_tipo text;

update biblia_slides.sermoes
set arquivo_tipo = 'pdf'
where arquivo_tipo is null;

alter table biblia_slides.sermoes
  alter column arquivo_tipo set default 'pdf';

alter table biblia_slides.sermoes
  alter column arquivo_tipo set not null;

alter table biblia_slides.sermoes
  drop constraint if exists sermoes_arquivo_tipo_check;

alter table biblia_slides.sermoes
  add constraint sermoes_arquivo_tipo_check
  check (
    arquivo_tipo in (
      'pdf',
      'docx'
    )
  );


alter table biblia_slides.aulas
  add column if not exists arquivo_tipo text;

alter table biblia_slides.aulas
  add column if not exists conteudo_processado jsonb;

alter table biblia_slides.aulas
  add column if not exists processado_em timestamptz;

alter table biblia_slides.aulas
  add column if not exists processador_versao integer default 1 not null;

update biblia_slides.aulas
set arquivo_tipo = 'pdf'
where arquivo_tipo is null;

alter table biblia_slides.aulas
  alter column arquivo_tipo set default 'pdf';

alter table biblia_slides.aulas
  alter column arquivo_tipo set not null;

alter table biblia_slides.aulas
  drop constraint if exists aulas_arquivo_tipo_check;

alter table biblia_slides.aulas
  add constraint aulas_arquivo_tipo_check
  check (
    arquivo_tipo in (
      'pdf',
      'pptx'
    )
  );

comment on column biblia_slides.livros.arquivo_tipo
  is 'Formato original: pdf ou epub';

comment on column biblia_slides.sermoes.arquivo_tipo
  is 'Formato original: pdf ou docx';

comment on column biblia_slides.aulas.arquivo_tipo
  is 'Formato original: pdf ou pptx';

comment on column biblia_slides.aulas.conteudo_processado
  is 'Conteúdo estruturado extraído de PPTX para apresentação no VERBO';
