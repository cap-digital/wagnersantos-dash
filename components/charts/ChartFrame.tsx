"use client";

import clsx from "clsx";
import { Card, CardHeader } from "@/components/ui/Card";
import { Insight, type InsightTone } from "@/components/ui/Insight";

export type LegendKey = {
  label: string;
  color: string;
  shape?: "line" | "rect" | "dot";
};

function LegendRow({ keys }: { keys: LegendKey[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {keys.map((k) => (
        <li key={k.label} className="flex items-center gap-1.5 text-[11.5px] text-ink-2">
          <span
            aria-hidden
            className="shrink-0"
            style={
              k.shape === "line"
                ? { width: 14, height: 3, borderRadius: 999, background: k.color }
                : k.shape === "dot"
                  ? { width: 9, height: 9, borderRadius: 999, background: k.color }
                  : { width: 10, height: 10, borderRadius: 3, background: k.color }
            }
          />
          {k.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * The shell every chart sits in: header (with an optional metric control),
 * legend, plot and the written read. Values that a tooltip shows are also
 * reachable without hovering — through the direct labels on the marks and the
 * full sortable tables at the bottom of each page.
 */
export function ChartFrame({
  title,
  hint,
  legend,
  insight,
  insightTone = "neutral",
  height = 260,
  className,
  bodyClassName,
  children,
  aside,
  footer,
}: {
  title: React.ReactNode;
  hint?: React.ReactNode;
  legend?: LegendKey[];
  insight?: string;
  insightTone?: InsightTone;
  height?: number;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
  /** Header controls — typically a <MetricSelect />. */
  aside?: React.ReactNode;
  /** Controls under the plot — typically a <Pager />. */
  footer?: React.ReactNode;
}) {
  return (
    <Card className={clsx("flex flex-col", className)}>
      <CardHeader title={title} hint={hint} aside={aside} />

      {legend?.length ? (
        <div className="px-5 pt-3">
          <LegendRow keys={legend} />
        </div>
      ) : null}

      <div className={clsx("min-w-0 flex-1 overflow-hidden px-1.5 pt-3", bodyClassName)}>
        <div style={{ height }} className="w-full">
          {children}
        </div>
      </div>

      {/* Sits under the plot it controls, not in the header: it acts on the
          bars, and the header already carries the metric selector. */}
      {footer ? <div className="px-5 pt-3">{footer}</div> : null}

      {insight ? (
        <div className="px-5 pb-5 pt-4">
          <Insight tone={insightTone}>{insight}</Insight>
        </div>
      ) : (
        <div className="pb-2" />
      )}
    </Card>
  );
}
