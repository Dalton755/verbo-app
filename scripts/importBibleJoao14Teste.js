import dotenv from "dotenv";
import { load } from "cheerio";
import { createClient } from "@supabase/supabase-js";

dotenv.config({
    path: ".env.import",
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

        /*
         * Menus de capítulos possuem vários
         * botões numéricos dentro do mesmo bloco.
         *
         * Um versículo deve possuir apenas
         * um botão numérico no seu container.
         */
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

        /*
         * Retira o número do versículo
         * para ficar somente com o texto.
         */
        clone
            .find("button")
            .first()
            .remove();

        const texto =
            limparTexto(clone.text());

        if (!texto) {
            return;
        }

        /*
         * Evita controles ou elementos
         * que contenham apenas números.
         */
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
        .from(encontrados.entries())
        .map(([versiculo, texto]) => ({
            versiculo,
            texto,
        }))
        .sort(
            (a, b) =>
                a.versiculo -
                b.versiculo,
        );
}

async function baixarCapitulo(
    livro,
    capitulo,
) {
    const url =
        `https://bibliaalmeida.com/${livro.slug}/${capitulo}/`;

    console.log(
        `Baixando ${livro.nome} ${capitulo}...`,
    );

    const response = await fetch(
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
            `HTTP ${response.status} em ${url}`,
        );
    }

    const html =
        await response.text();

    const versos =
        extrairVersiculos(html);

    return {
        url,
        versos,
    };
}

async function testarJoao14() {
    const livro = {
        ordem: 43,
        codigo: "JO",
        nome: "João",
        slug: "joao",
    };

    const capitulo = 14;

    const {
        url,
        versos,
    } = await baixarCapitulo(
        livro,
        capitulo,
    );

    console.log("");
    console.log(
        `Encontrados: ${versos.length} versículos`,
    );

    console.log("");

    console.table(
        versos.slice(0, 5),
    );

    const verso16 =
        versos.find(
            (item) =>
                item.versiculo === 16,
        );

    console.log("");
    console.log("João 14:16:");
    console.log(
        verso16?.texto ??
            "NÃO ENCONTRADO",
    );

    /*
     * João 14 possui 31 versículos.
     * Se não vier exatamente isso,
     * NÃO gravamos nada.
     */
    if (
        versos.length !== 31
    ) {
        throw new Error(
            `Esperávamos 31 versículos, mas encontramos ${versos.length}. Importação cancelada.`,
        );
    }

    if (!verso16) {
        throw new Error(
            "João 14:16 não foi encontrado.",
        );
    }

    /*
     * Sem --save fazemos apenas o teste.
     */
    const salvar =
        process.argv.includes(
            "--save",
        );

    if (!salvar) {
        console.log("");
        console.log(
            "TESTE OK. Nenhum dado foi salvo.",
        );

        console.log(
            "Para gravar use: node scripts/importBible.js --save",
        );

        return;
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

    const {
        error,
    } = await supabase
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

    console.log("");
    console.log(
        "João 14 salvo no Supabase.",
    );
}

testarJoao14()
    .catch((error) => {
        console.error("");
        console.error(
            "ERRO:",
            error,
        );

        process.exit(1);
    });