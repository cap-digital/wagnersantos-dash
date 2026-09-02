import { parseAd, parseAdset } from "../labels";
import type { CampaignPayload, Creative, Row } from "../types";
import type { ActionEntry, AdMeta, InsightRow } from "./insights";

/**
 * Turns Graph rows into the exact `Row` shape the Supabase feed produces, so
 * every chart, table and metric works on both panels without knowing which
 * source it is looking at.
 */

/** Meta omits a metric entirely when nothing happened — that means zero. */
function num(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** Value of one action type inside an `actions`-style array. */
function action(list: ActionEntry[] | undefined, type: string): number {
  if (!list) return 0;
  for (const entry of list) {
    if (entry.action_type === type) return num(entry.value);
  }
  return 0;
}

/**
 * Video breakdowns report under the `video_view` action type regardless of the
 * metric, so every stage of the funnel reads the same key.
 */
const videoValue = (list: ActionEntry[] | undefined) => action(list, "video_view");

function gender(v: unknown): Row["gender"] {
  const g = typeof v === "string" ? v.toLowerCase() : "";
  return g === "female" || g === "male" ? g : "unknown";
}

/**
 * Identity of a creative across the account.
 *
 * The same post is frequently promoted by several ads — one per campaign, one
 * per city — and the panel should treat those as one creative, since they are
 * one piece of content with one set of results worth comparing. The Instagram
 * permalink is what makes them the same; an ad without one falls back to its own
 * id and stands alone.
 */
function creativeKeyOf(meta: AdMeta | undefined, adId: string): string {
  return meta?.permalink ?? `ad:${adId}`;
}

/** `[CJ05] … [BRUMADO] [FEED]` → `Brumado`, for disambiguating ad names. */
function placeOf(adsetName: string | undefined): string | null {
  // The city alone, not the ad set's full label: that one leads with the CJ code
  // and the objective, which say nothing about a creative and would crowd a
  // chart axis three lines deep.
  const city = adsetName ? parseAdset(adsetName).shortLabel.trim() : "";
  return city && city !== "—" ? city : null;
}

/** `[AD11] [POST] [NÃO FALTAM RAZÕES]` → `NÃO FALTAM RAZÕES`. */
function titleOf(name: string): string | null {
  const parts = Array.from(name.matchAll(/\[([^\]]+)\]/g)).map((m) => m[1].trim());
  const rest = parts.slice(1).filter((p) => p.toUpperCase() !== "POST");
  return rest.length ? rest[rest.length - 1] : null;
}

/**
 * Trims a qualifier to what an axis gutter can hold.
 *
 * These labels are chart categories in a column around eighty pixels wide, where
 * anything longer wraps and eats the plot. Cutting on a word keeps the fragment
 * readable.
 */
