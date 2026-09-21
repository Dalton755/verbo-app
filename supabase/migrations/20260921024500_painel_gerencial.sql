-- Painel gerencial do VERBO
-- Estrutura protegida por allowlist de administradores.
-- A identidade do administrador é cadastrada diretamente no banco
-- e não fica versionada no repositório público.

create table if not exists biblia_slides.admin_usuarios (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table biblia_slides.admin_usuarios enable row level security;

revoke all on table biblia_slides.admin_usuarios from public, anon, authenticated;


create table if not exists biblia_slides.acessos_diarios (
  usuario_id uuid not null references auth.users(id) on delete cascade,
  data_entrada date not null,
  primeira_entrada_em timestamptz not null default now(),
  ultima_entrada_em timestamptz not null default now(),
  acessos integer not null default 1 check (acessos >= 1),
  primary key (usuario_id, data_entrada)
);

alter table biblia_slides.acessos_diarios enable row level security;

revoke all on table biblia_slides.acessos_diarios from public, anon, authenticated;


create or replace function biblia_slides.eh_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from biblia_slides.admin_usuarios a
    where a.user_id = auth.uid()
  );
$$;

revoke all on function biblia_slides.eh_admin() from public, anon;
grant execute on function biblia_slides.eh_admin() to authenticated;


create or replace function biblia_slides.registrar_entrada_app()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_data date :=
    (now() at time zone 'America/Sao_Paulo')::date;
begin
  if v_user_id is null then
    return;
  end if;

  insert into biblia_slides.acessos_diarios (
    usuario_id,
    data_entrada,
    primeira_entrada_em,
    ultima_entrada_em,
    acessos
  )
  values (
    v_user_id,
    v_data,
    now(),
    now(),
    1
  )
  on conflict (usuario_id, data_entrada)
  do update set
    ultima_entrada_em = excluded.ultima_entrada_em,
    acessos = biblia_slides.acessos_diarios.acessos + 1;
end;
$$;

revoke all on function biblia_slides.registrar_entrada_app() from public, anon;
grant execute on function biblia_slides.registrar_entrada_app() to authenticated;


create or replace function biblia_slides.admin_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_hoje date :=
    (now() at time zone 'America/Sao_Paulo')::date;
  v_resultado jsonb;
