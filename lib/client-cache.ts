"use client";

import type { CampaignPayload } from "./types";

let inflight: Promise<CampaignPayload> | null = null;
let snapshot: CampaignPayload | null = null;

async function request(force: boolean): Promise<CampaignPayload> {
  const res = await fetch(force ? "/api/meta?force=1" : "/api/meta", { cache: "no-store" });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body || !Array.isArray(body.rows)) {
    throw new Error(body?.error ?? `A origem respondeu ${res.status}.`);
  }
  snapshot = body as CampaignPayload;
  return snapshot;
}

/**
 * Shared between the cover page and the dashboard. The cover starts this on
 * mount, so by the time someone presses "Acessar painel" the data is usually
 * already in memory.
 *
 * There is no client-side retry: the server already serves from cache and
 * refreshes behind the request, so a failure here means a genuine cold start
 * against a slow source — retrying would only stack another long wait.
 */
export function loadCampaign(force = false): Promise<CampaignPayload> {
  if (force || !inflight) {
    inflight = request(force).catch((err) => {
      // Clear the cache so the next call actually retries instead of replaying
      // the rejected promise.
      inflight = null;
      throw err;
    });
  }
  return inflight;
}

/** Fire-and-forget warm-up; failures surface later, on the real request. */
export function prefetchCampaign(): void {
  loadCampaign().catch(() => {
    /* the button press will retry and report */
  });
}

export function peekCampaign(): CampaignPayload | null {
  return snapshot;
}
