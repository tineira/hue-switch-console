# How-to navigation: switch, then topic, then build type

Console-only spec. No device endpoint, payload, NVS key or installer changes. Process: `AGENTS.md`.

**Status:** draft

Prototype (real 3D renders and guide content, navigation only): https://claude.ai/artifact/7Y33Hzv9HivHxeA8eXtenP

## 1. What and why

Today `/how-to` shows a small product picker, an "On this page" list and all four sections (Build, Set up, Everyday tasks, Reading the screen/LED) in one long scroll. Build is folded behind "Show the build guide". Most readers arrive with one question, such as what a blink means or how to add a page. Afterwards they pick their switch, then the thing they want to do, and see only that. Simple builders pick their build type as a third step.

## 2. Behavior

### 2.1 Three tiers of choice

1. **Switch.** Two large cards side by side, Round and Simple, each with a render from the 3D board models (`app/how-to/illo`, same style as the build guide; see the memory on illustrations). Before a switch is chosen, nothing else shows below the cards.
2. **Topic.** Once a switch is chosen, the cards shrink to a compact row (small render + name + blurb, selected one outlined) and four topic buttons appear under them, as wide in total as the cards:
   - Round: **Build it** · **Set up** · **Everyday tasks** · **Reading the screen**
   - Simple: **Build it** · **Set up** · **Everyday tasks** · **Reading the LED**

   Each button carries a short second line (e.g. "Firmware, Wi-Fi, Bridge"). One row of four on desktop, 2 × 2 under 600 px. They look like tabs, not cards, so the three tiers read as navigation, not three wizards.
3. **Build type** (Simple + Build it only). Today's three level cards (A Try it, B Button box on USB-C, C In the wall) appear under the topics. Default B, as today. Round's Build it shows its guide directly.

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

### 2.4 Remembered switch

The page keeps storing the last chosen switch (`hsw-howto-product`). A visit to bare `/how-to`:

- First visit (nothing stored): the two large cards, nothing chosen.
- Returning visitor: their switch preselected (compact cards and topic row shown), no topic chosen.

A `?product=` in the URL wins over the stored choice, as today.

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

At 375 px: product cards side by side (large: render on top, name and blurb under it; compact: 64 px render + name only). Topics 2 × 2. Levels stacked. No horizontal scroll.

## 3. Compatibility

- No device or firmware impact.
- Old URLs are redirected client-side as in §2.5. Search engines see the `?product=` canonicals today, and those keep working.

## 4. Checklist

### Console (`hue-switch-console`)

- [ ] User approves this spec and the prototype
- [ ] Product card renders: one scene per product added to `app/how-to/illo/scenes.ts` (or reuse `round-done` / `simple-led`, as the prototype does)
- [ ] `HowToGuide`: three tiers, compact cards after a choice, topic row, Simple level row moved up from `BuildSection`
- [ ] Query-string state, server-rendered topic, per-topic metadata and canonical, sitemap entries
- [ ] Old-hash rewrite (§2.5) and in-app links updated
- [ ] "Next" links at the end of Build and Set up
- [ ] `docs/specs/finished/public-how-to-changelog.md` D3 and `how-to-guide.md` notes updated, or point to this spec
- [ ] Checked on production at desktop and phone width, light and dark (Playwright on localhost is not used for this page's checks per `AGENTS.md`; `/how-to` is public, so production is the check)

## 5. Open questions

1. **Product card pictures.** The prototype uses the existing `round-done` (assembled Round on its cable) and `simple-led` (XIAO with the LED lit). *Recommendation:* keep them for v1. Make dedicated hero scenes (no cable, three-quarter view) only if the cards look busy at full size.
2. **Big cards for a returning visitor.** Recommended: returning visitors get the compact cards with their switch selected (§2.4). The alternative is always starting with the big cards and nothing selected, which costs a click but makes the start screen identical for everyone.
