import { NextResponse } from "next/server";
import { getCampaign, lastFailure, refreshCampaign } from "@/lib/campaign-cache";
import { compressedJson } from "@/lib/http";

/**
 * The frozen pre-campaign panel. Its source is the Supabase edge function that
 * reads the original spreadsheet, and it stays exactly as it was — the campaign
 * panel is a separate route with a separate source.
 *
 * Always run the handler. With `revalidate` Next prerenders this route at build
 * time and then serves that snapshot — a bad build-time response would get
 * pinned and "tentar de novo" would keep getting the same failure. Freshness is
 * handled by the cache layer instead, which serves instantly and refreshes
 * behind the request.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;
/** The cache writes a snapshot to the filesystem, so this needs Node APIs. */
export const runtime = "nodejs";

export async function GET(request: Request) {
  const force = new URL(request.url).searchParams.get("force") === "1";

  try {
    const result = force ? await refreshCampaign() : await getCampaign();
    if (!result) throw new Error(lastFailure() ?? "Falha ao consultar a origem.");

    const json = JSON.stringify({
      ...result.payload,
      ageSeconds: result.ageSeconds,
      stale: result.stale,
      sourceError: result.sourceError,
    });

    return compressedJson(json, request.headers.get("accept-encoding") ?? "");
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao consultar a origem." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
