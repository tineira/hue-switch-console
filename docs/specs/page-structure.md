# Page structure: Switches, Lights, Setup

Console-only spec. Process: `AGENTS.md` → "Cross-repo changes" (only the spec and console steps apply).

**Status:** approved

## 1. What and why

The nav is named after the Bridge and after "Devices", but that's not what the user works with. **Bridge** is really the switch editor, and it almost always redirects to the only Bridge. **Devices** is a USB workbench (flash, Wi-Fi, token, pair), not a list of your devices. Since Bridge page v2, the console also has no view of the Bridge's lights, rooms, zones and scenes, and it has never had a way to answer "what controls this light?".

Afterwards the user has three places, each named after what they work with:

- **Switches**: every switch on the Bridge with its health (last seen, firmware, update available, stale targets). Each switch has its own page, the current v2 editor.
- **Lights**: read-only topology of the Bridge and which switch gestures act on each room, zone and light. **The layout is pending a Claude Design handoff (§8).** This spec only reserves its place.
- **Setup**: the current Devices USB flow, renamed. It is reachable from the nav and from wherever a switch needs it (add a switch, update firmware).

The Bridge stays the configuration context (`docs/definitions.md`, "Per Bridge"). It no longer names a page.

## 2. Contract change

None. No device endpoint, payload, NVS key or installer change. The firmware repos do not link to console pages. `hue-round-switch/AGENTS.md` mentions `/install`, which keeps redirecting (§3), so no firmware session is needed.

## 3. Route map

| Route | Today | After |
| --- | --- | --- |
| `/` | Bridge list; redirects to the only Bridge | Bridge picker (≥ 2 Bridges) or the "No Bridge yet" empty state (0). With one Bridge, redirects to `/bridges/[bridgeid]/switches`. |
| `/switches` | — | New. Redirect: 1 Bridge → `/bridges/[id]/switches`; otherwise `/`. |
| `/lights` | — | New in phase 2 (§8). Same redirect rule, to `/bridges/[id]/lights`. |
| `/bridges/[bridgeid]` | Editor (`?mac=` selects a switch) | Redirect: with `?mac=` to `/bridges/[id]/switches/[mac]`, otherwise to `/bridges/[id]/switches`. |
| `/bridges/[bridgeid]/switches` | — | **Switches overview** (§5). |
| `/bridges/[bridgeid]/switches/[mac]` | — | **Switch page**: the current v2 editor, opened on that switch (§6). |
| `/bridges/[bridgeid]/lights` | — | **Lights** (§8), phase 2. |
| `/setup` | — | **Setup**: the current `/devices` page, moved (§7). |
| `/devices` | USB flow | `permanentRedirect` to `/setup`, keeping the query string. |
| `/install` | Redirect to `/devices` | `permanentRedirect` to `/setup`. |
| `/how-to`, `/keys`, `/changelog` | — | Unchanged, apart from link and copy updates (§9). |

`[mac]` is the stored form: 12 lowercase hex characters, no separators (`switches.mac`). A MAC with separators or uppercase letters redirects to the canonical form. An unknown MAC, or one registered to a different Bridge, shows "Switch not found on this Bridge" with a link to the overview. If the switch is on another Bridge of the same account, it redirects there.

## 4. Nav and Bridge context

**Top nav** (`app/nav-links.tsx`): **Switches · Lights · Setup · How-to**. Lights appears in phase 2. API keys, Changelog, and later Account and Admin (`docs/specs/multi-user-accounts.md`) stay in the account menu.

