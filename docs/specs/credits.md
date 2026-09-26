# Footer and credits

Cross-repo spec. Process: `AGENTS.md` → "Cross-repo changes".

**Status:** in progress

## 1. What and why

Every page of the console ends with a footer that says who built it and links to the author's GitHub and X profiles, the changelog and a new public **Credits** page. Credits thanks the services and hardware the product runs on (Vercel, Neon, Seeed Studio, Espressif) and lists the open-source software in both the console and the firmware that `/setup` flashes. The firmware part is an obligation, not only a courtesy. The console distributes firmware binaries, and those binaries contain the Arduino-ESP32 core (LGPL-2.1), ESP-IDF (Apache-2.0) and Arduino_GFX. Their licenses expect the distributor to name them. The page also carries the Philips Hue trademark disclaimer. The product has "Hue" in its name and should say it is not affiliated with Signify.

Firmware credits travel with each firmware upload, the same way release notes already do (`docs/specs/finished/firmware-uploads.md` §2.4). The page then always matches the binaries `/setup` is serving right now, with no console commit per release.

## 2. Contract change

`docs/device-api.md`: **no change.** Boards never see this.

The installer contract (firmware CI → console) gains one optional field. All changes are **additive**.

### 2.1 Footer (console only)

- `app/site-footer.tsx`, rendered once in `app/layout.tsx` after `{children}`. It is not in `Shell`, because half the pages do not use `Shell` (`/switches`, `/bridges`, `/devices`, `/install`, `/`, `/login`). `body` is already `min-h-full flex flex-col`, so `mt-auto` pins the footer to the bottom of short pages.
- One line, small and muted, wrapping on narrow screens:
  `Built by Tomas Neira · [GitHub] · [X] · Credits · Changelog`
  - GitHub → `https://github.com/tineira`, X → `https://x.com/tomneira`. Icons are inline SVG (no icon dependency). Each has an `aria-label` ("Tomas Neira on GitHub", "Tomas Neira on X") and `rel="me noopener noreferrer"`, and opens in a new tab.
  - Credits → `/credits`. Changelog → `/changelog`.
- Colors come from the theme tokens (`text-muted`, `border-line`), so the footer follows the theme picker.
- Width follows the page: the same horizontal padding as `Shell`, with max width `max-w-7xl`.

### 2.2 Credits page (console only)

`GET /credits`. **Public**: the page does not call `requireSessionUser()`. `proxy.ts` gates nothing today, so no change is needed there. `dynamic = "force-dynamic"`, because the firmware sections read the database.

Sections, in order:

1. **Thanks.** A hand-written list in `lib/credits.ts`. Each entry has a name, a one-line role and a link:
   - Vercel: hosting and deploys for the console.
   - Neon: serverless Postgres for switches, recipes and firmware releases.
   - Seeed Studio: XIAO ESP32-S3 / ESP32-C6 boards and the Round Display.
   - Espressif: ESP32 chips, ESP-IDF, and `esptool-js`, which flashes boards from the browser.
2. **Console open source.** Generated, not hand-written (§2.3). Name, version, license and link, sorted by name.
3. **Round firmware** and **Simple firmware.** The `credits` of the product's **current** release (§2.4), with the release version in the heading ("Round firmware 0.5.30"). If the current release has no credits (it was uploaded before firmware CI adopted this spec), the section says "Credits arrive with the next firmware release" and lists nothing.
4. **Trademarks.** "Philips Hue is a trademark of Signify. This project is independent and is not affiliated with, endorsed by or sponsored by Signify. XIAO is a trademark of Seeed Studio. Other names belong to their owners."

The page title is `Credits` (so the full title is `Credits · Hue switch console`). Layout: a `Shell` when someone is signed in, the plain `/login`-style column when not. The page calls `getSessionUser()`, never `require…`.

### 2.3 Console dependency list

- `scripts/credits.mjs` reads `package.json` `dependencies` plus a short allowlist of `devDependencies` that end up in the product (`tailwindcss`, `typescript`). For each one it reads `node_modules/<name>/package.json` (`version`, `license`, `homepage` or `repository`). It writes `lib/generated/console-credits.json`.
- The Geist fonts come through `next/font/google`, not npm, so they are added by hand in the script: Geist and Geist Mono, SIL OFL 1.1, `https://vercel.com/font`.
- The script runs as `prebuild` in `package.json`, so every Vercel build regenerates the list. The JSON is also committed, so `next dev` works without the script. A dependency change that forgets to rerun it is fixed by the next deploy.
- If a package has no `license` field, the script fails. A missing license needs a human decision, not a blank cell.

### 2.4 Firmware credits in the upload

`POST /api/firmware/{product}` accepts one new **optional** multipart field:

