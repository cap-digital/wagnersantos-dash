import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { MetaError } from "@/lib/meta/client";
import { TAG_TODAY, TODAY_TTL, fetchInsightsBundle } from "@/lib/meta/insights";
import { normalizeMeta } from "@/lib/meta/normalize";
import { compressedJson } from "@/lib/http";

/**
 * Live campaign data, straight from the Meta Marketing API.
 *
 * The handler itself always runs — it reads the query string, and a prerendered
 * copy would pin a bad response. Freshness comes from the Data Cache underneath:
 * closed months live for a day, today for ten minutes.
 */
export const dynamic = "force-dynamic";
/**
 * `force-dynamic` would otherwise make every fetch default to no-store, which
 * would throw away the whole partitioned cache. This restores the default and
 * lets each request state its own revalidate window.
 */
export const fetchCache = "default-cache";
export const runtime = "nodejs";
/**
 * A cold first fetch is ten-odd parallel page requests against a slow upstream,
 * measured at ~17s when nothing is cached. The ceiling is generous on purpose:
 * it only bites on that cold path, since every later request is served from the
 * Data Cache.
 */
export const maxDuration = 60;

/** A forced refresh may hit the network at most once per minute, account-wide. */
const FORCE_THROTTLE_MS = 60_000;

export async function GET(request: Request) {
  const force = new URL(request.url).searchParams.get("force") === "1";

  try {
    let bundle = await fetchInsightsBundle();

    // The throttle rides on the cached fetch timestamp rather than on a counter
    // in memory, so it holds across serverless instances instead of resetting
    // with every cold start.
    if (force) {
      const age = bundle.todayFetchedAt ? Date.now() - bundle.todayFetchedAt : Infinity;
      if (age >= FORCE_THROTTLE_MS) {
        // Drop the shared copy so the next visitor gets the new numbers too,
        // then read today live for the person who actually pressed the button.
        revalidateTag(TAG_TODAY);
        bundle = await fetchInsightsBundle({ refreshToday: true });
      }
    }

    const fetchedAt = new Date(bundle.todayFetchedAt ?? Date.now()).toISOString();
    const payload = normalizeMeta(bundle.rows, bundle.ads, fetchedAt);

    const ageSeconds = bundle.todayFetchedAt
      ? Math.max(0, Math.round((Date.now() - bundle.todayFetchedAt) / 1000))
      : 0;

    const json = JSON.stringify({
      ...payload,
      ageSeconds,
      stale: ageSeconds > TODAY_TTL,
      sourceError: bundle.partialErrors.length ? bundle.partialErrors.join(" ") : null,
    });

    return compressedJson(json, request.headers.get("accept-encoding") ?? "");
  } catch (err) {
    const message =
      err instanceof MetaError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Falha ao consultar a API da Meta.";
    // 502 for an upstream problem, 401 when a human has to replace the token —
    // the client shows the message either way, but the status tells them apart
    // in logs.
    const status = err instanceof MetaError && err.kind === "auth" ? 401 : 502;
    return NextResponse.json(
      { error: message },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
