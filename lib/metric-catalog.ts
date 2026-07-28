import { fmtBRL, fmtBRLCompact, fmtBRLPrecise, fmtInt, fmtPct, makeNumberFormatter } from "./format";
import type { Metrics } from "./types";

export type MetricKey =
  | "spend"
  | "impressions"
  | "clicks"
  | "engagement"
  | "interactions"
  | "videoViews"
  | "thruplays"
  | "profileVisits"
  | "cpm"
  | "cpc"
  | "cpe"
  | "cpThruplay"
  | "costPerVisit"
  | "ctr"
  | "engRate"
  | "hookRate"
  | "vtr"
  | "completionRate";

export type MetricKind = "count" | "currency" | "percent";
export type MetricGroup = "Volume" | "Custos" | "Taxas";

export type MetricDef = {
  key: MetricKey;
  label: string;
  short: string;
  group: MetricGroup;
  kind: MetricKind;
  hint?: string;
  /** Lower is better for costs — drives the delta colour and ranking order. */
  betterWhen: "higher" | "lower";
  /** Additive across rows, so it can be stacked or accumulated. Rates cannot. */
  additive: boolean;
  format: (v: number | null | undefined) => string;
};

const count = (label: string, short: string, hint?: string): Omit<MetricDef, "key"> => ({
  label,
  short,
  group: "Volume",
  kind: "count",
  hint,
  betterWhen: "higher",
  additive: true,
  format: fmtInt,
});

const cost = (label: string, short: string, hint: string): Omit<MetricDef, "key"> => ({
  label,
  short,
  group: "Custos",
  kind: "currency",
  hint,
  betterWhen: "lower",
  additive: false,
  format: fmtBRLPrecise,
});

const rate = (label: string, short: string, hint: string): Omit<MetricDef, "key"> => ({
  label,
  short,
  group: "Taxas",
  kind: "percent",
  hint,
  betterWhen: "higher",
  additive: false,
  format: (v) => fmtPct(v),
});

export const METRICS: Record<MetricKey, MetricDef> = {
  spend: {
    key: "spend",
    label: "Investimento",
    short: "Invest.",
    group: "Volume",
    kind: "currency",
    hint: "Verba aplicada no período",
    betterWhen: "higher",
    additive: true,
    format: (v) => fmtBRL(v),
  },
  impressions: { key: "impressions", ...count("Impressões", "Impr.", "Vezes que o anúncio apareceu") },
  clicks: { key: "clicks", ...count("Cliques", "Cliques") },
  engagement: {
    key: "engagement",
    ...count("Engajamentos", "Engaj.", "Reações, comentários, compartilhamentos, salvamentos e cliques"),
  },
  interactions: {
    key: "interactions",
    ...count("Interações na publicação", "Interações", "Reações + comentários + compartilhamentos + salvamentos"),
  },
  videoViews: { key: "videoViews", ...count("Views de vídeo (3s)", "Views 3s") },
  thruplays: { key: "thruplays", ...count("ThruPlays", "ThruPlays") },
  profileVisits: { key: "profileVisits", ...count("Visitas ao perfil", "Visitas") },

  cpm: { key: "cpm", ...cost("CPM", "CPM", "Custo por mil impressões") },
  cpc: { key: "cpc", ...cost("CPC", "CPC", "Custo por clique") },
  cpe: { key: "cpe", ...cost("CPE", "CPE", "Custo por engajamento") },
  cpThruplay: { key: "cpThruplay", ...cost("Custo por ThruPlay", "C/ThruPlay", "Investimento ÷ ThruPlays") },
  costPerVisit: {
    key: "costPerVisit",
    ...cost("Custo por visita ao perfil", "C/visita", "Investimento ÷ visitas ao perfil"),
  },

  ctr: { key: "ctr", ...rate("CTR", "CTR", "Cliques ÷ impressões") },
  engRate: { key: "engRate", ...rate("Taxa de engajamento", "Tx. eng.", "Engajamentos ÷ impressões") },
  hookRate: { key: "hookRate", ...rate("Hook rate", "Hook", "Views de 3s ÷ impressões") },
  vtr: { key: "vtr", ...rate("VTR", "VTR", "ThruPlays ÷ impressões") },
  completionRate: {
    key: "completionRate",
    ...rate("Taxa de conclusão", "Conclusão", "Assistiram 100% ÷ views de 3s"),
  },
};

export function metricValue(m: Metrics, key: MetricKey): number | null {
  const v = m[key];
  return typeof v === "number" ? v : null;
}

/** Metrics that can be summed — the only ones a stack or a running total may use. */
export const ADDITIVE_KEYS: MetricKey[] = (Object.keys(METRICS) as MetricKey[]).filter(
  (k) => METRICS[k].additive,
);

export const VOLUME_KEYS: MetricKey[] = [
  "spend",
  "impressions",
  "clicks",
  "engagement",
  "videoViews",
  "thruplays",
  "profileVisits",
];

export const COST_KEYS: MetricKey[] = ["cpm", "cpc", "cpe", "cpThruplay", "costPerVisit"];

export const RATE_KEYS: MetricKey[] = ["ctr", "engRate", "hookRate", "vtr", "completionRate"];

export const ALL_KEYS: MetricKey[] = [...VOLUME_KEYS, ...COST_KEYS, ...RATE_KEYS];

/** One consistent unit for every tick of an axis showing `key`. */
export function axisFormatter(key: MetricKey, max: number): (v: number) => string {
  const kind = METRICS[key].kind;
  if (kind === "currency") return (v) => fmtBRLCompact(v);
  if (kind === "percent") return (v) => `${Number.isInteger(v) ? v : v.toFixed(1)}%`;
  return makeNumberFormatter(max);
}

/** Exact value for a direct label on a mark. */
export function markFormatter(key: MetricKey): (v: number) => string {
  const def = METRICS[key];
  if (def.kind === "currency") return (v) => (key === "spend" ? fmtBRL(v) : fmtBRLPrecise(v));
  if (def.kind === "percent") return (v) => fmtPct(v);
  return (v) => fmtInt(v);
}
