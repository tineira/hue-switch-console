# Problems to analyze — Hue product

**Analysis** document, not implementation or changelog. Written by the captain (2026-09-20) by cross-checking console + Round + Simple against `docs/device-api.md`, `docs/definitions.md` and `docs/round-pages.md`.

**Nothing was implemented.** The next slice is decided here, not in code.

Herdr map (this session, do not recreate): `hue-captain` w4 · `hue-console` w5 · `hue-round` w6 · `hue-simple` w7. `tinei` w2 is not touched.

Raw audits from the implementers (appendix, not contract):

- console: `docs/_audit-console.md` (C1–C24)
- round: `hue-round-switch/docs/_audit-round.md` (R1–R14)
- simple: `hue-simple-switch/docs/_audit-simple.md` (S1–S9)

---

## How to read this

| Severity | Means |
| --- | --- |
| **Contract** | The spec contradicts itself, or code and spec cannot both be true. It must be **decided** before touching code. |
| **Runtime** | Under the current contract, a user or a second device breaks. |
| **Docs** | The code already made the cut; the docs still describe the old one. Agents and humans will reimplement or skip what was done. |
| **Debt** | Does not block today's ritual; rots if left. |

What **is** aligned (do not reopen): `POST /api/ingest` → 410; register + poll with Bearer; console TLS with the bundle / `setInsecure` only for the Bridge; Round sends `product:"round"` + `channels:[]`; Simple omits `product` and sends GPIO; `group`/`dim` are parsed in firmware 0.5.13; idle + swipe + recipe/ring worker on Round; maintained GPIO state machine (400 ms, double → `on` fallback); poll 1 min / 1 h.

---

## 1. The contract lies to itself

These must be closed **on paper**, or each implementer will "fix" the world of 2026-09-18.

### P1 — `definiciones.md` describes another product

**Severity:** Docs (contaminates Contract) · C1, R5, S8

The file is still the product doc, but its "today" is false:

- Auth = Supabase; Vercel/Supabase/DNS infra "pending". Runtime: Neon + `hsw_session` cookie (`lib/auth.ts`).
- "Today: `POST /api/ingest` + local snapshot". Runtime: ingest 410, rich register.
- `config.h` "only SSID/password". Both firmwares already have `CONSOLE_URL` / `CONSOLE_TOKEN`.
- Device API = `{ rev, recipes[] }` with `channelId`. Round needs `pages` + `pageId` or it restores NVS.
- The `double_click` → `on` fallback is for the **wall**. The circle is a no-op if the double slot is empty.
- Repos section: does not list `hue-round-switch`.
- "Product gaps: none" while web-setup is still requirements.

`device-api.md` is newer and also carries the `sb-…` cookie (C3). Anyone reading only the definitions reopens ingest.

**Decide:** rewrite the state (Neon auth, register, Round = `round-pages.md`, Simple = GPIO) and stop having a "Today" section that goes stale, **or** mark the definitions as Simple-only and point the rest to device-api / round-pages.

### P2 — Two "canonical" copies of pages disagree on state

**Severity:** Docs · R1, R2, R3, R4, R6

`docs/round-pages.md` L7/L662: group + `dim.mode` **already** persist and the firmware consumes the poll.

`hue-round-switch/docs/pages-requirements.md` L7/L662: **not in code yet**.

Firmware 0.5.13 **does** parse `group`/`dim`, idle, worker. Also:

- `AGENTS.md` and the Round README still follow the `c1` / gpio 0 / "the ring dims the recipe" model. The real register is `channels:[]`.
- The live `idle-display.md` says "not implemented"; there is a copy in `docs/specs/finished/`.
- `input-during-hue.md` header 0.5.8 vs body "today 0.5.7".

**Decide:** a single copy owns the **state**. The §8.2 body is already the same; the state paragraph is not.

### P3 — `rev = 0` does not clear NVS

**Severity:** Contract · C5

device-api: a `bridgeid` change deletes recipes and `rev` becomes **0**.

Firmware (Simple and Round): if local `rev` ≥ remote, it does **not** write NVS.

