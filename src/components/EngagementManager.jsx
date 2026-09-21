import {
  Bell,
  CheckCircle2,
  ChevronRight,
  MessageSquareText,
  Sparkles,
  Star,
  X,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  useAuth,
} from "../contexts/AuthContext";

import {
  supabase,
} from "../lib/supabase";

const PREFIXO_EXPERIENCIA =
  "verbo-experiencia-feedback:";

const PREFIXO_ADIAR =
  "verbo-feedback-adiado:";

const ROTAS_SEM_ENGAJAMENTO = [
  "/login",
  "/redefinir-senha",
  "/privacidade",
  "/termos",
  "/acesso",
  "/assinatura/retorno",
  "/boas-vindas",
  "/admin",
];

const ROTAS_SEGURAS_FEEDBACK = [
  "/",
  "/ebd",
  "/sermoes",
  "/livros",
  "/configuracoes/modulos",
];

const PALAVRAS_RECURSOS = [
  "referência",
  "referencia",
  "bíblia",
  "biblia",
  "nota",
  "marcador",
  "buscar",
  "busca",
  "índice",
  "indice",
  "tema",
  "tela cheia",
  "fullscreen",
  "púlpito",
  "pulpito",
  "preparar",
  "pregar",
  "rolagem",
  "páginas",
  "paginas",
  "texto",
  "pdf",
  "slide",
  "apresentação",
  "apresentacao",
];

function chaveExperiencia(
  usuarioId,
) {
  return `${PREFIXO_EXPERIENCIA}${usuarioId}`;
}

function chaveAdiar(
  usuarioId,
) {
  return `${PREFIXO_ADIAR}${usuarioId}`;
}

function lerExperiencia(
  usuarioId,
) {
  try {
    const bruto =
      localStorage.getItem(
        chaveExperiencia(
          usuarioId,
        ),
      );

    if (!bruto) {
      return {
        paginas: [],
        recursos: [],
      };
    }

    const dados =
      JSON.parse(bruto);

    return {
      paginas:
        Array.isArray(
          dados?.paginas,
        )
          ? dados.paginas
          : [],

      recursos:
        Array.isArray(
          dados?.recursos,
        )
          ? dados.recursos
          : [],
    };
  } catch {
    return {
      paginas: [],
      recursos: [],
    };
  }
}

function salvarExperiencia(
  usuarioId,
  dados,
) {
  try {
    localStorage.setItem(
      chaveExperiencia(
        usuarioId,
      ),
      JSON.stringify(dados),
    );
  } catch {
    // O feedback continua funcionando
    // mesmo sem persistência local.
  }
}

function feedbackAdiado(
  usuarioId,
) {
  try {
    const valor =
      Number(
        localStorage.getItem(
          chaveAdiar(
            usuarioId,
          ),
        ) ?? 0,
      );

    return (
      Number.isFinite(valor) &&
      valor > Date.now()
    );
  } catch {
    return false;
  }
}

function adiarFeedback(
  usuarioId,
) {
  try {
    localStorage.setItem(
      chaveAdiar(
        usuarioId,
      ),
      String(
        Date.now() +
          24 *
            60 *
            60 *
            1000,
      ),
    );
  } catch {
    // Sem bloqueio.
  }
}

function normalizarTexto(
  valor,
) {
  return String(
    valor ?? "",
  )
    .trim()
    .toLowerCase();
}

function identificarRecurso(
  elemento,
) {
  const botao =
    elemento?.closest?.(
      "button, [role='button'], a",
    );

  if (!botao) {
    return null;
  }

  const texto =
    normalizarTexto(
      [
        botao.getAttribute(
          "aria-label",
        ),
        botao.getAttribute(
          "title",
        ),
        botao.textContent,
      ]
        .filter(Boolean)
        .join(" "),
    );

  if (!texto) {
    return null;
  }

  const palavra =
    PALAVRAS_RECURSOS.find(
      (item) =>
        texto.includes(item),
    );

  if (!palavra) {
    return null;
  }

  return palavra;
}

function formatarData(
  valor,
) {
  if (!valor) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(new Date(valor));
}

