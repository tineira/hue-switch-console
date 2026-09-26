# How-to guide v2

Console-only spec. Process: `AGENTS.md` → "Cross-repo changes" (only the spec and console steps apply).

**Status:** done. Pushed to production; the open questions are answered (§9).

Design reference: `hue-switch-console/docs/specs/design_handoff_lights_map/How-to Guide.dc.html` (Claude Design handoff, Ember theme; committed under the Lights handoff's folder name). The design is the reference for layout, copy and behaviour. Colours in it are Ember literals: the code uses theme tokens (§6).

## 1. What and why

Today `/how-to` is a single page with three parts: a 4-step guide whose steps hold up to 7 long bullets, then two catalogues of LED and screen states. Round and Simple content is interleaved throughout, so a user with one product reads both. Setup, configuration and reference text sit in the same bullets. The state catalogues aren't tied to the steps, even though the board walks through those states in the same order as setup.

Afterwards, a user:

- **Picks their switch once** (Round or Simple) and sees only what applies to it.
- **Sets up a board step by step.** Each step says what to do and shows what the switch displays when the step is done (the LED pattern or Round screen), so the board itself confirms progress.
- **Finds everyday tasks** (change what a button does, update, re-pair, revoke a key) as short, separate items instead of bullets inside the setup guide.
- **Diagnoses by what they see.** They pick the pattern or screen that matches their board from a grid, and get what it means, what to do and a link.

## 2. Contract change

None. No device endpoint, payload, NVS key or installer change. Page copy only.

## 3. Compatibility

- No data or schema change. `/how-to` stays at the same URL.
- Anchors: the old `#console`, `#simple` and `#round` are replaced by `#setup`, `#tasks` and `#status`. Grep the repo for links to the old anchors and update them. If any exist outside the console, keep `#simple` / `#round` as aliases that select the product and scroll to `#status`.
- Blink timings and ring colours keep mirroring `led.h` (hue-simple-switch) and `ui.h` (hue-round-switch). The `.led-*` and `.round-face-*` CSS in `app/globals.css` is reused unchanged.

## 4. Page structure

Inside `Shell` (unchanged), top to bottom:

1. **Header.** `h1` "How-to". Intro (text-sm muted): "Set up a switch, change what it does, and read what it's telling you. Pick your switch and the guide shows only what applies to it."
2. **Product picker.** Two cards, side by side and wrapping on narrow screens. Styled like the theme picker's swatch cards: selected = `border-filament` + `shadow-[0_0_0_1px_var(--filament)]`.
   - **Round switch**: "Round touch screen · XIAO ESP32-S3", with a small Ready face.
   - **Simple switch**: "Wall buttons, one orange LED · XIAO ESP32-C6", with the heartbeat LED.
   - A `role="radiogroup"` with `role="radio"` / `aria-checked` on each card.
3. **Body.** Two columns at `lg` and one below:
   - a sticky "On this page" list: 1 Set up a switch · 2 Everyday tasks · 3 Reading the screen / Reading the LED;
   - the content column, `max-w-2xl`, with sections spaced about `gap-14`.

### 4.1 Set up (`#setup`)

- `h2` "Set up a Round switch" / "Set up a Simple switch". Intro: "About five minutes, once per board. After each step the switch itself shows what it needs next, so you always know where you are."
- **"You need" chips:** The switch · A USB-C data cable · Chrome or Edge · The Hue Bridge on the same network.
- **Stepper.** A numbered circle (same style as today's `GuideStep` number), a vertical line to the next step, and a card per step:
  - title, and an optional `text-xs` link to the page where the step happens;
  - body, with UI labels in `font-medium text-foreground`;
  - an optional note, text-xs muted above a top border;
  - a **"Then it shows"** panel on the right that wraps under the text when narrow: the LED or face at about 64 px, plus a one-line caption.

| # | Title | Link | Round shows | Simple shows |
|---|---|---|---|---|
| 1 | Plug it in | Open Setup | — | — |
| 2 | Install the firmware | Setup | `No Wi-Fi` face: "No Wi-Fi. Expected: none saved yet." | `fast`: "Fast blink: no Wi-Fi yet" |
| 3 | Save Wi-Fi | Setup | `loading`: "Loading…, then Press Bridge button" | `burst-2`: "Two blinks: needs the console" |
| 4 | Link it to this console | Setup | `pairing`: "Press Bridge button: it waits until step 5" | `burst-3`: "Three blinks: needs pairing" |
| 5 | Approve it on the Hue Bridge | — | `empty`: "Blank disc: needs a page" | `burst-4`: "Four blinks: needs a recipe" |
| 6 | Give it a page / Give its buttons a job | Open Switches | `ready`: "Ready" | `heart`: "Ready" |

- Product differences:
  - step 2 on Simple: "Hold **BOOT** on the board while you click **Install**…";
  - step 3 on Round has the antenna note;
  - step 6 copy differs per product (see the design).
- Step 4 note: the amber recheck ("every 10 seconds, up to three times, then offers **Check again**").
- Step 5 note: "Missed it? Click **Pair with Bridge** on Setup, or hold **BOOT** on the board for about 3 seconds."
- **Done row.** An `ok-soft` card with an `ok/40` border and a check icon. Title: "Unplug it and mount it." Body: "Setup's card turns green and says **This board is set up**. Later changes reach the switch within an hour, or right away if you unplug it and plug it back in."

### 4.2 Everyday tasks (`#tasks`)

- `h2` "Everyday tasks". Intro: "Once it's set up, this is what you'll come back for."
- One bordered `bg-cream` list with divided rows. Each row is a `<button aria-expanded>` with the title and a chevron that turns 180° when open. The body is a short numbered list.
- One item open at a time. The first is open on load, and clicking an open item closes it.

Items, in order:

1. **Change what a page does** (Round) / **Change what a button does** (Simple). This takes over today's step 2 detail: Toggle switch and Push button behaviour, Change, up to 8 scenes, Save pages / Save channels.
2. **Name a page, pick its theme, set the screen** (Round) / **Use the BOOT button** (Simple).
3. Make a change apply right away (check-in within an hour, unplug to apply now, Save all).
4. Update the firmware (Update to → Detect device → Update; settings are kept).
5. Pair with the Bridge again.
6. Rename a switch.
7. Let Arduino IDE use the USB port (Disconnect).
8. Retire a lost or given-away board (API keys, Not in use).

Every fact on today's page must land somewhere in §4.1 or §4.2. Check this against the current `page.tsx` before deleting it.

### 4.3 Reading the screen / LED (`#status`)

- `h2` "Reading the screen" (Round) / "Reading the LED" (Simple).
- Intros:
  - Round: "Match the Round's screen to one below. Colours on your Round follow its page theme."
  - Simple: "Match the orange LED on the XIAO to one below. The red charge LED, BOOT and RESET aren't part of this list."
- **Two tile groups.** Group labels use the theme picker's style: 10px, uppercase, `tracking-[0.14em]`, muted.
  - **Setting up, in order.** Setup states, then Ready.
  - **Something's wrong.** Problems.
- **Tiles.** A `repeat(auto-fill,minmax(124px,1fr))` grid. Each tile is a button: the visual in a 72 px box, the state name, and a tag ("Setting up" muted / "All good" ok / "Problem" danger). Selected uses the same filament border and ring as the product picker. `aria-pressed`.
- **Detail panel** below the grids, `aria-live="polite"`:
  - the visual at about 112 px (LED about 22 px) on a `bg-background` square;
  - the state name (16px semibold, `text-ok` for Ready, `text-danger` for problems);
  - the "see" line in text-xs muted, and what it means;
  - if there's a fix: "What to do: …" and, with a link, a primary button ("Open Setup" / "Open Switches").
- **Default selection:** the first problem, because people usually arrive here when something is wrong.

States. Copy comes from today's `SIMPLE_STEPS`, `roundSteps()` and `ErrorCard`s, trimmed as in the design:

- **Round, setting up:** Joining Wi-Fi (`wait`, with `currentVersion("round")`) · Finding the Bridge · Needs pairing · Needs a page · Ready.
- **Round, problems:** No Wi-Fi · Bridge not reachable · Command failed (flash) · Token rejected (red dot) · Token rejected, nothing saved (full screen).
- **Simple, setting up:** No Wi-Fi (`fast`) · Needs the console · Needs pairing · Needs a recipe · Ready (`heart`).
- **Simple, problems:** Error (`solid`).

## 5. Behaviour

- **Product choice:** saved in `localStorage` under `hsw-howto-product`, like `hsw-theme`. The default is `round`. It is not derived from the switches in the account (decided). Switching product resets the task list to its first item and the status selection to its default.
- **Hydration:** render `round` on the server. Read the stored value in an effect, and accept a brief switch on first paint. Alternatively, set a `data-howto-product` attribute in the existing `themeBoot` script and hide the other product with CSS. The implementer picks one and notes it here.
  - **Picked:** the first. The server renders `round` (or the `?product=` value). Without `?product=`, the client reads the stored choice through `useSyncExternalStore`, so a Simple reader may see Round for one frame.
- **Deep link:** `?product=simple` overrides the stored value (without saving it). Setup and Switches link to `/how-to?product=<product>#status`. Old `#round` / `#simple` anchors still select that product and scroll to `#status`.
- **Reduced motion:** covered by the existing `prefers-reduced-motion` rules for `.led` and `.round-face`.
- **Mobile:** the product cards stack, the "On this page" list sits above the content and is not sticky, and "Then it shows" wraps under the step text.

## 6. Implementation notes

- `app/how-to/page.tsx` stays a server component: `requireSessionUser()`, `currentVersion("round")`, `<Shell>`. It renders `<HowToGuide version={…} />`.
- New `app/how-to/how-to-guide.tsx` (`"use client"`): the product state, task list state and status selection.
- New `lib/how-to.ts`: the step, task and status arrays per product, typed. Keep the comments saying the timings mirror `led.h` / `ui.h`. Bold labels can be `ReactNode` or a small `**label**` parser. Either works; keep it simple.
- Reuse the existing `Led`, `Face`, `FaceText`, `FaceEmpty` and `FaceReady` helpers, moved into `app/how-to/visuals.tsx`. They need a size variant: tiles about 64 px, the panel about 112 px. Scale with a `--k` custom property, the same way `.round-dial` does, rather than new classes per size.
- **Theme tokens only:** `bg-cream`, `border-line`, `text-muted`, `text-filament`, `bg-filament-soft`, `bg-filament`, `text-filament-ink`, `ok`, `danger`, and so on. Check at least Ember, Paper, Snow and Matrix, which uses the mono font.
- Delete `GuideStep`, `StateCard` and `ErrorCard` once their content has moved.

## 7. Checklist

### Console (`hue-switch-console`)

- [x] `lib/how-to.ts` data; every fact from the old page accounted for (§4.2)
- [x] `app/how-to/visuals.tsx` with size scaling
- [x] `app/how-to/how-to-guide.tsx`: picker, stepper, tasks, status grid and panel
- [x] Anchors updated; links to the old anchors fixed (§3)
- [x] Checked on Ember, Paper, Snow, Matrix, desktop and phone (a static render of the component was checked on Ember, Paper, Snow and Matrix at 1100 px and 390 px; the user checks production)
- [x] `npm run build` and `npm run lint` pass (apart from the existing `theme-picker.tsx` error)
- [x] `docs/changelog.md` console entry
- [x] Deployed (pushed to `main` on 2026-09-26); the user checks production (per `AGENTS.md`, not with local Playwright)

### Cleanup

- [x] Move this spec to `docs/specs/finished/`

## 8. Decisions

1. **Product default:** a stored choice with `round` as the default. It is not inferred from the account's switches.
2. **One page, filtered.** Not separate `/how-to/round` and `/how-to/simple` routes.

## 9. Open questions

All three are closed. Answers 1 and 2 come from reading the firmware trees; 3 is a copy decision.

1. **CLOSED: Round setup order (§4.1, steps 3–4).** The design's order was wrong.
   - In `hue-round-switch`, the Hue link starts as soon as Wi-Fi is up. It doesn't wait for the console link. `applyScreen()` shows `Loading… / Connecting` while the link is starting (`LINK_START`). `hueLinkSetupStep()` then finds the Bridge and, with no key saved, goes to `LINK_PAIRING` (`Press Bridge button`). Pairing never times out.
   - The Round has no "needs console" screen. `UiScreen` has none, and nothing on the screen depends on the console link apart from the token states.
   - Change: step 3's caption is now "Loading…, then Press Bridge button" and step 4's is "Press Bridge button: it waits until step 5" (`setupSteps()` in `lib/how-to.ts`). `ROUND_STATUS` needed no new screen.
2. **CLOSED: Simple step 2.** The assumption holds.
   - In `hue-simple-switch` `led.h`, `ledComputeRung()` returns rung 1 (`fast`) whenever the station isn't connected. After that come rung 2 (needs the console), 3 (needs pairing), 4 (no recipes) and 5 (heartbeat), the same order as steps 3–6. Only a console failure or a rejected token (rung 6, `solid`) comes first.
   - No change.
3. **CLOSED: "Set a new one in Devices"** on the Round's Token rejected screen.
   - Decision: the drawing follows the firmware's text, because the guide shows what the board really shows.
   - Round 0.5.30 renamed the text on the board to "Set a new one in Setup". Every registered switch runs it, so `faceParts()` in `app/how-to/visuals.tsx` now draws the new text, and the tile's fix line no longer explains the old name.

## 10. Implementation notes

- §3 said the `.led` and `.round-face` CSS is reused unchanged. It now sizes by `--k` (default 1, so every value at the default size is unchanged), as §6 asks. Colours and timings are untouched.
