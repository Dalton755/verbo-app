import {
    supabase,
} from "./supabase";

const CODIGOS = {
    "Gênesis": "GN",
    "Êxodo": "EX",
    "Levítico": "LV",
    "Números": "NM",
    "Deuteronômio": "DT",
    "Josué": "JS",
    "Juízes": "JZ",
    "Rute": "RT",

    "1 Samuel": "1SM",
    "2 Samuel": "2SM",

    "1 Reis": "1RS",
    "2 Reis": "2RS",

    "1 Crônicas": "1CR",
    "2 Crônicas": "2CR",

    "Esdras": "ED",
    "Neemias": "NE",
    "Ester": "ET",
    "Jó": "JO",

    "Salmos": "SL",
    "Provérbios": "PV",
    "Eclesiastes": "EC",
    "Cantares": "CT",

    "Isaías": "IS",
    "Jeremias": "JR",
    "Lamentações": "LM",
    "Ezequiel": "EZ",
    "Daniel": "DN",
    "Oseias": "OS",
    "Joel": "JL",
    "Amós": "AM",
    "Obadias": "OB",
    "Jonas": "JN",
    "Miqueias": "MQ",
    "Naum": "NA",
    "Habacuque": "HC",
    "Sofonias": "SF",
    "Ageu": "AG",
    "Zacarias": "ZC",
    "Malaquias": "ML",

    "Mateus": "MT",
    "Marcos": "MC",
    "Lucas": "LC",
    "João": "JOA",
    "Atos": "AT",
    "Romanos": "RM",

    "1 Coríntios": "1CO",
    "2 Coríntios": "2CO",

    "Gálatas": "GL",
    "Efésios": "EF",
    "Filipenses": "FP",
    "Colossenses": "CL",

    "1 Tessalonicenses": "1TS",
    "2 Tessalonicenses": "2TS",

    "1 Timóteo": "1TM",
    "2 Timóteo": "2TM",

    "Tito": "TT",
    "Filemom": "FM",
    "Hebreus": "HB",
    "Tiago": "TG",

    "1 Pedro": "1PE",
    "2 Pedro": "2PE",

    "1 João": "1JO",
    "2 João": "2JO",
    "3 João": "3JO",

    "Judas": "JD",
    "Apocalipse": "AP",
};

export async function buscarPassagemBiblica(
    referencia,
) {
    const codigo =
        CODIGOS[
            referencia?.livro
        ];

    if (
        !codigo ||
        !referencia?.capitulo ||
        !referencia?.versiculoInicio
    ) {
        throw new Error(
            "Referência bíblica inválida.",
        );
    }

    let query =
        supabase
            .from("versiculos")
            .select(`
                livro_nome,
                capitulo,
                versiculo,
                texto
            `)
            .eq(
                "versao",
                "ALM1911_ATUAL",
            )
            .eq(
                "livro_codigo",
                codigo,
            )
            .eq(
                "capitulo",
                referencia.capitulo,
            );

    /*
     * Exemplo:
     *
     * João 3:16-18
     */
    if (
        referencia.versiculoFim
    ) {
        query =
            query
                .gte(
                    "versiculo",
                    referencia.versiculoInicio,
                )
                .lte(
                    "versiculo",
                    referencia.versiculoFim,
                );
    }

    /*
     * Exemplo:
     *
     * Mateus 1:21,23
     */
    else if (
        referencia
            .versiculosExtras
            ?.length
    ) {
        query =
            query.in(
                "versiculo",
                [
                    referencia
                        .versiculoInicio,

                    ...referencia
                        .versiculosExtras,
                ],
            );
    }

    /*
     * Exemplo:
     *
     * João 3:16
     */
    else {
        query =
            query.eq(
                "versiculo",
                referencia
                    .versiculoInicio,
            );
    }

    const {
        data,
        error,
    } = await query.order(
        "versiculo",
        {
            ascending: true,
        },
    );

    if (error) {
        throw error;
    }

    if (
        !data ||
        data.length === 0
    ) {
        throw new Error(
            "Passagem não encontrada.",
        );
    }

    return {
        traducao:
            "Almeida 1911 · ortografia modernizada",

        abreviacao:
            "ALM1911",

        versos:
            data.map(
                (item) => ({
                    numero:
                        item.versiculo,

                    texto:
                        item.texto,

                    nome:
                        `${item.livro_nome} ${item.capitulo}:${item.versiculo}`,
                }),
            ),
    };
}