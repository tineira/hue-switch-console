# Page structure: Switches, Lights, Setup

Console-only spec. Process: `AGENTS.md` → "Cross-repo changes" (only the spec and console steps apply).

**Status:** approved. Revised on 2026-09-26 after the first deploy: the per-Bridge overview is gone and Switches opens straight on the editor (§12, decision 5).

## 1. What and why

The nav was named after the Bridge and after "Devices", but that's not what the user works with.
- **Bridge** was really the switch editor, and it almost always redirected to the only Bridge.
- **Devices** is a USB workbench (flash, Wi-Fi, token, pair), not a list of your devices.
- Since Bridge page v2, the console also has no view of the Bridge's lights, rooms, zones and scenes. It has never had a way to answer "what controls this light?".

Afterwards the user has three places, each named after what they work with:

- **Switches**: the editor for every switch in the account. Tabs are grouped in one section per Bridge, each with its health (last seen, update available, stale targets). Each switch has its own URL.
- **Lights**: read-only topology and which switch gestures act on each room, zone and light, in one section per Bridge. **The layout is pending a Claude Design handoff (§8).** This spec only reserves its place.
- **Setup**: the old Devices USB flow, renamed. It is reachable from the nav and from wherever a switch needs it (add a switch, update firmware).

The Bridge stays the configuration context (`docs/definitions.md`, "Per Bridge"): a switch uses only its own Bridge's topology. The Bridge is a section on a page, not a page of its own.

## 2. Contract change

None. No device endpoint, payload, NVS key or installer change.
- The firmware repos do not link to console pages. `hue-round-switch/AGENTS.md` mentions `/install`, which keeps redirecting (§3).
- The Round's "Token rejected" screen says "Set a new one in Devices". Renaming that is a separate Round change; the console's how-to drawing of that screen follows the firmware.

## 3. Route map

| Route | Before | After |
| --- | --- | --- |
| `/` | Bridge list; redirected to the only Bridge | Redirect to `/switches`. |
| `/switches` | — | The first switch (`/switches/<mac>`, oldest first), or the empty state: "No Bridge yet" / "No switches yet" with steps and **Go to Setup**. |
| `/switches/[mac]` | — | **Switches**: the editor, opened on that switch (§5). |
| `/lights` | — | **Lights** (§8), phase 2. |
| `/setup` | — | **Setup**: the old `/devices` page, moved (§6). |
| `/bridges`, `/bridges/[bridgeid]` | Editor (`?mac=` selects a switch) | Redirect to `/switches/<mac>` with `?mac=`, otherwise `/switches`. |
| `/bridges/[bridgeid]/switches[/<mac>]` | (the first deploy of this spec) | Redirect to `/switches[/<mac>]`. |
| `/devices` | USB flow | `permanentRedirect` to `/setup`, keeping the query string. |
| `/install` | Redirect to `/devices` | `permanentRedirect` to `/setup`. |
| `/how-to`, `/keys`, `/changelog` | — | Unchanged, apart from link and copy updates (§9). |

A MAC identifies a switch within an account, so the URL does not need the Bridge.
- `[mac]` is the stored form: 12 lowercase hex characters, no separators (`switches.mac`). A MAC with separators or uppercase letters redirects to the canonical form.
- An unknown MAC, or a switch whose Bridge has never checked in, shows "Switch not found" with a link to `/switches`.

## 4. Nav

**Top nav** (`app/nav-links.tsx`): **Switches · Lights · Setup · How-to**. Lights appears in phase 2. API keys, Changelog, and later Account and Admin (`docs/specs/multi-user-accounts.md`) stay in the account menu.

- Active state: Switches is active on `/`, `/switches` and `/switches/*`, Lights on `/lights`, and Setup on `/setup`.
- The "Hue switch console" wordmark links to `/`, which redirects to `/switches`.

## 5. Switches (`/switches/[mac]`)

The v2 editor (`app/switches/workspace.tsx` and the editors in `app/switches/`), across every Bridge of the account.

**Header:** `h1` "Switches" and, on the right, a primary button **Add a switch** linking to `/setup`.

**One section per Bridge**, most recently updated first. Each section has:

- A **context line** (text-sm muted), with the bridge id and IP in mono:

  `Bridge C42996FFFECA6703 · 192.168.1.20 · 44 lights · 10 rooms · 9 zones · 123 scenes · Snapshot 5 min ago`

  **Fix:** the old header counted zones as rooms ("19 rooms"). They are counted separately.
