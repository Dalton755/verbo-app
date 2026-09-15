import dotenv from "dotenv";
import { load } from "cheerio";
import { createClient } from "@supabase/supabase-js";

dotenv.config({
    path: ".env.import",
    quiet: true,
});

const {
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
} = process.env;

if (
    !SUPABASE_URL ||
    !SUPABASE_SERVICE_ROLE_KEY
) {
    throw new Error(
        "SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados.",
    );
}

const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
        db: {
            schema: "biblia_slides",
        },

        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    },
);

const LIVROS = [
    ["GN", "Gênesis", "genesis", 50],
    ["EX", "Êxodo", "exodo", 40],
    ["LV", "Levítico", "levitico", 27],
    ["NM", "Números", "numeros", 36],
    ["DT", "Deuteronômio", "deuteronomio", 34],
    ["JS", "Josué", "josue", 24],
    ["JZ", "Juízes", "juizes", 21],
    ["RT", "Rute", "rute", 4],
    ["1SM", "1 Samuel", "1-samuel", 31],
    ["2SM", "2 Samuel", "2-samuel", 24],
    ["1RS", "1 Reis", "1-reis", 22],
    ["2RS", "2 Reis", "2-reis", 25],
    ["1CR", "1 Crônicas", "1-cronicas", 29],
    ["2CR", "2 Crônicas", "2-cronicas", 36],
    ["ED", "Esdras", "esdras", 10],
    ["NE", "Neemias", "neemias", 13],
    ["ET", "Ester", "ester", 10],
    ["JO", "Jó", "jo", 42],
    ["SL", "Salmos", "salmos", 150],
    ["PV", "Provérbios", "proverbios", 31],
    ["EC", "Eclesiastes", "eclesiastes", 12],
    ["CT", "Cânticos", "canticos", 8],
    ["IS", "Isaías", "isaias", 66],
    ["JR", "Jeremias", "jeremias", 52],
    ["LM", "Lamentações", "lamentacoes-de-jeremias", 5],
    ["EZ", "Ezequiel", "ezequiel", 48],
    ["DN", "Daniel", "daniel", 12],
    ["OS", "Oseias", "oseias", 14],
    ["JL", "Joel", "joel", 3],
    ["AM", "Amós", "amos", 9],
    ["OB", "Obadias", "obadias", 1],
    ["JN", "Jonas", "jonas", 4],
    ["MQ", "Miqueias", "miqueias", 7],
    ["NA", "Naum", "naum", 3],
    ["HC", "Habacuque", "habacuque", 3],
    ["SF", "Sofonias", "sofonias", 3],
    ["AG", "Ageu", "ageu", 2],
    ["ZC", "Zacarias", "zacarias", 14],
    ["ML", "Malaquias", "malaquias", 4],

    ["MT", "Mateus", "mateus", 28],
    ["MC", "Marcos", "marcos", 16],
    ["LC", "Lucas", "lucas", 24],
    ["JOA", "João", "joao", 21],
    ["AT", "Atos", "atos", 28],
    ["RM", "Romanos", "romanos", 16],
    ["1CO", "1 Coríntios", "1-corintios", 16],
    ["2CO", "2 Coríntios", "2-corintios", 13],
    ["GL", "Gálatas", "galatas", 6],
    ["EF", "Efésios", "efesios", 6],
    ["FP", "Filipenses", "filipenses", 4],
    ["CL", "Colossenses", "colossenses", 4],
    ["1TS", "1 Tessalonicenses", "1-tessalonicenses", 5],
    ["2TS", "2 Tessalonicenses", "2-tessalonicenses", 3],
    ["1TM", "1 Timóteo", "1-timoteo", 6],
    ["2TM", "2 Timóteo", "2-timoteo", 4],
    ["TT", "Tito", "tito", 3],
    ["FM", "Filemom", "filemom", 1],
    ["HB", "Hebreus", "hebreus", 13],
    ["TG", "Tiago", "tiago", 5],
    ["1PE", "1 Pedro", "1-pedro", 5],
    ["2PE", "2 Pedro", "2-pedro", 3],
    ["1JO", "1 João", "1-joao", 5],
    ["2JO", "2 João", "2-joao", 1],
    ["3JO", "3 João", "3-joao", 1],
    ["JD", "Judas", "judas", 1],
    ["AP", "Apocalipse", "apocalipse", 22],
].map(
    ([codigo, nome, slug, capitulos], indice) => ({
        ordem: indice + 1,
        codigo,
        nome,
        slug,
        capitulos,
    }),
);

