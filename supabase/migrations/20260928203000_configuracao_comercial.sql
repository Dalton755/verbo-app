-- VERBO — configuração comercial gerenciável pelo painel.
-- Mantém os valores atuais como padrão e remove regras comerciais fixas do código.

create table if not exists biblia_slides.configuracao_comercial (
  chave text primary key default 'VERBO'
    check (chave = 'VERBO'),
  teste_gratuito_ativo boolean not null default true,
  teste_dias integer not null default 7
    check (teste_dias between 1 and 365),
  vitalicio_ativo boolean not null default true,
  vitalicio_preco numeric(10,2) not null default 9.90
    check (vitalicio_preco > 0 and vitalicio_preco <= 100000),
  moeda text not null default 'BRL'
    check (moeda = 'BRL'),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table biblia_slides.configuracao_comercial
enable row level security;

revoke all
on table biblia_slides.configuracao_comercial
from public, anon, authenticated;

insert into biblia_slides.configuracao_comercial (
  chave,
  teste_gratuito_ativo,
  teste_dias,
  vitalicio_ativo,
  vitalicio_preco,
  moeda
)
select
  'VERBO',
  true,
  7,
  true,
  coalesce((
    select p.preco
    from biblia_slides.planos_armazenamento p
    where p.codigo = 'BASE_25MB'
    order by p.ativo desc, p.updated_at desc
    limit 1
  ), 9.90),
  'BRL'
on conflict (chave) do nothing;


create or replace function biblia_slides.configuracao_comercial_publica()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'teste_gratuito_ativo', c.teste_gratuito_ativo,
    'teste_dias', c.teste_dias,
    'vitalicio_ativo', c.vitalicio_ativo,
    'vitalicio_preco', c.vitalicio_preco,
    'moeda', c.moeda
  )
  from biblia_slides.configuracao_comercial c
  where c.chave = 'VERBO';
$$;

revoke all
on function biblia_slides.configuracao_comercial_publica()
from public, anon;

grant execute
on function biblia_slides.configuracao_comercial_publica()
to authenticated;


create or replace function biblia_slides.admin_configuracao_comercial()
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

  select jsonb_build_object(
    'teste_gratuito_ativo', c.teste_gratuito_ativo,
    'teste_dias', c.teste_dias,
    'vitalicio_ativo', c.vitalicio_ativo,
    'vitalicio_preco', c.vitalicio_preco,
    'moeda', c.moeda,
    'updated_at', c.updated_at,
    'planos', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'codigo', p.codigo,
          'nome', p.nome,
          'limite_bytes', p.limite_bytes,
          'preco', p.preco,
          'tipo_cobranca', p.tipo_cobranca,
          'ordem', p.ordem
        )
        order by p.ordem, p.limite_bytes
      )
      from biblia_slides.planos_armazenamento p
      where p.ativo = true
        and p.tipo_cobranca = 'MENSAL'
    ), '[]'::jsonb)
  )
  into v_resultado
  from biblia_slides.configuracao_comercial c
  where c.chave = 'VERBO';

  return v_resultado;
end;
$$;

revoke all
on function biblia_slides.admin_configuracao_comercial()
from public, anon;

grant execute
on function biblia_slides.admin_configuracao_comercial()
to authenticated;


