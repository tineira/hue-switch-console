# Open-source launch

Cross-repo spec. Process: `AGENTS.md` → "Cross-repo changes".

**Status:** approved (decisions D1–D6 taken 2026-09-27); launched 2026-09-29, after-launch items open

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

## 4. Decisions

Taken by the user on 2026-09-27, following Claude's recommendations.

| # | Decision | Taken |
| --- | --- | --- |
| D1 | Contributor terms | **Inbound = outbound. No CLA, no DCO sign-off.** `CONTRIBUTING.md` in each repo says so. Consequence: relicensing the console later (for example, a commercial license alongside AGPL) would need every outside contributor's consent. |
| D2 | Protecting `main` | **A ruleset with maintainer bypass**, applied when each repo goes public (GitHub does not offer rulesets on private repos on the free plan). Everyone else must use a pull request with the required check passing. Force pushes and deletion are blocked for everyone. The owner, and agent sessions acting for them, can still push to `main` directly. The exact rulesets are in §6. |
| D3 | Code of conduct | **Contributor Covenant 2.1** in all three repos (`CODE_OF_CONDUCT.md`, linked from `CONTRIBUTING.md`). Reports go to `conduct@tineira.com`, which forwards to the maintainer. It uses Cloudflare Email Routing on `tineira.com`, set up 2026-09-27; `hue.tineira.com` is a CNAME to Vercel and cannot take MX records. |
| D4 | GitHub Discussions | **Off at launch.** Issues with the "Feature idea" form are enough. Revisit if questions start crowding the issue tracker. |
| D5 | "Hue" in repo and product names | **Keep the names** with the "not affiliated with Signify" line in each README. Rename before any commercial sale or store listing. |
| D6 | Self-hosting | **A separate spec after launch** (`docs/specs/self-hosting.md`). Setup would provision boards to the console's own origin instead of `https://hue.tineira.com`, and firmware CI would get a configurable upload URL. It is a contract change (installer, `HUESET`). |

## 5. Checklist

### Before going public (all repos)

- [x] Run a full-history secret scan with gitleaks on each repo. Done 2026-09-29 with gitleaks 8.30.1 over all branches: no leaks (console 247 commits, Round 60, Simple 52). No `.env`, `config.h` or `hue-lights.md` was ever committed.
- [x] Read through committed docs for things not meant to be public. Checked 2026-09-29: IDs, IPs and MACs in the docs are placeholders or private LAN examples, `docs/archive/` is only the old Supabase config, and the firmware docs are clean. `docs/problems.md` (an internal session log) was removed: most items were already fixed, the open ones became issues (console #18–#23, Round #14–#15, Simple #17), and the known security weak spots moved to the maintainer's private notes. The file stays in git history, as does the closed Round issue #3 until it is deleted.
- [x] `SECURITY.md` in each repo (2026-09-29): report through GitHub private vulnerability reporting. Supported: the production console and the current firmware release of each product. In scope: device tokens, sign-in, the upload endpoint, the USB installer.
- [x] `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1, contact `conduct@tineira.com`), 2026-09-27.
- [x] `.github/dependabot.yml`: `npm` in the console, and `github-actions` in all three. Weekly, grouped (npm majors get their own PR). 2026-09-29.
- [x] D1 settled: no CLA or sign-off; `CONTRIBUTING.md` says so.
- [x] Vercel: confirm Git fork protection is on, so a fork's pull request does not get a preview deployment with production env vars without approval. Confirmed on 2026-09-29.
- [x] Repo descriptions and topics (`philips-hue`, `esp32`, `arduino`, `nextjs`, `home-automation`).

### Console (`hue-switch-console`)

- [x] Make the repo public (user's OK). 2026-09-29.
- [x] Turn on private vulnerability reporting.
- [x] Apply the two §6 rulesets, required check `check`.
- [x] Check on production that the footer "Source (AGPL-3.0)" link opens the repo.
- [x] Actions settings: keep "Require approval for first-time contributors" for fork pull requests.

### Round (`hue-round-switch`)

- [x] Make the repo public (user's OK). 2026-09-29.
- [x] Turn on private vulnerability reporting.
- [x] Apply the two §6 rulesets, required check `compile`.

### Simple (`hue-simple-switch`)

- [x] Make the repo public (user's OK). 2026-09-29.
- [x] Turn on private vulnerability reporting.
- [x] Apply the two §6 rulesets, required check `compile`.

### Settings (all repos)

- [x] Dependabot alerts and automatic security fixes on, 2026-09-29.

### After launch

- [ ] Firmware: move the `THIRD_PARTY.json` ↔ `sketch.yaml` check out of `firmware.yml` into a script run by both `build.yml` and `firmware.yml`. That way a PR that bumps a library without updating credits fails before merge, not at release.
- [ ] Label a few `good first issue`s so newcomers have a place to start. Console #20 and #21 are labeled so far.
- [ ] Write `docs/specs/self-hosting.md` (D6).

## 6. Rulesets for `main` (D2)

Two rulesets per repo, applied once the repo is public, each with `gh api -X POST repos/tineira/<repo>/rulesets --input <file>.json`. A bypass actor skips every rule in its ruleset, so the rules that must hold for everyone live in a ruleset with no bypass.

**`main-protect`** blocks deletion and force pushes for everyone, the owner included:

```json
{
  "name": "main-protect",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "bypass_actors": [],
  "rules": [ { "type": "deletion" }, { "type": "non_fast_forward" } ]
}
```

**`main-review`** requires a pull request and a passing check from everyone except the Admin role (`actor_id: 5`; the owner is admin on all three repos). `<check>` is `check` for the console (job in `ci.yml`) and `compile` for each firmware (job in `build.yml`):

```json
{
  "name": "main-review",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "bypass_actors": [ { "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "always" } ],
  "rules": [
    { "type": "pull_request", "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false
    } },
    { "type": "required_status_checks", "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [ { "context": "<check>" } ]
    } }
  ]
}
```

After applying, confirm that a direct push by the owner to `main` still works and a force push is refused.
