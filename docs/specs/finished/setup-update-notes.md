# Release notes before an update in Setup

Mostly console work. The only firmware-side change is a wording convention in each firmware repo's `CHANGELOG.md`. No device endpoint, payload field or NVS key changes.

**Status:** done (2026-09-27). Approved with D1–D7 as recommended; console live since `f2875d6`, firmware repos and D7 done, checked on a Simple by the user. The follow-up in §6 is not done and needs its own change.

## 1. What and why

When `/setup` reads a board whose firmware is older than the current release, it shows what changed between the two: the release notes of every version after the installed one, up to and including the one Update installs. Notes the firmware author marks as important show first and stand out. The person can then see *before* clicking Update that, for example, "after this update, installing new firmware no longer needs the BOOT button; press RESET once when the write finishes" (Simple 0.2.11), instead of having to find it on `/changelog`.

## 2. What exists today

- Firmware CI sends that version's `CHANGELOG.md` section as `notes` with each upload. `firmware_releases.notes` keeps every version's notes, including versions whose bins were pruned (`lib/firmware.ts`, `listReleaseNotes`).
- `/changelog` merges those notes into the Round and Simple sections. `notesToItems` (`lib/changelog-parse.ts`) turns a section into one string per bullet.
- `/setup` (`app/setup/setup-panel.tsx`) compares `huesta.ver` with `manifest.version`. When the board is older (`versionCmp === -1`), the checklist's Firmware row reads "`<installed>` · `<latest>` is available", the next step says "Update to `<latest>` with Update below when convenient. Settings stay.", and the Actions section has **Update**. Both version numbers link to their `/changelog` entry; nothing lists what changed in between.
- There is no way to mark a note as important. Every bullet looks the same.

## 3. Decisions

All seven approved as recommended (2026-09-27).

| # | Decision | Options | Recommendation |
| --- | --- | --- | --- |
| D1 | How the firmware author marks a note that needs attention | (a) A bullet that starts with `Important:`; (b) a `#### Important` sub-heading inside the version section; (c) a separate `important` upload field | **(a)**. It reads naturally on GitHub and in the repo, the CI step that cuts a version's section needs no change, and the upload payload stays the same. The console strips the prefix and shows the rest highlighted. |
| D2 | Which versions to show | (a) Every version after the installed one up to and including the current release; (b) only the current release | **(a)**. That is the point of the feature: a board several versions behind skips notes like 0.2.11's otherwise. Versions with no notes are left out. |
| D3 | Where on `/setup` | (a) A "What changes" block directly above **Update** in Actions; (b) in the checklist under the Firmware row; (c) both | **(a)**. It is where the decision is made. The checklist keeps its one-line summary and gains "N important notes" when there are any, linking down to the block. |
| D4 | How much to show when many versions are listed | (a) Everything expanded; (b) important notes always expanded at the top, every version's full list inside a collapsed `details` ("All changes in N versions") | **(b)**, and expanded instead when it is 3 versions or fewer. A board at Simple 0.2.5 would otherwise list 10 versions. |
| D5 | Should important notes gate Update | (a) No, they are shown only; (b) a checkbox "I read the important notes" before Update enables | **(a)**. The notes are above the button. A gate adds a click to every update to guard against something the text already says. Revisit if a future release needs a real one-way step. |
| D6 | Where else important notes appear | (a) Only `/setup`; (b) also highlighted on `/changelog` | **(b)**. Same parser, same look, so the public page does not show `Important:` as raw text. |
| D7 | Marking notes of releases already uploaded | (a) Leave them; (b) Claude edits the firmware `CHANGELOG.md` entries and updates the stored notes in the database for past versions that deserve the marker | **(b)**, only for entries the user agrees on. CI sends only the current version's section, so past rows are updated directly in Postgres (Neon connector). Candidate: Simple 0.2.11 (BOOT no longer needed; press RESET once). |

## 4. Design

### 4.1 Notes format (D1)

- In a firmware `CHANGELOG.md` version section, a bullet may start with `Important:` (case-sensitive, followed by a space). Everything after it is the note.
- `notesToItems` returns `{ text, important }` per bullet instead of a string. Callers that only need text map `.text`.
- Each firmware repo's `CHANGELOG.md` header line and its AGENTS.md "Contract" section say when to use it: a note the person must act on or know before or right after updating (a button to press, a setting that resets, a step that changed). Not for new features.
- `README.md` "Firmware release pipeline" documents the marker. The upload endpoint is documented there, not in `docs/device-api.md` (that file covers what a board calls), so `device-api.md` does not change.

