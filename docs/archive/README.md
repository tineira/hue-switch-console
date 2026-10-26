# Archive (frozen)

Shipped specs, design handoffs and prototypes, kept as design history. **Frozen: never add, edit or "reopen" a file here** (fixing a broken link is fine). Code comments cite these files for the reasoning behind a rule; the rule itself, where switches depend on it, lives in a current doc. `npm run lint` fails if `docs/specs/`, `docs/plans/`, `docs/prototypes/` or `docs/design/` reappear.

Where new work goes instead:

- **A cross-repo contract change** (device endpoint, payload field, USB command or NVS key the console writes, the installer) → a public GitHub issue from the **Contract change** template. Once it ships, the contract lands in [`device-api.md`](../device-api.md), [`usb-protocol.md`](../usb-protocol.md), [`definitions.md`](../definitions.md) or [`round-pages.md`](../round-pages.md).
- **Console-only and product specs, decisions** → the maintainer's internal tracker.
- **Open work** → GitHub issues.
- **How it works today** → the current docs in [`docs/`](..), [`README.md`](../../README.md) and [`CONTRIBUTING.md`](../../CONTRIBUTING.md).

Archived on 2026-10-26 from `docs/specs/` and `docs/specs/finished/`. Two design handoffs nothing cited (`design_handoff_how_to_guide`, `design_handoff_landing_page`) were deleted; links to them point to their last version on GitHub. A few passages were left out of the archived copies.

## Specs (`specs/`)

| Spec | Summary |
|------|---------|
| [`admin-tabs.md`](specs/admin-tabs.md) | `/admin` split into tabs: Overview, Accounts, Firmware, Settings, Activity |
| [`admin-tools.md`](specs/admin-tools.md) | Admin tools: accounts, invites, firmware approval, admin log |
| [`build-guides.md`](specs/build-guides.md) | Build guides on `/how-to`: parts to buy and assembly. Text: `lib/how-to-build.ts` |
| [`config-sync.md`](specs/config-sync.md) | Config sync status and the `X-Poll-Sec` poll cadence. Now: `device-api.md` |
| [`console-review-fixes.md`](specs/console-review-fixes.md) | Fixes from the 2026-09-30 console review |
| [`credits.md`](specs/credits.md) | Footer and `/credits` from firmware `THIRD_PARTY.json`. Now: README, "Firmware release pipeline" |
| [`devices.md`](specs/devices.md) | Setup (formerly Devices): detect, then flash and provision over USB. Now: `usb-protocol.md` |
| [`firmware-uploads.md`](specs/firmware-uploads.md) | Firmware CI uploads to `POST /api/firmware/<product>`, served from Postgres. Now: README |
| [`how-to-guide.md`](specs/how-to-guide.md) | How-to guide v2 |
| [`how-to-navigation.md`](specs/how-to-navigation.md) | How-to navigation: switch, then topic, then build type |
| [`keep-topology-on-empty-register.md`](specs/keep-topology-on-empty-register.md) | An empty register snapshot keeps the stored topology. Now: `device-api.md` |
| [`multi-user-accounts.md`](specs/multi-user-accounts.md) | Accounts on Better Auth, sign-up modes, per-account limits |
| [`open-items-plan.md`](specs/open-items-plan.md) | Plan to finish the open items after the open-source launch |
| [`open-source-launch.md`](specs/open-source-launch.md) | Going public: licenses, CI, code of conduct, `main` rulesets |
| [`ota-round.md`](specs/ota-round.md) | Updates over Wi‑Fi for the Round. Wire: `device-api.md` (`ota`) |
| [`ota.md`](specs/ota.md) | Updates over Wi‑Fi (Simple first). Wire: `device-api.md` (`ota`) |
| [`page-structure.md`](specs/page-structure.md) | Page structure: Switches, Lights, Setup |
| [`public-how-to-changelog.md`](specs/public-how-to-changelog.md) | `/how-to` and `/changelog` public, without sign-in |
| [`require-product-on-register.md`](specs/require-product-on-register.md) | Register needs `product`. Now: `device-api.md` |
| [`round-accented-names.md`](specs/round-accented-names.md) | Accented names on the Round's built-in font. Now: `round-pages.md` rule 20 |
| [`schema-version.md`](specs/schema-version.md) | Apply `db/schema.sql` once per schema version |
| [`self-hosting.md`](specs/self-hosting.md) | Self-hosting design: console URL over USB, firmware upload URL. Now: `self-hosting.md` |
| [`setup-guide.md`](specs/setup-guide.md) | Setup over USB as a step-by-step guide |
| [`setup-update-notes.md`](specs/setup-update-notes.md) | Release notes before an update in Setup; the `Important: ` bullet. Now: README |
| [`simple-channel-types.md`](specs/simple-channel-types.md) | Simple channel kinds (wall switch, push button) chosen in the console. Now: `definitions.md` |
| [`simple-d0-d5-inputs.md`](specs/simple-d0-d5-inputs.md) | Simple inputs on D0–D5 |
| [`simple-dim-cycle.md`](specs/simple-dim-cycle.md) | Simple hold-to-dim cycle. Now: `definitions.md` |
| [`simple-editor-v2.md`](specs/simple-editor-v2.md) | Simple editor v2, with its clickable [`mockup`](specs/simple-editor-v2/mockup.html) |
| [`simple-hold-dim.md`](specs/simple-hold-dim.md) | Simple hold to dim |
| [`terms-and-safety.md`](specs/terms-and-safety.md) | Safety notice, Terms of Use and the acceptance gate |
| [`toggle-on-flip.md`](specs/toggle-on-flip.md) | Wall switch: each flip toggles. Now: `definitions.md` |
| [`usb-download-mode.md`](specs/usb-download-mode.md) | `HUEBOOT`: install the Simple without buttons. Now: `usb-protocol.md` |
| [`waitlist.md`](specs/waitlist.md) | Waitlist sign-up mode with a seat cap and Resend bounce webhook |
| [`web-setup.md`](specs/web-setup.md) | Install from the browser: flash, Improv, `HUESET`. Now: `usb-protocol.md` |

## Design handoffs (`specs/`)

| Folder | Summary |
|------|---------|
| [`design-bridge-v2/`](specs/design-bridge-v2/README.md) | Switches editor layout, gesture picker and summary sentences (`app/switches/`, `lib/gestures.ts`) |
| [`design_handoff_lights_map/`](specs/design_handoff_lights_map/README.md) | Lights map, desktop and mobile (`app/lights/`, `lib/lights-map.ts`) |
| [`handoff_landing_v2/`](specs/handoff_landing_v2/README.md) | Landing page with the 3D Round assembly (`app/landing/`) |

## Prototypes (`prototypes/`)

| File | Summary |
|------|---------|
| [`round-themes.html`](prototypes/round-themes.html) | Picker prototype for the Round's 20 circle palettes. Values now in `lib/round-themes.ts` |
| [`theme-preview.html`](prototypes/theme-preview.html) | Prototype of the web themes. Live: `app/themes.ts` |

## Other

| Folder | Summary |
|------|---------|
| [`supabase-DO-NOT-APPLY/`](supabase-DO-NOT-APPLY/README.md) | The old Supabase config. Do not apply: the runtime uses `db/schema.sql` |
