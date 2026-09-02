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
import { Pager } from "@/components/ui/Pager";
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

/**
 * Bars per page. An account with dozens of ad sets would otherwise render a plot
 * several screens tall, pushing the rest of the page out of reach; eight is what
 * fits the card while still showing a ranking rather than a podium.
 */
const PAGE_SIZE = 8;

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
  const [page, setPage] = useState(0);
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

  // Clamped rather than reset: narrowing the date filter can drop the page the
  // reader was on, and landing on an empty plot reads as a broken chart.
  const pageCount = Math.max(1, Math.ceil(data.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const visible = data.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);
  // Height follows the page, not the leftovers on the last one, so paging does
  // not make the card jump around.
  const slots = pageCount > 1 ? PAGE_SIZE : data.length;

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
      height={Math.max(230, slots * 56 + 44)}
      aside={
        <MetricSelect
          value={metric}
          options={ALL_KEYS}
          onChange={(key) => {
            // A new metric reorders everything, so page 3 of the old ranking
            // means nothing in the new one.
            setMetric(key);
            setPage(0);
          }}
        />
      }
      footer={
        <Pager
          page={current}
          pageCount={pageCount}
          total={data.length}
          pageSize={PAGE_SIZE}
          noun={["conjunto", "conjuntos"]}
          onChange={setPage}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={visible}
          layout="vertical"
          margin={{ top: 4, right: narrow ? 54 : 70, left: 4, bottom: 4 }}
          barCategoryGap="30%"
        >
          <CartesianGrid horizontal={false} {...gridLine} />
          {/* The scale is pinned to the full ranking, not to the page. Letting
              each page rescale would draw the eighth-placed ad set as a full-width
              bar, and the pages would stop being comparable to one another. */}
          <XAxis
            type="number"
            domain={[0, max || "auto"]}
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
