import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { normalize } from "./normalize";
import type { CampaignPayload } from "./types";

const ENDPOINT =
  process.env.META_FEED_URL ??
  "https://cqrpbiepyeypbkizwacu.supabase.co/functions/v1/WagnerSantosPC";

const KEY =
  process.env.META_FEED_KEY ?? "sb_publishable_YN9YKLw6sludrgf9T2i_1g_Dcm8dIiK";

/** Considered fresh for this long; past it we serve stale and refresh behind. */
const TTL_MS = 5 * 60_000;
/**
 * The upstream is a cold-starting edge function measured between 5s and 102s.
 * The timeout only bites on a genuine cold start, since every other request is
 * answered from cache.
 */
const TIMEOUT_MS = 75_000;
const CACHE_FILE = path.join(os.tmpdir(), "wagner-santos-meta-cache.json");

type Entry = { payload: CampaignPayload; at: number };

let memory: Entry | null = null;
let inflight: Promise<Entry> | null = null;
let lastError: string | null = null;

async function readDisk(): Promise<Entry | null> {
  try {
    const raw = await fs.readFile(CACHE_FILE, "utf8");
    const entry = JSON.parse(raw) as Entry;
    if (entry?.payload?.rows?.length && typeof entry.at === "number") return entry;
  } catch {
    /* no cache yet, or it is unreadable — treat as a cold start */
  }
  return null;
}

async function writeDisk(entry: Entry): Promise<void> {
  try {
    await fs.writeFile(CACHE_FILE, JSON.stringify(entry), "utf8");
  } catch {
    /* read-only filesystem — the in-memory copy still serves this instance */
  }
}

async function fetchUpstream(): Promise<CampaignPayload> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KEY}`,
        apikey: KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Functions" }),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`A origem respondeu ${res.status}.`);
    const payload = normalize(await res.json());
    if (!payload.rows.length) throw new Error("A origem respondeu sem registros.");
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * One refresh at a time. Concurrent callers share the same request instead of
 * each opening its own 75-second connection to a struggling upstream.
 */
function refresh(): Promise<Entry> {
  if (!inflight) {
    inflight = (async () => {
      // A 500 from this function is usually transient, so one quick retry is
      // worth it. A timeout is not — retrying would just double the wait.
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const payload = await fetchUpstream();
          const entry: Entry = { payload, at: Date.now() };
          memory = entry;
          lastError = null;
          void writeDisk(entry);
          return entry;
        } catch (err) {
          const timedOut = err instanceof Error && err.name === "AbortError";
          lastError = timedOut
            ? "A origem demorou demais para responder."
            : err instanceof Error
              ? err.message
              : "Falha ao consultar a origem.";
          if (timedOut || attempt === 1) throw new Error(lastError);
          await new Promise((r) => setTimeout(r, 700));
        }
      }
      throw new Error(lastError ?? "Falha ao consultar a origem.");
    })().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

export type CampaignResult = {
  payload: CampaignPayload;
  /** Seconds since the data was actually fetched from the source. */
  ageSeconds: number;
  /** True when the copy is older than the TTL and a refresh is running. */
  stale: boolean;
  sourceError: string | null;
};

/**
 * Stale-while-revalidate: a cached copy is returned immediately and refreshed
 * in the background. Only a genuine cold start waits on the network, which is
 * what kept every page load hostage to a 5–100s upstream.
 */
export async function getCampaign(): Promise<CampaignResult | null> {
  if (!memory) memory = await readDisk();

  if (memory) {
    const ageSeconds = Math.round((Date.now() - memory.at) / 1000);
    const stale = Date.now() - memory.at > TTL_MS;
    if (stale) void refresh().catch(() => {});
    return { payload: memory.payload, ageSeconds, stale, sourceError: stale ? lastError : null };
  }

  const entry = await refresh();
  return { payload: entry.payload, ageSeconds: 0, stale: false, sourceError: null };
}

/**
 * Manual "atualizar". It waits for the refresh, but only up to `maxWaitMs` —
 * the source can take 100 seconds, and a refresh button that spins that long is
 * worse than one that says "still working, here's what we have". The fetch
 * keeps running, so the next load picks up the new data.
 */
export async function refreshCampaign(maxWaitMs = 12_000): Promise<CampaignResult> {
  const pending = refresh();
  const won = await Promise.race([
    pending.catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), maxWaitMs)),
  ]);

  if (won) {
    return { payload: won.payload, ageSeconds: 0, stale: false, sourceError: null };
  }

  if (!memory) memory = await readDisk();
  if (memory) {
    return {
      payload: memory.payload,
      ageSeconds: Math.round((Date.now() - memory.at) / 1000),
      stale: true,
      sourceError: lastError,
    };
  }

  throw new Error(lastError ?? "A origem não respondeu a tempo.");
}

export function lastFailure(): string | null {
  return lastError;
}

/** Fire-and-forget warm-up, so the first visitor does not pay the cold start. */
export function warmCampaign(): void {
  void (async () => {
    if (!memory) memory = await readDisk();
    if (!memory || Date.now() - memory.at > TTL_MS) {
      await refresh().catch(() => {});
    }
  })();
}
