CREATE OR REPLACE FUNCTION biblia_slides.conceder_licenca(
  p_usuario_id uuid,
  p_origem text DEFAULT 'MANUAL',
  p_referencia_pagamento text DEFAULT NULL,
  p_comprado_em timestamptz DEFAULT now()
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO biblia_slides.licencas AS l (
    usuario_id,
    tipo,
    status,
    origem,
    referencia_pagamento,
    comprado_em,
    expira_em
  )
  VALUES (
    p_usuario_id,
    'VITALICIA',
    'ATIVA',
    COALESCE(
      NULLIF(btrim(p_origem), ''),
      'MANUAL'
    ),
    p_referencia_pagamento,
    COALESCE(p_comprado_em, now()),
    NULL
  )
  ON CONFLICT (usuario_id)
  DO UPDATE SET
    tipo = 'VITALICIA',
    status = 'ATIVA',
    origem = EXCLUDED.origem,
    referencia_pagamento =
      EXCLUDED.referencia_pagamento,
    comprado_em =
      EXCLUDED.comprado_em,
    expira_em = NULL,
    updated_at = now();
END;
$$;


CREATE OR REPLACE FUNCTION biblia_slides.revogar_licenca(
  p_usuario_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE biblia_slides.licencas
  SET
    status = 'REVOGADA',
    updated_at = now()
  WHERE usuario_id = p_usuario_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Licença não encontrada para o usuário %',
      p_usuario_id;
  END IF;
END;
$$;


REVOKE ALL
ON FUNCTION biblia_slides.conceder_licenca(
  uuid,
  text,
  text,
  timestamptz
)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION biblia_slides.conceder_licenca(
  uuid,
  text,
  text,
  timestamptz
)
FROM anon, authenticated;


REVOKE ALL
ON FUNCTION biblia_slides.revogar_licenca(uuid)
FROM PUBLIC;

REVOKE ALL
ON FUNCTION biblia_slides.revogar_licenca(uuid)
FROM anon, authenticated;


GRANT EXECUTE
ON FUNCTION biblia_slides.conceder_licenca(
  uuid,
  text,
  text,
  timestamptz
)
TO service_role;

GRANT EXECUTE
ON FUNCTION biblia_slides.revogar_licenca(uuid)
TO service_role;