- Inside `/bridges/[bridgeid]/…`, Switches and Lights link to the same Bridge's pages. Anywhere else they link to `/switches` and `/lights`, which redirect (§3).
- Active state: Switches is active on `/switches` and `/bridges/*/switches*`, Lights on `/lights` and `/bridges/*/lights`, and Setup on `/setup`.
- The "Hue switch console" wordmark links to `/`, as today (which redirects when there's one Bridge).

**Bridge layout.** New `app/bridges/[bridgeid]/layout.tsx`:
- It loads the session user and the Bridge row once, and renders `Shell wide`.
- If the Bridge is missing it shows today's "Bridge not found" block, for every child route.
- The children render their own `h1` ("Switches", "Lights", or the switch name). Under the `h1`, both overview pages show a **context line** (text-sm muted):

  `Bridge C42996FFFECA6703 · 192.168.1.20 · 44 lights · 10 rooms · 9 zones · 123 scenes · snapshot 5 min ago`

  The bridge id and IP are mono. **Fix:** today's header counts zones as rooms ("19 rooms"). Count them separately. With two or more Bridges in the account, the line ends with a `Change Bridge` link to `/`.

**Bridge picker** (`/` with ≥ 2 Bridges): today's list. The heading stays "Bridges" and the card button changes from "Open workspace" to "Open". The empty state ("No Bridge yet") links to **Setup** instead of Devices.

## 5. Switches overview (`/bridges/[bridgeid]/switches`)

**Header:**
- `h1` "Switches" and the Bridge context line (§4).
- On the right, a primary button **Add a switch**, linking to `/setup`.

**One card per switch** on this Bridge, oldest first (`created_at`). The same order applies to the tabs on a switch page; until now they were sorted by last seen, so they moved around as boards checked in. The whole card links to the switch page. Each card contains:

- **Title row:**
  - the name (or formatted MAC)
  - the product pill (`Round` / `Simple`)
  - `Update to x.y.z` (filament outline pill) when a newer release is uploaded for the product. It links to `/setup?mac=<mac>`.
- **Meta line** (text-xs muted): `AA:BB:CC:DD:EE:FF · firmware 0.4.0 · rev 6 · seen 12 min ago`. `seen` reads `never seen` when `last_seen_at` is null.
- **Summary** (text-sm), one line per page or channel in use, from the same summary helpers the editor uses (`lib/gestures.ts` `summarizeGesture` / `describeTarget`, `lib/pages.ts`, `lib/simple-channels.ts`):
  - Round: `Veladores · Tap toggles Velador Tomás 1.A · Double tap toggles Velador Camby 1.A`. After 3 pages, `+3 more pages`.
  - Simple: `BOOT · Veladores dormitorio principal · Click toggles Velador Tomás 1.A`. Unused channels collapse into one muted line: `D0, D1, D2 not used`.
  - Nothing configured: muted `Nothing set up yet.`
- **Warnings** (text-xs warn), shown only when they apply:
  - `N gestures point at lights or scenes no longer on the Bridge.`: the stale count the editor already computes.
  - `Not seen for N h.`, when `last_seen_at` is older than 3 h. Boards with recipes poll hourly (`definitions.md`, Polling), so 3 missed polls means something is wrong.
  - `Firmware too old to edit channels. Update it.`: Simple below `supportsChannelTypes`.

**Empty states:**
- No switch on this Bridge: today's dashed block. Copy: "No switches on this Bridge. Set up a board on **Setup**. It shows up here once it pairs with this Bridge."
- Topology empty: today's "No lights yet" block, above the cards.

The overview has no drafts and no save bar. It is read-only.

## 6. Switch page (`/bridges/[bridgeid]/switches/[mac]`)

The current v2 workspace (`app/bridges/[bridgeid]/workspace.tsx` and the editors), moved to this route and otherwise unchanged. Specifically:

- **Tabs stay.** The switch tabs row above the card stays, because drafts on several switches and **Save all** depend on one mounted workspace.
  - Clicking a tab calls `window.history.pushState(null, "", "/bridges/<id>/switches/<mac>")`. That doesn't remount anything, so drafts survive (Next docs: `01-app/01-getting-started/04-linking-and-navigating.md`, "Native History API").
  - The selected switch is **derived from `usePathname()`**, so Back and Forward move between switches.
  - `selectBoard` keeps its current side effects (closing open gestures and so on) and runs when the pathname's MAC changes.
- **Above the tabs:** a back link `← Switches` (text-sm filament) to the overview. There is no `h1` "Bridge" and no context line here. The page's `h1` is the card title, which already shows the switch name, product, Saved/Unsaved and the update pill. Promote that `h2` to `h1` (same visual size as today). The document `<title>` is the switch name.
- **Update link.** `Update to x.y.z` links to `/setup?mac=<mac>` instead of `/devices`.
- **Copy.** "…from Devices" becomes "…from Setup" (the BOOT hold warning in `simple-channels-editor.tsx`, and the empty-state text).
- **Unsaved drafts.** While any switch is dirty:
  - A `beforeunload` listener makes a reload or tab close ask first.
  - Every in-app link that leaves the switch page (nav, wordmark, `← Switches`, Update → Setup, how-to links) asks first with a `window.confirm`: "Unsaved changes on {names}. Leave without saving?". Cancel stays on the page, OK navigates.
  - Tab switches between switches do not ask, because they keep the drafts.
  - Implementation: a capture-phase click listener on `document`, registered by the workspace. It checks `<a>` elements whose pathname is not `/bridges/<id>/switches/*`, so the nav in `Shell` needs no changes.
- **Data loading and where the editor mounts.** Every switch of the Bridge is loaded with its channels, pages and recipes, as before, by a shared server loader (`lib/bridge-switches.ts`) that the overview uses too.
  - The editor is rendered by `app/bridges/[bridgeid]/switches/layout.tsx`, not by `[mac]/page.tsx`. A layout stays mounted when the MAC in the URL changes, but a page is keyed by its param. That keeps drafts through tab switches and through the `router.refresh()` after a save, which Back needs to avoid showing pre-save data.
  - `[mac]/page.tsx` only canonicalises the MAC, follows a switch to its Bridge, or says it is not found.
  - With a single switch, the tabs row is hidden.

## 7. Setup (`/setup`)

The current `app/devices/` moves to `app/setup/`. `DevicesPanel` keeps its behavior (`docs/specs/finished/devices.md` stays the reference for the flow). Changes:

- **Name.** Nav label "Setup". `h1` "Setup". Intro: "Plug a switch into this computer over USB to install or update firmware, save Wi-Fi, and link it to this console. Use Chrome or Edge." `<title>` "Setup".
- **`?mac=<mac>` (optional).** When the account has that switch, show a line above Detect: "Updating **{name}**. Plug it in over USB and press Detect." After Detect, if the board reports a different MAC, add a warn line: "This is {other name or MAC}, not {name}." It only informs and never blocks.
- **Back to the switch.** Where the card links to `/` today (`devices-panel.tsx`, the console-record line), link to the switch page `/bridges/<bridgeid>/switches/<mac>` when the console knows the board. Link text: "Open in Switches".
- The component can keep its internal name, or be renamed `SetupPanel`. Implementer's choice; no behavior depends on it.

## 8. Lights (`/bridges/[bridgeid]/lights`) — pending design

> **Open.** This section is filled in once the Claude Design handoff arrives. It goes in `docs/specs/design-lights/` while in progress and moves to `finished/` with this spec. Until then, phase 1 ships **without** the Lights route and nav item, so there's no empty page.

What is already decided (from the design brief):

- **Read-only.** No assigning. At most, links to a switch's page (§6).
- It answers, in order:
  1. what controls this room, zone or light (switch · page or channel · gesture · action);
  2. what's in the house (rooms, zones, lights, scenes, and how zones overlap rooms);
  3. what no switch covers;
  4. how fresh the snapshot is, and which targets are stale.
- **Direct and indirect control are different.** A gesture on a light is direct. A gesture on a room or zone acts on its lights **through** that group. Scene gestures act on the scenes' group, and the Ring acts on its group or light list.
- Light on/off comes from the snapshot and is never presented as live.
- Uses the Bridge layout (§4): `h1` "Lights" and the context line.

**Design-independent groundwork** (can be built in phase 2 before the layout is final): a pure function in `lib/`, e.g. `lib/control-index.ts`:

```text
controlIndex(snapshot, switches) → Map<rid, Control[]>
Control = { mac, switchName, product,
            where: { pageId, pageName } | { channelId, channelLabel },
            gesture: "short" | "double_click" | "on_off" | "hold" | "ring",
            action, direct: boolean, via?: groupRid }
```

- It is keyed by room/zone id and light id.
- Scenes resolve to their group.
- Targets not in the snapshot go into a separate `stale[]` list.
- It is a candidate to replace the stale counting in the editor too, if that turns out simpler.

**Placeholder: layout, components, copy and states.** From the handoff.

## 9. Docs and copy to update (same commit as the code)

- `docs/definitions.md`:
  - "Display and recipes": replace "Switches of *this* `bridgeid` are tabs; the selected one opens below" with the new model. Each switch has its own page under Switches, and tabs switch between the Bridge's switches without losing drafts.
  - Also mention Setup where the text says Devices or `/install` (line 15).
- `AGENTS.md`: "what `/install` flashes" → "what `/setup` flashes".
- `README.md`: "Devices (`/devices`; `/install` …)" → Setup.
- `app/how-to/page.tsx`: every "Devices" link and label → Setup (`/setup`). Step 2 "Choose what it does" `where="Bridge" href="/"` → `where="Switches" href="/switches"`.
- `app/keys/keys-panel.tsx`: the last-switch link → `/bridges/<id>/switches/<mac>`. The "Devices" link → Setup.
- `app/firmware/[product]/manifest.json/route.ts` comment: "/install and Devices" → "Setup".
- `docs/changelog.md`: a console entry. "Switches, Lights (later) and Setup replace Bridge and Devices. Each switch has its own page. Old links redirect."
- `docs/specs/finished/*` stay as written (history).

## 10. Compatibility

- Bookmarks: `/`, `/bridges/<id>`, `/bridges/<id>?mac=…`, `/devices` and `/install` all redirect (§3).
- Boards and the device API are untouched. `CONSOLE_URL` on the boards is the host, not a page.
- No data or schema change.

## 11. Checklist

### Phase 1: structure (console, `hue-switch-console`)

- [x] `app/bridges/[bridgeid]/layout.tsx` (Shell wide, Bridge lookup, not-found)
- [x] Shared server loader for a Bridge's switches with config
- [x] `/bridges/[id]/switches` overview (§5), with warnings and empty states
- [x] `/bridges/[id]/switches/[mac]` editor (§6): pathname-driven selection, `pushState` tabs, `← Switches`, `h1`, leave-with-drafts confirm (reload and in-app links)
- [x] `/bridges/[id]` → redirects; `/switches` redirect route; `/` one-Bridge redirect target changed
- [x] `app/devices` → `app/setup`; `/devices` and `/install` redirects; `?mac=` hint; "Open in Switches" link
- [x] Nav: Switches · Setup · How-to, with active states (§4)
- [x] Context line with separate room and zone counts
- [x] Docs and copy (§9)
- [x] `npm run build` passes; `npm run lint` passes except the existing `app/theme-picker.tsx` error (set-state-in-effect), which this change does not touch
- [ ] Deployed; checked on production (login, overview, a Round and a Simple switch page, tab switching with a draft, Back/Forward, Save all, old URLs redirect, Setup with `?mac=`). Per `AGENTS.md`, not with local Playwright.

### Phase 2: Lights (console)

- [ ] Claude Design handoff in `docs/specs/design-lights/`; §8 filled in and approved
- [ ] `lib/control-index.ts`
- [ ] `/bridges/[id]/lights` and `/lights` redirect; Lights nav item
- [ ] Changelog entry
- [ ] Deployed; checked on production

### Cleanup

- [ ] Move this spec and `design-lights/` to `docs/specs/finished/`

## 12. Decisions (grilled 2026-09-26)

1. **Leaving the editor with unsaved changes:** confirm first, for a reload and for in-app links (§6). Drafts are not kept across pages.
2. **"Not seen" threshold:** 3 h for every board, whether or not it has recipes.
3. **Naming:** the USB page is called **Setup**.
4. **Removing a switch:** out of scope. It gets its own spec later (it needs `DELETE /api/switches/[mac]` and a rule for a board that registers again).

## 13. Open questions

- Lights (§8): open until the Claude Design handoff arrives.
