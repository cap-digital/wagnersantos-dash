"use client";

import clsx from "clsx";
import { Card } from "./ui/Card";
import { Insight } from "./ui/Insight";
import { MetricSelect } from "./ui/MetricSelect";
import { CreativeThumb, InstagramLink } from "./CreativeThumb";
import { useCampaign } from "./DataProvider";
import { ALL_KEYS, METRICS, type MetricKey } from "@/lib/metric-catalog";
import { MIN_IMPRESSIONS, type CreativePick } from "@/lib/creatives";
import { parseAd } from "@/lib/labels";
import { fmtPct } from "@/lib/format";

/**
 * The one creative the page leads with — a figure, not a one-bar chart.
 * The metric lives in the page so the stat tiles beside this card describe the
 * same creative; a selector that only moved the portrait read as a bug.
 */
export function TopCreativeCard({
  pick,
  metric,
  onMetricChange,
  className,
}: {
  pick: CreativePick | null;
  metric: MetricKey;
  onMetricChange: (key: MetricKey) => void;
  className?: string;
}) {
  const { creativeOf } = useCampaign();
  const def = METRICS[metric];

  const selector = (
    <MetricSelect value={metric} options={ALL_KEYS} onChange={onMetricChange} label="Critério" />
  );

  if (!pick) {
    return (
      <Card className={clsx("flex flex-col items-center justify-center gap-4 p-8 text-center", className)}>
        {selector}
        <p className="text-[13px] text-ink-3">Sem criativos com entrega no período.</p>
      </Card>
    );
  }

  const info = parseAd(pick.ad);
  const creative = creativeOf(pick.ad);
  const efficient = pick.metricShare !== null && pick.metricShare > pick.spendShare;

  return (
    <Card
      className={clsx(
        "flex flex-col bg-gradient-to-br from-[#2E4192] via-surface-1 to-[#21327A]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <p className="inline-flex items-center gap-2 rounded-pill bg-accent/[0.18] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-accent">
          Criativo destaque
        </p>
        {selector}
      </div>

      {/* The portrait runs the full height of this block, so it stops one
          margin short of the insight below instead of leaving dead space. */}
      <div className="flex flex-1 items-stretch gap-4 px-5 pb-4 pt-4">
        <CreativeThumb
          src={creative?.thumbnail}
          ad={pick.ad}
          className="min-h-[190px] w-[140px] shrink-0 self-stretch border border-white/10 sm:w-[180px]"
          rounded="rounded-2xl"
        />
        <div className="flex min-w-0 flex-1 flex-col justify-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-3">
            Melhor em {def.label}
          </p>
          <h3 className="mt-1 truncate text-2xl font-extrabold tracking-[-0.025em] text-ink-1">
            {info.label}
          </h3>
          <p className="mt-2 text-[32px] font-extrabold leading-none tracking-[-0.03em] text-accent">
            {def.format(pick.value)}
          </p>
          <p className="mt-2 text-[12px] leading-snug text-ink-3">
            {info.kindLabel}
            {info.launched ? ` · no ar desde ${info.launched}` : ""}
            {pick.filtered ? ` · entre os que passaram de ${MIN_IMPRESSIONS} impressões` : ""}
          </p>
          <div className="mt-3">
            <InstagramLink href={creative?.permalink} />
          </div>
        </div>
      </div>

      <div className="mt-auto px-5 pb-5">
        <Insight tone={efficient ? "good" : "neutral"}>
          {pick.metricShare !== null
            ? efficient
              ? `Consome **${fmtPct(pick.spendShare, 0)} da verba** e devolve **${fmtPct(
                  pick.metricShare,
                  0,
                )} de ${def.label.toLowerCase()}** — entrega acima do que custa, e é o candidato natural para receber mais orçamento.`
              : `Lidera em volume, mas consome **${fmtPct(
                  pick.spendShare,
                  0,
                )} da verba** para entregar **${fmtPct(
                  pick.metricShare,
                  0,
                )} de ${def.label.toLowerCase()}** — a liderança vem do investimento, não da eficiência. Compare o custo por engajamento com os demais antes de escalar.`
            : `Melhor ${def.label.toLowerCase()} entre ${pick.pool} criativos com volume relevante, a ${def.format(
                pick.value,
              )}. Como é uma métrica de proporção, confira o volume ao lado antes de escalar a decisão.`}
        </Insight>
      </div>
    </Card>
  );
}
