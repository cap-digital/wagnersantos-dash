import { brotliCompressSync, constants, gzipSync } from "node:zlib";

/**
 * Next does not compress Route Handler responses, and these payloads are large
 * blocks of very repetitive JSON — around 184 KB collapses to roughly 14 KB.
 * Compressing here is the difference between a fast dashboard and a slow one on
 * mobile networks.
 */
export function compressedJson(json: string, accept: string): Response {
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
