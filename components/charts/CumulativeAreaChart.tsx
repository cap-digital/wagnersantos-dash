"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartFrame } from "./ChartFrame";
import { CURSOR_LINE, makeTooltip } from "./ChartTooltip";
import { endLabel } from "./labels";
import { ACCENT, SURFACE, axisLine, axisTick, gridLine } from "./theme";
import { MetricSelect } from "@/components/ui/MetricSelect";
import {
  METRICS,
  axisFormatter,
  metricValue,
  type MetricKey,
} from "@/lib/metric-catalog";
import { byDay } from "@/lib/metrics";
import { fmtDayWithWeekday, fmtPct } from "@/lib/format";
import type { Row } from "@/lib/types";

/** Only additive measures can accumulate — a rate has no running total. */
const OPTIONS: MetricKey[] = [
  "spend",
  "impressions",
  "clicks",
  "engagement",
  "videoViews",
  "thruplays",
  "profileVisits",
];

/** Single series → no legend box; the title says what is plotted. */
export function CumulativeAreaChart({
  rows,
  days,
  className,
  initialMetric = "spend",
}: {
  rows: Row[];
  days: string[];
  className?: string;
  initialMetric?: MetricKey;
}) {
  const [metric, setMetric] = useState<MetricKey>(initialMetric);
  const def = METRICS[metric];

  const data = useMemo(() => {
    const daily = byDay(rows, days);
    const total = daily.reduce((a, d) => a + (metricValue(d, metric) ?? 0), 0);
    let acc = 0;
    return daily.map((d) => {
      const value = metricValue(d, metric) ?? 0;
      acc += value;
      return {
        date: d.date,
        daily: value,
        cumulative: acc,
        share: total ? (value / total) * 100 : 0,
      };
    });
  }, [rows, days, metric]);

  const total = data.length ? data[data.length - 1].cumulative : 0;
  const avg = data.length ? total / data.length : 0;
  const heaviest = data.reduce((a, d) => (d.daily > a.daily ? d : a), data[0]);
  const back = data.length > 1 ? data.slice(-2).reduce((a, d) => a + d.share, 0) : 0;
  const tick = axisFormatter(metric, total);

  const Tip = useMemo(
    () =>
      makeTooltip((payload, label) => {
        const p = payload[0]?.payload as { cumulative: number; daily: number; share: number };
        return {
          title: fmtDayWithWeekday(String(label)),
          rows: [
            { key: "acc", label: "Acumulado", value: def.format(p.cumulative), color: ACCENT, shape: "line" },
            { key: "day", label: "No dia", value: def.format(p.daily), muted: true },
          ],
          footer: `${fmtPct(p.share)} do total do período`,
        };
      }),
    [def],
  );

  const insight = data.length
    ? `O acumulado do período fechou em **${def.format(total)}**, média de **${def.format(
        avg,
      )} por dia**. A curva não é linear: o maior dia foi **${fmtDayWithWeekday(
        heaviest.date,
      )}** (${def.format(heaviest.daily)}, ${fmtPct(
        heaviest.share,
        0,
      )} do total) e os dois últimos dias concentram **${fmtPct(back, 0)}** — sinal de aceleração no fim da janela.`
    : "Sem dados no período.";

  return (
    <ChartFrame
      className={className}
      title={`${def.label} acumulado`}
      hint="Somado dia a dia, do início ao fim do período"
      insight={insight}
      insightTone="watch"
      height={296}
      aside={<MetricSelect value={metric} options={OPTIONS} onChange={setMetric} />}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 22, right: 30, left: 4, bottom: 4 }}>
          <defs>
            <linearGradient id="cumulativeWash" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACCENT} stopOpacity={0.24} />
              <stop offset="100%" stopColor={ACCENT} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} {...gridLine} />
          <XAxis
            dataKey="date"
            tickFormatter={(v: string) => fmtDayWithWeekday(v).split(", ")[1]}
            tick={axisTick}
            tickLine={false}
            axisLine={axisLine}
            dy={6}
            interval="preserveStartEnd"
            minTickGap={8}
          />
          <YAxis
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={def.kind === "currency" ? 58 : 48}
            tickFormatter={tick}
          />
          <Tooltip content={<Tip />} cursor={CURSOR_LINE} />
          <Area
            type="monotone"
            dataKey="cumulative"
            stroke={ACCENT}
            strokeWidth={2}
            strokeLinecap="round"
            fill="url(#cumulativeWash)"
            dot={{ r: 3.5, fill: ACCENT, stroke: SURFACE, strokeWidth: 2 }}
            activeDot={{ r: 6, fill: ACCENT, stroke: SURFACE, strokeWidth: 2 }}
            isAnimationActive={false}
          >
            <LabelList dataKey="cumulative" content={endLabel(tick, data.length - 1, ACCENT, -12)} />
          </Area>
        </AreaChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
