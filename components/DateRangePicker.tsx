"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import {
  MONTH_NAMES_LONG,
  WEEKDAYS_SHORT,
  fmtDayFull,
  fmtRangeLabel,
  parseISODate,
} from "@/lib/format";
import { diffDays, shiftISO } from "@/lib/metrics";
import type { DateRange } from "@/lib/types";

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

type Preset = { id: string; label: string; range: (first: string, last: string) => DateRange };

const PRESETS: Preset[] = [
  { id: "all", label: "Todo o período", range: (f, l) => ({ from: f, to: l }) },
  {
    id: "7d",
    label: "Últimos 7 dias",
    range: (f, l) => ({ from: maxISO(f, shiftISO(l, -6)), to: l }),
  },
  {
    id: "3d",
    label: "Últimos 3 dias",
    range: (f, l) => ({ from: maxISO(f, shiftISO(l, -2)), to: l }),
  },
  { id: "1d", label: "Último dia", range: (_f, l) => ({ from: l, to: l }) },
];

const maxISO = (a: string, b: string) => (a > b ? a : b);

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8.5 6.2 12 13 4.5" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  );
}

function Month({
  year,
  month,
  min,
  max,
  draftFrom,
  hover,
  range,
  onPick,
  onHover,
}: {
  year: number;
  month: number;
  min: string;
  max: string;
  draftFrom: string | null;
  hover: string | null;
  range: DateRange;
  onPick: (day: string) => void;
  onHover: (day: string | null) => void;
}) {
  const first = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const lead = first.getDay();
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => iso(year, month, i + 1)),
  ];

  const selStart = draftFrom ?? range.from;
  const selEnd = draftFrom ? (hover && hover >= draftFrom ? hover : draftFrom) : range.to;

  return (
    <div>
      <p className="mb-2 text-center text-[12.5px] font-semibold capitalize text-ink-1">
        {MONTH_NAMES_LONG[month - 1]} {year}
      </p>
      <div className="grid grid-cols-7 gap-y-1">
        {WEEKDAYS_SHORT.map((w, i) => (
          <span key={i} className="pb-1 text-center text-[10px] font-bold uppercase text-ink-3">
            {w}
          </span>
        ))}
        {cells.map((day, i) => {
          if (!day) return <span key={`e${i}`} />;
          const disabled = day < min || day > max;
          const inRange = day >= selStart && day <= selEnd;
          const isStart = day === selStart;
          const isEnd = day === selEnd;
          const edge = isStart || isEnd;
          return (
            <button
              key={day}
              type="button"
              disabled={disabled}
              onClick={() => onPick(day)}
              onMouseEnter={() => onHover(day)}
              onFocus={() => onHover(day)}
              aria-label={fmtDayFull(day)}
              aria-pressed={edge}
              className={clsx(
                "relative mx-auto grid h-8 w-8 place-items-center rounded-lg text-[12px] font-semibold tabular-nums transition",
                disabled && "cursor-not-allowed text-ink-3/35",
                !disabled && !inRange && "text-ink-2 hover:bg-white/10",
                !disabled && inRange && !edge && "bg-accent/[0.18] text-ink-1",
                edge && !disabled && "bg-accent text-[#16255F]",
              )}
            >
              {parseISODate(day).d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DateRangePicker({
  range,
  allDays,
  onChange,
}: {
  range: DateRange;
  allDays: string[];
  onChange: (r: DateRange) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const min = allDays[0];
  const max = allDays[allDays.length - 1];
  const [cursor, setCursor] = useState(() => parseISODate(range.to ?? max));

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

  const activePreset = useMemo(
    () => PRESETS.find((p) => {
      const r = p.range(min, max);
      return r.from === range.from && r.to === range.to;
    })?.id,
    [range, min, max],
  );

  const dayCount = diffDays(range.from, range.to) + 1;

  function pick(day: string) {
    if (!draftFrom) {
      setDraftFrom(day);
      setHover(day);
      return;
    }
    const next = day < draftFrom ? { from: day, to: draftFrom } : { from: draftFrom, to: day };
    setDraftFrom(null);
    setHover(null);
    onChange(next);
    setOpen(false);
  }

  function shiftMonth(delta: number) {
    setCursor((c) => {
      const d = new Date(c.y, c.m - 1 + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() + 1, d: 1 };
    });
  }

  const prevDisabled = iso(cursor.y, cursor.m, 1) <= min;
  const nextDisabled = iso(cursor.y, cursor.m, 28) >= max;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={clsx(
          "flex items-center gap-2 rounded-pill border px-3.5 py-2 text-[12.5px] font-semibold transition",
          open
            ? "border-accent/60 bg-accent/[0.12] text-ink-1"
            : "border-white/[0.12] bg-white/[0.05] text-ink-1 hover:bg-white/10",
        )}
      >
        <span className="text-ink-3">
          <CalendarIcon />
        </span>
        <span className="tabular-nums">{fmtRangeLabel(range.from, range.to)}</span>
        <span className="rounded-pill bg-white/10 px-1.5 py-0.5 text-[10.5px] font-bold text-ink-2">
          {dayCount}d
        </span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Selecionar período"
          className="absolute left-0 z-40 mt-2 w-[292px] overflow-hidden rounded-2xl border border-white/15 bg-chrome shadow-float"
        >
          <ul className="p-1.5">
            {PRESETS.map((p) => {
              const selected = activePreset === p.id;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(p.range(min, max));
                      setDraftFrom(null);
                      setOpen(false);
                    }}
                    className={clsx(
                      "flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[12.5px] font-semibold transition",
                      selected ? "text-ink-1" : "text-ink-2 hover:bg-white/[0.06]",
                    )}
                  >
                    {p.label}
                    {selected ? (
                      <span className="text-accent">
                        <CheckIcon />
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="border-t border-white/10 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-3">
                {draftFrom ? "Selecione o fim" : "Período personalizado"}
              </span>
              <span className="flex gap-1">
                <button
                  type="button"
                  onClick={() => shiftMonth(-1)}
                  disabled={prevDisabled}
                  aria-label="Mês anterior"
                  className="grid h-6 w-6 place-items-center rounded-md text-ink-2 transition hover:bg-white/10 disabled:opacity-30"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => shiftMonth(1)}
                  disabled={nextDisabled}
                  aria-label="Próximo mês"
                  className="grid h-6 w-6 place-items-center rounded-md text-ink-2 transition hover:bg-white/10 disabled:opacity-30"
                >
                  ›
                </button>
              </span>
            </div>
            <div onMouseLeave={() => setHover(null)}>
              <Month
                year={cursor.y}
                month={cursor.m}
                min={min}
                max={max}
                draftFrom={draftFrom}
                hover={hover}
                range={range}
                onPick={pick}
                onHover={setHover}
              />
            </div>
            <p className="mt-2 text-[11px] leading-snug text-ink-3">
              Dados disponíveis de {fmtDayFull(min)} a {fmtDayFull(max)}.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