create or replace function biblia_slides.admin_salvar_configuracao_comercial(
  p_teste_gratuito_ativo boolean,
  p_teste_dias integer,
  p_vitalicio_ativo boolean,
  p_vitalicio_preco numeric,
  p_planos jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_id uuid;
  v_preco numeric;
begin
  if not biblia_slides.eh_admin() then
    raise exception 'ACESSO_ADMIN_NEGADO'
      using errcode = '42501';
  end if;

  if p_teste_dias is null
     or p_teste_dias < 1
     or p_teste_dias > 365
  then
    raise exception 'TESTE_DIAS_INVALIDO';
  end if;

  if p_vitalicio_preco is null
     or p_vitalicio_preco <= 0
     or p_vitalicio_preco > 100000
  then
    raise exception 'PRECO_VITALICIO_INVALIDO';
  end if;

  if p_planos is null
     or jsonb_typeof(p_planos) <> 'array'
  then
    raise exception 'PLANOS_INVALIDOS';
  end if;

  update biblia_slides.configuracao_comercial
  set
    teste_gratuito_ativo = coalesce(p_teste_gratuito_ativo, false),
    teste_dias = p_teste_dias,
    vitalicio_ativo = coalesce(p_vitalicio_ativo, false),
    vitalicio_preco = round(p_vitalicio_preco, 2),
    updated_at = clock_timestamp(),
    updated_by = auth.uid()
  where chave = 'VERBO';

  update biblia_slides.planos_armazenamento
  set
    preco = round(p_vitalicio_preco, 2),
    updated_at = clock_timestamp()
  where codigo = 'BASE_25MB'
    and ativo = true;

  for v_item in
    select value
    from jsonb_array_elements(p_planos)
  loop
    begin
      v_id := (v_item->>'id')::uuid;
      v_preco := (v_item->>'preco')::numeric;
    exception
      when others then
        raise exception 'PLANO_INVALIDO';
    end;

    if v_preco is null
       or v_preco <= 0
       or v_preco > 100000
    then
      raise exception 'PRECO_PLANO_INVALIDO';
    end if;

    update biblia_slides.planos_armazenamento
    set
      preco = round(v_preco, 2),
      updated_at = clock_timestamp()
    where id = v_id
      and ativo = true
      and tipo_cobranca = 'MENSAL';

    if not found then
      raise exception 'PLANO_NAO_ENCONTRADO';
    end if;
  end loop;

  return biblia_slides.admin_configuracao_comercial();
end;
$$;

revoke all
on function biblia_slides.admin_salvar_configuracao_comercial(
  boolean,
  integer,
  boolean,
  numeric,
  jsonb
)
from public, anon;

grant execute
on function biblia_slides.admin_salvar_configuracao_comercial(
  boolean,
  integer,
  boolean,
  numeric,
  jsonb
)
to authenticated;


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
        cross join biblia_slides.configuracao_comercial c
        where p.id = auth.uid()
          and c.chave = 'VERBO'
          and c.teste_gratuito_ativo = true
          and p.teste_iniciado_em
                + make_interval(days => c.teste_dias)
              > now()
      )
    );
$$;

revoke all
on function biblia_slides.tem_licenca_ativa()
from public, anon;

grant execute
on function biblia_slides.tem_licenca_ativa()
to authenticated;


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
      c.teste_gratuito_ativo,
      c.teste_dias,

      p.teste_iniciado_em
        + make_interval(days => c.teste_dias)
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

    cross join biblia_slides.configuracao_comercial c

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
      and c.chave = 'VERBO'
  )

  select
    (
      d.licenca_paga_ativa
      or d.liberacao_id is not null
      or (
        d.teste_gratuito_ativo
        and d.teste_original_expira_em > now()
      )
    ) as tem_acesso,

    case
      when d.licenca_paga_ativa
        then 'VITALICIO'

      when d.liberacao_id is not null
           and d.liberacao_vitalicia = true
        then 'VITALICIO'

      when d.liberacao_id is not null
        then 'LIBERADO'

      when d.teste_gratuito_ativo
           and d.teste_original_expira_em > now()
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

      when not d.teste_gratuito_ativo
        then 0::bigint

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

revoke all
on function biblia_slides.meu_acesso_app()
from public, anon;

grant execute
on function biblia_slides.meu_acesso_app()
to authenticated;


create or replace function biblia_slides.admin_dashboard_configuravel()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_base jsonb;
  v_ativos bigint := 0;
  v_expirados bigint := 0;
begin
  if not biblia_slides.eh_admin() then
    raise exception 'ACESSO_ADMIN_NEGADO'
      using errcode = '42501';
  end if;

  v_base := biblia_slides.admin_dashboard();

  select
    count(*) filter (
      where c.teste_gratuito_ativo = true
        and p.teste_iniciado_em
          + make_interval(days => c.teste_dias)
          > now()
    )::bigint,
    count(*) filter (
      where c.teste_gratuito_ativo = false
         or p.teste_iniciado_em
          + make_interval(days => c.teste_dias)
          <= now()
    )::bigint
  into
    v_ativos,
    v_expirados
  from biblia_slides.profiles p
  cross join biblia_slides.configuracao_comercial c
  where c.chave = 'VERBO'
    and not exists (
      select 1
      from biblia_slides.admin_usuarios_ignorados i
      where i.user_id = p.id
    )
    and not exists (
      select 1
      from biblia_slides.licencas l
      where l.usuario_id = p.id
        and l.status = 'ATIVA'
        and (
          l.expira_em is null
          or l.expira_em > now()
        )
    )
    and not exists (
      select 1
      from biblia_slides.admin_liberacoes_acesso al
      where al.usuario_id = p.id
        and al.status = 'ATIVA'
        and (
          al.vitalicio = true
          or al.expira_em > now()
        )
    );

  v_base := jsonb_set(
    v_base,
    '{usuarios,teste_ativos}',
    to_jsonb(coalesce(v_ativos, 0)),
    true
  );

  v_base := jsonb_set(
    v_base,
    '{usuarios,teste_expirados}',
    to_jsonb(coalesce(v_expirados, 0)),
    true
  );

  return v_base;
