# Public How-to and Changelog

Console-only spec. No device endpoint, payload or NVS change, so no firmware work.

**Status:** done (2026-09-27). Approved with D1–D5 as recommended and no redirect from bare `/how-to`; live since `93eccf7`. The two follow-ups in §5 are not done and need their own change.

## 1. What and why

Anyone can read **How-to** and **Changelog** without an account. Today both redirect a signed-out visitor to `/login`, so the only public pages are the landing page, Credits and Privacy. These two are the console's real content: the setup guide, every everyday task, what each Round screen and Simple LED means, and what changed in each release. Making them public lets a person decide whether to build a switch before asking for an invite, lets people link to a specific answer ("your LED means this"), and lets search engines index the pages people actually search for.

Signed-in users see the same pages as today.

## 2. What exists today

- `app/how-to/page.tsx` calls `requireSessionUser()` and renders `HowToGuide` inside `Shell`. The guide's text is static (`lib/how-to.ts`). The only data read is `currentVersion("round")`, the firmware version `/setup` flashes now, which is already public at `/firmware/round/manifest.json`. The product shown comes from `?product=`, then an old `#round` / `#simple` hash, then `localStorage`, else Round. The server HTML holds only the chosen product.
- `app/changelog/page.tsx` calls `requireSessionUser()`, reads `docs/changelog.md` and adds each product's release notes from the database (`listReleaseNotes`). The same notes are in each firmware repo's `CHANGELOG.md`.
- `app/credits/page.tsx` and `app/privacy/page.tsx` are the pattern for a page that works both ways: signed in, it renders inside `Shell`; signed out, it renders a small header (console name linking to `/`, `ThemePicker`) instead.
- How-to steps link into signed-in pages (`/setup`, `/switches`). Signed out, those redirect to `/login`, and after sign-in the console opens `/switches`, not the page the person came from.
- `app/robots.ts` allows both paths already. `app/sitemap.ts` and `public/llms.txt` leave them out until this ships.

## 3. Decisions

Each has a recommendation. None is taken until the user approves the spec.

| # | Decision | Options | Recommendation |
| --- | --- | --- | --- |
| D1 | Signed-out frame | (a) Credits' small header, copied again; (b) extract that header into one shared component used by Credits, Privacy, How-to and Changelog; (c) `Shell` without an email | **(b)**. Four pages would share it, and a **Sign in** button in it (as on the landing page) gives a signed-out reader a way in. `Shell` without an email would show nav links that all bounce to `/login`. |
| D2 | How-to links into `/setup` and `/switches` for a signed-out reader | (a) Leave them; they go through `/login`. (b) Signed out, the links read "Sign in to set up" and go to `/login`. (c) Add a return path to `/login` so sign-in lands back on the target page | **(a) now**, (c) as a follow-up. (a) needs no change and is honest: those pages need an account. (c) touches the sign-in flow for Google, GitHub and email codes, and a return path must be limited to same-site paths to avoid an open redirect. That deserves its own change. |
| D3 | How-to URLs for search (superseded: one URL per switch and topic, `docs/specs/how-to-navigation.md` §2.3) | (a) One page, `/how-to`; (b) one page per product, `/how-to?product=round` and `/how-to?product=simple` | **(b)**. The server HTML holds one product, so a crawler reading `/how-to` never sees the Simple guide. Each product URL is canonical to itself; bare `/how-to` renders Round and is canonical to `?product=round`. Both go in the sitemap. |
| D4 | How signed-out readers find the pages | (a) Footer only (Changelog is already there); (b) add **How-to** to the footer and a "See the full setup guide" link on the landing page | **(b)**. The landing page's three setup steps lead naturally into the full guide. |
| D5 | Release notes shown to signed-out readers | (a) Show them as signed-in users see them; (b) console entries only | **(a)**. They are written for users and become public with the firmware repos anyway. |

## 4. Design

### 4.1 Shared signed-out header (D1)

