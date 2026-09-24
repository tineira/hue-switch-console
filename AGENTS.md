<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# hue-switch-console

Vercel/Next.js commissioning UI. Not the Arduino firmware (`hue-simple-switch`).

- **English everywhere**, in all three repos: product UI (labels, errors, auth emails), docs, specs, READMEs, code comments, commit messages. Do not write new Spanish; translate Spanish you touch.
- Topology arrives from the LAN (switch or `push-from-bridge`); this app never calls the Hue Bridge.
- Secrets stay in `.env.local` — never commit it.
- Do not mix this tree with `C:\Users\tinei\Arduino`.
- Read `docs/definitions.md` before implementing.
- Scratch notes (`docs/_audit-*.md`, `docs/_review-*.md`, other `_*.md` working dumps) are not spec. Delete them once folded into a real doc or implemented. Do not commit them.
- Firmware images are not in this tree. Firmware CI uploads each release to `POST /api/firmware/<product>`, and `/firmware/<product>/manifest.json` serves the current one from the database. The wizard version is that release, not a label you invent. Pipeline: `README.md`, "Firmware release pipeline".
- Do **not** use local Playwright to verify login or `/install`. Worktrees lack a working DB session; Web Serial needs a person in Chrome with USB. Check production after deploy. Playwright-against-localhost is expected to fail and is not a defect.

## Multi-repo: this repo owns the contract

The product is three repos. This one is the hub.

| Repo | Path | Role |
| --- | --- | --- |
| `hue-switch-console` | `C:\Users\tinei\hue-switch-console` | Console, device API, contract docs, installer bins |
| `hue-round-switch` | `C:\Users\tinei\Arduino\hue-round-switch` | XIAO ESP32-S3 + Round Display firmware (`product: "round"`) |
| `hue-simple-switch` | `C:\Users\tinei\Arduino\hue-simple-switch` | XIAO ESP32-C6 wall-contact firmware (`product: "simple"`) |

More switch firmwares may join; each gets a row here and the same `## Contract` section in its own AGENTS.md.

Source of truth for anything a switch and the console both depend on:

- `docs/device-api.md`: endpoints, auth, payloads, error codes.
- `docs/definitions.md`: product model (recipes, channels, pages).
- `docs/changelog.md`: console release notes and each product intro. Firmware notes live in each firmware repo's `CHANGELOG.md` and arrive with the upload.
- `/firmware/<product>/manifest.json`: what `/install` flashes, the product's current uploaded release.

Firmware repos implement these docs; they do not redefine them. A firmware session that needs a protocol change proposes it here, not in its own tree.

Switches share the **contract**, not code. Do not extract a library across all firmwares: the C6 (single core, tight RAM, no PSRAM) and the S3 (PSRAM, two cores) need different console, Hue and USB-setup layers. Code is shared per chip family, and only once a second switch on that chip exists (e.g. an S3 library pulled from Round when an S3 Simple starts).

### Cross-repo changes

A change is cross-repo if it touches a device endpoint, a payload field, NVS keys the console writes over USB (`HUESET`, Improv), or the installer. Order:

1. **Spec.** `docs/specs/<feature>.md` from `docs/specs/TEMPLATE.md`, with a checklist per repo. The user approves it before code.
2. **Console first, backward compatible.** Accept both old and new device behavior. Never ship a console that breaks boards already on the wall; they update by USB (or OTA, when it exists) on the user's schedule.
3. **Update `docs/device-api.md`** in the same commit as the endpoint change.
4. **Each firmware** adopts the change and bumps `FIRMWARE_VERSION`.
5. **Retire the old path** only once no registered switch reports an older `firmware` (check `switches.firmware`), and only with the user's OK.

One session per repo does that repo's checklist, reading that repo's AGENTS.md. A coordinating session (usually one in this repo) writes the spec, hands each repo its section, and ticks the checklist. It does not edit firmware trees itself unless the user says so. Flashing, USB and Web Serial are done by the user.
