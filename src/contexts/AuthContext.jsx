import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { supabase } from "../lib/supabase";

import {
  existeOAuthPendente,
  inicializarModulosOAuth,
  limparOAuthPendente,
  obterModuloInicial,
  salvarOAuthPendente,
} from "../lib/oauthGoogle";

const AuthContext = createContext(null);

const PREFIXO_SESSAO =
  "verbo-sessao-ativa:";

function chaveSessao(usuarioId) {
  return `${PREFIXO_SESSAO}${usuarioId}`;
}

function lerSessaoLocal(usuarioId) {
  try {
    return localStorage.getItem(
      chaveSessao(usuarioId),
    );
  } catch {
    return null;
  }
}

function salvarSessaoLocal(
  usuarioId,
  sessaoId,
) {
  try {
    localStorage.setItem(
      chaveSessao(usuarioId),
      sessaoId,
    );
  } catch {
    // Não impede o login.
  }
}

function removerSessaoLocal(
  usuarioId,
) {
  try {
    localStorage.removeItem(
      chaveSessao(usuarioId),
    );
  } catch {
    // Ignora.
  }
}

function identificarDispositivo() {
  const userAgent =
    navigator.userAgent || "";

  if (
    /android/i.test(userAgent)
  ) {
    return "Android";
  }

  if (
    /iphone|ipad|ipod/i.test(
      userAgent,
    )
  ) {
    return "iPhone/iPad";
  }

  if (
    /windows/i.test(userAgent)
  ) {
    return "Windows";
  }

  if (
    /macintosh|mac os/i.test(
      userAgent,
    )
  ) {
    return "Mac";
  }

  if (
    /linux/i.test(userAgent)
  ) {
    return "Linux";
  }

  return "Dispositivo";
}