function shorten(text: string, max = 12): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > 5 ? cut.slice(0, space) : cut).trim()}…`;
}

type Group = {
  key: string;
  adIds: string[];
  name: string;
  thumbnail: string | null;
  permalink: string | null;
  place: string | null;
};

/**
 * Groups every ad into creatives and gives each one a name no other creative
 * shares.
 *
 * Both halves are needed. Several ads share a name — eight of them are just
 * `[AD]` — and a chart keyed by name would silently merge unrelated pieces;
 * meanwhile the same post running in two campaigns must not appear twice. So
 * ads collapse by permalink, and only then do colliding names earn a qualifier,
 * in the same bracket style the account already uses.
 */
function buildGroups(rows: InsightRow[], ads: AdMeta[]): Map<string, Group> {
  const metaByAd = new Map(ads.map((a) => [a.adId, a]));

  // Ads that ran in the period but are no longer returned by /ads (deleted, or
  // outside the page window) still have rows, so they get their names here.
  const rowName = new Map<string, string>();
  const rowPlace = new Map<string, string>();
  for (const r of rows) {
    const id = r.ad_id;
    if (!id) continue;
    if (!rowName.has(id) && r.ad_name) rowName.set(id, r.ad_name.trim());
    const place = placeOf(r.adset_name);
    if (place && !rowPlace.has(id)) rowPlace.set(id, place);
  }

  const adIds = new Set<string>(
    Array.from(metaByAd.keys()).concat(Array.from(rowName.keys())),
  );
  const groups = new Map<string, Group>();

  for (const adId of Array.from(adIds)) {
    const meta = metaByAd.get(adId);
    const key = creativeKeyOf(meta, adId);
    const name = meta?.name || rowName.get(adId) || `Anúncio ${adId}`;
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        key,
        adIds: [adId],
        name,
        thumbnail: meta?.thumbnail ?? null,
        permalink: meta?.permalink ?? null,
        place: rowPlace.get(adId) ?? null,
      });
      continue;
    }

    existing.adIds.push(adId);
    if (!existing.thumbnail && meta?.thumbnail) existing.thumbnail = meta.thumbnail;
    if (!existing.permalink && meta?.permalink) existing.permalink = meta.permalink;
    if (!existing.place) existing.place = rowPlace.get(adId) ?? null;
  }

  disambiguate(groups);
  return groups;
}

/** Writes a qualifier into an ad name's leading bracket: `[AD10 · BRUMADO]`. */
function withQualifier(name: string, qualifier: string): string {
  return /^\s*\[[^\]]*\]/.test(name)
    ? name.replace(/^(\s*\[[^\]]*)\]/, `$1 · ${qualifier}]`)
    : `[AD · ${qualifier}] ${name}`;
}

/**
 * Makes sure no two creatives read the same on screen.
 *
 * Uniqueness has to be judged on the rendered label rather than on the raw name,
 * because the two are not the same thing here: ad numbering restarts in every
 * campaign, so `[AD10] [POST] [FIB]` and `[AD10] [POST] [VAMOS JUNTOS]` are
 * different ads that would both plot as "AD 10", while eight ads named just
 * `[AD]` are different posts sharing one name. Colliding creatives take their own
 * headline, falling back to the ad set's city, and a counter settles the rest.
 */
function disambiguate(groups: Map<string, Group>): void {
  const labelOf = (name: string) => parseAd(name).label;

  const counts = new Map<string, number>();
  for (const group of Array.from(groups.values())) {
    const label = labelOf(group.name);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  // Anything already unique keeps the name it was given; the rest are qualified
  // together, so a pair never ends up as one bare label and one explained one.
  const taken = new Set<string>();
  const ambiguous: Group[] = [];
  for (const group of Array.from(groups.values())) {
    const label = labelOf(group.name);
    if ((counts.get(label) ?? 0) > 1) ambiguous.push(group);
    else taken.add(label);
  }

  // Sorted so the same account always produces the same names, run after run.
  ambiguous.sort((a, b) => a.name.localeCompare(b.name, "pt-BR") || a.key.localeCompare(b.key));

  for (const group of ambiguous) {
    // The ad's own headline says most about which creative this is; the ad set's
    // city covers the ads named just `[AD]`, which carry no headline at all.
    const base = shorten(
      titleOf(group.name) ?? group.place ?? `ID ${group.adIds[0].slice(-4)}`,
    );
    let candidate = withQualifier(group.name, base);
    for (let n = 2; taken.has(labelOf(candidate)) && n < 50; n++) {
      candidate = withQualifier(group.name, `${base} ${n}`);
    }
    group.name = candidate;
    taken.add(labelOf(candidate));
  }
}

export function normalizeMeta(
  insightRows: InsightRow[],
  ads: AdMeta[],
  fetchedAt: string,
): CampaignPayload {
  const groups = buildGroups(insightRows, ads);

  const nameByAd = new Map<string, string>();
  for (const group of Array.from(groups.values())) {
    for (const adId of group.adIds) nameByAd.set(adId, group.name);
  }

  const rows: Row[] = insightRows.map((r) => ({
    date: (r.date_start ?? "").slice(0, 10),
    campaign: (r.campaign_name ?? "").trim(),
    adset: (r.adset_name ?? "").trim(),
    ad: (r.ad_id ? nameByAd.get(r.ad_id) : undefined) ?? (r.ad_name ?? "").trim(),
    age: (r.age ?? "").trim() || "Unknown",
    gender: gender(r.gender),

    spend: num(r.spend),
    clicks: num(r.clicks),
    impressions: num(r.impressions),
    engagement: action(r.actions, "post_engagement"),
    reactions: action(r.actions, "post_reaction"),
    comments: action(r.actions, "comment"),
    shares: action(r.actions, "post"),
    saves: action(r.actions, "onsite_conversion.post_save"),
    profileVisits: num(r.instagram_profile_visits),

    videoViews: action(r.actions, "video_view"),
    thruplays: videoValue(r.video_thruplay_watched_actions),
    p25: videoValue(r.video_p25_watched_actions),
    p50: videoValue(r.video_p50_watched_actions),
    p75: videoValue(r.video_p75_watched_actions),
    p100: videoValue(r.video_p100_watched_actions),
  }));

  // Only creatives that actually delivered belong in the index — an ad set up
  // but never served would otherwise show as a thumbnail with no numbers.
  const delivered = new Set(rows.map((r) => r.ad).filter(Boolean));
  const creatives: Creative[] = Array.from(groups.values())
    .filter((g) => delivered.has(g.name))
    .map((g) => ({ ad: g.name, thumbnail: g.thumbnail, permalink: g.permalink }))
    .sort((a, b) => a.ad.localeCompare(b.ad, "pt-BR"));

  const days = Array.from(new Set(rows.map((r) => r.date).filter(Boolean))).sort();
  const campaigns = Array.from(
    new Set(rows.map((r) => r.campaign).filter(Boolean)),
  ).sort();

  return { rows, creatives, days, campaigns, fetchedAt };
}
