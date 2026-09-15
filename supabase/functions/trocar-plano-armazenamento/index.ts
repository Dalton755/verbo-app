import { withSupabase } from "npm:@supabase/server@^1";


function numero(
    valor: unknown,
) {
    const convertido =
        Number(valor);

    return Number.isFinite(
        convertido,
    )
        ? convertido
        : null;
}


function mesmoValor(
    a: unknown,
    b: unknown,
) {
    const primeiro =
        numero(a);

    const segundo =
        numero(b);

    if (
        primeiro === null ||
        segundo === null
    ) {
        return false;
    }

    return (
        Math.abs(
            primeiro -
            segundo,
        ) < 0.005
    );
}


function statusMpAutorizado(
    status: unknown,
) {
    return (
        String(
            status ?? "",
        )
            .trim()
            .toLowerCase() ===
        "authorized"
    );
}


function uuidValido(
    valor: string,
) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        .test(valor);
}


export default {
    fetch: withSupabase(
        { auth: "user" },

        async (req, ctx) => {
            const usuarioId =
                ctx.userClaims?.id ??
                ctx.jwtClaims?.sub;


            if (!usuarioId) {
                return Response.json(
                    {
                        ok: false,
                        erro:
                            "Usuário não identificado.",
                    },
                    { status: 401 },
                );
            }


            /* =====================================================
               1. ENTRADA
               ===================================================== */

            let corpo: any;

            try {
                corpo =
                    await req.json();
            } catch {
                return Response.json(
                    {
                        ok: false,
                        erro:
                            "Corpo da requisição inválido.",
                    },
                    { status: 400 },
                );
            }


            const pagamentoId =
                typeof corpo
                    ?.pagamentoId ===
                    "string"
                    ? corpo
                        .pagamentoId
                        .trim()
                    : "";


            if (
                !pagamentoId ||
                !uuidValido(
                    pagamentoId,
                )
            ) {
                return Response.json(
                    {
                        ok: false,
                        erro:
                            "Pagamento proporcional inválido.",
                    },
                    { status: 400 },
                );
            }


            const accessToken =
                Deno.env.get(
                    "MERCADO_PAGO_ACCESS_TOKEN",
                );


            if (!accessToken) {
                console.error(
                    "MERCADO_PAGO_ACCESS_TOKEN não configurado.",
                );

                return Response.json(
                    {
                        ok: false,
                        erro:
                            "Pagamento temporariamente indisponível.",
                    },
                    { status: 500 },
                );
            }


            const bancoAdmin =
                ctx.supabaseAdmin
                    .schema(
                        "biblia_slides",
                    );


            /* =====================================================
               2. PAGAMENTO PROPORCIONAL
               ===================================================== */

            const {
                data: pagamento,
                error: erroPagamento,
            } =
                await bancoAdmin
                    .from(
                        "pagamentos",
                    )
                    .select(`
            id,
            usuario_id,
            provedor,
            status,
            valor,
            moeda,
            referencia_externa,
            pagamento_provedor_id,
            ordem_provedor_id,
            pago_em,
            finalidade,
            plano_armazenamento_id,
            efeito_aplicado_em
          `)
                    .eq(
                        "id",
                        pagamentoId,
                    )
                    .maybeSingle();


            if (
                erroPagamento ||
                !pagamento
            ) {
                console.error(
                    "Pagamento proporcional não encontrado:",
                    erroPagamento,
                );

                return Response.json(
                    {
                        ok: false,
                        erro:
                            "Pagamento proporcional não encontrado.",
                    },
                    { status: 404 },
                );
            }


            if (
                pagamento.usuario_id !==
                usuarioId
            ) {
                return Response.json(
                    {
                        ok: false,
                        erro:
                            "Este pagamento não pertence à sua conta.",
                    },
                    { status: 403 },
                );
            }

            /*
 * =====================================================
 * CANCELAMENTO AGENDADO X UPGRADE EM FINALIZAÇÃO
 *
 * Se o efeito já foi aplicado, deixamos o fluxo
 * idempotente continuar normalmente.
 * =====================================================
 */

            if (!pagamento.efeito_aplicado_em) {


                /*
 * =====================================================
 * INADIMPLÊNCIA ABERTA X UPGRADE EM FINALIZAÇÃO
 *
 * Se o efeito já tiver sido aplicado, este bloco
 * nem é executado e o retry continua idempotente.
 * =====================================================
 */

                const {
                    data: inadimplenciaAberta,
                    error: erroInadimplenciaAberta,
                } =
                    await bancoAdmin
                        .from(
                            "inadimplencias_armazenamento",
                        )
                        .select(`
                            id,
                            status,
                            pagamento_autorizado_id,
                            aberta_em
                        `)
                        .eq(
                            "usuario_id",
                            usuarioId,
                        )
                        .eq(
                            "status",
                            "ABERTA",
                        )
                        .limit(1)
                        .maybeSingle();


                if (erroInadimplenciaAberta) {
                    console.error(
                        "Erro ao verificar inadimplência durante upgrade:",
                        erroInadimplenciaAberta,
                    );

                    return Response.json(
                        {
                            ok: false,

                            erro:
                                "Não foi possível verificar o estado da cobrança.",
                        },
                        {
                            status: 500,
                        },
                    );
                }


                if (inadimplenciaAberta) {
                    return Response.json(
                        {
                            ok: false,

                            erro:
                                "Existe uma cobrança mensal em nova tentativa. Aguarde a confirmação do pagamento antes de alterar seu plano.",

                            codigo:
                                "INADIMPLENCIA_ABERTA",

                            inadimplencia:
                                true,
                        },
                        {
                            status: 409,
                        },
                    );
                }


                const {
                    data: cancelamentoAtivo,
                    error: erroCancelamentoAtivo,
                } =
                    await bancoAdmin
                        .from(
                            "cancelamentos_armazenamento_agendados",
                        )
                        .select(`
                id,
                status,
                efetivar_em
            `)
                        .eq(
                            "usuario_id",
                            usuarioId,
                        )
                        .in(
                            "status",
                            [
                                "AGENDADO",
                                "PROCESSANDO",
                                "FALHOU",
                            ],
                        )
                        .maybeSingle();


                if (erroCancelamentoAtivo) {
                    console.error(
                        "Erro ao verificar cancelamento durante upgrade:",
                        erroCancelamentoAtivo,
                    );

                    return Response.json(
                        {
                            ok: false,
                            erro:
                                "Não foi possível verificar o estado da assinatura.",
                        },
                        { status: 500 },
                    );
                }


                if (cancelamentoAtivo) {
                    return Response.json(
                        {
                            ok: false,
                            erro:
                                "Este upgrade não pode ser aplicado enquanto houver cancelamento da assinatura em andamento.",
                        },
                        { status: 409 },
                    );
                }
            }


            if (
                pagamento.provedor !==
                "MERCADO_PAGO"
            ) {
                return Response.json(
                    {
                        ok: false,
                        erro:
                            "Provedor de pagamento inválido.",
                    },
                    { status: 409 },
                );
            }


            if (
                pagamento.finalidade !==
                "UPGRADE_ARMAZENAMENTO"
            ) {
                return Response.json(
                    {
                        ok: false,
                        erro:
                            "Este pagamento não pertence a um upgrade de armazenamento.",
                    },
                    { status: 409 },
                );
            }


            /*
       * =====================================================
       * PAGAMENTO AINDA PENDENTE?
       *
       * O retorno do navegador pode chegar antes
       * do webhook. Nesse caso consultamos a Order
       * exata do próprio pagamento.
       * =====================================================
       */

            if (
                pagamento.status !==
                "APROVADO"
            ) {
                if (
                    pagamento.status !==
                    "PENDENTE"
                ) {
                    return Response.json(
                        {
                            ok: false,
                            erro:
                                "O pagamento proporcional não está aprovado.",
                        },
                        { status: 409 },
                    );
                }


                const orderId =
                    typeof pagamento
                        .ordem_provedor_id ===
                        "string"
                        ? pagamento
                            .ordem_provedor_id
                            .trim()
                        : "";


                if (!orderId) {
                    return Response.json({
                        ok: false,
                        processando: true,
                        erro:
                            "O pagamento ainda está sendo preparado.",
                    });
                }


                const respostaOrder =
                    await fetch(
                        `https://api.mercadopago.com/v1/orders/${encodeURIComponent(
                            orderId,
                        )}`,
                        {
                            method:
                                "GET",

                            headers: {
                                Authorization:
                                    `Bearer ${accessToken}`,
                            },
                        },
                    );


                const order =
                    await respostaOrder
                        .json()
                        .catch(
                            () => null,
                        );


                if (!respostaOrder.ok) {
                    console.error(
                        "Erro ao consultar Order proporcional:",
                        {
                            status:
                                respostaOrder.status,

                            orderId,

                            resposta:
                                order,
                        },
                    );

                    return Response.json(
                        {
                            ok: false,
                            erro:
                                "Não foi possível confirmar o pagamento proporcional.",
                        },
                        { status: 502 },
                    );
                }


                if (
                    String(
                        order?.id ??
                        "",
                    ) !==
                    orderId
                ) {
                    return Response.json(
                        {
                            ok: false,
                            erro:
                                "A Order retornada pelo Mercado Pago é divergente.",
                        },
                        { status: 409 },
                    );
                }


                /*
                 * Ainda não creditou.
                 *
                 * Retornamos HTTP 200 para o frontend
                 * poder aguardar e tentar novamente sem
                 * tratar isso como erro definitivo.
                 */
                if (
                    order?.status !==
                    "processed" ||
                    order?.status_detail !==
                    "accredited"
                ) {
                    return Response.json({
                        ok: false,
                        processando: true,

                        status:
                            order?.status ??
                            null,

                        statusDetail:
                            order?.status_detail ??
                            null,

                        erro:
                            "O pagamento ainda está sendo confirmado pelo Mercado Pago.",
                    });
                }


                const referenciaOrder =
                    String(
                        order
                            ?.external_reference ??
                        "",
                    ).trim();


                if (
                    !referenciaOrder ||
                    referenciaOrder !==
                    pagamento
                        .referencia_externa
                ) {
                    return Response.json(
                        {
                            ok: false,
                            erro:
                                "A referência do pagamento está divergente.",
                        },
                        { status: 409 },
                    );
                }


                if (
                    !mesmoValor(
                        order?.total_amount,
                        pagamento.valor,
                    ) ||
                    !mesmoValor(
                        order?.total_paid_amount,
                        pagamento.valor,
                    )
                ) {
                    return Response.json(
                        {
                            ok: false,
                            erro:
                                "O valor pago é divergente do upgrade contratado.",
                        },
                        { status: 409 },
                    );
                }


                const pagamentosOrder =
                    Array.isArray(
                        order?.transactions
                            ?.payments,
                    )
                        ? order
                            .transactions
                            .payments
                        : [];


                const pagamentoCreditado =
                    pagamentosOrder.find(
                        (item: any) =>
                            item?.status ===
                            "processed" &&
                            item?.status_detail ===
                            "accredited",
                    );


                const pagamentoProvedorId =
                    pagamentoCreditado?.id
                        ? String(
                            pagamentoCreditado.id,
                        )
                        : "";


                if (!pagamentoProvedorId) {
                    return Response.json(
                        {
                            ok: false,
                            erro:
                                "O Mercado Pago não informou o pagamento creditado.",
                        },
                        { status: 409 },
                    );
                }


                const pagoEm =
                    order?.last_updated_date ??
                    new Date()
                        .toISOString();


                const {
                    error: erroConfirmacaoOrder,
                } =
                    await bancoAdmin.rpc(
                        "confirmar_ordem_processada",
                        {
                            p_referencia_externa:
                                pagamento
                                    .referencia_externa,

                            p_ordem_provedor_id:
                                orderId,

                            p_valor:
                                Number(
                                    order.total_amount,
                                ),

                            p_pagamento_provedor_id:
                                pagamentoProvedorId,

                            p_moeda:
                                "BRL",

                            p_pago_em:
                                pagoEm,
                        },
                    );


                if (erroConfirmacaoOrder) {
                    console.error(
                        "Erro ao confirmar Order proporcional:",
                        erroConfirmacaoOrder,
                    );

                    return Response.json(
                        {
                            ok: false,
                            erro:
                                "O pagamento foi identificado, mas não pôde ser confirmado.",
                        },
                        { status: 500 },
                    );
                }

                /*
 * A RPC já atualizou o banco.
 * Atualizamos também o objeto que esta
 * execução já tinha carregado.
 */
                pagamento.status =
                    "APROVADO";

                pagamento.pagamento_provedor_id =
                    pagamentoProvedorId;

                pagamento.pago_em =
                    pagoEm;

                pagamento.ordem_provedor_id =
                    orderId;
            }


            if (
                String(
                    pagamento.moeda ??
                    "",
                ).toUpperCase() !==
                "BRL"
            ) {
                return Response.json(
                    {
                        ok: false,
                        erro:
                            "Moeda do pagamento proporcional inválida.",
                    },
                    { status: 409 },
                );
            }


            const valorPago =
                numero(
                    pagamento.valor,
                );


            if (
                valorPago === null ||
                valorPago <= 0
            ) {
                return Response.json(
                    {
                        ok: false,
                        erro:
                            "Valor do pagamento proporcional inválido.",
                    },
                    { status: 409 },
                );
            }


            if (
                !pagamento
                    .plano_armazenamento_id
            ) {
                return Response.json(
                    {
                        ok: false,
                        erro:
                            "Pagamento sem plano de destino.",
                    },
                    { status: 409 },
                );
            }


            /*
             * Um pagamento APROVADO por Order precisa
             * possuir os vínculos da cobrança.
             */
            if (
                !pagamento
                    .ordem_provedor_id ||
                !pagamento
                    .pagamento_provedor_id ||
                !pagamento
                    .pago_em
            ) {
                return Response.json(
                    {
                        ok: false,
                        erro:
                            "O pagamento está aprovado localmente, mas os dados do Mercado Pago estão incompletos.",
                    },
                    { status: 409 },
                );
            }


            /* =====================================================
               3. PLANO DE DESTINO
               ===================================================== */

            const {
                data: planoDestino,
                error: erroPlanoDestino,
            } =
                await bancoAdmin
                    .from(
                        "planos_armazenamento",
                    )
                    .select(`
            id,
            codigo,
            nome,
            limite_bytes,
            preco,
            tipo_cobranca,
            ativo
          `)
                    .eq(
                        "id",
                        pagamento
                            .plano_armazenamento_id,
                    )
                    .eq(
                        "ativo",
                        true,
                    )
                    .eq(
                        "tipo_cobranca",
                        "MENSAL",
                    )
                    .maybeSingle();


            if (
                erroPlanoDestino ||
                !planoDestino
            ) {
                console.error(
                    "Plano de destino não encontrado:",
                    erroPlanoDestino,
                );

                return Response.json(
                    {
                        ok: false,
                        erro:
                            "Plano de destino não encontrado.",
                    },
                    { status: 409 },
                );
            }


            const precoDestino =
                numero(
                    planoDestino.preco,
                );


            if (
                precoDestino === null ||
                precoDestino <= 0
            ) {
                return Response.json(
                    {
                        ok: false,
                        erro:
                            "Preço do plano de destino inválido.",
                    },
                    { status: 500 },
                );
            }


            /* =====================================================
               4. ARMAZENAMENTO ATUAL
               ===================================================== */

            const {
                data: armazenamento,
                error: erroArmazenamento,
            } =
                await bancoAdmin
                    .from(
                        "armazenamento_usuarios",
                    )
                    .select(`
            id,
            plano_id,
            status,
            provedor,
            provedor_assinatura_id,
            preco_mensal_contratado,
            proximo_vencimento_em
          `)
                    .eq(
                        "usuario_id",
                        usuarioId,
                    )
                    .eq(
                        "status",
                        "ATIVA",
                    )
                    .maybeSingle();


            if (
                erroArmazenamento ||
                !armazenamento
            ) {
                console.error(
                    "Armazenamento ativo não encontrado:",
                    erroArmazenamento,
                );

                return Response.json(
                    {
                        ok: false,
                        erro:
                            "Assinatura de armazenamento ativa não encontrada.",
                    },
                    { status: 409 },
                );
            }


            if (
                armazenamento.provedor !==
                "MERCADO_PAGO"
            ) {
                return Response.json(
                    {
                        ok: false,
                        erro:
                            "Esta assinatura não pode ser alterada por este fluxo.",
                    },
                    { status: 409 },
                );
            }


            const preapprovalId =
                typeof armazenamento
                    .provedor_assinatura_id ===
                    "string"
                    ? armazenamento
                        .provedor_assinatura_id
                        .trim()
                    : "";


            if (!preapprovalId) {
                return Response.json(
                    {
                        ok: false,
                        erro:
                            "Assinatura do Mercado Pago não identificada.",
                    },
                    { status: 409 },
                );
            }


            /* =====================================================
               5. PLANO ATUAL
               ===================================================== */

            const {
                data: planoAtual,
                error: erroPlanoAtual,
            } =
                await bancoAdmin
                    .from(
                        "planos_armazenamento",
                    )
                    .select(`
            id,
            codigo,
            nome,
            limite_bytes,
            preco
          `)
                    .eq(
                        "id",
                        armazenamento.plano_id,
                    )
                    .maybeSingle();


            if (
                erroPlanoAtual ||
                !planoAtual
            ) {
                console.error(
                    "Plano atual não encontrado:",
                    erroPlanoAtual,
                );

                return Response.json(
                    {
                        ok: false,
                        erro:
                            "Plano atual não encontrado.",
                    },
                    { status: 409 },
                );
            }


            const precoAnterior =
                numero(
                    armazenamento
                        .preco_mensal_contratado ??
                    planoAtual.preco,
                );


            if (
                precoAnterior === null ||
                precoAnterior <= 0
            ) {
                return Response.json(
                    {
                        ok: false,
                        erro:
                            "Preço atual da assinatura inválido.",
                    },
                    { status: 409 },
                );
            }


            /* =====================================================
               6. ASSINATURA LOCAL DO PROVEDOR
               ===================================================== */

            const {
                data: assinaturaLocal,
                error: erroAssinaturaLocal,
            } =
                await bancoAdmin
                    .from(
                        "assinaturas_armazenamento_provedor",
                    )
                    .select(`
            id,
            usuario_id,
            plano_id,
            armazenamento_id,
            provedor,
            referencia_externa,
            preapproval_id,
            status,
            preco_mensal,
            usar_credito_base
          `)
                    .eq(
                        "usuario_id",
                        usuarioId,
                    )
                    .eq(
                        "preapproval_id",
                        preapprovalId,
                    )
                    .eq(
                        "provedor",
                        "MERCADO_PAGO",
                    )
                    .maybeSingle();


            if (
                erroAssinaturaLocal ||
                !assinaturaLocal
            ) {
                console.error(
                    "Assinatura local do provedor não encontrada:",
                    erroAssinaturaLocal,
                );

                return Response.json(
                    {
                        ok: false,
                        erro:
                            "Assinatura do Mercado Pago não encontrada localmente.",
                    },
                    { status: 409 },
                );
            }


            if (
                assinaturaLocal.status !==
                "AUTORIZADA"
            ) {
                return Response.json(
                    {
                        ok: false,
                        erro:
                            "A assinatura precisa estar autorizada.",
                    },
                    { status: 409 },
                );
            }


            if (
                assinaturaLocal
                    .armazenamento_id !==
                armazenamento.id
            ) {
                return Response.json(
                    {
                        ok: false,
                        erro:
                            "O vínculo entre assinatura e armazenamento está divergente.",
                    },
                    { status: 409 },
                );
            }


            /* =====================================================
               7. IDEMPOTÊNCIA LOCAL
               ===================================================== */

            const efeitoJaAplicado =
                Boolean(
                    pagamento
                        .efeito_aplicado_em,
                );


            if (efeitoJaAplicado) {
                if (
                    armazenamento.plano_id !==
                    planoDestino.id ||
                    assinaturaLocal.plano_id !==
                    planoDestino.id ||
                    !mesmoValor(
                        armazenamento
                            .preco_mensal_contratado,
                        precoDestino,
                    ) ||
                    !mesmoValor(
                        assinaturaLocal
                            .preco_mensal,
                        precoDestino,
                    )
                ) {
                    return Response.json(
                        {
                            ok: false,
                            erro:
                                "O pagamento já foi utilizado, mas o estado local da assinatura precisa ser reconciliado.",

                            requerReconciliacao:
                                true,
                        },
                        { status: 409 },
                    );
                }
            } else {
                /*
                 * Ainda não aplicado:
                 * o plano de destino obrigatoriamente
                 * precisa ser maior que o atual.
                 */
                if (
                    armazenamento.plano_id ===
                    planoDestino.id
                ) {
                    return Response.json(
                        {
                            ok: false,
                            erro:
                                "O plano de destino já está ativo, mas o pagamento ainda não está marcado como aplicado.",

                            requerReconciliacao:
                                true,
                        },
                        { status: 409 },
                    );
                }


                if (
                    Number(
                        planoDestino
                            .limite_bytes,
                    ) <=
                    Number(
                        planoAtual
                            .limite_bytes,
                    )
                ) {
                    return Response.json(
                        {
                            ok: false,
                            erro:
                                "O plano de destino precisa possuir espaço superior ao plano atual.",
                        },
                        { status: 409 },
                    );
                }


                if (
                    assinaturaLocal.plano_id !==
                    planoAtual.id
                ) {
                    return Response.json(
                        {
                            ok: false,
                            erro:
                                "O plano registrado na assinatura está divergente.",
                        },
                        { status: 409 },
                    );
                }


                if (
                    !mesmoValor(
                        assinaturaLocal
                            .preco_mensal,
                        precoAnterior,
                    )
                ) {
                    return Response.json(
                        {
                            ok: false,
                            erro:
                                "O preço local da assinatura está divergente.",
                        },
                        { status: 409 },
                    );
                }
            }


            /* =====================================================
               8. CONSULTA MERCADO PAGO
               ===================================================== */

            async function consultarMP() {
                const resposta =
                    await fetch(
                        `https://api.mercadopago.com/preapproval/${encodeURIComponent(
                            preapprovalId,
                        )}`,
                        {
                            method:
                                "GET",

                            headers: {
                                Authorization:
                                    `Bearer ${accessToken}`,
                            },
                        },
                    );


                const json =
                    await resposta
                        .json()
                        .catch(
                            () => null,
                        );


                return {
                    resposta,
                    json,
                };
            }


            const consultaInicial =
                await consultarMP();


            if (
                !consultaInicial
                    .resposta.ok
            ) {
                console.error(
                    "Erro ao consultar preapproval:",
                    {
                        status:
                            consultaInicial
                                .resposta.status,

                        resposta:
                            consultaInicial.json,
                    },
                );

                return Response.json(
                    {
                        ok: false,
                        erro:
                            "Não foi possível consultar a assinatura no Mercado Pago.",
                    },
                    { status: 502 },
                );
            }


            const assinaturaMP =
                consultaInicial.json;


            if (
                assinaturaMP?.id !==
                preapprovalId
            ) {
                return Response.json(
                    {
                        ok: false,
                        erro:
                            "A assinatura retornada pelo Mercado Pago é divergente.",
                    },
                    { status: 409 },
                );
            }


            if (
                !statusMpAutorizado(
                    assinaturaMP
                        ?.status,
                )
            ) {
                return Response.json(
                    {
                        ok: false,
                        erro:
                            "A assinatura não está autorizada no Mercado Pago.",
                    },
                    { status: 409 },
                );
            }


            if (
                String(
                    assinaturaMP
                        ?.auto_recurring
                        ?.currency_id ??
                    "",
                )
                    .trim()
                    .toUpperCase() !==
                "BRL"
            ) {
                return Response.json(
                    {
                        ok: false,
                        erro:
                            "Moeda da assinatura divergente.",
                    },
                    { status: 409 },
                );
            }


            const referenciaMP =
                String(
                    assinaturaMP
                        ?.external_reference ??
                    "",
                ).trim();


            const referenciaLocal =
                String(
                    assinaturaLocal
                        .referencia_externa ??
                    "",
                ).trim();


            if (
                !referenciaLocal ||
                referenciaMP !==
                referenciaLocal
            ) {
                return Response.json(
                    {
                        ok: false,
                        erro:
                            "A referência da assinatura no Mercado Pago está divergente.",
                    },
                    { status: 409 },
                );
            }


            const precoAtualMP =
                numero(
                    assinaturaMP
                        ?.auto_recurring
                        ?.transaction_amount,
                );


            if (
                precoAtualMP === null
            ) {
                return Response.json(
                    {
                        ok: false,
                        erro:
                            "O Mercado Pago não retornou o valor atual da assinatura.",
                    },
                    { status: 502 },
                );
            }


            /*
             * Pagamento já utilizado:
             * tudo deve estar no plano novo.
             */
            if (efeitoJaAplicado) {
                if (
                    !mesmoValor(
                        precoAtualMP,
                        precoDestino,
                    )
                ) {
                    return Response.json(
                        {
                            ok: false,
                            erro:
                                "O upgrade está aplicado localmente, mas o valor da assinatura no Mercado Pago está divergente.",

                            requerReconciliacao:
                                true,
                        },
                        { status: 409 },
                    );
                }


                return Response.json({
                    ok: true,
                    reutilizado: true,
                    jaAplicado: true,

                    pagamentoId:
                        pagamento.id,

                    armazenamentoId:
                        armazenamento.id,

                    planoOrigem:
                        planoDestino.codigo,

                    planoDestino:
                        planoDestino.codigo,

                    precoNovo:
                        precoDestino,

                    proximoVencimentoEm:
                        armazenamento
                            .proximo_vencimento_em,
                });
            }


            /*
             * Antes da aplicação local o MP pode:
             *
             * A) ainda estar no preço anterior;
             * B) já estar no destino por causa de
             *    uma tentativa anterior interrompida.
             */
            const mpJaNoDestino =
                mesmoValor(
                    precoAtualMP,
                    precoDestino,
                );


            if (
                !mpJaNoDestino &&
                !mesmoValor(
                    precoAtualMP,
                    precoAnterior,
                )
            ) {
                return Response.json(
                    {
                        ok: false,
                        erro:
                            "O valor atual da assinatura no Mercado Pago está diferente do esperado. Faça a reconciliação antes de continuar.",

                        requerReconciliacao:
                            true,
                    },
                    { status: 409 },
                );
            }


            /* =====================================================
               9. ALTERA A MENSALIDADE NO MP
               ===================================================== */

            let alterouMercadoPago =
                false;


            if (!mpJaNoDestino) {
                const respostaAlteracao =
                    await fetch(
                        `https://api.mercadopago.com/preapproval/${encodeURIComponent(
                            preapprovalId,
                        )}`,
                        {
                            method:
                                "PUT",

                            headers: {
                                Authorization:
                                    `Bearer ${accessToken}`,

                                "Content-Type":
                                    "application/json",
                            },

                            body:
                                JSON.stringify({
                                    auto_recurring: {
                                        transaction_amount:
                                            precoDestino,

                                        currency_id:
                                            "BRL",
                                    },
                                }),
                        },
                    );


                const retornoAlteracao =
                    await respostaAlteracao
                        .json()
                        .catch(
                            () => null,
                        );


                if (
                    !respostaAlteracao.ok
                ) {
                    console.error(
                        "Erro ao alterar assinatura no Mercado Pago:",
                        {
                            status:
                                respostaAlteracao
                                    .status,

                            resposta:
                                retornoAlteracao,
                        },
                    );

                    return Response.json(
                        {
                            ok: false,
                            erro:
                                "O Mercado Pago não conseguiu alterar o valor da assinatura.",
                        },
                        { status: 502 },
                    );
                }


                alterouMercadoPago =
                    true;


                /*
                 * Não confiamos somente na resposta
                 * do PUT. Consultamos novamente.
                 */
                const confirmacaoMP =
                    await consultarMP();


                if (
                    !confirmacaoMP
                        .resposta.ok ||
                    confirmacaoMP
                        .json?.id !==
                    preapprovalId ||
                    !statusMpAutorizado(
                        confirmacaoMP
                            .json?.status,
                    ) ||
                    String(
                        confirmacaoMP
                            .json
                            ?.auto_recurring
                            ?.currency_id ??
                        "",
                    )
                        .toUpperCase() !==
                    "BRL" ||
                    !mesmoValor(
                        confirmacaoMP
                            .json
                            ?.auto_recurring
                            ?.transaction_amount,
                        precoDestino,
                    )
                ) {
                    console.error(
                        "Novo valor não foi confirmado no Mercado Pago.",
                        {
                            preapprovalId,
                        },
                    );


                    /*
                     * O PUT respondeu, mas a confirmação
                     * falhou. Tentamos restaurar.
                     */
                    try {
                        await fetch(
                            `https://api.mercadopago.com/preapproval/${encodeURIComponent(
                                preapprovalId,
                            )}`,
                            {
                                method:
                                    "PUT",

                                headers: {
                                    Authorization:
                                        `Bearer ${accessToken}`,

                                    "Content-Type":
                                        "application/json",
                                },

                                body:
                                    JSON.stringify({
                                        auto_recurring: {
                                            transaction_amount:
                                                precoAnterior,

                                            currency_id:
                                                "BRL",
                                        },
                                    }),
                            },
                        );
                    } catch {
                        // reconciliado manualmente se necessário
                    }


                    return Response.json(
                        {
                            ok: false,
                            erro:
                                "O Mercado Pago não confirmou o novo valor da assinatura.",

                            requerReconciliacao:
                                true,
                        },
                        { status: 502 },
                    );
                }
            }


            /* =====================================================
               10. APLICA UPGRADE LOCAL
               ===================================================== */

            const {
                data: resultado,
                error: erroUpgrade,
            } =
                await bancoAdmin
                    .rpc(
                        "aplicar_upgrade_assinatura_armazenamento",
                        {
                            p_usuario_id:
                                usuarioId,

                            p_preapproval_id:
                                preapprovalId,

                            p_plano_destino_codigo:
                                planoDestino.codigo,

                            p_pagamento_id:
                                pagamentoId,
                        },
                    )
                    .single();


            if (
                erroUpgrade ||
                !resultado?.ok
            ) {
                console.error(
                    "Erro ao aplicar upgrade local:",
                    erroUpgrade,
                );


                /*
                 * Se fomos nós que alteramos o MP
                 * nesta execução, tentamos rollback.
                 */
                let rollbackMercadoPago:
                    boolean | null =
                    null;


                if (alterouMercadoPago) {
                    try {
                        const respostaRollback =
                            await fetch(
                                `https://api.mercadopago.com/preapproval/${encodeURIComponent(
                                    preapprovalId,
                                )}`,
                                {
                                    method:
                                        "PUT",

                                    headers: {
                                        Authorization:
                                            `Bearer ${accessToken}`,

                                        "Content-Type":
                                            "application/json",
                                    },

                                    body:
                                        JSON.stringify({
                                            auto_recurring: {
                                                transaction_amount:
                                                    precoAnterior,

                                                currency_id:
                                                    "BRL",
                                            },
                                        }),
                                },
                            );


                        if (
                            respostaRollback.ok
                        ) {
                            const confirmacaoRollback =
                                await consultarMP();


                            rollbackMercadoPago =
                                confirmacaoRollback
                                    .resposta.ok &&
                                mesmoValor(
                                    confirmacaoRollback
                                        .json
                                        ?.auto_recurring
                                        ?.transaction_amount,
                                    precoAnterior,
                                );
                        } else {
                            rollbackMercadoPago =
                                false;
                        }

                    } catch (
                    erroRollback
                    ) {
                        rollbackMercadoPago =
                            false;

                        console.error(
                            "Erro ao tentar rollback no Mercado Pago:",
                            erroRollback,
                        );
                    }
                }


                /*
                 * Se o MP já estava no destino antes
                 * desta execução, não fazemos rollback:
                 * uma nova tentativa pode concluir o
                 * estado local com o mesmo pagamento.
                 */
                return Response.json(
                    {
                        ok: false,

                        erro:
                            rollbackMercadoPago ===
                                false
                                ? "O upgrade não foi concluído e a assinatura precisa ser reconciliada."
                                : "Não foi possível concluir o upgrade de armazenamento.",

                        requerReconciliacao:
                            rollbackMercadoPago ===
                            false,

                        podeTentarNovamente:
                            !alterouMercadoPago,
                    },
                    { status: 500 },
                );
            }


            /* =====================================================
               11. SUCESSO
               ===================================================== */

            return Response.json({
                ok: true,

                reutilizado:
                    mpJaNoDestino,

                pagamentoId,

                armazenamentoId:
                    resultado
                        .armazenamento_id,

                planoOrigem:
                    resultado
                        .plano_origem_codigo,

                planoDestino:
                    resultado
                        .plano_destino_codigo,

                precoAnterior:
                    numero(
                        resultado
                            .preco_anterior,
                    ),

                precoNovo:
                    numero(
                        resultado
                            .preco_novo,
                    ),

                proximoVencimentoEm:
                    resultado
                        .proximo_vencimento_em,

                snapshotSaidaId:
                    resultado
                        .snapshot_saida_id,
            });
        },
    ),
};
