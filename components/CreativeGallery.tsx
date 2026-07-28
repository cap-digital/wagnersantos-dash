"use client";

import { useMemo } from "react";
import { Card, CardHeader } from "./ui/Card";
import { Insight } from "./ui/Insight";
import { CreativeThumb, InstagramLink } from "./CreativeThumb";
import { useCampaign } from "./DataProvider";
import { aggregateBy } from "@/lib/metrics";
import { parseAd } from "@/lib/labels";
import { fmtBRL, fmtBRLPrecise, fmtInt, fmtPct } from "@/lib/format";
import type { Metrics, Row } from "@/lib/types";

type Item = {
  ad: string;
  label: string;
  kind: string;
  launched: string;
  m: Metrics;
  share: number;
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[10px] font-bold uppercase tracking-[0.1em] text-ink-3">
        {label}
      </p>
      <p className="mt-0.5 text-[13px] font-semibold tabular-nums text-ink-1">{value}</p>
    </div>
  );
}

export function CreativeGallery({ rows }: { rows: Row[] }) {
  const { creativeOf } = useCampaign();

  const items = useMemo<Item[]>(() => {
    const groups = aggregateBy(rows, (r) => r.ad);
    const total = groups.reduce((a, g) => a + g.m.spend, 0);
    return groups
      .map(({ key, m }) => {
        const info = parseAd(key);
        return {
          ad: key,
          label: info.label,
          kind: info.kindLabel,
          launched: info.launched,
          m,
          share: total ? (m.spend / total) * 100 : 0,
        };
      })
      .sort((a, b) => b.m.spend - a.m.spend);
  }, [rows]);

  const withVideo = items.filter((i) => i.m.videoViews > 0).length;

  return (
    <Card>
      <CardHeader
        title="Galeria de criativos"
        hint={`${items.length} ${items.length === 1 ? "anúncio" : "anúncios"} com entrega no período`}
      />
      <ul className="mt-4 grid grid-cols-1 gap-3 px-5 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => {
          const creative = creativeOf(item.ad);
          return (
            <li
              key={item.ad}
              className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition hover:border-white/20 hover:bg-white/[0.06]"
            >
              <CreativeThumb
                src={creative?.thumbnail}
                ad={item.ad}
                className="h-[104px] w-[84px] shrink-0"
              />
              <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate text-[13.5px] font-bold text-ink-1">
                    {item.label}
                    <span className="shrink-0 rounded-pill border border-white/[0.12] px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-ink-3">
                      {item.kind}
                    </span>
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-ink-3">
                    {fmtBRL(item.m.spend)} · {fmtPct(item.share, 0)} da verba
                    {item.launched ? ` · desde ${item.launched}` : ""}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Stat label="Impr." value={fmtInt(item.m.impressions)} />
                  <Stat label="Tx. eng." value={fmtPct(item.m.engRate)} />
                  <Stat label="CPE" value={fmtBRLPrecise(item.m.cpe)} />
                </div>

                <InstagramLink href={creative?.permalink} />
              </div>
            </li>
          );
        })}
      </ul>
      <div className="px-5 pb-5 pt-5">
        <Insight tone="neutral">
          {`A campanha rodou **${items.length} criativos** no período, ${
            withVideo === items.length
              ? "todos em vídeo"
              : `sendo **${withVideo} em vídeo** e ${items.length - withVideo} sem métrica de reprodução`
          }. As miniaturas vêm assinadas pela CDN da Meta e expiram em poucos dias — quando a prévia falhar, o card mostra o identificador do anúncio e o link do Instagram continua válido.`}
        </Insight>
      </div>
    </Card>
  );
}
