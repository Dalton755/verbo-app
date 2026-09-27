-- Materiais de apoio do EBD: revista preservada em PDF e livros vinculados ao trimestre.
-- A revista fica separada das aulas para manter o layout original do material.
-- Livros de apoio reutilizam o leitor completo já existente no VERBO.

alter table biblia_slides.livros
  add column if not exists trimestre_id uuid;

create index if not exists livros_trimestre_idx
  on biblia_slides.livros (usuario_id, trimestre_id, created_at desc)
  where trimestre_id is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'livros_trimestre_usuario_fkey'
      and conrelid = 'biblia_slides.livros'::regclass
  ) then
    alter table biblia_slides.livros
      add constraint livros_trimestre_usuario_fkey
      foreign key (trimestre_id, usuario_id)
      references biblia_slides.trimestres (id, usuario_id)
      on delete cascade;
  end if;
end
$$;

create table if not exists biblia_slides.revistas_ebd (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null,
  trimestre_id uuid not null,
  titulo text not null,
  arquivo_nome text not null,
  storage_path text not null,
  total_paginas integer not null,
  ultima_pagina integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint revistas_ebd_total_paginas_check
    check (total_paginas > 0),

  constraint revistas_ebd_ultima_pagina_check
    check (ultima_pagina > 0),

  constraint revistas_ebd_trimestre_unico
    unique (trimestre_id),

  constraint revistas_ebd_trimestre_usuario_fkey
    foreign key (trimestre_id, usuario_id)
    references biblia_slides.trimestres (id, usuario_id)
    on delete cascade,

  constraint revistas_ebd_usuario_fkey
    foreign key (usuario_id)
    references biblia_slides.profiles (id)
    on delete cascade
);

create index if not exists revistas_ebd_usuario_idx
  on biblia_slides.revistas_ebd (usuario_id, created_at desc);

drop trigger if exists revistas_ebd_set_updated_at
  on biblia_slides.revistas_ebd;

create trigger revistas_ebd_set_updated_at
before update on biblia_slides.revistas_ebd
for each row
execute function biblia_slides.set_updated_at();

alter table biblia_slides.revistas_ebd
  enable row level security;

drop policy if exists revistas_ebd_select_proprias
  on biblia_slides.revistas_ebd;

create policy revistas_ebd_select_proprias
  on biblia_slides.revistas_ebd
  for select
  to authenticated
  using (usuario_id = auth.uid());

drop policy if exists revistas_ebd_insert_proprias
  on biblia_slides.revistas_ebd;

create policy revistas_ebd_insert_proprias
  on biblia_slides.revistas_ebd
  for insert
  to authenticated
  with check (
    usuario_id = auth.uid()
    and exists (
      select 1
      from biblia_slides.trimestres t
      where t.id = revistas_ebd.trimestre_id
        and t.usuario_id = auth.uid()
    )
  );

drop policy if exists revistas_ebd_update_proprias
  on biblia_slides.revistas_ebd;

create policy revistas_ebd_update_proprias
  on biblia_slides.revistas_ebd
  for update
  to authenticated
  using (usuario_id = auth.uid())
  with check (
    usuario_id = auth.uid()
    and exists (
      select 1
      from biblia_slides.trimestres t
      where t.id = revistas_ebd.trimestre_id
        and t.usuario_id = auth.uid()
    )
  );

drop policy if exists revistas_ebd_delete_proprias
  on biblia_slides.revistas_ebd;

create policy revistas_ebd_delete_proprias
  on biblia_slides.revistas_ebd
  for delete
  to authenticated
  using (usuario_id = auth.uid());

grant select, insert, update, delete
  on table biblia_slides.revistas_ebd
  to authenticated, service_role;
