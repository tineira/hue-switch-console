# OTA updates: Round

Cross-repo spec. Process: `AGENTS.md` → "Cross-repo changes".

**Status:** in progress

v2 of `docs/specs/ota.md`, which shipped for the Simple switch (console #6, #7, #8; Simple 0.6.0–0.6.2, tested on hardware 2026-09-28). This spec reuses its contract unchanged and records what the Simple work taught us. Where this spec says nothing, `ota.md` applies.

## 1. What and why

A Round Display on the wall can be updated from Switches without USB, the same way a Simple switch is: its row shows **Update to …**, the owner reads what changes and presses **Update now**, and at its next check-in the Round downloads the new firmware and restarts into it. Because the Round has a screen, it says so while it happens: an **Updating** screen with the ring filling as the download progresses, then a restart. The first update to the OTA-capable release (0.6.0) still goes over USB from Setup.

## 2. Contract change

**None.** `docs/device-api.md` already describes everything the Round uses: `firmware=` and `ota_error=` on the poll, the `ota` block, `200` instead of `204` while an offer is pending, and the error codes. The only edit there is the line that says which firmware uses it: "Simple ≥ 0.6.0" becomes "Simple ≥ 0.6.0 and Round ≥ 0.6.0" (**additive**).

Console-only changes (§4.1) decide which Rounds get offers.

## 3. Compatibility

- **Console with a Round that has not updated:** Round < 0.6.0 sends no `firmware` on the poll and is not OTA-capable. It never gets `ota` or a `200` in place of `204`. Switches shows **Update to …**, and the panel sends it to Setup, as it does today for Simple < 0.6.0.
- **Round 0.6.0 with a console that has not deployed:** the console ignores `firmware` and `ota_error` and never sends `ota` to a Round. Nothing breaks. Console still goes first.
- **Firmware versions that need the old path:** `round < 0.6.0`. Nothing is removed; they just never get offers.

## 4. What we learned from Simple, and what it changes

| Finding (Simple) | For the Round |
| --- | --- |
| The heap test passed with a wide margin (largest block ≥ 118 KB on the C6) | The S3 has PSRAM and far more internal RAM. No test before building; the first build logs free heap and the largest block during the download, and the numbers go in §7. |
| 0.6.0 didn't report a download cut off by a power cut; 0.6.1 added an NVS mark (`ota`/`dl`) | Built in from the start. |
| The rollback path (`ota`/`try` + last invalid partition → `ota_error=boot`) is untestable without a broken release | Built in from the start; stays untested, as on Simple (§6). |
| The download/write/restart path can be tested before merging: a debug build reporting a version ahead of the release, then **Downgrade** on Switches | Used here before the PR merges (§6). |
| One release existed only to have something to update to | One release (0.6.1) covers Update, Cancel, and the power cut with its retry. |
| Console treats only Simple as OTA-capable; the per-Bridge route hard-codes Round's latest as `""` | Fixed in §4.1. |
| Switches copy says "Its buttons…" | Round wording in §4.1. |

### 4.1 Console

- `lib/ota.ts`: `ROUND_OTA_MIN_FIRMWARE = "0.6.0"`; `otaCapable` accepts `round` at or above it.
- `POST /api/bridges/{bridgeid}/ota`: read the Round's current release like the Simple's, instead of `""`.
- Switches copy made product-aware: the offered line ("Its buttons keep working until then") and the update panel ("Its buttons, Wi-Fi and Hue pairing stay as they are") say "pages" for a Round.
- `docs/device-api.md`: the one-line firmware note above.

### 4.2 Firmware (Round)

Port Simple's `ota.h` into the Round tree (shared per chip family, never across S3 and C6), then adapt:

1. **Where the offer is read.** The Round's console task hands a `200` body to the touch loop through a queue (`consoleFetchConfigHttp` → `gConsoleConfigQ`). Parse `ota` in the console task before that hand-off and before the epoch check, from any `200` whatever its `rev`. The body still goes to the loop as today.
2. **Where the download runs.** In the console task (core 0), after the poll's connection is closed, like Simple. Never in `loop()` or the Hue job task.
3. **When it starts.** All of these, else wait for the next poll:
   - `ota.version` ≠ `FIRMWARE_VERSION`, not blocked or inside the one-hour retry window (as on Simple);
   - the screen is Ready or Empty (not Wi-Fi, pairing, loading, error or token screens);
   - no touch for 10 s, no finger down, no ring drag, no double-tap wait;
   - no Hue job queued or running.
4. **Update screen.** A new UI state, painted by the loop when the console task asks for it:
   - "Updating" and the target version, with the ring filling 0–100 % as bytes arrive, then "Restarting" once the image checks out.
   - Touches are ignored until the restart (the ~8 s download stutters the display anyway: flash writes pause both cores' cache).
   - If the screen is asleep, it stays asleep; a touch wakes it straight to the update screen. The screen does not sleep while updating.
   - On failure: a short "Update failed" (about 2 s), then back to where it was (Ready, or asleep). The reason goes to the console as `ota_error`.
   - This is not Ready, so it doesn't break `input-during-hue.md`'s "no busy text in Ready".
5. **Hue refresh** (the periodic state GET) pauses while the update screen is up.
6. **Checks, NVS and confirming:** exactly as `ota.md` §4.2–4.3 and Simple's `ota.h`: stream into the inactive slot while hashing, check length and sha256 before `Update.end()`, `ota`/`dl` and `ota`/`try` in a firmware-owned `ota` NVS namespace (never written over USB), `verifyRollbackLater()` returns true, confirm after the first `200`/`204` poll, NVS never erased.
7. App slot `default_8MB`: 3.2 MB; the current image is 1.2 MB.

## 5. Checklist

### Console (`hue-switch-console`)

- [x] `otaCapable` accepts Round ≥ 0.6.0; per-Bridge route reads the Round's latest
- [x] Product-aware copy on Switches (§4.1)
- [x] `docs/device-api.md` firmware note updated in the same commit
- [x] `docs/changelog.md` entry
- [ ] Deployed; checked on production

### Round (`hue-round-switch`)

- [x] `ota.h` ported and adapted (§4.2); `firmware=` on every poll, `ota_error=` once after a failure
- [x] Update screen with progress ring (§4.2 step 4)
- [x] Heap logged during a download; numbers recorded in §7
- [x] Before merging: debug build ahead of 0.5.32 → **Downgrade** on Switches downloads, writes and restarts into 0.5.32 with settings kept
- [ ] `FIRMWARE_VERSION` → 0.6.0; `CHANGELOG.md` entry (user-facing wording)
- [ ] Release uploaded; `/firmware/round/manifest.json` shows 0.6.0
- [ ] User flashes 0.6.0 by USB
- [ ] 0.6.1 released; user presses **Update now**: the update screen shows, the Round restarts on 0.6.1, and Switches shows it current with a fresh check-in
- [ ] Cancel before the next check-in: nothing downloads
- [ ] Power cut during a download: the Round comes back on the old firmware, Switches shows the update failed, and the retry after an hour (or after a restart) succeeds

### Simple (`hue-simple-switch`)

- [ ] Nothing.

### Cleanup

- [ ] None.

## 6. Testing notes

- Before merging, the Downgrade trick needs no release: the debug build reports a version above the current Round release, so Switches offers **Downgrade to 0.5.32**, and the whole download/write/restart path runs against the real console.
- The rollback case (`ota_error=boot`) stays untested, as on Simple. Testing it needs a release that can't reach the console, and every console user's Setup would install it while it's current.

## 7. Open questions

1. **Heap numbers** (answered 2026-09-28, Round debug build reporting 0.6.0, **Downgrade** to 0.5.32 against production, console `https://hue.tineira.com`). The console task sampled the heap after every chunk and logged it once a second:

   | Phase | Internal free | Largest internal block | PSRAM free |
   | --- | --- | --- | --- |
   | Before the download (poll closed) | 134.5 KB | 90.1 KB | 8.34 MB |
   | TLS connected | 86.7 KB | 38.9 KB | 8.34 MB |
   | Lowest during the download | 77.3 KB | 31.7 KB | 8.32 MB |

   mbedtls allocates internal RAM on this core (`CONFIG_MBEDTLS_INTERNAL_MEM_ALLOC`), so the internal numbers are the ones that count; PSRAM barely moves. The firmware starts only with a largest internal block of 48 KB or more. The 0.5.32 `firmware.bin` (1,227,296 bytes) downloaded and was written in 8.4 s; the Round restarted into 0.5.32 with its pages, Wi-Fi and pairing kept, and Switches showed it with a fresh check-in.
