"use client";

import { useCampaign } from "./DataProvider";
import { CampaignFilter } from "./CampaignFilter";
import { DateRangePicker } from "./DateRangePicker";
import { fmtAge, fmtDayShort } from "@/lib/format";

/**
 * One filter row, above everything it scopes. Every chart, stat and table on
 * the page re-renders against this same slice.
 */
export function FilterBar() {
  const {
    range,
    allDays,
    setRange,
    campaigns,
    selectedCampaigns,
    setSelectedCampaigns,
    days,
    previousRows,
    refreshing,
    payload,
  } = useCampaign();

  if (!range || !allDays.length) {
    return <div className="mb-5 h-[52px] rounded-pill border border-white/[0.08] bg-white/[0.03]" />;
  }

  const comparing = previousRows.length > 0;

  return (
    <div className="relative z-30 mb-5 lg:sticky lg:top-[92px]">
      <div className="flex flex-wrap items-center gap-2 rounded-[22px] border border-white/10 bg-chrome/85 p-2 shadow-card backdrop-blur-xl sm:rounded-pill sm:pl-2.5">
        <DateRangePicker range={range} allDays={allDays} onChange={setRange} />

        <CampaignFilter
          campaigns={campaigns}
          selected={selectedCampaigns}
          onChange={setSelectedCampaigns}
        />

        <span className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-1 px-1 text-[11.5px] text-ink-3">
          {comparing ? (
            <span>
              vs. {days.length} {days.length === 1 ? "dia" : "dias"} anteriores
            </span>
          ) : (
            <span>
              Base: {fmtDayShort(allDays[0])} – {fmtDayShort(allDays[allDays.length - 1])}
            </span>
          )}
          {/* The source is slow, so the dashboard is honest about how old the
              numbers it is showing actually are. */}
          <span className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={
                refreshing
                  ? "h-1.5 w-1.5 animate-pulse rounded-full bg-accent"
                  : "h-1.5 w-1.5 rounded-full bg-good"
              }
            />
            {refreshing ? (
              <span className="text-accent">Atualizando…</span>
            ) : (
              <>Dados de {fmtAge(payload?.ageSeconds)}</>
            )}
          </span>
        </span>
      </div>
    </div>
  );
}
