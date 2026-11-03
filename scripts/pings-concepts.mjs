#!/usr/bin/env node
/**
 * The five Pings screens, drawn to look at.
 *
 * The owner asked for alternatives for the Pings tab (2026-10-31) and this
 * machine cannot run the app: there is no Android SDK here, the owner asked
 * for no emulator, and a browser cannot draw React Native. So the concepts are
 * rendered the way this repo has always judged a design without a device — a
 * still built from the real tokens and the real font metrics, as the review
 * card and the score figures were.
 *
 *     node scripts/pings-concepts.mjs
 *
 * It needs `rsvg-convert` (librsvg), as `score-figures.mjs` does. It writes
 * five phone screens and a contact sheet into `.impeccable/mocks/pings/`.
 *
 * ## What is real in here, and what is not
 *
 * Real: every colour is parsed out of `src/constants/theme.ts` at run time, so
 * a still cannot drift from the app's palette; every type step is the `Type`
 * scale's own size and leading; every line is broken where Poppins' own
 * advance widths break it, read out of the TTFs the app ships
 * (`node_modules/@expo-google-fonts/poppins`), and rendered in Poppins through
 * a temporary fontconfig so librsvg sets the same face the phone does; and the
 * cover art is the real thing, fetched from IGDB through the deployed Edge
 * Function with the project's anon key.
 *
 * Synthetic, and labelled as such on the sheet: the people. There are no users
 * on this project (PRODUCT.md), so the handles are invented and the avatars are
 * drawn as the app's own `<Avatar>` fallback — a tinted disc with an initial,
 * which is exactly what ships when somebody has no picture. No face is
 * fabricated.
 *
 * Approximate, and only here: the status bar and the floating tab bar are
 * drawn as plain geometry so each still reads as a screen in the app rather
 * than a slab of content. Glyphs are drawn, not Ionicons.
 *
 * ## The five
 *
 *   board      a request as a plate pinned to a board; the covers are the
 *              picture and the asker is a stamp pressed half onto them
 *   gate       a departures board that ranks, with a row that moves and holds
 *              amber until it has been seen
 *   callout    the in-game ping: a chevron and a beam per request, brightness
 *              carrying how well you know its games
 *   spotlight  the one request you are the best person to answer, staged, and
 *              a quiet index under it
 *   sonar      the screen as an instrument: range rings, blips placed by
 *              familiarity, a sweep, and an echo returning
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, '.impeccable', 'mocks', 'pings');
const POPPINS = join(ROOT, 'node_modules', '@expo-google-fonts', 'poppins');

/* -------------------------------------------------------------------------
 * The frame
 *
 * 360dp wide at 2px a dp — the owner's own screenshots are 720px across a
 * 360dp phone, so a still rendered at this scale can be measured against one.
 * ---------------------------------------------------------------------- */
const W = 360;
const H = 760;
const SCALE = 2;

/** The status bar's room, and the app's 64dp top bar under it. */
const INSET = 26;
const TOP_BAR = 64;
/** Where a page's content starts. */
const TOP = INSET + TOP_BAR;
/** The floating tab bar capsule, and the room a page leaves for it. */
const TAB_BAR = 64;
const TAB_MARGIN = 12;
const FOOT = H - TAB_BAR - TAB_MARGIN * 2;

/** The page margin: `Spacing.x16`, which is 15. */
const M = 15;
const CONTENT = W - M * 2;

/* -------------------------------------------------------------------------
 * The palette, parsed out of the app's own token file
 * ---------------------------------------------------------------------- */
function readTokens() {
  const source = readFileSync(join(ROOT, 'src', 'constants', 'theme.ts'), 'utf8');
  const start = source.indexOf('dark: {');
  if (start < 0) throw new Error('theme.ts has no Colors.dark block');
  /* To the end of that object literal, which is where the next top-level
     `},` sits — far enough for a regex sweep of `key: 'value'` pairs. */
  const block = source.slice(start, source.indexOf('\n  },', start));
  const tokens = {};
  for (const [, key, value] of block.matchAll(/^\s{4}([a-zA-Z0-9]+):\s*'([^']+)'/gm)) {
    tokens[key] = value;
  }
  const need = [
    'background',
    'surface',
    'surfaceElevated',
    'surfaceSelected',
    'text',
    'textSecondary',
    'textMuted',
    'primary',
    'primaryText',
    'onPrimary',
    'controlFill',
    'scoreMid',
    'scoreHigh',
    'identitySky',
    'identityJade',
    'identityViolet',
    'identityGold',
  ];
  for (const key of need) if (!tokens[key]) throw new Error(`theme.ts has no ${key}`);
  return tokens;
}
const C = readTokens();

/** `border` and `outline` are rgba() literals; read them the same way. */
function readAlphaToken(name, fallback) {
  const source = readFileSync(join(ROOT, 'src', 'constants', 'theme.ts'), 'utf8');
  const hit = source.match(new RegExp(`^\\s{4}${name}:\\s*'(rgba\\([^']+\\))'`, 'm'));
  return hit ? hit[1] : fallback;
}
const BORDER = readAlphaToken('border', 'rgba(255,255,255,0.07)');
const OUTLINE = readAlphaToken('outline', 'rgba(255,255,255,0.16)');

/* -------------------------------------------------------------------------
 * The type scale, parsed out of the same file, and Poppins' real widths
 * ---------------------------------------------------------------------- */
function readType() {
  const source = readFileSync(join(ROOT, 'src', 'constants', 'theme.ts'), 'utf8');
  const start = source.indexOf('export const Type');
  const block = source.slice(start, source.indexOf('\n} as const', start));
  const steps = {};
  for (const [, name, body] of block.matchAll(/^ {2}([a-zA-Z0-9]+):\s*\{([^}]*)\}/gm)) {
    const size = body.match(/fontSize:\s*([\d.]+)/);
    const line = body.match(/lineHeight:\s*([\d.]+)/);
    const family = body.match(/FontFamily\.(\w+)/);
    const tracking = body.match(/letterSpacing:\s*(-?[\d.]+)/);
    if (!size) continue;
    steps[name] = {
      size: Number(size[1]),
      line: line ? Number(line[1]) : Math.round(Number(size[1]) * 1.35),
      weight: family ? family[1] : 'regular',
      tracking: tracking ? Number(tracking[1]) : 0,
    };
  }
  for (const name of ['h2', 'h3', 'h4', 'h5', 'body', 'bodySmall', 'caption', 'label', 'itemTitle'])
    if (!steps[name]) throw new Error(`Type has no ${name}`);
  return steps;
}
const T = readType();

