import {
    supabase,
} from "./supabase";

const CHAVE_PREFERENCIA =
    "verbo:traducao-biblica";

export const VERSAO_BIBLICA_PADRAO =
    "ALM1911_ATUAL";

export const VERSOES_BIBLICAS = [
    {
        id: "ALM1911_ATUAL",
        abreviacao: "ALM1911",
        nome:
            "Almeida 1911 · ortografia modernizada",
        credito:
            "Texto em domínio público",
        fonte:
            "Base bíblica do VERBO",
    },
    {
        id: "BLIVRE",
        abreviacao: "BLIVRE",
        nome:
            "Bíblia Livre",
        credito:
            "CC BY 4.0 · © 2018 Diego Santos, Mario Sérgio e Marco Teles",
        fonte:
            "eBible.org",
    },
    {
        id: "ONBV",
        abreviacao: "ONBV",
        nome:
            "Biblica® Open Nova Bíblia Viva™ 2007",
        credito:
            "CC BY-SA 4.0 · © 2007, 2010 Biblica, Inc.",
        fonte:
            "eBible.org / Biblica",
    },
];

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

function obterVersao(
    versaoId,
) {
    return (
        VERSOES_BIBLICAS.find(
            (item) =>
                item.id === versaoId,
        ) ??
        VERSOES_BIBLICAS[0]
    );
}

export function obterVersaoBiblicaPreferida() {
    if (
        typeof window ===
        "undefined"
    ) {
        return VERSAO_BIBLICA_PADRAO;
    }

    const salva =
        window.localStorage.getItem(
            CHAVE_PREFERENCIA,
        );

    return VERSOES_BIBLICAS.some(
        (item) =>
            item.id === salva,
    )
        ? salva
        : VERSAO_BIBLICA_PADRAO;
}

export function salvarVersaoBiblicaPreferida(
    versaoId,
) {
    if (
        typeof window ===
        "undefined"
    ) {
        return;
    }

    if (
        !VERSOES_BIBLICAS.some(
            (item) =>
                item.id === versaoId,
        )
    ) {
        return;
    }

    window.localStorage.setItem(
        CHAVE_PREFERENCIA,
        versaoId,
    );
}

function validarReferencia(
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

    return codigo;
}

function formatarVersos(
    versos,
    referencia,
) {
    return versos.map(
        (item) => ({
            numero:
                item.numero ??
                item.versiculo,

            texto:
                item.texto,

            nome:
                `${referencia.livro} ${referencia.capitulo}:${item.numero ?? item.versiculo}`,
        }),
    );
}

async function buscarNoBanco(
    referencia,
    codigo,
) {
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
    } else if (
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
    } else {
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

    return data;
}

async function buscarNaFonteLivre(
    referencia,
    codigo,
    versao,
) {
    const {
        data,
        error,
    } =
        await supabase.functions.invoke(
            "bible-passage",
            {
                body: {
                    versao:
                        versao.id,
                    livroCodigo:
                        codigo,
                    capitulo:
                        referencia
                            .capitulo,
                    versiculoInicio:
                        referencia
                            .versiculoInicio,
                    versiculoFim:
                        referencia
                            .versiculoFim ??
                        null,
                    versiculosExtras:
                        referencia
                            .versiculosExtras ??
                        [],
                },
            },
        );

    if (error) {
        throw error;
    }

    if (
        !data?.versos?.length
    ) {
        throw new Error(
            data?.error ??
            "Passagem não encontrada.",
        );
    }

    return {
        versos:
            data.versos,
        fonteUrl:
            data.fonteUrl ??
            null,
    };
}

export async function buscarPassagemBiblica(
    referencia,
    versaoId =
        obterVersaoBiblicaPreferida(),
) {
    const codigo =
        validarReferencia(
            referencia,
        );

    const versao =
        obterVersao(
            versaoId,
        );

    if (
        versao.id ===
        "ALM1911_ATUAL"
    ) {
        const data =
            await buscarNoBanco(
                referencia,
                codigo,
            );

        return {
            ...versao,
            traducao:
                versao.nome,
            versos:
                formatarVersos(
                    data,
                    referencia,
                ),
            fonteUrl:
                null,
        };
    }

    const resultado =
        await buscarNaFonteLivre(
            referencia,
            codigo,
            versao,
        );

    return {
        ...versao,
        traducao:
            versao.nome,
        versos:
            formatarVersos(
                resultado.versos,
                referencia,
            ),
        fonteUrl:
            resultado.fonteUrl,
    };
}
