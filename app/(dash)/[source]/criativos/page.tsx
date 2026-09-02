"use client";

import { useMemo, useState } from "react";
import { useCampaign } from "@/components/DataProvider";
import { SectionTitle } from "@/components/ui/Card";
import { Kpi } from "@/components/ui/Kpi";
import { RankingList } from "@/components/ui/RankingList";
import { MetricSelect } from "@/components/ui/MetricSelect";
import { TopCreativeCard } from "@/components/TopCreativeCard";
import { CreativeBarChart } from "@/components/charts/CreativeBarChart";
import { CreativeScatterChart } from "@/components/charts/CreativeScatterChart";
import { VideoFunnelChart } from "@/components/charts/VideoFunnelChart";
import { CreativeTable } from "@/components/tables/CreativeTable";
import { ALL_KEYS, METRICS, metricValue, type MetricKey } from "@/lib/metric-catalog";
import { MIN_IMPRESSIONS, pickTopCreative } from "@/lib/creatives";
import { aggregateBy, byDay, metricsOf, pctChange } from "@/lib/metrics";
import { parseAd } from "@/lib/labels";
import { fmtBRLPrecise, fmtInt, fmtPct, fmtRangeLabel } from "@/lib/format";

const RANK_SIZE = 6;

export default function CreativesPage() {
  const { rows, days, range } = useCampaign();
  const [heroMetric, setHeroMetric] = useState<MetricKey>("engagement");
  const [rankMetric, setRankMetric] = useState<MetricKey>("cpe");
  const rankDef = METRICS[rankMetric];

  const period = useMemo(() => metricsOf(rows), [rows]);

  // The highlighted creative drives the whole first block: the portrait, the
  // headline figure and the four tiles beside it all describe the same ad.
  const hero = useMemo(() => pickTopCreative(rows, heroMetric), [rows, heroMetric]);

  const heroSpark = useMemo(() => {
    if (!hero) return { engagement: [], cpe: [], hookRate: [], vtr: [] };
    const daily = byDay(
      rows.filter((r) => r.ad === hero.ad),
      days,
    );
    return {
      engagement: daily.map((d) => d.engagement),
      cpe: daily.map((d) => d.cpe ?? 0),
      hookRate: daily.map((d) => d.hookRate ?? 0),
      vtr: daily.map((d) => d.vtr ?? 0),
    };
  }, [rows, days, hero]);

  const eligible = useMemo(
    () =>
      aggregateBy(rows, (r) => r.ad)
        .map(({ key, m }) => ({ ad: key, label: parseAd(key).label, m }))
        .filter((g) => g.m.impressions >= MIN_IMPRESSIONS),
    [rows],
  );

  const ranking = useMemo(
    () =>
      [...eligible]
        .filter((g) => metricValue(g.m, rankMetric) !== null)
        .sort((a, b) => {
          const va = metricValue(a.m, rankMetric) ?? 0;
          const vb = metricValue(b.m, rankMetric) ?? 0;
          return rankDef.betterWhen === "lower" ? va - vb : vb - va;
        })
        .slice(0, RANK_SIZE),
    [eligible, rankMetric, rankDef.betterWhen],
  );

  const activeCount = new Set(rows.map((r) => r.ad)).size;

  /**
   * Creative against the campaign for the same metric. Only rates and costs
   * compare this way: a single creative's engagement count against the
   * campaign TOTAL would always read as a loss, which means nothing.
   */
  const vsCampaign = (key: MetricKey) =>
    hero && !METRICS[key].additive
      ? pctChange(metricValue(hero.m, key), metricValue(period, key))
      : undefined;
  const direction = (key: MetricKey) =>
    METRICS[key].betterWhen === "lower" ? ("down-good" as const) : ("up-good" as const);
  /** For additive metrics the honest comparison is a share of the total. */
  const shareOf = (key: MetricKey) => {
    const mine = hero ? metricValue(hero.m, key) : null;
    const all = metricValue(period, key);
    return mine !== null && all ? (mine / all) * 100 : null;
  };

  if (!rows.length) {
    return (
      <div className="rounded-card border border-white/10 bg-surface-1 p-10 text-center">
        <h2 className="text-lg font-extrabold">Sem criativos no período selecionado</h2>
        <p className="mx-auto mt-2 max-w-prose text-[13.5px] text-ink-2">
          Amplie o intervalo de datas ou revise o filtro de campanhas para ver os anúncios.
        </p>
      </div>
    );
  }

  const heroLabel = hero ? parseAd(hero.ad).label : "—";

  return (
    <div className="space-y-8">
      <section>
        <SectionTitle
          eyebrow="Criativos"
          title={
            <>
              O que está{" "}
              <span className="font-script text-[1.15em] font-normal tracking-normal text-accent">
                funcionando
              </span>
            </>
          }
        >
          <p className="text-[12.5px] text-ink-3">
            {range ? fmtRangeLabel(range.from, range.to) : null} · {activeCount}{" "}
            {activeCount === 1 ? "criativo" : "criativos"} com entrega
          </p>
        </SectionTitle>

        <div className="grid gap-3 lg:grid-cols-12">
          <TopCreativeCard
            pick={hero}
            metric={heroMetric}
            onMetricChange={setHeroMetric}
            className="lg:col-span-5"
          />

          <div className="lg:col-span-7">
            <p className="mb-2 flex flex-wrap items-center gap-x-1.5 text-[12px] text-ink-3">
              Números de
              <strong className="font-semibold text-ink-1">{heroLabel}</strong>
              <span aria-hidden>·</span>
              variação em relação à média da campanha
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Kpi
                label="Engajamentos"
                value={fmtInt(hero?.m.engagement)}
                spark={heroSpark.engagement}
                footnote={`${fmtPct(shareOf("engagement"), 0)} do total da campanha · ${fmtPct(
                  hero?.m.engRate,
                )} das impressões`}
              />
              <Kpi
                label="Custo por engajamento"
                value={fmtBRLPrecise(hero?.m.cpe)}
                delta={vsCampaign("cpe")}
                direction={direction("cpe")}
                compareLabel="vs. campanha"
                spark={heroSpark.cpe}
                footnote={`Campanha: ${fmtBRLPrecise(period.cpe)}`}
              />
              <Kpi
                label="Hook rate"
                value={fmtPct(hero?.m.hookRate)}
                delta={vsCampaign("hookRate")}
                direction={direction("hookRate")}
                compareLabel="vs. campanha"
                spark={heroSpark.hookRate}
                footnote="Assistiram aos 3 primeiros segundos"
              />
              <Kpi
                label="VTR"
                value={fmtPct(hero?.m.vtr)}
                delta={vsCampaign("vtr")}
                direction={direction("vtr")}
                compareLabel="vs. campanha"
                spark={heroSpark.vtr}
                footnote={`${fmtInt(hero?.m.thruplays)} ThruPlays`}
              />
            </div>
          </div>
        </div>
      </section>

      <section>
        <SectionTitle eyebrow="Detalhamento" title="Tabela de criativos" />
        <CreativeTable rows={rows} />
      </section>

      <section>
        <SectionTitle eyebrow="Comparativo" title="Volume e retenção lado a lado" />
        <div className="grid gap-3 lg:grid-cols-12">
          <CreativeBarChart rows={rows} className="lg:col-span-7" />
          <VideoFunnelChart rows={rows} className="lg:col-span-5" />
        </div>
      </section>

      <section>
        <div className="grid gap-3 lg:grid-cols-12">
          <CreativeScatterChart rows={rows} className="lg:col-span-8" />
          <RankingList
            className="lg:col-span-4"
            title="Ranking por métrica"
            hint={`${rankDef.label} — ${
              rankDef.betterWhen === "lower" ? "menor é melhor" : "maior é melhor"
            } · ${ranking.length} melhores entre os ${eligible.length} com ${MIN_IMPRESSIONS}+ impressões`}
            aside={<MetricSelect value={rankMetric} options={ALL_KEYS} onChange={setRankMetric} />}
            items={ranking.map((g) => ({
              key: g.ad,
              label: g.label,
              sublabel: `${fmtInt(g.m.impressions)} impr.`,
              value: metricValue(g.m, rankMetric) ?? 0,
              display: rankDef.format(metricValue(g.m, rankMetric)),
              badge: "melhor",
            }))}
            invert={rankDef.betterWhen === "lower"}
            insight={
              ranking.length > 1
                ? `Entre os ${eligible.length} criativos com volume relevante, o melhor marca **${rankDef.format(
                    metricValue(ranking[0].m, rankMetric),
                  )}** contra **${rankDef.format(
                    metricValue(ranking[ranking.length - 1].m, rankMetric),
                  )}** do último desta lista.${
                    rankDef.betterWhen === "lower"
                      ? " A barra é invertida de propósito: quanto mais cheia, mais barato o resultado."
                      : ""
                  }`
                : undefined
            }
            insightTone="good"
          />
        </div>
      </section>
    </div>
  );
}