/** `FontFamily`'s keys → the weight directory in the Poppins package. */
const WEIGHT_DIR = {
  light: '300Light',
  regular: '400Regular',
  medium: '500Medium',
  semibold: '600SemiBold',
  bold: '700Bold',
  extraBold: '800ExtraBold',
};

/** …and → the family name fontconfig reports for that file. */
const WEIGHT_FAMILY = {
  light: 'Poppins Light',
  regular: 'Poppins',
  medium: 'Poppins Medium',
  semibold: 'Poppins SemiBold',
  bold: 'Poppins',
  extraBold: 'Poppins ExtraBold',
};
const WEIGHT_BOLD = new Set(['bold']);

/**
 * Poppins' advance widths, straight out of the TTF — enough TrueType to answer
 * "how wide is this string", so a line breaks here where it breaks on the
 * phone. The same reading `src/lib/testkit/poppins-font.ts` does for the
 * tests, kept local so this script runs under plain node.
 */
const advanceCache = new Map();
function advanceTable(weight) {
  const dir = WEIGHT_DIR[weight] ?? WEIGHT_DIR.regular;
  const known = advanceCache.get(dir);
  if (known) return known;

  const font = readFileSync(join(POPPINS, dir, `Poppins_${dir}.ttf`));
  const tables = new Map();
  for (let index = 0; index < font.readUInt16BE(4); index++) {
    const at = 12 + index * 16;
    tables.set(font.toString('ascii', at, at + 4), font.readUInt32BE(at + 8));
  }
  const table = (tag) => {
    const offset = tables.get(tag);
    if (offset === undefined) throw new Error(`Poppins ${dir} has no ${tag} table`);
    return offset;
  };

  const unitsPerEm = font.readUInt16BE(table('head') + 18);
  const hMetrics = font.readUInt16BE(table('hhea') + 34);
  const hmtx = table('hmtx');
  const cmap = table('cmap');

  /* The best Unicode subtable: a format 4 or 12 map. */
  let subtable = 0;
  for (let index = 0; index < font.readUInt16BE(cmap + 2); index++) {
    const at = cmap + 4 + index * 8;
    const platform = font.readUInt16BE(at);
    const encoding = font.readUInt16BE(at + 2);
    if (platform === 3 && (encoding === 1 || encoding === 10)) {
      subtable = cmap + font.readUInt32BE(at + 4);
    }
  }
  if (!subtable) throw new Error(`Poppins ${dir} has no Unicode cmap`);
  const format = font.readUInt16BE(subtable);

  const glyphOf = (code) => {
    if (format === 4) {
      const segments = font.readUInt16BE(subtable + 6) / 2;
      const ends = subtable + 14;
      const starts = ends + segments * 2 + 2;
      const deltas = starts + segments * 2;
      const ranges = deltas + segments * 2;
      for (let segment = 0; segment < segments; segment++) {
        if (code > font.readUInt16BE(ends + segment * 2)) continue;
        const first = font.readUInt16BE(starts + segment * 2);
        if (code < first) return 0;
        const rangeAt = ranges + segment * 2;
        const range = font.readUInt16BE(rangeAt);
        if (range === 0) return (code + font.readInt16BE(deltas + segment * 2)) & 0xffff;
        const glyph = font.readUInt16BE(rangeAt + range + (code - first) * 2);
        return glyph === 0 ? 0 : (glyph + font.readInt16BE(deltas + segment * 2)) & 0xffff;
      }
      return 0;
    }
    /* format 12 */
    const groups = font.readUInt32BE(subtable + 12);
    for (let group = 0; group < groups; group++) {
      const at = subtable + 16 + group * 12;
      const first = font.readUInt32BE(at);
      const last = font.readUInt32BE(at + 4);
      if (code >= first && code <= last) return font.readUInt32BE(at + 8) + (code - first);
    }
    return 0;
  };

  const advance = (char) => {
    const glyph = glyphOf(char.codePointAt(0));
    const index = Math.min(glyph, hMetrics - 1);
    return font.readUInt16BE(hmtx + index * 4) / unitsPerEm;
  };
  advanceCache.set(dir, advance);
  return advance;
}

/** The width of `text` at a type step, in dp, tracking included. */
function width(text, step) {
  const advance = advanceTable(step.weight);
  let em = 0;
  for (const char of text) em += advance(char);
  return em * step.size + (step.tracking ?? 0) * Math.max(0, [...text].length - 1);
}

/** `text` broken into at most `max` lines at `box` wide, the last one elided. */
function wrap(text, box, step, max = 99) {
  const lines = [];
  let current = '';
  for (const word of text.split(' ')) {
    const next = current ? `${current} ${word}` : word;
    if (current && width(next, step) > box) {
      lines.push(current);
      current = word;
      if (lines.length === max) break;
    } else {
      current = next;
    }
  }
  if (lines.length < max && current) lines.push(current);
  if (lines.length === max) {
    /* Elide the last line the way a text view does. */
    let last = lines[max - 1];
    if (width(last, step) > box || text.replace(lines.join(' '), '').trim()) {
      while (last.length > 1 && width(`${last}…`, step) > box) last = last.slice(0, -1);
      const consumed = lines.slice(0, max - 1).join(' ');
      if (text.slice(consumed.length).trim() !== lines[max - 1]) last = `${last}…`;
      lines[max - 1] = last;
    }
  }
  return lines;
}

/* -------------------------------------------------------------------------
 * Drawing
 * ---------------------------------------------------------------------- */
const escape = (text) =>
  String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function rect(x, y, w, h, fill, options = {}) {
  const radius = options.r ? ` rx="${options.r}"` : '';
  const stroke = options.stroke
    ? ` stroke="${options.stroke}" stroke-width="${options.strokeWidth ?? 1}"`
    : '';
  const dash = options.dash ? ` stroke-dasharray="${options.dash}"` : '';
  const opacity = options.opacity !== undefined ? ` opacity="${options.opacity}"` : '';
  const filter = options.filter ? ` filter="url(#${options.filter})"` : '';
  const clip = options.clip ? ` clip-path="url(#${options.clip})"` : '';
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill || 'none'}"${radius}${stroke}${dash}${opacity}${filter}${clip}/>`;
}

/**
 * One line of type, positioned by its *baseline from the box's top* the way a
 * text view sets it: the line box is `step.line` tall and the glyphs sit
 * centred in it, so the baseline is the half-leading plus the ascent.
 * Poppins' ascent is 1.05em and its descent 0.35em.
 */