- "No lights yet. A switch paired with this Bridge sends its rooms, lights, and scenes when it checks in." when its snapshot is empty.
- Its **switch tabs**, oldest first (`created_at`). They used to be sorted by last seen, so they moved around as boards checked in. With no switch: "No switches on this Bridge yet."

A switch whose Bridge row is missing is not shown. It can't be configured without topology.

**Tabs:**
- The first line is the name, plus a filament dot for unsaved changes and a **warn dot** when the switch needs attention.
- The second line (text-xs muted) reads `Round|Simple · seen 12 min ago`, with these parts when they apply:
  - `· not seen 5 h` in warn instead of `seen …`, when `last_seen_at` is older than 3 h. Boards with recipes poll hourly (`definitions.md`, Polling), so 3 missed polls means something is wrong.
  - `· N stale` in warn: assignments in the draft that are no longer in that Bridge's snapshot.
  - `· update` in filament, when a newer release is uploaded for the product.
- The warn dot shows for "not seen", stale assignments, or a Simple below `supportsChannelTypes`.

**The selected switch's card** follows the sections, unchanged from v2 except as listed here.
- Its title is an `h2`.
- `Update to x.y.z` links to `/setup?mac=<mac>`.
- Under the meta line, a not-seen switch adds a warn line: "Not seen for 5 h. Saved changes reach it when it checks in again."
- Stale assignments keep their warning and **Clear stale** above the save bar. A Simple on old firmware keeps its banner inside the card.
- The document `<title>` is the switch name.

**Tabs and the URL:**
- Clicking a tab calls `window.history.pushState(null, "", "/switches/<mac>")`. That doesn't remount anything, so drafts survive (Next docs: `01-app/01-getting-started/04-linking-and-navigating.md`, "Native History API").
- The selected switch is **derived from `usePathname()`**, so Back and Forward move between switches. Open gesture cards, the notice and the rename form reset when it changes.
- Each switch uses its own Bridge's snapshot. **Save all** covers drafts on every Bridge.

**Unsaved drafts.** While any switch is dirty:
- A `beforeunload` listener makes a reload or tab close ask first.
- Every in-app link that leaves `/switches` (nav, wordmark, Update → Setup, how-to links) asks first with a `window.confirm`: "Unsaved changes on {names}. Leave without saving?". Cancel stays on the page, OK navigates.
- Tab switches and links to `/switches` itself do not ask, because they keep the drafts.
- Implementation: a capture-phase click listener on `window`, registered by the workspace. The nav in `Shell` needs no changes.

**Where the editor mounts:**
- `app/switches/layout.tsx` loads every Bridge and switch once (`lib/bridge-switches.ts`, `loadSwitchesView`) and renders the editor when the URL names a known switch.
- A layout stays mounted when the MAC in the URL changes; a page is keyed by its param. That keeps drafts through tab switches and through the `router.refresh()` after a save, which Back needs to avoid showing pre-save data.
- `[mac]/page.tsx` only canonicalises the MAC or says it is not found.

## 6. Setup (`/setup`)

The old `app/devices/` moves to `app/setup/` (`SetupPanel`). Its behavior is unchanged (`docs/specs/finished/devices.md` stays the reference for the flow), apart from:

- **Name.** Nav label "Setup". `h1` "Setup". Intro: "Plug a switch into this computer over USB to install or update firmware, save Wi-Fi, and link it to this console. Use Chrome or Edge." `<title>` "Setup".
- **`?mac=<mac>` (optional).** When the account has that switch, a line above Detect reads "Updating **{name}**. Plug it in over USB and press Detect." After Detect, if the board reports a different MAC, a warn line reads "This is {other name or MAC}, not {name}." It only informs and never blocks.
- **Back to the switch.** When the console knows the board, the checklist links to `/switches/<mac>`: "Edit its pages: Open in Switches". Before, it linked to `/`.
- `GET /api/switches/{mac}` also returns `label`, for the name in that warning.

## 7. (Removed) Switches overview

The first deploy had a per-Bridge overview at `/bridges/<id>/switches`: cards with a summary of what each switch does. It was dropped the same day (§12, decision 5). The summary helpers it introduced stay in `lib/gestures.ts` (`simpleChannelGestures`, `gesturesLine`), and the Simple editor uses them.

## 8. Lights (`/lights`) — pending design

> **Open.** This section is filled in once the Claude Design handoff arrives. It goes in `docs/specs/design-lights/` while in progress and moves to `finished/` with this spec. Until then, phase 1 ships **without** the Lights route and nav item, so there's no empty page.

