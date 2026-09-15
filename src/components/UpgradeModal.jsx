import {
  BookOpenCheck,
  Check,
  Infinity,
  Presentation,
  X,
} from "lucide-react";

function UpgradeModal({
  aberto,
  onClose,
  onComprar,
}) {
  if (!aberto) return null;

  return (
    <div
      className="upgrade-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="upgrade-card">
        <div className="upgrade-top">
          <div className="upgrade-icon">
            <BookOpenCheck size={24} />
          </div>

          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="upgrade-heading">
          <span className="upgrade-badge">
            Oferta de lançamento
          </span>

          <h2>
            Continue sua biblioteca sem limites
          </h2>

          <p>
            Você já experimentou suas 3 aulas gratuitas.
            Libere agora todas as suas próximas aulas com
            um único pagamento.
          </p>
        </div>

        <div className="upgrade-price">
          <span className="upgrade-old-price">
            R$ 99,90
          </span>

          <div>
            <strong>R$ 39,90</strong>
            <span>pagamento único</span>
          </div>
        </div>

        <div className="upgrade-benefits">
          <div>
            <Check size={17} />
            <span>Aulas ilimitadas</span>
          </div>

          <div>
            <Presentation size={17} />
            <span>Apresentações bíblicas interativas</span>
          </div>

          <div>
            <BookOpenCheck size={17} />
            <span>Referências bíblicas no próprio slide</span>
          </div>

          <div>
            <Infinity size={17} />
            <span>Acesso vitalício</span>
          </div>
        </div>

        <button
          type="button"
          className="primary-button upgrade-buy"
          onClick={onComprar}
        >
          Liberar acesso por R$ 39,90
        </button>

        <button
          type="button"
          className="upgrade-later"
          onClick={onClose}
        >
          Continuar com minha biblioteca
        </button>

        <p className="upgrade-note">
          Sem mensalidade. Sem cobrança recorrente.
        </p>
      </div>
    </div>
  );
}

export default UpgradeModal;