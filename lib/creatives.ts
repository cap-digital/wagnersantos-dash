import { METRICS, metricValue, type MetricKey } from "./metric-catalog";
import { aggregateBy } from "./metrics";
import type { Metrics, Row } from "./types";

/** Below this, a rate is noise rather than a finding. */
export const MIN_IMPRESSIONS = 300;

export type CreativePick = {
  ad: string;
  m: Metrics;
  /** Value of the metric the pick was made on. */
  value: number | null;
  /** Share of the period's total for that metric — null for rates and costs. */
  metricShare: number | null;
  spendShare: number;
  /** How many creatives were in play. */
  pool: number;
  /** True when low-volume creatives were excluded from the ranking. */
  filtered: boolean;
};

/**
 * The creative that wins on `metric`. Rates and costs only rank creatives that
 * cleared a volume floor — a 61% engagement rate over 40 impressions is noise,
 * not a winner.
 */
export function pickTopCreative(rows: Row[], metric: MetricKey): CreativePick | null {
  const def = METRICS[metric];
  const groups = aggregateBy(rows, (r) => r.ad);
  if (!groups.length) return null;

  const totalSpend = groups.reduce((a, g) => a + g.m.spend, 0);
  const totalMetric = def.additive
    ? groups.reduce((a, g) => a + (metricValue(g.m, metric) ?? 0), 0)
    : null;

  const eligible = def.additive
    ? groups
    : groups.filter((g) => g.m.impressions >= MIN_IMPRESSIONS);
  const pool = eligible.length ? eligible : groups;

  const winner = [...pool].sort((a, b) => {
    const va = metricValue(a.m, metric);
    const vb = metricValue(b.m, metric);
    if (va === null) return 1;
    if (vb === null) return -1;
    return def.betterWhen === "lower" ? va - vb : vb - va;
  })[0];
  if (!winner) return null;

  const value = metricValue(winner.m, metric);
  return {
    ad: winner.key,
    m: winner.m,
    value,
    metricShare: totalMetric && value !== null ? (value / totalMetric) * 100 : null,
    spendShare: totalSpend ? (winner.m.spend / totalSpend) * 100 : 0,
    pool: pool.length,
    filtered: !def.additive && eligible.length > 0 && eligible.length < groups.length,
  };
}
