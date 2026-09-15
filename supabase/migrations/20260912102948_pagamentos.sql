CREATE TABLE IF NOT EXISTS biblia_slides.pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  usuario_id uuid NOT NULL
    REFERENCES biblia_slides.profiles(id)
    ON DELETE RESTRICT,

  provedor text NOT NULL DEFAULT 'MERCADO_PAGO',

  pagamento_provedor_id text,

  preferencia_provedor_id text,

  status text NOT NULL DEFAULT 'PENDENTE'
    CHECK (
      status IN (
        'PENDENTE',
        'APROVADO',
        'RECUSADO',
        'CANCELADO',
        'REEMBOLSADO'
      )
    ),

  valor numeric(10,2) NOT NULL
    CHECK (valor >= 0),

  moeda text NOT NULL DEFAULT 'BRL',

  referencia_externa text NOT NULL,

  pago_em timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT pagamentos_referencia_externa_unica
    UNIQUE (referencia_externa),

  CONSTRAINT pagamentos_provedor_id_unico
    UNIQUE NULLS NOT DISTINCT (
      provedor,
      pagamento_provedor_id
    )
);

ALTER TABLE biblia_slides.pagamentos
ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pagamentos_select_proprios"
ON biblia_slides.pagamentos
FOR SELECT
TO authenticated
USING (
  usuario_id = auth.uid()
);
