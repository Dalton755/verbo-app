import { withSupabase } from "npm:@supabase/server@^1";


function numero(valor: unknown) {
  const convertido =
    Number(valor);

  return Number.isFinite(convertido)
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

  return Math.abs(
    primeiro - segundo,
  ) < 0.005;
}


function statusMpAutorizado(
  status: unknown,
) {
  return (
    String(status ?? "")
      .trim()
      .toLowerCase() ===
    "authorized"
  );
}


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
  const primeiro =
    timestamp(a);

  const segundo =
    timestamp(b);

  if (
    primeiro === null ||
    segundo === null
  ) {
    return false;
  }

  return Math.abs(
    primeiro - segundo,
  ) <= toleranciaMs;
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
         1. DOWNGRADE AGENDADO
         ===================================================== */

      const {
        data: agendamento,
        error: erroAgendamento,
      } =
        await bancoAdmin
          .from(
            "alteracoes_armazenamento_agendadas",
          )
          .select(`
            id,
            usuario_id,
            armazenamento_id,
            assinatura_provedor_id,
            preapproval_id,
            plano_origem_id,
            plano_destino_id,
            preco_origem,
            preco_destino,
            efetivar_em,
            status
          `)
          .eq(
            "usuario_id",
            usuarioId,
          )
          .eq(
            "status",
            "AGENDADA",
          )
          .maybeSingle();


      if (erroAgendamento) {
        console.error(
          "Erro ao consultar downgrade:",
          erroAgendamento,
        );

        return Response.json(
          {
            ok: false,
            erro:
              "Não foi possível consultar o downgrade agendado.",
          },
          { status: 500 },
        );
      }


      if (!agendamento) {
        return Response.json({
          ok: true,
          cancelado: false,
          jaCancelado: true,
          mensagem:
            "Não existe downgrade agendado.",
        });
      }


      const precoOrigem =
        numero(
          agendamento.preco_origem,
        );

      const precoDestino =
        numero(
          agendamento.preco_destino,
        );


      if (
        precoOrigem === null ||
        precoDestino === null ||
        precoOrigem <=
        precoDestino
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              "Dados do downgrade agendado são inválidos.",
          },
          { status: 409 },
        );
      }


      /* =====================================================
   BLOQUEIO: INADIMPLÊNCIA EM RECUPERAÇÃO

   Se existe realmente um downgrade agendado,
   ele não pode ser desfeito enquanto a mensalidade
   estiver em nova tentativa de cobrança.
   ===================================================== */

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
          "Erro ao verificar inadimplência antes de cancelar downgrade:",
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
              "Existe uma cobrança mensal em nova tentativa. Aguarde a confirmação do pagamento antes de desfazer a alteração do seu plano.",

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


      /* =====================================================
         2. ARMAZENAMENTO ATUAL
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
            usuario_id,
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
        return Response.json(
          {
            ok: false,
            erro:
              "Armazenamento ativo não encontrado.",
          },
          { status: 409 },
        );
      }


      if (
        armazenamento.id !==
        agendamento
          .armazenamento_id ||
        armazenamento.plano_id !==
        agendamento
          .plano_origem_id
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              "O plano ativo não corresponde ao downgrade agendado.",
          },
          { status: 409 },
        );
      }


      if (
        armazenamento.provedor !==
        "MERCADO_PAGO" ||
        armazenamento
          .provedor_assinatura_id !==
        agendamento.preapproval_id
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              "A assinatura ativa está divergente do agendamento.",
          },
          { status: 409 },
        );
      }


      if (
        !mesmoValor(
          armazenamento
            .preco_mensal_contratado,
          precoOrigem,
        )
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              "O preço atual do plano está divergente.",
          },
          { status: 409 },
        );
      }


      /* =====================================================
         3. ASSINATURA LOCAL DO PROVEDOR
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
            plano_id,
            armazenamento_id,
            provedor,
            referencia_externa,
            preapproval_id,
            status,
            preco_mensal
          `)
          .eq(
            "id",
            agendamento
              .assinatura_provedor_id,
          )
          .maybeSingle();


      if (
        erroAssinaturaLocal ||
        !assinaturaLocal
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              "Assinatura local do provedor não encontrada.",
          },
          { status: 409 },
        );
      }


      if (
        assinaturaLocal.status !==
        "AUTORIZADA" ||
        assinaturaLocal.provedor !==
        "MERCADO_PAGO" ||
        assinaturaLocal
          .preapproval_id !==
        agendamento
          .preapproval_id ||
        assinaturaLocal.plano_id !==
        agendamento
          .plano_origem_id
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              "Assinatura local incompatível com o downgrade.",
          },
          { status: 409 },
        );
      }


      if (
        !mesmoValor(
          assinaturaLocal
            .preco_mensal,
          precoOrigem,
        )
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              "Preço local da assinatura está divergente.",
          },
          { status: 409 },
        );
      }


      const preapprovalId =
        agendamento
          .preapproval_id;


      /* =====================================================
         4. CONSULTA MERCADO PAGO
         ===================================================== */

      async function consultarMP() {
        const resposta =
          await fetch(
            `https://api.mercadopago.com/preapproval/${encodeURIComponent(
              preapprovalId,
            )}`,
            {
              method: "GET",

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


      async function alterarPreco(
        valor: number,
      ) {
        return await fetch(
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
                auto_recurring: {
                  transaction_amount:
                    valor,

                  currency_id:
                    "BRL",
                },
              }),
          },
        );
      }


      const consultaInicial =
        await consultarMP();


      if (
        !consultaInicial
          .resposta.ok
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


      const assinaturaMP =
        consultaInicial.json;


      if (
        assinaturaMP?.id !==
        preapprovalId ||
        !statusMpAutorizado(
          assinaturaMP?.status,
        )
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              "A assinatura do Mercado Pago está divergente ou não autorizada.",
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


      if (
        String(
          assinaturaMP
            ?.external_reference ??
          "",
        ).trim() !==
        assinaturaLocal
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


      const precoMP =
        numero(
          assinaturaMP
            ?.auto_recurring
            ?.transaction_amount,
        );


      if (
        precoMP === null ||
        (
          !mesmoValor(
            precoMP,
            precoOrigem,
          ) &&
          !mesmoValor(
            precoMP,
            precoDestino,
          )
        )
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              "O valor remoto não corresponde ao plano atual nem ao downgrade.",
          },
          { status: 409 },
        );
      }


      const vencimentoMP =
        assinaturaMP
          ?.next_payment_date ??
        null;


      if (
        !mesmoInstante(
          vencimentoMP,
          agendamento
            .efetivar_em,
        )
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              "A data da próxima cobrança está divergente.",
          },
          { status: 409 },
        );
      }


      /* =====================================================
         5. RESTAURA PREÇO ORIGINAL
         ===================================================== */

      const precisouAlterarMP =
        !mesmoValor(
          precoMP,
          precoOrigem,
        );


      if (precisouAlterarMP) {
        const respostaAlteracao =
          await alterarPreco(
            precoOrigem,
          );


        if (
          !respostaAlteracao.ok
        ) {
          console.error(
            "Mercado Pago recusou restauração do preço.",
          );

          return Response.json(
            {
              ok: false,
              erro:
                "Não foi possível cancelar a alteração no Mercado Pago.",
            },
            { status: 502 },
          );
        }


        const confirmacao =
          await consultarMP();


        if (
          !confirmacao
            .resposta.ok ||
          !statusMpAutorizado(
            confirmacao
              .json?.status,
          ) ||
          !mesmoValor(
            confirmacao
              .json
              ?.auto_recurring
              ?.transaction_amount,
            precoOrigem,
          ) ||
          !mesmoInstante(
            confirmacao
              .json
              ?.next_payment_date,
            vencimentoMP,
          )
        ) {
          /*
           * A restauração não pôde ser
           * confirmada. O agendamento local
           * continua AGENDADO.
           */
          return Response.json(
            {
              ok: false,
              erro:
                "Não foi possível confirmar o cancelamento no Mercado Pago.",

              requerReconciliacao:
                true,
            },
            { status: 502 },
          );
        }
      }


      /* =====================================================
         6. FINALIZA CANCELAMENTO LOCAL
         ===================================================== */

      const agora =
        new Date()
          .toISOString();


      const {
        data: cancelado,
        error: erroCancelamento,
      } =
        await bancoAdmin
          .from(
            "alteracoes_armazenamento_agendadas",
          )
          .update({
            status:
              "CANCELADA",

            cancelada_em:
              agora,

            updated_at:
              agora,
          })
          .eq(
            "id",
            agendamento.id,
          )
          .eq(
            "status",
            "AGENDADA",
          )
          .select(`
            id,
            status,
            cancelada_em
          `)
          .maybeSingle();


      if (
        erroCancelamento ||
        !cancelado
      ) {
        console.error(
          "Preço foi restaurado, mas o agendamento local não pôde ser cancelado:",
          erroCancelamento,
        );


        /*
         * O banco continuou AGENDADO.
         * Tentamos restaurar o preço futuro para
         * que banco e Mercado Pago continuem
         * descrevendo o mesmo estado.
         */
        let rollbackRemoto =
          false;


        try {
          const respostaRollback =
            await alterarPreco(
              precoDestino,
            );


          if (
            respostaRollback.ok
          ) {
            const confirmacaoRollback =
              await consultarMP();


            rollbackRemoto =
              confirmacaoRollback
                .resposta.ok &&
              mesmoValor(
                confirmacaoRollback
                  .json
                  ?.auto_recurring
                  ?.transaction_amount,
                precoDestino,
              ) &&
              mesmoInstante(
                confirmacaoRollback
                  .json
                  ?.next_payment_date,
                vencimentoMP,
              );
          }
        } catch (
        erroRollback
        ) {
          console.error(
            "Erro no rollback do cancelamento:",
            erroRollback,
          );
        }


        return Response.json(
          {
            ok: false,

            erro:
              rollbackRemoto
                ? "Não foi possível concluir o cancelamento. O downgrade foi mantido como estava."
                : "O cancelamento ficou inconsistente e precisa ser reconciliado.",

            requerReconciliacao:
              !rollbackRemoto,
          },
          { status: 500 },
        );
      }


      /* =====================================================
         7. SUCESSO
         ===================================================== */

      return Response.json({
        ok: true,

        cancelado: true,

        agendamentoId:
          agendamento.id,

        precoRestaurado:
          precoOrigem,

        proximoVencimentoEm:
          vencimentoMP,

        planoMantidoAteVencimento:
          true,
      });
    },
  ),
};
