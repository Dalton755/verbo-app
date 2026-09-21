-- Liberação administrativa de acesso e armazenamento
-- Exclusivo para a conta administrativa definida pelo proprietário.

create table if not exists biblia_slides.admin_liberacoes_acesso (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references biblia_slides.profiles(id) on delete cascade,
  limite_bytes bigint not null check (limite_bytes > 0),
  vitalicio boolean not null default false,
  inicio_em timestamptz not null default now(),
  expira_em timestamptz,
  status text not null default 'ATIVA'
    check (status in ('ATIVA', 'SUBSTITUIDA', 'REVOGADA')),
  concedido_por uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (vitalicio = true and expira_em is null)
    or
    (vitalicio = false and expira_em is not null)
  )
);

create index if not exists admin_liberacoes_acesso_usuario_idx
  on biblia_slides.admin_liberacoes_acesso (usuario_id, status, expira_em);

create unique index if not exists admin_liberacoes_acesso_ativa_unica
  on biblia_slides.admin_liberacoes_acesso (usuario_id)
  where status = 'ATIVA';

alter table biblia_slides.admin_liberacoes_acesso enable row level security;

revoke all
on table biblia_slides.admin_liberacoes_acesso
from public, anon, authenticated;


create or replace function biblia_slides.eh_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    auth.uid() is not null
    and lower(
      coalesce(
        auth.jwt()->>'email',
        ''
      )
    ) = 'rochadalton00@gmail.com'
    and exists (
      select 1
      from biblia_slides.admin_usuarios a
      where a.user_id = auth.uid()
    );
$$;

revoke all on function biblia_slides.eh_admin() from public, anon;
grant execute on function biblia_slides.eh_admin() to authenticated;


create or replace function biblia_slides.tem_licenca_ativa()
returns boolean
language sql
stable
security definer
set search_path = 'pg_catalog', 'public', 'auth', 'biblia_slides'
as $$
  select
    auth.uid() is not null
    and
    (
      exists (
        select 1
        from biblia_slides.licencas l
        where l.usuario_id = auth.uid()
          and l.status = 'ATIVA'
          and (
            l.expira_em is null
            or l.expira_em > now()
          )
      )

      or

      exists (
        select 1
        from biblia_slides.admin_liberacoes_acesso al
        where al.usuario_id = auth.uid()
          and al.status = 'ATIVA'
          and (
            al.vitalicio = true
            or al.expira_em > now()
          )
      )

      or

      exists (
        select 1
        from biblia_slides.profiles p
        where p.id = auth.uid()
          and p.teste_iniciado_em
                + interval '7 days'
              > now()
      )
    );
$$;


