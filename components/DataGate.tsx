"use client";

import Link from "next/link";
import { useCampaign } from "./DataProvider";

function Shimmer({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-card border border-white/[0.08] bg-white/[0.035] ${className}`}
    />
  );
}

/**
 * Refetches hold the previous render at reduced opacity — no skeleton flash,
 * no layout jump. The skeleton is only for the very first load.
 */
export function DataGate({ children }: { children: React.ReactNode }) {
  const { status, error, payload, refreshing } = useCampaign();

  if (status === "loading" && !payload) {
    return (
      <div aria-busy="true" aria-live="polite" className="space-y-4">
        <span className="sr-only">Carregando dados da campanha…</span>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <Shimmer className="col-span-2 h-[132px]" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Shimmer key={i} className="h-[132px]" />
          ))}
        </div>
        <div className="grid gap-3 lg:grid-cols-12">
          <Shimmer className="h-[360px] lg:col-span-7" />
          <Shimmer className="h-[360px] lg:col-span-5" />
        </div>
        <Shimmer className="h-[320px]" />
      </div>
    );
  }

  if (status === "error" && !payload) {
    return (
      <div className="rounded-card border border-[#F2696A]/30 bg-[#F2696A]/[0.07] p-6 sm:p-8">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-bad">
          <span aria-hidden>▼</span> Falha no carregamento
        </p>
        <h2 className="mt-3 text-xl font-extrabold tracking-[-0.02em]">
          Não foi possível carregar os dados
        </h2>
        <p className="mt-2 max-w-prose text-[13.5px] leading-relaxed text-ink-2">
          {error ?? "A origem não respondeu."}
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex rounded-pill bg-accent px-5 py-2.5 text-[13px] font-bold text-[#16255F] transition hover:brightness-105"
        >
          Voltar ao início
        </Link>
      </div>
    );
  }

  return (
    <div
      className={
        refreshing ? "opacity-60 transition-opacity duration-200" : "transition-opacity duration-200"
      }
    >
      {error && payload ? (
        <p className="mb-4 rounded-xl border border-[#EC835A]/30 bg-[#EC835A]/[0.08] px-4 py-2.5 text-[12.5px] text-ink-2">
          <span aria-hidden>● </span>
          Atualização falhou — exibindo os últimos dados carregados. {error}
        </p>
      ) : payload?.sourceError ? (
        <p className="mb-4 rounded-xl border border-[#FF9E6B]/30 bg-[#FF9E6B]/[0.08] px-4 py-2.5 text-[12.5px] text-ink-2">
          <span aria-hidden>● </span>
          A última tentativa de atualizar falhou — os números abaixo são do
          carregamento anterior. {payload.sourceError}
        </p>
      ) : null}
      {children}
    </div>
  );
}
