/**
 * GameLog's privacy policy, terms of use and account-deletion page, as data.
 *
 * One source for two places: the in-app screens (`app/legal/[doc]`) and the
 * web pages Google Play links to (`node scripts/legal-pages.mjs` writes them
 * into `public/legal/`). `legal.test.ts` fails if the web pages are older
 * than this file's text.
 *
 * The privacy policy is written from what the code does, not from a
 * template: every service named is one the app or its Edge Functions call
 * (2026-10-29). Add a service, a table of personal data or a permission and
 * this is the file to change — the Data Safety form in the Play Console has
 * to say the same thing.
 *
 * Not legal advice. Read it as the owner before it goes up.
 */

/**
 * Where people write to about their data. **Set before publishing**: until
 * then the pages point at the contact address on the store listing, which
 * Google Play requires anyway.
 */
export const LEGAL_CONTACT_EMAIL: string | null = null;

/** The date printed as "Last updated". Change it with the text. */
export const LEGAL_UPDATED = '29 October 2026';

export type LegalBlock = string | { list: readonly string[] };
export type LegalSection = { heading: string; blocks: readonly LegalBlock[] };
export type LegalDoc = {
  slug: LegalSlug;
  title: string;
  intro: string;
  sections: readonly LegalSection[];
};

export type LegalSlug = 'privacy' | 'terms' | 'delete-account';
export const LEGAL_SLUGS: readonly LegalSlug[] = ['privacy', 'terms', 'delete-account'];

export function isLegalSlug(value: string | undefined): value is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(value ?? '');
}

/** `{contact}` in the text, filled in. */
export function contactPhrase(email: string | null = LEGAL_CONTACT_EMAIL): string {
  return email ?? 'the contact email address on GameLog’s Google Play listing';
}

export function fillContact(text: string, email: string | null = LEGAL_CONTACT_EMAIL): string {
  return text.replaceAll('{contact}', contactPhrase(email));
}

