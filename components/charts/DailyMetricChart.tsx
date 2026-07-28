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
import { CURSOR_BAND, makeTooltip } from "./ChartTooltip";
import { capLabel } from "./labels";
import { ACCENT, BAR_MAX, BAR_RADIUS_UP, axisLine, axisTick, gridLine } from "./theme";
import { MetricSelect } from "@/components/ui/MetricSelect";
import {
  ALL_KEYS,
  METRICS,
  axisFormatter,
  markFormatter,
  metricValue,
  type MetricKey,
} from "@/lib/metric-catalog";
import { byDay, trendSlope } from "@/lib/metrics";
import { fmtDayWithWeekday } from "@/lib/format";
import type { Row } from "@/lib/types";

/** One series, one colour — the bar length already carries the magnitude. */
export function DailyMetricChart({
  rows,
  days,
  className,
  initialMetric = "engagement",
}: {
  rows: Row[];
  days: string[];
  className?: string;
  initialMetric?: MetricKey;
}) {
  const [metric, setMetric] = useState<MetricKey>(initialMetric);
  const def = METRICS[metric];

  const daily = useMemo(() => byDay(rows, days), [rows, days]);
  const data = useMemo(
    () => daily.map((d) => ({ date: d.date, value: metricValue(d, metric) ?? 0, day: d })),
    [daily, metric],
  );

  const values = data.map((d) => d.value);
  const max = Math.max(...values, 0);
  const tick = axisFormatter(metric, max);
  const mark = markFormatter(metric);

  const Tip = useMemo(
    () =>
      makeTooltip((payload, label) => {
        const p = payload[0]?.payload as { value: number };
        return {
          title: fmtDayWithWeekday(String(label)),
          rows: [
            { key: metric, label: def.label, value: def.format(p.value), color: ACCENT, shape: "rect" },
          ],
          footer: def.hint,
        };
      }),
    [metric, def],
  );

  const total = values.reduce((a, b) => a + b, 0);
  const best = data.reduce((a, d) => (d.value > a.value ? d : a), data[0]);
  const worst = data.reduce((a, d) => (d.value < a.value ? d : a), data[0]);
  const avg = data.length ? total / data.length : 0;
  const slope = trendSlope(values);
  const rising = slope !== null && avg > 0 && slope / avg > 0.05;
  const falling = slope !== null && avg > 0 && slope / avg < -0.05;
  const good = def.betterWhen === "higher" ? rising : falling;

  const headline = def.additive
    ? `**${def.format(total)}** no total, média de **${def.format(avg)} por dia**.`
    : `Média do período em **${def.format(avg)}**.`;

  const insight = data.length
    ? `${headline} O melhor dia foi **${fmtDayWithWeekday(
        def.betterWhen === "higher" ? best.date : worst.date,
      )}** (${def.format(def.betterWhen === "higher" ? best.value : worst.value)}) e o mais fraco, ${fmtDayWithWeekday(
        def.betterWhen === "higher" ? worst.date : best.date,
      )} (${def.format(def.betterWhen === "higher" ? worst.value : best.value)}). A tendência da série é ${
        rising ? "**de alta**" : falling ? "**de queda**" : "**estável**"
      }${good ? " — o movimento joga a favor" : rising || falling ? " — vale acompanhar" : ""}.`
    : "Sem dados no período.";

  return (
    <ChartFrame
      className={className}
      title={`${def.label} por dia`}
      hint={def.hint ?? "Valor do período, dia a dia"}
      insight={insight}
      insightTone={good ? "good" : rising || falling ? "watch" : "neutral"}
      height={296}
      aside={<MetricSelect value={metric} options={ALL_KEYS} onChange={setMetric} />}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 24, right: 12, left: 4, bottom: 4 }}>
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
            width={def.kind === "currency" ? 58 : 46}
            tickFormatter={tick}
          />
          <Tooltip content={<Tip />} cursor={CURSOR_BAND} />
          <Bar
            dataKey="value"
            name={def.label}
            fill={ACCENT}
            maxBarSize={BAR_MAX}
            radius={BAR_RADIUS_UP}
            isAnimationActive={false}
          >
            <LabelList dataKey="value" content={capLabel(mark)} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
