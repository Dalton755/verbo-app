import { withSupabase } from "npm:@supabase/server@^1";

function obterBackUrl(req: Request) {
  const configurada =
    Deno.env.get("APP_URL")?.trim();

  const origem =
    req.headers.get("origin")?.trim();

  const candidata =
    configurada || origem || "";

  try {
    const url =
      new URL(candidata);

    if (
      url.protocol !== "https:" &&
      url.protocol !== "http:"
    ) {
      return null;
    }

    return new URL(
      "/assinatura/retorno",
      url.origin,
    ).toString();
  } catch {
    return null;
  }
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
        typeof corpo?.planoCodigo ===
          "string"
          ? corpo.planoCodigo.trim()
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


      const backUrl =
        obterBackUrl(req);


      if (!backUrl) {
        console.error(
          "Não foi possível determinar APP_URL/origin.",
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
          .schema("biblia_slides");


      /*
       * 1. Busca o plano real no banco.
       *
       * O frontend NÃO informa preço.
       */
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
        erroPlano ||
        !plano
      ) {
        console.error(
          "Plano não encontrado:",
          erroPlano,
        );

        return Response.json(
          {
            ok: false,
            erro:
              "Plano de armazenamento não encontrado.",
          },
          { status: 404 },
        );
      }


      if (
        plano.tipo_cobranca !==
        "MENSAL"
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              "Este plano não é mensal.",
          },
          { status: 400 },
        );
      }


      /*
       * 2. Descobre o patamar atual.
       */
      const {
        data: estado,
        error: erroEstado,
      } =
        await bancoAdmin
          .from(
            "estado_acesso_armazenamento",
          )
          .select(
            "plano_codigo_ciclo",
          )
          .eq(
            "usuario_id",
            usuarioId,
          )
          .maybeSingle();


      if (
        erroEstado ||
        !estado
      ) {
        console.error(
          "Estado não encontrado:",
          erroEstado,
        );

        return Response.json(
          {
            ok: false,
            erro:
              "Estado de armazenamento não encontrado.",
          },
          { status: 409 },
        );
      }


      const {
        data: planoAtual,
        error: erroPlanoAtual,
      } =
        await bancoAdmin
          .from(
            "planos_armazenamento",
          )
          .select(`
            codigo,
            limite_bytes
          `)
          .eq(
            "codigo",
            estado.plano_codigo_ciclo,
          )
          .maybeSingle();


      if (
        erroPlanoAtual ||
        !planoAtual
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              "Plano atual não encontrado.",
          },
          { status: 409 },
        );
      }


      if (
        Number(
          plano.limite_bytes,
        ) <=
        Number(
          planoAtual.limite_bytes,
        )
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              "Escolha um plano com espaço superior ao atual.",
          },
          { status: 409 },
        );
      }


      /*
       * Por enquanto este fluxo é para:
       *
       * BASE_25MB -> primeiro plano mensal.
       *
       * A troca de uma assinatura mensal
       * já existente será tratada depois
       * alterando a própria assinatura no MP.
       */
      const {
        data: assinaturaAtiva,
        error: erroAssinaturaAtiva,
      } =
        await bancoAdmin
          .from(
            "armazenamento_usuarios",
          )
          .select("id")
          .eq(
            "usuario_id",
            usuarioId,
          )
          .eq(
            "status",
            "ATIVA",
          )
          .maybeSingle();


      if (erroAssinaturaAtiva) {
        console.error(
          "Erro ao verificar assinatura:",
          erroAssinaturaAtiva,
        );

        return Response.json(
          {
            ok: false,
            erro:
              "Não foi possível verificar sua assinatura.",
          },
          { status: 500 },
        );
      }


      if (assinaturaAtiva) {
        return Response.json(
          {
            ok: false,
            erro:
              "Você já possui uma assinatura mensal ativa. A alteração entre planos será feita pelo fluxo de troca de plano.",
          },
          { status: 409 },
        );
      }


      /*
       * 3. Reutiliza checkout pendente do
       * mesmo usuário/plano.
       */
      const {
        data: pendente,
        error: erroPendente,
      } =
        await bancoAdmin
          .from(
            "assinaturas_armazenamento_provedor",
          )
          .select(`
            id,
            preapproval_id,
            init_point,
            usar_credito_base,
            primeira_cobranca_em
          `)
          .eq(
            "usuario_id",
            usuarioId,
          )
          .eq(
            "plano_id",
            plano.id,
          )
          .eq(
            "status",
            "PENDENTE",
          )
          .maybeSingle();


      if (erroPendente) {
        console.error(
          "Erro ao buscar assinatura pendente:",
          erroPendente,
        );

        return Response.json(
          {
            ok: false,
            erro:
              "Não foi possível consultar uma assinatura pendente.",
          },
          { status: 500 },
        );
      }


      if (
        pendente?.preapproval_id &&
        pendente?.init_point
      ) {
        return Response.json({
          ok: true,
          reutilizado: true,

          preapprovalId:
            pendente.preapproval_id,

          checkoutUrl:
            pendente.init_point,

          creditoBase:
            pendente.usar_credito_base,

          primeiraCobrancaEm:
            pendente.primeira_cobranca_em,
        });
      }


      if (pendente) {
        return Response.json(
          {
            ok: false,
            erro:
              "Já existe uma solicitação de assinatura sendo processada.",
          },
          { status: 409 },
        );
      }


      /*
       * 4. Simula a regra comercial usando
       * a identidade autenticada real.
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
                plano.codigo,
            },
          )
          .single();


      if (
        erroSimulacao ||
        !simulacao
      ) {
        console.error(
          "Erro na simulação:",
          erroSimulacao,
        );

        return Response.json(
          {
            ok: false,
            erro:
              "Não foi possível calcular as condições do plano.",
          },
          { status: 500 },
        );
      }


      const usarCreditoBase =
        plano.codigo ===
        "ESPACO_100MB" &&
        simulacao
          .credito_base_disponivel ===
        true &&
        Number(
          simulacao.valor_agora,
        ) === 0;


      const primeiraCobrancaEm =
        usarCreditoBase
          ? simulacao
            .proximo_vencimento_em
          : null;


      /*
       * 5. Busca o e-mail diretamente
       * do usuário autenticado.
       */
      const {
        data: dadosUsuario,
        error: erroUsuario,
      } =
        await ctx.supabaseAdmin
          .auth
          .admin
          .getUserById(
            usuarioId,
          );


      const payerEmail =
        dadosUsuario
          ?.user
          ?.email
          ?.trim();


      if (
        erroUsuario ||
        !payerEmail
      ) {
        console.error(
          "E-mail do usuário não encontrado:",
          erroUsuario,
        );

        return Response.json(
          {
            ok: false,
            erro:
              "Seu e-mail de pagamento não foi encontrado.",
          },
          { status: 400 },
        );
      }


      /*
       * 6. Registra primeiro a intenção local.
       */
      const referenciaExterna =
        `BSS_${crypto.randomUUID()}`;


      const {
        data: registro,
        error: erroRegistro,
      } =
        await bancoAdmin
          .from(
            "assinaturas_armazenamento_provedor",
          )
          .insert({
            usuario_id:
              usuarioId,

            plano_id:
              plano.id,

            provedor:
              "MERCADO_PAGO",

            referencia_externa:
              referenciaExterna,

            status:
              "PENDENTE",

            usar_credito_base:
              usarCreditoBase,

            preco_mensal:
              Number(
                plano.preco,
              ),

            primeira_cobranca_em:
              primeiraCobrancaEm,
          })
          .select("id")
          .single();


      if (
        erroRegistro ||
        !registro
      ) {
        console.error(
          "Erro ao registrar assinatura pendente:",
          erroRegistro,
        );

        return Response.json(
          {
            ok: false,
            erro:
              "Não foi possível iniciar sua assinatura.",
          },
          { status: 409 },
        );
      }


      /*
       * 7. Monta a recorrência.
       */
      const autoRecurring: any = {
        frequency: 1,

        frequency_type:
          "months",

        transaction_amount:
          Number(
            plano.preco,
          ),

        currency_id:
          "BRL",
      };


      /*
       * Crédito dos 25 MB:
       *
       * não há cobrança hoje.
       * A recorrência começa no próximo ciclo.
       */
      if (
        usarCreditoBase &&
        primeiraCobrancaEm
      ) {
        autoRecurring.start_date =
          new Date(
            primeiraCobrancaEm,
          ).toISOString();
      }


      /*
       * 8. Cria o preapproval no Mercado Pago.
       */
      const respostaMP =
        await fetch(
          "https://api.mercadopago.com/preapproval",
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${accessToken}`,

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                reason:
                  `Bíblia Slides - ${plano.nome} de armazenamento`,

                external_reference:
                  referenciaExterna,

                payer_email:
                  payerEmail,

                auto_recurring:
                  autoRecurring,

                back_url:
                  backUrl,

                status:
                  "pending",
              }),
          },
        );


      let assinaturaMP: any =
        null;


      try {
        assinaturaMP =
          await respostaMP.json();
      } catch {
        assinaturaMP = null;
      }


      if (!respostaMP.ok) {
        console.error(
          "Erro Mercado Pago /preapproval:",
          {
            status:
              respostaMP.status,

            resposta:
              assinaturaMP,
          },
        );


        await bancoAdmin
          .from(
            "assinaturas_armazenamento_provedor",
          )
          .delete()
          .eq(
            "id",
            registro.id,
          );


        return Response.json(
          {
            ok: false,
            erro:
              "Não foi possível criar a assinatura no Mercado Pago.",
          },
          {
            status: 502,
          },
        );
      }


      const preapprovalId =
        typeof assinaturaMP?.id ===
          "string"
          ? assinaturaMP.id
          : "";


      const initPoint =
        typeof assinaturaMP
          ?.init_point ===
          "string"
          ? assinaturaMP
            .init_point
          : "";


      if (
        !preapprovalId ||
        !initPoint
      ) {
        console.error(
          "Resposta de assinatura incompleta:",
          assinaturaMP,
        );


        await bancoAdmin
          .from(
            "assinaturas_armazenamento_provedor",
          )
          .delete()
          .eq(
            "id",
            registro.id,
          );


        return Response.json(
          {
            ok: false,
            erro:
              "O Mercado Pago não retornou o link da assinatura.",
          },
          { status: 502 },
        );
      }


      /*
       * 9. Vincula o preapproval ao registro local.
       */
      const {
        error: erroVinculo,
      } =
        await bancoAdmin
          .from(
            "assinaturas_armazenamento_provedor",
          )
          .update({
            preapproval_id:
              preapprovalId,

            init_point:
              initPoint,

            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "id",
            registro.id,
          );


      if (erroVinculo) {
        console.error(
          "Erro ao vincular preapproval:",
          erroVinculo,
        );


        /*
         * Evita deixar uma assinatura órfã
         * no Mercado Pago.
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
                  status:
                    "canceled",
                }),
            },
          );
        } catch {
          // O erro já foi registrado acima.
        }


        return Response.json(
          {
            ok: false,
            erro:
              "Não foi possível concluir o vínculo da assinatura.",
          },
          { status: 500 },
        );
      }


      return Response.json({
        ok: true,

        reutilizado: false,

        preapprovalId,

        checkoutUrl:
          initPoint,

        planoCodigo:
          plano.codigo,

        planoNome:
          plano.nome,

        precoMensal:
          Number(
            plano.preco,
          ),

        creditoBase:
          usarCreditoBase,

        primeiraCobrancaEm:
          primeiraCobrancaEm,
      });
    },
  ),
};
