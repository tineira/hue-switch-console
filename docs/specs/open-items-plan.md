# Plan: finish the open items after launch

Coordination plan across the three repos. Not a feature spec; the features it builds have their own specs.

**Status:** all questions decided by the user on 2026-09-29. **Waiting for the user's go.** The user will ask to update this plan once the separate Simple dim-cycle session (`docs/specs/simple-dim-cycle.md`) finishes. Nothing below starts before the go.

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
| Simple dim cycle | Out of this plan; another session is building it. Simple work in this plan waits for the user's update after it lands. |
| Merging | Agents squash-merge their own PRs once the required check is green. This needs a rule the user adds first (see "Before the go"). |

## Workstreams

Each runs as one agent in its own worktree, following that repo's `AGENTS.md`. The coordinating session (in the console repo) launches them, relays findings between them and reports.

### A. Console upkeep (`hue-switch-console`)

1. Merge the green Dependabot PRs (#12 actions, #13 minor/patch, #15 `@types/node`), checking the combined `main` stays green.
2. TypeScript 7 migration (#16) and ESLint 10 migration (#14), one PR each.
3. #19 phase 2: `400 product_required` for a register with a `mac` and no valid `product`; remove `inferProduct` and `isPlaceholderRoundChannels`; `docs/device-api.md` in the same commit; tick `docs/specs/require-product-on-register.md` and move it to `finished/`.
4. Good first issues #34, #35, #36.
5. Production checks: a register on production returns `"snapshot": "stored"` (#18 spec; read from Vercel logs or a switch's next register), then move `docs/specs/keep-topology-on-empty-register.md` to `finished/`. The waitlist bounce test; tick it in `docs/specs/waitlist.md`.
6. CI images: confirm `ci.yml` passes on the Ubuntu 26 runner image before `ubuntu-latest` moves on 2026-10-19; fix what breaks.

### B. Self-hosting, console side (`hue-switch-console`)

Everything in the console part of the `docs/specs/self-hosting.md` checklist, console first and backward compatible, including `docs/self-hosting.md`, the Setup host-change question and the generic Privacy page. `DEVICE_CONSOLE_URL` on Vercel is set by Claude through the Vercel connector. Runs in parallel with A; each rebases on `main` before merging.

### C. Round (`hue-round-switch`)

1. Merge Dependabot #13 (actions).
2. Self-hosting: `firmware.yml` reads `vars.CONSOLE_UPLOAD_URL` (default hosted) and skips the upload with a `::notice::` when there is no token on a fork; README section for forks.
3. Good first issues #19 (fold Latin Extended-A on the screen) and #20 (shared JSON array walker). No version bump; #19 goes under "Unreleased" in `CHANGELOG.md`.
4. CI image check, as in A.6.

### D. Simple (`hue-simple-switch`), after the dim cycle lands

1. Merge Dependabot #15 (actions).
2. Self-hosting: the same `firmware.yml` change and README section as C.2.
3. Good first issues #21 (tests for `otaParseOffer`) and #20 (keep the overflow flag), rebased on the dim-cycle work. No version bump.
4. CI image check, as in A.6.

### Housekeeping (coordinating session)

- `docs/specs/open-source-launch.md`: tick the credits-check and good-first-issue items; move the spec to `finished/` once the self-hosting line is done.
- Remove worktrees and branches once merged.

## Before the go (user)

- **Merge rule.** Let agents squash-merge their own green PRs in `tineira/*` repos, knowing that a console merge deploys production. For example, add this to the auto-mode environment in `/auto-mode-setup`: "Agents may squash-merge their own pull requests in tineira/* repos once required checks pass; merging to main deploys hue.tineira.com and is authorized." Claude does not change its own permissions.
- **Neon connector:** reconnect it if an agent should read the production database (not required by this plan any more).
- **Dim cycle:** tell the coordinating session when it has landed, so workstream D can start.

## Stays with the user

- Board tests of Round and Simple 0.6.4, and of the next releases that carry this plan's firmware changes.
- Waitlist checks that need an invite in the user's inbox.
- One board provisioned from a local console (the last self-hosting checklist item).
