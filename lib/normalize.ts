import type { CampaignPayload, Creative, Row } from "./types";

/** Meta returns `""` for a metric with no events in the slice — that means 0. */
function num(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * The API sends `2026-07-21T03:00:00.000Z`, i.e. midnight in Brazil time
 * (UTC−3). Slicing the ISO string keeps the intended calendar day; building a
 * `Date` and reading local parts would shift it in other timezones.
 */
function isoDay(v: unknown): string {
  const s = str(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function gender(v: unknown): Row["gender"] {
  const g = str(v).toLowerCase();
  return g === "female" || g === "male" ? g : "unknown";
}

/** Untyped upstream record — every field is read through a coercion helper. */
type RawRecord = Record<string, unknown>;

function extractList(raw: unknown): RawRecord[] {
  if (Array.isArray(raw)) return raw as RawRecord[];
  if (raw && typeof raw === "object") {
    const obj = raw as RawRecord;
    for (const key of ["meta", "data", "rows", "result"]) {
      if (Array.isArray(obj[key])) return obj[key] as RawRecord[];
    }
  }
  return [];
}

export function normalize(raw: unknown): CampaignPayload {
  const list = extractList(raw);

  const rows: Row[] = list.map((r) => ({
    date: isoDay(r.date),
    campaign: str(r.campaign),
    adset: str(r.adset_name),
    ad: str(r.ad_name),
    age: str(r.age) || "Unknown",
    gender: gender(r.gender),

    spend: num(r.spend),
    clicks: num(r.clicks),
    impressions: num(r.impressions),
    engagement: num(r.actions_post_engagement),
    reactions: num(r.actions_post_reaction),
    comments: num(r.actions_comment),
    shares: num(r.actions_post),
    saves: num(r.actions_onsite_conversion_post_save),
    profileVisits: num(r.instagram_profile_visits),

    videoViews: num(r.actions_video_view),
    thruplays: num(r.video_thruplay_watched_actions_video_view),
    p25: num(r.video_p25_watched_actions_video_view),
    p50: num(r.video_p50_watched_actions_video_view),
    p75: num(r.video_p75_watched_actions_video_view),
    p100: num(r.video_p100_watched_actions_video_view),
  }));

  // Creative assets are identical across every breakdown row of an ad — hoist
  // them out so the payload does not repeat ~700-character CDN URLs 488 times.
  const creativeMap = new Map<string, Creative>();
  for (const r of list) {
    const ad = str(r.ad_name);
    if (!ad) continue;
    const existing = creativeMap.get(ad);
    const thumbnail = str(r.thumbnail_url) || null;
    const permalink = str(r.instagram_permalink_url) || null;
    if (!existing) {
      creativeMap.set(ad, { ad, thumbnail, permalink });
    } else {
      if (!existing.thumbnail && thumbnail) existing.thumbnail = thumbnail;
      if (!existing.permalink && permalink) existing.permalink = permalink;
    }
  }

  const days = Array.from(new Set(rows.map((r) => r.date).filter(Boolean))).sort();
  const campaigns = Array.from(new Set(rows.map((r) => r.campaign).filter(Boolean))).sort();

  return {
    rows,
    creatives: Array.from(creativeMap.values()).sort((a, b) => a.ad.localeCompare(b.ad, "pt-BR")),
    days,
    campaigns,
    fetchedAt: new Date().toISOString(),
  };
}
