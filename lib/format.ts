const DASH = "—";

const nf = (min: number, max: number) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: min, maximumFractionDigits: max });

const int0 = nf(0, 0);
const dec1 = nf(1, 1);
const dec2 = nf(2, 2);

export const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

/** 52.810 */
export function fmtInt(v: number | null | undefined): string {
  return isNum(v) ? int0.format(Math.round(v)) : DASH;
}

/** 52,8 mil · 1,2 mi — for axis ticks and tight tiles. */
export function fmtCompact(v: number | null | undefined): string {
  if (!isNum(v)) return DASH;
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${dec1.format(v / 1_000_000)} mi`;
  if (a >= 10_000) return `${dec1.format(v / 1000)} mil`;
  if (a >= 1000) return int0.format(v);
  return int0.format(v);
}

/** R$ 259,50 */
export function fmtBRL(v: number | null | undefined, decimals = 2): string {
  if (!isNum(v)) return DASH;
  return `R$ ${nf(decimals, decimals).format(v)}`;
}

/** R$ 0,0094 — costs that live below a cent need more precision. */
export function fmtBRLPrecise(v: number | null | undefined): string {
  if (!isNum(v)) return DASH;
  const a = Math.abs(v);
  if (a > 0 && a < 0.01) return `R$ ${nf(4, 4).format(v)}`;
  return fmtBRL(v);
}

/**
 * One unit for every tick on an axis. Picking the unit per value produces
 * ladders like "7.000 / 10,5 mil", which read as two different scales.
 */
export function makeNumberFormatter(max: number): (v: number) => string {
  if (Math.abs(max) >= 10_000) {
    // The origin stays a bare "0" — "0,0 mil" is noise on a baseline tick.
    return (v) => (v === 0 ? "0" : `${dec1.format(v / 1000)} mil`);
  }
  return (v) => int0.format(Math.round(v));
}

/** R$ 259 · R$ 1,2 mil — for axis ticks. */
export function fmtBRLCompact(v: number | null | undefined): string {
  if (!isNum(v)) return DASH;
  if (v === 0) return "R$ 0";
  const a = Math.abs(v);
  if (a >= 1000) return `R$ ${dec1.format(v / 1000)} mil`;
  if (a >= 10) return `R$ ${int0.format(v)}`;
  return `R$ ${dec2.format(v)}`;
}

/** 52,4% */
export function fmtPct(v: number | null | undefined, decimals = 1): string {
  if (!isNum(v)) return DASH;
  return `${nf(decimals, decimals).format(v)}%`;
}

/** +12,4% / −3,1% — signed, for deltas. */
export function fmtDelta(v: number | null | undefined, decimals = 1): string {
  if (!isNum(v)) return DASH;
  const s = nf(decimals, decimals).format(Math.abs(v));
  if (Math.abs(v) < 0.05) return `0,0%`;
  return `${v > 0 ? "+" : "−"}${s}%`;
}

const MONTHS_SHORT = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];
const MONTHS_LONG = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
export const WEEKDAYS_SHORT = ["D", "S", "T", "Q", "Q", "S", "S"];

/** Parses `YYYY-MM-DD` without touching the timezone. */
export function parseISODate(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

/** `2026-07-21` → `21/jul` */
export function fmtDayShort(iso: string): string {
  const { m, d } = parseISODate(iso);
  return `${String(d).padStart(2, "0")}/${MONTHS_SHORT[m - 1]}`;
}

/** `2026-07-21` → `21/07/2026` */
export function fmtDayFull(iso: string): string {
  const { y, m, d } = parseISODate(iso);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

/** `2026-07-21` → `21 de julho de 2026` */
export function fmtDayLong(iso: string): string {
  const { y, m, d } = parseISODate(iso);
  return `${d} de ${MONTHS_LONG[m - 1]} de ${y}`;
}

/** `2026-07-21` → `terça, 21/jul` */
export function fmtDayWithWeekday(iso: string): string {
  const { y, m, d } = parseISODate(iso);
  const names = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  const wd = names[new Date(y, m - 1, d).getDay()];
  return `${wd}, ${fmtDayShort(iso)}`;
}

export function fmtRangeLabel(from: string, to: string): string {
  if (from === to) return fmtDayFull(from);
  const a = parseISODate(from);
  const b = parseISODate(to);
  if (a.y === b.y && a.m === b.m) {
    return `${String(a.d).padStart(2, "0")}–${String(b.d).padStart(2, "0")}/${MONTHS_SHORT[a.m - 1]}/${a.y}`;
  }
  return `${fmtDayShort(from)} – ${fmtDayShort(to)}`;
}

/** `agora` · `há 4 min` · `há 2 h` — how old the cached data is. */
export function fmtAge(seconds: number | null | undefined): string {
  if (!isNum(seconds) || seconds < 45) return "agora";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return `há ${Math.round(hours / 24)} d`;
}

export const MONTH_NAMES_LONG = MONTHS_LONG;
