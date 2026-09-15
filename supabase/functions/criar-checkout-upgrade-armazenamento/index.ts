import { withSupabase } from "npm:@supabase/server@^1";


function paraCentavos(
  valor: unknown,
) {
  const numero =
    Number(valor);

  if (
    !Number.isFinite(numero)
  ) {
    return null;
  }

  return Math.round(
    numero * 100,
  );
}


function obterBaseApp(
  req: Request,
) {
  const configurada =
    Deno.env.get(
      "APP_URL",
    )?.trim();

  const origem =
    req.headers
      .get("origin")
      ?.trim();

  const candidata =
    configurada ||
    origem ||
    "";

  try {
    const url =
      new URL(candidata);

    if (
      url.protocol !== "https:" &&
      url.protocol !== "http:"
    ) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}


function montarRetorno(
  base: string,
  status: string,
  pagamentoId: string,
) {
  const url =
    new URL("/", base);

  url.searchParams.set(
    "upgrade",
    status,
  );

  url.searchParams.set(
    "pagamento",
    pagamentoId,
  );

  return url.toString();
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


      const planoCodigo =
        typeof corpo
          ?.planoCodigo ===
          "string"
          ? corpo
            .planoCodigo
            .trim()
          : "";


      if (!planoCodigo) {
        return Response.json(
          {
            ok: false,
            erro:
              "Plano não informado.",
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


      const baseApp =
        obterBaseApp(req);


      if (!baseApp) {
        console.error(
          "APP_URL/origin não disponível.",
        );

        return Response.json(
          {
            ok: false,
            erro:
              "URL de retorno não configurada.",
          },
          { status: 500 },
        );
      }


      const bancoAdmin =
        ctx.supabaseAdmin
          .schema(
            "biblia_slides",
          );

      /*
* =====================================================
* BLOQUEIO: INADIMPLÊNCIA EM RECUPERAÇÃO
*
* Enquanto uma mensalidade estiver em recycling,
* o plano atual continua disponível, mas nenhuma
* nova alteração de plano pode ser iniciada.
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
          "Erro ao verificar inadimplência antes do upgrade:",
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

      /*
* =====================================================
* BLOQUEIO: CANCELAMENTO DA ASSINATURA EM ANDAMENTO
* =====================================================
*/

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
          "Erro ao consultar cancelamento de armazenamento:",
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
              cancelamentoAtivo.status ===
                "FALHOU"
                ? "Existe um cancelamento que precisa ser reconciliado antes de alterar o plano."
                : "Sua assinatura está programada para encerrar. Mantenha a assinatura antes de fazer um upgrade.",
          },
          { status: 409 },
        );
      }


      /*
       * =====================================================
       * 1. RECALCULA O UPGRADE NO BACKEND
       * =====================================================
       *
       * Utilizamos o cliente autenticado.
       * auth.uid() dentro da RPC continua
       * sendo o usuário real.
       */

      const {
        data: simulacao,
        error: erroSimulacao,
      } =
        await ctx.supabase
          .schema(
            "biblia_slides",
          )
          .rpc(
            "simular_upgrade_armazenamento",
            {
              p_plano_codigo:
                planoCodigo,
            },
          )
          .single();


      if (
        erroSimulacao ||
        !simulacao
      ) {
        console.error(
          "Erro ao simular upgrade:",
          erroSimulacao,
        );

        return Response.json(
          {
            ok: false,
            erro:
              "Não foi possível calcular o upgrade.",
          },
          { status: 500 },
        );
      }


      if (
        simulacao.permitido !==
        true
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              simulacao.mensagem ||
              "Este upgrade não está disponível.",

            codigo:
              simulacao.codigo ??
              null,
          },
          { status: 409 },
        );
      }


      if (
        simulacao
          .tipo_operacao !==
        "UPGRADE_PROPORCIONAL"
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              "Este checkout é exclusivo para upgrades proporcionais.",
          },
          { status: 409 },
        );
      }


      if (
        simulacao
          .plano_codigo !==
        planoCodigo
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              "Plano calculado é divergente.",
          },
          { status: 409 },
        );
      }


      const valorAgora =
        Number(
          simulacao
            .valor_agora,
        );


      if (
        !Number.isFinite(
          valorAgora,
        ) ||
        valorAgora <= 0
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              "Valor proporcional inválido.",
          },
          { status: 409 },
        );
      }


      /*
       * =====================================================
       * 2. PLANO REAL DE DESTINO
       * =====================================================
       */

      const {
        data: planoDestino,
        error: erroPlano,
      } =
        await bancoAdmin
          .from(
            "planos_armazenamento",
          )
          .select(`
            id,
            codigo,
            nome,
            preco,
            limite_bytes,
            tipo_cobranca,
            ativo
          `)
          .eq(
            "codigo",
            planoCodigo,
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
        erroPlano ||
        !planoDestino
      ) {
        console.error(
          "Plano de destino não encontrado:",
          erroPlano,
        );

        return Response.json(
          {
            ok: false,
            erro:
              "Plano de destino não encontrado.",
          },
          { status: 404 },
        );
      }


      /*
       * =====================================================
       * 3. PROCURA UPGRADE PENDENTE
       * =====================================================
       *
       * Existe índice único por:
       *
       * usuario_id + provedor + finalidade
       *
       * enquanto status = PENDENTE.
       */

      async function buscarPendente() {
        return await bancoAdmin
          .from(
            "pagamentos",
          )
          .select(`
            id,
            referencia_externa,
            ordem_provedor_id,
            checkout_url,
            valor,
            moeda,
            finalidade,
            plano_armazenamento_id,
            created_at
          `)
          .eq(
            "usuario_id",
            usuarioId,
          )
          .eq(
            "provedor",
            "MERCADO_PAGO",
          )
          .eq(
            "finalidade",
            "UPGRADE_ARMAZENAMENTO",
          )
          .eq(
            "status",
            "PENDENTE",
          )
          .order(
            "created_at",
            {
              ascending:
                false,
            },
          )
          .limit(1)
          .maybeSingle();
      }


      let {
        data: pendente,
        error: erroPendente,
      } =
        await buscarPendente();


      if (erroPendente) {
        console.error(
          "Erro ao procurar upgrade pendente:",
          erroPendente,
        );

        return Response.json(
          {
            ok: false,
            erro:
              "Não foi possível verificar upgrades pendentes.",
          },
          { status: 500 },
        );
      }


      /*
       * Se já existe um checkout para outro
       * plano, não criamos uma segunda Order.
       *
       * Depois implementaremos cancelamento
       * explícito, se necessário.
       */
      if (
        pendente &&
        pendente
          .plano_armazenamento_id !==
        planoDestino.id
      ) {
        return Response.json(
          {
            ok: false,

            erro:
              "Já existe um upgrade pendente para outro plano. Conclua ou cancele esse checkout antes de escolher outro plano.",

            checkoutPendente:
              Boolean(
                pendente
                  .checkout_url,
              ),
          },
          { status: 409 },
        );
      }


      /*
       * Checkout já criado para o mesmo plano:
       * reutilizamos o valor congelado nele.
       */
      if (
        pendente
          ?.checkout_url &&
        pendente
          ?.ordem_provedor_id
      ) {
        return Response.json({
          ok: true,
          reutilizado: true,

          pagamentoId:
            pendente.id,

          orderId:
            pendente
              .ordem_provedor_id,

          referenciaExterna:
            pendente
              .referencia_externa,

          checkoutUrl:
            pendente
              .checkout_url,

          valor:
            Number(
              pendente.valor,
            ).toFixed(2),

          planoCodigo:
            planoDestino.codigo,

          planoNome:
            planoDestino.nome,

          proximoVencimentoEm:
            simulacao
              .proximo_vencimento_em,
        });
      }


      /*
       * =====================================================
       * 4. CRIA O PAGAMENTO LOCAL
       * =====================================================
       */

      let pagamentoId:
        string;

      let referenciaExterna:
        string;

      let valorCheckout:
        string;


      if (pendente) {
        pagamentoId =
          pendente.id;

        referenciaExterna =
          pendente
            .referencia_externa;

        valorCheckout =
          Number(
            pendente.valor,
          ).toFixed(2);

      } else {
        referenciaExterna =
          `BSUP_${crypto.randomUUID()}`;

        valorCheckout =
          valorAgora
            .toFixed(2);


        const {
          data: novoPagamento,
          error: erroPagamento,
        } =
          await bancoAdmin
            .from(
              "pagamentos",
            )
            .insert({
              usuario_id:
                usuarioId,

              provedor:
                "MERCADO_PAGO",

              status:
                "PENDENTE",

              valor:
                Number(
                  valorCheckout,
                ),

              moeda:
                "BRL",

              referencia_externa:
                referenciaExterna,

              finalidade:
                "UPGRADE_ARMAZENAMENTO",

              plano_armazenamento_id:
                planoDestino.id,
            })
            .select(`
              id,
              referencia_externa,
              valor
            `)
            .single();


        if (erroPagamento) {
          /*
           * Outra requisição pode ter
           * criado o mesmo tipo de
           * pendência simultaneamente.
           */
          if (
            erroPagamento.code ===
            "23505"
          ) {
            const resultado =
              await buscarPendente();


            if (
              resultado.error ||
              !resultado.data
            ) {
              console.error(
                "Erro após concorrência:",
                resultado.error,
              );

              return Response.json(
                {
                  ok: false,
                  erro:
                    "Não foi possível recuperar o upgrade em andamento.",
                },
                { status: 500 },
              );
            }


            pendente =
              resultado.data;


            if (
              pendente
                .plano_armazenamento_id !==
              planoDestino.id
            ) {
              return Response.json(
                {
                  ok: false,
                  erro:
                    "Já existe um upgrade pendente para outro plano.",
                },
                { status: 409 },
              );
            }


            pagamentoId =
              pendente.id;

            referenciaExterna =
              pendente
                .referencia_externa;

            valorCheckout =
              Number(
                pendente.valor,
              ).toFixed(2);

          } else {
            console.error(
              "Erro ao criar pagamento proporcional:",
              erroPagamento,
            );

            return Response.json(
              {
                ok: false,
                erro:
                  "Não foi possível iniciar o pagamento proporcional.",
              },
              { status: 500 },
            );
          }

        } else {
          pagamentoId =
            novoPagamento.id;

          referenciaExterna =
            novoPagamento
              .referencia_externa;

          valorCheckout =
            Number(
              novoPagamento.valor,
            ).toFixed(2);
        }
      }


      /*
       * =====================================================
       * 5. URLS DE RETORNO
       * =====================================================
       *
       * Incluímos o UUID local do pagamento.
       *
       * Assim o retorno sabe exatamente
       * qual upgrade deve ser reconciliado.
       */

      const successUrl =
        montarRetorno(
          baseApp,
          "aprovado",
          pagamentoId,
        );

      const failureUrl =
        montarRetorno(
          baseApp,
          "falhou",
          pagamentoId,
        );

      const pendingUrl =
        montarRetorno(
          baseApp,
          "pendente",
          pagamentoId,
        );


      /*
       * =====================================================
       * 6. ORDER MERCADO PAGO
       * =====================================================
       */

      const idempotencyKey =
        String(
          pagamentoId,
        );


      const respostaMP =
        await fetch(
          "https://api.mercadopago.com/v1/orders",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${accessToken}`,

              "X-Idempotency-Key":
                idempotencyKey,
            },

            body:
              JSON.stringify({
                type:
                  "online",

                total_amount:
                  valorCheckout,

                external_reference:
                  referenciaExterna,

                processing_mode:
                  "manual",

                config: {
                  online: {
                    success_url:
                      successUrl,

                    failure_url:
                      failureUrl,

                    pending_url:
                      pendingUrl,

                    auto_return:
                      "approved",
                  },
                },

                items: [
                  {
                    external_code:
                      `UPGRADE_${planoDestino.codigo}`,

                    title:
                      `Bíblia Slides - Upgrade para ${planoDestino.nome}`,

                    description:
                      `Diferença proporcional de armazenamento até o próximo vencimento`,

                    quantity:
                      1,

                    unit_price:
                      valorCheckout,
                  },
                ],
              }),
          },
        );


      const respostaJson =
        await respostaMP
          .json()
          .catch(
            () => null,
          );


      if (
        respostaMP.status ===
        423
      ) {
        return Response.json(
          {
            ok: false,
            processando: true,
            erro:
              "O checkout está sendo criado. Aguarde alguns segundos e tente novamente.",
          },
          { status: 409 },
        );
      }


      if (!respostaMP.ok) {
        console.error(
          "Mercado Pago recusou checkout proporcional:",
          {
            status:
              respostaMP.status,

            resposta:
              respostaJson,
          },
        );

        return Response.json(
          {
            ok: false,

            erro:
              "O Mercado Pago recusou a criação do pagamento proporcional.",
          },
          { status: 502 },
        );
      }


      const orderId =
        typeof respostaJson?.id ===
          "string"
          ? respostaJson.id
          : "";


      const checkoutUrl =
        typeof respostaJson
          ?.checkout_url ===
          "string"
          ? respostaJson
            .checkout_url
          : "";


      if (
        !orderId ||
        !checkoutUrl
      ) {
        console.error(
          "Resposta inesperada Mercado Pago:",
          respostaJson,
        );

        return Response.json(
          {
            ok: false,
            erro:
              "O Mercado Pago não retornou a URL do checkout.",
          },
          { status: 502 },
        );
      }


      /*
       * =====================================================
       * 7. VINCULA ORDER AO PAGAMENTO LOCAL
       * =====================================================
       */

      const {
        error: erroVinculo,
      } =
        await bancoAdmin
          .from(
            "pagamentos",
          )
          .update({
            ordem_provedor_id:
              orderId,

            checkout_url:
              checkoutUrl,

            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "id",
            pagamentoId,
          )
          .eq(
            "status",
            "PENDENTE",
          );


      if (erroVinculo) {
        console.error(
          "Erro ao vincular checkout proporcional:",
          erroVinculo,
        );

        return Response.json(
          {
            ok: false,
            erro:
              "Checkout criado, mas ocorreu um erro interno ao registrá-lo.",
          },
          { status: 500 },
        );
      }


      /*
       * =====================================================
       * 8. SUCESSO
       * =====================================================
       */

      return Response.json({
        ok: true,
        reutilizado: false,

        pagamentoId,

        orderId,

        referenciaExterna,

        checkoutUrl,

        valor:
          valorCheckout,

        planoCodigo:
          planoDestino.codigo,

        planoNome:
          planoDestino.nome,

        precoMensalNovo:
          Number(
            simulacao
              .preco_mensal,
          ),

        proximoVencimentoEm:
          simulacao
            .proximo_vencimento_em,

        diasRestantes:
          simulacao
            .dias_restantes,
      });
    },
  ),
};