### 4.2 Data to `/setup` (D2)

- `app/setup/page.tsx` (server) reads `listReleaseNotes("round")` and `listReleaseNotes("simple")` and passes them to `SetupPanel` as `releaseNotes: Record<ProductId, FirmwareNotes[]>`. A few kilobytes; no new route. A failed read passes empty lists, and the block is simply not shown.
- A pure helper `notesBetween(notes, installed, latest)` in `lib/firmware-notes.ts` returns the versions with `installed < version <= latest`, newest first, using the existing `compareVersions`. The installed version is the one the board reported (`huesta.ver`, else the Improv version), the same one that made Setup offer Update.
- Checked with a scratch script (the repo has no test runner): nothing when current or newer, an installed version missing from the list, a latest version with no notes row, a version that does not parse, `Important:` parsing and wrapped lines.

### 4.3 UI (D3, D4)

- Shown when `actions.flash === "update"` and `notesBetween` is not empty.
- Block above **Update**, inside Actions: heading "What changes from `<installed>` to `<latest>`".
  - Important notes first, each with its version, in the warn colour with a short "Important" label (text, not only colour).
  - Then either every version's list (3 or fewer versions) or a collapsed `details` "All changes in N versions" with the same headings and bullets as `/changelog` (version in mono, date in muted).
- Checklist Firmware row: unchanged text, plus " · N important notes" when N > 0. The next-step line for an old firmware reads "Read the important notes, then update to `<latest>` with Update below. Settings stay." when there are any.
- Reinstall and first install show nothing new.

### 4.4 `/changelog` (D6)

- An important bullet renders with the same "Important" label. No other change.

### 4.5 Past notes (D7)

- Claude lists candidate past bullets in both firmware changelogs; the user picks. Candidates: Simple 0.2.11 (installing no longer needs BOOT; press RESET once) and Simple 0.3.0 (an input not set up in the console does nothing). Nothing in Round's changelog asks the person to act. Claude edits those `CHANGELOG.md` entries in each firmware repo (through that repo's session or with the user's OK) and runs one `update firmware_releases set notes = … where product = … and version = …` per row on production.

## 5. Checklist

### Console (`hue-switch-console`)

- [x] `notesToItems` returns `{ text, important }`; `/changelog` renders the label
- [x] `lib/firmware-notes.ts` with `notesBetween`, checked with a scratch script
- [x] `/setup`: release notes passed from the server; "What changes" block; checklist count and next-step text
- [x] `README.md` pipeline section documents `Important:`
- [x] `docs/changelog.md` entry: Setup lists what changed before an update
- [x] Typecheck, lint and build pass
- [x] Deployed 2026-09-27 (`f2875d6`); `/changelog` on production shows the new entry
- [x] Checked on production by the user (2026-09-27) with a Simple on an older firmware: both Important notes show above Update

### Round (`hue-round-switch`)

- [x] `CHANGELOG.md` header and AGENTS.md "Contract" describe the `Important:` marker ([hue-round-switch#7](https://github.com/tineira/hue-round-switch/pull/7), awaiting merge)
- [x] Past entries marked: none picked for Round

### Simple (`hue-simple-switch`)

- [x] `CHANGELOG.md` header and AGENTS.md "Contract" describe the `Important:` marker ([hue-simple-switch#6](https://github.com/tineira/hue-simple-switch/pull/6), awaiting merge)
- [x] Past entries marked (2026-09-27): 0.2.11 (also "Devices" → "Setup") and 0.3.0 (adds "After updating, set up each wired input in Switches."), in the stored notes on production, and in `CHANGELOG.md` with hue-simple-switch#6

No `FIRMWARE_VERSION` bump: the marker is text in notes the console already stores.

## 6. Open questions

- Devices (`/switches/<mac>`) knows `switches.firmware` too. Showing the same "What changes" there, before the person plugs the board in, is a natural follow-up, and the place OTA (`docs/specs/ota.md`) would use it. Out of scope here.
