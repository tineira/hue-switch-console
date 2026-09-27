# Open-source launch

Cross-repo spec. Process: `AGENTS.md` → "Cross-repo changes".

**Status:** draft

## 1. What and why

The Hue switch product becomes community open source: anyone can read the code, report bugs, send pull requests and build a switch. The console is `AGPL-3.0-only` and every firmware is MIT (decided 2026-09-26, recorded in `AGENTS.md` → "Multi-repo").

What is already done, on 2026-09-26, while the repos stay private:

- `LICENSE` in all three repos. The console also has `"license": "AGPL-3.0-only"` in `package.json`, a README "License" section and a footer "Source (AGPL-3.0)" link (AGPL §13).
- `CONTRIBUTING.md`, issue forms (`.github/ISSUE_TEMPLATE/`) and a pull request template in all three repos. The console has a `contract` label for contract-change issues.
- Pull request CI. The console has `.github/workflows/ci.yml` (lint, typecheck, build, with no secrets). Each firmware has `.github/workflows/build.yml` (compile only, no upload).
- Personal machine paths removed from committed docs. Local paths now live in a gitignored `AGENTS.local.md` in each repo. `.grok/` is no longer tracked.
- The README "Local" section no longer runs migrations against production.
- The git history of all three repos was checked for committed `.env` files and common credential patterns (database URLs with passwords, Neon, Resend, GitHub, OpenAI and AWS keys). None were found.

This spec covers what is left: the work before the repos go public, the switch itself, and the follow-ups after.

## 2. Contract change

None. Nothing changes in `docs/device-api.md`, payloads, NVS keys or the installer. Self-hosting (§5, D6) would be a contract change and gets its own spec.

## 3. Compatibility

- Boards on the wall: unaffected. No firmware behavior changes. Firmware pushes in this work do not bump `FIRMWARE_VERSION`, so CI only re-sends notes (`409 version_exists` warning).
- Console: the only runtime change is the footer "Source" link, which returns 404 for visitors until the console repo is public.

## 4. Open decisions

Each has a recommendation. None is decided until the user says so.

| # | Decision | Recommendation |
| --- | --- | --- |
| D1 | Contributor terms: none (inbound = outbound, as `CONTRIBUTING.md` says now), DCO sign-off, or a CLA | **Inbound = outbound, no CLA.** A CLA is only worth its friction if you want to sell the console under a non-AGPL license later. Decide that before the first outside PR is merged, because relicensing needs every contributor's consent. |
| D2 | Protecting `main`: require a PR and passing checks for everyone, or allow the maintainer to bypass | **Ruleset with maintainer bypass.** Require a PR plus `CI` / `build` for everyone else, block force pushes and deletion, and let the owner (and agent sessions acting for them) push directly. On firmware repos a merge is a release, so outside changes must go through review. |
| D3 | Code of conduct contact address | **Contributor Covenant 2.1**, with a dedicated address (for example `conduct@hue.tineira.com`, forwarded through Cloudflare Email Routing) rather than a personal inbox. |
| D4 | GitHub Discussions | **Not at launch.** Issues with the "Feature idea" form are enough until there is real traffic. |
| D5 | Repo and product names contain "Hue" (a Signify trademark) | **Keep them, with the disclaimer that is already in each README.** Rename before any commercial sale or a store listing. |
| D6 | Self-hosting: Setup always provisions boards to `https://hue.tineira.com`, and firmware CI uploads there | **Separate spec after launch.** Setup would use the console's own origin, and firmware CI would get a configurable upload URL. This touches the installer and `HUESET`, so it is a contract change. |

## 5. Checklist

### Before going public (all repos)

- [ ] Run a full-history secret scan with `gitleaks detect` on each repo. The 2026-09-26 check was pattern-based only.
- [ ] Read through committed docs for things not meant to be public. Candidates: `docs/problems.md` (internal session notes), `docs/archive/`, and the house-specific examples in `docs/specs/finished/`.
- [ ] `SECURITY.md` in each repo: report through GitHub private vulnerability reporting. Supported: the production console and the current firmware release of each product. In scope: device tokens, sign-in, the upload endpoint, the USB installer.
- [ ] `CODE_OF_CONDUCT.md` (after D3).
- [ ] `.github/dependabot.yml`: `npm` in the console, and `github-actions` in all three. Weekly, grouped.
- [ ] Settle D1. If the answer is DCO or CLA, update `CONTRIBUTING.md` and the PR templates.
- [ ] Vercel: confirm Git fork protection is on, so a fork's pull request does not get a preview deployment with production env vars without approval.
- [ ] Repo descriptions and topics (`philips-hue`, `esp32`, `arduino`, `nextjs`, `home-automation`).

### Console (`hue-switch-console`)

- [ ] Make the repo public (user's OK).
- [ ] Turn on private vulnerability reporting.
- [ ] Ruleset on `main` (after D2): require the `CI / check` status.
- [ ] Check on production that the footer "Source (AGPL-3.0)" link opens the repo.
- [ ] Actions settings: keep "Require approval for first-time contributors" for fork pull requests.

### Round (`hue-round-switch`)

- [ ] Make the repo public (user's OK).
- [ ] Turn on private vulnerability reporting.
- [ ] Ruleset on `main` (after D2): require the `build / compile` status.

### Simple (`hue-simple-switch`)

- [ ] Make the repo public (user's OK).
- [ ] Turn on private vulnerability reporting.
- [ ] Ruleset on `main` (after D2): require the `build / compile` status.

### After launch

- [ ] Firmware: move the `THIRD_PARTY.json` ↔ `sketch.yaml` check out of `firmware.yml` into a script run by both `build.yml` and `firmware.yml`. That way a PR that bumps a library without updating credits fails before merge, not at release.
- [ ] Label a few `good first issue`s so newcomers have a place to start.
- [ ] Self-hosting spec (D6).
