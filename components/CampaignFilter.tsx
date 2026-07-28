"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { campaignLabel } from "@/lib/labels";

/**
 * Dimension filter for campaigns. An empty selection means "all", so campaigns
 * created later show up on their own instead of being silently excluded.
 */
export function CampaignFilter({
  campaigns,
  selected,
  onChange,
}: {
  campaigns: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!campaigns.length) return null;

  const all = selected.length === 0;
  const label = all
    ? campaigns.length === 1
      ? campaignLabel(campaigns[0])
      : `Todas as campanhas (${campaigns.length})`
    : selected.length === 1
      ? campaignLabel(selected[0])
      : `${selected.length} campanhas`;

  // With a single campaign there is nothing to choose, so the control stays
  // out of the filter row entirely.
  if (campaigns.length === 1) return null;

  function toggle(campaign: string) {
    const base = all ? [...campaigns] : selected;
    const next = base.includes(campaign)
      ? base.filter((c) => c !== campaign)
      : [...base, campaign];
    onChange(next.length === campaigns.length ? [] : next);
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={clsx(
          "flex max-w-[240px] items-center gap-2 rounded-pill border px-3.5 py-2 text-[12.5px] font-semibold transition",
          open
            ? "border-accent/60 bg-accent/[0.12] text-ink-1"
            : "border-white/[0.12] bg-white/[0.05] text-ink-1 hover:bg-white/10",
        )}
      >
        <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-s5" />
        <span className="truncate">{label}</span>
        <span aria-hidden className="text-[9px] text-ink-3">
          ▼
        </span>
      </button>

      {open ? (
        <div
          role="listbox"
          aria-multiselectable
          aria-label="Campanhas"
          className="absolute left-0 z-40 mt-2 w-[290px] overflow-hidden rounded-2xl border border-white/15 bg-chrome p-1.5 shadow-float"
        >
          <button
            type="button"
            role="option"
            aria-selected={all}
            onClick={() => onChange([])}
            className={clsx(
              "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-[12.5px] font-semibold transition",
              all ? "text-ink-1" : "text-ink-2 hover:bg-white/[0.06]",
            )}
          >
            Todas as campanhas
            {all ? <span className="text-accent">✓</span> : null}
          </button>
          <div className="my-1 h-px bg-white/10" />
          <ul className="slim-scroll max-h-[240px] overflow-auto">
            {campaigns.map((c) => {
              const on = all || selected.includes(c);
              return (
                <li key={c}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={on}
                    onClick={() => toggle(c)}
                    className={clsx(
                      "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-[12.5px] transition",
                      on ? "font-semibold text-ink-1" : "text-ink-2 hover:bg-white/[0.06]",
                    )}
                  >
                    <span className="truncate" title={c}>
                      {campaignLabel(c)}
                    </span>
                    {on ? <span className="shrink-0 text-accent">✓</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