function text(x, y, content, step, fill, options = {}) {
  const ascent = step.size * 1.05;
  const descent = step.size * 0.35;
  const baseline = y + (step.line - (ascent + descent)) / 2 + ascent;
  const anchor = options.anchor ? ` text-anchor="${options.anchor}"` : '';
  const tracking = step.tracking ? ` letter-spacing="${step.tracking}"` : '';
  const weight = WEIGHT_BOLD.has(step.weight) ? ' font-weight="700"' : '';
  const opacity = options.opacity !== undefined ? ` opacity="${options.opacity}"` : '';
  return `<text x="${x}" y="${baseline.toFixed(2)}" font-family="${WEIGHT_FAMILY[step.weight] ?? 'Poppins'}"${weight} font-size="${step.size}"${tracking} fill="${fill}"${anchor}${opacity}>${escape(content)}</text>`;
}

/** A run of wrapped lines, each on its own line box. */
function paragraph(x, y, content, step, fill, box, max = 99, options = {}) {
  return wrap(content, box, step, max)
    .map((line, index) => text(x, y + index * step.line, line, step, fill, options))
    .join('');
}

const rule = (x, y, w, fill = BORDER) => rect(x, y, w, 1, fill);

/** The app's `<Avatar>` fallback: a tinted disc with an initial. No faces. */
function avatar(cx, cy, size, person) {
  const r = size / 2;
  const step = { ...T.h5, size: size * 0.42, line: size };
  return [
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${person.hue}" opacity="0.22"/>`,
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${person.hue}" stroke-width="1" opacity="0.5"/>`,
    text(cx, cy - size / 2, person.name[0].toUpperCase(), step, person.hue, { anchor: 'middle' }),
  ].join('');
}

/** A cover, cropped to a box by its own clip. `dim` is an unplayed game. */
function cover(game, x, y, w, h, options = {}) {
  const id = `c${Math.round(x)}-${Math.round(y)}-${Math.round(w)}-${Math.round(h)}-${game.key}`;
  /* Fill the box from a 2:3 image, cropping whichever axis is long. */
  const scale = Math.max(w / 2, h / 3);
  const iw = 2 * scale;
  const ih = 3 * scale;
  const ix = x + (w - iw) / 2;
  /* Anchored a fifth down, where a box's subject and logo sit. */
  const iy = options.band ? y - (ih - h) * 0.2 : y + (h - ih) / 2;
  return [
    `<clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${options.r ?? 0}"/></clipPath>`,
    `<g clip-path="url(#${id})">`,
    rect(x, y, w, h, C.surfaceElevated),
    game.cover
      ? `<image x="${ix}" y="${iy.toFixed(2)}" width="${iw}" height="${ih}" href="${game.cover}" preserveAspectRatio="xMidYMid slice"${options.dim ? ' filter="url(#unplayed)"' : ''}/>`
      : '',
    options.dim ? rect(x, y, w, h, C.background, { opacity: options.dimBy ?? 0.58 }) : '',
    `</g>`,
  ].join('');
}

/* -------------------------------------------------------------------------
 * The chrome every still wears
 * ---------------------------------------------------------------------- */
function statusBar() {
  return [
    text(M, INSET - 20, '9:41', { ...T.caption, weight: 'semibold' }, C.text),
    /* The indicators, as plain geometry. */
    rect(W - M - 24, INSET - 15, 16, 8, C.text, { r: 2, opacity: 0.9 }),
    rect(W - M - 38, INSET - 16, 10, 10, C.text, { opacity: 0.9, r: 1 }),
  ].join('');
}

function topBar(title, options = {}) {
  const y = INSET;
  return [
    text(M + 41, y + (TOP_BAR - T.h3.line) / 2, title, T.h3, C.text),
    /* The back chevron's slot is empty on a root tab; the + is the one key. */
    options.right === false
      ? ''
      : [
          `<circle cx="${W - M - 9}" cy="${y + TOP_BAR / 2}" r="17" fill="${C.controlFill}"/>`,
          rect(W - M - 9 - 7, y + TOP_BAR / 2 - 1, 14, 2, C.text, { r: 1 }),
          rect(W - M - 9 - 1, y + TOP_BAR / 2 - 7, 2, 14, C.text, { r: 1 }),
        ].join(''),
  ].join('');
}

/** SimpMusic's floating capsule: four tabs, Pings chosen. */
function tabBar() {
  const y = H - TAB_BAR - TAB_MARGIN;
  const x = TAB_MARGIN;
  const w = W - TAB_MARGIN * 2;
  const slot = w / 4;
  const names = ['Home', 'Search', 'Pings', 'Profile'];
  const parts = [
    rect(x, y, w, TAB_BAR, C.surface, { r: TAB_BAR / 2 }),
    rect(x, y, w, TAB_BAR, 'none', { r: TAB_BAR / 2, stroke: BORDER }),
  ];
  names.forEach((name, index) => {
    const cx = x + slot * index + slot / 2;
    const on = name === 'Pings';
    const ink = on ? C.primaryText : C.textMuted;
    if (on) parts.push(rect(cx - 28, y + 4, 56, 56, C.primaryText, { r: 28, opacity: 0.1 }));
    /* The glyph, drawn: a ring for Pings, simple marks for the rest. */
    if (on) {
      parts.push(`<circle cx="${cx}" cy="${y + 22}" r="3.2" fill="${ink}"/>`);
      parts.push(
        `<path d="M ${cx - 9} ${y + 15} a 12 12 0 0 0 0 14 M ${cx + 9} ${y + 15} a 12 12 0 0 1 0 14" fill="none" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/>`
      );
    } else if (name === 'Home') {
      parts.push(
        `<path d="M ${cx - 8} ${y + 23} L ${cx} ${y + 15} L ${cx + 8} ${y + 23} L ${cx + 8} ${y + 29} L ${cx - 8} ${y + 29} Z" fill="none" stroke="${ink}" stroke-width="1.6" stroke-linejoin="round"/>`
      );
    } else if (name === 'Search') {
      parts.push(
        `<circle cx="${cx - 1}" cy="${y + 21}" r="6" fill="none" stroke="${ink}" stroke-width="1.6"/><path d="M ${cx + 4} ${y + 26} L ${cx + 8} ${y + 30}" stroke="${ink}" stroke-width="1.6" stroke-linecap="round"/>`
      );
    } else {
      parts.push(
        `<circle cx="${cx}" cy="${y + 19}" r="4.5" fill="none" stroke="${ink}" stroke-width="1.6"/><path d="M ${cx - 7} ${y + 30} a 7 7 0 0 1 14 0" fill="none" stroke="${ink}" stroke-width="1.6"/>`
      );
    }
    parts.push(text(cx, y + 36, name, T.tab ?? T.caption, ink, { anchor: 'middle' }));
  });
  return parts.join('');
}

