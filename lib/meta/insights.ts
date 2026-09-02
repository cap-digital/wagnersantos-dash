import "server-only";

import {
  MetaError,
  accountPath,
  assertCredentials,
  graphFetchAll,
  graphUrl,
} from "./client";

/**
 * Insights fetching, partitioned so the Next Data Cache can do its job.
 *
 * Two properties drive every decision here:
 *
 *  - **Closed days never change**, so each past month is its own cache entry with
 *    a 24-hour life. Today is a separate entry with a 10-minute life. A request
 *    on any given day therefore refetches one day, not the whole campaign.
 *  - **A cache entry caps at 2 MB on Vercel.** A page of 1,000 breakdown rows
 *    measures ~980 KB, so pages are the unit that gets cached, never the whole
 *    payload. Months are fetched in parallel and stitched together in memory.
 */

/** Ad account timezone. Fixed at UTC−3 with no DST, but resolved properly anyway. */
const ACCOUNT_TZ = "America/Bahia";

/** Closed days: a full day. They are settled and refetching them is waste. */
export const HISTORY_TTL = 86_400;
/** Today: short enough to feel live, long enough to stay off the rate limit. */
export const TODAY_TTL = 600;
/** Ad and creative metadata — thumbnails are signed and expire within days. */
const CREATIVES_TTL = 3_600;

/** Revalidating this drops today's rows and the creative list, nothing else. */
export const TAG_TODAY = "meta:today";
const TAG_HISTORY = "meta:history";
const TAG_CREATIVES = "meta:creatives";

/**
 * A page holds ~980 KB at this size — half the Data Cache entry limit, which
 * leaves room for days that carry more action types than the ones measured.
 */
const PAGE_SIZE = 1000;

/**
 * How far back the panel will ever look.
 *
 * A bound is needed so a stray old campaign cannot turn one page load into
 * dozens of partitions, but it is deliberately a rolling window rather than a
 * fixed date: a hard floor would silently drop real spend that fell before it,
 * and a panel that quietly under-reports is worse than one that is slow.
 */
const MAX_MONTHS_BACK = 24;

const INSIGHT_FIELDS = [
  "date_start",
  "campaign_name",
  "adset_name",
  "ad_id",
  "ad_name",
  "spend",
  "impressions",
  "clicks",
  "instagram_profile_visits",
  "actions",
  "video_thruplay_watched_actions",
  "video_p25_watched_actions",
  "video_p50_watched_actions",
  "video_p75_watched_actions",
  "video_p100_watched_actions",
].join(",");

export type ActionEntry = { action_type?: string; value?: string };

export type InsightRow = {
  date_start?: string;
  campaign_name?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  age?: string;
  gender?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  instagram_profile_visits?: string;
  actions?: ActionEntry[];
  video_thruplay_watched_actions?: ActionEntry[];
  video_p25_watched_actions?: ActionEntry[];
  video_p50_watched_actions?: ActionEntry[];
  video_p75_watched_actions?: ActionEntry[];
  video_p100_watched_actions?: ActionEntry[];
};

export type AdMeta = {
  adId: string;
  name: string;
  thumbnail: string | null;
  permalink: string | null;
};

/** Calendar day in the ad account's timezone, `YYYY-MM-DD`. */
export function accountToday(now = new Date()): string {
  // `en-CA` formats as YYYY-MM-DD, which is the shape the whole app uses.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ACCOUNT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function addDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return dt.toISOString().slice(0, 10);
}

const minISO = (a: string, b: string) => (a < b ? a : b);
const maxISO = (a: string, b: string) => (a > b ? a : b);

export type Partition = {
  /** Cache-key friendly identifier, e.g. `2026-08` or `today`. */
  id: string;
  since: string;
  until: string;
  kind: "history" | "today";
};

/**
 * Calendar months from `start` to yesterday, plus today on its own.
 *
 * Month boundaries — rather than, say, fixed 30-day windows — keep a partition's
 * key stable forever once the month closes, so yesterday's cache entry is still
 * valid tomorrow.
 */
export function planPartitions(start: string, today: string): Partition[] {
  const out: Partition[] = [];
  const [ty, tm, td] = today.split("-").map(Number);
  const earliest = new Date(Date.UTC(ty, tm - 1 - MAX_MONTHS_BACK, td))
    .toISOString()
    .slice(0, 10);
  const from = maxISO(start, earliest);
  const lastClosed = addDays(today, -1);

  let cursor = `${from.slice(0, 7)}-01`;
  while (cursor <= lastClosed) {
    const [y, m] = cursor.split("-").map(Number);
    const monthEnd = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    const since = maxISO(cursor, from);
    const until = minISO(monthEnd, lastClosed);
    if (since <= until) {
      out.push({ id: cursor.slice(0, 7), since, until, kind: "history" });
    }
    cursor = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  }

  out.push({ id: "today", since: today, until: today, kind: "today" });
  return out;
}

function insightsUrl(since: string, until: string): string {
  return graphUrl(`${accountPath()}/insights`, {
    level: "ad",
    breakdowns: "age,gender",
    time_increment: 1,
    time_range: JSON.stringify({ since, until }),
    fields: INSIGHT_FIELDS,
    limit: PAGE_SIZE,
  });
}

/**
 * One partition, cached page by page.
 *
 * Everything goes through plain fetch caching rather than `unstable_cache`: a
 * month of rows is far past the 2 MB an entry may hold, and wrapping the pages
 * in an outer cache would also have forced the inner fetches to opt out, whose
 * `revalidate: 0` then propagates outward and collapses the enclosing entry's
 * lifetime to nothing — the whole partition would refetch on every request.
 */
