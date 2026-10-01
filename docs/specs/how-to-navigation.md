# How-to navigation: switch, then topic, then build type

Console-only spec. No device endpoint, payload, NVS key or installer changes. Process: `AGENTS.md`.

**Status:** approved (2026-09-30), not started

Prototype (real 3D renders and guide content, navigation only): https://claude.ai/artifact/7Y33Hzv9HivHxeA8eXtenP

## 1. What and why

Today `/how-to` shows a small product picker, an "On this page" list and all four sections (Build, Set up, Everyday tasks, Reading the screen/LED) in one long scroll. Build is folded behind "Show the build guide". Most readers arrive with one question, such as what a blink means or how to add a page. Afterwards they pick their switch, then the thing they want to do, and see only that. Simple builders pick their build type as a third step.

## 2. Behavior

### 2.1 Three tiers of choice

1. **Switch.** Two large cards side by side, Round and Simple, each with a dedicated render of its board (§2.7). Every visit to bare `/how-to` starts here with nothing chosen and nothing else below the cards.
2. **Topic.** Once a switch is chosen, the cards shrink to a compact row (small render + name + blurb, selected one outlined) and four topic buttons appear under them, as wide in total as the cards:
   - Round: **Build it** · **Set up** · **Everyday tasks** · **Reading the screen**
   - Simple: **Build it** · **Set up** · **Everyday tasks** · **Reading the LED**

   Each button carries a short second line (e.g. "Firmware, Wi-Fi, Bridge"). One row of four on desktop, 2 × 2 under 600 px. They look like tabs, not cards, so the three tiers read as navigation, not three wizards.
3. **Build type** (Simple + Build it only). Today's three level cards (A Try it, B Button box on USB-C, C In the wall) appear under the topics. Default B, as today. Round's Build it shows its guide directly.

   **Design status chips** (`docs/specs/terms-and-safety.md` §2.5): each Simple level card carries its build's status chip next to its name, and Round's chip sits next to its build heading. The chips also stay on the install sections, as that spec says. Whichever of the two specs ships second puts the chips in these places.

Until a topic is chosen, the area under the topics shows one muted line: "Pick what you want to do." Switching product keeps the topic, so a reader can compare the two switches on the same topic. The Simple level resets to B when it no longer applies.

### 2.2 Content

Only the chosen topic renders, with today's section components unchanged inside it (`BuildSection` without its show/hide button, `SetupSection`, `TasksSection`, `StatusSection`). The "On this page" sidebar goes away.

Each topic that leads somewhere ends with a link to the next one, so a first-time builder still has a path:

- Build (Round, Simple C) → "Next: Set up"
- Build (Simple A, B) → "Next: Everyday tasks". A and B already include setup as their first steps; today's "Built? Set it up next" link is replaced.
- Set up → "Next: Everyday tasks"

The link selects the topic and scrolls back to the topic row.

### 2.3 URL and search

Every choice is in the query string, rendered on the server:

`/how-to?product=simple&topic=build&level=box`

- `product`: `round` | `simple`. `topic`: `build` | `setup` | `tasks` | `status`. `level`: `try` | `box` | `wall` (Simple build only).
- Choices update the URL with `router.replace`-style history: one entry per topic change, so Back returns to the previous topic. Level changes replace the entry.
- The server renders the chosen topic's content, so every topic URL is a full page for search. Canonical is the URL with its `product` and `topic` (and `level`). `sitemap.ts` lists all 2 × 4 topic URLs plus the three Simple levels.
- Metadata description per product and topic.

### 2.4 No remembered switch

Everyone starts on the big cards. The page stops reading and writing the stored choice (`hsw-howto-product`, `HOWTO_PRODUCT_KEY` in `lib/how-to.ts`) and the client-side switch that followed it. The server-rendered page and the first client frame are then always the same, which also removes today's one-frame flash of Round for Simple readers. A URL with `?product=` (and `topic`, `level`) opens directly on that choice.

### 2.5 Old links

These must keep landing in the right place:

| Old link | New target |
| --- | --- |
| `/how-to?product=X` | `product=X`, no topic |
| `#setup` | `topic=setup` |
| `#tasks` | `topic=tasks` |
| `#status`, `#round`, `#simple`, `#status-<key>` | `topic=status` (product from `#round`/`#simple`; `#status-<key>` selects that state) |
| `#build`, `#buy`, `#assemble` | `topic=build`, scrolled to the anchor |
| `#try`, `#wire`, `#in-wall`, `#install` | `product=simple&topic=build&level=` the anchor's level, scrolled to the anchor |