`upsertSwitch` (`lib/db.ts` ~L304–332) sets `rev = 0` in the console. A XIAO with NVS `rev=12` that re-pairs to another Bridge sees remote 0 and **keeps the previous Bridge's recipes** (unless the firmware resets `rev` on `bid` change, which Simple does try in `recipesBindBridge` — confirm Round does the same **before** the poll).

**Decide:** either the console **increments** `rev` when clearing (the poll replaces), or the contract requires an NVS reset in firmware on `bridgeid` change and stops using `0` as a flag. Today it asks for both and they don't fit.

### P4 — Omitted / empty snapshot overwrites the Bridge tree

**Severity:** Contract + Runtime · C8, S2, S3

Last snapshot wins. That is correct **if the POST is a real tree**.

- Parser: `lights` omitted → 400. `rooms` / `scenes` omitted → `[]` and the register **accepts** (C8). An incomplete POST leaves the UI without groups.
- Simple: `hueBuildSnapshot` **always** `return true` (`snapshot.h:214–239`). If Clip v2 fails, it POSTs `[]`. A C6 with a bad key **wipes** living room/scenes for every XIAO on that `bridgeid` (S2).
- A Clip v2 scene object > 20 KB (`JsonDataSink::kMaxObj`) is dropped: scenes go missing for `double_click` → `recall_scene` (S3). Round uses the same stream pattern; check whether it shares the cap.

**Decide:** is a register without `rooms`/`scenes` a 400? Is a POST with Hue streams ≠ 200 skipped (no overwrite)? Can the scene parser skip copying `actions`?

**Status (2026-09-27):** mostly closed. Omitted `rooms`/`scenes` is a 400. Both firmwares skip the register when any Clip v2 stream is not 200 (`hue-simple-switch/console.h`, `hue-round-switch/hue_job.h`). An empty tree that still lands keeps stored page groups (`withGroupAndDim` falls back to `page.group`); only the UI pickers and scene names go empty. Open: a scene object over the stream cap is still dropped silently (S3), and a Bridge that answers 200 with empty `data` still overwrites.

### P5 — `product` inference is fragile

**Severity:** Contract · C6, C23, S1

Contract: `product` optional; `[]` or `c1` ⇒ round; GPIO ⇒ simple.

Code: `channels.length === 0` ⇒ round. A Round **without** `product` and with any channel other than `[]`/`c1` is classified simple and **pages are deleted** (`lib/db.ts` L297–299). A Simple that sends `[]` gets a Round poll (`pageId`) and when `rev` goes up it loses its GPIO recipes.

Simple today **omits** `product` (legal) and sends GPIO (safe). Round sends `product:"round"` (safe). The gap is the inference path and the round→simple wipe.

**Decide:** wipe only with an explicit `product:"simple"`? Should Simple always send `"product":"simple"`?

### P6 — Required group vs page `p1` without a group

**Severity:** Contract · C12

round-pages §12: group required. §14: if it can't be inferred, the page stays **without a group**. Register creates `p1` / "Page 1" with `group: null`. The human PUT also accepts `group: null` if there are no recipes.

**Decide:** the no-group default is a "just registered" state (allowed until the first save), or the PUT always requires a group.

### P7 — Pre-pages Round dual stack

**Severity:** Contract (only if old boards exist) · C22

The Round poll emits **only** `pageId` + `pages[]`. There is no `c1` dual-write. Spec: "v1 assumes flashing together with the console."

**Decide:** is any Round in the field on pre-`pages` firmware? If not, it's not a slice. If so, the current poll leaves them blind.

---

## 2. Runtime — the finger or the tree break

### P8 — Synchronous HTTP in the `loop` (GPIO and touch)

**Severity:** Runtime · S4, R11

Contract: the contact / finger do **not** wait for Vercel. Simple: `loop` = `channelsPoll` + `consolePollTick`. An armed register does 4 Hue GETs (20 s timeout) + console POST (15 s) + config GET **without sampling pins**. Double-click window = 400 ms → a poll splits the double into `off`+`on`.

Round moved recipe/ring/refresh to `hue_job` (meets input-during-hue for gestures). The **hourly poll** is still in the loop (`console.h`: if there are recipes, re-POST the snapshot). During that stretch touch does not run.