const PRIVACY: LegalDoc = {
  slug: 'privacy',
  title: 'Privacy policy',
  intro:
    'GameLog is an app for keeping a record of the video games you play: logging them, scoring and reviewing them, and following what other people play. This policy says what GameLog collects, why, who else sees it, and how to delete it. “We” means the developer of GameLog.',
  sections: [
    {
      heading: 'What we collect',
      blocks: [
        'Your account. Your email address and password. The password is stored hashed by our hosting provider, Supabase; we never see it. If you sign in with Google or Facebook, we receive your email address and name from them.',
        'Your profile. Your username, and anything you add: a display name, a bio, a location, a favourite platform, a profile picture and a banner.',
        'What you do in GameLog. The games you log and how you played them (status, score, hours, platform, dates, playthroughs, platinums); your reviews and the language we detect they are written in; your collections, lists and award shows; comments, wall posts and likes; who you follow and your friends; events you mark as going to; pinned games and a starred song; games you suggest as similar and your votes; your physical copies (platform, region, edition, condition, notes and barcode); release details and box photos you submit to the shared barcode catalogue; reports you send; and the people you block.',
        'Linked gaming accounts, if you link them. Your Steam ID (through Steam’s own sign-in), or the PlayStation online ID, Xbox gamertag or GOG username you type in — and the games, playtime and achievements those services show publicly.',
        'Rating statistics. To weight the community score, we work out from your scores how much they vary. Only you can see your own figures; moderators see totals across everyone.',
        'Photos, only when you choose them. The camera is used only to read a barcode; nothing it sees is stored or uploaded. Pictures you pick for your profile or a release are uploaded. Images of your reviews that you save go to your phone’s photo library, not to us.',
      ],
    },
    {
      heading: 'What stays on your phone',
      blocks: [
        'Some things never leave your device: your search history, your settings (game colours, animated artwork, review languages), drafts, the games you hide from Surprise Me, which recommendations you have already been shown, event reminders (scheduled as local notifications), and a copy of recently seen screens so the app opens quickly. They are removed when you uninstall the app or clear its data.',
      ],
    },
    {
      heading: 'What we do not collect',
      blocks: [
        {
          list: [
            'Your location, your contacts, or your phone’s advertising ID.',
            'Anything for advertising: GameLog has no ads.',
            'Analytics or crash reports: GameLog includes no analytics, tracking or crash-reporting service.',
          ],
        },
        'We do not sell your data, and we do not share it for advertising.',
      ],
    },
    {
      heading: 'How we use it',
      blocks: [
        'To run GameLog: to show your library, profile and reviews; to build feeds, charts, recommendations and the community score; to send you notifications about activity on your writing; to look up the games in your linked libraries; and to keep the community safe — moderators read reports and can remove what breaks the terms of use.',
      ],
    },
    {
      heading: 'What other people see',
      blocks: [
        'GameLog is a social app. Your profile, your logs and scores, your reviews, collections, comments, wall posts, likes, follows and friends, and the gaming accounts you link are visible to other GameLog users. Your email address, your reports, the people you block and your rating statistics are not.',
      ],
    },
    {
      heading: 'Who else receives data',
      blocks: [
        'Supabase hosts GameLog’s database, sign-in and file storage, and processes everything above on our behalf.',
        'To show game information, your phone loads pictures and pages directly from IGDB, Steam, SteamGridDB, RAWG, Wikimedia Commons and Wikidata, YouTube (video thumbnails), SoundCloud (music you play) and the news sites in the News tab (IGN, GameSpot, PC Gamer, Kotaku). Like any website, they see your IP address and what is being loaded — never your account.',
        'Some lookups go through our own servers instead, so the service sees our server and not you: IGDB (run by Twitch), IsThereAnyDeal (prices), OpenCritic (critic reviews, through RapidAPI), Steam store pages (awards and news), SoundCloud (finding soundtracks), GameTDB and ScreenScraper (box art for physical copies) and ScanDex (barcodes). These receive the game or barcode being looked up, not who asked.',
        'When you link an account, the name you type is sent to that service to read your public library: Sony (PlayStation Network), OpenXBL (xbl.io, a third-party Xbox service) or GOG. Linking Steam opens Steam’s own sign-in page.',
        'If you sign in with Google or Facebook, they know you used it to sign in to GameLog.',
        'We may disclose data if the law requires it.',
      ],
    },
    {
      heading: 'How long we keep it, and deleting it',
      blocks: [
        'We keep your data for as long as you have an account. You can delete your account at any time in the app: Profile → Settings → Delete account. If you cannot use the app, write to {contact} from your account’s email address and we will delete it within 30 days.',
        'Deleting your account deletes, immediately: your profile and pictures, your logs, scores, reviews, collections, comments, wall posts, likes, follows, friendships, copies, linked accounts, reports, blocks and rating statistics — and other people’s likes and comments on your writing.',
        'What stays has nothing to identify you: releases you added to the shared barcode catalogue and the box photos you submitted for them, and community figures such as a game’s average score, which are recalculated without your ratings. Copies may remain in our hosting provider’s backups for a limited time before they are overwritten.',
      ],
    },
    {
      heading: 'Your choices and rights',
      blocks: [
        'You can see and change your profile and everything you post in the app, unlink a gaming account in Edit profile, and delete your account in Settings. To ask for a copy of your data or anything else about it, write to {contact}. Depending on where you live you may have further rights, including to complain to a data protection authority.',
      ],
    },
    {
      heading: 'Security',
      blocks: [
        'Data travels over encrypted connections (HTTPS). The database only lets each person read and change what its access rules allow, and passwords are hashed. No system is perfectly secure; tell us at {contact} if you find a problem.',
      ],
    },
    {
      heading: 'Children',
      blocks: [
        'GameLog is not meant for children under 13, or under the minimum age for using such services where you live, and we do not knowingly collect their data. If you believe a child has an account, write to {contact} and we will delete it.',
      ],
    },
    {
      heading: 'Changes',
      blocks: [
        'If this policy changes, the new version will be here with a new date, and we will say so in the app if the change is significant.',
      ],
    },
    {
      heading: 'Contact',
      blocks: ['Questions about this policy or your data: {contact}.'],
    },
  ],
};

