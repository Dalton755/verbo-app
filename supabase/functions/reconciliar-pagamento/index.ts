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
              "Credencial do Mercado Pago não configurada.",
          },
          { status: 500 },
        );
      }

      const banco =
        ctx.supabaseAdmin
          .schema("biblia_slides");

      // -----------------------------------------
      // 1. Procura somente pagamento PENDENTE
      //    do próprio usuário autenticado
      // -----------------------------------------

      const {
        data: pagamento,
        error: erroPagamento,
      } =
        await banco
          .from("pagamentos")
          .select(`
            id,
            usuario_id,
            status,
            valor,
            moeda,
            referencia_externa,
            ordem_provedor_id
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
            "status",
            "PENDENTE",
          )
          .order(
            "created_at",
            {
              ascending: false,
            },
          )
          .limit(1)
          .maybeSingle();

      if (erroPagamento) {
        console.error(
          "Erro ao procurar pagamento pendente:",
          erroPagamento,
        );

        return Response.json(
          {
            ok: false,
            erro:
              "Não foi possível verificar o pagamento.",
          },
          { status: 500 },
        );
      }

      if (!pagamento) {
        return Response.json({
          ok: true,
          liberado: false,
          semPendente: true,
        });
      }

      const orderId =
        pagamento.ordem_provedor_id;

      if (!orderId) {
        return Response.json({
          ok: true,
          liberado: false,
          processando: true,
        });
      }

      // -----------------------------------------
      // 2. Consulta a Order diretamente no MP
      // -----------------------------------------

      const respostaMP =
        await fetch(
          `https://api.mercadopago.com/v1/orders/${
            encodeURIComponent(
              orderId,
            )
          }`,
          {
            method: "GET",

            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },
          },
        );

      let order: any = null;

      try {
        order =
          await respostaMP.json();
      } catch {
        // tratado abaixo
      }

      if (!respostaMP.ok) {
        console.error(
          "Erro ao consultar Order:",
          {
            status:
              respostaMP.status,

            orderId,

            resposta:
              order,
          },
        );

        return Response.json(
          {
            ok: false,
            erro:
              "Não foi possível consultar o pagamento no Mercado Pago.",
          },
          { status: 502 },
        );
      }

      // -----------------------------------------
      // 3. Confere se a Order consultada é
      //    exatamente a Order do banco
      // -----------------------------------------

      if (
        order?.id !== orderId
      ) {
        console.error(
          "ID da Order divergente.",
        );

        return Response.json(
          {
            ok: false,
            erro:
              "Order divergente.",
          },
          { status: 409 },
        );
      }

      // -----------------------------------------
      // 4. Não confia no retorno do navegador.
      //    Somente MP processado/acreditado libera.
      // -----------------------------------------

      if (
        order?.status !==
          "processed" ||
        order?.status_detail !==
          "accredited"
      ) {
        return Response.json({
          ok: true,
          liberado: false,

          status:
            order?.status ??
            null,

          statusDetail:
            order?.status_detail ??
            null,
        });
      }

      // -----------------------------------------
      // 5. Confere referência externa
      // -----------------------------------------

      const referenciaExterna =
        order?.external_reference;

      if (
        !referenciaExterna ||
        referenciaExterna !==
          pagamento.referencia_externa
      ) {
        console.error(
          "Referência externa divergente.",
        );

        return Response.json(
          {
            ok: false,
            erro:
              "Referência do pagamento divergente.",
          },
          { status: 409 },
        );
      }

      // -----------------------------------------
      // 6. Confere valores
      // -----------------------------------------

      const totalCentavos =
        paraCentavos(
          order?.total_amount,
        );

      const pagoCentavos =
        paraCentavos(
          order?.total_paid_amount,
        );

      const valorLocalCentavos =
        paraCentavos(
          pagamento.valor,
        );

      if (
        totalCentavos === null ||
        pagoCentavos === null ||
        valorLocalCentavos === null ||
        totalCentavos !==
          pagoCentavos ||
        valorLocalCentavos !==
          totalCentavos
      ) {
        console.error(
          "Valor do pagamento divergente.",
          {
            local:
              pagamento.valor,

            total:
              order?.total_amount,

            pago:
              order?.total_paid_amount,
          },
        );

        return Response.json(
          {
            ok: false,
            erro:
              "Valor do pagamento divergente.",
          },
          { status: 409 },
        );
      }

      // -----------------------------------------
      // 7. Localiza pagamento creditado
      // -----------------------------------------

      const pagamentosMP =
        Array.isArray(
          order?.transactions
            ?.payments,
        )
          ? order.transactions
              .payments
          : [];

      const pagamentoCreditado =
        pagamentosMP.find(
          (p: any) =>
            p?.status ===
              "processed" &&
            p?.status_detail ===
              "accredited",
        );

      const pagamentoProvedorId =
        pagamentoCreditado?.id
          ? String(
              pagamentoCreditado.id,
            )
          : null;

      if (!pagamentoProvedorId) {
        console.error(
          "Order aprovada sem pagamento creditado identificável.",
        );

        return Response.json(
          {
            ok: false,
            erro:
              "Pagamento aprovado sem identificação do provedor.",
          },
          { status: 409 },
        );
      }

      const pagoEm =
        order?.last_updated_date ??
        new Date().toISOString();

      // -----------------------------------------
      // 8. Confirma pagamento e concede licença
      // -----------------------------------------

      const {
        data: pagamentoConfirmado,
        error: erroConfirmacao,
      } =
        await banco.rpc(
          "confirmar_ordem_processada",
          {
            p_referencia_externa:
              referenciaExterna,

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

      if (erroConfirmacao) {
        console.error(
          "Erro ao confirmar pagamento:",
          erroConfirmacao,
        );

        return Response.json(
          {
            ok: false,
            erro:
              "Não foi possível confirmar o pagamento.",
          },
          { status: 500 },
        );
      }

      console.log(
        "PAGAMENTO RECONCILIADO E LICENÇA LIBERADA",
        {
          usuarioId,
          pagamentoId:
            pagamentoConfirmado,
          orderId,
        },
      );

      return Response.json({
        ok: true,
        liberado: true,
        pagamentoId:
          pagamentoConfirmado,
      });
    },
  ),
};