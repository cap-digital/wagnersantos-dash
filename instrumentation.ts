/**
 * Warms the campaign cache when the server boots, so the first visitor does not
 * pay the upstream's cold start (measured between 5 and 102 seconds).
 *
 * The import has to sit inside a `=== "nodejs"` check: Next compiles this file
 * for the edge runtime too, and only that exact shape gets tree-shaken out of
 * the edge bundle — otherwise webpack tries to resolve `node:fs` there.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { warmCampaign } = await import("./lib/campaign-cache");
    warmCampaign();
  }
}
