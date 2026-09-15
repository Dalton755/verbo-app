import { createClient } from "jsr:@supabase/supabase-js@2";


function resposta(
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers: {
        "Content-Type":
          "application/json",
      },
    },
  );
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


Deno.serve(
  async (
    req: Request,
  ) => {

    if (
      req.method !==
      "POST"
    ) {
      return resposta(
        {
          ok: false,
          erro:
            "Método não permitido.",
        },
        405,
      );
    }


    const supabaseUrl =
      Deno.env.get(
        "SUPABASE_URL",
      );

    const serviceRoleKey =
      Deno.env.get(
        "SUPABASE_SERVICE_ROLE_KEY",
      );

    const accessToken =
      Deno.env.get(
        "MERCADO_PAGO_ACCESS_TOKEN",
      );

    const cronSecret =
      Deno.env.get(
        "PROCESSAR_CANCELAMENTOS_CRON_SECRET",
      );


    if (
      !supabaseUrl ||
      !serviceRoleKey ||
      !accessToken ||
      !cronSecret
    ) {
      console.error(
        "Configuração incompleta do processador.",
      );

      return resposta(
        {
          ok: false,
          erro:
            "Configuração incompleta.",
        },
        500,
      );
    }


    /*
     * A função não é pública.
     * Futuramente somente o Cron enviará
     * este cabeçalho.
     */
    const segredoRecebido =
      req.headers.get(
        "x-cron-secret",
      );


    if (
      !segredoRecebido ||
      segredoRecebido !==
        cronSecret
    ) {
      return resposta(
        {
          ok: false,
          erro:
            "Não autorizado.",
        },
        401,
      );
    }


    const supabase =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            persistSession:
              false,

            autoRefreshToken:
              false,
          },
        },
      );


    const banco =
      supabase.schema(
        "biblia_slides",
      );


    const resultados:
      Record<
        string,
        unknown
      >[] = [];


    /*
     * Limite por execução.
     * Se houver mais vencimentos, o próximo
     * Cron continua de onde parou.
     */
    const limite =
      10;


    for (
      let indice = 0;
      indice < limite;
      indice++
    ) {

      /*
       * =================================================
       * 1. REIVINDICA UM CANCELAMENTO VENCIDO
       * =================================================
       */
      const {
        data:
          cancelamento,
        error:
          erroReivindicar,
      } =
        await banco
          .rpc(
            "reivindicar_cancelamento_armazenamento_vencido",
          )
          .maybeSingle();


      if (erroReivindicar) {
        console.error(
          "Erro ao reivindicar cancelamento:",
          erroReivindicar,
        );

        return resposta(
          {
            ok: false,

            erro:
              "Não foi possível reivindicar cancelamentos.",

            processados:
              resultados.length,

            resultados,
          },
          500,
        );
      }


      /*
       * Não existem mais vencidos.
       */
      if (!cancelamento) {
        break;
      }


      const cancelamentoId =
        cancelamento
          .cancelamento_id;

      const preapprovalId =
        String(
          cancelamento
            .preapproval_id ??
          "",
        ).trim();


      /*
       * =================================================
       * AUXILIAR DE FALHA
       * =================================================
       */
      async function falhar(
        mensagem: string,
      ) {
        console.error(
          "Cancelamento agendado falhou:",
          {
            cancelamentoId,
            mensagem,
          },
        );


        await banco
          .from(
            "cancelamentos_armazenamento_agendados",
          )
          .update({
            status:
              "FALHOU",

            processamento_iniciado_em:
              null,

            ultimo_erro:
              mensagem,

            updated_at:
              new Date()
                .toISOString(),
          })
          .eq(
            "id",
            cancelamentoId,
          )
          .eq(
            "status",
            "PROCESSANDO",
          );


        resultados.push({
          cancelamentoId,
          ok: false,
          erro:
            mensagem,
        });
      }


      if (!preapprovalId) {
        await falhar(
          "Preapproval não informado.",
        );

        continue;
      }


      /*
       * =================================================
       * 2. CONSULTA O MERCADO PAGO
       * =================================================
       */
      async function consultarMP() {
        const response =
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
          await response
            .json()
            .catch(
              () => null,
            );


        return {
          response,
          json,
        };
      }


      const inicial =
        await consultarMP();


      if (
        !inicial.response.ok ||
        inicial.json?.id !==
          preapprovalId
      ) {
        await falhar(
          "Não foi possível confirmar a assinatura no Mercado Pago.",
        );

        continue;
      }


      const statusInicial =
        statusMP(
          inicial.json
            ?.status,
        );


      /*
       * Um cancelamento agendado deve chegar
       * ao vencimento ainda PAUSED.
       *
       * CANCELED também é válido em retry:
       * talvez o MP tenha sido cancelado numa
       * execução anterior e só faltou concluir
       * nosso estado local.
       */
      if (
        statusInicial !==
          "paused" &&
        statusInicial !==
          "canceled" &&
        statusInicial !==
          "cancelled"
      ) {
        await falhar(
          `Estado inesperado no Mercado Pago: ${statusInicial || "desconhecido"}.`,
        );

        continue;
      }


      /*
       * =================================================
       * 3. CANCELA DEFINITIVAMENTE NO MP
       * =================================================
       */
      if (
        statusInicial ===
        "paused"
      ) {
        const respostaCancelamento =
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


        if (
          !respostaCancelamento.ok
        ) {
          await falhar(
            "O Mercado Pago recusou o cancelamento definitivo.",
          );

          continue;
        }


        /*
         * Não confiamos apenas no PUT.
         */
        const confirmacao =
          await consultarMP();


        const statusConfirmado =
          statusMP(
            confirmacao.json
              ?.status,
          );


        if (
          !confirmacao.response.ok ||
          confirmacao.json?.id !==
            preapprovalId ||
          (
            statusConfirmado !==
              "canceled" &&
            statusConfirmado !==
              "cancelled"
          )
        ) {
          await falhar(
            "O cancelamento não pôde ser confirmado no Mercado Pago.",
          );

          continue;
        }
      }


      /*
       * =================================================
       * 4. SNAPSHOT + BASE_25MB
       *
       * A RPC já é idempotente.
       * Se o webhook do Mercado Pago tiver chegado
       * primeiro, essa chamada apenas confirma o estado.
       * =================================================
       */
      const {
        data:
          resultadoCancelamento,
        error:
          erroCancelamento,
      } =
        await banco
          .rpc(
            "cancelar_assinatura_armazenamento",
            {
              p_preapproval_id:
                preapprovalId,

              /*
               * A data contratual do término é
               * o próprio fim do ciclo.
               */
              p_cancelada_em:
                cancelamento
                  .efetivar_em,
            },
          )
          .maybeSingle();


      if (
        erroCancelamento ||
        !resultadoCancelamento
          ?.ok
      ) {
        console.error(
          "MP cancelado, mas estado local não concluído:",
          erroCancelamento,
        );


        await falhar(
          "O Mercado Pago foi cancelado, mas o retorno ao plano-base ainda precisa ser concluído.",
        );

        continue;
      }


      /*
       * =================================================
       * 5. MARCA COMO APLICADO
       * =================================================
       */
      const agora =
        new Date()
          .toISOString();


      const {
        data:
          aplicado,
        error:
          erroAplicar,
      } =
        await banco
          .from(
            "cancelamentos_armazenamento_agendados",
          )
          .update({
            status:
              "APLICADO",

            processamento_iniciado_em:
              null,

            aplicado_em:
              agora,

            ultimo_erro:
              null,

            updated_at:
              agora,
          })
          .eq(
            "id",
            cancelamentoId,
          )
          .eq(
            "status",
            "PROCESSANDO",
          )
          .select("id")
          .maybeSingle();


      if (
        erroAplicar ||
        !aplicado
      ) {
        /*
         * MP e armazenamento já podem estar
         * corretamente cancelados.
         *
         * Não inventamos rollback aqui.
         * Após 15 minutos a reivindicação
         * recupera este PROCESSANDO e a RPC
         * idempotente conclui novamente.
         */
        console.error(
          "Cancelamento concluído, mas registro de agenda não foi finalizado:",
          erroAplicar,
        );


        resultados.push({
          cancelamentoId,

          ok: false,

          estadoRealConcluido:
            true,

          requerReconciliacao:
            true,
        });

        continue;
      }


      resultados.push({
        cancelamentoId,

        ok: true,

        planoOrigem:
          resultadoCancelamento
            .plano_origem_codigo,

        planoDestino:
          resultadoCancelamento
            .plano_destino_codigo,

        snapshotSaidaId:
          resultadoCancelamento
            .snapshot_saida_id ??
          null,
      });
    }


    return resposta({
      ok: true,

      processados:
        resultados.length,

      resultados,
    });
  },
);