/** The app's `<TabBar>`: 32dp pills, the chosen one solid `primary`. */
function chips(y, labels, chosen) {
  const parts = [];
  let x = M;
  labels.forEach((label, index) => {
    const on = index === chosen;
    const w = width(label, T.h5) + 32;
    parts.push(
      on
        ? rect(x, y, w, 32, C.primary, { r: 16 })
        : rect(x, y, w, 32, 'none', { r: 16, stroke: OUTLINE })
    );
    parts.push(
      text(x + w / 2, y + (32 - T.h5.line) / 2, label, T.h5, on ? C.onPrimary : C.textSecondary, {
        anchor: 'middle',
      })
    );
    x += w + 4;
  });
  return parts.join('');
}

/* -------------------------------------------------------------------------
 * The content: synthetic people, real games
 * ---------------------------------------------------------------------- */
const PEOPLE = {
  ada: { name: 'ada', hue: C.identitySky },
  benji: { name: 'benji', hue: C.identityJade },
  cho: { name: 'cho', hue: C.identityViolet },
  dari: { name: 'dari', hue: C.identityGold },
  you: { name: 'you', hue: C.primaryText },
};

/** The games each request is built on, and whether the reader has played them. */
const REQUESTS = [
  {
    asker: PEOPLE.ada,
    words: 'Something with writing as good as Disco Elysium. I’ll forgive anything else.',
    short: 'Writing as good as Disco Elysium',
    refs: ['disco', 'pentiment', 'citizen'],
    played: [true, true, false],
    suggestions: 4,
    when: '4h',
  },
  {
    asker: PEOPLE.benji,
    words: 'Exploration like Outer Wilds, preferably without any combat at all.',
    short: 'Exploration like Outer Wilds, no combat',
    refs: ['outer', 'obra'],
    played: [true, false],
    suggestions: 2,
    when: '9h',
  },
  {
    asker: PEOPLE.cho,
    words: 'A horror game that makes me genuinely uncomfortable, not just startled.',
    short: 'Horror that’s genuinely uncomfortable',
    refs: ['signalis'],
    played: [false],
    suggestions: 7,
    when: '1d',
  },
  {
    asker: PEOPLE.dari,
    words: 'Something short I can finish in one evening.',
    short: 'Something short, one evening',
    refs: ['celeste', 'inside'],
    played: [true, true],
    suggestions: 1,
    when: '2d',
  },
];

/** `2 OF 3 PLAYED`, the familiarity line, as the stills print it. */
const playedCount = (request) => request.played.filter(Boolean).length;

/* -------------------------------------------------------------------------
 * Covers, from IGDB through the deployed Edge Function
 * ---------------------------------------------------------------------- */
const GAMES = {
  disco: 'Disco Elysium',
  pentiment: 'Pentiment',
  citizen: 'Citizen Sleeper',
  outer: 'Outer Wilds',
  obra: 'Return of the Obra Dinn',
  signalis: 'Signalis',
  celeste: 'Celeste',
  inside: 'Inside',
};

function env(name) {
  const source = readFileSync(join(ROOT, '.env'), 'utf8');
  const hit = source.match(new RegExp(`^${name}=(.*)$`, 'm'));
  return hit ? hit[1].trim().replace(/^['"]|['"]$/g, '') : null;
}

async function fetchCovers() {
  const url = env('EXPO_PUBLIC_SUPABASE_URL');
  const key = env('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  const games = {};
  for (const [slug, name] of Object.entries(GAMES)) {
    games[slug] = { key: slug, title: name, cover: null, developer: null, year: null };
  }
  if (!url || !key) {
    console.warn('No Supabase credentials in .env — drawing covers as empty plates.');
    return games;
  }

  const names = Object.values(GAMES)
    .map((name) => `"${name}"`)
    .join(',');
  const answer = await fetch(`${url}/functions/v1/igdb`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: 'games',
      query: `fields name, cover.image_id, first_release_date, total_rating_count,
              involved_companies.developer, involved_companies.company.name;
              where name = (${names}) & cover != null;
              sort total_rating_count desc; limit 60;`,
    }),
  });
  if (!answer.ok) {
    console.warn(`IGDB answered ${answer.status} — drawing covers as empty plates.`);
    return games;
  }
  const rows = await answer.json();

  /* The most-rated row per name: an exact-name match also finds a 1995
     namesake, and the one anybody means is the one everybody rated. */
  for (const [slug, name] of Object.entries(GAMES)) {
    const row = rows.find((entry) => entry.name === name);
    if (!row) continue;
    const developer = (row.involved_companies ?? []).find((entry) => entry.developer);
    games[slug].developer = developer?.company?.name ?? null;
    games[slug].year = row.first_release_date
      ? new Date(row.first_release_date * 1000).getUTCFullYear()
      : null;
    if (!row.cover?.image_id) continue;
    const image = await fetch(
      `https://images.igdb.com/igdb/image/upload/t_cover_big/${row.cover.image_id}.jpg`
    );
    if (!image.ok) continue;
    const bytes = Buffer.from(await image.arrayBuffer());
    games[slug].cover = `data:image/jpeg;base64,${bytes.toString('base64')}`;
    process.stdout.write(`  ${name}: ${(bytes.length / 1024).toFixed(0)}KB\n`);
  }
  return games;
}

/* -------------------------------------------------------------------------
 * 1. The Board
 * ---------------------------------------------------------------------- */