- `credits`: JSON, an array of `{ "name": string, "version": string, "license": string, "url": string }`, 1–50 entries. Each string is non-empty and at most 200 characters. `url` is `https://`. `license` is an SPDX expression where one exists (`LGPL-2.1-or-later`, `Apache-2.0`), otherwise free text.
- Missing: the release is stored with `credits = null`. Every existing CI run keeps working.
- Present but invalid: `400 invalid_credits` with `details` naming the first bad entry. Nothing is written.
- Storage (additive, via `ensureSchema` like the other columns): `alter table firmware_releases add column if not exists credits jsonb;`
- Re-uploads follow the same rule as `notes`. `200` (identical bins) and `409 version_exists` both overwrite `credits` when the field is present, so fixing a credits typo is a firmware push without a version bump. When the field is absent, the stored credits are left as they are.
- `docs/device-api.md` is not the home for this. The upload is documented in `README.md` → "Firmware release pipeline", which gains one line on `credits`.

### 2.5 Firmware side

Each firmware repo keeps `THIRD_PARTY.json` at its root, written by hand. It uses the same shape as §2.4 and lists what is linked into the image:

- the Arduino-ESP32 core, at the version pinned in `sketch.yaml` (`esp32:esp32 (3.3.12)`);
- ESP-IDF, which the core bundles (its version as shipped with that core);
- every entry under `libraries:` in `sketch.yaml` (Round: `GFX Library for Arduino (1.6.8)`);
- licenses read from each component's own `LICENSE` or `library.properties`, not from memory.

CI (`firmware.yml`, the "Upload to console" step):

- Check before upload: every `platform:` and `libraries:` entry in `sketch.yaml` appears in `THIRD_PARTY.json` with the same version. On a mismatch the run fails with a message naming the entry. This keeps a library bump from silently leaving stale credits.
- Send the file: `-F "credits=<THIRD_PARTY.json"`.

## 3. Compatibility

- **Console with firmware CI that has not updated:** no `credits` field arrives, so the release stores `null` and `/credits` shows the "arrives with the next release" line for that product. Nothing else changes.
- **Firmware CI before the console deploys:** an unknown multipart field is ignored by today's upload route (it reads named fields only), so an early firmware push still uploads. Even so, the order stays console first.
- **Boards:** unaffected.
- **Old path:** none to remove. `credits` stays optional in the console for good, because older release rows (and rollbacks to them) have none.

## 4. Checklist

### Console (`hue-switch-console`)

- [x] `app/site-footer.tsx` in `app/layout.tsx`; checked on a short page (`/login`) and a long one (`/switches`), and at phone width
- [x] `lib/credits.ts` (thanks list), `scripts/credits.mjs`, `prebuild`, committed `lib/generated/console-credits.json`
- [x] `/credits` page, public, with `Shell` when signed in
- [x] `credits` column, parsing and validation in `POST /api/firmware/{product}`; `invalid_credits`; overwrite on `200`/`409` only when present
- [x] `lib/firmware.ts` reads the current release's credits per product
- [x] `README.md` "Firmware release pipeline": the `credits` field and `THIRD_PARTY.json`
- [x] `docs/changelog.md` console entry
- [ ] Deployed; on production: footer on every page, `/credits` opens signed out, both firmware sections show the placeholder

### Round (`hue-round-switch`)

- [x] `THIRD_PARTY.json` (Arduino-ESP32 core 3.3.12, ESP-IDF, GFX Library for Arduino 1.6.8), with licenses checked against each component's own files
- [x] `firmware.yml`: `sketch.yaml` ↔ `THIRD_PARTY.json` version check; send `credits`
- [ ] `FIRMWARE_VERSION` bump **not required**: a push of the same version re-uploads with `credits` and gets `200` or `409`, and both store it. Bump only if the push ships other changes too.
- [ ] Production `/credits` shows the Round list

### Simple (`hue-simple-switch`)

- [x] `THIRD_PARTY.json` (Arduino-ESP32 core 3.3.12, ESP-IDF; no extra libraries today)
- [x] `firmware.yml`: same check and field as Round
- [ ] Production `/credits` shows the Simple list

### Cleanup

- [ ] None. `credits` stays optional.

## 5. Decisions (2026-09-26)

1. **Transitive firmware components.** ESP-IDF is one entry that links to its own third-party license page. Its bundled components (FreeRTOS, mbedTLS, lwIP and others) are not copied into `THIRD_PARTY.json`.
2. **License texts.** Each entry's `url` points at the component's license in the upstream repo, at the pinned version where one exists. No license text is stored in the database.
3. **Console dependencies.** Direct dependencies only.
4. **`/setup` link.** Not added.
