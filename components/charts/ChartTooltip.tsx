"use client";

import type { TooltipProps } from "recharts";

export type TooltipRow = {
  key: string;
  label: string;
  value: string;
  color?: string;
  /** Renders as a line key (lines) instead of a bar key (bars/areas). */
  shape?: "line" | "rect";
  muted?: boolean;
};

/**
 * Values lead, labels follow — the reader already knows the series and wants
 * the number. Series names come from the API, so they are inserted as text
 * nodes, never as markup.
 */
export function TooltipShell({
  title,
  subtitle,
  rows,
  footer,
}: {
  title: string;
  subtitle?: string;
  rows: TooltipRow[];
  footer?: string;
}) {
  return (
    <div className="pointer-events-none min-w-[184px] max-w-[280px] rounded-xl border border-white/15 bg-chrome/95 p-3 shadow-float backdrop-blur-md">
      <p className="text-[12px] font-semibold leading-tight text-ink-1">{title}</p>
      {subtitle ? <p className="mt-0.5 text-[11px] text-ink-3">{subtitle}</p> : null}
      <div className="mt-2 space-y-1.5">
        {rows.map((r) => (
          <div key={r.key} className="flex items-baseline justify-between gap-4">
            <span className="flex min-w-0 items-center gap-2">
              {r.color ? (
                <span
                  aria-hidden
                  className="shrink-0 rounded-full"
                  style={
                    r.shape === "rect"
                      ? { width: 9, height: 9, borderRadius: 2, background: r.color }
                      : { width: 12, height: 3, background: r.color }
                  }
                />
              ) : null}
              <span className="truncate text-[11.5px] text-ink-3">{r.label}</span>
            </span>
            <span
              className={`shrink-0 text-[12.5px] font-semibold tabular-nums ${
                r.muted ? "text-ink-2" : "text-ink-1"
              }`}
            >
              {r.value}
            </span>
          </div>
        ))}
      </div>
      {footer ? (
        <p className="mt-2 border-t border-white/10 pt-1.5 text-[11px] text-ink-3">{footer}</p>
      ) : null}
    </div>
  );
}

export type BuildTooltip = (
  payload: NonNullable<TooltipProps<number, string>["payload"]>,
  label: string | number,
) => { title: string; subtitle?: string; rows: TooltipRow[]; footer?: string } | null;

export function makeTooltip(build: BuildTooltip) {
  function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
    if (!active || !payload?.length) return null;
    const data = build(payload, label ?? "");
    if (!data) return null;
    return <TooltipShell {...data} />;
  }
  return ChartTooltip;
}

/** Crosshair for line/area charts — a hairline the reader aims a date at. */
export const CURSOR_LINE = { stroke: "#4C90E8", strokeWidth: 1, strokeOpacity: 0.8 };
/** Bars own their hit target; the cursor is a soft wash behind the hovered band. */
export const CURSOR_BAND = { fill: "rgba(255,255,255,0.05)" };
