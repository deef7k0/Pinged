/**
 * What a studio's page says about the company itself — the line under its
 * name and its About card (the Apple pass, 2026-11-05: Apple Music's artist
 * page, "Developer · Since 1998"). Pure, under `npm test`.
 *
 * IGDB's `companies` carries `start_date` with a `start_date_format` — the
 * release dates' precision codes: 0 a day, 1 a month, 2 a year, and others
 * vaguer — and `country`, an ISO 3166-1 *numeric* code. Read in UTC: a
 * year-only founding is stored as 31 December of it (Supergiant's 2009 is
 * 1262217600), and local time would move it into the next year east of
 * Greenwich, or keep it and the 31st west of it.
 */

/** What the company does, by what IGDB lists it as having made. */
export type StudioRole = 'developer' | 'publisher' | 'both';

export type StudioAbout = {
  description: string | null;
  /** The year it was founded, when IGDB knows at least that. */
  founded: number | null;
  /** ISO 3166-1 numeric. */
  country: number | null;
  role: StudioRole | null;
};

export function roleOf(developed: number, published: number): StudioRole | null {
  if (developed > 0 && published > 0) return 'both';
  if (developed > 0) return 'developer';
  if (published > 0) return 'publisher';
  return null;
}

export const ROLE_WORDS: Record<StudioRole, string> = {
  developer: 'Developer',
  publisher: 'Publisher',
  both: 'Developer and publisher',
};

/** The founding year, or null for a date IGDB holds at less than a year's precision. */
export function foundedYear(
  startDate: number | null | undefined,
  format: number | null | undefined
): number | null {
  if (typeof startDate !== 'number' || !Number.isFinite(startDate)) return null;
  if (format !== undefined && format !== null && format > 2) return null;
  return new Date(startDate * 1000).getUTCFullYear();
}

/**
 * The countries video game companies are in, by IGDB's numeric code. A code
 * not here says nothing rather than a number.
 */
const COUNTRIES: Record<number, string> = {
  36: 'Australia',
  40: 'Austria',
  56: 'Belgium',
  76: 'Brazil',
  100: 'Bulgaria',
  124: 'Canada',
  152: 'Chile',
  156: 'China',
  191: 'Croatia',
  203: 'Czechia',
  208: 'Denmark',
  246: 'Finland',
  250: 'France',
  276: 'Germany',
  300: 'Greece',
  344: 'Hong Kong',
  348: 'Hungary',
  352: 'Iceland',
  356: 'India',
  372: 'Ireland',
  376: 'Israel',
  380: 'Italy',
  392: 'Japan',
  410: 'South Korea',
  440: 'Lithuania',
  458: 'Malaysia',
  484: 'Mexico',
  528: 'the Netherlands',
  554: 'New Zealand',
  578: 'Norway',
  604: 'Peru',
  608: 'the Philippines',
  616: 'Poland',
  620: 'Portugal',
  642: 'Romania',
  643: 'Russia',
  682: 'Saudi Arabia',
  688: 'Serbia',
  702: 'Singapore',
  703: 'Slovakia',
  705: 'Slovenia',
  710: 'South Africa',
  724: 'Spain',
  752: 'Sweden',
  756: 'Switzerland',
  158: 'Taiwan',
  764: 'Thailand',
  792: 'Turkey',
  804: 'Ukraine',
  784: 'the United Arab Emirates',
  826: 'the United Kingdom',
  840: 'the United States',
  32: 'Argentina',
  704: 'Vietnam',
};

export function countryName(code: number | null | undefined): string | null {
  return typeof code === 'number' ? (COUNTRIES[code] ?? null) : null;
}

/** "Developer · Since 1986 · 155 games": the line under a studio's name. */
export function studioMetaLine(about: StudioAbout | null | undefined, games: number): string {
  return [
    about?.role ? ROLE_WORDS[about.role] : null,
    about?.founded ? `Since ${about.founded}` : null,
    `${games} ${games === 1 ? 'game' : 'games'}`,
  ]
    .filter(Boolean)
    .join(' · ');
}