end;
$$;

revoke all
on function biblia_slides.admin_dashboard_configuravel()
from public, anon;

grant execute
on function biblia_slides.admin_dashboard_configuravel()
to authenticated;



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

        when c.teste_gratuito_ativo = true
             and p.teste_iniciado_em
               + make_interval(days => c.teste_dias)
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

    cross join biblia_slides.configuracao_comercial c

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

    where not exists (
      select 1
      from biblia_slides.admin_usuarios_ignorados i
      where i.user_id = p.id
    )
  ) x;

  return v_resultado;
end;
$$;



revoke all
on function biblia_slides.admin_listar_usuarios()
from public, anon;

grant execute
on function biblia_slides.admin_listar_usuarios()
to authenticated;



create or replace function biblia_slides.sincronizar_notificacoes_engajamento()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_teste_iniciado timestamptz;
  v_teste_expira timestamptz;
  v_teste_ativo boolean := false;
  v_tem_acesso_pago boolean := false;
  v_teste_dias integer := 7;
  v_teste_gratuito_ativo boolean := true;

  v_aulas integer := 0;
  v_sermoes integer := 0;
  v_livros integer := 0;
  v_total integer := 0;
  v_modulos_usados integer := 0;

  v_rota_material text := '/';
  v_agora timestamptz := now();
  v_restante interval;
