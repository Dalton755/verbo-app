-- Engajamento, notificações e feedback do VERBO.

create table if not exists biblia_slides.notificacoes_usuario (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  codigo text not null,
  titulo text not null,
  mensagem text not null,
  acao_texto text,
  acao_rota text,
  lida_em timestamptz,
  expira_em timestamptz,
  created_at timestamptz not null default now(),
  unique (usuario_id, codigo)
);

create index if not exists notificacoes_usuario_feed_idx
  on biblia_slides.notificacoes_usuario (
    usuario_id,
    lida_em,
    created_at desc
  );

alter table biblia_slides.notificacoes_usuario enable row level security;

revoke all
on table biblia_slides.notificacoes_usuario
from public, anon, authenticated;


create table if not exists biblia_slides.feedback_usuarios (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null unique
    references biblia_slides.profiles(id)
    on delete cascade,
  nota smallint not null
    check (nota between 1 and 5),
  comentario text,
  created_at timestamptz not null default now(),
  check (
    comentario is null
    or char_length(comentario) <= 2000
  )
);

create index if not exists feedback_usuarios_created_idx
  on biblia_slides.feedback_usuarios (
    created_at desc
  );

alter table biblia_slides.feedback_usuarios enable row level security;

revoke all
on table biblia_slides.feedback_usuarios
from public, anon, authenticated;


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

  v_teste_expira :=
    v_teste_iniciado
    + interval '7 days';

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
    not v_tem_acesso_pago
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
      'Você tem 7 dias para experimentar o VERBO. Use este período para abrir seus próprios materiais e conhecer os recursos de EBD, Sermões e Livros.',
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


create or replace function biblia_slides.minhas_notificacoes()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', n.id,
        'codigo', n.codigo,
        'titulo', n.titulo,
        'mensagem', n.mensagem,
        'acao_texto', n.acao_texto,
        'acao_rota', n.acao_rota,
        'lida_em', n.lida_em,
        'created_at', n.created_at,
        'expira_em', n.expira_em
      )
      order by
        (n.lida_em is null) desc,
        n.created_at desc
    ),
    '[]'::jsonb
  )
  from biblia_slides.notificacoes_usuario n
  where n.usuario_id = auth.uid()
    and (
      n.expira_em is null
      or n.expira_em > now()
    )
  limit 30;
$$;

revoke all
on function biblia_slides.minhas_notificacoes()
from public, anon;

grant execute
on function biblia_slides.minhas_notificacoes()
to authenticated;


create or replace function biblia_slides.marcar_notificacao_lida(
  p_notificacao_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update biblia_slides.notificacoes_usuario
  set lida_em = coalesce(lida_em, now())
  where id = p_notificacao_id
    and usuario_id = auth.uid();

  return found;
end;
$$;

revoke all
on function biblia_slides.marcar_notificacao_lida(uuid)
from public, anon;

grant execute
on function biblia_slides.marcar_notificacao_lida(uuid)
to authenticated;


create or replace function biblia_slides.meu_feedback()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select (
    select jsonb_build_object(
      'id', f.id,
      'nota', f.nota,
      'comentario', f.comentario,
      'created_at', f.created_at
    )
    from biblia_slides.feedback_usuarios f
    where f.usuario_id = auth.uid()
  );
$$;

revoke all
on function biblia_slides.meu_feedback()
from public, anon;

grant execute
on function biblia_slides.meu_feedback()
to authenticated;


create or replace function biblia_slides.meu_progresso_feedback()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'ja_avaliou',
      exists (
        select 1
        from biblia_slides.feedback_usuarios f
        where f.usuario_id = auth.uid()
      ),
    'total_arquivos',
      (
        select count(*)
        from biblia_slides.aulas a
        where a.usuario_id = auth.uid()
      )
      +
      (
        select count(*)
        from biblia_slides.sermoes s
        where s.usuario_id = auth.uid()
      )
      +
      (
        select count(*)
        from biblia_slides.livros l
        where l.usuario_id = auth.uid()
      )
  );
$$;

revoke all
on function biblia_slides.meu_progresso_feedback()
from public, anon;

grant execute
on function biblia_slides.meu_progresso_feedback()
to authenticated;


create or replace function biblia_slides.salvar_feedback(
  p_nota integer,
  p_comentario text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_comentario text;
  v_feedback biblia_slides.feedback_usuarios;
begin
  if v_usuario_id is null then
    raise exception 'USUARIO_NAO_AUTENTICADO'
      using errcode = '42501';
  end if;

  if p_nota is null
     or p_nota < 1
     or p_nota > 5
  then
    raise exception 'NOTA_INVALIDA';
  end if;

  v_comentario :=
    nullif(
      trim(
        left(
          coalesce(p_comentario, ''),
          2000
        )
      ),
      ''
    );

  insert into biblia_slides.feedback_usuarios (
    usuario_id,
    nota,
    comentario
  )
  values (
    v_usuario_id,
    p_nota,
    v_comentario
  )
  on conflict (usuario_id)
  do nothing
  returning *
  into v_feedback;

  if v_feedback.id is null then
    select *
    into v_feedback
    from biblia_slides.feedback_usuarios
    where usuario_id = v_usuario_id;
  end if;

  return jsonb_build_object(
    'id', v_feedback.id,
    'nota', v_feedback.nota,
    'comentario', v_feedback.comentario,
    'created_at', v_feedback.created_at
  );
end;
$$;

revoke all
on function biblia_slides.salvar_feedback(integer, text)
from public, anon;

grant execute
on function biblia_slides.salvar_feedback(integer, text)
to authenticated;


create or replace function biblia_slides.admin_feedback()
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

  with base as (
    select
      f.id,
      f.usuario_id,
      f.nota,
      f.comentario,
      f.created_at,
      p.nome,
      p.email
    from biblia_slides.feedback_usuarios f
    join biblia_slides.profiles p
      on p.id = f.usuario_id
    where not exists (
      select 1
      from biblia_slides.admin_usuarios_ignorados i
      where i.user_id = f.usuario_id
    )
  ),
  resumo as (
    select
      count(*)::bigint as total,
      coalesce(round(avg(nota)::numeric, 2), 0) as media,
      count(*) filter (where nota >= 4)::bigint as positivas,
      count(*) filter (where nota = 5)::bigint as nota_5,
      count(*) filter (where nota = 4)::bigint as nota_4,
      count(*) filter (where nota = 3)::bigint as nota_3,
      count(*) filter (where nota = 2)::bigint as nota_2,
      count(*) filter (where nota = 1)::bigint as nota_1
    from base
  ),
  recentes as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', x.id,
          'usuario_id', x.usuario_id,
          'nome', x.nome,
          'email', x.email,
          'nota', x.nota,
          'comentario', x.comentario,
          'created_at', x.created_at
        )
        order by x.created_at desc
      ),
      '[]'::jsonb
    ) as dados
    from (
      select *
      from base
      order by created_at desc
      limit 50
    ) x
  )
  select jsonb_build_object(
    'total', r.total,
    'media', r.media,
    'positivas', r.positivas,
    'nota_5', r.nota_5,
    'nota_4', r.nota_4,
    'nota_3', r.nota_3,
    'nota_2', r.nota_2,
    'nota_1', r.nota_1,
    'recentes', re.dados
  )
  into v_resultado
  from resumo r
  cross join recentes re;

  return v_resultado;
end;
$$;

revoke all
on function biblia_slides.admin_feedback()
from public, anon;

grant execute
on function biblia_slides.admin_feedback()
to authenticated;
