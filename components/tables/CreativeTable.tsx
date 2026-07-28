"use client";

import { useMemo } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Insight } from "@/components/ui/Insight";
import { SortableTable, type Column } from "@/components/ui/SortableTable";
import { CreativeThumb } from "@/components/CreativeThumb";
import { useCampaign } from "@/components/DataProvider";
import { aggregateBy } from "@/lib/metrics";
import { parseAd } from "@/lib/labels";
import { fmtBRL, fmtBRLPrecise, fmtInt, fmtPct } from "@/lib/format";
import type { Metrics, Row } from "@/lib/types";

type Line = {
  ad: string;
  label: string;
  kind: string;
  kindLabel: string;
  launched: string;
  m: Metrics;
  share: number;
};

export function CreativeTable({ rows }: { rows: Row[] }) {
  const { creativeOf } = useCampaign();

  const data = useMemo<Line[]>(() => {
    const groups = aggregateBy(rows, (r) => r.ad);
    const total = groups.reduce((a, g) => a + g.m.spend, 0);
    return groups.map(({ key, m }) => {
      const info = parseAd(key);
      return {
        ad: key,
        label: info.label,
        kind: info.kind,
        kindLabel: info.kindLabel,
        launched: info.launched,
        m,
        share: total ? (m.spend / total) * 100 : 0,
      };
    });
  }, [rows]);

  const columns = useMemo<Column<Line>[]>(
    () => [
      {
        key: "ad",
        label: "Criativo",
        value: (r) => r.label,
        render: (r) => (
          <span className="flex items-center gap-2.5">
            <CreativeThumb
              src={creativeOf(r.ad)?.thumbnail}
              ad={r.ad}
              className="h-9 w-8 shrink-0"
              rounded="rounded-md"
            />
            <span className="flex flex-col gap-0.5">
              <span className="font-semibold text-ink-1">{r.label}</span>
              <span className="text-[11px] text-ink-3">
                {r.kindLabel}
                {r.launched ? ` · ${r.launched}` : ""}
              </span>
            </span>
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
        key: "hookRate",
        label: "Hook",
        align: "right",
        hint: "Views de 3s ÷ impressões",
        value: (r) => r.m.hookRate,
        render: (r) => fmtPct(r.m.hookRate),
      },
      {
        key: "vtr",
        label: "VTR",
        align: "right",
        hint: "ThruPlays ÷ impressões",
        value: (r) => r.m.vtr,
        render: (r) => fmtPct(r.m.vtr),
      },
      {
        key: "completionRate",
        label: "Concluíram",
        align: "right",
        hint: "Assistiram 100% ÷ views de 3s",
        value: (r) => r.m.completionRate,
        render: (r) => fmtPct(r.m.completionRate),
      },
      {
        key: "profileVisits",
        label: "Visitas perfil",
        align: "right",
        value: (r) => r.m.profileVisits,
        render: (r) => fmtInt(r.m.profileVisits),
      },
    ],
    [creativeOf],
  );

  const withVolume = data.filter((d) => d.m.impressions >= 300);
  const bestCpe = [...withVolume].sort((a, b) => (a.m.cpe ?? Infinity) - (b.m.cpe ?? Infinity))[0];
  const bestVtr = [...withVolume].sort((a, b) => (b.m.vtr ?? -1) - (a.m.vtr ?? -1))[0];

  const insight = bestCpe
    ? `Clique em qualquer cabeçalho para reordenar. Considerando apenas criativos com pelo menos 300 impressões, **${
        bestCpe.label
      }** entrega o engajamento mais barato (${fmtBRLPrecise(
        bestCpe.m.cpe,
      )}) e **${bestVtr?.label ?? "—"}** tem a melhor retenção de vídeo (VTR ${fmtPct(
        bestVtr?.m.vtr,
      )}). Criativos sem métrica de vídeo aparecem com traço nas colunas de retenção.`
    : "Sem criativos com volume suficiente para ranquear.";

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Todas as métricas por criativo"
        hint="Volume, custos, taxas e retenção de cada anúncio no período"
      />
      <div className="mt-4">
        <SortableTable
          data={data}
          columns={columns}
          initialSort={{ key: "spend", dir: "desc" }}
          rowKey={(r) => r.ad}
          caption="Métricas por criativo"
          maxHeight={520}
          highlightTop
        />
      </div>
      <div className="px-5 pb-5 pt-4">
        <Insight tone="neutral">{insight}</Insight>
      </div>
    </Card>
  );
}
