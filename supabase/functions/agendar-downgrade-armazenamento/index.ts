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


function timestamp(
  valor: unknown,
) {
  if (
    typeof valor !==
    "string"
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

  return (
    Math.abs(
      primeiro -
      segundo,
    ) <= toleranciaMs
  );
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

      let corpo: any =
        null;


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
              "Plano de destino não informado.",
          },
          { status: 400 },
        );
      }


      /*
       * BASE_25MB é tratada pelo
       * cancelamento da assinatura,
       * não por downgrade mensal.
       */
      if (
        planoCodigo ===
        "BASE_25MB"
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              "Para voltar aos 25 MB utilize o cancelamento da assinatura.",
          },
          { status: 409 },
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
BLOQUEIO: INADIMPLÊNCIA EM RECUPERAÇÃO
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
          "Erro ao verificar inadimplência antes do downgrade:",
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

      /* =====================================================
BLOQUEIO: CANCELAMENTO DA ASSINATURA EM ANDAMENTO
===================================================== */

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
          "Erro ao consultar cancelamento agendado:",
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
                ? "Existe um cancelamento que precisa ser reconciliado antes de reduzir o plano."
                : "Sua assinatura está programada para encerrar. Mantenha a assinatura antes de reduzir o plano.",
          },
          { status: 409 },
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
            renovacao_automatica,
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


      if (
        !armazenamento
          .proximo_vencimento_em
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              "A assinatura não possui próximo vencimento definido.",
          },
          { status: 409 },
        );
      }


      const vencimentoLocalMs =
        timestamp(
          armazenamento
            .proximo_vencimento_em,
        );


      if (
        vencimentoLocalMs ===
        null ||
        vencimentoLocalMs <=
        Date.now()
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              "O vencimento atual não permite agendar uma alteração.",
          },
          { status: 409 },
        );
      }


      /* =====================================================
         3. PLANO ATUAL
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
            preco,
            tipo_cobranca,
            ativo
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
              "Plano atual de armazenamento não encontrado.",
          },
          { status: 409 },
        );
      }


      if (
        planoAtual.tipo_cobranca !==
        "MENSAL"
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              "O plano atual não é uma assinatura mensal.",
          },
          { status: 409 },
        );
      }


      /* =====================================================
         4. PLANO DE DESTINO
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
            "codigo",
            planoCodigo,
          )
          .eq(
            "ativo",
            true,
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
          { status: 404 },
        );
      }


      if (
        planoDestino.tipo_cobranca !==
        "MENSAL"
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              "O plano escolhido não é mensal.",
          },
          { status: 409 },
        );
      }


      const limiteAtual =
        numero(
          planoAtual
            .limite_bytes,
        );

      const limiteDestino =
        numero(
          planoDestino
            .limite_bytes,
        );

      const precoAtual =
        numero(
          armazenamento
            .preco_mensal_contratado,
        );

      const precoDestino =
        numero(
          planoDestino.preco,
        );


      if (
        limiteAtual === null ||
        limiteDestino === null ||
        precoAtual === null ||
        precoDestino === null ||
        precoAtual <= 0 ||
        precoDestino <= 0
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              "Dados financeiros do plano são inválidos.",
          },
          { status: 409 },
        );
      }


      if (
        planoDestino.id ===
        planoAtual.id
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              "Este já é o seu plano atual.",
          },
          { status: 409 },
        );
      }


      if (
        limiteDestino >=
        limiteAtual
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              "O plano escolhido não é inferior ao plano atual.",
          },
          { status: 409 },
        );
      }


      if (
        precoDestino >=
        precoAtual
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              "O valor do plano de destino precisa ser menor que o atual.",
          },
          { status: 409 },
        );
      }


      /* =====================================================
         5. ASSINATURA LOCAL DO PROVEDOR
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
          "Assinatura local não encontrada:",
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
              "A assinatura não está autorizada para alteração.",
          },
          { status: 409 },
        );
      }


      if (
        assinaturaLocal.plano_id !==
        planoAtual.id ||
        assinaturaLocal
          .armazenamento_id !==
        armazenamento.id
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              "Plano local e assinatura do provedor estão divergentes.",
          },
          { status: 409 },
        );
      }


      if (
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
              "Preço local da assinatura está divergente.",
          },
          { status: 409 },
        );
      }


      /* =====================================================
         6. ALTERAÇÃO JÁ AGENDADA
         ===================================================== */

      const {
        data: agendamentoExistente,
        error: erroAgendamentoExistente,
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


      if (erroAgendamentoExistente) {
        console.error(
          "Erro ao consultar alteração agendada:",
          erroAgendamentoExistente,
        );

        return Response.json(
          {
            ok: false,
            erro:
              "Não foi possível consultar alterações já agendadas.",
          },
          { status: 500 },
        );
      }


      if (
        agendamentoExistente &&
        (
          agendamentoExistente
            .plano_destino_id !==
          planoDestino.id ||
          agendamentoExistente
            .preapproval_id !==
          preapprovalId
        )
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              "Já existe outra alteração de armazenamento agendada. Cancele-a antes de escolher outro plano.",
          },
          { status: 409 },
        );
      }


      /* =====================================================
         7. CONSULTA MERCADO PAGO
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
          assinaturaMP?.status,
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
        )
          .trim();


      if (
        !referenciaMP ||
        referenciaMP !==
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


      const precoMPInicial =
        numero(
          assinaturaMP
            ?.auto_recurring
            ?.transaction_amount,
        );


      if (
        precoMPInicial ===
        null
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


      const vencimentoMPInicial =
        assinaturaMP
          ?.next_payment_date ??
        null;


      if (
        timestamp(
          vencimentoMPInicial,
        ) === null
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              "O Mercado Pago não retornou o próximo vencimento da assinatura.",
          },
          { status: 502 },
        );
      }


      if (
        !mesmoInstante(
          vencimentoMPInicial,
          armazenamento
            .proximo_vencimento_em,
        )
      ) {
        console.error(
          "Vencimento local e Mercado Pago divergentes.",
          {
            local:
              armazenamento
                .proximo_vencimento_em,

            mercadoPago:
              vencimentoMPInicial,
          },
        );

        return Response.json(
          {
            ok: false,
            erro:
              "O próximo vencimento local está divergente do Mercado Pago.",
          },
          { status: 409 },
        );
      }


      /*
       * Primeira execução:
       * o MP ainda precisa estar no preço atual.
       *
       * Retry:
       * se já há agendamento local, o MP pode
       * estar no preço atual ou já no futuro.
       */
      if (
        !agendamentoExistente &&
        !mesmoValor(
          precoMPInicial,
          precoAtual,
        )
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              "O valor atual no Mercado Pago está divergente do plano contratado.",
          },
          { status: 409 },
        );
      }


      if (
        agendamentoExistente &&
        !mesmoValor(
          precoMPInicial,
          precoAtual,
        ) &&
        !mesmoValor(
          precoMPInicial,
          precoDestino,
        )
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              "O valor da assinatura no Mercado Pago não corresponde ao plano atual nem ao downgrade agendado.",
          },
          { status: 409 },
        );
      }


      /*
       * Idempotência:
       * registro já existe e o MP já possui
       * o valor futuro.
       */
      if (
        agendamentoExistente &&
        mesmoValor(
          precoMPInicial,
          precoDestino,
        )
      ) {
        return Response.json({
          ok: true,
          reutilizado: true,

          agendamentoId:
            agendamentoExistente.id,

          planoAtual:
            planoAtual.codigo,

          planoDestino:
            planoDestino.codigo,

          precoAtual,
          precoFuturo:
            precoDestino,

          efetivarEm:
            agendamentoExistente
              .efetivar_em,

          proximoVencimentoEm:
            vencimentoMPInicial,

          preapprovalId,

          espacoMantidoAteVencimento:
            true,
        });
      }


      /* =====================================================
         8. CRIA AGENDAMENTO LOCAL ANTES DO PUT
         
         Isso é proposital.
         
         O PUT pode gerar imediatamente um webhook
         de alteração do preapproval. Quando ele chegar,
         o webhook já precisa saber que o preço menor
         é uma alteração legítima e agendada.
         ===================================================== */

      let agendamento =
        agendamentoExistente;

      let criouAgendamento =
        false;


      if (!agendamento) {
        const {
          data: novoAgendamento,
          error: erroNovoAgendamento,
        } =
          await bancoAdmin
            .from(
              "alteracoes_armazenamento_agendadas",
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
                planoAtual.id,

              plano_destino_id:
                planoDestino.id,

              preco_origem:
                precoAtual,

              preco_destino:
                precoDestino,

              efetivar_em:
                armazenamento
                  .proximo_vencimento_em,

              status:
                "AGENDADA",
            })
            .select(`
              id,
              efetivar_em,
              status
            `)
            .single();


        if (
          erroNovoAgendamento ||
          !novoAgendamento
        ) {
          console.error(
            "Erro ao criar downgrade agendado:",
            erroNovoAgendamento,
          );

          return Response.json(
            {
              ok: false,
              erro:
                "Não foi possível registrar o downgrade.",
            },
            { status: 500 },
          );
        }


        agendamento =
          novoAgendamento;

        criouAgendamento =
          true;
      }


      /* =====================================================
         9. ALTERA SOMENTE O PREÇO FUTURO NO MERCADO PAGO
         ===================================================== */

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
          "Erro ao agendar novo preço no Mercado Pago:",
          {
            status:
              respostaAlteracao
                .status,

            resposta:
              retornoAlteracao,
          },
        );


        /*
         * Se este request criou o registro
         * e o PUT nem foi aceito, não existe
         * downgrade remoto confirmado.
         */
        if (criouAgendamento) {
          await bancoAdmin
            .from(
              "alteracoes_armazenamento_agendadas",
            )
            .update({
              status:
                "FALHOU",

              updated_at:
                new Date()
                  .toISOString(),
            })
            .eq(
              "id",
              agendamento.id,
            );
        }


        return Response.json(
          {
            ok: false,
            erro:
              "O Mercado Pago não aceitou a alteração da próxima mensalidade.",
          },
          { status: 502 },
        );
      }


      /* =====================================================
         10. CONFIRMA O ESTADO REMOTO
         ===================================================== */

      const confirmacao =
        await consultarMP();


      const confirmouPreco =
        confirmacao
          .resposta.ok &&
        confirmacao
          .json?.id ===
        preapprovalId &&
        statusMpAutorizado(
          confirmacao
            .json?.status,
        ) &&
        String(
          confirmacao
            .json
            ?.auto_recurring
            ?.currency_id ??
          "",
        )
          .trim()
          .toUpperCase() ===
        "BRL" &&
        mesmoValor(
          confirmacao
            .json
            ?.auto_recurring
            ?.transaction_amount,
          precoDestino,
        );


      const confirmouVencimento =
        confirmacao
          .resposta.ok &&
        mesmoInstante(
          confirmacao
            .json
            ?.next_payment_date,
          vencimentoMPInicial,
        );


      const confirmouReferencia =
        confirmacao
          .resposta.ok &&
        String(
          confirmacao
            .json
            ?.external_reference ??
          "",
        )
          .trim() ===
        referenciaMP;


      if (
        !confirmouPreco ||
        !confirmouVencimento ||
        !confirmouReferencia
      ) {
        console.error(
          "Alteração do downgrade não foi confirmada integralmente.",
          {
            confirmouPreco,
            confirmouVencimento,
            confirmouReferencia,
          },
        );


        /* =================================================
           11. TENTA ROLLBACK PARA O PREÇO ANTERIOR
           ================================================= */

        let rollbackConfirmado =
          false;


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
                        precoAtual,

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


            rollbackConfirmado =
              confirmacaoRollback
                .resposta.ok &&
              mesmoValor(
                confirmacaoRollback
                  .json
                  ?.auto_recurring
                  ?.transaction_amount,
                precoAtual,
              ) &&
              mesmoInstante(
                confirmacaoRollback
                  .json
                  ?.next_payment_date,
                vencimentoMPInicial,
              );
          }
        } catch (
        erroRollback
        ) {
          console.error(
            "Erro durante rollback do downgrade:",
            erroRollback,
          );
        }


        if (rollbackConfirmado) {
          await bancoAdmin
            .from(
              "alteracoes_armazenamento_agendadas",
            )
            .update({
              status:
                "FALHOU",

              updated_at:
                new Date()
                  .toISOString(),
            })
            .eq(
              "id",
              agendamento.id,
            );


          return Response.json(
            {
              ok: false,
              erro:
                "A alteração não pôde ser confirmada e foi desfeita com segurança.",
            },
            { status: 502 },
          );
        }


        /*
         * Não sabemos com segurança qual estado
         * remoto prevaleceu.
         *
         * Mantemos AGENDADA, porque isso permite
         * que o webhook reconheça o preço futuro
         * caso o Mercado Pago tenha realmente
         * aplicado a alteração.
         */
        return Response.json(
          {
            ok: false,

            erro:
              "Não foi possível confirmar completamente a alteração no Mercado Pago.",

            requerReconciliacao:
              true,

            agendamentoId:
              agendamento.id,
          },
          { status: 502 },
        );
      }


      /* =====================================================
         12. SUCESSO
         
         IMPORTANTE:
         
         Não alteramos:
         - armazenamento_usuarios.plano_id
         - preco_mensal_contratado
         - assinatura local do provedor
         
         O usuário permanece no plano atual até que
         a nova mensalidade seja realmente paga.
         ===================================================== */

      return Response.json({
        ok: true,
        reutilizado: false,

        agendamentoId:
          agendamento.id,

        planoAtual:
          planoAtual.codigo,

        planoDestino:
          planoDestino.codigo,

        precoAtual,

        precoFuturo:
          precoDestino,

        efetivarEm:
          agendamento.efetivar_em,

        proximoVencimentoEm:
          confirmacao
            .json
            ?.next_payment_date ??
          armazenamento
            .proximo_vencimento_em,

        preapprovalId,

        espacoMantidoAteVencimento:
          true,
      });
    },
  ),
};
