# Plan: finish the open items after launch

Coordination plan across the three repos. Not a feature spec; the features it builds have their own specs.

**Status:** done 2026-09-29. All four workstreams merged. What only the user can do is listed under "Stays with the user"; each item is also unticked in its own spec.

## Decisions (2026-09-29)

| Topic | Decision |
| --- | --- |
| Dependabot majors (TypeScript 7, ESLint 10) | Migrate now, one PR each. If Next.js does not support TypeScript 7 yet, close that PR and have Dependabot ignore the major until it does. |
| Good first issues | Fix all of them (console #34–#36, Round #19–#20, Simple #20–#21). Label new ones afterwards so newcomers still have a way in. |
| Self-hosting | Decide and build now. `docs/specs/self-hosting.md` is approved; §5 has the decisions. Instructions go in a `docs/self-hosting.md` guide linked from the README. |
| Signed firmware images, encrypted board secrets | Neither for now. Upload approval in `/admin` stays the safeguard. |
| #19 phase 2 (`400 product_required`) | Ship now. The user confirmed no board runs firmware that omits `product`, so no log or database check is needed. It affects only register; first flashing through `/setup` and OTA are unchanged. |
| Waitlist production checks | An agent runs the bounce test on production (Resend's `bounced@resend.dev`). The checks that need an invite in the user's inbox stay with the user. |
| Firmware releases | None in this plan. Firmware code changes merge without a `FIRMWARE_VERSION` bump and ship with the next real release; Round #19 gets its CHANGELOG entry under an "Unreleased" heading. Self-hosting needs only firmware CI changes. |
| Simple dim cycle | Out of this plan; built by another session and landed before the go. Simple work in this plan builds on it. |
| Merging | Agents squash-merge their own PRs once the required check is green. The user added the rule to the auto-mode environment on 2026-09-29. |

## Workstreams

Each runs as one agent in its own worktree, following that repo's `AGENTS.md`. The coordinating session (in the console repo) launches them, relays findings between them and reports.

### A. Console upkeep (`hue-switch-console`)

1. Merge the green Dependabot PRs (#12 actions, #13 minor/patch, #15 `@types/node`), checking the combined `main` stays green. **Done:** #12 and #15 merged; #13 replaced by #40 without `esptool-js` 0.7.0 (breaking in the flashing code; needs a board test), which Dependabot now skips for minor bumps.
2. TypeScript 7 migration (#16) and ESLint 10 migration (#14), one PR each. **Done, held:** neither works with `eslint-config-next` 16.3 yet (typescript-eslint refuses TS 7; eslint-plugin-react crashes on ESLint 10). #45 moved to TypeScript 6; both PRs closed, and Dependabot ignores `typescript >= 7` and `eslint >= 10` until the Next lint stack supports them.
3. #19 phase 2: `400 product_required` for a register with a `mac` and no valid `product`; remove `inferProduct` and `isPlaceholderRoundChannels`; `docs/device-api.md` in the same commit; tick `docs/specs/require-product-on-register.md` and move it to `finished/`. **Done.**
4. Good first issues #34, #35, #36. **Done** (#42, #41, #46).
5. Production checks: a register on production returns `"snapshot": "stored"` (#18 spec; read from Vercel logs or a switch's next register), then move `docs/specs/keep-topology-on-empty-register.md` to `finished/`. The waitlist bounce test; tick it in `docs/specs/waitlist.md`. **Open:** production runtime logs keep about an hour and showed no register in that window, so `"snapshot": "stored"` was not observed (the code path is covered by review); check it on the next register. The bounce test was not run: joining needs a Turnstile pass on the production form and an explicit go from the user in chat to submit it, which the agent could not get.
6. CI images: confirm `ci.yml` passes on the Ubuntu 26 runner image before `ubuntu-latest` moves on 2026-10-19; fix what breaks. **Done:** `ci.yml` passed on `ubuntu-26.04` (throwaway PR #49, 2026-09-29); no change needed.

### B. Self-hosting, console side (`hue-switch-console`)

Everything in the console part of the `docs/specs/self-hosting.md` checklist, console first and backward compatible, including `docs/self-hosting.md`, the Setup host-change question and the generic Privacy page. `DEVICE_CONSOLE_URL` on Vercel is set by Claude through the Vercel connector. Runs in parallel with A; each rebases on `main` before merging.

**Done 2026-09-29** (console #39, #44, #47). `DEVICE_CONSOLE_URL=https://hue.tineira.com` is set on Vercel Production. Left for the user: check Setup on production shows `https://hue.tineira.com` (Setup needs a signed-in session), and provision one board from a local console over option B.

### C. Round (`hue-round-switch`)

1. Merge Dependabot #13 (actions).
2. Self-hosting: `firmware.yml` reads `vars.CONSOLE_UPLOAD_URL` (default hosted) and skips the upload with a `::notice::` when there is no token on a fork; README section for forks.
3. Good first issues #19 (fold Latin Extended-A on the screen) and #20 (shared JSON array walker). No version bump; #19 goes under "Unreleased" in `CHANGELOG.md`.
4. CI image check, as in A.6.

### D. Simple (`hue-simple-switch`), on top of the dim cycle

1. Merge Dependabot #15 (actions).
2. Self-hosting: the same `firmware.yml` change and README section as C.2.
3. Good first issues #21 (tests for `otaParseOffer`) and #20 (keep the overflow flag), on the latest `main`. No version bump; a user-visible change goes under "Unreleased" in `CHANGELOG.md`.
4. CI image check, as in A.6.

### Housekeeping (coordinating session)

- [x] `docs/specs/open-source-launch.md`: items ticked; moved to `finished/`.
- [x] Worktrees and branches removed once merged.

## Before the go (user) — done 2026-09-29

- **Merge rule:** added to the auto-mode environment in `~/.claude/settings.json`, with the source-control line naming all three repos.
- **Dim cycle:** landed.
- **Neon connector:** not needed by this plan.

## Stays with the user

- Board tests of Round and Simple 0.6.4, and of the next releases that carry this plan's firmware changes.
- Waitlist checks in `docs/specs/waitlist.md`, including the bounce test: the join form needs a Cloudflare Turnstile token, which an agent cannot produce.
- The #18 production check in `docs/specs/keep-topology-on-empty-register.md`: watch the Vercel logs while a switch registers (reboot one) for `"snapshot": "stored"`. Runtime logs only reach back about an hour.
- `/setup` on production shows `https://hue.tineira.com` (needs a signed-in session), and one board provisioned from a local console (the last two self-hosting items).
- Upgrading `esptool-js` past 0.6.1, which Dependabot now skips: it changes the USB code Setup relies on, so it needs a flash test on both boards.
- TypeScript 7 and ESLint 10, which Dependabot now skips until typescript-eslint and eslint-config-next support them.