const TERMS: LegalDoc = {
  slug: 'terms',
  title: 'Terms of use',
  intro:
    'These terms are the rules for using GameLog. By making an account, or by using the app, you agree to them and to the privacy policy.',
  sections: [
    {
      heading: 'Your account',
      blocks: [
        'You must be at least 13, or the minimum age for using such services where you live. Keep your password to yourself; you are responsible for what is done with your account. Choose a username that is not misleading or offensive and does not pretend to be someone else.',
      ],
    },
    {
      heading: 'What you post',
      blocks: [
        'Your reviews, comments, collections, wall posts and pictures stay yours. By posting them you allow GameLog to store them and show them to other users in the app, for as long as they are up. You can delete them, or your whole account, at any time.',
        'Only post what you have the right to post.',
      ],
    },
    {
      heading: 'The rules',
      blocks: [
        'GameLog has no tolerance for objectionable content or abusive users. Do not post or do anything that:',
        {
          list: [
            'harasses, bullies, threatens or targets a person;',
            'is hateful towards people for who they are;',
            'is sexually explicit, or sexualises minors in any way;',
            'is violent, gory or encourages harm;',
            'is spam, advertising, scams or links posted over and over;',
            'pretends to be another person or organisation;',
            'shares someone’s private information;',
            'is illegal, or infringes someone else’s rights;',
            'gives away a story without marking the review as containing spoilers.',
          ],
        },
        'Do not try to break, overload, scrape or get around the app or its security, or use other people’s accounts.',
      ],
    },
    {
      heading: 'Reporting, blocking and moderation',
      blocks: [
        'Every review, comment, wall post, suggestion and profile can be reported, and any user can be blocked from their profile. Moderators read every report. We may remove content that breaks these rules, and suspend or delete the accounts of people who break them, without notice.',
      ],
    },
    {
      heading: 'Game information',
      blocks: [
        'Game details, pictures, prices, critic scores, news and music come from other services (listed in the privacy policy). We show them as they are given to us and cannot promise they are complete, current or correct — check a price on the store before you buy. Links to stores and other sites are theirs, under their own terms.',
      ],
    },
    {
      heading: 'The app itself',
      blocks: [
        'GameLog is provided as it is, and may change, have errors or be unavailable at times. As far as the law allows, we are not liable for indirect losses arising from using it. Nothing in these terms takes away rights you have by law as a consumer.',
      ],
    },
    {
      heading: 'Ending',
      blocks: [
        'You can stop using GameLog and delete your account at any time. We may end or suspend an account that breaks these terms.',
      ],
    },
    {
      heading: 'Changes and contact',
      blocks: [
        'If these terms change, the new version will be here with a new date. Questions: {contact}.',
      ],
    },
  ],
};

const DELETE_ACCOUNT: LegalDoc = {
  slug: 'delete-account',
  title: 'Delete your GameLog account',
  intro: 'You can delete your GameLog account and its data whenever you like. It cannot be undone.',
  sections: [
    {
      heading: 'In the app',
      blocks: [
        {
          list: [
            'Open GameLog and go to your Profile.',
            'Open Settings (the gear at the top).',
            'Choose Delete account, and confirm with your username.',
          ],
        },
        'Your account is deleted at once.',
      ],
    },
    {
      heading: 'Without the app',
      blocks: [
        'Write to {contact} from the email address you signed up with, with the subject “Delete my account”. We will delete it within 30 days and reply when it is done.',
      ],
    },
    {
      heading: 'What is deleted',
      blocks: [
        'Your profile and pictures, your logs, scores, reviews, collections, comments, wall posts, likes, follows, friendships, physical copies, linked gaming accounts, reports, blocks and rating statistics — and other people’s likes and comments on your writing.',
      ],
    },
    {
      heading: 'What is kept',
      blocks: [
        'Nothing that identifies you. Releases you added to the shared barcode catalogue, and the box photos you submitted for them, stay in the catalogue without your name. Community figures such as a game’s average score are recalculated without your ratings. Copies may remain in our hosting provider’s backups for a limited time before they are overwritten.',
      ],
    },
  ],
};

export const LEGAL_DOCS: Record<LegalSlug, LegalDoc> = {
  privacy: PRIVACY,
  terms: TERMS,
  'delete-account': DELETE_ACCOUNT,
};
