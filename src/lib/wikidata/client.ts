import { Platform } from 'react-native';

import { isRecord } from './claims';

/**
 * Wikimedia's Action API — Wikidata's and Commons' — for the one thing the
 * app still asks of it: a studio's logo (`studio-logo.ts`).
 *
 * It was written for a second feature too: a game's "Additional information"
 * screen — awards, cast, budget, credits — read from the game's Wikidata item.
 * The owner had that feature scrapped (2026-10-09), and everything that served
 * only it went with it: finding a game's item, reading its claims, resolving
 * labels, telling people from studios. What is left is the transport.
 *
 * Wikidata rate-limits anonymous traffic by IP and means it — a burst answers
 * `429` with a `retry-after` — so callers run their requests one after
 * another, keep their answers, and report a 429 rather than retry it.
 *
 * Every read also sends `origin=*`, which is what lets the same requests run
 * from `npm run web`: the API answers anonymous CORS requests that carry it.
 */

export const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';

/** Wikimedia Commons' Action API — the same protocol, for file pages and their licences. */
export const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';

/**
 * Wikimedia asks every client to identify itself. Browsers will not let a page
 * set `User-Agent`, so the web build sends `Api-User-Agent`, which the API
 * reads in its place and allows through CORS; native builds send both.
 *
 * **Media needs it too.** Commons' image hosts (`thumb.wikimedia.org`,
 * `upload.wikimedia.org`) answer a generic client — Android's `okhttp/4.x`, which
 * is what an `<Image>` sends by default — with 403 "Please set a user-agent",
 * verified. Anything that loads a Wikimedia image passes this as a header.
 */
export const USER_AGENT =
  'Pinged/1.0 (com.nomicoprod.gamelog; studio logos from Wikimedia Commons)';

/** Long enough for a slow mobile connection; short enough that a dead one ends in the error state. */
const REQUEST_TIMEOUT_MS = 15_000;

export type WikidataErrorKind =
  'network' | 'timeout' | 'rate-limited' | 'unavailable' | 'malformed';

/** A failure to *reach or read* Wikidata — never "Wikidata has nothing", which is `null`. */
export class WikidataError extends Error {
  readonly kind: WikidataErrorKind;

  constructor(kind: WikidataErrorKind, message: string) {
    super(message);
    this.name = 'WikidataError';
    this.kind = kind;
  }
}

/** The hits of a `list=search` response: each page's title and id. */
export function searchHits(body: Record<string, unknown>): { title: string; pageid: number }[] {
  const hits = isRecord(body.query) ? body.query.search : undefined;
  if (!Array.isArray(hits))
    throw new WikidataError('malformed', 'No search results in the response.');
  return hits.filter(
    (hit): hit is { title: string; pageid: number } =>
      isRecord(hit) && typeof hit.title === 'string' && typeof hit.pageid === 'number'
  );
}

/**
 * One GET to the Action API, with its failures sorted into the kinds the
 * screen can say something useful about.
 *
 * The API reports its own errors with a `200` and an `error` object, so a
 * response is not a success until the body has been read.
 */
export async function wikimediaRequest(
  params: Record<string, string>,
  signal?: AbortSignal,
  endpoint: string = WIKIDATA_API
): Promise<Record<string, unknown>> {
  const query = Object.entries({ ...params, format: 'json', origin: '*' })
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Api-User-Agent': USER_AGENT,
  };
  if (Platform.OS !== 'web') headers['User-Agent'] = USER_AGENT;

  /* The query's own signal cancels the request when the screen goes away; the
     timer ends one that never answers. Chained by hand rather than through
     `AbortSignal.any`, which Hermes does not promise. */
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const cancel = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', cancel);

  let status: number;
  let text: string;
  try {
    const response = await fetch(`${endpoint}?${query}`, { headers, signal: controller.signal });
    status = response.status;
    text = await response.text();
  } catch (error) {
    if (signal?.aborted) throw error;
    if (controller.signal.aborted)
      throw new WikidataError('timeout', 'Wikidata did not answer in time.');
    throw new WikidataError('network', 'Could not reach Wikidata.');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }

  if (status === 429)
    throw new WikidataError('rate-limited', 'Wikidata is rate limiting requests.');
  if (status < 200 || status >= 300)
    throw new WikidataError('unavailable', `Wikidata returned ${status}.`);

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new WikidataError('malformed', 'Wikidata returned something that is not JSON.');
  }
  if (!isRecord(body))
    throw new WikidataError('malformed', 'Wikidata returned an unexpected shape.');

  if (isRecord(body.error)) {
    const code = typeof body.error.code === 'string' ? body.error.code : 'unknown';
    if (code === 'ratelimited' || code === 'maxlag') {
      throw new WikidataError('rate-limited', `Wikidata is busy (${code}).`);
    }
    throw new WikidataError('unavailable', `Wikidata refused the request (${code}).`);
  }
  return body;
}
