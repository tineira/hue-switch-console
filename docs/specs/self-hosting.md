# Self-hosting

Cross-repo spec. Process: `AGENTS.md` → "Cross-repo changes". Decision D6 in `docs/specs/open-source-launch.md`.

**Status:** approved 2026-09-29 by the user (all §5 questions decided); console implementation in progress (`docs/specs/open-items-plan.md` workstream B).

## 1. What and why

Someone who runs their own console (on Vercel, a home server or a Raspberry Pi) can build a switch and set it up from **their** console, end to end. Setup flashes the firmware their console stores and provisions the board to their console's address, not `https://hue.tineira.com`. The firmware they install is either built by their own fork's CI and uploaded to their console, or copied from the hosted console's public releases. Today a self-hosted console can run, but Setup always writes `https://hue.tineira.com` to the board (`PRODUCT_CONSOLE_URL` in `lib/web-setup/products.ts`), and firmware CI always uploads to the hosted console. So a self-hosted board talks to the wrong console, and a self-hosted console has no firmware to install.

## 2. Contract change

### 2.1 Installer: which URL `HUESET url` writes (**additive**)

- New console setting `DEVICE_CONSOLE_URL` (env): the origin boards use to reach this console, such as `https://hue.example.org` or `http://192.168.1.20:3000`. When unset, it falls back to `BETTER_AUTH_URL` (`publicUrl()`), then to the origin of the page running Setup.
- `/setup` writes that value with `HUESET url` instead of the fixed `PRODUCT_CONSOLE_URL`. The hosted console sets `DEVICE_CONSOLE_URL=https://hue.tineira.com`, so hosted boards get exactly what they get today.
- Setup shows the URL it is about to write ("This board will talk to http://192.168.1.20:3000") before provisioning, so a wrong value is visible.
- The Setup page and the URL written can differ on purpose. Web Serial needs a secure context: `https://` or `http://localhost`. A LAN console on plain `http://192.168.x.x` cannot run Setup from another machine's browser, so the owner opens Setup at `http://localhost:3000` on the server itself while boards get `http://192.168.1.20:3000`. See §2.4.
- `docs/device-api.md` → "Host and TLS": replace the fixed `CONSOLE_URL=https://hue.tineira.com` with "the URL the installer wrote (`DEVICE_CONSOLE_URL` of that console)", and keep the rule that firmware accepts any `http://` or `https://` URL with no allowlist.

No NVS key changes. `HUESET url` and `HUESET token` already exist, and both firmwares already accept `http://` and `https://` URLs and have no compiled-in console URL (`console` NVS namespace only).

### 2.2 Firmware CI: configurable upload URL (**additive**, firmware repos)