create or replace function biblia_slides.meu_acesso_app()
returns table(
  tem_acesso boolean,
  estado text,
  teste_iniciado_em timestamptz,
  teste_expira_em timestamptz,
  segundos_restantes bigint,
  licenca_vitalicia boolean
)
language sql
stable
security definer
set search_path = 'pg_catalog', 'public', 'auth', 'biblia_slides'
as $$
  with dados as (
    select
      p.teste_iniciado_em,

      p.teste_iniciado_em
        + interval '7 days'
        as teste_original_expira_em,

      exists (
        select 1
        from biblia_slides.licencas l
        where l.usuario_id = p.id
          and l.status = 'ATIVA'
          and (
            l.expira_em is null
            or l.expira_em > now()
          )
      ) as licenca_paga_ativa,

      al.id as liberacao_id,
      al.vitalicio as liberacao_vitalicia,
      al.expira_em as liberacao_expira_em

    from biblia_slides.profiles p

    left join lateral (
      select
        x.id,
        x.vitalicio,
        x.expira_em
      from biblia_slides.admin_liberacoes_acesso x
      where x.usuario_id = p.id
        and x.status = 'ATIVA'
        and (
          x.vitalicio = true
          or x.expira_em > now()
        )
      order by x.created_at desc
      limit 1
    ) al on true

    where p.id = auth.uid()
  )

  select
    (
      d.licenca_paga_ativa
      or d.liberacao_id is not null
      or d.teste_original_expira_em > now()
    ) as tem_acesso,

    case
      when d.licenca_paga_ativa
        then 'VITALICIO'

      when d.liberacao_id is not null
           and d.liberacao_vitalicia = true
        then 'VITALICIO'

      when d.liberacao_id is not null
        then 'LIBERADO'

      when d.teste_original_expira_em > now()
        then 'TESTE'

      else 'EXPIRADO'
    end as estado,

    d.teste_iniciado_em,

    case
      when d.licenca_paga_ativa
        then null::timestamptz

      when d.liberacao_id is not null
        then d.liberacao_expira_em

      else d.teste_original_expira_em
    end as teste_expira_em,

    case
      when d.licenca_paga_ativa
        then null::bigint

      when d.liberacao_id is not null
           and d.liberacao_vitalicia = true
        then null::bigint

      when d.liberacao_id is not null
        then greatest(
          0,
          floor(
            extract(
              epoch from (
                d.liberacao_expira_em - now()
              )
            )
          )
        )::bigint

      else
        greatest(
          0,
          floor(
            extract(
              epoch from (
                d.teste_original_expira_em - now()
              )
            )
          )
        )::bigint
    end as segundos_restantes,

    (
      d.licenca_paga_ativa
      or (
        d.liberacao_id is not null
        and d.liberacao_vitalicia = true
      )
    ) as licenca_vitalicia

  from dados d;
$$;


create or replace function biblia_slides.meu_armazenamento()
returns table(
  usuario_id uuid,
  licenca_ativa boolean,
  plano_codigo text,
  plano_nome text,
  tipo_cobranca text,
  preco numeric,
  limite_bytes bigint,
  usado_bytes bigint,
  disponivel_bytes bigint,
  percentual_usado numeric,
  upgrade_ativo boolean
)
language plpgsql
security definer
set search_path = 'pg_catalog', 'public', 'auth', 'storage', 'biblia_slides'
as $$
declare
  v_usuario_id uuid;

  v_licenca_ativa boolean := false;
  v_licenca_paga boolean := false;

  v_plano_codigo text;
  v_plano_nome text;
  v_tipo_cobranca text;
  v_preco numeric;

  v_limite_bytes bigint := 0;
  v_usado_bytes bigint := 0;

  v_upgrade_ativo boolean := false;

  v_manual_limite bigint;
  v_manual_vitalicio boolean;
  v_manual_expira timestamptz;