function board(G) {
  const parts = [chips(TOP + 8, ['For You', 'Latest', 'Mine'], 0)];
  let y = TOP + 8 + 32 + 20;

  parts.push(text(M, y, 'PINGED · 12 OPEN', T.label, C.textMuted));
  y += T.label.line + 5;
  parts.push(rule(M, y, CONTENT));
  y += 14;

  /* Asking is pinning your own blank note. */
  const pinH = 56;
  parts.push(rect(M, y, CONTENT, pinH, 'none', { r: 12, stroke: OUTLINE, dash: '5 4' }));
  parts.push(crosshairs(M, y, CONTENT, pinH, C.primaryText, 0.55));
  parts.push(
    text(M + CONTENT / 2, y + 15, 'Pin yours', T.itemTitle, C.primaryText, { anchor: 'middle' })
  );
  parts.push(
    text(M + CONTENT / 2, y + 31, 'ask everyone what to play next', T.caption, C.textMuted, {
      anchor: 'middle',
    })
  );
  y += pinH + 16;

  /* Two plates: the covers are the picture, the asker a pressed stamp. */
  for (const [index, request] of [REQUESTS[0], REQUESTS[1]].entries()) {
    const bandH = index === 0 ? 100 : 78;
    const slot = CONTENT / request.refs.length;
    parts.push(rect(M, y, CONTENT, bandH, C.surfaceElevated, { r: 0 }));
    request.refs.forEach((slug, at) => {
      parts.push(
        cover(G[slug], M + slot * at, y, slot, bandH, { band: true, dim: !request.played[at] })
      );
      if (at > 0) parts.push(rect(M + slot * at, y, 1, bandH, C.background, { opacity: 0.8 }));
    });
    parts.push(crosshairs(M, y, CONTENT, bandH, C.text, 0.75));

    /* The stamp, pressed half off the picture's bottom-left corner. */
    const stampR = 17;
    const stampX = M + 24;
    parts.push(
      `<circle cx="${stampX}" cy="${y + bandH}" r="${stampR + 3}" fill="${C.background}"/>`
    );
    parts.push(avatar(stampX, y + bandH, stampR * 2, request.asker));

    let ty = y + bandH + stampR + 8;
    const lines = wrap(request.words, CONTENT, T.h4, 2);
    parts.push(paragraph(M, ty, request.words, T.h4, C.text, CONTENT, 2));
    ty += T.h4.line * lines.length + 9;
    parts.push(rule(M, ty, CONTENT));
    ty += 9;

    const answered = index === 1;
    const left = `${playedCount(request)} OF ${request.refs.length} PLAYED`;
    parts.push(text(M, ty, left, T.label, answered ? C.textMuted : C.primaryText));
    parts.push(
      text(
        M + CONTENT,
        ty,
        answered ? 'FOUND IT' : `${request.suggestions} SUGGESTIONS`,
        T.label,
        C.textMuted,
        {
          anchor: 'end',
        }
      )
    );
    if (answered) {
      /* A state is a printed mark, never only a brightness. */
      parts.push(rect(M, ty + T.label.line / 2, CONTENT, 1, C.textMuted, { opacity: 0.8 }));
    }
    y = ty + T.label.line + 18;
  }

  return parts.join('');
}

/** A plate's registration marks, one at each corner. */
function crosshairs(x, y, w, h, ink, opacity) {
  const arm = 4;
  const marks = [
    [x + 5, y + 5],
    [x + w - 5, y + 5],
    [x + 5, y + h - 5],
    [x + w - 5, y + h - 5],
  ];
  return marks
    .map(
      ([cx, cy]) =>
        `<path d="M ${cx - arm} ${cy} H ${cx + arm} M ${cx} ${cy - arm} V ${cy + arm}" stroke="${ink}" stroke-width="0.75" opacity="${opacity}"/>`
    )
    .join('');
}

/* -------------------------------------------------------------------------
 * 2. The Gate Board
 * ---------------------------------------------------------------------- */
function gate(G) {
  const parts = [];
  let y = TOP + 8;

  /* The boarding pass: two segments across a perforation. */
  const passH = 62;
  parts.push(rect(M, y, CONTENT, passH, C.surface, { r: 10, stroke: BORDER }));
  const tear = M + CONTENT - 96;
  parts.push(
    `<path d="M ${tear} ${y + 6} V ${y + passH - 6}" stroke="${OUTLINE}" stroke-width="1" stroke-dasharray="3 4"/>`
  );
  parts.push(`<circle cx="${tear}" cy="${y}" r="4" fill="${C.background}"/>`);
  parts.push(`<circle cx="${tear}" cy="${y + passH}" r="4" fill="${C.background}"/>`);
  parts.push(text(M + 14, y + 12, 'ASKING AS', T.label, C.textMuted));
  parts.push(text(M + 14, y + 27, '@you', T.h4, C.text));
  parts.push(text(tear + 14, y + 12, 'SEQ', T.label, C.textMuted));
  parts.push(text(tear + 14, y + 27, '014', T.h4, C.primaryText));
  /* The scannable block. */
  for (let bar = 0; bar < 22; bar++) {
    const bw = bar % 3 === 0 ? 2 : 1;
    parts.push(rect(tear + 14 + bar * 3.4, y + 46, bw, 10, C.textSecondary, { opacity: 0.8 }));
  }
  y += passH + 16;

  /* One live control re-ranks the whole board. */
  parts.push(text(M, y, 'EVERYTHING', T.label, C.textMuted));
  parts.push(text(M + CONTENT, y, 'ONLY PLAYED', T.label, C.textMuted, { anchor: 'end' }));
  y += T.label.line + 6;
  const trackY = y + 4;
  parts.push(rect(M, trackY, CONTENT, 2, C.surfaceSelected, { r: 1 }));
  parts.push(rect(M, trackY, CONTENT * 0.68, 2, C.primaryText, { r: 1 }));
  const handle = M + CONTENT * 0.68;
  parts.push(
    `<path d="M ${handle} ${trackY - 7} L ${handle + 7} ${trackY + 1} L ${handle} ${trackY + 9} L ${handle - 7} ${trackY + 1} Z" fill="${C.primaryText}"/>`
  );
  y += 22;

  /* The board: a fixed column grid, one row height, the order printed. */
  const cols = { rank: M, gate: M + 34, art: M + 63, words: M + 137, count: M + CONTENT };
  parts.push(text(cols.rank, y, 'RANK', T.label, C.textMuted));
  parts.push(text(cols.gate, y, 'GATE', T.label, C.textMuted));
  parts.push(text(cols.words, y, 'REQUEST', T.label, C.textMuted));
  parts.push(text(cols.count, y, 'N', T.label, C.textMuted, { anchor: 'end' }));
  y += T.label.line + 6;
  parts.push(rule(M, y, CONTENT, OUTLINE));
  y += 1;

  const rows = [
    { request: REQUESTS[0], rank: 1 },
    { request: REQUESTS[3], rank: 2 },
    { request: REQUESTS[1], rank: 3, moved: true },
    { request: REQUESTS[2], rank: 4 },
    { request: REQUESTS[1], rank: 5, alt: 'Obscure RPGs with odd worldbuilding' },
    { request: REQUESTS[2], rank: 6, alt: 'A satisfying progression system' },
    { request: REQUESTS[3], rank: 7, alt: 'Co-op for two, nothing competitive' },
  ];
  const rowH = 54;
  for (const row of rows) {
    const { request } = row;
    const lit = row.moved;
    if (lit) {
      parts.push(rect(M, y, CONTENT, rowH, C.scoreMid, { opacity: 0.07 }));
      parts.push(rect(M - 3, y, 3, rowH, C.scoreMid));
    }
    /* The rank, as a split-flap: a dark plate with the seam across it. */
    parts.push(rect(cols.rank, y + 14, 26, 26, C.surfaceElevated, { r: 3 }));
    parts.push(rect(cols.rank, y + 26, 26, 1, C.background, { opacity: 0.9 }));
    parts.push(
      text(cols.rank + 13, y + 18, String(row.rank).padStart(2, '0'), T.h5, C.text, {
        anchor: 'middle',
      })
    );
    parts.push(
      text(
        cols.gate,
        y + 18,
        `${playedCount(request)}/${request.refs.length}`,
        T.h5,
        lit ? C.scoreMid : playedCount(request) > 0 ? C.primaryText : C.textMuted
      )
    );
    /* The games, as a tight strip. */
    request.refs.forEach((slug, at) => {
      parts.push(
        cover(G[slug], cols.art + at * 23, y + 12, 21, 31, { r: 2, dim: !request.played[at] })
      );
    });
    /* The words are their own column, stopping clear of the count. */
    const wordsBox = cols.count - cols.words - (lit ? 48 : 22);
    parts.push(
      text(
        cols.words,
        y + (rowH - T.body.line) / 2,
        wrap(row.alt ?? request.short, wordsBox, T.body, 1)[0],
        T.body,
        lit ? C.text : C.textSecondary
      )
    );
    parts.push(
      text(
        cols.count,
        lit ? y + 9 : y + (rowH - T.h5.line) / 2,
        String(request.suggestions),
        T.h5,
        lit ? C.scoreMid : C.textMuted,
        { anchor: 'end' }
      )
    );
    if (lit) {
      /* The change holds its colour until it has been noticed. */
      parts.push(text(cols.count, y + 30, 'MOVED', T.label, C.scoreMid, { anchor: 'end' }));
    }
    y += rowH;
    parts.push(rule(M, y, CONTENT));
  }

  return parts.join('');
}

