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
import { ACCENT, BAR_RADIUS_RIGHT, axisLine, axisTick, gridLine } from "./theme";
import { MetricSelect } from "@/components/ui/MetricSelect";
import {
  ALL_KEYS,
  METRICS,
  axisFormatter,
  markFormatter,
  metricValue,
  type MetricKey,
} from "@/lib/metric-catalog";
import { aggregateBy, concentration } from "@/lib/metrics";
import { parseAd } from "@/lib/labels";
import { fmtBRL, fmtBRLPrecise, fmtPct } from "@/lib/format";
import type { Metrics, Row } from "@/lib/types";

type Datum = {
  ad: string;
  label: string;
  kind: string;
  value: number;
  m: Metrics;
};

/** One measure, one colour — the bar length is already the comparison. */
export function CreativeBarChart({
  rows,
  className,
  initialMetric = "engagement",
}: {
  rows: Row[];
  className?: string;
  initialMetric?: MetricKey;
}) {
  const narrow = useNarrow();
  const [metric, setMetric] = useState<MetricKey>(initialMetric);
  const def = METRICS[metric];

  const data = useMemo<Datum[]>(
    () =>
      aggregateBy(rows, (r) => r.ad)
        .map(({ key, m }) => {
          const info = parseAd(key);
          return {
            ad: key,
            label: info.label,
            kind: info.kindLabel,
            value: metricValue(m, metric) ?? 0,
            m,
          };
        })
        .filter((d) => d.m.impressions > 0)
        .sort((a, b) => (def.betterWhen === "lower" ? a.value - b.value : b.value - a.value)),
    [rows, metric, def.betterWhen],
  );

  const max = Math.max(...data.map((d) => d.value), 0);
  const tick = axisFormatter(metric, max);
  const mark = markFormatter(metric);

  const Tip = useMemo(
    () =>
      makeTooltip((payload) => {
        const p = payload[0]?.payload as Datum;
        return {
          title: p.label,
          subtitle: p.kind,
          rows: [
            {
              key: metric,
              label: def.label,
              value: def.format(p.value),
              color: ACCENT,
              shape: "rect" as const,
            },
            { key: "s", label: "Investimento", value: fmtBRL(p.m.spend), muted: true },
            { key: "r", label: "Taxa de engajamento", value: fmtPct(p.m.engRate), muted: true },
            { key: "c", label: "Custo por engajamento", value: fmtBRLPrecise(p.m.cpe), muted: true },
          ],
          footer: def.hint,
        };
      }),
    [metric, def],
  );

  const top = data[0];
  const top2 = def.additive ? concentration(data.map((d) => d.value), 2) : null;

  const insight = data.length
    ? `**${top.label}** lidera em ${def.label.toLowerCase()} com ${def.format(top.value)}.${
        top2 !== null
          ? ` Os **dois criativos do topo respondem por ${fmtPct(
              top2,
              0,
            )}** do total — a cauda longa contribui pouco e libera verba para escalar os vencedores.`
          : " Confira o volume de cada peça antes de decidir: uma taxa excelente sobre poucas impressões ainda não é resultado consolidado."
      }`
    : "Nenhum criativo com entrega no período.";

  return (
    <ChartFrame
      className={className}
      title={`${def.label} por criativo`}
      hint={def.hint ?? "Cada anúncio do período"}
      insight={insight}
      insightTone="good"
      height={Math.max(240, data.length * 38 + 44)}
      aside={<MetricSelect value={metric} options={ALL_KEYS} onChange={setMetric} />}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: narrow ? 56 : 68, left: 4, bottom: 4 }}
          barCategoryGap="26%"
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
            dataKey="label"
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={narrow ? 62 : 78}
          />
          <Tooltip content={<Tip />} cursor={CURSOR_BAND} />
          <Bar
            dataKey="value"
            name={def.label}
            fill={ACCENT}
            maxBarSize={22}
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
