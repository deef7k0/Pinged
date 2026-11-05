/**
 * The app's typeface's advance widths — how wide each letter is — read out of
 * the font files the app ships (`Inter_400Regular.ttf`, `Inter_700Bold.ttf`,
 * `Inter_800ExtraBold.ttf`; `scripts/font-advance.mjs` prints these tables
 * from them, and the tests read the files again and compare). For laying
 * text out before it is drawn: a review's quote, and the review a share
 * image is picked from, whose every word has to be where a finger can find
 * it (`review-highlight.ts`).
 *
 * **Inter, since 2026-11-04** — the Apple pass: Inter is the closest open
 * face to SF Pro. It was Poppins from 2026-10-17 (SimpMusic's font) and Inter
 * before that. A change of face is a re-run of the script, never an edit by
 * hand.
 *
 * No kerning: Inter applies it lightly and it only narrows a line.
 *
 * Pure.
 */

export type FontWeight = 'regular' | 'bold' | 'extraBold';

/** The letters the tables hold, in order. */
const CHARS =
  ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~‘’“”–—…éèêëáàâäãåíìîïóòôöõúùûüñçÉÈÁÀÍÓÚÑÇßøæœ¡¿€£°×·•';

/** Thousandths of an em, for `CHARS`. */
const REGULAR = [
  281, 288, 466, 633, 642, 982, 644, 300, 365, 365, 501, 662, 288, 460, 288, 360, 631, 407, 610,
  618, 646, 593, 620, 566, 619, 620, 288, 302, 662, 662, 662, 511, 966, 690, 654, 730, 722, 601,
  590, 746, 743, 269, 571, 672, 565, 903, 753, 765, 639, 765, 644, 642, 646, 744, 690, 985, 682,
  679, 629, 365, 360, 365, 471, 456, 323, 562, 612, 571, 612, 583, 370, 613, 591, 242, 242, 549,
  242, 876, 591, 600, 612, 612, 376, 528, 327, 591, 562, 818, 546, 562, 552, 426, 333, 426, 662,
  261, 261, 440, 440, 500, 1000, 864, 583, 583, 583, 583, 562, 562, 562, 562, 562, 562, 242, 242,
  242, 242, 600, 600, 600, 600, 600, 591, 591, 591, 591, 591, 571, 601, 601, 690, 690, 269, 765,
  744, 753, 730, 616, 600, 917, 1000, 288, 511, 667, 611, 456, 662, 288, 563,
];
const BOLD = [
  237, 338, 552, 649, 655, 1016, 672, 339, 377, 377, 559, 679, 334, 468, 334, 388, 674, 431, 630,
  646, 676, 622, 649, 582, 651, 649, 334, 343, 679, 679, 679, 560, 1016, 747, 662, 740, 722, 607,
  587, 750, 747, 281, 584, 719, 565, 932, 762, 771, 648, 777, 657, 655, 667, 732, 747, 1038, 738,
  731, 664, 377, 388, 377, 487, 476, 365, 581, 630, 588, 630, 596, 398, 632, 623, 271, 271, 580,
  271, 913, 623, 613, 630, 630, 407, 560, 366, 623, 600, 850, 580, 602, 573, 469, 372, 469, 679,
  311, 311, 540, 532, 500, 1000, 1002, 596, 596, 596, 596, 581, 581, 581, 581, 581, 581, 271, 271,
  271, 271, 613, 613, 613, 613, 613, 623, 623, 623, 623, 623, 588, 607, 607, 747, 747, 281, 771,
  732, 762, 740, 657, 613, 910, 988, 338, 560, 685, 639, 459, 679, 334, 474,
];

/** ExtraBold: a review's quote, in onboarding's headline weight. */
const EXTRA_BOLD = [
  219, 358, 586, 655, 660, 1029, 683, 354, 382, 382, 583, 686, 353, 471, 353, 400, 692, 441, 638,
  657, 688, 634, 662, 588, 664, 662, 353, 360, 686, 686, 686, 579, 1036, 770, 665, 744, 723, 610,
  585, 752, 749, 286, 590, 738, 565, 943, 766, 773, 652, 782, 662, 660, 677, 727, 770, 1059, 761,
  752, 679, 382, 400, 382, 493, 484, 382, 588, 638, 595, 638, 601, 410, 639, 635, 283, 283, 593,
  283, 927, 635, 619, 638, 638, 420, 573, 382, 635, 615, 863, 594, 618, 581, 486, 388, 486, 686,
  331, 331, 581, 569, 500, 1000, 1058, 601, 601, 601, 601, 588, 588, 588, 588, 588, 588, 283, 283,
  283, 283, 619, 619, 619, 619, 619, 635, 635, 635, 635, 635, 595, 610, 610, 770, 770, 286, 773,
  727, 766, 744, 674, 619, 907, 983, 358, 579, 692, 650, 461, 686, 353, 438,
];

const TABLES: Record<FontWeight, Map<string, number>> = {
  regular: new Map([...CHARS].map((char, index) => [char, REGULAR[index] / 1000])),
  bold: new Map([...CHARS].map((char, index) => [char, BOLD[index] / 1000])),
  extraBold: new Map([...CHARS].map((char, index) => [char, EXTRA_BOLD[index] / 1000])),
};

/**
 * A letter the tables do not hold — another script, an emoji — is taken as
 * wide as a wide capital: too wide is a line that ends early, too narrow a
 * line the phone would have to cut.
 */
const UNKNOWN = 0.8;

/** How wide `text` is at `size`, in dp. */
export function advanceWidth(text: string, size: number, weight: FontWeight = 'regular'): number {
  const table = TABLES[weight];
  let em = 0;
  for (const char of text) em += table.get(char) ?? UNKNOWN;
  return em * size;
}
