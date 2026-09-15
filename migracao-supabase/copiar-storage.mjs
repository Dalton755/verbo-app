import { createClient } from "@supabase/supabase-js";

const bucket = "biblia-slides-pdfs";

const antigo = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const novo = createClient(
  "https://neqbrwzkrnkyxxaiwhoq.supabase.co",
  process.env.SUPABASE_NEW_SECRET
);

async function listarTodos(client, caminho = "") {
  const { data, error } =
    await client.storage
      .from(bucket)
      .list(caminho, {
        limit: 1000,
        sortBy: {
          column: "name",
          order: "asc",
        },
      });

  if (error) {
    throw error;
  }

  const arquivos = [];

  for (const item of data ?? []) {
    const caminhoCompleto =
      caminho
        ? `${caminho}/${item.name}`
        : item.name;

    if (item.id) {
      arquivos.push({
        path: caminhoCompleto,
        size: Number(item.metadata?.size ?? 0),
      });
    } else {
      const filhos =
        await listarTodos(
          client,
          caminhoCompleto
        );

      arquivos.push(...filhos);
    }
  }

  return arquivos;
}

const origem = await listarTodos(antigo);

console.log(
  "Arquivos encontrados no projeto antigo:",
  origem.length
);

let copiados = 0;
let bytesCopiados = 0;

for (const arquivo of origem) {
  console.log(
    `Copiando ${copiados + 1}/${origem.length}:`,
    arquivo.path
  );

  const { data: blob, error: downloadError } =
    await antigo.storage
      .from(bucket)
      .download(arquivo.path);

  if (downloadError) {
    throw new Error(
      `Erro ao baixar ${arquivo.path}: ${downloadError.message}`
    );
  }

  const buffer =
    Buffer.from(
      await blob.arrayBuffer()
    );

  const { error: uploadError } =
    await novo.storage
      .from(bucket)
      .upload(
        arquivo.path,
        buffer,
        {
          contentType: "application/pdf",
          upsert: true,
        }
      );

  if (uploadError) {
    throw new Error(
      `Erro ao enviar ${arquivo.path}: ${uploadError.message}`
    );
  }

  copiados++;
  bytesCopiados += buffer.length;
}

const destino = await listarTodos(novo);

console.log("");
console.log("RESULTADO");
console.log("Origem:", origem.length);
console.log("Copiados:", copiados);
console.log("Destino:", destino.length);
console.log(
  "Tamanho copiado:",
  (bytesCopiados / 1024 / 1024).toFixed(2),
  "MB"
);

if (
  origem.length !== copiados ||
  origem.length !== destino.length
) {
  throw new Error(
    "A quantidade de arquivos não confere."
  );
}

console.log(
  "Storage migrado com sucesso."
);
