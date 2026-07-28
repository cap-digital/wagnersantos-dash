"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useCampaign } from "./DataProvider";

const NAV = [
  { href: "/visao-geral", label: "Visão geral", short: "Visão geral" },
  { href: "/criativos", label: "Criativos", short: "Criativos" },
];

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={clsx("h-4 w-4", spinning && "animate-spin")}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 11a8 8 0 1 0-.6 4" />
      <path d="M20 5v6h-6" />
    </svg>
  );
}

export function TopBar() {
  const pathname = usePathname();
  const { reload, refreshing, status } = useCampaign();

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
      <div className="pointer-events-auto mx-auto flex max-w-[1440px] flex-col gap-2 rounded-[26px] border border-white/[0.12] bg-chrome/85 p-2 shadow-float backdrop-blur-xl sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:rounded-pill sm:p-2 sm:pl-3">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className="group flex items-center gap-2.5 rounded-pill px-1 py-1 sm:px-1.5"
          >
            <span
              aria-hidden
              className="grid h-9 w-9 shrink-0 place-items-center rounded-[13px] bg-accent text-[13px] font-black tracking-tight text-[#16255F] transition group-hover:scale-[1.04]"
            >
              WS
            </span>
            <span className="min-w-0 leading-none">
              <span className="block truncate text-[13.5px] font-extrabold tracking-[-0.02em] text-ink-1">
                Wagner Santos
              </span>
              <span className="mt-1 block truncate text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-3">
                Painel de mídia
              </span>
            </span>
          </Link>

          <button
            type="button"
            onClick={reload}
            disabled={refreshing || status === "loading"}
            aria-label="Atualizar dados"
            title="Atualizar dados"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-pill border border-white/[0.12] bg-white/5 text-ink-2 transition hover:bg-white/10 hover:text-ink-1 disabled:opacity-45 sm:hidden"
          >
            <RefreshIcon spinning={refreshing} />
          </button>
        </div>

        <nav aria-label="Seções do painel" className="flex-1 sm:flex-none sm:justify-self-center">
          <ul className="flex items-center gap-1 rounded-pill border border-white/10 bg-white/[0.04] p-1">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <li key={item.href} className="flex-1 sm:flex-none">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={clsx(
                      "block rounded-pill px-4 py-2 text-center text-[13px] font-bold tracking-[-0.01em] transition",
                      active
                        ? "bg-accent text-[#16255F] shadow-[0_6px_18px_-8px_rgba(255,216,77,0.9)]"
                        : "text-ink-2 hover:bg-white/[0.08] hover:text-ink-1",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="hidden items-center gap-2 sm:flex sm:justify-self-end">
          <button
            type="button"
            onClick={reload}
            disabled={refreshing || status === "loading"}
            aria-label="Atualizar dados"
            title="Atualizar dados"
            className="grid h-10 w-10 place-items-center rounded-pill border border-white/[0.12] bg-white/5 text-ink-2 transition hover:bg-white/10 hover:text-ink-1 disabled:opacity-45"
          >
            <RefreshIcon spinning={refreshing} />
          </button>
        </div>
      </div>
    </header>
  );
}