export function AuthProvider({
  children,
}) {
  const [
    session,
    setSession,
  ] = useState(null);

  const [
    user,
    setUser,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const verificandoRef =
    useRef(false);

  async function registrarEntradaApp() {
    try {
      await supabase
        .schema("biblia_slides")
        .rpc("registrar_entrada_app");
    } catch (error) {
      console.debug(
        "Não foi possível registrar a entrada no painel:",
        error,
      );
    }
  }

  async function garantirProfile(
    usuario,
  ) {
    if (!usuario) return;

    const nome =
      usuario.user_metadata?.nome ||
      usuario.user_metadata
        ?.full_name ||
      "";

    const { error } =
      await supabase
        .from("profiles")
        .upsert(
          {
            id: usuario.id,
            nome,
            email:
              usuario.email,
          },
          {
            onConflict: "id",
          },
        );

    if (error) {
      console.error(
        "Erro ao garantir profile:",
        error,
      );
    }
  }

  async function registrarSessaoAtiva(
    usuario,
  ) {
    if (!usuario) {
      return {
        ok: false,
      };
    }

    const sessaoId =
      crypto.randomUUID();

    const agora =
      new Date()
        .toISOString();

    const {
      error,
    } = await supabase
      .from("sessoes_ativas")
      .upsert(
        {
          usuario_id:
            usuario.id,

          sessao_id:
            sessaoId,

          dispositivo:
            identificarDispositivo(),

          criada_em:
            agora,

          ultima_atividade_em:
            agora,

          updated_at:
            agora,
        },
        {
          onConflict:
            "usuario_id",
        },
      );

    if (error) {
      console.error(
        "Erro ao registrar sessão ativa:",
        error,
      );

      return {
        ok: false,
        error,
      };
    }

    salvarSessaoLocal(
      usuario.id,
      sessaoId,
    );

    return {
      ok: true,
      sessaoId,
    };
  }

  async function encerrarSessaoLocal(
    usuario,
  ) {
    if (usuario?.id) {
      removerSessaoLocal(
        usuario.id,
      );
    }

    /*
     * IMPORTANTE:
     *
     * scope "local" remove somente
     * esta sessão do aparelho.
     *
     * Não devemos usar logout global,
     * pois isso derrubaria também
     * o aparelho que acabou de entrar.
     */
    await supabase.auth.signOut({
      scope: "local",
    });

    setSession(null);
    setUser(null);

    window.location.replace(
      "/login?motivo=sessao-substituida",
    );
  }

  async function verificarSessaoAtiva(
    usuario,
  ) {
    if (
      !usuario ||
      verificandoRef.current
    ) {
      return;
    }

    /*
     * Offline:
     *
     * não interpretamos falta de
     * internet como sessão inválida.
     */
    if (!navigator.onLine) {
      return;
    }

    verificandoRef.current =
      true;

    try {
      const sessaoLocal =
        lerSessaoLocal(
          usuario.id,
        );

      const {
        data,
        error,
      } = await supabase
        .from("sessoes_ativas")
        .select(`
          usuario_id,
          sessao_id
        `)
        .eq(
          "usuario_id",
          usuario.id,
        )
        .maybeSingle();

      /*
       * Falha de rede ou Supabase:
       * mantemos o usuário conectado.
       */
      if (error) {
        console.debug(
          "Não foi possível verificar a sessão agora:",
          error,
        );

        return;
      }

      /*
       * Migração de usuários que já
       * estavam logados antes deste
       * recurso existir.
       *
       * Se não existe registro no banco
       * nem ID local, este aparelho
       * assume a sessão oficial.
       */
      if (
        !data &&
        !sessaoLocal
      ) {
        await registrarSessaoAtiva(
          usuario,
        );

        return;
      }

      /*
       * Existe ID local, mas a sessão
       * oficial foi apagada.
       *
       * Não recriamos automaticamente,
       * pois ela pode ter sido encerrada
       * propositalmente.
       */
      if (
        !data &&
        sessaoLocal
      ) {
        await encerrarSessaoLocal(
          usuario,
        );

        return;
      }

      /*
       * Existe uma sessão oficial no
       * banco, mas este aparelho não
       * possui seu identificador.
       */
      if (
        data &&
        !sessaoLocal
      ) {
        await encerrarSessaoLocal(
          usuario,
        );

        return;
      }

      /*
       * O ID do aparelho não é mais
       * o ID oficial.
       *
       * Outro dispositivo entrou.
       */
      if (
        String(
          data.sessao_id,
        ) !==
        String(
          sessaoLocal,
        )
      ) {
        await encerrarSessaoLocal(
          usuario,
        );

        return;
      }

      /*
       * Sessão válida.
       * Atualiza presença.
       */
      const agora =
        new Date()
          .toISOString();

      await supabase
        .from("sessoes_ativas")
        .update({
          ultima_atividade_em:
            agora,

          updated_at:
            agora,
        })
        .eq(
          "usuario_id",
          usuario.id,
        )
        .eq(
          "sessao_id",
          sessaoLocal,
        );
    } catch (error) {
      /*
       * Uma exceção de rede nunca deve
       * derrubar acesso offline.
       */
      console.debug(
        "Verificação de sessão indisponível:",
        error,
      );
    } finally {
      verificandoRef.current =
        false;
    }
  }

  useEffect(() => {
    let ativo = true;

    async function carregarSessao() {
      const {
        data: {
          session:
          sessaoAtual,
        },
      } =
        await supabase.auth
          .getSession();

      if (!ativo) return;

      if (
        sessaoAtual?.user
      ) {
        await garantirProfile(
          sessaoAtual.user,
        );

        await registrarEntradaApp();

        if (
          existeOAuthPendente()
        ) {
          const registro =
            await registrarSessaoAtiva(
              sessaoAtual.user,
            );

          if (!registro.ok) {
            await supabase.auth
              .signOut({
                scope: "local",
              });

            setSession(null);
            setUser(null);
            setLoading(false);

            return;
          }

          const inicializacao =
            await inicializarModulosOAuth(
              obterModuloInicial(),
            );

          if (inicializacao.ok) {
            limparOAuthPendente();
          }
        } else {
          await verificarSessaoAtiva(
            sessaoAtual.user,
          );
        }

        if (!ativo) {
          return;
        }
      }

      setSession(
        sessaoAtual,
      );

      setUser(
        sessaoAtual?.user ??
        null,
      );

      setLoading(false);
    }

    carregarSessao();

    const {
      data: {
        subscription,
      },
    } =
      supabase.auth
        .onAuthStateChange(
          (
            _event,
            novaSessao,
          ) => {
            setSession(
              novaSessao,
            );

            setUser(
              novaSessao?.user ??
              null,
            );

            setLoading(false);

            if (
              novaSessao?.user
            ) {
              setTimeout(
                () => {
                  garantirProfile(
                    novaSessao.user,
                  );

                  registrarEntradaApp();
                },
                0,
              );
            }
          },
        );

    return () => {
      ativo = false;

      subscription
        .unsubscribe();
    };
  }, []);

  /*
   * Verificação periódica.
   *
   * Também verifica quando o app
   * volta para primeiro plano ou
   * recupera a internet.
   */
  useEffect(() => {
    if (!user) {
      return;
    }

    const verificar = () => {
      verificarSessaoAtiva(
        user,
      );
    };

    const aoFocar =
      () => verificar();

    const aoVoltarOnline =
      () => verificar();

    const aoMudarVisibilidade =
      () => {
        if (
          document
            .visibilityState ===
          "visible"
        ) {
          verificar();
        }
      };

    const intervalo =
      window.setInterval(
        verificar,
        60000,
      );

    window.addEventListener(
      "focus",
      aoFocar,
    );

    window.addEventListener(
      "online",
      aoVoltarOnline,
    );

    document.addEventListener(
      "visibilitychange",
      aoMudarVisibilidade,
    );

    return () => {
      window.clearInterval(
        intervalo,
      );

      window.removeEventListener(
        "focus",
        aoFocar,
      );

      window.removeEventListener(
        "online",
        aoVoltarOnline,
      );

      document.removeEventListener(
        "visibilitychange",
        aoMudarVisibilidade,
      );
    };
  }, [
    user,
  ]);

  async function entrarComGoogle(
    moduloInicial = "TODOS",
  ) {
    salvarOAuthPendente(
      moduloInicial,
    );

    const resultado =
      await supabase.auth
        .signInWithOAuth({
          provider: "google",

          options: {
            redirectTo:
              `${window.location.origin}/`,
          },
        });

    if (resultado.error) {
      limparOAuthPendente();
    }

    return resultado;
  }

  async function entrar(
    email,
    senha,
  ) {
    const resultado =
      await supabase.auth
        .signInWithPassword({
          email,
          password:
            senha,
        });

    if (
      resultado.error ||
      !resultado.data
        ?.user
    ) {
      return resultado;
    }

    await garantirProfile(
      resultado.data.user,
    );

    const registro =
      await registrarSessaoAtiva(
        resultado.data.user,
      );

    if (!registro.ok) {
      await supabase.auth
        .signOut({
          scope: "local",
        });

      return {
        data: null,

        error:
          registro.error ??
          new Error(
            "Não foi possível registrar esta sessão.",
          ),
      };
    }

    return resultado;
  }

  async function cadastrar(
    nome,
    email,
    senha,
  ) {
    const resultado =
      await supabase.auth
        .signUp({
          email,
          password:
            senha,

          options: {
            data: {
              nome,
            },
          },
        });

    if (
      resultado.error ||
      !resultado.data
        ?.session ||
      !resultado.data
        ?.user
    ) {
      return resultado;
    }

    await garantirProfile(
      resultado.data.user,
    );

    const registro =
      await registrarSessaoAtiva(
        resultado.data.user,
      );

    if (!registro.ok) {
      await supabase.auth
        .signOut({
          scope: "local",
        });

      return {
        data: null,

        error:
          registro.error ??
          new Error(
            "Não foi possível registrar esta sessão.",
          ),
      };
    }

    return resultado;
  }

  async function recuperarSenha(
    email,
  ) {
    return await supabase.auth
      .resetPasswordForEmail(
        email,
        {
          redirectTo:
            `${window.location.origin}/redefinir-senha`,
        },
      );
  }

  async function atualizarSenha(
    novaSenha,
  ) {
    return await supabase.auth
      .updateUser({
        password:
          novaSenha,
      });
  }

  async function sair() {
    const usuarioAtual =
      user;

    const sessaoLocal =
      usuarioAtual
        ? lerSessaoLocal(
          usuarioAtual.id,
        )
        : null;

    /*
     * Só remove a sessão do banco
     * se ela ainda for a sessão
     * oficial deste aparelho.
     */
    if (
      usuarioAtual &&
      sessaoLocal &&
      navigator.onLine
    ) {
      try {
        await supabase
          .from(
            "sessoes_ativas",
          )
          .delete()
          .eq(
            "usuario_id",
            usuarioAtual.id,
          )
          .eq(
            "sessao_id",
            sessaoLocal,
          );
      } catch {
        // O logout local continua.
      }
    }

    if (usuarioAtual) {
      removerSessaoLocal(
        usuarioAtual.id,
      );
    }

    return await supabase.auth
      .signOut({
        scope: "local",
      });
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        entrarComGoogle,
        entrar,
        cadastrar,
        recuperarSenha,
        atualizarSenha,
        sair,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const contexto =
    useContext(
      AuthContext,
    );

  if (!contexto) {
    throw new Error(
      "useAuth precisa estar dentro de AuthProvider.",
    );
  }

  return contexto;
}