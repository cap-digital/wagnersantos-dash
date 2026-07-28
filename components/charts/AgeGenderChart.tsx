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
import { segmentLabel } from "./labels";
import { BAR_RADIUS_RIGHT, SERIES, SURFACE, axisLine, axisTick, gridLine } from "./theme";
import { MetricSelect } from "@/components/ui/MetricSelect";
import { METRICS, axisFormatter } from "@/lib/metric-catalog";
import { AGE_ORDER, GENDER_LABEL, ageLabel } from "@/lib/labels";
import { metricsOf } from "@/lib/metrics";
import { fmtPct } from "@/lib/format";
import type { Row } from "@/lib/types";

const GENDERS = [
  { key: "female", label: GENDER_LABEL.female, color: SERIES[0] },
  { key: "male", label: GENDER_LABEL.male, color: SERIES[1] },
  { key: "unknown", label: GENDER_LABEL.unknown, color: SERIES[2] },
] as const;

/**
 * Only measures that exist on a single row can be split by gender and stacked.
 * A rate is not additive, so it never appears here.
 */
const OPTIONS = [
  "impressions",
  "spend",
  "clicks",
  "engagement",
  "videoViews",
  "thruplays",
  "profileVisits",
] as const;

type StackKey = (typeof OPTIONS)[number];

type Datum = {
  age: string;
  label: string;
  female: number;
  male: number;
  unknown: number;
  total: number;
  engRate: number | null;
  share: number;
};

/**
 * Age bands are ordinal, so they own the axis; gender is the identity channel
 * and takes the categorical slots. A 2px surface gap separates the segments.
 */
export function AgeGenderChart({
  rows,
  className,
  initialMetric = "impressions",
}: {
  rows: Row[];
  className?: string;
  initialMetric?: StackKey;
}) {
  const [metric, setMetric] = useState<StackKey>(initialMetric);
  const def = METRICS[metric];

  const { data, activeGenders, totals } = useMemo(() => {
    const grandTotal = rows.reduce((a, r) => a + r[metric], 0);

    const byAge = new Map<string, Row[]>();
    for (const r of rows) {
      const bucket = byAge.get(r.age);
      if (bucket) bucket.push(r);
      else byAge.set(r.age, [r]);
    }

    const built: Datum[] = AGE_ORDER.filter((age) => byAge.has(age))
      .map((age) => {
        const group = byAge.get(age)!;
        const m = metricsOf(group);
        const sums = { female: 0, male: 0, unknown: 0 };
        for (const r of group) sums[r.gender] += r[metric];
        const total = sums.female + sums.male + sums.unknown;
        return {
          age,
          label: age === "Unknown" ? "n/d" : age,
          ...sums,
          total,
          engRate: m.engRate,
          share: grandTotal ? (total / grandTotal) * 100 : 0,
        };
      })
      .filter((d) => d.total > 0)
      // Recharts stacks bottom-up; reversing puts the youngest band on top.
      .reverse();

    const genderTotals = { female: 0, male: 0, unknown: 0 };
    for (const d of built) {
      genderTotals.female += d.female;
      genderTotals.male += d.male;
      genderTotals.unknown += d.unknown;
    }

    // A segment worth 0.1% of the total is invisible — a legend key for an
    // invisible mark is noise, so it only joins the chart above 0.5%.
    const active = GENDERS.filter(
      (g) => grandTotal > 0 && (genderTotals[g.key] / grandTotal) * 100 >= 0.5,
    );

    return { data: built, activeGenders: active, totals: { ...genderTotals, all: grandTotal } };
  }, [rows, metric]);

  const max = Math.max(...data.map((d) => d.total), 0);
  const tick = axisFormatter(metric, max);

  const Tip = useMemo(
    () =>
      makeTooltip((payload) => {
        const p = payload[0]?.payload as Datum;
        return {
          title: ageLabel(p.age),
          subtitle: `${fmtPct(p.share, 0)} de ${def.label.toLowerCase()} no período`,
          rows: [
            ...GENDERS.filter((g) => p[g.key] > 0).map((g) => ({
              key: g.key,
              label: g.label,
              value: def.format(p[g.key]),
              color: g.color,
              shape: "rect" as const,
            })),
            { key: "total", label: "Total", value: def.format(p.total), muted: true },
          ],
          footer: `Taxa de engajamento da faixa: ${fmtPct(p.engRate)}`,
        };
      }),
    [def],
  );

  const best = data.reduce(
    (a, d) => ((d.engRate ?? -1) > (a?.engRate ?? -1) ? d : a),
    data[0] as Datum | undefined,
  );
  const biggest = data.reduce(
    (a, d) => (d.total > (a?.total ?? -1) ? d : a),
    data[0] as Datum | undefined,
  );
  const malePct = totals.all ? (totals.male / totals.all) * 100 : 0;

  const insight = data.length
    ? `A distribuição pende para o público **masculino (${fmtPct(
        malePct,
        0,
      )} de ${def.label.toLowerCase()})** e concentra volume em **${ageLabel(
        biggest?.age ?? "",
      )}** (${def.format(biggest?.total ?? 0)}). Mas quem mais responde é a faixa **${ageLabel(
        best?.age ?? "",
      )}**, com ${fmtPct(
        best?.engRate,
      )} de engajamento — acima da média, o que sugere espaço para reforçar verba no público mais velho.`
    : "Sem quebra demográfica no período.";

  return (
    <ChartFrame
      className={className}
      title="Público por faixa etária"
      hint={`${def.label} por idade, dividido por gênero`}
      legend={activeGenders.map((g) => ({ label: g.label, color: g.color, shape: "rect" as const }))}
      insight={insight}
      insightTone="good"
      height={Math.max(220, data.length * 44 + 44)}
      aside={
        <MetricSelect
          value={metric}
          options={[...OPTIONS]}
          onChange={(k) => setMetric(k as StackKey)}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
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
            width={44}
          />
          <Tooltip content={<Tip />} cursor={CURSOR_BAND} />
          {activeGenders.map((g, i) => (
            <Bar
              key={g.key}
              dataKey={g.key}
              name={g.label}
              stackId="age"
              fill={g.color}
              stroke={SURFACE}
              strokeWidth={2}
              maxBarSize={26}
              radius={i === activeGenders.length - 1 ? BAR_RADIUS_RIGHT : undefined}
              isAnimationActive={false}
            >
              <LabelList dataKey={g.key} content={segmentLabel(tick, g.color)} />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
