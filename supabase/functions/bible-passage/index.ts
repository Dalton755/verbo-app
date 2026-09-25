const allowedVersions = {
  BLIVRE: {
    baseUrl: "https://ebible.org/porbr2018",
    label: "Bíblia Livre",
  },
  ONBV: {
    baseUrl: "https://ebible.org/poronbv",
    label: "Biblica® Open Nova Bíblia Viva™ 2007",
  },
} as const;

const bookCodes: Record<string, string> = {
  GN: "GEN", EX: "EXO", LV: "LEV", NM: "NUM", DT: "DEU",
  JS: "JOS", JZ: "JDG", RT: "RUT", "1SM": "1SA", "2SM": "2SA",
  "1RS": "1KI", "2RS": "2KI", "1CR": "1CH", "2CR": "2CH",
  ED: "EZR", NE: "NEH", ET: "EST", JO: "JOB", SL: "PSA",
  PV: "PRO", EC: "ECC", CT: "SNG", IS: "ISA", JR: "JER",
  LM: "LAM", EZ: "EZK", DN: "DAN", OS: "HOS", JL: "JOL",
  AM: "AMO", OB: "OBA", JN: "JON", MQ: "MIC", NA: "NAM",
  HC: "HAB", SF: "ZEP", AG: "HAG", ZC: "ZEC", ML: "MAL",
  MT: "MAT", MC: "MRK", LC: "LUK", JOA: "JHN", AT: "ACT",
  RM: "ROM", "1CO": "1CO", "2CO": "2CO", GL: "GAL", EF: "EPH",
  FP: "PHP", CL: "COL", "1TS": "1TH", "2TS": "2TH",
  "1TM": "1TI", "2TM": "2TI", TT: "TIT", FM: "PHM", HB: "HEB",
  TG: "JAS", "1PE": "1PE", "2PE": "2PE", "1JO": "1JN",
  "2JO": "2JN", "3JO": "3JN", JD: "JUD", AP: "REV",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      ...corsHeaders,
      "Cache-Control": status === 200 ? "public, max-age=300" : "no-store",
    },
  });
}

function decodeEntities(value: string) {
  return value
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function cleanVerseHtml(fragment: string) {
  let html = fragment;

  // Notas de rodapé e referências aparecem como popups dentro do texto.
  html = html.replace(
    /<a\b[^>]*class=["'][^"']*notemark[^"']*["'][^>]*>[\s\S]*?<\/a>/gi,
    "",
  );

  // Títulos editoriais ficam entre dois marcadores de versículo e não devem
  // ser anexados ao versículo anterior.
  html = html.replace(
    /<div\b[^>]*class=["'](?:s\d*|ms\d*|mr|r|d|sp|qa|cl|cd|mt\d*|mte\d*)["'][^>]*>[\s\S]*?<\/div>/gi,
    " ",
  );

  html = html.replace(/<br\s*\/?\s*>/gi, " ");
  html = html.replace(/<[^>]+>/g, " ");

  return decodeEntities(html)
    .replace(/\s+/g, " ")
    .trim();
}

function parseVerseMarker(marker: string) {
  const normalized = decodeEntities(marker).trim();
  const parts = normalized.match(/\d+/g) ?? [];
  return parts.map(Number).filter((n) => Number.isInteger(n) && n > 0);
}

function parseChapter(html: string) {
  const scriptureOnly = html
    .replace(/<ul\b[^>]*class=["']tnav["'][^>]*>[\s\S]*?<\/ul>/gi, " ")
    .replace(/<div\b[^>]*class=["']footnote["'][^>]*>[\s\S]*?<\/div>/gi, " ")
    .replace(/<div\b[^>]*class=["']copyright["'][^>]*>[\s\S]*?<\/div>/gi, " ");

  const markerRegex =
    /<span\b[^>]*class=["']verse["'][^>]*>([\s\S]*?)<\/span>/gi;

  const markers = Array.from(scriptureOnly.matchAll(markerRegex));
  const verses: Array<{ numero: number; texto: string }> = [];

  for (let index = 0; index < markers.length; index += 1) {
    const current = markers[index];
    const next = markers[index + 1];

    const contentStart = (current.index ?? 0) + current[0].length;
    const contentEnd = next?.index ?? scriptureOnly.length;
    const text = cleanVerseHtml(scriptureOnly.slice(contentStart, contentEnd));

    if (!text) continue;

    const numbers = parseVerseMarker(current[1]);

    for (const numero of numbers) {
      verses.push({ numero, texto: text });
    }
  }

  return verses;
}

function requestedVerseNumbers(body: {
  versiculoInicio?: number;
  versiculoFim?: number;
  versiculosExtras?: number[];
}) {
  const start = Number(body.versiculoInicio);
  const end = Number(body.versiculoFim ?? body.versiculoInicio);
  const wanted = new Set<number>();

  if (Number.isInteger(start) && start > 0) {
    const safeEnd = Number.isInteger(end) && end >= start
      ? Math.min(end, start + 80)
      : start;

    for (let number = start; number <= safeEnd; number += 1) {
      wanted.add(number);
    }
  }

  for (const extra of body.versiculosExtras ?? []) {
    const number = Number(extra);
    if (Number.isInteger(number) && number > 0 && number <= 200) {
      wanted.add(number);
    }
  }

  return wanted;
}

export default {
  fetch: async (req: Request) => {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
      return json({ error: "Método não permitido." }, 405);
    }

    try {
      const body = await req.json();
      const versionKey = String(body?.versao ?? "").toUpperCase();
      const version = allowedVersions[
        versionKey as keyof typeof allowedVersions
      ];

      if (!version) {
        return json({ error: "Tradução não suportada." }, 400);
      }

      const internalBookCode = String(body?.livroCodigo ?? "").toUpperCase();
      const usfmBookCode = bookCodes[internalBookCode];

      if (!usfmBookCode) {
        return json({ error: "Livro bíblico não suportado." }, 400);
      }

      const chapter = Number(body?.capitulo);

      if (!Number.isInteger(chapter) || chapter < 1 || chapter > 150) {
        return json({ error: "Capítulo inválido." }, 400);
      }

      const chapterDigits = usfmBookCode === "PSA" ? 3 : 2;
      const fileName =
        `${usfmBookCode}${String(chapter).padStart(chapterDigits, "0")}.htm`;
      const sourceUrl = `${version.baseUrl}/${fileName}`;

      const upstream = await fetch(sourceUrl, {
        headers: {
          "User-Agent": "VERBO/1.0 BibleReferenceReader",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!upstream.ok) {
        console.error("eBible upstream error", upstream.status, sourceUrl);
        return json({ error: "Não foi possível consultar esta tradução." }, 502);
      }

      const html = await upstream.text();
      const chapterVerses = parseChapter(html);

      if (chapterVerses.length === 0) {
        console.error("No verses parsed", versionKey, sourceUrl);
        return json({ error: "Não foi possível interpretar o capítulo." }, 502);
      }

      const wanted = requestedVerseNumbers(body);
      const verses = wanted.size > 0
        ? chapterVerses.filter((verse) => wanted.has(verse.numero))
        : chapterVerses;

      if (verses.length === 0) {
        return json({ error: "Versículo não encontrado." }, 404);
      }

      return json({
        versao: versionKey,
        fonte: version.label,
        fonteUrl: sourceUrl,
        versos: verses,
      });
    } catch (error) {
      console.error("bible-passage error", error);
      return json({ error: "Erro ao consultar o texto bíblico." }, 500);
    }
  },
};
