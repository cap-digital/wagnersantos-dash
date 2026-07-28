import type { Metrics, Row, Totals } from "./types";

export const ZERO_TOTALS: Totals = {
  spend: 0,
  clicks: 0,
  impressions: 0,
  engagement: 0,
  reactions: 0,
  comments: 0,
  shares: 0,
  saves: 0,
  profileVisits: 0,
  videoViews: 0,
  thruplays: 0,
  p25: 0,
  p50: 0,
  p75: 0,
  p100: 0,
};

const TOTAL_KEYS = Object.keys(ZERO_TOTALS) as (keyof Totals)[];

/** Returns `null` instead of Infinity/NaN so the UI can render an em dash. */
export function divide(numerator: number, denominator: number): number | null {
  if (!denominator || !Number.isFinite(denominator) || !Number.isFinite(numerator)) return null;
  const v = numerator / denominator;
  return Number.isFinite(v) ? v : null;
}

const pct = (n: number, d: number) => {
  const v = divide(n, d);
  return v === null ? null : v * 100;
};

export function sumRows(rows: Row[]): Totals {
  const out: Totals = { ...ZERO_TOTALS };
  for (const r of rows) {
    for (const k of TOTAL_KEYS) out[k] += r[k];
  }
  return out;
}

export function addTotals(a: Totals, b: Totals): Totals {
  const out = { ...ZERO_TOTALS };
  for (const k of TOTAL_KEYS) out[k] = a[k] + b[k];
  return out;
}

/**
 * Rates are always derived from summed totals — never averaged across rows,
 * which would weight a 54-impression slice the same as a 27k one.
 */
export function derive(t: Totals): Metrics {
  return {
    ...t,
    interactions: t.reactions + t.comments + t.shares + t.saves,
    cpm: divide(t.spend * 1000, t.impressions),
    cpc: divide(t.spend, t.clicks),
    ctr: pct(t.clicks, t.impressions),
    cpe: divide(t.spend, t.engagement),
    engRate: pct(t.engagement, t.impressions),
    vtr: pct(t.thruplays, t.impressions),
    hookRate: pct(t.videoViews, t.impressions),
    cpThruplay: divide(t.spend, t.thruplays),
    costPerVisit: divide(t.spend, t.profileVisits),
    completionRate: pct(t.p100, t.videoViews),
    r25: pct(t.p25, t.videoViews),
    r50: pct(t.p50, t.videoViews),
    r75: pct(t.p75, t.videoViews),
    r100: pct(t.p100, t.videoViews),
  };
}

export function metricsOf(rows: Row[]): Metrics {
  return derive(sumRows(rows));
}

/** Groups rows by a key, preserving first-seen order unless `order` is given. */
export function groupBy<T extends string>(
  rows: Row[],
  keyFn: (r: Row) => T,
): Map<T, Row[]> {
  const map = new Map<T, Row[]>();
  for (const r of rows) {
    const k = keyFn(r);
    const bucket = map.get(k);
    if (bucket) bucket.push(r);
    else map.set(k, [r]);
  }
  return map;
}

/** Group → aggregate → derive, in one pass. */
export function aggregateBy<T extends string>(
  rows: Row[],
  keyFn: (r: Row) => T,
): { key: T; rows: Row[]; m: Metrics }[] {
  return Array.from(groupBy(rows, keyFn), ([key, group]) => ({
    key,
    rows: group,
    m: metricsOf(group),
  }));
}

/** Percentage change between two values; `null` when the base is 0 or missing. */
export function pctChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || !Number.isFinite(previous) || previous === 0) {
    return null;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}

export type DayPoint = { date: string } & Metrics;

/** One point per calendar day, zero-filled so the axis has no gaps. */
export function byDay(rows: Row[], days: string[]): DayPoint[] {
  const map = groupBy(rows, (r) => r.date);
  return days.map((date) => ({ date, ...derive(sumRows(map.get(date) ?? [])) }));
}

/** All calendar days between two ISO dates, inclusive. */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const cur = new Date(fy, fm - 1, fd);
  const end = new Date(ty, tm - 1, td);
  while (cur <= end) {
    out.push(
      `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(
        cur.getDate(),
      ).padStart(2, "0")}`,
    );
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export function shiftISO(iso: string, deltaDays: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
    dt.getDate(),
  ).padStart(2, "0")}`;
}

export function diffDays(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const a = Date.UTC(fy, fm - 1, fd);
  const b = Date.UTC(ty, tm - 1, td);
  return Math.round((b - a) / 86_400_000);
}

/** Simple least-squares slope over an evenly spaced series. */
export function trendSlope(values: (number | null)[]): number | null {
  const pts = values
    .map((v, i) => [i, v] as const)
    .filter((p): p is readonly [number, number] => p[1] !== null && Number.isFinite(p[1]));
  if (pts.length < 2) return null;
  const n = pts.length;
  const sx = pts.reduce((a, p) => a + p[0], 0);
  const sy = pts.reduce((a, p) => a + p[1], 0);
  const sxy = pts.reduce((a, p) => a + p[0] * p[1], 0);
  const sxx = pts.reduce((a, p) => a + p[0] * p[0], 0);
  const denom = n * sxx - sx * sx;
  if (!denom) return null;
  return (n * sxy - sx * sy) / denom;
}

/** Share of the total that the top `n` items represent, 0–100. */
export function concentration(values: number[], n: number): number | null {
  const total = values.reduce((a, b) => a + b, 0);
  if (!total) return null;
  const top = [...values].sort((a, b) => b - a).slice(0, n).reduce((a, b) => a + b, 0);
  return (top / total) * 100;
}

export const KPI_DIRECTION = {
  spend: "neutral",
  impressions: "up-good",
  engagement: "up-good",
  clicks: "up-good",
  cpm: "down-good",
  cpc: "down-good",
  cpe: "down-good",
  ctr: "up-good",
  engRate: "up-good",
  vtr: "up-good",
} as const;
