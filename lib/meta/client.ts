import "server-only";

/**
 * Thin Graph API client. Everything here runs on the server: the access token
 * is a system-user credential and must never reach the browser bundle, which is
 * what the `server-only` import above enforces at build time.
 */

const API_VERSION = process.env.META_API_VERSION ?? "v21.0";
const ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID ?? "";
const TOKEN = process.env.META_ACCESS_TOKEN ?? "";

export const GRAPH = `https://graph.facebook.com/${API_VERSION}`;

/** The ad account path segment, `act_…`, as Graph expects it. */
export function accountPath(): string {
  return ACCOUNT_ID;
}

export function assertCredentials(): void {
  if (!TOKEN || !ACCOUNT_ID) {
    throw new MetaError(
      "As credenciais da Meta não estão configuradas neste ambiente.",
      { kind: "config" },
    );
  }
}

export type MetaErrorKind = "auth" | "rate" | "config" | "network" | "api";

/**
 * Carries a message already written for the panel. The UI renders `message`
 * verbatim, so it is always in Portuguese and never a raw Graph string.
 */
export class MetaError extends Error {
  readonly kind: MetaErrorKind;
  readonly code?: number;
  readonly subcode?: number;

  constructor(
    message: string,
    info: { kind: MetaErrorKind; code?: number; subcode?: number },
  ) {
    super(message);
    this.name = "MetaError";
    this.kind = info.kind;
    this.code = info.code;
    this.subcode = info.subcode;
  }
}

/** Graph codes that mean "this token will not work until a human acts". */
const AUTH_CODES = new Set([190, 102, 10]);
/** Graph codes for throttling — the request may succeed later, untouched. */
const RATE_CODES = new Set([4, 17, 32, 613, 80000, 80004]);

type GraphError = {
  message?: string;
  code?: number;
  error_subcode?: number;
  type?: string;
};

function translate(error: GraphError, status: number): MetaError {
  const code = error.code;
  const subcode = error.error_subcode;

  if (code !== undefined && AUTH_CODES.has(code)) {
    // 190/463 and 190/467 are the expiry subcodes; the rest of the 190 family
    // is a revoked or malformed token. Both need the same human action.
    const expired = subcode === 463 || subcode === 467;
    return new MetaError(
      expired
        ? "O token de acesso da Meta expirou. Gere um novo token do usuário de sistema e atualize META_ACCESS_TOKEN."
        : "O token de acesso da Meta é inválido ou não tem permissão para ler esta conta de anúncios.",
      { kind: "auth", code, subcode },
    );
  }

  if (code !== undefined && RATE_CODES.has(code)) {
    return new MetaError(
      "A Meta está limitando as consultas desta conta no momento. Os dados voltam a atualizar em alguns minutos.",
      { kind: "rate", code, subcode },
    );
  }

  return new MetaError(
    error.message
      ? `A Meta recusou a consulta: ${error.message}`
      : `A Meta respondeu ${status}.`,
    { kind: "api", code, subcode },
  );
}

export type FetchOptions = {
  /** Seconds the Next Data Cache keeps this response. */
  revalidate: number;
  /** Cache tags, so a targeted revalidate can drop just today's partitions. */
  tags?: string[];
  signal?: AbortSignal;
};

export type GraphResult<T> = {
  body: T;
  /**
   * When Meta actually served this, read from the response `Date` header.
   *
   * It survives in the Data Cache alongside the body, which is the whole point:
   * on a cache hit it still reports the original network time, so the panel can
   * say how old the numbers really are instead of restarting the clock on every
   * request.
   */
  fetchedAt: number;
};

/**
 * One Graph request through the Next Data Cache.
 *
 * The token travels in the Authorization header rather than in the query
 * string: the URL is the cache key, and a key holding a live credential would
 * both leak it into cache storage and bust every entry the moment the token is
 * rotated.
 */
export async function graphFetch<T>(
  url: string,
  { revalidate, tags, signal }: FetchOptions,
): Promise<GraphResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      next: { revalidate, tags },
      signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new MetaError("A consulta à Meta demorou demais e foi interrompida.", {
        kind: "network",
      });
    }
    throw new MetaError("Não foi possível falar com a API da Meta.", { kind: "network" });
  }

  const body = (await res.json().catch(() => null)) as
    | (T & { error?: GraphError })
    | null;

  if (!res.ok || body?.error) {
    throw translate(body?.error ?? {}, res.status);
  }
  if (!body) {
    throw new MetaError("A Meta respondeu em um formato inesperado.", { kind: "api" });
  }

  const served = Date.parse(res.headers.get("date") ?? "");
  return { body, fetchedAt: Number.isFinite(served) ? served : Date.now() };
}

/** Builds a Graph URL with the params sorted, so the cache key is stable. */
export function graphUrl(path: string, params: Record<string, string | number>): string {
  const url = new URL(`${GRAPH}/${path}`);
  for (const key of Object.keys(params).sort()) {
    url.searchParams.set(key, String(params[key]));
  }
  return url.toString();
}

export type Paged<T> = {
  data: T[];
  paging?: { next?: string; cursors?: { after?: string } };
};

/**
 * Walks every page of a Graph edge.
 *
 * Each page is cached under its own key — the `next` URL carries the cursor, so
 * page 2 of a closed month is as reusable as page 1. `maxPages` is a guard
 * against a pagination loop, not an expected limit.
 */
export async function graphFetchAll<T>(
  firstUrl: string,
  options: FetchOptions,
  maxPages = 40,
): Promise<GraphResult<T[]>> {
  const out: T[] = [];
  let url: string | undefined = firstUrl;
  // The first page dates the whole partition: the others are fetched moments
  // after it, and it is the one that gets refetched when the window lapses.
  let fetchedAt = Date.now();

  for (let page = 0; url && page < maxPages; page++) {
    const result: GraphResult<Paged<T>> = await graphFetch<Paged<T>>(url, options);
    if (page === 0) fetchedAt = result.fetchedAt;
    if (Array.isArray(result.body.data)) out.push(...result.body.data);
    url = result.body.paging?.next;
  }
  return { body: out, fetchedAt };
}