The hash is only seen in the browser, so the client rewrites the URL to the new form on load (replace, no new history entry) and then scrolls. In-app links that point into the guide (switch editors, `/setup`, workspace, landing) change to the new query form in the same commit.

### 2.6 Small screens

At 375 px: product cards side by side (large: render on top, name and blurb under it; compact after a choice: 64 px render + name only). Topics 2 × 2. Levels stacked. No horizontal scroll.

### 2.7 Product card pictures

**v1: the existing build-guide stills.** Round uses `round-done` (the assembled Round on its cable), Simple uses `simple-led` (the XIAO on its cable with the LED lit), rendered without their callout overlay.

- Simple is zoomed in on the board: the crop keeps the lower ~70 % of the drawing and trims the top of the cable. Its LED shows the working state (short flash every 3 s, the `led-heart` timing in `app/globals.css`), using only the glow from the scene's overlay. With reduced motion it stays lit.
- Each still is cropped to its drawn bounds, since the scenes leave margin for callouts, and drawn with `object-fit: contain` in a fixed 16 : 10 picture box with the same inner padding on both cards. The two pictures then come out the same size, and the line between picture and text sits at the same height on both cards.
- Rendered once per theme, client-side, like the other stills (`renderOnce` in `app/how-to/illo/illo.tsx`), with a text-only fallback when WebGL is missing.
- Same loading behavior as the guide pictures since `355febc`: the 16 : 10 box is there from the first paint, empty (no "Drawing…"), and the picture fades in over 150 ms (no fade with reduced motion). The fixed box means the cards never change height, and the crop doesn't need an entry in `app/how-to/illo/heights.ts`.

**Later: dedicated renders**, done as a separate change once v1 ships. Same line style as the landing's Simple board drawing (`app/landing/simple-render.ts`, iso camera), monochrome with no callouts or tone colours. Simple shows the XIAO ESP32-C6 with its pin headers. Round shows the Round Display on the XIAO ESP32-S3 at a matching angle, with the display off. They fill the same box, so the layout doesn't change.

## 3. Compatibility

- No device or firmware impact.
- `docs/specs/terms-and-safety.md` (draft) also changes `/how-to`: status chips, the expanded mains box, the "test, don't trust colors" step, the illustration caption and the low-voltage line. Apart from the chips (§2.1), all of that lives inside the Build content, which this spec doesn't change, so either spec can ship first.
- Old URLs are redirected client-side as in §2.5. Search engines see the `?product=` canonicals today, and those keep working.

## 4. Checklist

### Console (`hue-switch-console`)

- [x] User approves this spec and the prototype
- [ ] Design status chips on the level cards and Round's build heading, if `terms-and-safety.md` has shipped (§2.1)
- [ ] Product card pictures (§2.7 v1): `round-done` / `simple-led` cropped into the same box, dividers aligned, Simple zoomed with its LED on the heartbeat
- [ ] Later, separate change: dedicated monochrome renders, Round display off (§2.7)
- [ ] Stored-switch logic removed (§2.4)
- [ ] `HowToGuide`: three tiers, compact cards after a choice, topic row, Simple level row moved up from `BuildSection`
- [ ] Query-string state, server-rendered topic, per-topic metadata and canonical, sitemap entries
- [ ] Old-hash rewrite (§2.5) and in-app links updated
- [ ] "Next" links at the end of Build and Set up
- [ ] `docs/specs/finished/public-how-to-changelog.md` D3 and `how-to-guide.md` notes updated, or point to this spec
- [ ] Checked on production at desktop and phone width, light and dark (Playwright on localhost is not used for this page's checks per `AGENTS.md`; `/how-to` is public, so production is the check)

## 5. Decisions

1. **Product card pictures** (2026-09-30): start with the build-guide stills `round-done` and `simple-led`, scaled to the same size with the card dividers aligned. Dedicated monochrome renders (Round display off) come later (§2.7).
2. **Start screen** (2026-09-30): big cards for everyone, nothing preselected (§2.4).

## 6. Open questions

None.
