import { withSupabase } from "npm:@supabase/server@^1";

function paraCentavos(
  valor: unknown,
) {
  const numero =
    Number(valor);

  if (
    !Number.isFinite(numero) ||
    numero < 0
  ) {
    return null;
  }

  return Math.round(
    numero * 100,
  );
}

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
            erro:
              "Usuário não identificado.",
          },
          { status: 401 },
        );
      }


      const accessToken =
        Deno.env.get(
          "MERCADO_PAGO_ACCESS_TOKEN",
        );


      if (!accessToken) {
        return Response.json(
          {
            ok: false,
            erro:
              "Mercado Pago não configurado.",
          },
          { status: 500 },
        );
      }


      const banco =
        ctx.supabaseAdmin
          .schema(
            "biblia_slides",
          );


      /*
       * Busca a assinatura mais recente
       * ainda sem armazenamento ativado.
       */
      const {
        data: assinatura,
        error: erroAssinatura,
      } =
        await banco
          .from(
            "assinaturas_armazenamento_provedor",
          )
          .select(`
            id,
            usuario_id,
            plano_id,
            preapproval_id,
            referencia_externa,
            status,
            preco_mensal,
            usar_credito_base,
            autorizada_em,
            armazenamento_id
          `)
          .eq(
            "usuario_id",
            usuarioId,
          )
          .not(
            "preapproval_id",
            "is",
            null,
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


      if (
        erroAssinatura ||
        !assinatura
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              "Nenhuma assinatura de armazenamento encontrada.",
          },
          { status: 404 },
        );
      }


      const preapprovalId =
        assinatura
          .preapproval_id;


      const respostaMP =
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


      let assinaturaMP: any =
        null;


      try {
        assinaturaMP =
          await respostaMP
            .json();
      } catch {
        assinaturaMP =
          null;
      }


      if (!respostaMP.ok) {
        console.error(
          "Erro ao consultar preapproval:",
          {
            status:
              respostaMP.status,

            resposta:
              assinaturaMP,
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


      const statusMP =
        String(
          assinaturaMP
            ?.status ??
          "",
        )
          .trim()
          .toLowerCase();


      const referenciaMP =
        String(
          assinaturaMP
            ?.external_reference ??
          "",
        )
          .trim();


      if (
        String(
          assinaturaMP?.id ??
          "",
        ) !==
        preapprovalId
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              "ID da assinatura divergente.",
          },
          { status: 409 },
        );
      }


      if (
        referenciaMP !==
        assinatura
          .referencia_externa
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              "Referência da assinatura divergente.",
          },
          { status: 409 },
        );
      }

      /*
 * =========================================================
 * RECONCILIAÇÃO DE REEMBOLSO
 *
 * Pode acontecer de o Mercado Pago ter processado o
 * reembolso antes de o webhook do Bíblia Slides saber
 * tratá-lo.
 *
 * Aqui verificamos o pagamento local mais recente dessa
 * assinatura e consultamos o estado real no Mercado Pago.
 * =========================================================
 */

      const {
        data:
        pagamentoLocal,

        error:
        erroPagamentoLocal,
      } =
        await banco
          .from(
            "pagamentos",
          )
          .select(`
      id,
      status,
      usuario_id,
      plano_armazenamento_id,
      valor,
      moeda,
      pagamento_provedor_id,
      reembolso_provedor_id,
      reembolsado_em
    `)
          .eq(
            "usuario_id",
            usuarioId,
          )
          .eq(
            "finalidade",
            "ARMAZENAMENTO",
          )
          .eq(
            "plano_armazenamento_id",
            assinatura.plano_id,
          )
          .not(
            "pagamento_provedor_id",
            "is",
            null,
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


      if (erroPagamentoLocal) {
        console.error(
          "Erro ao localizar pagamento da assinatura:",
          erroPagamentoLocal,
        );

        return Response.json(
          {
            ok: false,
            erro:
              "Não foi possível consultar o pagamento da assinatura.",
          },
          {
            status: 500,
          },
        );
      }


      if (
        pagamentoLocal
          ?.pagamento_provedor_id
      ) {
        const pagamentoId =
          String(
            pagamentoLocal
              .pagamento_provedor_id,
          );


        const respostaPagamentoMP =
          await fetch(
            `https://api.mercadopago.com/v1/payments/${encodeURIComponent(
              pagamentoId,
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


        let pagamentoMP: any =
          null;


        try {
          pagamentoMP =
            await respostaPagamentoMP
              .json();
        } catch {
          pagamentoMP =
            null;
        }


        if (
          !respostaPagamentoMP.ok
        ) {
          console.error(
            "Erro ao consultar pagamento no Mercado Pago:",
            {
              paymentId:
                pagamentoId,

              status:
                respostaPagamentoMP
                  .status,

              resposta:
                pagamentoMP,
            },
          );

          return Response.json(
            {
              ok: false,
              erro:
                "Não foi possível consultar o pagamento no Mercado Pago.",
            },
            {
              status: 502,
            },
          );
        }


        if (
          String(
            pagamentoMP?.id ??
            "",
          ) !==
          pagamentoId
        ) {
          return Response.json(
            {
              ok: false,
              erro:
                "ID do pagamento divergente.",
            },
            {
              status: 409,
            },
          );
        }


        const valorPagamento =
          paraCentavos(
            pagamentoMP
              ?.transaction_amount,
          );


        const valorReembolsado =
          paraCentavos(
            pagamentoMP
              ?.transaction_amount_refunded,
          );


        const valorLocal =
          paraCentavos(
            pagamentoLocal.valor,
          );


        const pagamentoReembolsado =
          String(
            pagamentoMP?.status ??
            "",
          )
            .trim()
            .toLowerCase() ===
          "refunded";


        const reembolsoIntegral =
          pagamentoReembolsado &&

          valorPagamento !==
          null &&

          valorReembolsado !==
          null &&

          valorLocal !==
          null &&

          valorPagamento ===
          valorReembolsado &&

          valorPagamento ===
          valorLocal;


        if (
          reembolsoIntegral
        ) {
          /*
           * Busca o ID real do reembolso.
           */
          const respostaReembolsos =
            await fetch(
              `https://api.mercadopago.com/v1/payments/${encodeURIComponent(
                pagamentoId,
              )}/refunds`,
              {
                method:
                  "GET",

                headers: {
                  Authorization:
                    `Bearer ${accessToken}`,
                },
              },
            );


          let reembolsosMP: any =
            null;


          try {
            reembolsosMP =
              await respostaReembolsos
                .json();
          } catch {
            reembolsosMP =
              null;
          }


          if (
            !respostaReembolsos.ok ||
            !Array.isArray(
              reembolsosMP,
            )
          ) {
            console.error(
              "Erro ao consultar reembolso:",
              {
                paymentId:
                  pagamentoId,

                resposta:
                  reembolsosMP,
              },
            );

            return Response.json(
              {
                ok: false,
                erro:
                  "Não foi possível consultar os dados do reembolso.",
              },
              {
                status: 502,
              },
            );
          }


          const totalReembolsado =
            reembolsosMP.reduce(
              (
                total: number,
                item: any,
              ) => {
                const valor =
                  paraCentavos(
                    item?.amount,
                  );

                return (
                  total +
                  (
                    valor ??
                    0
                  )
                );
              },
              0,
            );


          if (
            totalReembolsado !==
            valorPagamento
          ) {
            return Response.json(
              {
                ok: false,
                erro:
                  "Os reembolsos não correspondem ao valor integral do pagamento.",
              },
              {
                status: 409,
              },
            );
          }


          const reembolso =
            [
              ...reembolsosMP,
            ]
              .reverse()
              .find(
                (item: any) =>
                  item?.id,
              );


          const reembolsoId =
            reembolso?.id
              ? String(
                reembolso.id,
              )
              : "";


          if (!reembolsoId) {
            return Response.json(
              {
                ok: false,
                erro:
                  "Reembolso sem identificação.",
              },
              {
                status: 409,
              },
            );
          }


          /*
           * O dinheiro já foi devolvido.
           *
           * Agora cancelamos somente a RECORRÊNCIA
           * para impedir uma cobrança no mês seguinte.
           */
          if (
            statusMP !==
            "canceled" &&
            statusMP !==
            "cancelled"
          ) {
            async function tentarCancelar(
              statusDesejado: string,
            ) {
              const resposta =
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
                        status:
                          statusDesejado,
                      }),
                  },
                );


              let corpo: any =
                null;


              try {
                corpo =
                  await resposta
                    .json();
              } catch {
                corpo =
                  null;
              }


              return {
                resposta,
                corpo,
              };
            }


            /*
             * Mercado Pago documenta "canceled".
             * Algumas respostas/contas podem trabalhar
             * com "cancelled", então usamos fallback.
             */
            let tentativaCancelamento =
              await tentarCancelar(
                "canceled",
              );


            if (
              !tentativaCancelamento
                .resposta
                .ok
            ) {
              console.warn(
                "Cancelamento com 'canceled' não foi aceito. Tentando 'cancelled'.",
                {
                  status:
                    tentativaCancelamento
                      .resposta
                      .status,

                  resposta:
                    tentativaCancelamento
                      .corpo,
                },
              );


              tentativaCancelamento =
                await tentarCancelar(
                  "cancelled",
                );
            }


            const respostaCancelamento =
              tentativaCancelamento
                .resposta;

            const cancelamentoMP =
              tentativaCancelamento
                .corpo;


            if (
              !respostaCancelamento.ok
            ) {
              console.error(
                "Erro definitivo ao cancelar recorrência após reembolso:",
                {
                  preapprovalId,

                  status:
                    respostaCancelamento
                      .status,

                  resposta:
                    cancelamentoMP,
                },
              );

              return Response.json(
                {
                  ok: false,

                  erro:
                    "O pagamento foi reembolsado, mas não foi possível cancelar a recorrência.",

                  mercadoPagoStatus:
                    respostaCancelamento
                      .status,

                  mercadoPagoErro:
                    cancelamentoMP
                      ?.message ??
                    cancelamentoMP
                      ?.error ??
                    null,
                },
                {
                  status: 502,
                },
              );
            }


            const statusCancelado =
              String(
                cancelamentoMP
                  ?.status ??
                "",
              )
                .trim()
                .toLowerCase();


            if (
              statusCancelado !==
              "canceled" &&
              statusCancelado !==
              "cancelled"
            ) {
              return Response.json(
                {
                  ok: false,
                  erro:
                    "O Mercado Pago não confirmou o cancelamento da recorrência.",
                },
                {
                  status: 409,
                },
              );
            }
          }


          /*
           * Registra o reembolso no Bíblia Slides,
           * encerra a assinatura mensal,
           * cria o snapshot e volta para 25 MB.
           */
          const {
            data:
            resultadoReembolso,

            error:
            erroReembolso,
          } =
            await banco
              .rpc(
                "processar_reembolso_assinatura_armazenamento",
                {
                  p_pagamento_provedor_id:
                    pagamentoId,

                  p_preapproval_id:
                    preapprovalId,

                  p_reembolso_provedor_id:
                    reembolsoId,

                  p_reembolsado_em:
                    pagamentoMP
                      ?.date_last_updated ??
                    new Date()
                      .toISOString(),
                },
              );

          if (erroReembolso) {
            console.error(
              "Erro ao processar reembolso reconciliado:",
              erroReembolso,
            );

            return Response.json(
              {
                ok: false,
                erro:
                  "O reembolso foi identificado, mas não foi possível atualizar o armazenamento.",
              },
              {
                status: 500,
              },
            );
          }


          return Response.json({
            ok: true,

            reembolsado:
              true,

            reembolsoIntegral:
              true,

            pagamentoId,

            reembolsoId,

            preapprovalId,

            assinaturaCancelada:
              true,

            retornouPlanoBase:
              true,

            processamento:
              resultadoReembolso,
          });
        }
      }


      let statusLocal =
        assinatura.status;


      switch (statusMP) {
        case "pending":
          statusLocal =
            "PENDENTE";
          break;

        case "authorized":
          statusLocal =
            "AUTORIZADA";
          break;

        case "paused":
          statusLocal =
            "PAUSADA";
          break;

        case "cancelled":
        case "canceled":
          statusLocal =
            "CANCELADA";
          break;
      }

      /*
 * Se o webhook de cancelamento não chegou,
 * a reconciliação também consegue concluir
 * o retorno para BASE_25MB.
 */
      if (
        statusLocal ===
        "CANCELADA"
      ) {
        const {
          error:
          erroCancelamento,
        } =
          await banco
            .rpc(
              "cancelar_assinatura_armazenamento",
              {
                p_preapproval_id:
                  preapprovalId,

                p_cancelada_em:
                  assinaturaMP
                    ?.last_modified ??
                  new Date()
                    .toISOString(),
              },
            );


        if (erroCancelamento) {
          console.error(
            "Erro ao reconciliar cancelamento:",
            erroCancelamento,
          );

          return Response.json(
            {
              ok: false,
              erro:
                "Não foi possível concluir o cancelamento do armazenamento.",
            },
            {
              status: 500,
            },
          );
        }


        return Response.json({
          ok: true,

          preapprovalId,

          statusMercadoPago:
            statusMP,

          statusLocal:
            "CANCELADA",

          armazenamentoAtivado:
            false,

          retornouPlanoBase:
            true,
        });
      }

      /*
 * =========================================================
 * FALLBACK DO CRÉDITO-BASE
 *
 * Caso o webhook tenha atrasado ou falhado,
 * a página de retorno também consegue liberar
 * os 100 MB sem cobrança imediata.
 * =========================================================
 */

      if (
        statusLocal ===
        "AUTORIZADA" &&
        assinatura
          .usar_credito_base ===
        true
      ) {
        const autorizadaEm =
          assinaturaMP
            ?.last_modified ??
          new Date()
            .toISOString();


        const {
          data:
          resultadoCredito,

          error:
          erroCredito,
        } =
          await banco
            .rpc(
              "ativar_assinatura_credito_base",
              {
                p_referencia_externa:
                  assinatura
                    .referencia_externa,

                p_preapproval_id:
                  preapprovalId,

                p_autorizada_em:
                  autorizadaEm,
              },
            );


        if (erroCredito) {
          console.error(
            "Erro ao reconciliar crédito-base:",
            erroCredito,
          );

          return Response.json(
            {
              ok: false,

              erro:
                "A assinatura foi autorizada, mas não foi possível liberar o armazenamento.",
            },
            {
              status: 500,
            },
          );
        }


        return Response.json({
          ok: true,

          preapprovalId,

          statusMercadoPago:
            statusMP,

          statusLocal:
            "AUTORIZADA",

          creditoBase:
            true,

          armazenamentoAtivado:
            true,

          proximoPagamento:
            assinaturaMP
              ?.next_payment_date ??
            null,

          processamento:
            resultadoCredito,
        });
      }


      const atualizacao: any = {
        status:
          statusLocal,

        updated_at:
          new Date()
            .toISOString(),
      };


      if (
        statusLocal ===
        "AUTORIZADA" &&
        !assinatura
          .autorizada_em
      ) {
        atualizacao
          .autorizada_em =
          assinaturaMP
            ?.last_modified ??
          new Date()
            .toISOString();
      }


      const {
        error:
        erroAtualizacao,
      } =
        await banco
          .from(
            "assinaturas_armazenamento_provedor",
          )
          .update(
            atualizacao,
          )
          .eq(
            "id",
            assinatura.id,
          );


      if (erroAtualizacao) {
        console.error(
          "Erro ao atualizar assinatura:",
          erroAtualizacao,
        );

        return Response.json(
          {
            ok: false,
            erro:
              "Não foi possível atualizar a assinatura local.",
          },
          { status: 500 },
        );
      }


      /*
       * IMPORTANTE:
       *
       * reconciliação de status NÃO libera
       * armazenamento.
       */
      return Response.json({
        ok: true,

        preapprovalId,

        statusMercadoPago:
          statusMP,

        statusLocal,

        proximoPagamento:
          assinaturaMP
            ?.next_payment_date ??
          null,

        armazenamentoAtivado:
          Boolean(
            assinatura
              .armazenamento_id,
          ),
      });
    },
  ),
};
