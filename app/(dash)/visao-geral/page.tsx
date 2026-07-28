"use client";

import { useMemo } from "react";
import { useCampaign } from "@/components/DataProvider";
import { SectionTitle } from "@/components/ui/Card";
import { Kpi } from "@/components/ui/Kpi";
import { AdsetBarChart } from "@/components/charts/AdsetBarChart";
import { AgeGenderChart } from "@/components/charts/AgeGenderChart";
import { DailyDeliveryChart } from "@/components/charts/DailyDeliveryChart";
import { DailyMetricChart } from "@/components/charts/DailyMetricChart";
import { QualityRatesChart } from "@/components/charts/QualityRatesChart";
import { CumulativeAreaChart } from "@/components/charts/CumulativeAreaChart";
import { AdsetTable } from "@/components/tables/AdsetTable";
import { byDay, metricsOf, pctChange } from "@/lib/metrics";
import { fmtBRL, fmtInt, fmtPct, fmtRangeLabel } from "@/lib/format";

export default function OverviewPage() {
  const { rows, previousRows, days, range, campaigns } = useCampaign();

  const { m, prev, spark } = useMemo(() => {
    const current = metricsOf(rows);
    const daily = byDay(rows, days);
    return {
      m: current,
      prev: metricsOf(previousRows),
      spark: {
        spend: daily.map((d) => d.spend),
        impressions: daily.map((d) => d.impressions),
        cpm: daily.map((d) => d.cpm ?? 0),
        cpc: daily.map((d) => d.cpc ?? 0),
        engRate: daily.map((d) => d.engRate ?? 0),
      },
    };
  }, [rows, previousRows, days]);

  const hasPrev = previousRows.length > 0;
  const d = <K extends keyof typeof m>(key: K) =>
    hasPrev ? pctChange(m[key] as number | null, prev[key] as number | null) : null;

  if (!rows.length) {
    return (
      <div className="rounded-card border border-white/10 bg-surface-1 p-10 text-center">
        <h2 className="text-lg font-extrabold">Sem dados no período selecionado</h2>
        <p className="mx-auto mt-2 max-w-prose text-[13.5px] text-ink-2">
          Amplie o intervalo de datas ou revise o filtro de campanhas para ver os resultados.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <SectionTitle
          eyebrow="Resumo do período"
          title={
            <>
              Como a verba virou{" "}
              <span className="font-script text-[1.15em] font-normal tracking-normal text-accent">
                resultado
              </span>
            </>
          }
        >
          <p className="text-[12.5px] text-ink-3">
            {range ? fmtRangeLabel(range.from, range.to) : null} · {days.length}{" "}
            {days.length === 1 ? "dia" : "dias"} ·{" "}
            {campaigns.length === 1 ? "1 campanha" : `${campaigns.length} campanhas`}
          </p>
        </SectionTitle>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <Kpi
            hero
            className="col-span-2"
            label="Investimento"
            value={fmtBRL(m.spend)}
            delta={d("spend")}
            direction="neutral"
            spark={spark.spend}
            footnote={`${fmtBRL(m.spend / Math.max(1, days.length))} por dia, em média`}
          />
          <Kpi
            label="Impressões"
            value={fmtInt(m.impressions)}
            delta={d("impressions")}
            direction="up-good"
            spark={spark.impressions}
          />
          <Kpi
            label="CPM"
            value={fmtBRL(m.cpm)}
            delta={d("cpm")}
            direction="down-good"
            spark={spark.cpm}
            footnote="Custo por mil impressões"
          />
          <Kpi
            label="CPC"
            value={fmtBRL(m.cpc)}
            delta={d("cpc")}
            direction="down-good"
            spark={spark.cpc}
            footnote={`${fmtInt(m.clicks)} cliques · CTR ${fmtPct(m.ctr, 2)}`}
          />
          <Kpi
            label="Taxa de engajamento"
            value={fmtPct(m.engRate)}
            delta={d("engRate")}
            direction="up-good"
            spark={spark.engRate}
            footnote={`${fmtInt(m.engagement)} interações`}
          />
        </div>
      </section>

      <section>
        <SectionTitle eyebrow="Evolução" title="O que aconteceu dia a dia" />
        {/* Deliberately uneven: 7/5 then 5/7, so the eye moves down the page. */}
        <div className="grid gap-3 lg:grid-cols-12">
          <DailyDeliveryChart className="lg:col-span-7" rows={rows} days={days} />
          <CumulativeAreaChart className="lg:col-span-5" rows={rows} days={days} />
        </div>
      </section>

      <section>
        <div className="grid gap-3 lg:grid-cols-12">
          <DailyMetricChart className="lg:col-span-5" rows={rows} days={days} />
          <QualityRatesChart className="lg:col-span-7" rows={rows} days={days} />
        </div>
      </section>

      <section>
        <SectionTitle eyebrow="Segmentação" title="Onde a verba está e quem está respondendo" />
        <div className="grid gap-3 lg:grid-cols-12">
          <AdsetBarChart className="lg:col-span-7" rows={rows} />
          <AgeGenderChart className="lg:col-span-5" rows={rows} />
        </div>
      </section>

      <section>
        <SectionTitle eyebrow="Detalhamento" title="Tabela de conjuntos" />
        <AdsetTable rows={rows} showCampaign={campaigns.length > 1} />
      </section>
    </div>
  );
}