/* -------------------------------------------------------------------------
 * 3. The Callout
 * ---------------------------------------------------------------------- */
function callout(G) {
  const parts = [chips(TOP + 8, ['For You', 'Latest', 'Mine'], 0)];
  let y = TOP + 8 + 32 + 18;

  const markers = [
    { request: REQUESTS[0], strength: 1 },
    { request: REQUESTS[3], strength: 0.78 },
    { request: REQUESTS[1], strength: 0.46 },
    { request: REQUESTS[2], strength: 0.16 },
  ];

  for (const marker of markers) {
    const { request, strength } = marker;
    const hue = strength > 0.3 ? request.asker.hue : C.textMuted;
    const lines = wrap(request.words, CONTENT - 26, T.h4, 2);
    const blockH = 16 + lines.length * T.h4.line + 8 + 52;

    /* The beam: a column of light standing under the chevron, its brightness
       the familiarity. */
    parts.push(
      `<linearGradient id="beam${Math.round(y)}" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="${hue}" stop-opacity="${0.95 * strength}"/>` +
        `<stop offset="0.55" stop-color="${hue}" stop-opacity="${0.35 * strength}"/>` +
        `<stop offset="1" stop-color="${hue}" stop-opacity="0"/></linearGradient>`
    );
    parts.push(rect(M, y + 8, 2, blockH - 8, `url(#beam${Math.round(y)})`));
    /* The chevron at the beam's head. */
    parts.push(
      `<path d="M ${M + 1} ${y - 4} L ${M + 8} ${y + 7} L ${M + 1} ${y + 4} L ${M - 6} ${y + 7} Z" fill="${hue}" opacity="${0.45 + 0.55 * strength}"/>`
    );
    if (strength > 0.9) {
      parts.push(
        `<circle cx="${M + 1}" cy="${y + 2}" r="11" fill="none" stroke="${hue}" stroke-width="1" opacity="0.3"/>`
      );
    }

    const x = M + 26;
    parts.push(
      text(
        x,
        y - 2,
        `${playedCount(request) > 0 ? `${playedCount(request)} OF ${request.refs.length} PLAYED` : 'NO MATCHES'} · ${request.when.toUpperCase()}`,
        T.label,
        hue,
        { opacity: 0.5 + 0.5 * strength }
      )
    );
    let ty = y + T.label.line + 6;
    parts.push(
      lines.map((line, index) => text(x, ty + index * T.h4.line, line, T.h4, C.text)).join('')
    );
    ty += lines.length * T.h4.line + 12;
    request.refs.forEach((slug, at) => {
      parts.push(
        cover(G[slug], x + at * 40, ty, 34, 51, { r: 3, dim: !request.played[at], dimBy: 0.42 })
      );
    });

    y += blockH + 18;
  }

  return parts.join('');
}

/* -------------------------------------------------------------------------
 * 4. The One You're For
 * ---------------------------------------------------------------------- */
function spotlight(G) {
  const parts = [chips(TOP + 8, ['For You', 'Latest', 'Mine'], 0)];
  let y = TOP + 8 + 32 + 22;
  const request = REQUESTS[0];
  const mid = W / 2;

  /* The games, fanned — the app's own `<CoverFan>`. */
  const fanW = 96;
  const fanH = Math.round(fanW * 1.5);
  const fanY = y + 10;
  const fan = [
    { slug: request.refs[2], angle: -13, dx: -58, scale: 0.84, dim: true },
    { slug: request.refs[1], angle: 11, dx: 58, scale: 0.84, dim: false },
    { slug: request.refs[0], angle: 0, dx: 0, scale: 1, dim: false },
  ];
  for (const card of fan) {
    const w = fanW * card.scale;
    const h = fanH * card.scale;
    const cx = mid + card.dx;
    const cy = fanY + fanH / 2;
    parts.push(
      `<g transform="rotate(${card.angle} ${cx} ${cy})">` +
        rect(cx - w / 2 - 1, cy - h / 2 - 1, w + 2, h + 2, C.background, { r: 5 }) +
        cover(G[card.slug], cx - w / 2, cy - h / 2, w, h, { r: 4, dim: card.dim }) +
        `</g>`
    );
  }
  y = fanY + fanH + 26;

  /* The claim, in the screen's largest type. */
  const claim = 'You’ve played both of these';
  parts.push(text(mid, y, claim, T.h2, C.text, { anchor: 'middle' }));
  y += T.h2.line + 10;

  parts.push(avatar(mid - 46, y + 9, 22, request.asker));
  parts.push(text(mid - 30, y, `@${request.asker.name} asks`, T.caption, C.textSecondary));
  y += 24;

  parts.push(
    paragraph(mid, y, request.words, T.body, C.textSecondary, CONTENT - 20, 2, {
      anchor: 'middle',
    })
  );
  y += T.body.line * 2 + 20;

  /* The one filled action. */
  parts.push(rect(M, y, CONTENT, 52, C.primary, { r: 26 }));
  {
    const step = T.button ?? T.itemTitle;
    const label = 'Suggest a game';
    const glyph = 13;
    const gap = 9;
    const run = width(label, step) + glyph + gap;
    const left = mid - run / 2;
    parts.push(
      `<path d="M ${left} ${y + 26} h ${glyph} M ${left + glyph / 2} ${y + 26 - glyph / 2} v ${glyph}" stroke="${C.onPrimary}" stroke-width="2" stroke-linecap="round"/>`
    );
    parts.push(text(left + glyph + gap, y + (52 - step.line) / 2, label, step, C.onPrimary));
  }
  y += 52 + 24;

  parts.push(rule(M, y, CONTENT));
  y += 12;
  parts.push(text(M, y, 'EVERYTHING ELSE', T.label, C.textMuted));
  y += T.label.line + 10;

  /* The index: flat rows, nothing competing with the stage. */
  for (const other of [REQUESTS[3], REQUESTS[1], REQUESTS[2]]) {
    other.refs.forEach((slug, at) => {
      parts.push(cover(G[slug], M + at * 19, y, 17, 26, { r: 2, dim: !other.played[at] }));
    });
    parts.push(
      text(
        M + 60,
        y + 3,
        wrap(other.short, CONTENT - 60 - 34, T.body, 1)[0],
        T.body,
        C.textSecondary
      )
    );
    parts.push(
      text(
        M + CONTENT,
        y + 5,
        `${playedCount(other)}/${other.refs.length}`,
        T.label,
        playedCount(other) > 0 ? C.primaryText : C.textMuted,
        { anchor: 'end' }
      )
    );
    y += 42;
  }

  return parts.join('');
}

