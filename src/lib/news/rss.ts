import { XMLParser } from 'fast-xml-parser';

import { stripHtml } from '../games';
import { firstImgInHtml, lightenFeed } from './feed-lighten';
import type { Article } from './types';

/**
 * Gaming headlines, aggregated from the outlets' public RSS feeds.
 *
 * Two things worth knowing:
 *
 *  - **IGN returns 403 without a User-Agent.** React Native's default UA is
 *    rejected by their bot protection. We send a plain, honest identifier
 *    rather than impersonating a browser — that is enough to be served.
 *  - Feeds send no CORS headers, so this works on iOS/Android but not on
 *    `npm run web`, exactly like the Steam store endpoints.
 */

const USER_AGENT = 'Pinged/1.0 (RSS reader)';

export type Feed = { source: string; url: string };

/**
 * Verified working as of this writing. Eurogamer was dropped — its public feed
 * returns almost no items.
 */
export const FEEDS: readonly Feed[] = [
  { source: 'IGN', url: 'https://www.ign.com/rss/articles/feed?tags=games' },
  { source: 'PC Gamer', url: 'https://www.pcgamer.com/rss/' },
  { source: 'GameSpot', url: 'https://www.gamespot.com/feeds/news/' },
  { source: 'Kotaku', url: 'https://kotaku.com/rss' },
];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  // Feeds are inconsistent about whether a single item is an array; forcing
  // these paths to arrays removes a whole class of branching below.
  isArray: (name) => ['item', 'entry'].includes(name),
});

type RssItem = Record<string, unknown>;

/** RSS nodes are sometimes a string, sometimes `{ '#text': … }`. */
function text(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number') return String(value);
  if (value && typeof value === 'object') {
    const node = value as Record<string, unknown>;
    if (typeof node['#text'] === 'string') return node['#text'].trim() || null;
  }
  return null;
}

function attr(value: unknown, name: string): string | null {
  if (!value || typeof value !== 'object') return null;
  const node = (Array.isArray(value) ? value[0] : value) as Record<string, unknown>;
  const found = node[`@_${name}`];
  return typeof found === 'string' ? found : null;
}

/**
 * Outlets attach artwork in at least four different ways. Try each in the order
 * most likely to give a large image, then fall back to the first <img> in the
 * HTML description.
 */
function imageFrom(item: RssItem): string | null {
  return (
    attr(item['media:content'], 'url') ??
    attr(item['media:thumbnail'], 'url') ??
    attr(item['enclosure'], 'url') ??
    firstImgInHtml(text(item['content:encoded']) ?? text(item['description'])) ??
    null
  );
}

function toIso(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function parseFeed(xml: string, source: string): Article[] {
  const root = parser.parse(lightenFeed(xml)) as Record<string, any>;
  // RSS puts items under rss.channel.item; Atom uses feed.entry.
  const items: RssItem[] = root?.rss?.channel?.item ?? root?.feed?.entry ?? [];

  return items
    .map((item): Article | null => {
      const title = text(item.title);
      // Atom links are attributes; RSS links are text.
      const url = text(item.link) ?? attr(item.link, 'href');
      if (!title || !url) return null;

      return {
        id: text(item.guid) ?? text(item.id) ?? url,
        title,
        summary: stripHtml(text(item.description) ?? text(item.summary))?.slice(0, 240) ?? null,
        url,
        imageUrl: imageFrom(item),
        source,
        publishedAt: toIso(text(item.pubDate) ?? text(item.published) ?? text(item.updated)),
      };
    })
    .filter((article): article is Article => article !== null);
}

async function fetchFeed(feed: Feed, signal?: AbortSignal): Promise<Article[]> {
  const response = await fetch(feed.url, {
    signal,
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml, application/xml, text/xml' },
  });
  if (!response.ok) throw new Error(`${feed.source} returned ${response.status}`);
  return parseFeed(await response.text(), feed.source);
}

/**
 * Headlines from every outlet, newest first.
 *
 * One outlet being down or rate-limiting must not blank the tab, so failures
 * are per-feed and the rest still render.
 */
export async function getGamingNews(signal?: AbortSignal): Promise<Article[]> {
  const settled = await Promise.allSettled(FEEDS.map((feed) => fetchFeed(feed, signal)));

  const articles = settled
    .filter((result): result is PromiseFulfilledResult<Article[]> => result.status === 'fulfilled')
    .flatMap((result) => result.value);

  if (articles.length === 0) {
    throw new Error('Could not reach any news source.');
  }

  return articles.sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));
}
