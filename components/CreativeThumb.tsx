"use client";

/* eslint-disable @next/next/no-img-element -- Meta CDN URLs are signed and
   short-lived; next/image would cache a URL that expires within days. A plain
   img lets us fall back cleanly the moment the signature dies. */

import { useState } from "react";
import clsx from "clsx";
import { parseAd } from "@/lib/labels";

export function CreativeThumb({
  src,
  ad,
  className,
  rounded = "rounded-xl",
}: {
  src: string | null | undefined;
  ad: string;
  className?: string;
  rounded?: string;
}) {
  const [failed, setFailed] = useState(false);
  const info = parseAd(ad);

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={`Miniatura indisponível do criativo ${info.label}`}
        className={clsx(
          "grid place-items-center bg-gradient-to-br from-surface-3 to-surface-2 text-center",
          rounded,
          className,
        )}
      >
        <span className="px-2">
          <span className="block text-[13px] font-black tracking-tight text-ink-2">
            {info.label}
          </span>
          <span className="mt-0.5 block text-[9.5px] uppercase tracking-[0.12em] text-ink-3">
            sem prévia
          </span>
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`Prévia do criativo ${info.label}`}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={clsx("object-cover", rounded, className)}
    />
  );
}

export function InstagramLink({ href }: { href: string | null | undefined }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-pill border border-white/[0.12] bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-ink-2 transition hover:bg-white/[0.12] hover:text-ink-1"
    >
      Ver no Instagram
      <svg viewBox="0 0 24 24" aria-hidden className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 17 17 7M8 7h9v9" />
      </svg>
    </a>
  );
}