**Analyze together:** these are not two separate bugs. It's the same decision: does the periodic snapshot leave the input path, or do we accept a freeze of N seconds every hour?

**Status, Simple (2026-09-27, firmware 0.4.1):** the console half is closed: register, snapshot and config poll run in a FreeRTOS task, not the `loop`. Open: Hue actions still run in the `loop` (`channelFire` → `hueHttp`, 8 s timeout, a new TLS connection per call; toggle = GET + PUT). A double-click on one channel is **not** split, because the first event waits for the 400 ms window before any HTTP. The cost is across channels: while one call is in flight, other pins are not sampled, so a second switch waits, and with a slow or down Bridge a quick open/close on another toggle nets out and is lost. Fix: a Hue job queue like Round's `hue_job`, sized for the single-core C6.

### P9 — Scene cycle without a GET to the Bridge (Round)

**Severity:** Runtime · R7, R12

§8.1: truth = `status.active` on the Bridge; if one is active → next; if none → first. The worker does **not** GET. It cycles from `pagesLastSceneRid()` (last local PUT). A change in the Hue app desyncs the circle. A 404 `rid` in `targets[]` fails the whole gesture (the ring does skip 404s).

`recipeFindActiveScene` in `channels.h` does the GET, but the live path is `hue_job` and does not call it.

### P10 — Post-swipe toggle can turn off the new room (Round)

**Severity:** Runtime · R8

Optimistic ack: `gLightOn` starts `true` and survives the swipe. A tap before the background GET can PUT `off` to the new page's target. The split (two lights) treats unknown as off and sends **on**; the whole disc does not.

### P11 — Poll `group`/`dim` ignored if `rev` does not go up

**Severity:** Runtime · C4, R9

The Round config GET **rewrites** `group`/`dim` in Postgres (`persistPageGroupAndDim`) **without** bumping `rev`. That response's JSON already carries the new values; the firmware drops them if `localRev >= remote`. A `grouped_light` change in the snapshot never reaches NVS.

Also, if `dim` comes as `null`, the firmware **re-infers** the ring from recipes (`pagesFillDimFromRecipes`). Spec: the console computes `dim`; the device does not infer the room from a scene.

**Decide:** read-only poll + `rev` only on PUT, **or** bump `rev` when persisted group/dim change. Is the local fill deleted?

**Status (2026-09-27):** closed. The config GET bumps `rev` whenever `persistPageGroupAndDim` changes a page.

### P12 — Wi-Fi failure on Simple does not retry

**Status (2026-09-27):** closed. The Simple `loop` retries the stored network (`wifiRetryStored`).

**Severity:** Runtime · S5

`setup`: 60 × 250 ms, `return`. `loop` does not call `WiFi.begin`. Round does retry. The C6 does not register and does not show up in the console. GPIO primed; recipes skip "WiFi down".

### P13 — Timeout 1–9 s in the Round input

**Severity:** Runtime (UX) · C7

Contract: **0** or **10–600**. The HTML input is `min=0 max=600`. PUT 400 and the rest of the pages draft is **not saved**.

### P14 — `computeDim` ignores `caps`

**Severity:** Runtime (ring) · C18

Rule 4: nothing dimmable → `dim: null`. The code does not read `caps[]`. On/off-only lights still get `{ mode: "lights" }` or `group`; the firmware PUTs `dimming`.

### P15 — Unicode page name

**Severity:** Runtime (circle) · C13

Spec: ASCII, `Niños` → `Ninos`. The folding only runs when creating from the Hue name. Rename + PUT accept `"Niños"`. Web preview ≠ GC9A01.

---

## 3. Docs and fossils (will hurt an agent)

