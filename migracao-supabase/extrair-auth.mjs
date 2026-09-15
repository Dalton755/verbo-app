import fs from "node:fs";

const origem =
  "./migracao-supabase/TEMP-auth-all.sql";

const destino =
  "./migracao-supabase/03-biblia-slides-auth.sql";

const usuariosBibliaSlides = new Set([
  "e227eeb7-1c01-4cfa-9c62-44a661977e8f",
  "202b1f78-f778-40bc-aa89-4557322a6b11",
  "4e884024-771a-4ee6-a8cf-bc63c84c67d8",
  "df098e45-d0de-4467-a7e7-c96ee3919159",
]);

const linhas =
  fs.readFileSync(origem, "utf8").split(/\r?\n/);

function extrairCopy(tabela, indiceUsuario) {
  const prefixo = `COPY "auth"."${tabela}" `;

  const inicio =
    linhas.findIndex((linha) =>
      linha.startsWith(prefixo)
    );

  if (inicio === -1) {
    throw new Error(
      `Bloco COPY não encontrado: ${tabela}`
    );
  }

  const cabecalho = linhas[inicio];
  const registros = [];

  for (
    let i = inicio + 1;
    i < linhas.length;
    i++
  ) {
    const linha = linhas[i];

    if (linha === "\\.") {
      break;
    }

    if (!linha) {
      continue;
    }

    const campos = linha.split("\t");

    if (
      usuariosBibliaSlides.has(
        campos[indiceUsuario]
      )
    ) {
      registros.push(linha);
    }
  }

  return {
    cabecalho,
    registros,
  };
}

const users =
  extrairCopy("users", 1);

const identities =
  extrairCopy("identities", 1);

const provedores = {};

for (const linha of identities.registros) {
  const campos = linha.split("\t");
  const provider = campos[3] ?? "desconhecido";

  provedores[provider] =
    (provedores[provider] ?? 0) + 1;
}

const saida = [
  "-- Biblia Slides - Auth selecionado",
  "-- Contem somente users e identities.",
  "-- Nao contem sessoes nem refresh tokens.",
  "",
  users.cabecalho,
  ...users.registros,
  "\\.",
  "",
  identities.cabecalho,
  ...identities.registros,
  "\\.",
  "",
].join("\n");

fs.writeFileSync(
  destino,
  saida,
  "utf8"
);

console.log(
  "Usuarios selecionados:",
  users.registros.length
);

console.log(
  "Identidades selecionadas:",
  identities.registros.length
);

console.log(
  "Provedores:",
  provedores
);

console.log(
  "Arquivo criado:",
  destino
);
