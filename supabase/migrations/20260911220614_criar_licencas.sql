CREATE TABLE IF NOT EXISTS biblia_slides.licencas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  usuario_id uuid NOT NULL
    REFERENCES biblia_slides.profiles(id)
    ON DELETE CASCADE,

  tipo text NOT NULL DEFAULT 'VITALICIA'
    CHECK (tipo IN ('VITALICIA')),

  status text NOT NULL DEFAULT 'ATIVA'
    CHECK (status IN ('ATIVA', 'REVOGADA')),

  origem text NOT NULL DEFAULT 'MANUAL',

  referencia_pagamento text,

  comprado_em timestamptz,

  expira_em timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT licencas_usuario_unico
    UNIQUE (usuario_id)
);

ALTER TABLE biblia_slides.licencas
ENABLE ROW LEVEL SECURITY;


DROP POLICY IF EXISTS
  "licencas_select_propria"
ON biblia_slides.licencas;

CREATE POLICY
  "licencas_select_propria"
ON biblia_slides.licencas
FOR SELECT
TO authenticated
USING (
  usuario_id = auth.uid()
);


CREATE OR REPLACE FUNCTION
  biblia_slides.tem_licenca_ativa()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM biblia_slides.licencas l
    WHERE l.usuario_id = auth.uid()
      AND l.status = 'ATIVA'
      AND (
        l.expira_em IS NULL
        OR l.expira_em > now()
      )
  );
$$;


REVOKE ALL
ON FUNCTION biblia_slides.tem_licenca_ativa()
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION biblia_slides.tem_licenca_ativa()
TO authenticated;
