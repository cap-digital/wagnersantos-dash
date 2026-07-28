"use client";

import clsx from "clsx";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { ACCENT } from "@/components/charts/theme";
import { fmtDelta } from "@/lib/format";

export type Direction = "up-good" | "down-good" | "neutral";

function toneOf(delta: number | null, direction: Direction) {
  if (delta === null || Math.abs(delta) < 0.05 || direction === "neutral") return "flat";
  const up = delta > 0;
  return (direction === "up-good") === up ? "good" : "bad";
}

function DeltaBadge({
  delta,
  direction,
  compareLabel,
}: {
  delta: number | null;
  direction: Direction;
  compareLabel?: string;
}) {
  // No comparable window (the filter already says which period is in view) —
  // an empty delta row is quieter than five copies of the same disclaimer.
  if (delta === null) return null;
  const tone = toneOf(delta, direction);
  const arrow = Math.abs(delta) < 0.05 ? "—" : delta > 0 ? "▲" : "▼";
  return (
    <span className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-[11.5px]">
      <span
        className={clsx(
          "inline-flex items-center gap-1 font-semibold tabular-nums",
          tone === "good" && "text-good",
          tone === "bad" && "text-bad",
          tone === "flat" && "text-ink-2",
        )}
      >
        <span aria-hidden className="text-[9px]">
          {arrow}
        </span>
        {fmtDelta(delta)}
      </span>
      <span className="text-ink-3">{compareLabel ?? "vs. período anterior"}</span>
    </span>
  );
}

/**
 * Stat tile: label · value · delta · sparkline. The hero variant carries the
 * one number the page leads with, at display size, in the same sans as the
 * rest of the interface.
 */
export function Kpi({
  label,
  value,
  unit,
  delta,
  direction = "neutral",
  spark,
  footnote,
  compareLabel,
  hero = false,
  className,
}: {
  label: string;
  value: string;
  unit?: string;
  delta?: number | null;
  direction?: Direction;
  spark?: number[];
  footnote?: string;
  compareLabel?: string;
  hero?: boolean;
  className?: string;
}) {
  const sparkData = (spark ?? []).map((v, i) => ({ i, v }));
  const gid = `spark-${label.replace(/\W+/g, "")}`;

  return (
    <div
      className={clsx(
        "relative flex flex-col justify-between overflow-hidden rounded-card border border-white/10 bg-surface-1 p-4 shadow-card sm:p-5",
        hero && "bg-gradient-to-br from-[#2E4192] via-surface-1 to-[#21327A]",
        className,
      )}
    >
      {hero ? (
        <span
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-accent/[0.12] blur-2xl"
        />
      ) : null}

      <div className="relative">
        <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-ink-3">{label}</p>
        <p
          className={clsx(
            "mt-2 font-extrabold leading-none tracking-[-0.03em] text-ink-1",
            hero ? "text-[38px] sm:text-[48px]" : "text-[26px] sm:text-[30px]",
          )}
        >
          {value}
          {unit ? (
            <span className="ml-1 align-baseline text-[0.42em] font-bold tracking-normal text-ink-3">
              {unit}
            </span>
          ) : null}
        </p>
      </div>

      <div className="relative mt-3 space-y-2">
        {delta !== undefined ? (
          <DeltaBadge delta={delta ?? null} direction={direction} compareLabel={compareLabel} />
        ) : null}
        {footnote ? <p className="text-[11.5px] leading-snug text-ink-3">{footnote}</p> : null}
        {sparkData.length > 1 ? (
          <div className={clsx("w-full", hero ? "h-12" : "h-8")} aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ACCENT} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={ACCENT}
                  strokeWidth={2}
                  fill={`url(#${gid})`}
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </div>
    </div>
  );
}
