import { withSupabase } from "npm:@supabase/server@^1";


function timestamp(
  valor: unknown,
) {
  if (
    typeof valor !== "string"
  ) {
    return null;
  }

  const ms =
    Date.parse(valor);

  return Number.isFinite(ms)
    ? ms
    : null;
}


function mesmoInstante(
  a: unknown,
  b: unknown,
  toleranciaMs =
    10 * 60 * 1000,
) {
  const x = timestamp(a);
  const y = timestamp(b);

  if (
    x === null ||
    y === null
  ) {
    return false;
  }

  return Math.abs(
    x - y,
  ) <= toleranciaMs;
}


function statusMP(
  valor: unknown,
) {
  return String(
    valor ?? "",
  )
    .trim()
    .toLowerCase();
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


      const {
        data: cancelamento,
        error: erroCancelamento,
      } =
        await bancoAdmin
          .from(
            "cancelamentos_armazenamento_agendados",
          )
          .select(`
            id,
            assinatura_provedor_id,
            preapproval_id,
            efetivar_em,
            status
          `)
          .eq(
            "usuario_id",
            usuarioId,
          )
          .eq(
            "status",
            "AGENDADO",
          )
          .maybeSingle();


      if (erroCancelamento) {
        return Response.json(
          {
            ok: false,
            erro:
              "Não foi possível consultar o cancelamento.",
          },
          { status: 500 },
        );
      }


      if (!cancelamento) {
        return Response.json({
          ok: true,
          desfeito: false,
          jaDesfeito: true,
        });
      }


      const efetivarMs =
        timestamp(
          cancelamento
            .efetivar_em,
        );


      if (
        efetivarMs === null ||
        efetivarMs <=
        Date.now()
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              "O cancelamento já atingiu a data de efetivação.",
          },
          { status: 409 },
        );
      }


      const preapprovalId =
        cancelamento
          .preapproval_id;


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


      const inicial =
        await consultarMP();


      if (
        !inicial.resposta.ok ||
        inicial.json?.id !==
          preapprovalId
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              "Não foi possível consultar a assinatura no Mercado Pago.",
          },
          { status: 502 },
        );
      }


      const statusInicial =
        statusMP(
          inicial.json?.status,
        );


      if (
        statusInicial !==
          "paused" &&
        statusInicial !==
          "authorized"
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              "A assinatura não está em um estado que permita desfazer o cancelamento.",
          },
          { status: 409 },
        );
      }


      if (
        statusInicial ===
        "paused"
      ) {
        const respostaReativacao =
          await fetch(
            `https://api.mercadopago.com/preapproval/${encodeURIComponent(
              preapprovalId,
            )}`,
            {
              method: "PUT",

              headers: {
                Authorization:
                  `Bearer ${accessToken}`,

                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  status:
                    "authorized",
                }),
            },
          );


        if (
          !respostaReativacao.ok
        ) {
          return Response.json(
            {
              ok: false,
              erro:
                "O Mercado Pago não aceitou a reativação.",
            },
            { status: 502 },
          );
        }
      }


      const confirmacao =
        await consultarMP();


      const vencimentoConfirmado =
        confirmacao.json
          ?.next_payment_date ??
        null;


      /*
       * Só desfazemos localmente se:
       * - realmente voltou para authorized;
       * - a próxima cobrança continuou na
       *   data original.
       */
      if (
        !confirmacao.resposta.ok ||
        statusMP(
          confirmacao.json?.status,
        ) !== "authorized" ||
        !mesmoInstante(
          vencimentoConfirmado,
          cancelamento
            .efetivar_em,
        )
      ) {
        /*
         * Segurança:
         * se a reativação alterou a data
         * de cobrança, pausa novamente.
         */
        try {
          await fetch(
            `https://api.mercadopago.com/preapproval/${encodeURIComponent(
              preapprovalId,
            )}`,
            {
              method: "PUT",

              headers: {
                Authorization:
                  `Bearer ${accessToken}`,

                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  status:
                    "paused",
                }),
            },
          );
        } catch {
          // reconciliar manualmente
        }


        return Response.json(
          {
            ok: false,

            erro:
              "A reativação não preservou a próxima data de cobrança.",

            requerReconciliacao:
              true,
          },
          { status: 502 },
        );
      }


      const agora =
        new Date()
          .toISOString();


      /*
       * Primeiro volta a assinatura local.
       */
      const {
        error: erroAssinatura,
      } =
        await bancoAdmin
          .from(
            "assinaturas_armazenamento_provedor",
          )
          .update({
            status:
              "AUTORIZADA",

            updated_at:
              agora,
          })
          .eq(
            "id",
            cancelamento
              .assinatura_provedor_id,
          );


      if (erroAssinatura) {
        /*
         * Mantém coerência: pausa novamente
         * se o banco não conseguiu acompanhar.
         */
        try {
          await fetch(
            `https://api.mercadopago.com/preapproval/${encodeURIComponent(
              preapprovalId,
            )}`,
            {
              method: "PUT",

              headers: {
                Authorization:
                  `Bearer ${accessToken}`,

                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  status:
                    "paused",
                }),
            },
          );
        } catch {
          // reconciliação manual
        }


        return Response.json(
          {
            ok: false,
            erro:
              "Não foi possível restaurar a assinatura local.",
            requerReconciliacao:
              true,
          },
          { status: 500 },
        );
      }


      const {
        data: desfeito,
        error: erroDesfazer,
      } =
        await bancoAdmin
          .from(
            "cancelamentos_armazenamento_agendados",
          )
          .update({
            status:
              "CANCELADO",

            cancelado_em:
              agora,

            ultimo_erro:
              null,

            updated_at:
              agora,
          })
          .eq(
            "id",
            cancelamento.id,
          )
          .eq(
            "status",
            "AGENDADO",
          )
          .select("id")
          .maybeSingle();


      if (
        erroDesfazer ||
        !desfeito
      ) {
        /*
         * Se não conseguimos finalizar localmente,
         * pausa outra vez para conservar o
         * cancelamento originalmente agendado.
         */
        try {
          await fetch(
            `https://api.mercadopago.com/preapproval/${encodeURIComponent(
              preapprovalId,
            )}`,
            {
              method: "PUT",

              headers: {
                Authorization:
                  `Bearer ${accessToken}`,

                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  status:
                    "paused",
                }),
            },
          );

          await bancoAdmin
            .from(
              "assinaturas_armazenamento_provedor",
            )
            .update({
              status:
                "PAUSADA",

              updated_at:
                new Date()
                  .toISOString(),
            })
            .eq(
              "id",
              cancelamento
                .assinatura_provedor_id,
            );
        } catch {
          // reconciliação manual
        }


        return Response.json(
          {
            ok: false,
            erro:
              "Não foi possível concluir a desistência do cancelamento.",
            requerReconciliacao:
              true,
          },
          { status: 500 },
        );
      }


      return Response.json({
        ok: true,

        desfeito: true,

        cancelamentoId:
          cancelamento.id,

        proximoVencimentoEm:
          vencimentoConfirmado,

        assinaturaReativada:
          true,
      });
    },
  ),
};