What is already decided (from the design brief):

- **Read-only.** No assigning. At most, links to a switch (`/switches/<mac>`).
- One section per Bridge, with the same context line as Switches (§5).
- It answers, in order:
  1. what controls this room, zone or light (switch · page or channel · gesture · action);
  2. what's in the house (rooms, zones, lights, scenes, and how zones overlap rooms);
  3. what no switch covers;
  4. how fresh the snapshot is, and which targets are stale.
- **Direct and indirect control are different.** A gesture on a light is direct. A gesture on a room or zone acts on its lights **through** that group. Scene gestures act on the scenes' group, and the Ring acts on its group or light list.
- Light on/off comes from the snapshot and is never presented as live.

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
  - "Display and recipes": Switches lists every switch in tabs grouped by Bridge; each switch has its own URL.
  - Setup where the text said `/install`.
- `AGENTS.md`: `/install` → `/setup`.
- `README.md`: Devices → Setup.
- `docs/device-api.md`: `GET /api/switches/{mac}` row. Devices → Setup.
- `app/how-to/page.tsx`:
  - every "Devices" link and label → Setup (`/setup`);
  - step 2 → `where="Switches" href="/switches"`;
  - the update step points at "Update to".
- `app/keys/keys-panel.tsx`: the last-switch link → `/switches/<mac>`. "Devices" → Setup.
- Code comments that say Devices → Setup.
- `docs/changelog.md`: console entry.
- `docs/specs/finished/*` stay as written (history).

## 10. Compatibility

- Bookmarks: `/`, `/bridges`, `/bridges/<id>`, `/bridges/<id>?mac=…`, `/bridges/<id>/switches[/<mac>]`, `/devices` and `/install` all redirect (§3).
- Boards and the device API are untouched. `CONSOLE_URL` on the boards is the host, not a page.
- No data or schema change.

## 11. Checklist

### Phase 1: structure (console, `hue-switch-console`)

- [x] Shared server loader for every Bridge and switch (`loadSwitchesView`)
- [x] `/switches` layout with the editor; `/switches` index (first switch or empty state); `/switches/[mac]` (canonical MAC, not found)
- [x] Editor (§5): sections per Bridge with context line, tabs with warnings, pathname-driven selection, `pushState` tabs, per-switch snapshot, leave-with-drafts confirm (reload and in-app links)
- [x] Redirects: `/`, `/bridges`, `/bridges/[id]`, `/bridges/[id]/switches[/…]`
- [x] `app/devices` → `app/setup`; `/devices` and `/install` redirects; `?mac=` hint; "Open in Switches" link
- [x] Nav: Switches · Setup · How-to, with active states (§4)
- [x] Separate room and zone counts
- [x] Docs and copy (§9)
- [x] `npm run build` passes; `npm run lint` passes except the existing `app/theme-picker.tsx` error (set-state-in-effect), which this change does not touch
- [ ] Deployed; checked on production:
  - login lands on Switches;
  - a Round and a Simple switch;
  - tab switching with a draft, then Back and Forward;
  - Save all;
  - a nav link with a draft asks first;
  - old URLs redirect;
  - Setup with `?mac=`.

  Per `AGENTS.md`, not with local Playwright.

### Phase 2: Lights (console)

- [ ] Claude Design handoff in `docs/specs/design-lights/`; §8 filled in and approved
- [ ] `lib/control-index.ts`
- [ ] `/lights`; Lights nav item
- [ ] Changelog entry
- [ ] Deployed; checked on production

### Cleanup

- [ ] Move this spec and `design-lights/` to `docs/specs/finished/`

## 12. Decisions (grilled 2026-09-26)

1. **Leaving the editor with unsaved changes:** confirm first, for a reload and for in-app links (§5). Drafts are not kept across pages.
2. **"Not seen" threshold:** 3 h for every board, whether or not it has recipes.
3. **Naming:** the USB page is called **Setup**.
4. **Removing a switch:** out of scope. It gets its own spec later (it needs `DELETE /api/switches/[mac]` and a rule for a board that registers again).
5. **No overview page; sections per Bridge** (after the first deploy). A separate overview between the nav and the editor didn't make sense. Switches opens straight on the editor, with tabs grouped in one section per Bridge.
   - The URL is flat: `/switches/<mac>`.
   - The overview's warnings moved onto the tabs, and "not seen" also goes on the card header.

## 13. Open questions

- Lights (§8): open until the Claude Design handoff arrives.