- `.github/workflows/firmware.yml` in each firmware repo reads the upload origin from a repository variable, `CONSOLE_UPLOAD_URL` (`vars.CONSOLE_UPLOAD_URL`), defaulting to `https://hue.tineira.com`. The token stays the `FIRMWARE_UPLOAD_TOKEN` secret.
- A fork sets its own variable and secret. Its pushes then upload to its console, where they wait in `/admin` to be made current (firmware approval, PR #32).
- A fork with neither variable nor secret should skip the upload step with a notice instead of failing. Today the step fails when the secret is missing. See open question 4.

### 2.3 Getting firmware without building it (**additive**, console only)

- New script `scripts/import-firmware.mjs <round|simple> [--from https://hue.tineira.com] [--version x.y.z]`. It reads `/firmware/<product>/manifest.json` and the four parts from the source console, checks each part against the manifest version, and uploads them to the local console with `POST /api/firmware/<product>` and the local `FIRMWARE_UPLOAD_TOKEN`. The release notes come from the source's `/changelog` data. This needs a small public JSON endpoint, such as `GET /firmware/<product>/<version>/notes`, because notes are not in the manifest.
- The imported release waits in `/admin` like any upload.

### 2.4 TLS on a home network (documentation, no contract change)

The firmware verifies `https://` against the Arduino-ESP32 certificate bundle (public CAs) and does not verify at all over `http://`. A self-hoster picks one of these options:

| Option | Board URL | Setup runs from | Notes |
| --- | --- | --- | --- |
| A. Public name with a real certificate (Let's Encrypt via DNS-01, a Cloudflare Tunnel, Tailscale Funnel, or a reverse proxy) | `https://hue.example.org` | Any browser | Recommended. Works with the firmware unchanged. The name may resolve to a LAN address (split DNS) as long as the certificate is from a public CA. |
| B. Plain HTTP on the LAN | `http://192.168.1.20:3000` | `http://localhost:3000` on the server, or Chrome with `--unsafely-treat-insecure-origin-as-secure` | Works with the firmware unchanged. The device token and topology cross the LAN unencrypted. |
| C. Private CA or self-signed certificate | `https://hue.lan` | A browser that trusts that CA | **Does not work today:** the firmware has no way to trust a private CA. It would need a new `HUESET ca` NVS key (PEM) and firmware support. Out of scope unless open question 3 says otherwise. |

The README gets a "Self-hosting" section with options A and B, `DEVICE_CONSOLE_URL`, the import script and the fork CI variable.

### 2.5 Console pages that name the hosted console (console only, no contract change)

`app/layout.tsx` (metadata base), `app/sitemap.ts` and `app/robots.ts` use `PRODUCT_CONSOLE_URL`. They switch to `publicUrl()` (falling back to the request origin). Privacy and the Open Graph image name `hue.tineira.com` as the hosted service; that text stays on the hosted console. A self-hosted console shows a generic Privacy page (or none), see open question 5.

## 3. Compatibility

- Boards on the wall: unaffected. They keep the URL in their NVS. Only a board provisioned (or re-provisioned) by Setup after this change gets `DEVICE_CONSOLE_URL`, and on the hosted console that is the same `https://hue.tineira.com`.
- Hosted console: no change in behavior once `DEVICE_CONSOLE_URL=https://hue.tineira.com` is set. The fallback chain makes an unset value safe too (`BETTER_AUTH_URL` is already that origin).
- Firmware: no code change needed for options A and B. Only `firmware.yml` changes (§2.2), with no `FIRMWARE_VERSION` bump.
- Firmware versions that need the old path: none.
- Old path to remove: the `PRODUCT_CONSOLE_URL` constant, once nothing reads it.

## 4. Checklist

### Console (`hue-switch-console`)

- [x] `DEVICE_CONSOLE_URL` with its fallback chain; `/setup` writes it and shows it before provisioning (§2.1)
- [x] `docs/device-api.md` "Host and TLS" updated in the same commit
- [x] Metadata, sitemap and robots use `publicUrl()` (§2.5)
- [x] Release notes endpoint and `scripts/import-firmware.mjs` (§2.3)
- [x] `docs/self-hosting.md` step-by-step guide (Postgres, env vars, deploy, options A and B, pointing boards at the console, firmware import, fork CI); the README keeps a short "Self-hosting" section that links to it (§2.4)
- [x] Setup compares the board's stored console host (`HUEGET` `url`) with this console and asks before moving it (§5 decision 2)
- [x] Privacy page: hosted text only on `https://hue.tineira.com`, a short generic page elsewhere; no hosted host name in the Open Graph image (§5 decision 5)
- [x] `.env.example` lists `DEVICE_CONSOLE_URL`
- [x] Hosted console: `DEVICE_CONSOLE_URL` set on Vercel (Production, 2026-09-29, by Claude)
- [ ] Deployed; checked on production (Setup shows `https://hue.tineira.com`)
- [ ] Tested by the user: one board provisioned from a local console over option B

### Round (`hue-round-switch`)

- [x] `firmware.yml` reads `vars.CONSOLE_UPLOAD_URL` (default hosted) and skips the upload without a token (§2.2) (hue-round-switch #21)
- [x] README: how a fork uploads to its own console ("Building from a fork", hue-round-switch #21)

### Simple (`hue-simple-switch`)

- [x] `firmware.yml` reads `vars.CONSOLE_UPLOAD_URL` (default hosted) and skips the upload without a token (§2.2) (hue-simple-switch #24)
- [x] README: how a fork uploads to its own console ("Build and upload from a fork", hue-simple-switch #24)

### Cleanup

- [x] `PRODUCT_CONSOLE_URL` removed once unused

## 5. Decisions

Decided by the user on 2026-09-29. Each one took Claude's recommendation; the reasoning is kept below.

1. **Which console URLs should the firmware accept over `HUESET url`?** Today it accepts any `http://` or `https://` URL. Choices: (a) keep both, (b) `https://` only, (c) `https://`, plus `http://` only for private LAN addresses (RFC 1918, `.local`, `localhost`). **Decided: (a), unchanged.** Writing the URL already needs physical USB access, which could reflash the board anyway, so (b) or (c) would not stop anyone. (b) would rule out option B, the easiest self-hosting setup. (c) adds parsing on the C6 for little gain, and it breaks plain-HTTP consoles addressed by hostname.
2. **Should a board warn when its console host changes?** For example, a `HUESET url` whose host differs from the stored one could get `HUEOK url changed <old-host>` so Setup can ask "This board was set up for hue.tineira.com. Move it to this console?". A `HUEGET` line already reports `url`. **Decided: yes, in the console (Setup), not the firmware.** Setup already reads `HUEGET` before provisioning; it can compare hosts and ask for confirmation, with no firmware change. A firmware-side warning (LED pattern or screen notice at boot) is not worth the flash and RAM on the C6.
3. **Support private CAs (option C)?** It would need a `HUESET ca` key, PEM storage in NVS (a few KB, tight on the C6) and a trust-store switch in both firmwares. **Decided: not now.** Options A and B cover most homes. Revisit if self-hosters ask.
4. **Fork CI without a token: skip or fail?** **Decided: skip with a `::notice::`,** so forks build green by default. The hosted repos keep failing loudly when the secret is missing, by checking that `github.repository` is the upstream repo.
5. **Privacy page and hosted branding on a self-hosted console.** **Decided:** show the hosted Privacy text only when `publicUrl()` is `https://hue.tineira.com`. Otherwise show a short generic page ("This console is run by its owner; see their policy"), and drop the "hue.tineira.com" line from the Open Graph image.
6. **Import notes endpoint vs. bundling notes in the manifest.** A `notes` field in `manifest.json` would avoid a new endpoint, but esp-web-tools-style manifests are read by the installer and should stay minimal. **Decided: the separate notes endpoint in §2.3.**
