ALTER TABLE biblia_slides.pagamentos
DROP CONSTRAINT IF EXISTS
  pagamentos_provedor_id_unico;

CREATE UNIQUE INDEX IF NOT EXISTS
  pagamentos_provedor_id_unico
ON biblia_slides.pagamentos (
  provedor,
  pagamento_provedor_id
)
WHERE pagamento_provedor_id IS NOT NULL;
