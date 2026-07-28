"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { loadCampaign, peekCampaign } from "@/lib/client-cache";

const CHIPS = ["Meta Ads"];

const MARQUEE = [
  "VISÃO GERAL",
  "CRIATIVOS",
  "INVESTIMENTO",
  "ENGAJAMENTO",
  "ALCANCE",
  "PERFORMANCE",
];

/**
 * One marquee half. It is repeated REPEATS times so a half is always wider
 * than the viewport — the animation slides exactly one half (-50%), and the
 * second half lands where the first started, so the loop has no seam. Spacing
 * lives inside each item (`pr-10`) rather than as a flex `gap`, because a gap
 * between the two halves would not be part of the 50% and would show as a jump.
 */
const REPEATS = 3;

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h13M12 5l7 7-7 7" />
    </svg>
  );
}

export default function CoverPage() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    router.prefetch("/visao-geral");
    router.prefetch("/criativos");

    // Warm the payload up on arrival. The source takes several seconds, so by
    // the time someone presses the button it is usually already in memory and
    // the dashboard opens instantly.
    let alive = true;
    loadCampaign()
      .then(() => {
        if (alive) setReady(true);
      })
      .catch(() => {
        /* stays silent — the button press retries and reports */
      });
    return () => {
      alive = false;
    };
  }, [router]);

  async function enter(target: string, force = false) {
    setState("loading");
    setError(null);
    try {
      await loadCampaign(force);
      setReady(true);
      router.push(target);
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : "Falha ao carregar os dados.");
    }
  }

  const busy = state === "loading";
  const warming = !ready && state !== "error" && !peekCampaign();

  return (
    <div className="brand-field relative min-h-screen overflow-hidden">
      {/* Both columns are sized to their content and the pair is centred —
          fractional tracks stretched to the container and left a wide dead band
          between the copy and the portrait on large screens. */}
      <main className="relative mx-auto grid min-h-screen max-w-[1180px] items-center gap-10 px-5 pb-28 pt-16 lg:grid-cols-[minmax(0,540px)_420px] lg:justify-center lg:gap-16 lg:pb-32 lg:pt-20">
        <section className="animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-pill border border-white/25 bg-white/10 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white/85 backdrop-blur-sm">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-brand-yellow" />
            Pré-campanha 2026
          </span>

          <h1 className="mt-5 text-[clamp(2.6rem,8.5vw,5.2rem)] font-black uppercase leading-[0.92] tracking-[-0.035em] text-[#1E2B6B]">
            Painel de
            <span className="mt-1 block font-script text-[1.06em] font-normal normal-case tracking-normal text-white [text-shadow:0_6px_24px_rgba(12,20,54,.35)]">
              Mídia
            </span>
          </h1>

          <p className="mt-5 max-w-[46ch] text-[15px] leading-relaxed text-white/85 sm:text-base">
            Resultados das campanhas de{" "}
            <strong className="font-semibold text-brand-yellow">Meta Ads</strong> da pré-campanha de
            Wagner Santos — investimento, entrega, respostas do público e desempenho de cada
            criativo, com custos e taxas calculados sobre a base do período.
          </p>

          <ul className="mt-6 flex flex-wrap gap-2">
            {CHIPS.map((label) => (
              <li
                key={label}
                className="inline-flex min-w-[132px] items-center justify-center rounded-pill border border-white/25 bg-white/10 px-5 py-2 text-center text-[13px] font-medium text-white/90 backdrop-blur-sm"
              >
                {label}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => enter("/visao-geral")}
              disabled={busy}
              className="group inline-flex items-center justify-center gap-2.5 rounded-pill border border-white/35 px-7 py-4 text-[13.5px] font-black uppercase tracking-[0.1em] text-white transition hover:bg-white/10 active:scale-[.985] disabled:cursor-wait disabled:opacity-70"
            >
              {busy ? <Spinner /> : null}
              {busy ? "Carregando dados…" : "Acessar Painel Mídia"}
              {!busy ? (
                <span className="transition-transform group-hover:translate-x-0.5">
                  <ArrowIcon />
                </span>
              ) : null}
            </button>
          </div>

          {state !== "error" ? (
            <p
              aria-live="polite"
              className="mt-3 flex items-center gap-2 text-[12px] text-white/70"
            >
              <span
                aria-hidden
                className={`h-1.5 w-1.5 rounded-full ${
                  warming ? "animate-pulse bg-white/70" : "bg-[#22C55E]"
                }`}
              />
              {warming ? "Preparando os dados da campanha…" : "Dados prontos"}
            </p>
          ) : null}

          {state === "error" ? (
            <p
              role="alert"
              className="mt-4 inline-flex items-start gap-2 rounded-xl border border-white/30 bg-[#2A1030]/45 px-4 py-3 text-[13px] text-white"
            >
              <span aria-hidden className="mt-px">▼</span>
              <span>
                <strong className="font-semibold">Não foi possível carregar.</strong> {error}{" "}
                <button
                  type="button"
                  onClick={() => enter("/visao-geral", true)}
                  className="underline underline-offset-2"
                >
                  Tentar de novo
                </button>
              </span>
            </p>
          ) : null}
        </section>

        <section className="relative animate-fade-up [animation-delay:.08s]">
          <div className="relative mx-auto w-full max-w-[420px]">
            <div className="overflow-hidden rounded-[28px] border border-white/20 shadow-[0_40px_90px_-40px_rgba(6,12,40,.95)]">
              <Image
                src="/wagner.webp"
                alt="Retrato de Wagner Santos, pré-candidato a Deputado Estadual pela Bahia"
                width={1488}
                height={1500}
                priority
                sizes="(max-width: 1024px) 90vw, 440px"
                className="h-auto w-full object-cover"
              />
            </div>

            <div className="absolute -bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-2.5 rounded-2xl bg-white px-4 py-2.5 shadow-[0_18px_40px_-18px_rgba(6,12,40,.8)]">
              <span
                aria-hidden
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#22C55E] text-[13px] font-black text-white"
              >
                ✓
              </span>
              <span className="leading-tight">
                <span className="block whitespace-nowrap text-[11px] font-black uppercase tracking-[0.1em] text-[#1E2B6B]">
                  Dados em tempo real
                </span>
                <span className="block whitespace-nowrap text-[11.5px] text-[#5A6486]">
                  Meta Ads · Performance
                </span>
              </span>
            </div>
          </div>
        </section>
      </main>

      {/* Yellow band, straight from the campaign identity */}
      <div className="absolute inset-x-0 bottom-0 overflow-hidden border-y border-[#0E1740]/10 bg-brand-yellow py-3.5">
        <div className="flex w-max animate-marquee whitespace-nowrap will-change-transform">
          {[0, 1].map((half) => (
            <div key={half} className="flex shrink-0" aria-hidden={half === 1}>
              {Array.from({ length: REPEATS }).flatMap((_, rep) =>
                MARQUEE.map((word) => (
                  <span
                    key={`${half}-${rep}-${word}`}
                    className="flex items-center gap-10 pr-10 text-[13px] font-black uppercase tracking-[0.28em] text-[#1E2B6B]"
                  >
                    {word}
                    <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#E0559B]" />
                  </span>
                )),
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
