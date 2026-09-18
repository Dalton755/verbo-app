import { withSupabase } from "npm:@supabase/server@^1";

const PRECO = "9.90";

// Versão: retorno Checkout Pro produção

export default {
  fetch: withSupabase(
    { auth: "user" },

    async (_req, ctx) => {
      const usuarioId =
        ctx.userClaims?.id ??
        ctx.jwtClaims?.sub;

      if (!usuarioId) {
        return Response.json(
          {
            ok: false,
            erro: "Usuário não identificado.",
          },
          { status: 401 },
        );
      }

      const accessToken =
        Deno.env.get(
          "MERCADO_PAGO_ACCESS_TOKEN"
        );

      if (!accessToken) {
        return Response.json(
          {
            ok: false,
            erro:
              "Credencial do Mercado Pago não configurada.",
          },
          { status: 500 },
        );
      }

      const banco =
        ctx.supabaseAdmin
          .schema("biblia_slides");

      // -----------------------------------------
      // 1. Verifica se já possui licença
      // -----------------------------------------

      const {
        data: licenca,
        error: erroLicenca,
      } =
        await banco
          .from("licencas")
          .select("status, expira_em")
          .eq("usuario_id", usuarioId)
          .maybeSingle();

      if (erroLicenca) {
        console.error(
          "Erro ao consultar licença:",
          erroLicenca
        );

        return Response.json(
          {
            ok: false,
            erro:
              "Não foi possível verificar a licença.",
          },
          { status: 500 },
        );
      }

      const licencaAtiva =
        licenca?.status === "ATIVA" &&
        (
          !licenca.expira_em ||
          new Date(
            licenca.expira_em
          ).getTime() > Date.now()
        );

      if (licencaAtiva) {
        return Response.json(
          {
            ok: false,
            erro:
              "Esta conta já possui uma licença ativa.",
          },
          { status: 409 },
        );
      }

      // -----------------------------------------
      // 2. Procura checkout PENDENTE existente
      // -----------------------------------------

      async function buscarPendente() {
        return await banco
          .from("pagamentos")
          .select(`
            id,
            referencia_externa,
            ordem_provedor_id,
            checkout_url,
            valor,
            moeda
          `)
          .eq("usuario_id", usuarioId)
          .eq("provedor", "MERCADO_PAGO")
          .eq("finalidade", "LICENCA_APP")
          .eq("status", "PENDENTE")
          .order(
            "created_at",
            { ascending: false }
          )
          .limit(1)
          .maybeSingle();
      }

      let {
        data: pendente,
        error: erroPendente,
      } = await buscarPendente();

      if (erroPendente) {
        console.error(
          "Erro ao procurar pagamento pendente:",
          erroPendente
        );

        return Response.json(
          {
            ok: false,
            erro:
              "Não foi possível verificar pagamentos pendentes.",
          },
          { status: 500 },
        );
      }

      /*
 * Se existir checkout antigo com preço
 * diferente do preço atual, ele não pode
 * ser reutilizado.
 */
      if (
        pendente &&
        (
          Number(pendente.valor).toFixed(2) !== PRECO ||
          String(
            pendente.moeda ?? ""
          ).toUpperCase() !== "BRL"
        )
      ) {
        const {
          error: erroCancelarPendente,
        } =
          await banco
            .from("pagamentos")
            .update({
              status: "CANCELADO",
              updated_at:
                new Date().toISOString(),
            })
            .eq("id", pendente.id)
            .eq("status", "PENDENTE")
            .eq(
              "finalidade",
              "LICENCA_APP"
            );

        if (erroCancelarPendente) {
          console.error(
            "Erro ao cancelar checkout antigo:",
            erroCancelarPendente
          );

          return Response.json(
            {
              ok: false,
              erro:
                "Não foi possível atualizar o checkout anterior.",
            },
            { status: 500 },
          );
        }

        pendente = null;
      }

      // Já temos checkout completo.
      // Apenas reutilizamos.
      if (
        pendente?.checkout_url &&
        pendente?.ordem_provedor_id
      ) {
        return Response.json({
          ok: true,
          reutilizado: true,

          pagamentoId:
            pendente.id,

          orderId:
            pendente.ordem_provedor_id,

          referenciaExterna:
            pendente.referencia_externa,

          checkoutUrl:
            pendente.checkout_url,

          valor:
            Number(
              pendente.valor
            ).toFixed(2),
        });
      }

      let pagamentoId;
      let referenciaExterna;
      let valorCheckout;

      // -----------------------------------------
      // 3. Se não existir pendente, cria um
      // -----------------------------------------

      if (pendente) {
        pagamentoId =
          pendente.id;

        referenciaExterna =
          pendente.referencia_externa;

        valorCheckout =
          Number(
            pendente.valor
          ).toFixed(2);
      } else {
        referenciaExterna =
          `BS_${crypto.randomUUID()}`;

        valorCheckout = PRECO;

        const {
          data: novoPagamentoId,
          error: erroPagamento,
        } =
          await banco.rpc(
            "criar_pagamento_pendente",
            {
              p_usuario_id:
                usuarioId,

              p_valor:
                Number(PRECO),

              p_referencia_externa:
                referenciaExterna,

              p_ordem_provedor_id:
                null,
            }
          );

        if (erroPagamento) {
          // Pode acontecer se duas chamadas
          // ocorrerem praticamente juntas.
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
                resultado.error
              );

              return Response.json(
                {
                  ok: false,
                  erro:
                    "Não foi possível recuperar o checkout em andamento.",
                },
                { status: 500 },
              );
            }

            pendente =
              resultado.data;

            if (
              pendente.checkout_url &&
              pendente.ordem_provedor_id
            ) {
              return Response.json({
                ok: true,
                reutilizado: true,

                pagamentoId:
                  pendente.id,

                orderId:
                  pendente.ordem_provedor_id,

                referenciaExterna:
                  pendente.referencia_externa,

                checkoutUrl:
                  pendente.checkout_url,

                valor:
                  Number(
                    pendente.valor
                  ).toFixed(2),
              });
            }

            pagamentoId =
              pendente.id;

            referenciaExterna =
              pendente.referencia_externa;

            valorCheckout =
              Number(
                pendente.valor
              ).toFixed(2);
          } else {
            console.error(
              "Erro ao criar pagamento pendente:",
              erroPagamento
            );

            return Response.json(
              {
                ok: false,
                erro:
                  "Não foi possível iniciar o pagamento.",
              },
              { status: 500 },
            );
          }
        } else {
          pagamentoId =
            novoPagamentoId;
        }
      }

      // O UUID do pagamento local é estável.
      // Repetições usarão a MESMA
      // X-Idempotency-Key.
      const idempotencyKey =
        String(pagamentoId);

      // -----------------------------------------
      // 4. Cria/reutiliza Order no Mercado Pago
      // -----------------------------------------

      const respostaMP =
        await fetch(
          "https://api.mercadopago.com/v1/orders",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${accessToken}`,

              "X-Idempotency-Key":
                idempotencyKey,
            },

            body: JSON.stringify({
              type: "online",

              total_amount:
                valorCheckout,

              external_reference:
                referenciaExterna,

              processing_mode:
                "manual",

              config: {
                online: {
                  success_url:
                    "https://verbo.nethanel.com.br/acesso?pagamento=aprovado",

                  failure_url:
                    "https://verbo.nethanel.com.br/acesso?pagamento=falhou",

                  pending_url:
                    "https://verbo.nethanel.com.br/acesso?pagamento=pendente",

                  auto_return:
                    "approved",
                },
              },

              items: [
                {
                  external_code:
                    "BIBLIA_SLIDES_VITALICIO",

                  title:
                    "Apresentações Bíblicas - Acesso vitalício",

                  description:
                    "Licença vitalícia do aplicativo Apresentações Bíblicas",

                  quantity: 1,

                  unit_price:
                    valorCheckout,
                },
              ],
            }),
          }
        );

      const respostaJson =
        await respostaMP.json();

      // Outra chamada pode estar usando
      // a mesma chave neste exato momento.
      if (respostaMP.status === 423) {
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
          "Mercado Pago:",
          respostaJson
        );

        return Response.json(
          {
            ok: false,

            erro:
              "O Mercado Pago recusou a criação do checkout.",

            status:
              respostaMP.status,

            detalhe:
              respostaJson,
          },
          { status: 502 },
        );
      }

      const orderId =
        respostaJson.id;

      const checkoutUrl =
        respostaJson.checkout_url;

      if (
        !orderId ||
        !checkoutUrl
      ) {
        console.error(
          "Resposta inesperada Mercado Pago:",
          respostaJson
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

      // -----------------------------------------
      // 5. Salva Order + checkout URL
      // -----------------------------------------

      const {
        error: erroVinculo,
      } =
        await banco
          .from("pagamentos")
          .update({
            ordem_provedor_id:
              orderId,

            checkout_url:
              checkoutUrl,

            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            pagamentoId
          );

      if (erroVinculo) {
        console.error(
          "Erro ao vincular checkout:",
          erroVinculo
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

      return Response.json({
        ok: true,
        reutilizado: false,

        pagamentoId,

        orderId,

        referenciaExterna,

        checkoutUrl,

        valor:
          valorCheckout,
      });
    },
  ),
};