-- Mantém os materiais do trimestre dentro do limite oficial da DEMO do módulo EBD.
-- Livro de apoio vinculado a trimestre conta como EBD, não como LIVROS.
-- Revista também ocupa o slot de demonstração do EBD.

create or replace function biblia_slides.proteger_limite_demo_modulo()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'biblia_slides'
as $function$
declare
  v_usuario uuid;
  v_estado text;
  v_modulo text;
  v_slot uuid;
begin
  v_usuario := auth.uid();

  if v_usuario is null then
    return new;
  end if;

  if new.usuario_id is distinct from v_usuario then
    raise exception
      using
        errcode = 'P0001',
        message = 'USUARIO_INVALIDO';
  end if;

  select acesso.estado
  into v_estado
  from biblia_slides.meu_acesso_app() acesso
  limit 1;

  if v_estado = 'EXPIRADO' then
    raise exception
      using
        errcode = 'P0001',
        message = 'DEMO_EXPIRADA';
  end if;

  if v_estado is distinct from 'TESTE' then
    return new;
  end if;

  if TG_TABLE_NAME = 'aulas' then
    v_modulo := 'EBD';
  elsif TG_TABLE_NAME = 'revistas_ebd' then
    v_modulo := 'EBD';
  elsif TG_TABLE_NAME = 'sermoes' then
    v_modulo := 'SERMOES';
  elsif TG_TABLE_NAME = 'livros' then
    if new.trimestre_id is not null then
      v_modulo := 'EBD';
    else
      v_modulo := 'LIVROS';
    end if;
  else
    v_modulo := null;
  end if;

  if v_modulo is null then
    return new;
  end if;

  insert into biblia_slides.demo_modulo_slots (
    user_id,
    modulo,
    recurso_id
  )
  values (
    v_usuario,
    v_modulo,
    new.id
  )
  on conflict (
    user_id,
    modulo
  )
  do nothing
  returning recurso_id
  into v_slot;

  if v_slot is null then
    raise exception
      using
        errcode = 'P0001',
        message = 'DEMO_LIMITE_MODULO';
  end if;

  return new;
end;
$function$;

create or replace function biblia_slides.liberar_slot_demo_modulo()
returns trigger
language plpgsql
security definer
set search_path to 'biblia_slides', 'public', 'pg_temp'
as $function$
declare
  v_modulo text;
begin
  if TG_TABLE_NAME = 'aulas' then
    v_modulo := 'EBD';
  elsif TG_TABLE_NAME = 'revistas_ebd' then
    v_modulo := 'EBD';
  elsif TG_TABLE_NAME = 'sermoes' then
    v_modulo := 'SERMOES';
  elsif TG_TABLE_NAME = 'livros' then
    if old.trimestre_id is not null then
      v_modulo := 'EBD';
    else
      v_modulo := 'LIVROS';
    end if;
  else
    v_modulo := null;
  end if;

  if v_modulo is not null then
    delete from biblia_slides.demo_modulo_slots
    where user_id = old.usuario_id
      and modulo = v_modulo
      and recurso_id = old.id;
  end if;

  return old;
end;
$function$;

drop trigger if exists trg_limite_demo_revistas_ebd
  on biblia_slides.revistas_ebd;

create trigger trg_limite_demo_revistas_ebd
before insert on biblia_slides.revistas_ebd
for each row
execute function biblia_slides.proteger_limite_demo_modulo();

drop trigger if exists trg_liberar_demo_revistas_ebd
  on biblia_slides.revistas_ebd;

create trigger trg_liberar_demo_revistas_ebd
after delete on biblia_slides.revistas_ebd
for each row
execute function biblia_slides.liberar_slot_demo_modulo();
