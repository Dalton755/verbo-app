ALTER TABLE biblia_slides.pagamentos
ADD COLUMN IF NOT EXISTS checkout_url text;


CREATE UNIQUE INDEX IF NOT EXISTS
  pagamentos_um_pendente_por_usuario
ON biblia_slides.pagamentos (
  usuario_id,
  provedor
)
WHERE status = 'PENDENTE';
