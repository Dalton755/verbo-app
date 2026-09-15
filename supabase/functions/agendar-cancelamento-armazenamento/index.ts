import { withSupabase } from "npm:@supabase/server@^1";


function numero(valor: unknown) {
  const n = Number(valor);

  return Number.isFinite(n)
    ? n
    : null;
}


function mesmoValor(
  a: unknown,
  b: unknown,
) {
  const x = numero(a);
  const y = numero(b);

  if (
    x === null ||
    y === null
  ) {
    return false;
  }

  return Math.abs(
    x - y,
  ) < 0.005;
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
0. NÃO PODE CANCELAR ENQUANTO A COBRANÇA
  ESTIVER EM RECUPERAÇÃO
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
          "Erro ao verificar inadimplência antes do cancelamento:",
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
              "Existe uma cobrança mensal em nova tentativa. Aguarde a confirmação do pagamento antes de cancelar seu plano.",

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
         1. NÃO PODE EXISTIR DOWNGRADE AGENDADO
         ===================================================== */

      const {
        data: downgrade,
        error: erroDowngrade,
      } =
        await bancoAdmin
          .from(
            "alteracoes_armazenamento_agendadas",
          )
          .select("id")
          .eq(
            "usuario_id",
            usuarioId,
          )
          .eq(
            "status",
            "AGENDADA",
          )
          .maybeSingle();


      if (erroDowngrade) {
        return Response.json(
          {
            ok: false,
            erro:
              "Não foi possível consultar alterações de armazenamento.",
          },
          { status: 500 },
        );
      }


      if (downgrade) {
        return Response.json(
          {
            ok: false,
            erro:
              "Existe uma redução de plano agendada. Cancele essa alteração antes de cancelar a assinatura.",
          },
          { status: 409 },
        );
      }


      /* =====================================================
         2. CANCELAMENTO JÁ AGENDADO
         ===================================================== */

      const {
        data: existente,
        error: erroExistente,
      } =
        await bancoAdmin
          .from(
            "cancelamentos_armazenamento_agendados",
          )
          .select(`
            id,
            preapproval_id,
            efetivar_em,
            status,
            preco_mensal
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


      if (erroExistente) {
        return Response.json(
          {
            ok: false,
            erro:
              "Não foi possível consultar cancelamentos agendados.",
          },
          { status: 500 },
        );
      }

      if (
        existente?.status ===
        "FALHOU"
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              "Existe um cancelamento anterior que precisa ser reconciliado antes de tentar novamente.",
            requerReconciliacao:
              true,
          },
          { status: 409 },
        );
      }


      if (existente) {
        return Response.json({
          ok: true,
          reutilizado: true,

          cancelamentoId:
            existente.id,

          efetivarEm:
            existente.efetivar_em,

          precoMensal:
            Number(
              existente.preco_mensal,
            ),
        });
      }


      /* =====================================================
         3. ARMAZENAMENTO ATIVO
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
        return Response.json(
          {
            ok: false,
            erro:
              "Assinatura mensal ativa não encontrada.",
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
              "Esta assinatura não pode ser cancelada por este fluxo.",
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


      if (
        !preapprovalId ||
        !armazenamento
          .proximo_vencimento_em
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              "Dados da assinatura estão incompletos.",
          },
          { status: 409 },
        );
      }


      const vencimento =
        armazenamento
          .proximo_vencimento_em;


      const vencimentoMs =
        timestamp(
          vencimento,
        );


      if (
        vencimentoMs === null ||
        vencimentoMs <=
        Date.now()
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              "O ciclo atual já venceu ou possui data inválida.",
          },
          { status: 409 },
        );
      }


      /* =====================================================
         4. PLANO ATUAL
         ===================================================== */

      const {
        data: plano,
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
            tipo_cobranca
          `)
          .eq(
            "id",
            armazenamento.plano_id,
          )
          .maybeSingle();


      if (
        erroPlano ||
        !plano ||
        plano.tipo_cobranca !==
        "MENSAL"
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              "O plano atual não é uma assinatura mensal válida.",
          },
          { status: 409 },
        );
      }


      const precoAtual =
        numero(
          armazenamento
            .preco_mensal_contratado,
        );


      if (
        precoAtual === null ||
        precoAtual <= 0
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              "Preço mensal contratado inválido.",
          },
          { status: 409 },
        );
      }


      /* =====================================================
         5. ASSINATURA LOCAL DO PROVEDOR
         ===================================================== */

      const {
        data: assinaturaLocal,
        error: erroAssinatura,
      } =
        await bancoAdmin
          .from(
            "assinaturas_armazenamento_provedor",
          )
          .select(`
            id,
            plano_id,
            armazenamento_id,
            referencia_externa,
            preapproval_id,
            status,
            preco_mensal
          `)
          .eq(
            "usuario_id",
            usuarioId,
          )
          .eq(
            "preapproval_id",
            preapprovalId,
          )
          .maybeSingle();


      if (
        erroAssinatura ||
        !assinaturaLocal
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              "Assinatura local do Mercado Pago não encontrada.",
          },
          { status: 409 },
        );
      }


      if (
        assinaturaLocal.status !==
        "AUTORIZADA" ||
        assinaturaLocal.plano_id !==
        plano.id ||
        assinaturaLocal
          .armazenamento_id !==
        armazenamento.id ||
        !mesmoValor(
          assinaturaLocal
            .preco_mensal,
          precoAtual,
        )
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              "Assinatura local está divergente do plano atual.",
          },
          { status: 409 },
        );
      }


      /* =====================================================
         6. CONSULTA MERCADO PAGO
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


      const inicial =
        await consultarMP();


      if (
        !inicial.resposta.ok
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


      if (
        inicial.json?.id !==
        preapprovalId ||
        statusMP(
          inicial.json?.status,
        ) !== "authorized"
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
          inicial.json
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


      if (
        !mesmoValor(
          inicial.json
            ?.auto_recurring
            ?.transaction_amount,
          precoAtual,
        )
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              "Valor da assinatura no Mercado Pago está divergente.",
          },
          { status: 409 },
        );
      }


      const vencimentoMP =
        inicial.json
          ?.next_payment_date ??
        null;


      if (
        timestamp(
          vencimentoMP,
        ) !== null &&
        !mesmoInstante(
          vencimentoMP,
          vencimento,
        )
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              "A próxima cobrança do Mercado Pago está divergente.",
          },
          { status: 409 },
        );
      }


      /* =====================================================
         7. CRIA REGISTRO ANTES DE PAUSAR
         ===================================================== */

      const {
        data: cancelamento,
        error: erroInsert,
      } =
        await bancoAdmin
          .from(
            "cancelamentos_armazenamento_agendados",
          )
          .insert({
            usuario_id:
              usuarioId,

            armazenamento_id:
              armazenamento.id,

            assinatura_provedor_id:
              assinaturaLocal.id,

            preapproval_id:
              preapprovalId,

            plano_origem_id:
              plano.id,

            preco_mensal:
              precoAtual,

            efetivar_em:
              vencimento,

            status:
              "AGENDADO",
          })
          .select(`
            id,
            efetivar_em
          `)
          .single();


      if (
        erroInsert ||
        !cancelamento
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              "Não foi possível registrar o cancelamento.",
          },
          { status: 500 },
        );
      }


      /* =====================================================
         8. PAUSA NO MERCADO PAGO
         ===================================================== */

      const respostaPausa =
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


      if (!respostaPausa.ok) {
        await bancoAdmin
          .from(
            "cancelamentos_armazenamento_agendados",
          )
          .update({
            status:
              "FALHOU",

            ultimo_erro:
              "Mercado Pago recusou a pausa.",

            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "id",
            cancelamento.id,
          );


        return Response.json(
          {
            ok: false,
            erro:
              "O Mercado Pago não aceitou o cancelamento agendado.",
          },
          { status: 502 },
        );
      }


      /* =====================================================
         9. CONFIRMA PAUSA
         ===================================================== */

      const confirmacao =
        await consultarMP();


      if (
        !confirmacao.resposta.ok ||
        confirmacao.json?.id !==
        preapprovalId ||
        statusMP(
          confirmacao.json?.status,
        ) !== "paused"
      ) {
        /*
         * Tenta reativar porque a pausa
         * não pôde ser confirmada.
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
                    "authorized",
                }),
            },
          );
        } catch {
          // reconciliação manual
        }


        await bancoAdmin
          .from(
            "cancelamentos_armazenamento_agendados",
          )
          .update({
            status:
              "FALHOU",

            ultimo_erro:
              "Pausa não pôde ser confirmada.",

            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "id",
            cancelamento.id,
          );


        return Response.json(
          {
            ok: false,

            erro:
              "Não foi possível confirmar a pausa da assinatura.",

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
       * Atualização local imediata.
       * O webhook poderá repetir a mesma
       * atualização sem problema.
       */
      await bancoAdmin
        .from(
          "assinaturas_armazenamento_provedor",
        )
        .update({
          status:
            "PAUSADA",

          updated_at:
            agora,
        })
        .eq(
          "id",
          assinaturaLocal.id,
        );


      await bancoAdmin
        .from(
          "cancelamentos_armazenamento_agendados",
        )
        .update({
          pausado_provedor_em:
            agora,

          ultimo_erro:
            null,

          updated_at:
            agora,
        })
        .eq(
          "id",
          cancelamento.id,
        );


      /*
       * armazenamento_usuarios permanece
       * completamente intacto.
       */
      return Response.json({
        ok: true,

        cancelamentoId:
          cancelamento.id,

        planoAtual:
          plano.codigo,

        planoNome:
          plano.nome,

        precoMensal:
          precoAtual,

        efetivarEm:
          cancelamento
            .efetivar_em,

        espacoMantidoAteVencimento:
          true,

        assinaturaPausada:
          true,
      });
    },
  ),
};
