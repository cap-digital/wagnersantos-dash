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

function titleCase(s: string): string {
  return s
    .toLocaleLowerCase("pt-BR")
    .split(/\s+/)
    .map((w, i) => {
      const bare = w.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (ACCENTS[bare]) return ACCENTS[bare];
      if (i > 0 && LOWER.has(w)) return w;
      if (/^\d/.test(w)) return w.toUpperCase();
      return w.charAt(0).toLocaleUpperCase("pt-BR") + w.slice(1);
    })
    .join(" ");
}

function brackets(name: string): string[] {
  return Array.from(name.matchAll(/\[([^\]]+)\]/g)).map((m) => m[1].trim());
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

export function parseAdset(raw: string): AdsetInfo {
  const parts = brackets(raw);
  const head = parts[0] ?? raw;
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

export function parseAd(raw: string): AdInfo {
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
    .map((p) => (/^\d+$/.test(p) ? p : titleCase(p)))
    .join(" · ");
}
