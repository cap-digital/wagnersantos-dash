"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
import { BAR_RADIUS_RIGHT, ORDINAL, axisLine, axisTick, gridLine } from "./theme";
import { metricsOf } from "@/lib/metrics";
import { fmtInt, fmtPct, makeNumberFormatter } from "@/lib/format";
import type { Row } from "@/lib/types";

type Stage = {
  stage: string;
  value: number;
  color: string;
  shareOfImpressions: number | null;
  stepRetention: number | null;
};

const Tip = makeTooltip((payload) => {
  const p = payload[0]?.payload as Stage;
  return {
    title: p.stage,
    rows: [
      { key: "v", label: "Pessoas", value: fmtInt(p.value), color: p.color, shape: "rect" },
      {
        key: "s",
        label: "% das impressões",
        value: fmtPct(p.shareOfImpressions),
        muted: true,
      },
    ],
    footer:
      p.stepRetention !== null
        ? `Retenção em relação à etapa anterior: ${fmtPct(p.stepRetention)}`
        : undefined,
  };
});

/**
 * Funnel stages are an ordered scale, so they take the one-hue ordinal ramp —
 * the reader sees the order in the colour, not just in the bar length.
 */
export function VideoFunnelChart({ rows, className }: { rows: Row[]; className?: string }) {
  const narrow = useNarrow();
  const data = useMemo<Stage[]>(() => {
    const m = metricsOf(rows);
    const raw = [
      { stage: "Impressões", value: m.impressions },
      { stage: "Viu 3 segundos", value: m.videoViews },
      { stage: "Assistiu 25%", value: m.p25 },
      { stage: "Assistiu 50%", value: m.p50 },
      { stage: "Assistiu 75%", value: m.p75 },
      { stage: "Assistiu 100%", value: m.p100 },
    ];
    return raw.map((s, i) => ({
      ...s,
      color: ORDINAL[i],
      shareOfImpressions: m.impressions ? (s.value / m.impressions) * 100 : null,
      stepRetention: i === 0 || !raw[i - 1].value ? null : (s.value / raw[i - 1].value) * 100,
    }));
  }, [rows]);

  const tick = makeNumberFormatter(Math.max(...data.map((d) => d.value), 0));
  const m = metricsOf(rows);
  const biggestDrop = data
    .slice(1)
    .reduce(
      (a, s) => ((s.stepRetention ?? 100) < (a?.stepRetention ?? 100) ? s : a),
      data[1] as Stage | undefined,
    );

  const insight = m.videoViews
    ? `De cada 100 impressões, **${fmtPct(m.hookRate, 0)}** assistem aos 3 primeiros segundos e apenas **${fmtPct(
        m.completionRate,
        0,
      )} de quem começou chega ao fim**. A maior perda está em **${
        biggestDrop?.stage ?? "—"
      }**, que retém ${fmtPct(
        biggestDrop?.stepRetention,
      )} da etapa anterior — é ali que o roteiro precisa de um novo gancho para segurar a audiência.`
    : "Sem métricas de vídeo no período — os criativos ativos podem ser estáticos.";

  return (
    <ChartFrame
      className={className}
      title="Funil de retenção de vídeo"
      hint="Quantas pessoas avançam em cada etapa da reprodução"
      insight={insight}
      insightTone="watch"
      height={Math.max(240, data.length * 40 + 40)}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: narrow ? 54 : 66, left: 4, bottom: 4 }}
          barCategoryGap="24%"
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
            dataKey="stage"
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={narrow ? 88 : 112}
          />
          <Tooltip content={<Tip />} cursor={CURSOR_BAND} />
          <Bar
            dataKey="value"
            name="Pessoas"
            maxBarSize={24}
            radius={BAR_RADIUS_RIGHT}
            isAnimationActive={false}
          >
            {data.map((s) => (
              <Cell key={s.stage} fill={s.color} />
            ))}
            <LabelList dataKey="value" content={tipLabel((v) => fmtInt(v))} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
