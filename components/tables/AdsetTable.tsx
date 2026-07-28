"use client";

import { useMemo } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Insight } from "@/components/ui/Insight";
import { SortableTable, type Column } from "@/components/ui/SortableTable";
import { aggregateBy } from "@/lib/metrics";
import { campaignLabel, parseAdset } from "@/lib/labels";
import { fmtBRL, fmtBRLPrecise, fmtInt, fmtPct } from "@/lib/format";
import type { Metrics, Row } from "@/lib/types";

type Line = {
  key: string;
  region: string;
  placement: string;
  audience: string;
  campaign: string;
  m: Metrics;
  share: number;
};

export function AdsetTable({
  rows,
  showCampaign,
}: {
  rows: Row[];
  showCampaign: boolean;
}) {
  const data = useMemo<Line[]>(() => {
    const groups = aggregateBy(rows, (r) => r.adset);
    const total = groups.reduce((a, g) => a + g.m.spend, 0);
    return groups.map(({ key, rows: group, m }) => {
      const info = parseAdset(key);
      return {
        key,
        region: info.region,
        placement: info.placement,
        audience: info.audience,
        campaign: group[0]?.campaign ?? "",
        m,
        share: total ? (m.spend / total) * 100 : 0,
      };
    });
  }, [rows]);

  const columns = useMemo<Column<Line>[]>(() => {
    const base: Column<Line>[] = [
      {
        key: "adset",
        label: "Conjunto",
        value: (r) => r.region,
        render: (r) => (
          <span className="flex flex-col gap-0.5">
            <span className="font-semibold text-ink-1">{r.region}</span>
            <span className="text-[11px] text-ink-3">
              {r.audience}
              {showCampaign && r.campaign ? ` · ${campaignLabel(r.campaign)}` : ""}
            </span>
          </span>
        ),
      },
      {
        key: "placement",
        label: "Posicion.",
        value: (r) => r.placement,
        render: (r) => (
          <span className="rounded-pill border border-white/[0.12] bg-white/5 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-ink-2">
            {r.placement}
          </span>
        ),
      },
      {
        key: "spend",
        label: "Investimento",
        align: "right",
        bar: true,
        value: (r) => r.m.spend,
        render: (r) => (
          <span className="flex flex-col items-end gap-0.5">
            <span className="font-semibold">{fmtBRL(r.m.spend)}</span>
            <span className="text-[10.5px] text-ink-3">{fmtPct(r.share, 0)}</span>
          </span>
        ),
      },
      {
        key: "impressions",
        label: "Impressões",
        align: "right",
        value: (r) => r.m.impressions,
        render: (r) => fmtInt(r.m.impressions),
      },
      {
        key: "cpm",
        label: "CPM",
        align: "right",
        hint: "Custo por mil impressões",
        value: (r) => r.m.cpm,
        render: (r) => fmtBRL(r.m.cpm),
      },
      {
        key: "clicks",
        label: "Cliques",
        align: "right",
        value: (r) => r.m.clicks,
        render: (r) => fmtInt(r.m.clicks),
      },
      {
        key: "ctr",
        label: "CTR",
        align: "right",
        hint: "Cliques ÷ impressões",
        value: (r) => r.m.ctr,
        render: (r) => fmtPct(r.m.ctr, 2),
      },
      {
        key: "cpc",
        label: "CPC",
        align: "right",
        hint: "Custo por clique",
        value: (r) => r.m.cpc,
        render: (r) => fmtBRL(r.m.cpc),
      },
      {
        key: "engagement",
        label: "Engajam.",
        align: "right",
        value: (r) => r.m.engagement,
        render: (r) => fmtInt(r.m.engagement),
      },
      {
        key: "engRate",
        label: "Tx. eng.",
        align: "right",
        hint: "Engajamentos ÷ impressões",
        value: (r) => r.m.engRate,
        render: (r) => fmtPct(r.m.engRate),
      },
      {
        key: "cpe",
        label: "CPE",
        align: "right",
        hint: "Custo por engajamento",
        value: (r) => r.m.cpe,
        render: (r) => fmtBRLPrecise(r.m.cpe),
      },
      {
        key: "vtr",
        label: "VTR",
        align: "right",
        hint: "ThruPlays ÷ impressões",
        value: (r) => r.m.vtr,
        render: (r) => fmtPct(r.m.vtr),
      },
    ];
    return base;
  }, [showCampaign]);

  const byCpe = [...data]
    .filter((d) => d.m.cpe !== null && d.m.engagement > 50)
    .sort((a, b) => (a.m.cpe ?? Infinity) - (b.m.cpe ?? Infinity));
  const cheapest = byCpe[0];
  const priciest = byCpe[byCpe.length - 1];
  const spread =
    cheapest && priciest && cheapest.m.cpe && priciest.m.cpe
      ? priciest.m.cpe / cheapest.m.cpe
      : null;

  const insight = cheapest
    ? `Ordene por qualquer coluna para reordenar a leitura. Hoje, **${
        cheapest.region
      } (${cheapest.placement})** entrega o engajamento mais barato do período, a ${fmtBRLPrecise(
        cheapest.m.cpe,
      )} por interação${
        spread && spread > 1.5
          ? ` — **${spread.toFixed(1)}× mais eficiente** que ${priciest.region} (${priciest.placement}), o extremo oposto da lista`
          : ""
      }. Conjuntos de FEED costumam trocar engajamento por clique: repare no contraste entre CTR e taxa de engajamento.`
    : "Sem conjuntos com volume suficiente para comparar custo por engajamento.";

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Desempenho por conjunto"
        hint="Volume, custos e taxas de cada conjunto de anúncios no período"
      />
      <div className="mt-4">
        <SortableTable
          data={data}
          columns={columns}
          initialSort={{ key: "spend", dir: "desc" }}
          rowKey={(r) => r.key}
          caption="Métricas por conjunto de anúncios"
          highlightTop
        />
      </div>
      <div className="px-5 pb-5 pt-4">
        <Insight tone="neutral">{insight}</Insight>
      </div>
    </Card>
  );
}
