"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartFrame } from "./ChartFrame";
import { useNarrow } from "./useNarrow";
import { CURSOR_BAND, makeTooltip } from "./ChartTooltip";
import { tipLabel } from "./labels";
import {
  ACCENT,
  BAR_MAX,
  BAR_RADIUS_RIGHT,
  INK_2,
  INK_3,
  axisLine,
  axisTick,
  gridLine,
} from "./theme";
import { MetricSelect } from "@/components/ui/MetricSelect";
import {
  ALL_KEYS,
  METRICS,
  axisFormatter,
  markFormatter,
  metricValue,
  type MetricKey,
} from "@/lib/metric-catalog";
import { aggregateBy } from "@/lib/metrics";
import { parseAdset } from "@/lib/labels";
import { fmtBRL, fmtInt, fmtPct } from "@/lib/format";
import type { Metrics, Row } from "@/lib/types";

/** Two ad sets can share a region and differ only by placement, so the axis
 *  category has to carry both — a duplicate category would collapse the bars. */
const SEP = " · ";

type Datum = {
  name: string;
  place: string;
  full: string;
  placement: string;
  value: number;
  m: Metrics;
  share: number;
};

/**
 * Two lines per tick: the region on top, the placement below it in muted ink.
 * Several ad sets share a region and differ only by placement, so truncating to
 * one line would make three rows look identical.
 */
function AdsetTick({
  x,
  y,
  payload,
  limit = 24,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string };
  limit?: number;
}) {
  const raw = payload?.value ?? "";
  const sep = raw.lastIndexOf(SEP);
  const name = sep === -1 ? raw : raw.slice(0, sep);
  const place = sep === -1 ? "" : raw.slice(sep + SEP.length);
  const text = name.length > limit ? `${name.slice(0, limit - 1)}…` : name;
  return (
    <g transform={`translate(${(x ?? 0) - 8}, ${y ?? 0})`}>
      <text textAnchor="end" y={-2} fill={INK_2} fontSize={11} fontWeight={600}>
        <title>{name}</title>
        {text}
      </text>
      <text
        textAnchor="end"
        y={11}
        fill={INK_3}
        fontSize={9.5}
        fontWeight={700}
        letterSpacing="0.06em"
      >
        {place.toUpperCase()}
      </text>
    </g>
  );
}

/** Long category names read far better horizontally than rotated under an axis. */
export function AdsetBarChart({
  rows,
  className,
  initialMetric = "spend",
}: {
  rows: Row[];
  className?: string;
  initialMetric?: MetricKey;
}) {
  const narrow = useNarrow();
  const [metric, setMetric] = useState<MetricKey>(initialMetric);
  const def = METRICS[metric];

  const data = useMemo<Datum[]>(() => {
    const groups = aggregateBy(rows, (r) => r.adset);
    const totalSpend = groups.reduce((a, g) => a + g.m.spend, 0);
    return (
      groups
        .map(({ key, m }) => {
          const info = parseAdset(key);
          return {
            name: `${info.compact}${SEP}${info.placement === "—" ? "outros" : info.placement}`,
            place: info.placement === "—" ? "outros" : info.placement,
            full: info.label,
            placement: info.placement,
            value: metricValue(m, metric) ?? 0,
            m,
            share: totalSpend ? (m.spend / totalSpend) * 100 : 0,
          };
        })
        // Best first, whichever direction "best" runs for this metric.
        .sort((a, b) => (def.betterWhen === "lower" ? a.value - b.value : b.value - a.value))
    );
  }, [rows, metric, def.betterWhen]);

  const max = Math.max(...data.map((d) => d.value), 0);
  const tick = axisFormatter(metric, max);
  const mark = markFormatter(metric);

  const Tip = useMemo(
    () =>
      makeTooltip((payload) => {
        const p = payload[0]?.payload as Datum;
        return {
          title: p.full,
          subtitle: `${fmtPct(p.share, 0)} da verba do período`,
          rows: [
            {
              key: metric,
              label: def.label,
              value: def.format(p.value),
              color: ACCENT,
              shape: "rect" as const,
            },
            { key: "s", label: "Investimento", value: fmtBRL(p.m.spend), muted: true },
            { key: "i", label: "Impressões", value: fmtInt(p.m.impressions), muted: true },
            { key: "e", label: "Taxa de engajamento", value: fmtPct(p.m.engRate), muted: true },
          ],
          footer: def.hint,
        };
      }),
    [metric, def],
  );

  const top = data[0];
  const bottom = data[data.length - 1];

  const insight = data.length
    ? `Entre ${data.length} conjuntos, **${top.full}** lidera em ${def.label.toLowerCase()} (${def.format(
        top.value,
      )}) e **${bottom.full}** fecha a lista (${def.format(bottom.value)}). ${
        def.betterWhen === "lower"
          ? "Como aqui menor é melhor, o topo da lista indica para onde a próxima realocação de verba tende a render mais."
          : "A distância entre os extremos mostra o quanto ainda dá para ganhar equilibrando a distribuição."
      }`
    : "Nenhum conjunto com entrega no período.";

  return (
    <ChartFrame
      className={className}
      title={`${def.label} por conjunto`}
      hint={def.hint ?? "Cada conjunto de anúncios do período"}
      insight={insight}
      insightTone="neutral"
      height={Math.max(230, data.length * 56 + 44)}
      aside={<MetricSelect value={metric} options={ALL_KEYS} onChange={setMetric} />}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: narrow ? 54 : 70, left: 4, bottom: 4 }}
          barCategoryGap="30%"
        >
          <CartesianGrid horizontal={false} {...gridLine} />
          <XAxis
            type="number"
            tick={axisTick}
            tickLine={false}
            axisLine={axisLine}
            tickFormatter={tick}
            height={26}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={<AdsetTick limit={narrow ? 15 : 24} />}
            tickLine={false}
            axisLine={false}
            width={narrow ? 116 : 168}
            interval={0}
          />
          <Tooltip content={<Tip />} cursor={CURSOR_BAND} />
          <Bar
            dataKey="value"
            name={def.label}
            fill={ACCENT}
            maxBarSize={BAR_MAX}
            radius={BAR_RADIUS_RIGHT}
            isAnimationActive={false}
          >
            <LabelList dataKey="value" content={tipLabel(mark)} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
