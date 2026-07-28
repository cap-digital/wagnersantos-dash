"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";

export type Column<T> = {
  key: string;
  label: string;
  /** Tooltip on the header — where a metric definition belongs. */
  hint?: string;
  align?: "left" | "right";
  /** Sort key. `null` always sorts last. */
  value: (row: T) => number | string | null;
  render: (row: T) => React.ReactNode;
  /** Draws a recessive magnitude bar behind the cell. */
  bar?: boolean;
  className?: string;
};

type SortState = { key: string; dir: "asc" | "desc" };

function SortGlyph({ state }: { state: "none" | "asc" | "desc" }) {
  return (
    <span
      aria-hidden
      className={clsx(
        "ml-1 inline-block text-[8px] leading-none transition",
        state === "none" ? "text-ink-3/45" : "text-accent",
      )}
    >
      {state === "asc" ? "▲" : state === "desc" ? "▼" : "▲▼"}
    </span>
  );
}

export function SortableTable<T>({
  data,
  columns,
  initialSort,
  caption,
  rowKey,
  emptyMessage = "Sem registros no período selecionado.",
  maxHeight = 460,
  highlightTop = false,
}: {
  data: T[];
  columns: Column<T>[];
  initialSort: SortState;
  caption?: string;
  rowKey: (row: T, i: number) => string;
  emptyMessage?: string;
  maxHeight?: number;
  /** Marks the first row of the current sort with the accent rail. */
  highlightTop?: boolean;
}) {
  const [sort, setSort] = useState<SortState>(initialSort);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return data;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...data].sort((a, b) => {
      const va = col.value(a);
      const vb = col.value(b);
      if (va === null && vb === null) return 0;
      if (va === null) return 1; // nulls always last
      if (vb === null) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * factor;
      return String(va).localeCompare(String(vb), "pt-BR") * factor;
    });
  }, [data, columns, sort]);

  const barMax = useMemo(() => {
    const out: Record<string, number> = {};
    for (const c of columns) {
      if (!c.bar) continue;
      out[c.key] = Math.max(
        ...data.map((r) => {
          const v = c.value(r);
          return typeof v === "number" ? Math.abs(v) : 0;
        }),
        0,
      );
    }
    return out;
  }, [data, columns]);

  function toggle(key: string) {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "desc" ? "asc" : "desc" }
        : { key, dir: "desc" },
    );
  }

  if (!data.length) {
    return (
      <p className="px-5 py-10 text-center text-[13px] text-ink-3">{emptyMessage}</p>
    );
  }

  return (
    <div className="slim-scroll overflow-auto" style={{ maxHeight }}>
      <table className="w-full min-w-[720px] border-collapse text-[12.5px]">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead className="sticky top-0 z-10 bg-surface-1">
          <tr>
            {columns.map((c) => {
              const state = sort.key === c.key ? sort.dir : "none";
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={
                    state === "none" ? "none" : state === "asc" ? "ascending" : "descending"
                  }
                  className={clsx(
                    "border-b border-white/10 bg-surface-1 p-0",
                    c.align === "right" ? "text-right" : "text-left",
                    c.className,
                  )}
                >
                  <button
                    type="button"
                    onClick={() => toggle(c.key)}
                    title={c.hint}
                    className={clsx(
                      "w-full whitespace-nowrap px-3 py-2.5 text-[10.5px] font-bold uppercase tracking-[0.08em] transition hover:text-ink-1",
                      state === "none" ? "text-ink-3" : "text-ink-1",
                      c.align === "right" ? "text-right" : "text-left",
                    )}
                  >
                    {c.label}
                    <SortGlyph state={state} />
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr
              key={rowKey(row, i)}
              className={clsx(
                "border-b border-white/[0.06] transition last:border-0 hover:bg-white/[0.04]",
                highlightTop && i === 0 && "bg-accent/[0.05]",
              )}
            >
              {columns.map((c) => {
                const raw = c.value(row);
                const max = barMax[c.key] ?? 0;
                const width =
                  c.bar && typeof raw === "number" && max > 0
                    ? `${Math.max(2, (Math.abs(raw) / max) * 100)}%`
                    : null;
                return (
                  <td
                    key={c.key}
                    className={clsx(
                      "relative whitespace-nowrap px-3 py-2.5",
                      c.align === "right"
                        ? "text-right tabular-nums text-ink-1"
                        : "text-left text-ink-2",
                      c.className,
                    )}
                  >
                    {/* A translucent wash of yellow over the royal surface
                        desaturates into grey, so the magnitude cue is a solid
                        rule under the value instead of a tint behind it. */}
                    {width ? (
                      <span
                        aria-hidden
                        className="absolute bottom-1 left-2 h-[3px] rounded-full bg-accent"
                        style={{ width: `calc(${width} - 16px)` }}
                      />
                    ) : null}
                    <span className="relative">{c.render(row)}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