const ESPERA_MS = 450;
const MAX_TENTATIVAS = 3;

function esperar(ms) {
    return new Promise(
        (resolve) => setTimeout(resolve, ms),
    );
}

function limparTexto(texto = "") {
    return texto
        .replace(/\s+/g, " ")
        .trim();
}

function extrairVersiculos(html) {
    const $ = load(html);

    const encontrados = new Map();

    $("button").each((_, elemento) => {
        const botao = $(elemento);

        const numeroTexto =
            limparTexto(botao.text());

        if (
            !/^\d{1,3}$/.test(numeroTexto)
        ) {
            return;
        }

        const numero =
            Number(numeroTexto);

        const pai = botao.parent();

        const botoesNumericos =
            pai
                .find("button")
                .filter((_, item) =>
                    /^\d{1,3}$/.test(
                        limparTexto(
                            $(item).text(),
                        ),
                    ),
                );

        if (
            botoesNumericos.length !== 1
        ) {
            return;
        }

        const clone = pai.clone();

        clone
            .find("button")
            .first()
            .remove();

        const texto =
            limparTexto(clone.text());

        if (!texto) {
            return;
        }

        if (
            !/[A-Za-zÀ-ÿ]/u.test(texto)
        ) {
            return;
        }

        encontrados.set(
            numero,
            texto,
        );
    });

    return Array
        .from(
            encontrados.entries(),
        )
        .map(
            ([versiculo, texto]) => ({
                versiculo,
                texto,
            }),
        )
        .sort(
            (a, b) =>
                a.versiculo -
                b.versiculo,
        );
}

async function baixarPagina(url) {
    let ultimoErro;

    for (
        let tentativa = 1;
        tentativa <= MAX_TENTATIVAS;
        tentativa += 1
    ) {
        try {
            const response =
                await fetch(
                    url,
                    {
                        headers: {
                            "User-Agent":
                                "BibliaSlidesImporter/1.0",
                        },
                    },
                );

            if (!response.ok) {
                throw new Error(
                    `HTTP ${response.status}`,
                );
            }

            return await response.text();
        } catch (error) {
            ultimoErro = error;

            console.warn(
                `    tentativa ${tentativa}/${MAX_TENTATIVAS} falhou: ${error.message}`,
            );

            if (
                tentativa <
                MAX_TENTATIVAS
            ) {
                await esperar(
                    tentativa * 1500,
                );
            }
        }
    }

    throw ultimoErro;
}

async function importarCapitulo(
    livro,
    capitulo,
) {
    const url =
        `https://bibliaalmeida.com/${livro.slug}/${capitulo}/`;

    let versos = [];

    /*
     * Às vezes a página responde 200,
     * mas vem sem os versículos.
     *
     * Tentamos novamente antes de
     * considerar o capítulo pendente.
     */
    for (
        let tentativa = 1;
        tentativa <= 3;
        tentativa += 1
    ) {
        const html =
            await baixarPagina(url);

        versos =
            extrairVersiculos(html);

        if (versos.length > 0) {
            break;
        }

        if (tentativa < 3) {
            console.warn(
                `fonte vazia, nova tentativa ${tentativa + 1}/3...`,
            );

            await esperar(
                tentativa * 1500,
            );
        }
    }

    /*
     * Não interrompe a Bíblia inteira
     * por causa de uma página ruim.
     */
    if (versos.length === 0) {
        return {
            pendente: true,
            quantidade: 0,
            url,
        };
    }

    const registros =
        versos.map(
            (item) => ({
                livro_ordem:
                    livro.ordem,

                livro_codigo:
                    livro.codigo,

                livro_nome:
                    livro.nome,

                livro_slug:
                    livro.slug,

                capitulo,

                versiculo:
                    item.versiculo,

                texto:
                    item.texto,

                versao:
                    "ALM1911_ATUAL",

                fonte_url:
                    url,
            }),
        );

    const { error } =
        await supabase
            .from("versiculos")
            .upsert(
                registros,
                {
                    onConflict:
                        "versao,livro_codigo,capitulo,versiculo",
                },
            );

    if (error) {
        throw error;
    }

    return {
        pendente: false,
        quantidade: versos.length,
        url,
    };
}