/* -------------------------------------------------------------------------
 * 5. The Sonar
 * ---------------------------------------------------------------------- */
function sonar(G) {
  const parts = [];
  const fieldH = 214;
  const cx = W / 2;
  /* "You" sit low in the field, far enough up that the transmit key clears
     the chips under it. */
  const cy = TOP + fieldH - 26;

  /* Range rings, sized so the outermost sits inside the page's own width. */
  const rings = [
    { r: 52, label: 'NEAR' },
    { r: 104, label: 'MID' },
    { r: 156, label: 'FAR' },
  ];
  parts.push(
    `<clipPath id="field"><rect x="0" y="${TOP}" width="${W}" height="${fieldH}"/></clipPath>`
  );
  parts.push(`<g clip-path="url(#field)">`);

  /* The sweep, contained by the outer ring and trailing its decay. */
  parts.push(
    `<radialGradient id="sweep" cx="0.5" cy="0.5" r="0.5">` +
      `<stop offset="0" stop-color="${C.primaryText}" stop-opacity="0.22"/>` +
      `<stop offset="1" stop-color="${C.primaryText}" stop-opacity="0.04"/></radialGradient>`
  );
  const sweepR = 156;
  const lead = 52;
  const trail = 128;
  const point = (angle, radius) => [
    cx + Math.cos((angle * Math.PI) / 180) * radius,
    cy - Math.sin((angle * Math.PI) / 180) * radius,
  ];
  const [lx, ly] = point(lead, sweepR);
  const [tx, ty2] = point(trail, sweepR);
  parts.push(
    `<path d="M ${cx} ${cy} L ${tx.toFixed(1)} ${ty2.toFixed(1)} A ${sweepR} ${sweepR} 0 0 1 ${lx.toFixed(1)} ${ly.toFixed(1)} Z" fill="url(#sweep)"/>`
  );
  parts.push(
    `<path d="M ${cx} ${cy} L ${lx.toFixed(1)} ${ly.toFixed(1)}" stroke="${C.primaryText}" stroke-width="1.5" opacity="0.75"/>`
  );

  for (const ring of rings) {
    parts.push(
      `<circle cx="${cx}" cy="${cy}" r="${ring.r}" fill="none" stroke="${OUTLINE}" stroke-width="1" opacity="0.55"/>`
    );
    /* The band's name, inside its own arc and clear of the transmit key. */
    const [nx, ny] = point(168, ring.r - 6);
    parts.push(text(nx, ny - T.label.line / 2, ring.label, T.label, C.textMuted, { opacity: 0.9 }));
  }

  /* The blips: how near is how well you know its games. */
  const blips = [
    { angle: 108, r: 40, strength: 1, label: 'Disco Elysium' },
    { angle: 56, r: 44, strength: 1, label: null },
    { angle: 150, r: 84, strength: 0.6, label: null },
    { angle: 34, r: 92, strength: 0.6, label: null },
    { angle: 88, r: 132, strength: 0.25, label: null },
    { angle: 166, r: 140, strength: 0.25, label: null },
    { angle: 18, r: 146, strength: 0.25, label: null },
  ];
  for (const blip of blips) {
    const [bx, by] = point(blip.angle, blip.r);
    const hue =
      blip.strength > 0.8 ? C.scoreHigh : blip.strength > 0.4 ? C.primaryText : C.textMuted;
    const size = blip.strength > 0.8 ? 4.5 : blip.strength > 0.4 ? 3.5 : 2.5;
    if (blip.strength > 0.8) {
      parts.push(
        `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${size * 3}" fill="${hue}" opacity="0.14"/>`
      );
      parts.push(
        `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${size * 2}" fill="none" stroke="${hue}" stroke-width="1" opacity="0.45"/>`
      );
    }
    parts.push(
      `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${size}" fill="${hue}" opacity="${0.5 + 0.5 * blip.strength}"/>`
    );
    if (blip.label) {
      /* Named above its own blip, clear of the sweep and its neighbours. */
      parts.push(text(bx - 4, by - 15 - T.caption.line, blip.label, T.caption, C.text));
      parts.push(
        `<path d="M ${bx.toFixed(1)} ${(by - 13).toFixed(1)} v -4" stroke="${C.text}" stroke-width="1" opacity="0.5"/>`
      );
    }
  }

  /* The echo: a suggestion arriving comes back inward. */
  parts.push(
    `<circle cx="${cx}" cy="${cy}" r="76" fill="none" stroke="${C.scoreHigh}" stroke-width="1.5" opacity="0.26"/>`
  );
  parts.push(
    `<circle cx="${cx}" cy="${cy}" r="58" fill="none" stroke="${C.scoreHigh}" stroke-width="1" opacity="0.14"/>`
  );
  parts.push(`</g>`);

  /* Transmit, at the centre: the one thing you send from. */
  parts.push(`<circle cx="${cx}" cy="${cy}" r="27" fill="${C.background}"/>`);
  parts.push(`<circle cx="${cx}" cy="${cy}" r="20" fill="${C.primary}"/>`);
  /* A transmit mark, not a play triangle: a source and two arcs leaving it. */
  parts.push(`<circle cx="${cx - 5}" cy="${cy}" r="2.6" fill="${C.onPrimary}"/>`);
  parts.push(
    `<path d="M ${cx + 1} ${cy - 6} a 7.5 7.5 0 0 1 0 12 M ${cx + 6} ${cy - 10} a 13 13 0 0 1 0 20" fill="none" stroke="${C.onPrimary}" stroke-width="2" stroke-linecap="round"/>`
  );

  let y = TOP + fieldH + 10;
  parts.push(chips(y, ['For You', 'Latest', 'Mine'], 0));
  y += 32 + 18;

  /* The list, each row carrying its own range reading. */
  const rows = [
    { request: REQUESTS[0], range: 'NEAR', held: true },
    { request: REQUESTS[3], range: 'NEAR', held: false },
    { request: REQUESTS[1], range: 'MID', held: false },
    { request: REQUESTS[2], range: 'FAR', held: false },
    { request: REQUESTS[2], range: 'FAR', held: false, alt: 'A satisfying progression system' },
  ];
  const wordsX = M + 78;
  for (const row of rows) {
    const { request } = row;
    const rangeInk =
      row.range === 'NEAR' ? C.scoreHigh : row.range === 'MID' ? C.primaryText : C.textMuted;
    if (row.held) {
      parts.push(rect(M - 6, y - 8, CONTENT + 12, 44, C.surfaceElevated, { r: 8 }));
    }
    parts.push(text(M, y, row.range, T.label, rangeInk));
    parts.push(
      text(
        M + 44,
        y,
        `${playedCount(request)}/${request.refs.length}`,
        T.label,
        playedCount(request) > 0 ? C.textSecondary : C.textMuted
      )
    );
    /* Stops clear of the count, as the board's rows do. */
    const box = M + CONTENT - wordsX - 22;
    parts.push(
      text(
        wordsX,
        y - 2,
        wrap(row.alt ?? request.short, box, T.body, 1)[0],
        T.body,
        row.held ? C.text : C.textSecondary
      )
    );
    parts.push(
      text(M + CONTENT, y, String(request.suggestions), T.label, C.textMuted, { anchor: 'end' })
    );
    y += 44;
  }

  return parts.join('');
}

