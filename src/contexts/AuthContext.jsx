import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function garantirProfile(usuario) {
    if (!usuario) return;

    const nome =
      usuario.user_metadata?.nome ||
      usuario.user_metadata?.full_name ||
      "";

    const { error } = await supabase
      .from("profiles")
      .upsert(
        {
          id: usuario.id,
          nome,
          email: usuario.email,
        },
        {
          onConflict: "id",
        },
      );

    if (error) {
      console.error("Erro ao garantir profile:", error);
    }
  }

  useEffect(() => {
    let ativo = true;

    async function carregarSessao() {
      const {
        data: { session: sessaoAtual },
      } = await supabase.auth.getSession();

      if (!ativo) return;

      setSession(sessaoAtual);
      setUser(sessaoAtual?.user ?? null);
      setLoading(false);

      if (sessaoAtual?.user) {
        await garantirProfile(sessaoAtual.user);
      }
    }

    carregarSessao();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, novaSessao) => {
      setSession(novaSessao);
      setUser(novaSessao?.user ?? null);
      setLoading(false);

      if (novaSessao?.user) {
        setTimeout(() => {
          garantirProfile(novaSessao.user);
        }, 0);
      }
    });

    return () => {
      ativo = false;
      subscription.unsubscribe();
    };
  }, []);

  async function entrar(email, senha) {
    return await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });
  }

  async function cadastrar(nome, email, senha) {
    return await supabase.auth.signUp({
      email,
      password: senha,

      options: {
        data: {
          nome,
        },
      },
    });
  }

  async function recuperarSenha(email) {
    return await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      },
    );
  }

  async function atualizarSenha(novaSenha) {
    return await supabase.auth.updateUser({
      password: novaSenha,
    });
  }

  async function sair() {
    return await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
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
  const contexto = useContext(AuthContext);

  if (!contexto) {
    throw new Error("useAuth precisa estar dentro de AuthProvider.");
  }

  return contexto;
}