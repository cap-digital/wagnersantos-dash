"use client";

import clsx from "clsx";
import { Card, CardHeader } from "./Card";
import { Insight, type InsightTone } from "./Insight";

export type RankingItem = {
  key: string;
  label: string;
  sublabel?: string;
  /** Bar length driver. */
  value: number;
  /** What the reader sees. */
  display: string;
  badge?: string;
};

/**
 * A ranked bar list in plain HTML — no axis, no truncation, and it reflows on a
 * phone instead of squeezing a category axis into 90px.
 */
export function RankingList({
  title,
  hint,
  items,
  footer,
  insight,
  insightTone = "neutral",
  className,
  invert = false,
  aside,
}: {
  title: string;
  hint?: string;
  items: RankingItem[];
  footer?: string;
  insight?: string;
  insightTone?: InsightTone;
  className?: string;
  /** When lower is better, the leader is the smallest value. */
  invert?: boolean;
  /** Header controls — typically a <MetricSelect />. */
  aside?: React.ReactNode;
}) {
  const values = items.map((i) => Math.abs(i.value)).filter((v) => v > 0);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, Infinity);

  return (
    <Card className={clsx("flex flex-col", className)}>
      <CardHeader title={title} hint={hint} aside={aside} />
      <ul className="mt-4 flex-1 space-y-3 px-5">
        {items.map((item, i) => {
          const leader = i === 0;
          const v = Math.abs(item.value);
          // When lower is better, the bar shows how the item compares to the
          // best one (best = full). A plain 100−x inversion would squash the
          // whole list into the middle of the track.
          const width =
            invert && Number.isFinite(min) && v > 0
              ? Math.max(3, (min / v) * 100)
              : max > 0
                ? Math.max(3, (v / max) * 100)
                : 0;
          return (
            <li key={item.key}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span
                    className={clsx(
                      "truncate text-[12.5px] font-semibold",
                      leader ? "text-ink-1" : "text-ink-2",
                    )}
                  >
                    {item.label}
                  </span>
                  {item.sublabel ? (
                    <span className="shrink-0 text-[11px] text-ink-3">{item.sublabel}</span>
                  ) : null}
                  {leader && item.badge ? (
                    <span className="shrink-0 rounded-pill bg-accent/[0.18] px-1.5 py-0.5 text-[9.5px] font-black uppercase tracking-wide text-accent">
                      {item.badge}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-ink-1">
                  {item.display}
                </span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-pill bg-white/[0.07]">
                <div
                  className={clsx(
                    "h-full rounded-pill transition-[width] duration-500",
                    leader ? "bg-accent" : "bg-accent/45",
                  )}
                  style={{ width: `${width}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      {footer ? <p className="px-5 pt-4 text-[11.5px] text-ink-3">{footer}</p> : null}
      {insight ? (
        <div className="px-5 pb-5 pt-4">
          <Insight tone={insightTone}>{insight}</Insight>
        </div>
      ) : (
        <div className="pb-5" />
      )}
    </Card>
  );
}