begin
  v_usuario_id := auth.uid();

  if v_usuario_id is null then
    raise exception 'Usuário não autenticado.';
  end if;

  select coalesce(
    biblia_slides.tem_licenca_ativa(),
    false
  )
  into v_licenca_ativa;

  select exists (
    select 1
    from biblia_slides.licencas l
    where l.usuario_id = v_usuario_id
      and l.status = 'ATIVA'
      and (
        l.expira_em is null
        or l.expira_em > now()
      )
  )
  into v_licenca_paga;

  if v_licenca_ativa then

    select
      p.codigo,
      p.nome,
      p.tipo_cobranca,
      p.preco,
      p.limite_bytes

    into
      v_plano_codigo,
      v_plano_nome,
      v_tipo_cobranca,
      v_preco,
      v_limite_bytes

    from biblia_slides.armazenamento_usuarios au

    inner join biblia_slides.planos_armazenamento p
      on p.id = au.plano_id

    where au.usuario_id = v_usuario_id
      and au.status = 'ATIVA'
      and (
        au.fim_em is null
        or au.fim_em > now()
      )
      and p.ativo = true
      and p.tipo_cobranca = 'MENSAL'

    order by
      p.limite_bytes desc,
      au.inicio_em desc

    limit 1;

    if found then
      v_upgrade_ativo := true;
    else
      select
        p.codigo,
        p.nome,
        p.tipo_cobranca,
        p.preco,
        p.limite_bytes

      into
        v_plano_codigo,
        v_plano_nome,
        v_tipo_cobranca,
        v_preco,
        v_limite_bytes

      from biblia_slides.armazenamento_base_usuarios abu

      inner join biblia_slides.planos_armazenamento p
        on p.id = abu.plano_id

      where abu.usuario_id = v_usuario_id
        and abu.ativo = true
        and p.ativo = true
        and p.codigo = 'BASE_25MB'

      limit 1;

      if not found then
        v_plano_codigo := null;
        v_plano_nome := null;
        v_tipo_cobranca := null;
        v_preco := null;
        v_limite_bytes := 0;
        v_upgrade_ativo := false;
      end if;
    end if;

    select
      al.limite_bytes,
      al.vitalicio,
      al.expira_em
    into
      v_manual_limite,
      v_manual_vitalicio,
      v_manual_expira
    from biblia_slides.admin_liberacoes_acesso al
    where al.usuario_id = v_usuario_id
      and al.status = 'ATIVA'
      and (
        al.vitalicio = true
        or al.expira_em > now()
      )
    order by al.created_at desc
    limit 1;

    if found then
      if (
        not v_licenca_paga
        and not v_upgrade_ativo
      )
      or v_manual_limite > v_limite_bytes
      then
        v_plano_codigo :=
          'ADMIN_' ||
          greatest(
            1,
            floor(
              v_manual_limite::numeric /
              1048576::numeric
            )::integer
          )::text ||
          'MB';

        v_plano_nome :=
          'Liberação administrativa';

        v_tipo_cobranca :=
          case
            when v_manual_vitalicio
              then 'VITALICIA'
            else 'TEMPORARIA'
          end;

        v_preco := 0;
        v_limite_bytes := v_manual_limite;
        v_upgrade_ativo := false;
      end if;
    end if;

  else
    v_plano_codigo := null;
    v_plano_nome := null;
    v_tipo_cobranca := null;
    v_preco := null;
    v_limite_bytes := 0;
    v_upgrade_ativo := false;
  end if;

  v_usado_bytes :=
    biblia_slides.uso_armazenamento_acessivel_usuario(
      v_usuario_id
    );

  return query
  select
    v_usuario_id,
    v_licenca_ativa,
    v_plano_codigo,
    v_plano_nome,
    v_tipo_cobranca,
    v_preco,
    v_limite_bytes,
    v_usado_bytes,

    greatest(
      v_limite_bytes - v_usado_bytes,
      0
    )::bigint,

    case
      when v_limite_bytes > 0
      then round(
        (
          v_usado_bytes::numeric
          /
          v_limite_bytes::numeric
        ) * 100,
        2
      )
      else 0::numeric
    end,

    v_upgrade_ativo;
end;
$$;


