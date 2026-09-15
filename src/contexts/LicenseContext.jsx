import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";

const LicenseContext = createContext(null);

export function LicenseProvider({ children }) {
  const { user } = useAuth();

  /*
   * temLicenca continua existindo por compatibilidade.
   *
   * A partir de agora ele significa:
   * "o usuário possui acesso ao app"
   *
   * Isso inclui:
   * - período gratuito de 7 dias;
   * - licença vitalícia.
   */
  const [temLicenca, setTemLicenca] =
    useState(false);

  const [estadoAcesso, setEstadoAcesso] =
    useState(null);

  const [
    testeIniciadoEm,
    setTesteIniciadoEm,
  ] = useState(null);

  const [
    testeExpiraEm,
    setTesteExpiraEm,
  ] = useState(null);

  const [
    segundosRestantes,
    setSegundosRestantes,
  ] = useState(null);

  const [
    licencaVitalicia,
    setLicencaVitalicia,
  ] = useState(false);

  const [
    usuarioLicencaVerificado,
    setUsuarioLicencaVerificado,
  ] = useState(null);

  const [
    carregandoLicenca,
    setCarregandoLicenca,
  ] = useState(false);

  const [erroLicenca, setErroLicenca] =
    useState("");

  const limparAcesso = useCallback(() => {
    setTemLicenca(false);
    setEstadoAcesso(null);
    setTesteIniciadoEm(null);
    setTesteExpiraEm(null);
    setSegundosRestantes(null);
    setLicencaVitalicia(false);
  }, []);

  const carregarLicenca = useCallback(
    async () => {
      if (!user) {
        limparAcesso();

        setUsuarioLicencaVerificado(null);
        setCarregandoLicenca(false);
        setErroLicenca("");

        return;
      }

      setCarregandoLicenca(true);
      setErroLicenca("");

      try {
        const {
          data,
          error,
        } =
          await supabase.rpc(
            "meu_acesso_app"
          );

        if (error) {
          throw error;
        }

        /*
         * Funções RETURNS TABLE do PostgreSQL
         * normalmente chegam como array.
         */
        const acesso =
          Array.isArray(data)
            ? data[0]
            : data;

        if (!acesso) {
          throw new Error(
            "Estado de acesso não encontrado."
          );
        }

        setTemLicenca(
          acesso.tem_acesso === true
        );

        setEstadoAcesso(
          acesso.estado ?? null
        );

        setTesteIniciadoEm(
          acesso.teste_iniciado_em ?? null
        );

        setTesteExpiraEm(
          acesso.teste_expira_em ?? null
        );

        setSegundosRestantes(
          acesso.segundos_restantes ??
            null
        );

        setLicencaVitalicia(
          acesso.licenca_vitalicia === true
        );

        setUsuarioLicencaVerificado(
          user.id
        );
      } catch (error) {
        console.error(
          "Erro ao consultar acesso:",
          error
        );

        limparAcesso();

        setUsuarioLicencaVerificado(
          user.id
        );

        setErroLicenca(
          "Não foi possível verificar seu acesso."
        );
      } finally {
        setCarregandoLicenca(false);
      }
    },
    [
      user,
      limparAcesso,
    ]
  );

  useEffect(() => {
    carregarLicenca();
  }, [carregarLicenca]);

  /*
   * Contagem visual local.
   *
   * O banco continua sendo a autoridade.
   * Esta contagem serve apenas para UI.
   */
  useEffect(() => {
    if (
      estadoAcesso !== "TESTE" ||
      !testeExpiraEm
    ) {
      return;
    }

    function atualizarContagem() {
      const agora =
        Date.now();

      const expira =
        new Date(
          testeExpiraEm
        ).getTime();

      const restantes =
        Math.max(
          0,
          Math.floor(
            (expira - agora) / 1000
          )
        );

      setSegundosRestantes(
        restantes
      );

      /*
       * Ao chegar a zero consultamos
       * novamente o banco.
       */
      if (restantes === 0) {
        carregarLicenca();
      }
    }

    atualizarContagem();

    const intervalo =
      setInterval(
        atualizarContagem,
        60 * 1000
      );

    return () => {
      clearInterval(intervalo);
    };
  }, [
    estadoAcesso,
    testeExpiraEm,
    carregarLicenca,
  ]);

  const diasRestantes =
    useMemo(() => {
      if (
        estadoAcesso !== "TESTE" ||
        segundosRestantes === null
      ) {
        return null;
      }

      return Math.max(
        0,
        Math.ceil(
          segundosRestantes /
            86400
        )
      );
    }, [
      estadoAcesso,
      segundosRestantes,
    ]);

  const carregando =
    Boolean(user) &&
    (
      carregandoLicenca ||
      usuarioLicencaVerificado !==
        user.id
    );

  return (
    <LicenseContext.Provider
      value={{
        /*
         * Compatibilidade com o código antigo.
         */
        temLicenca,

        carregandoLicenca:
          carregando,

        erroLicenca,

        recarregarLicenca:
          carregarLicenca,

        /*
         * Nova API de acesso.
         */
        temAcesso:
          temLicenca,

        estadoAcesso,

        emTeste:
          estadoAcesso === "TESTE",

        acessoVitalicio:
          estadoAcesso ===
            "VITALICIO",

        acessoExpirado:
          estadoAcesso ===
            "EXPIRADO",

        testeIniciadoEm,

        testeExpiraEm,

        segundosRestantes,

        diasRestantes,

        licencaVitalicia,
      }}
    >
      {children}
    </LicenseContext.Provider>
  );
}

export function useLicense() {
  const context =
    useContext(LicenseContext);

  if (!context) {
    throw new Error(
      "useLicense deve ser usado dentro de LicenseProvider."
    );
  }

  return context;
}