async function fetchPartition(
  partition: Partition,
  refreshToday: boolean,
): Promise<{ rows: InsightRow[]; fetchedAt: number }> {
  const today = partition.kind === "today";

  // A forced refresh reads today straight from the network. Invalidating the
  // tag alone is not enough inside one request: Next memoises fetches per
  // request by URL and options, so a second read of the same URL would hand
  // back the copy this request already resolved, and the reader would be told
  // the data refreshed while looking at the same numbers.
  const live = today && refreshToday;

  const result = await graphFetchAll<InsightRow>(
    insightsUrl(partition.since, partition.until),
    live
      ? { revalidate: 0 }
      : {
          revalidate: today ? TODAY_TTL : HISTORY_TTL,
          tags: [today ? TAG_TODAY : TAG_HISTORY],
        },
  );
  return { rows: result.body, fetchedAt: result.fetchedAt };
}

type CampaignNode = { start_time?: string; created_time?: string };

/**
 * First day the account has anything to show.
 *
 * Kept on the short TTL: it decides the partition list, so a campaign created
 * this morning has to be able to move it without waiting out a long cache.
 */
async function fetchStartDay(): Promise<string> {
  const url = graphUrl(`${accountPath()}/campaigns`, {
    fields: "start_time,created_time",
    limit: 200,
  });
  const { body: campaigns } = await graphFetchAll<CampaignNode>(url, {
    revalidate: TODAY_TTL,
    tags: [TAG_TODAY],
  });

  const days = campaigns
    .map((c) => (c.start_time ?? c.created_time ?? "").slice(0, 10))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));

  // With no campaigns there is nothing to chart, so the plan collapses to today
  // rather than sweeping a window of empty months.
  return days.length ? days.reduce((a, b) => (a < b ? a : b)) : accountToday();
}

type AdNode = {
  id?: string;
  name?: string;
  creative?: { thumbnail_url?: string; instagram_permalink_url?: string };
};

/**
 * Ad metadata: display name, preview and the post each ad points at.
 *
 * The thumbnail modifiers matter — a bare `thumbnail_url` is a 64×64 pixel
 * sprite, unusable next to a row of numbers, while this returns 1080px.
 */
async function fetchAdMeta(): Promise<AdMeta[]> {
  const url = graphUrl(`${accountPath()}/ads`, {
    fields:
      "id,name,creative.thumbnail_width(1080).thumbnail_height(1080){thumbnail_url,instagram_permalink_url}",
    limit: 200,
  });
  const { body: ads } = await graphFetchAll<AdNode>(url, {
    revalidate: CREATIVES_TTL,
    tags: [TAG_CREATIVES, TAG_TODAY],
  });

  return ads
    .filter((a): a is AdNode & { id: string } => Boolean(a.id))
    .map((a) => ({
      adId: a.id,
      name: (a.name ?? "").trim(),
      thumbnail: a.creative?.thumbnail_url ?? null,
      permalink: a.creative?.instagram_permalink_url ?? null,
    }));
}

export type InsightsBundle = {
  rows: InsightRow[];
  ads: AdMeta[];
  /** When today's slice was actually pulled, for the freshness badge. */
  todayFetchedAt: number | null;
  /** Partitions that failed while others succeeded. */
  partialErrors: string[];
};

/**
 * Every row the panel needs, with the partitions fetched concurrently.
 *
 * `allSettled` is the point: one month failing — a transient 500, a partition
 * that trips the rate limiter — leaves the other months intact, so the panel
 * shows what loaded with a warning instead of going blank. It only throws when
 * nothing at all came back, or when the failure is an expired token, which no
 * amount of partial data can paper over.
 */
export async function fetchInsightsBundle(
  { refreshToday = false }: { refreshToday?: boolean } = {},
): Promise<InsightsBundle> {
  assertCredentials();

  const today = accountToday();
  const start = await fetchStartDay();
  const partitions = planPartitions(start, today);

  const [adsResult, ...partitionResults] = await Promise.allSettled([
    fetchAdMeta(),
    ...partitions.map((p) => fetchPartition(p, refreshToday)),
  ]);

  const fatal = partitionResults.find(
    (r): r is PromiseRejectedResult =>
      r.status === "rejected" &&
      r.reason instanceof MetaError &&
      (r.reason.kind === "auth" || r.reason.kind === "config"),
  );
  if (fatal) throw fatal.reason;

  const rows: InsightRow[] = [];
  const partialErrors: string[] = [];
  let todayFetchedAt: number | null = null;
  let succeeded = 0;

  partitionResults.forEach((result, i) => {
    const partition = partitions[i];
    if (result.status === "fulfilled") {
      succeeded++;
      rows.push(...result.value.rows);
      if (partition.kind === "today") todayFetchedAt = result.value.fetchedAt;
      return;
    }
    const label = partition.kind === "today" ? "de hoje" : `de ${partition.id}`;
    const reason =
      result.reason instanceof Error ? result.reason.message : "falha desconhecida";
    partialErrors.push(`Os dados ${label} não carregaram: ${reason}`);
  });

  if (!succeeded) {
    const first = partitionResults.find((r) => r.status === "rejected");
    throw first && first.status === "rejected" && first.reason instanceof MetaError
      ? first.reason
      : new MetaError("Não foi possível carregar os dados da campanha na Meta.", {
          kind: "api",
        });
  }

  if (adsResult.status === "rejected") {
    // Numbers without previews still make a usable panel, so this degrades
    // rather than fails.
    partialErrors.push("As miniaturas e os links dos criativos não carregaram.");
  }

  return {
    rows,
    ads: adsResult.status === "fulfilled" ? adsResult.value : [],
    todayFetchedAt,
    partialErrors,
  };
}
