"use client";

import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartFrame } from "./ChartFrame";
import { CURSOR_BAND, makeTooltip } from "./ChartTooltip";
import { endLabel } from "./labels";
import { BAR_MAX, BAR_RADIUS_UP, SERIES, SURFACE, axisLine, axisTick, gridLine } from "./theme";
import { byDay } from "@/lib/metrics";
import { fmtDayWithWeekday, fmtInt, fmtPct, makeNumberFormatter } from "@/lib/format";
import type { Row } from "@/lib/types";

const IMPRESSIONS = SERIES[0];
const VIEWS = SERIES[1];

const Tip = makeTooltip((payload, label) => {
  const p = payload[0]?.payload as { impressions: number; videoViews: number; hookRate: number | null };
  return {
    title: fmtDayWithWeekday(String(label)),
    rows: [
      { key: "imp", label: "Impressões", value: fmtInt(p.impressions), color: IMPRESSIONS, shape: "rect" },
      { key: "vv", label: "Views de vídeo (3s)", value: fmtInt(p.videoViews), color: VIEWS, shape: "line" },
    ],
    footer: `Hook rate: ${fmtPct(p.hookRate)} das impressões viraram view`,
  };
});

/**
 * Bar + line on ONE axis: both series are counts of the same delivery funnel,
 * so they share a scale honestly — no second y-axis anywhere in this dashboard.
 */
export function DailyDeliveryChart({
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
        impressions: d.impressions,
        videoViews: d.videoViews,
        hookRate: d.hookRate,
      })),
    [rows, days],
  );

  const tick = makeNumberFormatter(Math.max(...data.map((d) => d.impressions), 0));
  const totalImp = data.reduce((a, d) => a + d.impressions, 0);
  const totalViews = data.reduce((a, d) => a + d.videoViews, 0);
  const peak = data.reduce((a, d) => (d.impressions > a.impressions ? d : a), data[0]);
  const peakShare = totalImp ? (peak.impressions / totalImp) * 100 : 0;
  const hook = totalImp ? (totalViews / totalImp) * 100 : 0;

  const insight = data.length
    ? `A entrega somou **${fmtInt(totalImp)} impressões** no período, com pico em **${fmtDayWithWeekday(
        peak.date,
      )}** (${fmtInt(peak.impressions)}, ${fmtPct(peakShare, 0)} do total). A linha de vídeo acompanha a barra de perto: **${fmtPct(
        hook,
      )} das impressões viraram visualização de 3 segundos** — o criativo prende a atenção logo no início.`
    : "Sem entrega registrada no período.";

  return (
    <ChartFrame
      className={className}
      title="Entrega diária"
      hint="Impressões e visualizações de vídeo de 3s, por dia"
      legend={[
        { label: "Impressões", color: IMPRESSIONS, shape: "rect" },
        { label: "Views de vídeo (3s)", color: VIEWS, shape: "line" },
      ]}
      insight={insight}
      insightTone={hook >= 40 ? "good" : "neutral"}
      height={296}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 20, right: 20, left: 4, bottom: 4 }}>
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
            tickFormatter={tick}
          />
          <Tooltip content={<Tip />} cursor={CURSOR_BAND} />
          <Bar
            dataKey="impressions"
            name="Impressões"
            fill={IMPRESSIONS}
            maxBarSize={BAR_MAX}
            radius={BAR_RADIUS_UP}
            stroke={SURFACE}
            strokeWidth={2}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="videoViews"
            name="Views de vídeo (3s)"
            stroke={VIEWS}
            strokeWidth={2}
            strokeLinecap="round"
            dot={{ r: 4, fill: VIEWS, stroke: SURFACE, strokeWidth: 2 }}
            activeDot={{ r: 6, fill: VIEWS, stroke: SURFACE, strokeWidth: 2 }}
            isAnimationActive={false}
          >
            <LabelList
              dataKey="videoViews"
              content={endLabel((v) => fmtInt(v), data.length - 1, VIEWS, -12, -16)}
            />
          </Line>
        </ComposedChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