/* -------------------------------------------------------------------------
 * Rendering
 * ---------------------------------------------------------------------- */
const SCREENS = [
  { key: 'board', title: 'The Board', draw: board },
  { key: 'gate', title: 'The Gate Board', draw: gate },
  { key: 'callout', title: 'The Callout', draw: callout },
  { key: 'spotlight', title: 'The One You’re For', draw: spotlight },
  { key: 'sonar', title: 'The Sonar', draw: sonar },
];

/** The unplayed filter: a cover you have not played loses its colour. */
const FILTERS = `<filter id="unplayed"><feColorMatrix type="saturate" values="0.04"/></filter>`;

function screenSvg(screen, G) {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    `<defs>${FILTERS}</defs>`,
    rect(0, 0, W, H, C.background),
    statusBar(),
    topBar('Pings'),
    screen.draw(G),
    /* The page ends under the floating capsule. */
    rect(0, FOOT + TAB_MARGIN, W, H - FOOT, C.background, { opacity: 0.0 }),
    tabBar(),
    `</svg>`,
  ].join('\n');
}

function fontconfig(dir) {
  const fonts = join(dir, 'fonts');
  mkdirSync(fonts, { recursive: true });
  for (const weight of Object.values(WEIGHT_DIR)) {
    const file = `Poppins_${weight}.ttf`;
    writeFileSync(join(fonts, file), readFileSync(join(POPPINS, weight, file)));
  }
  const conf = join(dir, 'fonts.conf');
  writeFileSync(
    conf,
    `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${fonts}</dir><cachedir>${join(dir, 'cache')}</cachedir></fontconfig>`
  );
  return conf;
}

const temp = mkdtempSync(join(tmpdir(), 'pings-concepts-'));
const FONTS = fontconfig(temp);

function render(name, svg, outWidth) {
  const file = join(temp, `${name}.svg`);
  writeFileSync(file, svg);
  const out = join(OUT, `${name}.png`);
  execFileSync('rsvg-convert', ['-w', String(outWidth), file, '-o', out], {
    env: { ...process.env, FONTCONFIG_FILE: FONTS },
  });
  return out;
}

mkdirSync(OUT, { recursive: true });
console.log('Covers from IGDB:');
const G = await fetchCovers();

const rendered = [];
for (const screen of SCREENS) {
  const file = render(screen.key, screenSvg(screen, G), W * SCALE);
  rendered.push({ ...screen, file });
  console.log(`  wrote ${screen.key}.png`);
}

/* The contact sheet: all five side by side, named, at a size that fits a
   laptop screen — the one picture that answers "which of these". */
const SHEET_W = 300;
const SHEET_H = Math.round((SHEET_W / W) * H);
const SHEET_GAP = 22;
const SHEET_TOP = 98;
const sheetWidth = SHEET_GAP + rendered.length * (SHEET_W + SHEET_GAP);
const sheetHeight = SHEET_TOP + SHEET_H + 64;
const sheet = [
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${sheetWidth}" height="${sheetHeight}" viewBox="0 0 ${sheetWidth} ${sheetHeight}">`,
  rect(0, 0, sheetWidth, sheetHeight, '#0B0D11'),
  text(
    SHEET_GAP,
    24,
    'PINGS — FIVE STRUCTURES, ONE VISUAL WORLD',
    { ...T.label, size: 12 },
    C.textSecondary
  ),
  text(
    SHEET_GAP,
    46,
    'Real tokens, real Poppins metrics, real IGDB covers. People and handles are synthetic.',
    { ...T.caption, size: 12, line: 16 },
    C.textMuted
  ),
];
rendered.forEach((screen, index) => {
  const x = SHEET_GAP + index * (SHEET_W + SHEET_GAP);
  const png = readFileSync(screen.file).toString('base64');
  sheet.push(
    text(x, SHEET_TOP - 24, screen.title, { ...T.h5, size: 15, line: 20 }, C.text),
    rect(x - 1, SHEET_TOP - 1, SHEET_W + 2, SHEET_H + 2, 'none', { stroke: BORDER, r: 9 }),
    `<clipPath id="sheet${index}"><rect x="${x}" y="${SHEET_TOP}" width="${SHEET_W}" height="${SHEET_H}" rx="8"/></clipPath>`,
    `<image x="${x}" y="${SHEET_TOP}" width="${SHEET_W}" height="${SHEET_H}" clip-path="url(#sheet${index})" href="data:image/png;base64,${png}"/>`
  );
});
sheet.push(`</svg>`);
render('pings-concepts', sheet.join('\n'), sheetWidth);
console.log(`  wrote pings-concepts.png`);
console.log(`\nIn ${OUT.replace(`${ROOT}/`, '')}`);