| Id | What | Risk |
| --- | --- | --- |
| P16 | `supabase/migrations/…_init.sql` is Auth+RLS+`channel_id NOT NULL`, without `pages`. Runtime = Neon `db/schema.sql` + `ensure-schema.ts` (C2) | Applying the fossil migration leaves a Postgres that **cannot** store Round or this auth |
| P17 | ~~`ensure-schema.ts` creates `switches` **without** the product/axis/timeout CHECKs that `schema.sql` has (C11)~~ Closed 2026-09-27: both carry them | Two different Postgres depending on `migrate` vs cold start |
| P18 | Dead columns `pages.dim_target_*` (C10). Spec: there is no `dimTarget` | Confuses migrations |
| P19 | Console README and home: "recipes per channel". Simple README: "one lamp", recipes "not yet", `CONSOLE_*` "when keys exist". `hue-lights.md` asks for `HUE_LIGHT_ID` (C9, S7, R4) | Onboarding to the old slice |
| P20 | web-setup: requirements in `docs/specs/finished/web-setup.md`. No UI, no Improv, no `.bin`. Real onboarding = `config.h` (C14, S6) | v1 closed without this, or a blocking slice? |
| P21 | ~~Simple JSON parser does not tolerate a space after `:` (S9)~~ Closed 2026-09-27: `json_util.h` skips whitespace after `:` | A pretty-print in the console leaves stale NVS |
| P22 | Dead Round code: synchronous `recipeFire` / `uiRefreshState` (R10) | Re-wiring freezes Ready again |

---

## 4. Console debt (not wire, but product)

- **C16** GET `/recipes` on Round returns `[]`; PUT is 400 `round_switch_uses_pages`.
- **C17** On `bridgeid` change, the axis/timeout/`page_seq` reset is computed and the `ON CONFLICT` **does not write it**.
- **C19** Simple double-click: definitions default `recall_scene`; clicking "Whole room" assigns `on`.
- **C24** Reordering pages/scenes: spec "drag or arrows"; UI arrows only.
- **C20** Zero tests. C6–C8, C12, C18 have no safety net.
- **C21** 500 `database_error` and 410 with `message` (not `details`) are not in the device-api table.

---

## 5. Closed decisions (2026-09-20, grilling)

Do not reopen in a slice. If someone disputes them, go back to the captain.

| # | Decision | What it implies |
| --- | --- | --- |
| 1 | `definiciones.md` (now `definitions.md`) is **rewritten to the real state**. It stays the product doc (Simple + Round). | Delete the false "Today" (ingest, Supabase, config.h Wi‑Fi only). Round details in `round-pages.md`. Wire in `device-api.md`. |
| 2 | The **state** of pages / idle / input-during-hue is owned by `docs/round-pages.md` (console). | Align `pages-requirements.md`, Round `AGENTS.md` (`c1` out), idle and input-during-hue to firmware 0.5.13. |
| 3 | `bridgeid` change: the console **bumps `rev`** when deleting **and** the firmware resets NVS. | Never `rev = 0` as a flag. Poll: remote > local replaces. Defense in depth. |
| 4 | Register with an empty snapshot / Hue down **does not overwrite**. Last **good** snapshot wins. | `rooms`/`scenes` omitted = 400. Clip stream ≠ 200 → do not replace the tree. |
| 5 | Wipe round→simple **only** with an explicit `product: "simple"`. Both firmwares **send `product`**. | Channel inference = old boards only. An odd channel does not delete pages. |
| 6 | `p1` without a group is **legal on register**. **Save** (human PUT) **requires a group**. | There is no product page "without a room". The XIAO's registration does not invent a group. |
| 7 | There is **no** pre-pages Round in the field. Only own boards, own flashing. | No `c1` dual-write. v1 = flash together with the console. C22 closed. |
| 8 | Snapshot / register **leave the loop** of GPIO and touch, on **both** products. | The 400 ms lever and the finger do not wait for a Hue GET or Vercel. |
| 9 | Scene cycle = **local cache** (last PUT / NVS), not GET `status.active`. | **Spec amendment**, not a bugfix. Change §8.1. See note. |
| 10 | The poll's `dim` is **sacred**. Delete `pagesFillDimFromRecipes`. | `dim: null` = no ring. A single §8.2 algorithm, in the console. |
| 11 | web-setup is **not** in this v1. Onboarding = Arduino + `config.h`. | `docs/specs/finished/web-setup.md` stays requirements. Not this slice. (Later superseded: web setup shipped.) |
| 12 | `supabase/` is **deleted or archived with DO NOT APPLY**. | Do not rewrite it for Neon. Runtime = `db/schema.sql` + `ensure-schema.ts`. |