begin
  if not biblia_slides.eh_admin() then
    raise exception 'ACESSO_ADMIN_NEGADO'
      using errcode = '42501';
  end if;

  with
  usuarios as (
    select
      count(*)::bigint as total,
      count(*) filter (
        where (p.created_at at time zone 'America/Sao_Paulo')::date = v_hoje
      )::bigint as novos_hoje,
      count(*) filter (
        where (p.created_at at time zone 'America/Sao_Paulo')::date >= v_hoje - 6
      )::bigint as novos_7d,
      count(*) filter (
        where (p.created_at at time zone 'America/Sao_Paulo')::date >= v_hoje - 29
      )::bigint as novos_30d,
      count(*) filter (
        where not exists (
          select 1
          from biblia_slides.licencas l
          where l.usuario_id = p.id
            and l.status = 'ATIVA'
        )
        and p.teste_iniciado_em + interval '7 days' > now()
      )::bigint as teste_ativos,
      count(*) filter (
        where not exists (
          select 1
          from biblia_slides.licencas l
          where l.usuario_id = p.id
            and l.status = 'ATIVA'
        )
        and p.teste_iniciado_em + interval '7 days' <= now()
      )::bigint as teste_expirados
    from biblia_slides.profiles p
  ),
  entradas as (
    select
      count(distinct usuario_id) filter (
        where data_entrada = v_hoje
      )::bigint as hoje,
      count(distinct usuario_id) filter (
        where data_entrada >= v_hoje - 6
      )::bigint as ultimos_7d,
      count(distinct usuario_id) filter (
        where data_entrada >= v_hoje - 29
      )::bigint as ultimos_30d
    from biblia_slides.acessos_diarios
  ),
  licencas as (
    select
      count(*) filter (
        where status = 'ATIVA'
          and tipo = 'VITALICIA'
      )::bigint as vitalicias_ativas,
      count(*) filter (
        where status = 'ATIVA'
          and tipo = 'VITALICIA'
          and origem = 'MERCADO_PAGO'
      )::bigint as vitalicias_mercado_pago
    from biblia_slides.licencas
  ),
  assinaturas as (
    select
      count(*) filter (
        where upper(status) in (
          'AUTORIZADA',
          'AUTHORIZED',
          'ATIVA',
          'ACTIVE'
        )
      )::bigint as armazenamento_ativas,
      coalesce(
        sum(preco_mensal) filter (
          where upper(status) in (
            'AUTORIZADA',
            'AUTHORIZED',
            'ATIVA',
            'ACTIVE'
          )
        ),
        0
      )::numeric as mrr
    from biblia_slides.assinaturas_armazenamento_provedor
  ),
  storage_total as (
    select
      coalesce(
        sum(
          case
            when o.metadata->>'size' ~ '^[0-9]+$'
            then (o.metadata->>'size')::bigint
            else 0
          end
        ),
        0
      )::bigint as total_bytes,
      count(*)::bigint as total_arquivos,
      coalesce(
        sum(
          case
            when o.bucket_id = 'biblia-slides-pdfs'
              and o.metadata->>'size' ~ '^[0-9]+$'
            then (o.metadata->>'size')::bigint
            else 0
          end
        ),
        0
      )::bigint as pdf_bytes,
      count(*) filter (
        where o.bucket_id = 'biblia-slides-pdfs'
      )::bigint as pdf_arquivos,
      coalesce(
        sum(
          case
            when o.bucket_id = 'verbo-capas'
              and o.metadata->>'size' ~ '^[0-9]+$'
            then (o.metadata->>'size')::bigint
            else 0
          end
        ),
        0
      )::bigint as capas_bytes,
      count(*) filter (
        where o.bucket_id = 'verbo-capas'
      )::bigint as capas_arquivos
    from storage.objects o
    where o.bucket_id in (
      'biblia-slides-pdfs',
      'verbo-capas'
    )
  ),
  storage_modulos as (
    select
      coalesce((
        select sum((o.metadata->>'size')::bigint)
        from biblia_slides.aulas a
        join storage.objects o
          on o.bucket_id = 'biblia-slides-pdfs'
         and o.name = a.storage_path
        where o.metadata->>'size' ~ '^[0-9]+$'
      ), 0)::bigint as ebd_bytes,
      coalesce((
        select sum((o.metadata->>'size')::bigint)
        from biblia_slides.sermoes s
        join storage.objects o
          on o.bucket_id = 'biblia-slides-pdfs'
         and o.name = s.storage_path
        where o.metadata->>'size' ~ '^[0-9]+$'
      ), 0)::bigint as sermoes_bytes,
      coalesce((
        select sum((o.metadata->>'size')::bigint)
        from biblia_slides.livros l
        join storage.objects o
          on o.bucket_id = 'biblia-slides-pdfs'
         and o.name = l.storage_path
        where o.metadata->>'size' ~ '^[0-9]+$'
      ), 0)::bigint as livros_bytes
  ),
  financeiro as (
    select
      coalesce(sum(valor) filter (
        where upper(status) in ('APROVADO', 'APPROVED', 'PAGO', 'PAID')
      ), 0)::numeric as receita_total,
      coalesce(sum(valor) filter (
        where upper(status) in ('APROVADO', 'APPROVED', 'PAGO', 'PAID')
          and date_trunc(
            'month',
            coalesce(pago_em, created_at) at time zone 'America/Sao_Paulo'
          ) = date_trunc(
            'month',
            now() at time zone 'America/Sao_Paulo'
          )
      ), 0)::numeric as receita_mes,
      coalesce(sum(valor) filter (
        where upper(status) in ('APROVADO', 'APPROVED', 'PAGO', 'PAID')
          and (coalesce(pago_em, created_at) at time zone 'America/Sao_Paulo')::date = v_hoje
      ), 0)::numeric as receita_hoje,
      coalesce(sum(valor) filter (
        where upper(status) in ('APROVADO', 'APPROVED', 'PAGO', 'PAID')
          and finalidade = 'LICENCA_APP'
      ), 0)::numeric as receita_licencas,
      coalesce(sum(valor) filter (
        where upper(status) in ('APROVADO', 'APPROVED', 'PAGO', 'PAID')
          and finalidade is distinct from 'LICENCA_APP'
      ), 0)::numeric as receita_armazenamento,
      coalesce(avg(valor) filter (
        where upper(status) in ('APROVADO', 'APPROVED', 'PAGO', 'PAID')
      ), 0)::numeric as ticket_medio,
      coalesce(sum(valor) filter (
        where upper(status) in ('PENDENTE', 'PENDING')
      ), 0)::numeric as pendente,
      coalesce(sum(valor) filter (
        where upper(status) in ('REEMBOLSADO', 'REFUNDED')
      ), 0)::numeric as reembolsado
    from biblia_slides.pagamentos
  ),
  historico as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'data', d.dia,
          'cadastros', (
            select count(*)
            from biblia_slides.profiles p
            where (p.created_at at time zone 'America/Sao_Paulo')::date = d.dia
          ),
          'entradas', (
            select count(distinct ad.usuario_id)
            from biblia_slides.acessos_diarios ad
            where ad.data_entrada = d.dia
          ),
          'receita', (
            select coalesce(sum(pg.valor), 0)
            from biblia_slides.pagamentos pg
            where upper(pg.status) in ('APROVADO', 'APPROVED', 'PAGO', 'PAID')
              and (coalesce(pg.pago_em, pg.created_at) at time zone 'America/Sao_Paulo')::date = d.dia
          )
        )
        order by d.dia
      ),
      '[]'::jsonb
    ) as dados
    from (
      select generate_series(
        v_hoje - 13,
        v_hoje,
        interval '1 day'
      )::date as dia
    ) d
  ),
  clientes_recentes as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', x.id,
          'nome', x.nome,
          'email', x.email,
          'created_at', x.created_at,
          'acesso', x.acesso,
          'storage_bytes', x.storage_bytes
        )
        order by x.created_at desc
      ),
      '[]'::jsonb
    ) as dados
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
          ) then 'VITALICIO'
          when p.teste_iniciado_em + interval '7 days' > now()
            then 'TESTE'
          else 'EXPIRADO'
        end as acesso,
        biblia_slides.uso_armazenamento_acessivel_usuario(p.id) as storage_bytes
      from biblia_slides.profiles p
      order by p.created_at desc
      limit 12
    ) x
  ),
  pagamentos_recentes as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', x.id,
          'nome', x.nome,
          'email', x.email,
          'status', x.status,
          'valor', x.valor,
          'finalidade', x.finalidade,
          'data', x.data
        )
        order by x.data desc
      ),
      '[]'::jsonb
    ) as dados
    from (
      select
        pg.id,
        pr.nome,
        pr.email,
        pg.status,
        pg.valor,
        pg.finalidade,
        coalesce(pg.pago_em, pg.created_at) as data
      from biblia_slides.pagamentos pg
      left join biblia_slides.profiles pr
        on pr.id = pg.usuario_id
      order by coalesce(pg.pago_em, pg.created_at) desc
      limit 12
    ) x
  )
  select jsonb_build_object(
    'gerado_em', now(),
    'usuarios', jsonb_build_object(
      'total', u.total,
      'novos_hoje', u.novos_hoje,
      'novos_7d', u.novos_7d,
      'novos_30d', u.novos_30d,
      'entraram_hoje', e.hoje,
      'entraram_7d', e.ultimos_7d,
      'entraram_30d', e.ultimos_30d,
      'teste_ativos', u.teste_ativos,
      'teste_expirados', u.teste_expirados
    ),
    'assinaturas', jsonb_build_object(
      'vitalicias_ativas', l.vitalicias_ativas,
      'vitalicias_mercado_pago', l.vitalicias_mercado_pago,
      'armazenamento_ativas', a.armazenamento_ativas,
      'mrr', a.mrr
    ),
    'armazenamento', jsonb_build_object(
      'total_bytes', st.total_bytes,
      'total_arquivos', st.total_arquivos,
      'pdf_bytes', st.pdf_bytes,
      'pdf_arquivos', st.pdf_arquivos,
      'capas_bytes', st.capas_bytes,
      'capas_arquivos', st.capas_arquivos,
      'ebd_bytes', sm.ebd_bytes,
      'sermoes_bytes', sm.sermoes_bytes,
      'livros_bytes', sm.livros_bytes
    ),
    'financeiro', jsonb_build_object(
      'receita_total', f.receita_total,
      'receita_mes', f.receita_mes,
      'receita_hoje', f.receita_hoje,
      'receita_licencas', f.receita_licencas,
      'receita_armazenamento', f.receita_armazenamento,
      'ticket_medio', f.ticket_medio,
      'pendente', f.pendente,
      'reembolsado', f.reembolsado
    ),
    'historico_14d', h.dados,
    'clientes_recentes', cr.dados,
    'pagamentos_recentes', pr.dados
  )
  into v_resultado
  from usuarios u
  cross join entradas e
  cross join licencas l
  cross join assinaturas a
  cross join storage_total st
  cross join storage_modulos sm
  cross join financeiro f
  cross join historico h
  cross join clientes_recentes cr
  cross join pagamentos_recentes pr;

  return v_resultado;
end;
$$;

revoke all on function biblia_slides.admin_dashboard() from public, anon;
grant execute on function biblia_slides.admin_dashboard() to authenticated;


-- Preserva como baseline as sessões autenticadas que já estavam ativas
-- no dia em que o painel foi criado.
insert into biblia_slides.acessos_diarios (
  usuario_id,
  data_entrada,
  primeira_entrada_em,
  ultima_entrada_em,
  acessos
)
select
  s.usuario_id,
  (s.ultima_atividade_em at time zone 'America/Sao_Paulo')::date,
  min(s.criada_em),
  max(s.ultima_atividade_em),
  1
from biblia_slides.sessoes_ativas s
where (s.ultima_atividade_em at time zone 'America/Sao_Paulo')::date =
  (now() at time zone 'America/Sao_Paulo')::date
group by
  s.usuario_id,
  (s.ultima_atividade_em at time zone 'America/Sao_Paulo')::date
on conflict (usuario_id, data_entrada)
do nothing;
