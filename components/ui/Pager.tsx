"use client";

import clsx from "clsx";

const BUTTON =
  "grid h-7 w-7 shrink-0 place-items-center rounded-pill border border-white/[0.12] bg-white/[0.06] text-[13px] leading-none text-ink-2 transition hover:bg-white/[0.12] hover:text-ink-1 disabled:opacity-30 disabled:hover:bg-white/[0.06] disabled:hover:text-ink-2";

/**
 * Page control for a ranked chart.
 *
 * Charts that rank every ad set or creative outgrow their card once an account
 * has dozens of them — a bar per row turns into a plot metres tall that buries
 * everything under it. Showing a page at a time keeps the leaders in view and
 * the rest one click away, and the range readout is what keeps that honest: the
 * reader always knows they are looking at part of a longer list.
 */
export function Pager({
  page,
  pageCount,
  total,
  pageSize,
  noun,
  onChange,
  className,
}: {
  /** Zero-based. */
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  /** Singular and plural, e.g. `["conjunto", "conjuntos"]`. */
  noun: [string, string];
  onChange: (page: number) => void;
  className?: string;
}) {
  if (pageCount <= 1) return null;

  const from = page * pageSize + 1;
  const to = Math.min(total, from + pageSize - 1);
  const word = total === 1 ? noun[0] : noun[1];

  return (
    <div className={clsx("flex items-center justify-between gap-3", className)}>
      <p aria-live="polite" className="text-[11.5px] tabular-nums text-ink-3">
        {from}–{to} de {total} {word}
      </p>

      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={page === 0}
          aria-label="Página anterior"
          className={BUTTON}
        >
          ‹
        </button>
        <span className="px-0.5 text-[11.5px] tabular-nums text-ink-3">
          {page + 1}/{pageCount}
        </span>
        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={page >= pageCount - 1}
          aria-label="Próxima página"
          className={BUTTON}
        >
          ›
        </button>
      </div>
    </div>
  );
}
