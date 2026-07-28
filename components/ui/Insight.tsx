import clsx from "clsx";

export type InsightTone = "neutral" | "good" | "bad" | "watch";

const TONE: Record<InsightTone, { ring: string; dot: string; icon: string; label: string }> = {
  neutral: { ring: "border-white/10", dot: "bg-ink-3", icon: "▪", label: "Leitura" },
  good: { ring: "border-[#2ECC71]/30", dot: "bg-[#2ECC71]", icon: "▲", label: "Positivo" },
  bad: { ring: "border-[#F2696A]/30", dot: "bg-[#F2696A]", icon: "▼", label: "Atenção" },
  watch: { ring: "border-[#EC835A]/30", dot: "bg-[#EC835A]", icon: "●", label: "Observar" },
};

/** Renders `**bold**` spans without pulling in a markdown dependency. */
function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-semibold text-ink-1">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

/**
 * The written read of a chart. Status is never carried by colour alone — the
 * icon and its label ride along with it.
 */
export function Insight({
  children,
  tone = "neutral",
  className,
}: {
  children: string;
  tone?: InsightTone;
  className?: string;
}) {
  const t = TONE[tone];
  return (
    <div
      className={clsx(
        "flex items-start gap-2.5 rounded-xl border bg-white/[0.03] px-3.5 py-2.5",
        t.ring,
        className,
      )}
    >
      <span
        aria-hidden
        className={clsx(
          "mt-[3px] grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full text-[9px] leading-none",
          t.dot,
          tone === "neutral" ? "text-page" : "text-page",
        )}
      >
        {t.icon}
      </span>
      <p className="text-[12.5px] leading-[1.5] text-ink-2">
        <span className="sr-only">{t.label}: </span>
        <RichText text={children} />
      </p>
    </div>
  );
}
