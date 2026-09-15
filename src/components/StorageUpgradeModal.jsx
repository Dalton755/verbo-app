import {
    Check,
    HardDrive,
    X,
} from "lucide-react";

import {
    useEffect,
    useState,
} from "react";

import {
    supabase,
} from "../lib/supabase";

function formatarPreco(valor) {
    return Number(
        valor ?? 0,
    ).toLocaleString(
        "pt-BR",
        {
            style: "currency",
            currency: "BRL",
        },
    );
}

function formatarData(data) {
    if (!data) return "";

    return new Date(
        data,
    ).toLocaleDateString(
        "pt-BR",
    );
}

function StorageUpgradeModal({
    aberto,
    onClose,
    armazenamento,
}) {
    const [
        planos,
        setPlanos,
    ] = useState([]);

    const [
        carregando,
        setCarregando,
    ] = useState(false);

    const [
        simulacoes,
        setSimulacoes,
    ] = useState({});

    const [
        erro,
        setErro,
    ] = useState("");

    const [
        planoAssinando,
        setPlanoAssinando,
    ] = useState(null);

    const [
        planosMenores,
        setPlanosMenores,
    ] = useState([]);

    const [
        downgradeAgendado,
        setDowngradeAgendado,
    ] = useState(null);

    const [
        planoReduzindo,
        setPlanoReduzindo,
    ] = useState(null);

    const [
        cancelandoDowngrade,
        setCancelandoDowngrade,
    ] = useState(false);

    const [
        mensagemDowngrade,
        setMensagemDowngrade,
    ] = useState("");

    const [
        proximoVencimentoAtual,
        setProximoVencimentoAtual,
    ] = useState(null);

    const [
        cancelamentoAgendado,
        setCancelamentoAgendado,
    ] = useState(null);

    const [
        processandoCancelamento,
        setProcessandoCancelamento,
    ] = useState(false);

    const [
        mensagemCancelamento,
        setMensagemCancelamento,
    ] = useState("");

    const [
        inadimplenciaAberta,
        setInadimplenciaAberta,
    ] = useState(null);

    const planoMensalAtual =
        armazenamento
            ?.upgrade_ativo ===
        true &&
        armazenamento
            ?.plano_codigo !==
        "BASE_25MB";



    useEffect(() => {
        if (!aberto) return;

        let ativo = true;

        async function carregar() {
            setCarregando(true);

            const {
                data,
                error,
            } =
                await supabase
                    .schema(
                        "biblia_slides",
                    )
                    .from(
                        "planos_armazenamento",
                    )
                    .select(`
                        codigo,
                        nome,
                        limite_bytes,
                        preco,
                        tipo_cobranca,
                        ordem
                    `)
                    .eq(
                        "ativo",
                        true,
                    )
                    .eq(
                        "tipo_cobranca",
                        "MENSAL",
                    )
                    .order(
                        "ordem",
                        {
                            ascending: true,
                        },
                    );

            if (!ativo) return;

            if (error) {
                console.error(
                    "Erro ao carregar planos:",
                    error,
                );

                setErro(
                    "Não conseguimos carregar os planos.",
                );

                setCarregando(false);
                return;
            }

            const limiteAtual =
                Number(
                    armazenamento
                        ?.limite_bytes ??
                    0,
                );

            const lista =
                (data ?? []).filter(
                    (plano) =>
                        Number(
                            plano.limite_bytes,
                        ) >
                        limiteAtual,
                );

            const menores =
                planoMensalAtual
                    ? (data ?? []).filter(
                        (plano) =>
                            Number(
                                plano.limite_bytes,
                            ) <
                            limiteAtual,
                    )
                    : [];

            setPlanos(lista);
            setPlanosMenores(menores);

            const resultados = {};

            for (
                const plano of lista
            ) {
                const {
                    data: simulacao,
                    error:
                    erroSimulacao,
                } =
                    await supabase
                        .schema(
                            "biblia_slides",
                        )
                        .rpc(
                            "simular_upgrade_armazenamento",
                            {
                                p_plano_codigo:
                                    plano.codigo,
                            },
                        )
                        .single();

                if (
                    !erroSimulacao &&
                    simulacao
                ) {
                    resultados[
                        plano.codigo
                    ] = simulacao;
                }

            }

            if (!ativo) return;

            setSimulacoes(
                resultados,
            );

            const {
                data: cicloAtual,
                error: erroCicloAtual,
            } =
                await supabase
                    .schema(
                        "biblia_slides",
                    )
                    .rpc(
                        "meu_ciclo_armazenamento",
                    )
                    .maybeSingle();

            if (!ativo) return;

            if (erroCicloAtual) {
                console.error(
                    "Erro ao consultar ciclo atual:",
                    erroCicloAtual,
                );
            } else {
                setProximoVencimentoAtual(
                    cicloAtual
                        ?.proximo_vencimento_em ??
                    null,
                );
            }

            const {
                data: alteracao,
                error: erroAlteracao,
            } =
                await supabase
                    .schema(
                        "biblia_slides",
                    )
                    .rpc(
                        "meu_downgrade_armazenamento",
                    )
                    .maybeSingle();

            if (!ativo) return;

            if (erroAlteracao) {
                console.error(
                    "Erro ao consultar downgrade agendado:",
                    erroAlteracao,
                );
            } else {
                setDowngradeAgendado(
                    alteracao ?? null,
                );
                const {
                    data: cancelamento,
                    error: erroCancelamento,
                } =
                    await supabase
                        .schema(
                            "biblia_slides",
                        )
                        .rpc(
                            "meu_cancelamento_armazenamento",
                        )
                        .maybeSingle();

                if (!ativo) return;

                if (erroCancelamento) {
                    console.error(
                        "Erro ao consultar cancelamento agendado:",
                        erroCancelamento,
                    );
                } else {
                    setCancelamentoAgendado(
                        cancelamento ?? null,
                    );
                }
            }

            setErro("");
            setCarregando(false);
        }

        carregar();

        return () => {
            ativo = false;
        };
    }, [
        aberto,
        armazenamento?.limite_bytes,
        planoMensalAtual,
    ]);

    useEffect(() => {
        if (!aberto) {
            setInadimplenciaAberta(null);
            return;
        }

        let ativo = true;

        async function carregarInadimplencia() {
            const {
                data,
                error,
            } =
                await supabase
                    .schema("biblia_slides")
                    .rpc(
                        "minha_inadimplencia_armazenamento",
                    );

            if (!ativo) {
                return;
            }

            if (error) {
                console.error(
                    "Erro ao consultar inadimplência:",
                    error,
                );

                setInadimplenciaAberta(null);
                return;
            }

            const registro =
                Array.isArray(data)
                    ? data[0] ?? null
                    : data ?? null;

            setInadimplenciaAberta(
                registro,
            );
        }

        carregarInadimplencia();

        return () => {
            ativo = false;
        };
    }, [aberto]);

    async function assinarPlano(
        plano,
    ) {
        if (
            !plano?.codigo ||
            planoAssinando ||
            cancelamentoAgendado ||
            inadimplenciaAberta
        ) {
            return;
        }

        setPlanoAssinando(
            plano.codigo,
        );

        setErro("");

        try {
            const funcao =
                planoMensalAtual
                    ? "criar-checkout-upgrade-armazenamento"
                    : "criar-assinatura-armazenamento";

            const {
                data,
                error,
            } =
                await supabase.functions.invoke(
                    funcao,
                    {
                        body: {
                            planoCodigo:
                                plano.codigo,
                        },
                    },
                );

            if (error) {
                console.error(
                    "Erro ao processar plano:",
                    error,
                );

                throw new Error(
                    planoMensalAtual
                        ? "Não foi possível alterar o plano."
                        : "Não foi possível iniciar a assinatura.",
                );
            }

            if (!data?.ok) {
                throw new Error(
                    data?.erro ||
                    (
                        planoMensalAtual
                            ? "Não foi possível alterar o plano."
                            : "Não foi possível iniciar a assinatura."
                    ),
                );
            }



            /*
             * BASE_25MB -> primeiro plano mensal:
             *
             * continua usando o checkout
             * do Mercado Pago.
             */
            if (!data?.checkoutUrl) {
                throw new Error(
                    "Não foi possível abrir o pagamento.",
                );
            }

            window.location.assign(
                data.checkoutUrl,
            );
        } catch (error) {
            console.error(
                "Erro ao processar plano:",
                error,
            );

            setErro(
                error?.message ||
                "Não foi possível processar o plano.",
            );

            setPlanoAssinando(null);
        }
    }

    async function reduzirPlano(
        plano,
    ) {
        if (
            !plano?.codigo ||
            planoReduzindo ||
            downgradeAgendado
        ) {
            return;
        }

        setPlanoReduzindo(
            plano.codigo,
        );

        setErro("");
        setMensagemDowngrade("");

        try {
            const {
                data,
                error,
            } =
                await supabase
                    .functions
                    .invoke(
                        "agendar-downgrade-armazenamento",
                        {
                            body: {
                                planoCodigo:
                                    plano.codigo,
                            },
                        },
                    );

            if (error) {
                console.error(
                    "Erro ao agendar redução:",
                    error,
                );

                throw new Error(
                    "Não foi possível agendar a redução.",
                );
            }

            if (!data?.ok) {
                throw new Error(
                    data?.erro ||
                    "Não foi possível agendar a redução.",
                );
            }

            setDowngradeAgendado({
                agendamento_id:
                    data.agendamentoId,

                plano_origem_codigo:
                    data.planoAtual,

                plano_origem_nome:
                    armazenamento
                        ?.plano_nome,

                plano_destino_codigo:
                    data.planoDestino,

                plano_destino_nome:
                    plano.nome,

                preco_origem:
                    data.precoAtual,

                preco_destino:
                    data.precoFuturo,

                efetivar_em:
                    data.efetivarEm,

                status:
                    "AGENDADA",
            });

            setMensagemDowngrade(
                `Redução para ${plano.nome} agendada para ${formatarData(
                    data.efetivarEm,
                )}.`,
            );
        } catch (error) {
            setErro(
                error?.message ||
                "Não foi possível agendar a redução.",
            );
        } finally {
            setPlanoReduzindo(null);
        }
    }


    async function cancelarReducao() {
        if (
            !downgradeAgendado ||
            cancelandoDowngrade
        ) {
            return;
        }

        setCancelandoDowngrade(true);
        setErro("");
        setMensagemDowngrade("");

        try {
            const {
                data,
                error,
            } =
                await supabase
                    .functions
                    .invoke(
                        "cancelar-downgrade-armazenamento",
                        {
                            body: {},
                        },
                    );

            if (error) {
                console.error(
                    "Erro ao cancelar redução:",
                    error,
                );

                throw new Error(
                    "Não foi possível cancelar a alteração.",
                );
            }

            if (!data?.ok) {
                throw new Error(
                    data?.erro ||
                    "Não foi possível cancelar a alteração.",
                );
            }

            setDowngradeAgendado(null);

            setMensagemDowngrade(
                "Alteração cancelada. Seu plano atual foi mantido.",
            );
        } catch (error) {
            setErro(
                error?.message ||
                "Não foi possível cancelar a alteração.",
            );
        } finally {
            setCancelandoDowngrade(false);
        }
    }

    async function agendarCancelamento() {
        if (
            processandoCancelamento ||
            cancelamentoAgendado ||
            downgradeAgendado
        ) {
            return;
        }

        setProcessandoCancelamento(true);
        setErro("");
        setMensagemCancelamento("");

        try {
            const {
                data,
                error,
            } =
                await supabase
                    .functions
                    .invoke(
                        "agendar-cancelamento-armazenamento",
                        {
                            body: {},
                        },
                    );

            if (error) {
                console.error(
                    "Erro ao agendar cancelamento:",
                    error,
                );

                throw new Error(
                    "Não foi possível agendar o cancelamento.",
                );
            }

            if (!data?.ok) {
                throw new Error(
                    data?.erro ||
                    "Não foi possível agendar o cancelamento.",
                );
            }

            setCancelamentoAgendado({
                cancelamento_id:
                    data.cancelamentoId,

                plano_codigo:
                    data.planoAtual,

                plano_nome:
                    data.planoNome,

                preco_mensal:
                    data.precoMensal,

                efetivar_em:
                    data.efetivarEm,

                status:
                    "AGENDADO",
            });

            setMensagemCancelamento(
                `Assinatura programada para encerrar em ${formatarData(
                    data.efetivarEm,
                )}.`,
            );
        } catch (error) {
            setErro(
                error?.message ||
                "Não foi possível agendar o cancelamento.",
            );
        } finally {
            setProcessandoCancelamento(false);
        }
    }


    async function desfazerCancelamento() {
        if (
            !cancelamentoAgendado ||
            processandoCancelamento
        ) {
            return;
        }

        setProcessandoCancelamento(true);
        setErro("");
        setMensagemCancelamento("");

        try {
            const {
                data,
                error,
            } =
                await supabase
                    .functions
                    .invoke(
                        "desfazer-cancelamento-armazenamento",
                        {
                            body: {},
                        },
                    );

            if (error) {
                console.error(
                    "Erro ao desfazer cancelamento:",
                    error,
                );

                throw new Error(
                    "Não foi possível manter a assinatura.",
                );
            }

            if (!data?.ok) {
                throw new Error(
                    data?.erro ||
                    "Não foi possível manter a assinatura.",
                );
            }

            setCancelamentoAgendado(null);

            setMensagemCancelamento(
                "Cancelamento desfeito. Sua assinatura continua ativa.",
            );
        } catch (error) {
            setErro(
                error?.message ||
                "Não foi possível manter a assinatura.",
            );
        } finally {
            setProcessandoCancelamento(false);
        }
    }

    if (!aberto) {
        return null;
    }

    return (
        <div
            className="storage-modal-backdrop"
            onMouseDown={onClose}
        >
            <div
                className="storage-modal"
                onMouseDown={(
                    event,
                ) =>
                    event.stopPropagation()
                }
            >
                <header className="storage-modal-header">
                    <div>
                        <span>
                            Armazenamento
                        </span>

                        <h2>
                            Gerencie seu espaço
                        </h2>

                        <p>
                            Aumente ou ajuste seu
                            armazenamento conforme
                            sua necessidade.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="storage-modal-close"
                        onClick={onClose}
                        aria-label="Fechar"
                    >
                        <X size={20} />
                    </button>
                </header>

                <div className="storage-current-plan">
                    <div className="storage-current-icon">
                        <HardDrive
                            size={19}
                        />
                    </div>

                    <div>
                        <span>
                            {planoMensalAtual
                                ? "Seu plano mensal"
                                : "Seu espaço vitalício"}
                        </span>

                        <strong>
                            {armazenamento
                                ?.plano_nome ??
                                "25 MB"}
                        </strong>
                    </div>

                    <span className="storage-current-badge">
                        Plano atual
                    </span>
                </div>

                {inadimplenciaAberta && (
                    <div className="storage-payment-warning">
                        <strong>
                            Não conseguimos confirmar sua mensalidade
                        </strong>

                        <p>
                            Seu armazenamento continua disponível
                            normalmente enquanto o Mercado Pago realiza
                            uma nova tentativa de cobrança.
                        </p>

                        <p>
                            Durante esse período, alterações de plano
                            ficam temporariamente indisponíveis.
                        </p>
                    </div>
                )}

                {!cancelamentoAgendado &&
                    !inadimplenciaAberta && (
                        carregando ? (
                            <p className="storage-modal-state" >
                                Consultando opções...
                            </p>
                        ) : erro ? (
                            <p className="storage-modal-error">
                                {erro}
                            </p>

                        ) : (
                            <div className="storage-plan-list">
                                {planos.map(
                                    (plano) => {
                                        const simulacao =
                                            simulacoes[
                                            plano.codigo
                                            ];

                                        const credito =
                                            simulacao
                                                ?.credito_base_disponivel ===
                                            true;

                                        return (
                                            <article
                                                key={
                                                    plano.codigo
                                                }
                                                className={
                                                    credito
                                                        ? "storage-plan-card storage-plan-card-featured"
                                                        : "storage-plan-card"
                                                }
                                            >
                                                <div className="storage-plan-main">
                                                    <div>
                                                        {credito && (
                                                            <span className="storage-plan-benefit">
                                                                Primeira mensalidade já paga
                                                            </span>
                                                        )}

                                                        <h3>
                                                            {
                                                                plano.nome
                                                            }
                                                        </h3>

                                                        <div className="storage-plan-price">
                                                            <strong>
                                                                {formatarPreco(
                                                                    plano.preco,
                                                                )}
                                                            </strong>

                                                            <span>
                                                                /mês
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="storage-plan-now">
                                                        <span>
                                                            {planoMensalAtual
                                                                ? "Proporcional hoje"
                                                                : credito
                                                                    ? "Total hoje"
                                                                    : "Hoje"}
                                                        </span>

                                                        <strong>
                                                            {simulacao
                                                                ? formatarPreco(
                                                                    simulacao.valor_agora,
                                                                )
                                                                : "—"}
                                                        </strong>
                                                    </div>
                                                </div>

                                                {credito && (
                                                    <>
                                                        <div className="storage-plan-payment-summary">
                                                            <div className="storage-plan-payment-row">
                                                                <span>
                                                                    Mensalidade
                                                                </span>

                                                                <strong>
                                                                    {formatarPreco(
                                                                        plano.preco,
                                                                    )}
                                                                </strong>
                                                            </div>

                                                            <div className="storage-plan-payment-row">
                                                                <span>
                                                                    Crédito da compra do app
                                                                </span>

                                                                <strong className="storage-plan-credit-value">
                                                                    -{" "}
                                                                    {formatarPreco(
                                                                        simulacao
                                                                            ?.credito_aplicado ??
                                                                        plano.preco,
                                                                    )}
                                                                </strong>
                                                            </div>

                                                            <div className="storage-plan-payment-total">
                                                                <span>
                                                                    Total a pagar hoje
                                                                </span>

                                                                <strong>
                                                                    {formatarPreco(
                                                                        simulacao
                                                                            ?.valor_agora ??
                                                                        0,
                                                                    )}
                                                                </strong>
                                                            </div>
                                                        </div>

                                                        <div className="storage-plan-credit">
                                                            <Check
                                                                size={16}
                                                            />

                                                            <span>
                                                                Seus 100 MB serão
                                                                liberados assim que
                                                                você autorizar a
                                                                assinatura.
                                                            </span>
                                                        </div>

                                                        {simulacao
                                                            ?.proximo_vencimento_em && (
                                                                <div className="storage-plan-first-charge">
                                                                    <span>
                                                                        Primeira cobrança
                                                                    </span>

                                                                    <strong>
                                                                        {formatarData(
                                                                            simulacao
                                                                                .proximo_vencimento_em,
                                                                        )}
                                                                        {" — "}
                                                                        {formatarPreco(
                                                                            plano.preco,
                                                                        )}
                                                                    </strong>
                                                                </div>
                                                            )}

                                                        <p className="storage-plan-payment-note">
                                                            Você será direcionado ao
                                                            Mercado Pago apenas para
                                                            autorizar a forma de
                                                            pagamento. Nenhuma cobrança
                                                            será realizada hoje.
                                                        </p>
                                                    </>
                                                )}

                                                {planoMensalAtual &&
                                                    simulacao && (
                                                        <>
                                                            <div className="storage-plan-payment-summary">
                                                                <div className="storage-plan-payment-row">
                                                                    <span>
                                                                        Plano atual
                                                                    </span>

                                                                    <strong>
                                                                        {simulacao
                                                                            .plano_atual_nome}{" "}
                                                                        ·{" "}
                                                                        {formatarPreco(
                                                                            simulacao
                                                                                .preco_atual,
                                                                        )}
                                                                        /mês
                                                                    </strong>
                                                                </div>

                                                                <div className="storage-plan-payment-row">
                                                                    <span>
                                                                        Novo plano
                                                                    </span>

                                                                    <strong>
                                                                        {plano.nome}{" "}
                                                                        ·{" "}
                                                                        {formatarPreco(
                                                                            plano.preco,
                                                                        )}
                                                                        /mês
                                                                    </strong>
                                                                </div>

                                                                <div className="storage-plan-payment-row">
                                                                    <span>
                                                                        Diferença mensal
                                                                    </span>

                                                                    <strong>
                                                                        {formatarPreco(
                                                                            simulacao
                                                                                .diferenca_mensal,
                                                                        )}
                                                                    </strong>
                                                                </div>

                                                                <div className="storage-plan-payment-total">
                                                                    <span>
                                                                        Valor proporcional hoje
                                                                    </span>

                                                                    <strong>
                                                                        {formatarPreco(
                                                                            simulacao
                                                                                .valor_proporcional_agora,
                                                                        )}
                                                                    </strong>
                                                                </div>
                                                            </div>

                                                            <div className="storage-plan-credit">
                                                                <Check
                                                                    size={16}
                                                                />

                                                                <span>
                                                                    Restam{" "}
                                                                    <strong>
                                                                        {simulacao
                                                                            .dias_restantes}{" "}
                                                                        {simulacao
                                                                            .dias_restantes === 1
                                                                            ? "dia"
                                                                            : "dias"}
                                                                    </strong>{" "}
                                                                    no ciclo atual.
                                                                </span>
                                                            </div>

                                                            {simulacao
                                                                ?.proximo_vencimento_em && (
                                                                    <div className="storage-plan-first-charge">
                                                                        <span>
                                                                            Próxima mensalidade
                                                                        </span>

                                                                        <strong>
                                                                            {formatarData(
                                                                                simulacao
                                                                                    .proximo_vencimento_em,
                                                                            )}
                                                                            {" — "}
                                                                            {formatarPreco(
                                                                                plano.preco,
                                                                            )}
                                                                        </strong>
                                                                    </div>
                                                                )}

                                                            <p className="storage-plan-payment-note">
                                                                Você paga agora somente
                                                                a diferença proporcional
                                                                pelo período restante.
                                                                Depois, a mensalidade passa
                                                                para o valor integral do
                                                                novo plano.
                                                            </p>
                                                        </>
                                                    )}


                                                <button
                                                    type="button"
                                                    className="storage-plan-action"
                                                    disabled={
                                                        Boolean(
                                                            planoAssinando,
                                                        )
                                                    }
                                                    onClick={() =>
                                                        assinarPlano(
                                                            plano,
                                                        )
                                                    }
                                                >
                                                    {planoAssinando ===
                                                        plano.codigo
                                                        ? "Abrindo Mercado Pago..."
                                                        : planoMensalAtual
                                                            ? `Fazer upgrade para ${plano.nome}`
                                                            : Number(
                                                                simulacao
                                                                    ?.valor_agora,
                                                            ) === 0
                                                                ? `Ativar ${plano.nome}`
                                                                : "Assinar este plano"}
                                                </button>
                                            </article>
                                        );
                                    },
                                )}
                            </div>
                        )
                    )}

                {planoMensalAtual &&
                    !cancelamentoAgendado &&
                    !inadimplenciaAberta && (
                        <section className="storage-downgrade-section">
                            <div className="storage-downgrade-heading">
                                <strong>
                                    Reduzir armazenamento
                                </strong>

                                <span>
                                    A alteração acontece somente
                                    no próximo ciclo.
                                </span>
                            </div>

                            {mensagemDowngrade && (
                                <p className="storage-downgrade-success">
                                    {mensagemDowngrade}
                                </p>
                            )}

                            {downgradeAgendado ? (
                                <div className="storage-downgrade-scheduled">
                                    <span>
                                        Alteração agendada
                                    </span>

                                    <strong>
                                        {downgradeAgendado
                                            .plano_origem_nome}{" "}
                                        →{" "}
                                        {downgradeAgendado
                                            .plano_destino_nome}
                                    </strong>

                                    <p>
                                        Você continua com{" "}
                                        <strong>
                                            {downgradeAgendado
                                                .plano_origem_nome}
                                        </strong>{" "}
                                        até{" "}
                                        <strong>
                                            {formatarData(
                                                downgradeAgendado
                                                    .efetivar_em,
                                            )}
                                        </strong>.
                                    </p>

                                    <p>
                                        A próxima mensalidade será{" "}
                                        <strong>
                                            {formatarPreco(
                                                downgradeAgendado
                                                    .preco_destino,
                                            )}
                                        </strong>.
                                    </p>

                                    <button
                                        type="button"
                                        className="storage-plan-button storage-downgrade-cancel"
                                        disabled={
                                            cancelandoDowngrade
                                        }
                                        onClick={
                                            cancelarReducao
                                        }
                                    >
                                        {cancelandoDowngrade
                                            ? "Cancelando..."
                                            : "Cancelar alteração"}
                                    </button>
                                </div>
                            ) : (
                                <>
                                    {planosMenores.map(
                                        (plano) => (
                                            <article
                                                key={
                                                    plano.codigo
                                                }
                                                className="storage-plan-card storage-downgrade-card"
                                            >
                                                <div className="storage-plan-main">
                                                    <div>
                                                        <strong className="storage-plan-name">
                                                            {plano.nome}
                                                        </strong>

                                                        <div className="storage-plan-price">
                                                            <strong>
                                                                {formatarPreco(
                                                                    plano.preco,
                                                                )}
                                                            </strong>

                                                            <span>
                                                                /mês
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <p className="storage-plan-payment-note">
                                                    Seu plano atual continua
                                                    disponível até{" "}
                                                    <strong>
                                                        {formatarData(
                                                            proximoVencimentoAtual,
                                                        )}
                                                    </strong>.
                                                    Os arquivos acima do novo
                                                    limite não serão apagados.
                                                </p>

                                                <button
                                                    type="button"
                                                    className="storage-plan-button storage-downgrade-button"
                                                    disabled={
                                                        Boolean(
                                                            planoReduzindo,
                                                        )
                                                    }
                                                    onClick={() =>
                                                        reduzirPlano(
                                                            plano,
                                                        )
                                                    }
                                                >
                                                    {planoReduzindo ===
                                                        plano.codigo
                                                        ? "Agendando..."
                                                        : `Mudar para ${plano.nome} no próximo ciclo`}
                                                </button>
                                            </article>
                                        ),
                                    )}

                                    {planosMenores.length ===
                                        0 && (
                                            <p className="storage-modal-state">
                                                Não há outro plano mensal
                                                inferior disponível.
                                            </p>
                                        )}
                                </>
                            )}
                        </section>
                    )}

                {planoMensalAtual &&
                    !inadimplenciaAberta && (
                        <section className="storage-cancel-section">
                            <div className="storage-downgrade-heading">
                                <strong>
                                    Gerenciar assinatura
                                </strong>

                                <span>
                                    Você pode encerrar a mensalidade
                                    sem perder o período já pago.
                                </span>
                            </div>

                            {mensagemCancelamento && (
                                <p className="storage-downgrade-success">
                                    {mensagemCancelamento}
                                </p>
                            )}

                            {cancelamentoAgendado ? (
                                <div className="storage-cancel-scheduled">
                                    <span>
                                        Cancelamento agendado
                                    </span>

                                    <strong>
                                        Sua assinatura termina em{" "}
                                        {formatarData(
                                            cancelamentoAgendado
                                                .efetivar_em,
                                        )}
                                    </strong>

                                    <p>
                                        Até essa data você continua
                                        usando normalmente seus{" "}
                                        <strong>
                                            {cancelamentoAgendado
                                                .plano_nome}
                                        </strong>.
                                    </p>

                                    <p>
                                        Depois disso sua conta volta
                                        automaticamente para os{" "}
                                        <strong>
                                            25 MB vitalícios
                                        </strong>.
                                    </p>

                                    <p>
                                        Seus arquivos excedentes não
                                        serão apagados.
                                    </p>

                                    <button
                                        type="button"
                                        className="storage-plan-button"
                                        disabled={
                                            processandoCancelamento
                                        }
                                        onClick={
                                            desfazerCancelamento
                                        }
                                    >
                                        {processandoCancelamento
                                            ? "Restaurando..."
                                            : "Manter minha assinatura"}
                                    </button>
                                </div>
                            ) : (
                                <div className="storage-cancel-normal">
                                    <p>
                                        Se cancelar agora, você
                                        continua com{" "}
                                        <strong>
                                            {armazenamento
                                                ?.plano_nome}
                                        </strong>{" "}
                                        até{" "}
                                        <strong>
                                            {formatarData(
                                                proximoVencimentoAtual,
                                            )}
                                        </strong>.
                                    </p>

                                    <p>
                                        Não haverá nova mensalidade
                                        após essa data.
                                    </p>

                                    <button
                                        type="button"
                                        className="storage-cancel-subscription-button"
                                        disabled={
                                            processandoCancelamento ||
                                            Boolean(
                                                downgradeAgendado,
                                            )
                                        }
                                        onClick={
                                            agendarCancelamento
                                        }
                                    >
                                        {processandoCancelamento
                                            ? "Agendando..."
                                            : "Cancelar assinatura mensal"}
                                    </button>
                                </div>
                            )}
                        </section>
                    )}

                <p className="storage-modal-note">
                    Seu plano vitalício de
                    25 MB nunca é perdido.
                    Se uma assinatura mensal
                    terminar, sua conta volta
                    automaticamente para esse
                    espaço.
                </p>
            </div>
        </div >
    );
}

export default StorageUpgradeModal;