function EngagementManager() {
  const {
    user,
  } = useAuth();

  const location =
    useLocation();

  const navigate =
    useNavigate();

  const [
    notificacoes,
    setNotificacoes,
  ] = useState([]);

  const [
    painelAberto,
    setPainelAberto,
  ] = useState(false);

  const [
    toast,
    setToast,
  ] = useState(null);

  const [
    feedbackAberto,
    setFeedbackAberto,
  ] = useState(false);

  const [
    nota,
    setNota,
  ] = useState(0);

  const [
    comentario,
    setComentario,
  ] = useState("");

  const [
    salvandoFeedback,
    setSalvandoFeedback,
  ] = useState(false);

  const [
    erroFeedback,
    setErroFeedback,
  ] = useState("");

  const feedbackVerificadoRef =
    useRef(false);

  const ultimaSincronizacaoRef =
    useRef(0);

  const rotaIgnorada =
    useMemo(
      () =>
        ROTAS_SEM_ENGAJAMENTO.some(
          (rota) =>
            location.pathname ===
              rota ||
            location.pathname.startsWith(
              `${rota}/`,
            ),
        ),
      [location.pathname],
    );

  const rotaSeguraFeedback =
    ROTAS_SEGURAS_FEEDBACK.includes(
      location.pathname,
    );

  const carregarNotificacoes =
    useCallback(
      async ({
        sincronizar = true,
      } = {}) => {
        if (!user?.id) {
          return;
        }

        if (
          sincronizar &&
          navigator.onLine
        ) {
          const agora =
            Date.now();

          if (
            agora -
              ultimaSincronizacaoRef.current >
            60000
          ) {
            ultimaSincronizacaoRef.current =
              agora;

            const {
              error:
                erroSincronizacao,
            } =
              await supabase
                .schema(
                  "biblia_slides",
                )
                .rpc(
                  "sincronizar_notificacoes_engajamento",
                );

            if (
              erroSincronizacao
            ) {
              console.debug(
                "Notificações indisponíveis:",
                erroSincronizacao,
              );
            }
          }
        }

        const {
          data,
          error,
        } =
          await supabase
            .schema(
              "biblia_slides",
            )
            .rpc(
              "minhas_notificacoes",
            );

        if (error) {
          console.debug(
            "Não foi possível carregar notificações:",
            error,
          );

          return;
        }

        const lista =
          Array.isArray(data)
            ? data
            : [];

        setNotificacoes(
          lista,
        );

        if (
          !rotaIgnorada &&
          !toast
        ) {
          const primeiraNaoLida =
            lista.find(
              (item) =>
                !item.lida_em,
            );

          if (
            primeiraNaoLida
          ) {
            window.setTimeout(
              () => {
                if (
                  document.querySelector(
                    ".guided-tour-layer",
                  ) ||
                  document.querySelector(
                    ".feedback-modal-overlay",
                  )
                ) {
                  return;
                }

                setToast(
                  primeiraNaoLida,
                );
              },
              1800,
            );
          }
        }
      },
      [
        user?.id,
        rotaIgnorada,
        toast,
      ],
    );

  const marcarLida =
    useCallback(
      async (
        notificacaoId,
      ) => {
        if (
          !notificacaoId
        ) {
          return;
        }

        setNotificacoes(
          (anterior) =>
            anterior.map(
              (item) =>
                item.id ===
                notificacaoId
                  ? {
                      ...item,
                      lida_em:
                        item.lida_em ||
                        new Date()
                          .toISOString(),
                    }
                  : item,
            ),
        );

        await supabase
          .schema(
            "biblia_slides",
          )
          .rpc(
            "marcar_notificacao_lida",
            {
              p_notificacao_id:
                notificacaoId,
            },
          );
      },
      [],
    );

  function abrirAcaoNotificacao(
    item,
  ) {
    marcarLida(
      item.id,
    );

    setToast(null);
    setPainelAberto(false);

    if (
      item.acao_rota
    ) {
      navigate(
        item.acao_rota,
      );
    }
  }

  useEffect(() => {
    if (
      !user?.id ||
      rotaIgnorada
    ) {
      return;
    }

    carregarNotificacoes();
  }, [
    user?.id,
    location.pathname,
    rotaIgnorada,
    carregarNotificacoes,
  ]);

  useEffect(() => {
    if (
      !user?.id ||
      rotaIgnorada
    ) {
      return;
    }

    const dados =
      lerExperiencia(
        user.id,
      );

    if (
      !dados.paginas.includes(
        location.pathname,
      )
    ) {
      dados.paginas.push(
        location.pathname,
      );

      salvarExperiencia(
        user.id,
        dados,
      );
    }
  }, [
    user?.id,
    location.pathname,
    rotaIgnorada,
  ]);

  useEffect(() => {
    if (
      !user?.id ||
      rotaIgnorada
    ) {
      return;
    }

    function registrarClique(
      event,
    ) {
      const recurso =
        identificarRecurso(
          event.target,
        );

      if (!recurso) {
        return;
      }

      const dados =
        lerExperiencia(
          user.id,
        );

      if (
        dados.recursos.includes(
          recurso,
        )
      ) {
        return;
      }

      dados.recursos.push(
        recurso,
      );

      salvarExperiencia(
        user.id,
        dados,
      );
    }

    document.addEventListener(
      "click",
      registrarClique,
      true,
    );

    return () =>
      document.removeEventListener(
        "click",
        registrarClique,
        true,
      );
  }, [
    user?.id,
    rotaIgnorada,
  ]);

  useEffect(() => {
    if (
      !user?.id ||
      rotaIgnorada ||
      !rotaSeguraFeedback ||
      feedbackAberto ||
      feedbackVerificadoRef.current ||
      feedbackAdiado(
        user.id,
      )
    ) {
      return;
    }

    const experiencia =
      lerExperiencia(
        user.id,
      );

    if (
      experiencia.paginas.length <
        4 ||
      experiencia.recursos.length <
        2
    ) {
      return;
    }

    let cancelado = false;

    async function verificar() {
      const {
        data,
        error,
      } =
        await supabase
          .schema(
            "biblia_slides",
          )
          .rpc(
            "meu_progresso_feedback",
          );

      if (
        cancelado ||
        error
      ) {
        return;
      }

      feedbackVerificadoRef.current =
        true;

      if (
        data?.ja_avaliou ===
        true
      ) {
        return;
      }

      if (
        Number(
          data?.total_arquivos ??
            0,
        ) < 1
      ) {
        feedbackVerificadoRef.current =
          false;
        return;
      }

      const timer =
        window.setTimeout(
          () => {
            if (
              document.querySelector(
                ".guided-tour-layer",
              )
            ) {
              feedbackVerificadoRef.current =
                false;
              return;
            }

            setFeedbackAberto(
              true,
            );
          },
          1200,
        );

      return () =>
        window.clearTimeout(
          timer,
        );
    }

    verificar();

    return () => {
      cancelado = true;
    };
  }, [
    user?.id,
    location.pathname,
    rotaIgnorada,
    rotaSeguraFeedback,
    feedbackAberto,
  ]);

  async function enviarFeedback() {
    if (
      nota < 1 ||
      nota > 5 ||
      salvandoFeedback
    ) {
      if (
        nota < 1
      ) {
        setErroFeedback(
          "Escolha de 1 a 5 estrelas.",
        );
      }

      return;
    }

    setSalvandoFeedback(
      true,
    );

    setErroFeedback("");

    const {
      data,
      error,
    } =
      await supabase
        .schema(
          "biblia_slides",
        )
        .rpc(
          "salvar_feedback",
          {
            p_nota: nota,
            p_comentario:
              comentario,
          },
        );

    if (error) {
      console.error(
        "Erro ao salvar avaliação:",
        error,
      );

      setErroFeedback(
        "Não foi possível salvar sua avaliação agora.",
      );

      setSalvandoFeedback(
        false,
      );

      return;
    }

    if (data?.id) {
      feedbackVerificadoRef.current =
        true;

      setFeedbackAberto(
        false,
      );

      setNota(0);
      setComentario("");
    }

    setSalvandoFeedback(
      false,
    );
  }

  function fecharFeedback() {
    if (
      user?.id
    ) {
      adiarFeedback(
        user.id,
      );
    }

    feedbackVerificadoRef.current =
      false;

    setFeedbackAberto(
      false,
    );
  }

  if (
    !user?.id ||
    rotaIgnorada
  ) {
    return null;
  }

  const naoLidas =
    notificacoes.filter(
      (item) =>
        !item.lida_em,
    ).length;

  return (
    <>
      <button
        type="button"
        className="engagement-bell"
        aria-label="Notificações"
        title="Notificações"
        onClick={() => {
          setToast(null);

          setPainelAberto(
            (aberto) =>
              !aberto,
          );
        }}
      >
        <Bell size={20} />

        {naoLidas > 0 && (
          <span>
            {Math.min(
              naoLidas,
              9,
            )}
          </span>
        )}
      </button>

      {toast && (
        <article
          className="engagement-toast"
          role="status"
        >
          <button
            type="button"
            className="engagement-toast-close"
            aria-label="Fechar notificação"
            onClick={() => {
              marcarLida(
                toast.id,
              );

              setToast(null);
            }}
          >
            <X size={16} />
          </button>

          <div className="engagement-toast-icon">
            <Sparkles
              size={19}
            />
          </div>

          <div className="engagement-toast-copy">
            <strong>
              {toast.titulo}
            </strong>

            <p>
              {toast.mensagem}
            </p>

            {toast.acao_texto &&
              toast.acao_rota && (
                <button
                  type="button"
                  onClick={() =>
                    abrirAcaoNotificacao(
                      toast,
                    )
                  }
                >
                  {toast.acao_texto}

                  <ChevronRight
                    size={16}
                  />
                </button>
              )}
          </div>
        </article>
      )}

      {painelAberto && (
        <div
          className="engagement-drawer-backdrop"
          onClick={() =>
            setPainelAberto(
              false,
            )
          }
        >
          <aside
            className="engagement-drawer"
            onClick={(
              event,
            ) =>
              event.stopPropagation()
            }
          >
            <header>
              <div>
                <span>
                  VERBO
                </span>

                <h2>
                  Notificações
                </h2>
              </div>

              <button
                type="button"
                aria-label="Fechar"
                onClick={() =>
                  setPainelAberto(
                    false,
                  )
                }
              >
                <X size={19} />
              </button>
            </header>

            <div className="engagement-notification-list">
              {notificacoes.length ===
              0 ? (
                <div className="engagement-notification-empty">
                  <CheckCircle2
                    size={28}
                  />

                  <strong>
                    Tudo em dia
                  </strong>

                  <p>
                    Quando houver uma dica importante para sua experiência, ela aparecerá aqui.
                  </p>
                </div>
              ) : (
                notificacoes.map(
                  (item) => (
                    <article
                      key={
                        item.id
                      }
                      className={
                        item.lida_em
                          ? "engagement-notification-card read"
                          : "engagement-notification-card"
                      }
                    >
                      <div className="engagement-notification-card-top">
                        <div>
                          {!item.lida_em && (
                            <span className="engagement-unread-dot" />
                          )}

                          <strong>
                            {item.titulo}
                          </strong>
                        </div>

                        <small>
                          {formatarData(
                            item.created_at,
                          )}
                        </small>
                      </div>

                      <p>
                        {item.mensagem}
                      </p>

                      <div className="engagement-notification-actions">
                        {!item.lida_em && (
                          <button
                            type="button"
                            onClick={() =>
                              marcarLida(
                                item.id,
                              )
                            }
                          >
                            Marcar como lida
                          </button>
                        )}

                        {item.acao_texto &&
                          item.acao_rota && (
                            <button
                              type="button"
                              className="primary"
                              onClick={() =>
                                abrirAcaoNotificacao(
                                  item,
                                )
                              }
                            >
                              {item.acao_texto}

                              <ChevronRight
                                size={15}
                              />
                            </button>
                          )}
                      </div>
                    </article>
                  ),
                )
              )}
            </div>
          </aside>
        </div>
      )}

      {feedbackAberto && (
        <div
          className="feedback-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Avaliar o VERBO"
        >
          <div className="feedback-modal">
            <button
              type="button"
              className="feedback-modal-close"
              aria-label="Avaliar depois"
              onClick={
                fecharFeedback
              }
            >
              <X size={19} />
            </button>

            <div className="feedback-modal-icon">
              <MessageSquareText
                size={25}
              />
            </div>

            <span className="feedback-modal-kicker">
              SUA EXPERIÊNCIA IMPORTA
            </span>

            <h2>
              O que você está achando do VERBO?
            </h2>

            <p>
              Você já navegou pelo aplicativo e experimentou recursos com um material seu. Sua opinião ajuda a deixar o VERBO mais simples e útil.
            </p>

            <div
              className="feedback-stars"
              aria-label="Nota da avaliação"
            >
              {[
                1,
                2,
                3,
                4,
                5,
              ].map(
                (valor) => (
                  <button
                    key={valor}
                    type="button"
                    aria-label={
                      `${valor} ${valor === 1 ? "estrela" : "estrelas"}`
                    }
                    className={
                      nota >= valor
                        ? "active"
                        : ""
                    }
                    onClick={() => {
                      setNota(
                        valor,
                      );

                      setErroFeedback(
                        "",
                      );
                    }}
                  >
                    <Star
                      size={29}
                      fill={
                        nota >= valor
                          ? "currentColor"
                          : "none"
                      }
                    />
                  </button>
                ),
              )}
            </div>

            <label className="feedback-comment">
              <span>
                Quer contar um pouco mais?
              </span>

              <textarea
                rows={4}
                maxLength={2000}
                value={comentario}
                placeholder="O que gostou? O que podemos melhorar?"
                onChange={(
                  event,
                ) =>
                  setComentario(
                    event.target.value,
                  )
                }
              />
            </label>

            {erroFeedback && (
              <div className="feedback-error">
                {erroFeedback}
              </div>
            )}

            <div className="feedback-modal-actions">
              <button
                type="button"
                className="feedback-later"
                disabled={
                  salvandoFeedback
                }
                onClick={
                  fecharFeedback
                }
              >
                Agora não
              </button>

              <button
                type="button"
                className="feedback-submit"
                disabled={
                  salvandoFeedback ||
                  nota < 1
                }
                onClick={
                  enviarFeedback
                }
              >
                {salvandoFeedback
                  ? "Enviando..."
                  : "Enviar avaliação"}
              </button>
            </div>

            <small className="feedback-once-note">
              Depois de enviar, esta pergunta não aparecerá novamente. Sua avaliação ficará disponível nas Configurações.
            </small>
          </div>
        </div>
      )}
    </>
  );
}

export default EngagementManager;
