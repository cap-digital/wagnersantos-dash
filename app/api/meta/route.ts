import { NextResponse } from "next/server";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { getCampaign, lastFailure, refreshCampaign } from "@/lib/campaign-cache";

/**
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

/**
 * Next does not compress Route Handler responses, and this payload is ~184 KB
 * of very repetitive JSON — it collapses to ~14 KB. Compressing here is the
 * difference between a fast dashboard and a slow one on mobile networks.
 */
function compressed(json: string, accept: string): Response {
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600",
    Vary: "Accept-Encoding",
  };

  if (accept.includes("br")) {
    const body = brotliCompressSync(Buffer.from(json), {
      params: { [constants.BROTLI_PARAM_QUALITY]: 4 },
    });
    return new Response(body, { headers: { ...headers, "Content-Encoding": "br" } });
  }
  if (accept.includes("gzip")) {
    const body = gzipSync(Buffer.from(json), { level: 6 });
    return new Response(body, { headers: { ...headers, "Content-Encoding": "gzip" } });
  }
  return new Response(json, { headers });
}

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

    return compressed(json, request.headers.get("accept-encoding") ?? "");
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao consultar a origem." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
