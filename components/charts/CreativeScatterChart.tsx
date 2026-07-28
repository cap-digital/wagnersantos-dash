"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { ChartFrame } from "./ChartFrame";
import { useNarrow } from "./useNarrow";
import { makeTooltip } from "./ChartTooltip";
import { INK_2, SERIES, SURFACE, axisLine, axisTick, gridLine } from "./theme";
import { aggregateBy } from "@/lib/metrics";
import { parseAd } from "@/lib/labels";
import { fmtBRL, fmtInt, fmtPct } from "@/lib/format";
import type { Row } from "@/lib/types";

type Point = {
  ad: string;
  label: string;
  kind: string;
  ctr: number;
  engRate: number;
  spend: number;
  impressions: number;
  cpc: number | null;
  labelled: boolean;
};

const Tip = makeTooltip((payload) => {
  const p = payload[0]?.payload as Point;
  if (!p?.label) return null;
  return {
    title: p.label,
    subtitle: p.kind,
    rows: [
      { key: "ctr", label: "CTR", value: fmtPct(p.ctr, 2), muted: true },
      { key: "eng", label: "Taxa de engajamento", value: fmtPct(p.engRate), muted: true },
      { key: "spend", label: "Investimento", value: fmtBRL(p.spend), muted: true },
      { key: "imp", label: "Impressões", value: fmtInt(p.impressions), muted: true },
      { key: "cpc", label: "CPC", value: fmtBRL(p.cpc), muted: true },
    ],
    footer: "O tamanho da bolha representa o investimento",
  };
});

/**
 * Recharts hands a scatter's LabelList only geometry and an index, not the
 * datum — so the renderer closes over the series' own points to decide which
 * of them earned a direct label.
 */
function pointLabel(points: Point[], plotRight: number) {
  return function PointLabel(props: {
    x?: number | string;
    y?: number | string;
    index?: number;
  }) {
    const p = points[props.index ?? -1];
    if (!p?.labelled) return null;
    const x = typeof props.x === "number" ? props.x : Number(props.x) || 0;
    const y = typeof props.y === "number" ? props.y : Number(props.y) || 0;
    // Near the right edge the label flips to the other side of the bubble
    // instead of running off the plot.
    const flip = x > plotRight * 0.72;
    return (
      <text
        x={flip ? x - 11 : x + 11}
        y={y - 9}
        textAnchor={flip ? "end" : "start"}
        fill={INK_2}
        fontSize={10.5}
        fontWeight={700}
      >
        {p.label}
      </text>
    );
  };
}

/**
 * A scatter is an all-pairs form, so it caps at three categorical hues; here it
 * needs only two — the creative's origin (dark post vs boosted post).
 */
export function CreativeScatterChart({ rows, className }: { rows: Row[]; className?: string }) {
  const narrow = useNarrow();
  const { groups, kinds } = useMemo(() => {
    const all = aggregateBy(rows, (r) => r.ad)
      .map(({ key, m }) => {
        const info = parseAd(key);
        return {
          ad: key,
          label: info.label,
          rawKind: info.kind,
          kind: info.kindLabel,
          ctr: m.ctr ?? 0,
          engRate: m.engRate ?? 0,
          spend: m.spend,
          impressions: m.impressions,
          cpc: m.cpc,
          labelled: false,
        };
      })
      .filter((p) => p.impressions > 0);

    // Label only the three heaviest points; the rest live in tooltip + table.
    const heaviest = new Set(
      [...all].sort((a, b) => b.spend - a.spend).slice(0, 3).map((p) => p.ad),
    );
    const points = all.map((p) => ({ ...p, labelled: heaviest.has(p.ad) }));

    const kindList = Array.from(new Set(points.map((p) => p.rawKind)));
    return {
      groups: kindList.map((k, i) => ({
        kind: k,
        label: points.find((p) => p.rawKind === k)?.kind ?? k,
        color: SERIES[i],
        points: points.filter((p) => p.rawKind === k) as Point[],
      })),
      kinds: points,
    };
  }, [rows]);

  const bestEng = kinds.reduce((a, p) => (p.engRate > (a?.engRate ?? -1) ? p : a), kinds[0]);
  const bestCtr = kinds.reduce((a, p) => (p.ctr > (a?.ctr ?? -1) ? p : a), kinds[0]);
  const tradeoff = bestCtr && bestEng && bestCtr.ad !== bestEng.ad;

  const insight = kinds.length
    ? `Cada bolha é um criativo; o tamanho é o quanto ele consumiu de verba. **${
        bestEng?.label ?? "—"
      }** tem a maior taxa de engajamento (${fmtPct(bestEng?.engRate)}) e **${
        bestCtr?.label ?? "—"
      }** o maior CTR (${fmtPct(bestCtr?.ctr, 2)}). ${
        tradeoff
          ? "São criativos diferentes: o que gera clique não é o que gera interação — vale separar os objetivos em conjuntos distintos em vez de esperar as duas coisas do mesmo anúncio."
          : "O mesmo criativo lidera as duas frentes, o que reforça a decisão de escalá-lo."
      }`
    : "Sem criativos com entrega no período.";

  return (
    <ChartFrame
      className={className}
      title="Clique × engajamento por criativo"
      hint="CTR no eixo horizontal, taxa de engajamento no vertical, investimento no tamanho da bolha"
      legend={groups.map((g) => ({ label: g.label, color: g.color, shape: "dot" as const }))}
      insight={insight}
      insightTone={tradeoff ? "watch" : "good"}
      height={320}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 20, right: 28, left: 4, bottom: 14 }}>
          <CartesianGrid {...gridLine} />
          <XAxis
            type="number"
            dataKey="ctr"
            name="CTR"
            tick={axisTick}
            tickLine={false}
            axisLine={axisLine}
            tickFormatter={(v: number) => `${v.toFixed(1)}%`}
            label={{
              value: "CTR",
              position: "insideBottomRight",
              offset: -8,
              fill: axisTick.fill,
              fontSize: 10.5,
            }}
          />
          <YAxis
            type="number"
            dataKey="engRate"
            name="Taxa de engajamento"
            tick={axisTick}
            tickLine={false}
            axisLine={false}
            width={46}
            tickFormatter={(v: number) => `${Math.round(v)}%`}
            label={{
              value: "Taxa de engajamento",
              angle: -90,
              position: "insideLeft",
              offset: 16,
              style: { textAnchor: "middle" },
              fill: axisTick.fill,
              fontSize: 10.5,
            }}
          />
          <ZAxis type="number" dataKey="spend" range={[220, 1500]} name="Investimento" />
          <Tooltip content={<Tip />} cursor={{ strokeDasharray: "0", stroke: "transparent" }} />
          {groups.map((g) => (
            <Scatter
              key={g.kind}
              name={g.label}
              data={g.points}
              fill={g.color}
              fillOpacity={0.72}
              stroke={SURFACE}
              strokeWidth={2}
              isAnimationActive={false}
            >
              <LabelList dataKey="label" content={pointLabel(g.points, narrow ? 300 : 900)} />
            </Scatter>
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