- New `app/public-header.tsx`: console name linking to `/`, then `ThemePicker` and a **Sign in** button linking to `/login`, styled like the landing page header.
- `app/credits/page.tsx`, `app/privacy/page.tsx`, `app/how-to/page.tsx` and `app/changelog/page.tsx` use it when there is no session. Signed-out layout: `main` with `max-w-5xl` for How-to (its side nav needs the width) and `max-w-3xl` for the others, as Credits and Privacy do today.
- The landing page (`app/page.tsx`) keeps its own header for now. Its header is the same markup, so it can adopt the shared one in the same change if that is a straight swap.

### 4.2 How-to

- Replace `requireSessionUser()` with `getSessionUser().catch(() => null)`, as on Credits. Signed in: `Shell`, unchanged. Signed out: the shared header plus `HowToGuide`.
- `generateMetadata` sets the canonical URL from `?product=` (D3): `?product=simple` for Simple, `?product=round` otherwise. Title stays "How-to"; the description names the product ("Set up a Round switch, change what it does, and read its screen." / "…Simple switch… read its LED.").
- No change to `HowToGuide` or `lib/how-to.ts`.

### 4.3 Changelog

- Same session change as How-to. Signed out: the shared header plus the same content.
- If the database is not configured or the release-note read fails, the page still renders the console entries from `docs/changelog.md` (`listReleaseNotes` is already wrapped in `.catch(() => [])`).
- Canonical `/changelog` and a description ("What changed in Hue Switch Console and the Round and Simple switch firmware.").

### 4.4 Discovery and SEO (D4)

- Footer (`app/site-footer.tsx`): add **How-to** before Changelog.
- Landing page: a "See the full setup guide" link under the three setup steps, to `/how-to`.
- `app/sitemap.ts`: add `/how-to?product=round`, `/how-to?product=simple` and `/changelog`, and remove the "add once public" comment.
- `public/llms.txt`: add both How-to URLs and Changelog under "Pages".

### 4.5 Before it goes live

Both pages become public before the repos do, so their text is published earlier than planned. Read `docs/changelog.md`, `lib/how-to.ts` and each firmware `CHANGELOG.md` (the release notes already in the database) for anything not meant to be public, such as house-specific room names, internal notes or personal details. This is the same check as the open-source launch spec's "Read through committed docs" item, done early for these files.

## 5. Checklist

### Console (`hue-switch-console`)

- [x] Review §4.5 done (2026-09-27): nothing private in `docs/changelog.md`, `lib/how-to.ts` or either firmware `CHANGELOG.md`; no wording changes needed
- [x] Shared signed-out frame (`app/public-frame.tsx`); Credits and Privacy moved onto it. The landing page keeps its own header (it shows the name as text, not a link to itself)
- [x] How-to public, canonical per product, per-product description
- [x] Changelog public, canonical and description
- [x] Footer **How-to** link; landing page link to the guide
- [x] Sitemap and `llms.txt` updated
- [x] `docs/changelog.md` entry: How-to and Changelog open without an account
- [x] Typecheck, lint and build pass; checked signed out on a local production build
- [x] Deployed 2026-09-27 (`93eccf7`); checked on production signed out (with `curl`): `/how-to`, `/how-to?product=simple` and `/changelog` return 200 with their content and canonical tags; sitemap lists them
- [x] Checked on production signed in by the user (2026-09-27): both pages look as before, with the normal menu

### Round and Simple

No firmware change.

### Follow-up (separate change)

- [x] Status section: render every screen and LED state's details in the HTML (collapsed), not only the selected one (see §6). Done 2026-09-29 (console #51): every panel is rendered, hidden unless selected.
- [x] D2 (c): sign-in returns to the page that sent the reader to `/login`, limited to same-site paths. Done 2026-09-29 (console #51): `/login?next=`, checked by `lib/return-path.ts`.

## 6. Open questions

- Resolved: no redirect from bare `/how-to` (approved with the spec).
- Checked 2026-09-27: the status section's HTML holds only the selected state's details (on Round, the default No Wi-Fi), so search engines see one of eight Round states. Rendering every state's details, collapsed, would fix that without changing the look. Listed as a follow-up.
