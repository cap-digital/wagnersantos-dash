import type { Row } from "./types";

const LOWER = new Set(["de", "da", "do", "das", "dos", "e"]);

/**
 * Ad-set names are typed in caps without accents in Ads Manager. Restoring the
 * accents here keeps the dashboard readable in Portuguese.
 */
const ACCENTS: Record<string, string> = {
  regiao: "Região",
  jequie: "Jequié",
  potiguara: "Potiguará",
  bahia: "Bahia",
  vitoria: "Vitória",
  sertao: "Sertão",
  interesses: "Interesses",
};

/**
 * Accents for the places and objectives that only the official campaign names
 * use. They are kept apart from the map above rather than merged into it: the
 * pre-campaign panel is frozen, and a shared map would silently restyle names
 * that have been rendering the same way since that period closed.
 */
const CAMPAIGN_ACCENTS: Record<string, string> = {
  ...ACCENTS,
  anage: "Anagé",
  antonio: "Antônio",
  basilio: "Basílio",
  candido: "Cândido",
  choca: "Choça",
  eleicoes: "Eleições",
  interacoes: "Interações",
  itambe: "Itambé",
  pocoes: "Poções",
  potiragua: "Potiraguá",
  trafego: "Tráfego",
  vicosa: "Viçosa",
};

function titleCase(s: string, accents: Record<string, string> = ACCENTS): string {
  return s
    .toLocaleLowerCase("pt-BR")
    .split(/\s+/)
    .map((w, i) => {
      const bare = w.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (accents[bare]) return accents[bare];
      if (i > 0 && LOWER.has(w)) return w;
      if (/^\d/.test(w)) return w.toUpperCase();
      return w.charAt(0).toLocaleUpperCase("pt-BR") + w.slice(1);
    })
    .join(" ");
}

const campaignCase = (s: string) => titleCase(s, CAMPAIGN_ACCENTS);

function brackets(name: string): string[] {
  return Array.from(name.matchAll(/\[([^\]]+)\]/g)).map((m) => m[1].trim());
}

/** `REELS`, `FEED`, `STORIES` or the combined `STORIES/REELS` Meta now writes. */
const PLACEMENT = /^(REELS|FEED|STORIES)(\s*\/\s*(REELS|FEED|STORIES))?$/i;

/**
 * Short forms of the campaign objectives that name every ad set.
 *
 * The objective is part of an ad set's identity, not decoration: the same city
 * and placement is bought under two or three different objectives, and a label
 * built from city and placement alone would be shared by several ad sets — which
 * on a chart axis means two ad sets landing on one category and one bar hiding
 * the other. These are kept short because that label has ~24 characters before
 * the axis truncates it.
 */
const OBJECTIVE_SHORT: Record<string, string> = {
  "MAX INTERACOES": "Interações",
  "MAX ALCANCE": "Alcance",
  "VISITAS PERFIL": "Visitas",
};

/** `STORIES/REELS` → `Stories/Reels`, one capital per segment. */
function placementLabel(raw: string): string {
  return raw
    .split("/")
    .map((p) => {
      const t = p.trim().toLowerCase();
      return t.charAt(0).toLocaleUpperCase("pt-BR") + t.slice(1);
    })
    .join("/");
}

export type AdsetInfo = {
  raw: string;
  /** `Região Conquista 80km` */
  region: string;
  /** `REELS` | `FEED` | `—` */
  placement: string;
  /** `HM · 18+` */
  audience: string;
  /** `Região Conquista 80km · Reels` */
  label: string;
  shortLabel: string;
  /** Region without the "Região" prefix — for tight chart axes. */
  compact: string;
};

/**
 * Ad sets in the official campaign are named
 * `[CJ05] [MAX ALCANCE] [ABERTO] [BRUMADO] [FEED] [APOIADOR]`, so the placement
 * sits in the middle and the city right before it. The pre-campaign put the
 * placement last and the region first — different enough that the two are read
 * by different parsers rather than by one that guesses.
 */
function parseCampaignAdset(raw: string, parts: string[]): AdsetInfo {
  const placeIdx = parts.findIndex((p) => PLACEMENT.test(p));
  const hasPlacement = placeIdx > 0;

  const regionRaw = hasPlacement ? parts[placeIdx - 1] : (parts[parts.length - 1] ?? "");
  const city = campaignCase(regionRaw.replace(/^GERAL\s*-\s*/i, "").trim());

  const placement = hasPlacement ? parts[placeIdx].toUpperCase().replace(/\s*\/\s*/, "/") : "—";
  const place = hasPlacement ? placementLabel(parts[placeIdx]) : "—";

  const objectiveRaw = (parts[1] ?? "").toUpperCase();
  const objective = OBJECTIVE_SHORT[objectiveRaw] ?? campaignCase(parts[1] ?? "");

  /**
   * What identifies an ad set here: its code, what it was buying and where.
   *
   * All four parts are needed, and in this order. Across the account, city,
   * objective and placement together still leave five pairs of ad sets sharing a
   * name, and the chart turns this string into an axis category — two ad sets on
   * one category means one bar silently swallowing the other. The `CJ` code is
   * what breaks every tie, and it leads because the axis truncates at around
   * twenty-four characters, so anything after that may not be on screen.
   */
  const code = (parts[0] ?? "").toUpperCase();
  const region = [code, objective, city].filter(Boolean).join(" · ");

  // Targeting note and any supporter credited after the placement. The
  // objective is left out — it moved up into the name.
  const descriptors = [
    ...parts.slice(2, hasPlacement ? placeIdx - 1 : parts.length - 1),
    ...(hasPlacement ? parts.slice(placeIdx + 1) : []),
  ]
    .map((p) => campaignCase(p))
    .filter(Boolean);

  return {
    raw,
    region,
    placement,
    audience: descriptors.join(" · ") || "—",
    label: `${region} · ${place}`,
    shortLabel: city,
    compact: region,
  };
}

