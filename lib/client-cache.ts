"use client";

import { SOURCE_INFO, type SourceId } from "./sources";
import type { CampaignPayload } from "./types";

/**
 * Client-side memo of each panel's payload, keyed by source.
 *
 * The two panels have different endpoints and very different shapes of
 * staleness — one is frozen, the other moves through the day — so they never
 * share an entry. Keying by source is also what lets the cover page warm the
 * panel a visitor is about to open without touching the other one.
 */

const inflight = new Map<SourceId, Promise<CampaignPayload>>();
const snapshots = new Map<SourceId, CampaignPayload>();

async function request(source: SourceId, force: boolean): Promise<CampaignPayload> {
  const base = SOURCE_INFO[source].endpoint;
  const res = await fetch(force ? `${base}?force=1` : base, { cache: "no-store" });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || !Array.isArray(body.rows)) {
    throw new Error(body?.error ?? `A origem respondeu ${res.status}.`);
  }
  const payload = body as CampaignPayload;
  snapshots.set(source, payload);
  return payload;
}

/**
 * Shared between the cover page and the dashboard. The cover starts this on
 * mount, so by the time someone presses a panel button the data is usually
 * already in memory.
 *
 * There is no client-side retry: the server already serves from cache and
 * refreshes behind the request, so a failure here means a genuine problem at
 * the source — retrying would only stack another long wait.
 */
export function loadCampaign(source: SourceId, force = false): Promise<CampaignPayload> {
  const pending = inflight.get(source);
  if (!force && pending) return pending;

  const next = request(source, force).catch((err) => {
    // Clear the entry so the next call actually retries instead of replaying
    // the rejected promise.
    inflight.delete(source);
    throw err;
  });
  inflight.set(source, next);
  return next;
}

/** Fire-and-forget warm-up; failures surface later, on the real request. */
export function prefetchCampaign(source: SourceId): void {
  loadCampaign(source).catch(() => {
    /* the button press will retry and report */
  });
}

export function peekCampaign(source: SourceId): CampaignPayload | null {
  return snapshots.get(source) ?? null;
}
