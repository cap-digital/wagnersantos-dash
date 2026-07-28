"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartFrame } from "./ChartFrame";
import { CURSOR_LINE, makeTooltip } from "./ChartTooltip";
import { endLabel } from "./labels";
import { SERIES, SURFACE, axisLine, axisTick, gridLine } from "./theme";
import { byDay, metricsOf } from "@/lib/metrics";
import { fmtDayWithWeekday, fmtPct } from "@/lib/format";
import type { Row } from "@/lib/types";

const KEYS = [
  { key: "engRate", label: "Taxa de engajamento", color: SERIES[0] },
  { key: "hookRate", label: "Hook rate (view 3s)", color: SERIES[1] },
  { key: "vtr", label: "VTR (ThruPlay)", color: SERIES[2] },
] as const;

const Tip = makeTooltip((payload, label) => ({
  title: fmtDayWithWeekday(String(label)),
  rows: KEYS.map((k) => ({
    key: k.key,
    label: k.label,
    value: fmtPct(payload.find((p) => p.dataKey === k.key)?.value as number | undefined),
    color: k.color,
    shape: "line" as const,
  })),
}));

/**
 * Three rates, one percentage axis — comparable by construction, which is why
 * they can share a plot. CPC and CPM live in their own card for the same reason.
 */
export function QualityRatesChart({
  rows,
  days,
  className,
}: {
  rows: Row[];
  days: string[];
  className?: string;
}) {
  const data = useMemo(
    () =>
      byDay(rows, days).map((d) => ({
        date: d.date,
        engRate: d.engRate,
        hookRate: d.hookRate,
        vtr: d.vtr,
      })),
    [rows, days],
  );

  // End labels only work while the lines separate at the right edge. When two
  // converge, nudging their labels apart detaches them from their lines — so
  // the colliding ones drop out and the legend, tooltip and table carry them.
  const last = data[data.length - 1];
  // Threshold is a share of the plotted range, not of the gap between the last
  // values — otherwise converging lines would produce a tiny threshold and
  // label themselves anyway, which is exactly the case being guarded against.
  const yMax = Math.max(
    ...data.flatMap((d) => KEYS.map((k) => d[k.key] ?? 0)),
    1,
  );
  const labelled = new Set(
    KEYS.filter((k) => {
      const v = last?.[k.key];
      if (v === null || v === undefined) return false;
      return KEYS.every((o) => {
        if (o.key === k.key) return true;
        const ov = last?.[o.key];
        return ov === null || ov === undefined || Math.abs(v - ov) >= yMax * 0.08;
      });
    }).map((k) => k.key as string),
  );

  const period = metricsOf(rows);
  const dropoff =
    period.hookRate && period.vtr ? ((period.hookRate - period.vtr) / period.hookRate) * 100 : null;

  const insight = data.length
    ? `No período, **${fmtPct(period.hookRate)}** de quem viu o anúncio assistiu aos 3 primeiros segundos e **${fmtPct(
        period.vtr,
      )}** chegou ao ThruPlay — ou seja, **${fmtPct(
        dropoff,
        0,
      )} abandonam entre o gancho e a retenção**. A taxa de engajamento se mantém no topo (**${fmtPct(
        period.engRate,
      )}**), acima do gancho: parte do público interage sem assistir ao vídeo inteiro.`
    : "Sem dados de qualidade no período.";

  return (
    <ChartFrame
      className={className}
      title="Qualidade da entrega"
      hint="Engajamento, gancho e retenção de vídeo — todos em % das impressões"
      legend={KEYS.map((k) => ({ label: k.label, color: k.color, shape: "line" as const }))}
      insight={insight}
      insightTone={dropoff !== null && dropoff > 60 ? "watch" : "neutral"}
      height={296}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 22, right: 30, left: 4, bottom: 4 }}>
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
            width={44}
            domain={[0, "auto"]}
            tickFormatter={(v: number) => `${Math.round(v)}%`}
          />
          <Tooltip content={<Tip />} cursor={CURSOR_LINE} />
          {KEYS.map((k) => (
            <Line
              key={k.key}
              type="monotone"
              dataKey={k.key}
              name={k.label}
              stroke={k.color}
              strokeWidth={2}
              strokeLinecap="round"
              connectNulls
              dot={{ r: 3.5, fill: k.color, stroke: SURFACE, strokeWidth: 2 }}
              activeDot={{ r: 6, fill: k.color, stroke: SURFACE, strokeWidth: 2 }}
              isAnimationActive={false}
            >
              {labelled.has(k.key) ? (
                <LabelList
                  dataKey={k.key}
                  content={endLabel((v) => fmtPct(v, 0), data.length - 1, k.color, -11)}
                />
              ) : null}
            </Line>
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
