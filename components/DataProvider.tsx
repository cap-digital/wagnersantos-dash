"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { loadCampaign, peekCampaign } from "@/lib/client-cache";
import { SOURCE_INFO, type SourceId, type SourceInfo } from "@/lib/sources";
import type { CampaignPayload, Creative, DateRange, Row } from "@/lib/types";

/**
 * Filter state is stored per source. The two panels cover different periods, so
 * a range remembered on one would be clamped into nonsense on the other.
 */
const rangeKey = (source: SourceId) => `ws.${source}.range`;
const campaignKey = (source: SourceId) => `ws.${source}.campaigns`;

type Status = "loading" | "ready" | "error";

type Ctx = {
  /** Which panel this tree is showing, and its labels. */
  source: SourceInfo;
  status: Status;
  error: string | null;
  payload: CampaignPayload | null;
  refreshing: boolean;
  reload: () => void;

  /** Rows inside the active period and campaign selection. */
  rows: Row[];
  /** Rows in the equally sized period immediately before, for deltas. */
  previousRows: Row[];
  /** Calendar days inside the active period. */
  days: string[];
  /** Every day present in the dataset. */
  allDays: string[];
  range: DateRange | null;
  setRange: (r: DateRange) => void;

  /** Every campaign in the dataset. */
  campaigns: string[];
  /** Empty means "all campaigns" — new campaigns are included automatically. */
  selectedCampaigns: string[];
  setSelectedCampaigns: (c: string[]) => void;

  creativeOf: (ad: string) => Creative | undefined;
};

const DataContext = createContext<Ctx | null>(null);

function clampRange(range: DateRange, allDays: string[]): DateRange {
  const first = allDays[0];
  const last = allDays[allDays.length - 1];
  const from = range.from < first ? first : range.from > last ? last : range.from;
  const to = range.to > last ? last : range.to < first ? first : range.to;
  return from <= to ? { from, to } : { from: to, to: from };
}

function readStored<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeStored(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode — the selection simply won't persist */
  }
}

export function DataProvider({
  source,
  children,
}: {
  source: SourceId;
  children: React.ReactNode;
}) {
  const cached = peekCampaign(source);
  const [payload, setPayload] = useState<CampaignPayload | null>(cached);
  const [status, setStatus] = useState<Status>(cached ? "ready" : "loading");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRangeState] = useState<DateRange | null>(null);
  const [selectedCampaigns, setSelectedState] = useState<string[]>([]);

  const ingest = useCallback((data: CampaignPayload) => {
    setPayload(data);
    setStatus("ready");
    setError(null);

    setRangeState((current) => {
      if (current) return clampRange(current, data.days);
      const stored = readStored<DateRange>(rangeKey(source));
      const fallback = { from: data.days[0], to: data.days[data.days.length - 1] };
      return stored?.from && stored?.to ? clampRange(stored, data.days) : fallback;
    });

    // Drop campaigns that no longer exist; an empty list keeps meaning "all",
    // so campaigns added later are picked up without touching the filter.
    setSelectedState((current) => {
      const chosen = current.length ? current : (readStored<string[]>(campaignKey(source)) ?? []);
      return chosen.filter((c) => data.campaigns.includes(c));
    });
  }, [source]);

  useEffect(() => {
    let alive = true;
    loadCampaign(source)
      .then((data) => alive && ingest(data))
      .catch((err: Error) => {
        if (!alive) return;
        setStatus("error");
        setError(err.message);
      });
    return () => {
      alive = false;
    };
  }, [ingest, source]);

  const reload = useCallback(() => {
    setRefreshing(true);
    setError(null);
    loadCampaign(source, true)
      .then(ingest)
      .catch((err: Error) => {
        setError(err.message);
        if (!peekCampaign(source)) setStatus("error");
      })
      .finally(() => setRefreshing(false));
  }, [ingest, source]);

  const setRange = useCallback(
    (next: DateRange) => {
      const clamped = payload ? clampRange(next, payload.days) : next;
      setRangeState(clamped);
      writeStored(rangeKey(source), clamped);
    },
    [payload, source],
  );

  const setSelectedCampaigns = useCallback(
    (next: string[]) => {
      setSelectedState(next);
      writeStored(campaignKey(source), next);
    },
    [source],
  );

  const value = useMemo<Ctx>(() => {
    const allDays = payload?.days ?? [];
    const allRows = payload?.rows ?? [];
    const campaigns = payload?.campaigns ?? [];
    const active = range ?? { from: allDays[0], to: allDays[allDays.length - 1] };

    const campaignSet = selectedCampaigns.length ? new Set(selectedCampaigns) : null;
    const inScope = campaignSet ? allRows.filter((r) => campaignSet.has(r.campaign)) : allRows;

    const rows = range
      ? inScope.filter((r) => r.date >= active.from && r.date <= active.to)
      : inScope;

    const days = allDays.filter((d) => d >= active.from && d <= active.to);

    // Comparison window: the same number of days ending the day before `from`.
    const span = days.length || 1;
    const beforeIdx = allDays.indexOf(active.from);
    const prevDays =
      beforeIdx > 0 ? allDays.slice(Math.max(0, beforeIdx - span), beforeIdx) : [];
    const prevSet = new Set(prevDays);
    const previousRows = prevDays.length ? inScope.filter((r) => prevSet.has(r.date)) : [];

    const creativeIndex = new Map((payload?.creatives ?? []).map((c) => [c.ad, c]));

    return {
      source: SOURCE_INFO[source],
      status,
      error,
      payload,
      refreshing,
      reload,
      rows,
      previousRows,
      days,
      allDays,
      range: range ?? null,
      setRange,
      campaigns,
      selectedCampaigns,
      setSelectedCampaigns,
      creativeOf: (ad: string) => creativeIndex.get(ad),
    };
  }, [
    payload,
    range,
    selectedCampaigns,
    source,
    status,
    error,
    refreshing,
    reload,
    setRange,
    setSelectedCampaigns,
  ]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useCampaign(): Ctx {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useCampaign precisa estar dentro de <DataProvider>.");
  return ctx;
}
