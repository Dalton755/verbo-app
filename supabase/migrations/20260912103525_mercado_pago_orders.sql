DROP FUNCTION IF EXISTS
  biblia_slides.criar_pagamento_pendente(
    uuid,
    numeric,
    text,
    text
  );

DROP FUNCTION IF EXISTS
  biblia_slides.confirmar_pagamento_aprovado(
    text,
    text,
    numeric,
    text,
    timestamptz
  );


ALTER TABLE biblia_slides.pagamentos
RENAME COLUMN preferencia_provedor_id
TO ordem_provedor_id;


CREATE UNIQUE INDEX IF NOT EXISTS
  pagamentos_ordem_provedor_unica
ON biblia_slides.pagamentos (
  provedor,
  ordem_provedor_id
)
WHERE ordem_provedor_id IS NOT NULL;


CREATE OR REPLACE FUNCTION
biblia_slides.criar_pagamento_pendente(
  p_usuario_id uuid,
  p_valor numeric,
  p_referencia_externa text,
  p_ordem_provedor_id text DEFAULT NULL
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
    RAISE EXCEPTION
      'Valor do pagamento inválido';
  END IF;

  IF NULLIF(
    btrim(p_referencia_externa),
    ''
  ) IS NULL THEN
    RAISE EXCEPTION
      'Referência externa obrigatória';
  END IF;

  INSERT INTO biblia_slides.pagamentos (
    usuario_id,
    provedor,
    ordem_provedor_id,
    status,
    valor,
    moeda,
    referencia_externa
  )
  VALUES (
    p_usuario_id,
    'MERCADO_PAGO',
    p_ordem_provedor_id,
    'PENDENTE',
    p_valor,
    'BRL',
    p_referencia_externa
  )
  RETURNING id
  INTO v_id;

  RETURN v_id;
END;
$$;


CREATE OR REPLACE FUNCTION
biblia_slides.confirmar_ordem_processada(
  p_referencia_externa text,
  p_ordem_provedor_id text,
  p_valor numeric,
  p_pagamento_provedor_id text DEFAULT NULL,
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
  v_ordem_provedor_id text;
  v_pagamento_provedor_id text;
BEGIN
  SELECT
    id,
    usuario_id,
    valor,
    moeda,
    status,
    ordem_provedor_id,
    pagamento_provedor_id
  INTO
    v_id,
    v_usuario_id,
    v_valor,
    v_moeda,
    v_status,
    v_ordem_provedor_id,
    v_pagamento_provedor_id
  FROM biblia_slides.pagamentos
  WHERE referencia_externa =
    p_referencia_externa
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
    v_ordem_provedor_id IS NOT NULL
    AND v_ordem_provedor_id <>
      p_ordem_provedor_id
  THEN
    RAISE EXCEPTION
      'ID da order divergente';
  END IF;

  IF
    v_pagamento_provedor_id IS NOT NULL
    AND p_pagamento_provedor_id IS NOT NULL
    AND v_pagamento_provedor_id <>
      p_pagamento_provedor_id
  THEN
    RAISE EXCEPTION
      'ID do pagamento divergente';
  END IF;

  -- Webhook pode chegar repetidamente.
  IF v_status = 'APROVADO' THEN
    RETURN v_id;
  END IF;

  UPDATE biblia_slides.pagamentos
  SET
    ordem_provedor_id =
      p_ordem_provedor_id,

    pagamento_provedor_id =
      COALESCE(
        p_pagamento_provedor_id,
        pagamento_provedor_id
      ),

    status = 'APROVADO',

    pago_em =
      COALESCE(p_pago_em, now()),

    updated_at = now()

  WHERE id = v_id;

  PERFORM biblia_slides.conceder_licenca(
    v_usuario_id,
    'MERCADO_PAGO',
    COALESCE(
      p_pagamento_provedor_id,
      p_ordem_provedor_id
    ),
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
ON FUNCTION biblia_slides.confirmar_ordem_processada(
  text,
  text,
  numeric,
  text,
  text,
  timestamptz
)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION biblia_slides.confirmar_ordem_processada(
  text,
  text,
  numeric,
  text,
  text,
  timestamptz
)
TO service_role;