export function parseAdset(raw: string): AdsetInfo {
  const parts = brackets(raw);
  const head = parts[0] ?? raw;

  // `[CJ05]` opens every ad set of the official campaign and nothing in the
  // pre-campaign, so it is a safe discriminator between the two conventions.
  if (/^CJ\s*\d+$/i.test(head.trim())) return parseCampaignAdset(raw, parts);
  const placement = (parts[parts.length - 1] ?? "").toUpperCase();
  const isPlacement = placement === "REELS" || placement === "FEED" || placement === "STORIES";
  const mid = parts.slice(1, isPlacement ? -1 : undefined);

  const regionRaw = head.replace(/^GERAL\s*-\s*/i, "").trim();
  const region = titleCase(regionRaw)
    .replace(/\bKm\b/g, "km")
    .replace(/\bPotiguará\b/i, "Potiguará");

  const audience = mid
    .map((p) => (p.toUpperCase() === "HM" ? "H+M" : p))
    .join(" · ");

  const place = isPlacement
    ? placement.charAt(0) + placement.slice(1).toLowerCase()
    : "—";

  return {
    raw,
    region,
    placement: isPlacement ? placement : "—",
    audience: audience || "—",
    label: `${region} · ${place}`,
    shortLabel: region,
    compact: region.replace(/^Região\s+/i, ""),
  };
}

export type AdInfo = {
  raw: string;
  /** `PE` (post existente impulsionado) or `DARK` (dark post) */
  kind: string;
  kindLabel: string;
  /** `02` */
  number: string;
  /** `21.07` */
  launched: string;
  /** `PE 02` */
  label: string;
};

/**
 * `[AD10]`, a bare `[AD]`, or either of those carrying a qualifier the data
 * layer added — `[AD10 · VIT. CONQUISTA]`. The middle dot is what separates a
 * qualifier from a name, and it cannot appear in a name typed in Ads Manager,
 * so the pre-campaign's `[AD 01]` never reaches this parser.
 */
const CAMPAIGN_AD = /^AD(\d*)(?:\s*·\s*(.+))?$/;

/**
 * Ads in the official campaign are `[AD19] [POST] [EU ME PREPAREI]`, and some
 * carry no number at all. The short label has to stay short — it is a category
 * on a 62px chart axis — so the number wins when there is one and the headline
 * stands in when there is not.
 */
function parseCampaignAd(raw: string, parts: string[], head: string): AdInfo {
  const match = CAMPAIGN_AD.exec(head);
  const number = match?.[1] ?? "";
  const qualifier = match?.[2]?.trim() ?? "";
  const rest = parts.slice(1);
  const isPost = rest.some((p) => p.toUpperCase() === "POST");
  const descriptors = rest.filter((p) => p.toUpperCase() !== "POST");
  const free = raw.replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();
  const title = descriptors.join(" · ") || free;

  // Numbering restarts in every campaign, and several ads are named just `[AD]`,
  // so a label is only ever as unique as the qualifier the data layer worked out
  // for it.
  const base = number ? `AD ${number}` : campaignCase(title) || "AD";
  const label =
    qualifier && number
      ? `${base} · ${campaignCase(qualifier)}`
      : qualifier
        ? campaignCase(qualifier)
        : base;

  return {
    raw,
    kind: isPost ? "POST" : "AD",
    kindLabel: isPost ? "Publicação existente" : "Anúncio",
    number,
    launched: "",
    label,
  };
}

export function parseAd(raw: string): AdInfo {
  const parts = brackets(raw);
  const head = (parts[0] ?? "").trim().toUpperCase();

  // `[AD19]` and a bare `[AD]` belong to the campaign. The pre-campaign's
  // `[AD 01]` has a space and stays on the original path, where it always was.
  if (CAMPAIGN_AD.test(head)) return parseCampaignAd(raw, parts, head);

  const kind = (brackets(raw)[0] ?? "").toUpperCase();
  const rest = raw.replace(/\[[^\]]*\]/g, "").trim();
  const m = rest.match(/^(\d+)\s*-\s*(.+)$/);
  const number = m ? m[1] : rest;
  const launched = m ? m[2].trim() : "";
  return {
    raw,
    kind: kind || "—",
    kindLabel:
      kind === "PE" ? "Publicação existente" : kind === "DARK" ? "Dark post" : kind || "—",
    number,
    launched,
    label: kind ? `${kind} ${number}` : rest,
  };
}

export const GENDER_LABEL: Record<Row["gender"], string> = {
  female: "Feminino",
  male: "Masculino",
  unknown: "Não informado",
};

/** Age bands are ordinal — this is the reading order everywhere. */
export const AGE_ORDER = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+", "Unknown"];

export function ageLabel(age: string): string {
  return age === "Unknown" ? "Não informado" : `${age} anos`;
}

export function ageShort(age: string): string {
  return age === "Unknown" ? "n/d" : age;
}

/** `[CAP] [ENGAJAMENTO] [2026]` → `Engajamento · 2026` */
export function campaignLabel(raw: string): string {
  const parts = brackets(raw);
  if (!parts.length) return raw;
  return parts
    .slice(1)
    .map((p) => (/^\d+$/.test(p) ? p : campaignCase(p)))
    .join(" · ");
}