async function obterQuantidadeAtual() {
    const {
        count,
        error,
    } = await supabase
        .from("versiculos")
        .select(
            "id",
            {
                count: "exact",
                head: true,
            },
        )
        .eq(
            "versao",
            "ALM1911_ATUAL",
        );

    if (error) {
        throw error;
    }

    return count ?? 0;
}

async function executar() {
    console.log("");
    console.log(
        "IMPORTAÇÃO BÍBLICA — Almeida 1911",
    );

    console.log(
        "Ortografia atualizada",
    );

    console.log("");

    const inicio = Date.now();

    let capitulosImportados = 0;
    let versosImportados = 0;
    const capitulosPendentes = [];

    for (const livro of LIVROS) {
        console.log("");
        console.log(
            `=== ${livro.ordem}/66 ${livro.nome} ===`,
        );

        for (
            let capitulo = 1;
            capitulo <= livro.capitulos;
            capitulo += 1
        ) {
            process.stdout.write(
                `  ${livro.nome} ${capitulo}/${livro.capitulos}... `,
            );

            try {
                const resultado =
                    await importarCapitulo(
                        livro,
                        capitulo,
                    );

                if (resultado.pendente) {
                    capitulosPendentes.push({
                        livro:
                            livro.nome,

                        codigo:
                            livro.codigo,

                        capitulo,

                        url:
                            resultado.url,
                    });

                    console.log(
                        "PENDENTE (fonte sem versículos)",
                    );
                } else {
                    capitulosImportados += 1;

                    versosImportados +=
                        resultado.quantidade;

                    console.log(
                        `OK (${resultado.quantidade})`,
                    );
                }
            } catch (error) {
                console.log("ERRO");

                console.error(
                    `  Falha em ${livro.nome} ${capitulo}:`,
                    error.message,
                );

                console.error("");
                console.error(
                    "Importação interrompida.",
                );

                console.error(
                    "Corrija o problema e execute novamente.",
                );

                /*
                 * Como usamos UPSERT, tudo que já
                 * foi importado permanece seguro.
                 */
                process.exit(1);
            }

            await esperar(
                ESPERA_MS,
            );
        }
    }

    const totalBanco =
        await obterQuantidadeAtual();

    const duracaoSegundos =
        Math.round(
            (Date.now() - inicio) /
            1000,
        );

    console.log("");
    console.log(
        "================================",
    );

    console.log(
        capitulosPendentes.length === 0
            ? "IMPORTAÇÃO CONCLUÍDA"
            : "IMPORTAÇÃO CONCLUÍDA COM PENDÊNCIAS",
    );

    console.log(
        `Capítulos processados: ${capitulosImportados}`,
    );

    console.log(
        `Versículos processados nesta execução: ${versosImportados}`,
    );

    console.log(
        `Versículos no banco: ${totalBanco}`,
    );

    console.log(
        `Tempo: ${duracaoSegundos}s`,
    );

    console.log(
        `Capítulos pendentes: ${capitulosPendentes.length}`,
    );

    if (capitulosPendentes.length > 0) {
        console.log("");
        console.log(
            "CAPÍTULOS PENDENTES:",
        );

        console.table(
            capitulosPendentes,
        );
    }

    console.log(
        "================================",
    );
}

executar()
    .catch((error) => {
        console.error("");
        console.error(
            "ERRO FATAL:",
            error,
        );

        process.exit(1);
    });