create or replace function biblia_slides.admin_listar_usuarios()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_resultado jsonb;
begin
  if not biblia_slides.eh_admin() then
    raise exception 'ACESSO_ADMIN_NEGADO'
      using errcode = '42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', x.id,
        'nome', x.nome,
        'email', x.email,
        'created_at', x.created_at,
        'acesso', x.acesso,
        'storage_bytes', x.storage_bytes,
        'liberacao_mb', x.liberacao_mb,
        'liberacao_vitalicia', x.liberacao_vitalicia,
        'liberacao_expira_em', x.liberacao_expira_em
      )
      order by x.created_at desc
    ),
    '[]'::jsonb
  )
  into v_resultado
  from (
    select
      p.id,
      p.nome,
      p.email,
      p.created_at,

      case
        when exists (
          select 1
          from biblia_slides.licencas l
          where l.usuario_id = p.id
            and l.status = 'ATIVA'
            and (
              l.expira_em is null
              or l.expira_em > now()
            )
        ) then 'VITALICIO'

        when al.id is not null
             and al.vitalicio = true
          then 'VITALICIO'

        when al.id is not null
          then 'LIBERADO'

        when p.teste_iniciado_em
             + interval '7 days'
             > now()
          then 'TESTE'

        else 'EXPIRADO'
      end as acesso,

      biblia_slides.uso_armazenamento_acessivel_usuario(
        p.id
      ) as storage_bytes,

      case
        when al.id is null then null
        else round(
          al.limite_bytes::numeric /
          1048576::numeric,
          0
        )::bigint
      end as liberacao_mb,

      al.vitalicio as liberacao_vitalicia,
      al.expira_em as liberacao_expira_em

    from biblia_slides.profiles p

    left join lateral (
      select
        g.id,
        g.limite_bytes,
        g.vitalicio,
        g.expira_em
      from biblia_slides.admin_liberacoes_acesso g
      where g.usuario_id = p.id
        and g.status = 'ATIVA'
        and (
          g.vitalicio = true
          or g.expira_em > now()
        )
      order by g.created_at desc
      limit 1
    ) al on true
  ) x;

  return v_resultado;
end;
$$;

revoke all on function biblia_slides.admin_listar_usuarios() from public, anon;
grant execute on function biblia_slides.admin_listar_usuarios() to authenticated;


create or replace function biblia_slides.admin_liberar_acesso(
  p_usuario_id uuid,
  p_limite_mb integer,
  p_meses integer default null,
  p_vitalicio boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expira_em timestamptz;
  v_liberacao_id uuid;
  v_nome text;
  v_email text;
begin
  if not biblia_slides.eh_admin() then
    raise exception 'ACESSO_ADMIN_NEGADO'
      using errcode = '42501';
  end if;

  if p_usuario_id is null then
    raise exception 'USUARIO_OBRIGATORIO';
  end if;

  if p_limite_mb is null
     or p_limite_mb < 1
     or p_limite_mb > 102400
  then
    raise exception 'LIMITE_MB_INVALIDO';
  end if;

  if coalesce(p_vitalicio, false) = false
     and (
       p_meses is null
       or p_meses < 1
       or p_meses > 120
     )
  then
    raise exception 'MESES_INVALIDO';
  end if;

  select
    p.nome,
    p.email
  into
    v_nome,
    v_email
  from biblia_slides.profiles p
  where p.id = p_usuario_id;

  if not found then
    raise exception 'USUARIO_NAO_ENCONTRADO';
  end if;

  v_expira_em :=
    case
      when coalesce(p_vitalicio, false)
        then null
      else clock_timestamp()
        + make_interval(months => p_meses)
    end;

  update biblia_slides.admin_liberacoes_acesso
  set
    status = 'SUBSTITUIDA',
    updated_at = clock_timestamp()
  where usuario_id = p_usuario_id
    and status = 'ATIVA';

  insert into biblia_slides.admin_liberacoes_acesso (
    usuario_id,
    limite_bytes,
    vitalicio,
    inicio_em,
    expira_em,
    status,
    concedido_por
  )
  values (
    p_usuario_id,
    p_limite_mb::bigint * 1048576::bigint,
    coalesce(p_vitalicio, false),
    clock_timestamp(),
    v_expira_em,
    'ATIVA',
    auth.uid()
  )
  returning id
  into v_liberacao_id;

  return jsonb_build_object(
    'ok', true,
    'id', v_liberacao_id,
    'usuario_id', p_usuario_id,
    'nome', v_nome,
    'email', v_email,
    'limite_mb', p_limite_mb,
    'vitalicio', coalesce(p_vitalicio, false),
    'expira_em', v_expira_em
  );
end;
$$;

revoke all
on function biblia_slides.admin_liberar_acesso(uuid, integer, integer, boolean)
from public, anon;

grant execute
on function biblia_slides.admin_liberar_acesso(uuid, integer, integer, boolean)
to authenticated;
