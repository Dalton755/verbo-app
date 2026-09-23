import { withSupabase } from "npm:@supabase/server@^1";

function statusPorCodigo(codigo: string) {
  switch (codigo) {
    case "SEM_LICENCA":
      return 403;

    case "DEMO_EXPIRADA":
      return 403;

    case "DEMO_LIMITE_MODULO":
      return 409;

    case "ARQUIVO_MUITO_GRANDE":
      return 413;

    case "ESPACO_INSUFICIENTE":
      return 409;

    case "CAMINHO_EM_USO":
      return 409;

    case "CAMINHO_INVALIDO":
    case "TAMANHO_INVALIDO":
      return 400;

    default:
      return 400;
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
            erro: "Usuário não identificado.",
          },
          { status: 401 },
        );
      }

      let corpo;

      try {
        corpo = await req.json();
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

      const caminho =
        typeof corpo?.caminho === "string"
          ? corpo.caminho.trim()
          : "";

      const arquivoBytes =
        Number(corpo?.arquivoBytes);

      if (!caminho) {
        return Response.json(
          {
            ok: false,
            erro:
              "Caminho do arquivo não informado.",
          },
          { status: 400 },
        );
      }

      /*
       * O caminho obrigatoriamente começa
       * com o ID do próprio usuário.
       */
      if (
        !caminho.startsWith(
          `${usuarioId}/`,
        )
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              "Caminho do arquivo inválido.",
          },
          { status: 403 },
        );
      }

      if (
        !Number.isSafeInteger(
          arquivoBytes,
        ) ||
        arquivoBytes <= 0
      ) {
        return Response.json(
          {
            ok: false,
            erro:
              "Tamanho do arquivo inválido.",
          },
          { status: 400 },
        );
      }

      /*
 * Identifica o módulo pelo caminho.
 *
 * Sermões:
 * userId/sermoes/arquivo.pdf|docx
 *
 * Livros:
 * userId/livros/arquivo.pdf|epub
 *
 * EBD:
 * userId/trimestreId/arquivo.pdf|pptx
 */
      const partesCaminho =
        caminho.split("/");

      const segundoSegmento =
        String(
          partesCaminho[1] ?? "",
        ).toLowerCase();

      const modulo =
        segundoSegmento === "sermoes"
          ? "SERMOES"
          : segundoSegmento === "livros"
            ? "LIVROS"
            : "EBD";

      const extensao =
        caminho
          .split(".")
          .pop()
          ?.toLowerCase() ?? "";

      const formatosPermitidos =
        modulo === "LIVROS"
          ? ["pdf", "epub"]
          : modulo === "SERMOES"
            ? ["pdf", "docx"]
            : ["pdf", "pptx"];

      if (
        !formatosPermitidos.includes(
          extensao,
        )
      ) {
        return Response.json(
          {
            ok: false,
            codigo:
              "TIPO_INVALIDO",
            erro:
              `Formato .${extensao || "desconhecido"} não permitido em ${modulo}.`,
            formatosPermitidos,
          },
          { status: 400 },
        );
      }


      /*
       * Consulta o estado oficial do acesso.
       */
      const {
        data: acessoData,
        error: erroAcesso,
      } =
        await ctx.supabase
          .schema("biblia_slides")
          .rpc("meu_acesso_app");


      if (erroAcesso) {
        console.error(
          "Erro ao consultar acesso:",
          erroAcesso,
        );

        return Response.json(
          {
            ok: false,
            codigo: "ERRO_ACESSO",
            erro:
              "Não foi possível verificar seu acesso.",
          },
          {
            status: 500,
          },
        );
      }


      const acesso =
        Array.isArray(acessoData)
          ? acessoData[0]
          : acessoData;


      if (!acesso) {
        return Response.json(
          {
            ok: false,
            codigo: "SEM_LICENCA",
            erro:
              "Não foi possível verificar seu acesso.",
          },
          {
            status: 403,
          },
        );
      }


      /*
       * Os 7 dias terminaram.
       */
      if (
        acesso.estado ===
        "EXPIRADO" ||
        acesso.tem_acesso !== true
      ) {
        return Response.json(
          {
            ok: false,
            codigo:
              "DEMO_EXPIRADA",
            erro:
              "Seu período de demonstração terminou.",
          },
          {
            status:
              statusPorCodigo(
                "DEMO_EXPIRADA",
              ),
          },
        );
      }


      /*
       * Durante a DEMO:
       * apenas 1 arquivo atual por módulo.
       */
      if (
        acesso.estado === "TESTE"
      ) {
        const {
          data: slotDemo,
          error: erroSlot,
        } =
          await ctx.supabase
            .schema(
              "biblia_slides",
            )
            .from(
              "demo_modulo_slots",
            )
            .select(
              "recurso_id",
            )
            .eq(
              "user_id",
              usuarioId,
            )
            .eq(
              "modulo",
              modulo,
            )
            .maybeSingle();


        if (erroSlot) {
          console.error(
            "Erro ao consultar limite da demo:",
            erroSlot,
          );

          return Response.json(
            {
              ok: false,
              codigo:
                "ERRO_DEMO",
              erro:
                "Não foi possível verificar o limite da demonstração.",
            },
            {
              status: 500,
            },
          );
        }


        if (slotDemo) {
          return Response.json(
            {
              ok: false,

              codigo:
                "DEMO_LIMITE_MODULO",

              modulo,

              erro:
                "Você já utilizou o arquivo de demonstração deste módulo.",
            },
            {
              status:
                statusPorCodigo(
                  "DEMO_LIMITE_MODULO",
                ),
            },
          );
        }
      }

      /*
       * IMPORTANTE:
       *
       * utilizamos o cliente do usuário.
       *
       * Assim auth.uid() dentro da função
       * reservar_upload() continua sendo
       * a identidade autenticada real.
       */
      const {
        data: reserva,
        error: erroReserva,
      } =
        await ctx.supabase
          .schema("biblia_slides")
          .rpc(
            "reservar_upload",
            {
              p_caminho:
                caminho,

              p_arquivo_bytes:
                arquivoBytes,
            },
          )
          .single();

      if (erroReserva) {
        console.error(
          "Erro ao reservar espaço:",
          erroReserva,
        );

        return Response.json(
          {
            ok: false,
            erro:
              "Não foi possível reservar espaço para o arquivo.",
          },
          { status: 500 },
        );
      }

      if (!reserva?.permitido) {
        return Response.json(
          {
            ok: false,

            codigo:
              reserva?.codigo ??
              "UPLOAD_NEGADO",

            erro:
              reserva?.mensagem ??
              "O upload não foi autorizado.",

            armazenamento: {
              planoCodigo:
                reserva?.plano_codigo ??
                null,

              planoNome:
                reserva?.plano_nome ??
                null,

              limiteBytes:
                reserva
                  ?.limite_total_bytes ??
                0,

              usadoBytes:
                reserva
                  ?.usado_bytes ??
                0,

              reservadoBytes:
                reserva
                  ?.reservado_bytes ??
                0,

              disponivelBytes:
                reserva
                  ?.disponivel_antes ??
                0,
            },
          },
          {
            status:
              statusPorCodigo(
                reserva?.codigo,
              ),
          },
        );
      }

      /*
       * Não geramos mais signed upload URL.
       *
       * O upload real será autenticado e
       * submetido à policy RLS do Storage.
       */
      return Response.json({
        ok: true,

        codigo:
          "UPLOAD_AUTORIZADO",

        reservaId:
          reserva.reserva_id,

        caminho:
          reserva.caminho,

        arquivoBytes:
          reserva.arquivo_bytes,

        expiraEm:
          reserva.expira_em,

        armazenamento: {
          planoCodigo:
            reserva.plano_codigo,

          planoNome:
            reserva.plano_nome,

          limiteBytes:
            reserva.limite_total_bytes,

          usadoBytes:
            reserva.usado_bytes,

          reservadoBytes:
            reserva.reservado_bytes,

          disponivelAntes:
            reserva.disponivel_antes,

          disponivelApos:
            reserva.disponivel_apos,

          limiteArquivoBytes:
            reserva.limite_arquivo_bytes,
        },
      });
    },
  ),
};
