"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useCampaign } from "./DataProvider";

const NAV = [
  { href: "/visao-geral", label: "Visão geral", short: "Visão geral" },
  { href: "/criativos", label: "Criativos", short: "Criativos" },
];

/** Both round controls on the right read as one set, so they share a class. */
const CONTROL =
  "grid h-9 w-9 shrink-0 place-items-center rounded-pill border border-white/[0.12] bg-chrome/80 text-ink-2 shadow-float backdrop-blur-xl transition hover:bg-chrome hover:text-ink-1 disabled:opacity-45 sm:h-10 sm:w-10";

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

function HomeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
    </svg>
  );
}

export function TopBar() {
  const pathname = usePathname();
  const { reload, refreshing, status } = useCampaign();

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
      {/* No shared chrome: each control carries its own blur so it stays legible
          over whatever scrolls underneath it. The empty first grid column is
          what keeps the nav centred on the page rather than on the controls. */}
      <div className="pointer-events-auto mx-auto flex max-w-[1440px] items-center gap-2 sm:grid sm:grid-cols-[1fr_auto_1fr]">
        <nav
          aria-label="Seções do painel"
          className="min-w-0 flex-1 sm:col-start-2 sm:flex-none sm:justify-self-center"
        >
          <ul className="flex items-center gap-1 rounded-pill border border-white/10 bg-chrome/80 p-1 shadow-float backdrop-blur-xl">
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

        <div className="flex shrink-0 items-center gap-2 sm:col-start-3 sm:justify-self-end">
          <Link href="/" aria-label="Voltar à página inicial" title="Página inicial" className={CONTROL}>
            <HomeIcon />
          </Link>

          <button
            type="button"
            onClick={reload}
            disabled={refreshing || status === "loading"}
            aria-label="Atualizar dados"
            title="Atualizar dados"
            className={CONTROL}
          >
            <RefreshIcon spinning={refreshing} />
          </button>
        </div>
      </div>
    </header>
  );
}