### Note — question 9 / finding P9 (R7)

§8.1 currently says: truth = Bridge (`status.active`); if one is active → next; if none → first. The code caches the last PUT.

You chose **the code**. R7 **stops being product-broken**: the circle does not chase the Hue app. Cost: Relax on the phone, tap on the disc, may PUT the "next" one from the last local recall (one step behind, or not the first after an off in the app). A **local** off (double tap) already clears the rid and goes back to the first.

When rewriting `round-pages.md` §8.1: the active-scene GET is for **painting the name** (refresh), not for choosing the next `rid`. The cycle is NVS. A 404 `rid` in `targets[]` (R12) is still runtime: skip to the next, do not fail the gesture.

Still open (not asked): **P10 / R8** post-swipe toggle can turn off the new room.

---

## 6. Order of the next slice (no longer "decide")

Paper first, then runtime. The captain splits it among implementers; this is not a PR plan.

1. **Paper:** decisions 1–2, §8.1 amendment (decision 9), `supabase/` fossil (12), READMEs (P19). So the next agent does not reopen ingest or `c1`.
2. **Do not overwrite the Bridge:** P4 — parser + no empty POST. Console + Simple (+ Round if it shares the stream).
3. **Input out of HTTP:** decision 8, both firmwares. Simple: Wi-Fi retry (P12) in the same slice if it fits.
4. **Product wire:** `rev` (3), `product` (5), group on Save (6), delete dim fill (10), poll does not overwrite NVS without `rev` (P11).
5. **Minor circle:** R8 post-swipe toggle, P13 timeout 1–9, P14 caps, P15 ASCII.
6. **Out of this v1:** web-setup (decision 11).

---

## 6a. Open from the 2026-09-27 code review

Verified against `main` @ `34aaefdc`. Fixed in the same pass: 500s no longer return `err.message` (logged server-side instead), GitHub is no longer a trusted provider for account linking, and `CRON_SECRET` is compared in constant time.

| Item | Where | Why it matters |
| --- | --- | --- |
| `ensureSchema()` in the request path | Almost every route, device poll included | Each cold isolate runs ~70 statements sequentially over HTTP before answering. Migrate at deploy; make the request path a no-op. |
| Firmware upload is also publish | `uploadRelease` writes `firmware_current`; `POST …/current` takes the same CI token | A leaked CI token changes what `/setup` flashes. Promotion should need an admin session. |
| Limit checks are count-then-insert | `registerLimitHit`, key creation | Parallel requests can pass a cap. Low impact. |
| New MAC with no `product` is inferred Round | `upsertSwitch` / `inferProduct` | See P5. Require `product` on a first register once both firmwares send it. |
| `setLimits` accepts any keys | `lib/admin.ts` | Only `limitsAction` filters them. |
| 500 `database_error` and 410 `message` not in `docs/device-api.md` | C21 | Contract table is incomplete. |
| Simple saves `rev` before the recipes | `hue-simple-switch` `recipes.h` `recipesSave` | If the `jsonb` write fails (NVS full) or power drops between the writes, NVS holds the new `rev` with the old recipes. After a reboot the switch reports the new `rev`, the console answers 204, and it runs the old config until the next change. Fix: write `jsonb` and `bid` first, `rev` last and only if `jsonb` saved. Firmware-only; needs a `FIRMWARE_VERSION` bump. |

---

## 7. ID map (implementer → this doc)

| Here | From |
| --- | --- |
| P1 | C1, R5, S8 |
| P2 | R1–R4, R6 |
| P3 | C5 |
| P4 | C8, S2, S3 |
| P5 | C6, C23, S1 |
| P6 | C12 |
| P7 | C22 |
| P8 | S4, R11 |
| P9 | R7, R12 |
| P10 | R8 |
| P11 | C4, R9 |
| P12 | S5 |
| P13 | C7 |
| P14 | C18 |
| P15 | C13 |
| P16–P22 | C2, C11, C10, C9/S7/R4, C14/S6, S9, R10 |
