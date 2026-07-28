"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { METRICS, type MetricGroup, type MetricKey } from "@/lib/metric-catalog";

const GROUP_ORDER: MetricGroup[] = ["Volume", "Custos", "Taxas"];
const MENU_WIDTH = 228;
const MENU_MAX_HEIGHT = 300;

/**
 * Lets the reader re-point a chart at another metric. It replaces the old
 * chart/table switch: the tables at the bottom of each page already carry
 * every value, so the header space is better spent on choosing what to plot.
 *
 * The menu is positioned `fixed` against the button's box rather than nested
 * inside it — chart cards clip their content and create their own stacking
 * contexts (backdrop filters, transforms), which would otherwise cut the menu
 * off or bury it under the next card.
 */
export function MetricSelect({
  value,
  options,
  onChange,
  label = "Métrica",
  align = "right",
}: {
  value: MetricKey;
  options: MetricKey[];
  onChange: (key: MetricKey) => void;
  label?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; drop: "down" | "up" } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom;
    const drop: "down" | "up" = spaceBelow < 220 && r.top > spaceBelow ? "up" : "down";
    const rawLeft = align === "right" ? r.right - MENU_WIDTH : r.left;
    setPos({
      top: drop === "down" ? r.bottom + 8 : Math.max(8, r.top - 8 - MENU_MAX_HEIGHT),
      left: Math.max(8, Math.min(rawLeft, window.innerWidth - MENU_WIDTH - 8)),
      drop,
    });
  }, [align]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    // A fixed menu would drift away from its button when the PAGE scrolls, so
    // it closes — but the listener runs in the capture phase and therefore also
    // sees the menu's own scrolling. Without this guard the list snaps shut the
    // moment you try to scroll through the options.
    const onScroll = (e: Event) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onResize = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  const grouped = useMemo(() => {
    const map = new Map<MetricGroup, MetricKey[]>();
    for (const key of options) {
      const g = METRICS[key].group;
      const bucket = map.get(g);
      if (bucket) bucket.push(key);
      else map.set(g, [key]);
    }
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => [g, map.get(g)!] as const);
  }, [options]);

  const current = METRICS[value];

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => {
          if (!open) place();
          setOpen((o) => !o);
        }}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`${label}: ${current.label}`}
        className={clsx(
          "flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-[11.5px] font-semibold transition",
          open
            ? "border-accent/60 bg-accent/[0.14] text-ink-1"
            : "border-white/[0.14] bg-white/[0.06] text-ink-1 hover:bg-white/[0.12]",
        )}
      >
        <span className="max-w-[150px] truncate">{current.label}</span>
        <span aria-hidden className="text-[8px] text-ink-3">
          ▼
        </span>
      </button>

      {open && pos ? (
        <div
          ref={menuRef}
          role="listbox"
          aria-label={label}
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            width: MENU_WIDTH,
            maxHeight: MENU_MAX_HEIGHT,
          }}
          className="slim-scroll z-[80] overflow-auto rounded-2xl border border-white/[0.16] bg-chrome p-1.5 shadow-float"
        >
          {grouped.map(([group, keys]) => (
            <div key={group}>
              <p className="px-3 pb-1 pt-2 text-[9.5px] font-black uppercase tracking-[0.14em] text-ink-3">
                {group}
              </p>
              <ul>
                {keys.map((key) => {
                  const def = METRICS[key];
                  const selected = key === value;
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        title={def.hint}
                        onClick={() => {
                          onChange(key);
                          setOpen(false);
                        }}
                        className={clsx(
                          "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-1.5 text-left text-[12px] transition",
                          selected
                            ? "font-semibold text-ink-1"
                            : "text-ink-2 hover:bg-white/[0.07]",
                        )}
                      >
                        <span className="truncate">{def.label}</span>
                        {selected ? (
                          <span aria-hidden className="shrink-0 text-accent">
                            ✓
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
