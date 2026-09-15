CREATE OR REPLACE FUNCTION biblia_slides.criar_pagamento_pendente(
  p_usuario_id uuid,
  p_valor numeric,
  p_referencia_externa text,
  p_preferencia_provedor_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor do pagamento inválido';
  END IF;

  IF NULLIF(btrim(p_referencia_externa), '') IS NULL THEN
    RAISE EXCEPTION 'Referência externa obrigatória';
  END IF;

  INSERT INTO biblia_slides.pagamentos (
    usuario_id,
    provedor,
    preferencia_provedor_id,
    status,
    valor,
    moeda,
    referencia_externa
  )
  VALUES (
    p_usuario_id,
    'MERCADO_PAGO',
    p_preferencia_provedor_id,
    'PENDENTE',
    p_valor,
    'BRL',
    p_referencia_externa
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;


CREATE OR REPLACE FUNCTION biblia_slides.confirmar_pagamento_aprovado(
  p_referencia_externa text,
  p_pagamento_provedor_id text,
  p_valor numeric,
  p_moeda text DEFAULT 'BRL',
  p_pago_em timestamptz DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
  v_usuario_id uuid;
  v_valor numeric(10,2);
  v_moeda text;
  v_status text;
  v_pagamento_provedor_id text;
BEGIN
  SELECT
    id,
    usuario_id,
    valor,
    moeda,
    status,
    pagamento_provedor_id
  INTO
    v_id,
    v_usuario_id,
    v_valor,
    v_moeda,
    v_status,
    v_pagamento_provedor_id
  FROM biblia_slides.pagamentos
  WHERE referencia_externa = p_referencia_externa
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Pagamento não encontrado: %',
      p_referencia_externa;
  END IF;

  IF v_valor <> p_valor THEN
    RAISE EXCEPTION
      'Valor divergente. Esperado %, recebido %',
      v_valor,
      p_valor;
  END IF;

  IF upper(v_moeda) <> upper(p_moeda) THEN
    RAISE EXCEPTION
      'Moeda divergente. Esperado %, recebido %',
      v_moeda,
      p_moeda;
  END IF;

  IF
    v_pagamento_provedor_id IS NOT NULL
    AND v_pagamento_provedor_id <> p_pagamento_provedor_id
  THEN
    RAISE EXCEPTION
      'ID de pagamento divergente';
  END IF;

  -- Webhooks podem chegar mais de uma vez.
  -- Se já estiver aprovado, mantemos a operação idempotente.
  IF v_status = 'APROVADO' THEN
    RETURN v_id;
  END IF;

  UPDATE biblia_slides.pagamentos
  SET
    pagamento_provedor_id =
      p_pagamento_provedor_id,
    status = 'APROVADO',
    pago_em = COALESCE(p_pago_em, now()),
    updated_at = now()
  WHERE id = v_id;

  PERFORM biblia_slides.conceder_licenca(
    v_usuario_id,
    'MERCADO_PAGO',
    p_pagamento_provedor_id,
    COALESCE(p_pago_em, now())
  );

  RETURN v_id;
END;
$$;


REVOKE ALL
ON FUNCTION biblia_slides.criar_pagamento_pendente(
  uuid,
  numeric,
  text,
  text
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION biblia_slides.criar_pagamento_pendente(
  uuid,
  numeric,
  text,
  text
)
TO service_role;


REVOKE ALL
ON FUNCTION biblia_slides.confirmar_pagamento_aprovado(
  text,
  text,
  numeric,
  text,
  timestamptz
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION biblia_slides.confirmar_pagamento_aprovado(
  text,
  text,
  numeric,
  text,
  timestamptz
)
TO service_role;
