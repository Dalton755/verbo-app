-- Contas internas/de teste que não entram nas métricas gerenciais.
-- Os usuários específicos são cadastrados diretamente no banco
-- para não versionar dados pessoais no repositório.

create table if not exists biblia_slides.admin_usuarios_ignorados (
  user_id uuid primary key references auth.users(id) on delete cascade,
  motivo text,
  created_at timestamptz not null default now()
);

alter table biblia_slides.admin_usuarios_ignorados enable row level security;

revoke all
on table biblia_slides.admin_usuarios_ignorados
from public, anon, authenticated;


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
        where
          (p.created_at at time zone 'America/Sao_Paulo')::date
          = v_hoje
      )::bigint as novos_hoje,

      count(*) filter (
        where
          (p.created_at at time zone 'America/Sao_Paulo')::date
          >= v_hoje - 6
      )::bigint as novos_7d,

      count(*) filter (
        where
          (p.created_at at time zone 'America/Sao_Paulo')::date
          >= v_hoje - 29
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

    where not exists (
      select 1
      from biblia_slides.admin_usuarios_ignorados i
      where i.user_id = p.id
    )
  ),

  entradas as (
    select
      count(distinct ad.usuario_id) filter (
        where ad.data_entrada = v_hoje
      )::bigint as hoje,

      count(distinct ad.usuario_id) filter (
        where ad.data_entrada >= v_hoje - 6
      )::bigint as ultimos_7d,

      count(distinct ad.usuario_id) filter (
        where ad.data_entrada >= v_hoje - 29
      )::bigint as ultimos_30d

    from biblia_slides.acessos_diarios ad

    where not exists (
      select 1
      from biblia_slides.admin_usuarios_ignorados i
      where i.user_id = ad.usuario_id
    )
  ),

  licencas as (
    select
      count(*) filter (
        where l.status = 'ATIVA'
          and l.tipo = 'VITALICIA'
      )::bigint as vitalicias_ativas,

      count(*) filter (
        where l.status = 'ATIVA'
          and l.tipo = 'VITALICIA'
          and l.origem = 'MERCADO_PAGO'
      )::bigint as vitalicias_mercado_pago

    from biblia_slides.licencas l

    where not exists (
      select 1
      from biblia_slides.admin_usuarios_ignorados i
      where i.user_id = l.usuario_id
    )
  ),

  assinaturas as (
    select
      count(*) filter (
        where upper(a.status) in (
          'AUTORIZADA',
          'AUTHORIZED',
          'ATIVA',
          'ACTIVE'
        )
      )::bigint as armazenamento_ativas,

      coalesce(
        sum(a.preco_mensal) filter (
          where upper(a.status) in (
            'AUTORIZADA',
            'AUTHORIZED',
            'ATIVA',
            'ACTIVE'
          )
        ),
        0
      )::numeric as mrr

    from biblia_slides.assinaturas_armazenamento_provedor a

    where not exists (
      select 1
      from biblia_slides.admin_usuarios_ignorados i
      where i.user_id = a.usuario_id
    )
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

      and not exists (
        select 1
        from biblia_slides.admin_usuarios_ignorados i
        where i.user_id::text =
          (storage.foldername(o.name))[1]
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
          and not exists (
            select 1
            from biblia_slides.admin_usuarios_ignorados i
            where i.user_id = a.usuario_id
          )
      ), 0)::bigint as ebd_bytes,

      coalesce((
        select sum((o.metadata->>'size')::bigint)
        from biblia_slides.sermoes s
        join storage.objects o
          on o.bucket_id = 'biblia-slides-pdfs'
         and o.name = s.storage_path
        where o.metadata->>'size' ~ '^[0-9]+$'
          and not exists (
            select 1
            from biblia_slides.admin_usuarios_ignorados i
            where i.user_id = s.usuario_id
          )
      ), 0)::bigint as sermoes_bytes,

      coalesce((
        select sum((o.metadata->>'size')::bigint)
        from biblia_slides.livros l
        join storage.objects o
          on o.bucket_id = 'biblia-slides-pdfs'
         and o.name = l.storage_path
        where o.metadata->>'size' ~ '^[0-9]+$'
          and not exists (
            select 1
            from biblia_slides.admin_usuarios_ignorados i
            where i.user_id = l.usuario_id
          )
      ), 0)::bigint as livros_bytes
  ),

  financeiro as (
    select
      coalesce(sum(pg.valor) filter (
        where upper(pg.status) in (
          'APROVADO',
          'APPROVED',
          'PAGO',
          'PAID'
        )
      ), 0)::numeric as receita_total,

      coalesce(sum(pg.valor) filter (
        where upper(pg.status) in (
          'APROVADO',
          'APPROVED',
          'PAGO',
          'PAID'
        )
          and date_trunc(
            'month',
            coalesce(pg.pago_em, pg.created_at)
              at time zone 'America/Sao_Paulo'
          ) = date_trunc(
            'month',
            now() at time zone 'America/Sao_Paulo'
          )
      ), 0)::numeric as receita_mes,

      coalesce(sum(pg.valor) filter (
        where upper(pg.status) in (
          'APROVADO',
          'APPROVED',
          'PAGO',
          'PAID'
        )
          and (
            coalesce(pg.pago_em, pg.created_at)
              at time zone 'America/Sao_Paulo'
          )::date = v_hoje
      ), 0)::numeric as receita_hoje,

      coalesce(sum(pg.valor) filter (
        where upper(pg.status) in (
          'APROVADO',
          'APPROVED',
          'PAGO',
          'PAID'
        )
          and pg.finalidade = 'LICENCA_APP'
      ), 0)::numeric as receita_licencas,

      coalesce(sum(pg.valor) filter (
        where upper(pg.status) in (
          'APROVADO',
          'APPROVED',
          'PAGO',
          'PAID'
        )
          and pg.finalidade is distinct from 'LICENCA_APP'
      ), 0)::numeric as receita_armazenamento,

      coalesce(avg(pg.valor) filter (
        where upper(pg.status) in (
          'APROVADO',
          'APPROVED',
          'PAGO',
          'PAID'
        )
      ), 0)::numeric as ticket_medio,

      coalesce(sum(pg.valor) filter (
        where upper(pg.status) in (
          'PENDENTE',
          'PENDING'
        )
      ), 0)::numeric as pendente,

      coalesce(sum(pg.valor) filter (
        where upper(pg.status) in (
          'REEMBOLSADO',
          'REFUNDED'
        )
      ), 0)::numeric as reembolsado

    from biblia_slides.pagamentos pg

    where not exists (
      select 1
      from biblia_slides.admin_usuarios_ignorados i
      where i.user_id = pg.usuario_id
    )
  ),

  historico as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'data', d.dia,

          'cadastros', (
            select count(*)
            from biblia_slides.profiles p
            where
              (p.created_at at time zone 'America/Sao_Paulo')::date
              = d.dia
              and not exists (
                select 1
                from biblia_slides.admin_usuarios_ignorados i
                where i.user_id = p.id
              )
          ),

          'entradas', (
            select count(distinct ad.usuario_id)
            from biblia_slides.acessos_diarios ad
            where ad.data_entrada = d.dia
              and not exists (
                select 1
                from biblia_slides.admin_usuarios_ignorados i
                where i.user_id = ad.usuario_id
              )
          ),

          'receita', (
            select coalesce(sum(pg.valor), 0)
            from biblia_slides.pagamentos pg
            where upper(pg.status) in (
              'APROVADO',
              'APPROVED',
              'PAGO',
              'PAID'
            )
              and (
                coalesce(pg.pago_em, pg.created_at)
                  at time zone 'America/Sao_Paulo'
              )::date = d.dia
              and not exists (
                select 1
                from biblia_slides.admin_usuarios_ignorados i
                where i.user_id = pg.usuario_id
              )
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

        biblia_slides.uso_armazenamento_acessivel_usuario(
          p.id
        ) as storage_bytes

      from biblia_slides.profiles p

      where not exists (
        select 1
        from biblia_slides.admin_usuarios_ignorados i
        where i.user_id = p.id
      )

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

      where not exists (
        select 1
        from biblia_slides.admin_usuarios_ignorados i
        where i.user_id = pg.usuario_id
      )

      order by
        coalesce(pg.pago_em, pg.created_at) desc

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
on function biblia_slides.admin_dashboard()
from public, anon;

grant execute
on function biblia_slides.admin_dashboard()
to authenticated;

revoke all
on function biblia_slides.admin_listar_usuarios()
from public, anon;

grant execute
on function biblia_slides.admin_listar_usuarios()
to authenticated;