begin
  if v_usuario_id is null then
    return;
  end if;

  select
    p.teste_iniciado_em
  into
    v_teste_iniciado
  from biblia_slides.profiles p
  where p.id = v_usuario_id;

  if not found then
    return;
  end if;

  select
    c.teste_dias,
    c.teste_gratuito_ativo
  into
    v_teste_dias,
    v_teste_gratuito_ativo
  from biblia_slides.configuracao_comercial c
  where c.chave = 'VERBO';

  v_teste_expira :=
    v_teste_iniciado
    + make_interval(days => v_teste_dias);

  select (
    exists (
      select 1
      from biblia_slides.licencas l
      where l.usuario_id = v_usuario_id
        and l.status = 'ATIVA'
        and (
          l.expira_em is null
          or l.expira_em > v_agora
        )
    )
    or
    exists (
      select 1
      from biblia_slides.admin_liberacoes_acesso al
      where al.usuario_id = v_usuario_id
        and al.status = 'ATIVA'
        and (
          al.vitalicio = true
          or al.expira_em > v_agora
        )
    )
  )
  into v_tem_acesso_pago;

  v_teste_ativo :=
    v_teste_gratuito_ativo
    and not v_tem_acesso_pago
    and v_teste_expira > v_agora;

  select count(*)::integer
  into v_aulas
  from biblia_slides.aulas a
  where a.usuario_id = v_usuario_id;

  select count(*)::integer
  into v_sermoes
  from biblia_slides.sermoes s
  where s.usuario_id = v_usuario_id;

  select count(*)::integer
  into v_livros
  from biblia_slides.livros l
  where l.usuario_id = v_usuario_id;

  v_total :=
    v_aulas
    + v_sermoes
    + v_livros;

  v_modulos_usados :=
    (case when v_aulas > 0 then 1 else 0 end)
    + (case when v_sermoes > 0 then 1 else 0 end)
    + (case when v_livros > 0 then 1 else 0 end);

  v_rota_material :=
    case
      when v_livros > 0 then '/livros'
      when v_sermoes > 0 then '/sermoes'
      when v_aulas > 0 then '/ebd'
      else '/'
    end;

  if v_teste_ativo then
    insert into biblia_slides.notificacoes_usuario (
      usuario_id,
      codigo,
      titulo,
      mensagem,
      acao_texto,
      acao_rota,
      expira_em
    )
    values (
      v_usuario_id,
      'TESTE_BEM_VINDO',
      'Seu teste do VERBO está ativo',
      format(
        'Você tem %s %s para experimentar o VERBO. Use este período para abrir seus próprios materiais e conhecer os recursos de EBD, Sermões e Livros.',
        v_teste_dias,
        case when v_teste_dias = 1 then 'dia' else 'dias' end
      ),
      'Explorar o VERBO',
      '/',
      v_teste_expira
    )
    on conflict (usuario_id, codigo)
    do nothing;

    if v_total = 0 then
      insert into biblia_slides.notificacoes_usuario (
        usuario_id,
        codigo,
        titulo,
        mensagem,
        acao_texto,
        acao_rota,
        expira_em
      )
      values (
        v_usuario_id,
        'TESTE_PRIMEIRO_ARQUIVO',
        'Experimente com um material seu',
        'Importe um PDF em EBD, Sermões ou Livros. É usando um arquivo seu que você consegue perceber melhor como o VERBO pode ajudar no dia a dia.',
        'Importar meu primeiro PDF',
        '/',
        v_teste_expira
      )
      on conflict (usuario_id, codigo)
      do nothing;
    end if;

    if v_total > 0 then
      insert into biblia_slides.notificacoes_usuario (
        usuario_id,
        codigo,
        titulo,
        mensagem,
        acao_texto,
        acao_rota,
        expira_em
      )
      values (
        v_usuario_id,
        'TESTE_RECURSOS_ARQUIVO',
        'Seu material já está no VERBO',
        'Abra o arquivo e experimente os recursos disponíveis: referências bíblicas, notas, marcadores, busca, apresentação ou modo de pregação, conforme o módulo.',
        'Continuar testando',
        v_rota_material,
        v_teste_expira
      )
      on conflict (usuario_id, codigo)
      do nothing;
    end if;

    if v_modulos_usados = 1 then
      insert into biblia_slides.notificacoes_usuario (
        usuario_id,
        codigo,
        titulo,
        mensagem,
        acao_texto,
        acao_rota,
        expira_em
      )
      values (
        v_usuario_id,
        'TESTE_OUTROS_MODULOS',
        'Ainda há mais para experimentar',
        'Você já testou um dos módulos. Durante o período gratuito, também pode conhecer os outros módulos do VERBO e descobrir qual combina mais com sua rotina.',
        'Ver outros módulos',
        '/',
        v_teste_expira
      )
      on conflict (usuario_id, codigo)
      do nothing;
    end if;

    v_restante :=
      v_teste_expira - v_agora;

    if v_restante <= interval '48 hours' then
      insert into biblia_slides.notificacoes_usuario (
        usuario_id,
        codigo,
        titulo,
        mensagem,
        acao_texto,
        acao_rota,
        expira_em
      )
      values (
        v_usuario_id,
        'TESTE_48H',
        'Aproveite os últimos dias do teste',
        'Seu período gratuito está perto do fim. Antes disso, abra seus materiais novamente e teste os recursos que ainda não usou.',
        'Continuar meu teste',
        case when v_total > 0 then v_rota_material else '/' end,
        v_teste_expira
      )
      on conflict (usuario_id, codigo)
      do nothing;
    end if;

    if v_restante <= interval '24 hours' then
      insert into biblia_slides.notificacoes_usuario (
        usuario_id,
        codigo,
        titulo,
        mensagem,
        acao_texto,
        acao_rota,
        expira_em
      )
      values (
        v_usuario_id,
        'TESTE_24H',
        'Seu teste termina em menos de 24 horas',
        'Se ainda existe algum recurso que você queria experimentar, este é um bom momento para usar o VERBO com um material real seu.',
        'Usar o VERBO agora',
        case when v_total > 0 then v_rota_material else '/' end,
        v_teste_expira
      )
      on conflict (usuario_id, codigo)
      do nothing;
    end if;
  else
    if v_total > 0 and v_tem_acesso_pago then
      insert into biblia_slides.notificacoes_usuario (
        usuario_id,
        codigo,
        titulo,
        mensagem,
        acao_texto,
        acao_rota,
        expira_em
      )
      values (
        v_usuario_id,
        'DICA_RECURSOS_VERBO',
        'Continue aproveitando seus materiais',
        'Seus arquivos ficam organizados no VERBO para você continuar de onde parou. Use notas, marcadores, busca e referências para transformar leitura e preparação em uma rotina mais simples.',
        'Abrir meus materiais',
        v_rota_material,
        v_agora + interval '90 days'
      )
      on conflict (usuario_id, codigo)
      do nothing;
    end if;
  end if;
end;
$$;



revoke all
on function biblia_slides.sincronizar_notificacoes_engajamento()
from public, anon;

grant execute
on function biblia_slides.sincronizar_notificacoes_engajamento()
to authenticated;

