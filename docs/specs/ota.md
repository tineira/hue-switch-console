# OTA updates

Cross-repo spec. Process: `AGENTS.md` → "Cross-repo changes".

**Status:** in progress

**Scope:** v1 is the **Simple** switch (`hue-simple-switch`, XIAO ESP32-C6). Round gets OTA in v2 (§7).

Related: `docs/specs/finished/firmware-uploads.md` (the release catalog this builds on), `docs/specs/finished/web-setup.md` (USB install for blank boards, unchanged).

## 1. What and why

A Simple switch already on the wall can be updated from the console, without USB. Every poll reports the firmware version the switch runs. The bridge page shows each switch's version next to the product's current release, with a badge (`current`, `behind`, `update offered`, `failed`). The signed-in owner offers the update to one switch, or to every switch on that bridge that is behind. The switch's next poll carries the offer; the switch downloads the app image from the console, checks it, writes the inactive slot and reboots. Its first poll on the new firmware reports the new version, and the row turns `current`: that is the proof the rollout arrived. Nothing updates unless the owner offered it; a new CI release alone never reaches a switch.

USB stays the path for blank boards, and for the one USB update that brings each existing Simple switch to the first OTA-capable release.

## 2. Contract change

### 2.1 Poll reports the version and OTA errors — additive

`GET /api/device/config?mac={mac}&rev={rev}&firmware={version}&ota_error={code}`

| Param | Required | Meaning |
| --- | --- | --- |
| `firmware` | OTA-capable firmware: yes, on every poll | `FIRMWARE_VERSION`, `major.minor.patch` |
| `ota_error` | no | Sent on the **first** poll after a failed OTA attempt, then dropped. One of the codes below |

The console stores `firmware` in `switches.firmware` and stamps `switches.firmware_seen_at` on every poll that carries a valid version (register also stamps it). A missing or malformed `firmware` is ignored: no `400`, and the stored value is kept.

`ota_error` codes:

| Code | Meaning |
| --- | --- |
| `heap` | Not enough memory to start the download |
| `connect` | Could not open the connection (DNS, TCP, TLS) |
| `http` | The image URL answered non-200 |
| `size` | `Content-Length` or the bytes received ≠ `ota.size`, or larger than the app slot |
| `write` | Flash write failed |
| `sha` | sha256 of the received image ≠ `ota.sha256` |
| `boot` | The new image was written but did not confirm itself; the bootloader went back to the previous slot (§4.3) |

An unknown code is stored as-is (for logs), never a `400`.

### 2.2 `ota` block in the `200` response — additive

Present only when the switch has a pending offer (§3.2). Next to `rev`, `product`, `channels`, `recipes`:

```json
"ota": {
  "version": "0.6.1",
  "url": "/firmware/simple/0.6.1/firmware.bin",
  "sha256": "9f2c…64 hex",
  "size": 1234567
}
```

- `url` is a **path**. The switch resolves it against the console URL in its NVS (the one written over USB with `HUESET url`), so the download uses the same scheme, host and TLS trust as the poll. An `https://` console downloads over verified TLS; a self-hosted `http://` console downloads over plain HTTP. sha256 still rejects a corrupted image.
- The image is `firmware.bin` (the app) only; bootloader, partitions and `boot_app0` are never sent over the air.
- The switch applies it only when `ota.version` ≠ its `FIRMWARE_VERSION`.

### 2.3 `200` instead of `204` while an offer is pending — additive

Today a poll whose `rev` equals the console's gets `204` with no body. While the switch has a pending offer, the console answers `200` with the full body (same `rev`, plus `ota`). Firmware must read `ota` whatever the `rev`. The rest of the body is handled as today: NVS is written only when the remote `rev` is greater than the local one, so an unchanged `rev` keeps NVS. Pre-OTA firmware never gets an offer (§3.2), so it never sees this.

### 2.4 Human APIs — additive

| Method | Path | Body / result |
| --- | --- | --- |
| `POST` | `/api/switches/{mac}/ota` | Offer the current release to this switch, including a downgrade when the switch is `ahead` (§3.2). `409 not_ota_capable` (product or firmware too old), `409 no_release`, `409 already_current` |
| `DELETE` | `/api/switches/{mac}/ota` | Cancel the offer; the next poll no longer carries `ota` |
| `POST` | `/api/bridges/{bridgeid}/ota` | Offer to every OTA-capable switch on that bridge that is `behind` (never `ahead`: no bulk downgrades). Returns `{ offered: [mac…] }` |

`GET /api/switches` and `GET /api/switches/{mac}` gain `firmware_seen_at`, `latest_firmware`, `ota_status` (`current` \| `behind` \| `offered` \| `failed` \| `ahead` \| `unknown`), `ota_offered_at`, `ota_error`, `ota_capable`.

### 2.5 Storage (`db/schema.sql`) — additive

```sql
alter table switches add column if not exists firmware_seen_at timestamptz;
alter table switches add column if not exists ota_offered_at timestamptz;
alter table switches add column if not exists ota_error text;
alter table switches add column if not exists ota_error_at timestamptz;
```

An offer is a timestamp, not a version: it always means `firmware_current` for the switch's product at the moment the poll is answered. If a new release lands while an offer is pending, the offer follows it. `firmware_current`'s parts are always kept by retention, so the `url` never points at pruned bins.

## 3. Compatibility

- **Console with a board that has not updated:** Simple < 0.6.0 sends no `firmware` on the poll. The list shows the version from its last register, marked "from last register" when the switch has polled since (`last_seen_at > firmware_seen_at`). It is not OTA-capable: no Update button, and the row says "Update over USB" when behind. It never gets `ota` and never gets `200` in place of `204`.
- **Board with a console that has not deployed (firmware first):** the old console ignores `firmware` and `ota_error`, never sends `ota`. The switch runs as today. Either order works; console still goes first.
- **Firmware versions that need the old path:** `simple < 0.6.0` (no OTA client, no `firmware` on the poll). All Round versions in v1.
- **When the old path can be removed:** nothing is removed. Pre-0.6.0 boards simply never get offers.

### 3.1 Version, latest, badges

- Compare as semver (`compareVersions` in `lib/web-setup/devices.ts`). Round and Simple have separate lines.
- **Latest** = `firmware_current` for the product (so a rollback moves latest back).
- Badges, in the bridge page's switch rows:

| Badge | When |
| --- | --- |
| `current` | reported = latest |
| `behind` | reported < latest, no offer |
| `update offered` (with version) | offer pending, reported ≠ latest, no error since the offer |
| `failed: <code>` | offer pending and `ota_error_at > ota_offered_at` |
| `ahead` | reported > latest (a dev build, or after a rollback) |
| `unknown` | no reported version |

The reported version (`fw 0.6.0`) and `seen …` are always visible, so "didn't update" stays apart from "is off".

### 3.2 Offers

- OTA-capable = `product = 'simple'` and reported firmware ≥ `0.6.0` (a constant next to `SIMPLE_MIN_FIRMWARE`). Round is not OTA-capable in v1.
- The poll carries `ota` only when `ota_offered_at` is set, the switch is OTA-capable, a current release exists, and reported ≠ latest.
- When a poll reports a version equal to latest, the console clears `ota_offered_at` and `ota_error`: the offer is done.
- Offering again (or cancelling) clears `ota_error`.
- **Downgrade:** when a switch is `ahead` (reported > latest, e.g. after a rollback), its row has a separate **Downgrade to x.y.z** button that makes the same offer. **Update all behind** never includes `ahead` switches.
- An offer does not change the poll cadence (`X-Poll-Sec`). A switch on the 900 s poll takes the offer at its next check-in; the Switches page's fast poll (`POST /api/switches/sync`) makes it quick while the owner watches.

## 4. Firmware (Simple)

### 4.1 Memory: sequential download, then update mode

The C6 is at its RAM limit. The download never runs next to a second console TLS session:

1. **Heap test first** (before the rest of this section is built): with a real poll and a Hue PUT in flight, log free heap and the largest free block, then download a test image with the console client after closing the poll's connection. Record the numbers in §6.
2. **Default, if the test passes:** the console task finishes the poll, closes that connection, then downloads with the same client. GPIO keeps running in `loop()`; the Hue worker may run, but inputs pressed during the download may be slow.
3. **Fallback, if heap is still short:** save the offer (`version`, `url`, `sha256`, `size`) to NVS and reboot into an update-only mode that starts Wi‑Fi and the console client but not Hue or inputs, downloads, then reboots into the new app (or back to normal mode on failure, reporting the error on the next poll).

### 4.2 Applying an offer

- Only when `ota.version` ≠ `FIRMWARE_VERSION`, and not while an input is held or a Hue call from that input is in flight (wait for the next poll).
- `size` must fit the inactive app slot (0x1E0000). Stream the body into the slot (`Update`), hashing as it goes; compare sha256 and length before `Update.end()`. Never mark a slot bootable on a mismatch.
- NVS is never erased.
- On failure: send `ota_error=<code>` on the next poll. Retry the same offer no more than once an hour; after `size` or `sha` for a version, do not retry that version until reboot (the image itself is bad).

### 4.3 Confirming the new image

The new app confirms itself only after its first successful console poll (`200` or `204`), not at startup. If it crashes or reboots before that, the bootloader returns to the previous slot. The old app notices (last invalid partition set) and sends `ota_error=boot`. This needs the rollback check that Arduino-ESP32 does at startup to be deferred (override `verifyRollbackLater()`), then `esp_ota_mark_app_valid_cancel_rollback()` after the poll.

## 5. Checklist

### Console (`hue-switch-console`)

- [x] Schema columns (§2.5)
- [x] Poll: read `firmware` and `ota_error`, stamp `firmware_seen_at`; register stamps it too
- [x] Poll: `ota` block and `200`-while-offered (§2.2, §2.3); clear the offer once reported = latest
- [x] `POST`/`DELETE /api/switches/{mac}/ota`, `POST /api/bridges/{bridgeid}/ota`
- [x] `ota_status` and fields in `GET /api/switches` and `GET /api/switches/{mac}`
- [x] Bridge page switch rows: version, latest, badge, **Update** / **Downgrade to x.y.z** / **Cancel update**; **Update all behind** on the bridge page; "Update over USB" for non-capable switches that are behind
- [x] `/setup`: reported version and latest, read-only
- [x] `docs/device-api.md` updated in the same commit
- [x] `docs/changelog.md` entry
- [ ] Deployed; checked on production

### Simple (`hue-simple-switch`)

- [x] Heap test (§4.1) — numbers recorded in §6, sequential or update-mode chosen
- [ ] `firmware=` on every poll; `ota_error=` once after a failure
- [x] Apply `ota` per §4.2, confirm per §4.3
- [x] `FIRMWARE_VERSION` → `0.6.0`; `CHANGELOG.md` entry (user-facing wording)
- [x] Release uploaded; `/firmware/simple/manifest.json` shows `0.6.0`
- [x] User flashes `0.6.0` by USB on one board
- [x] A `0.6.1` release; user offers it from the console; the row turns `current` with a fresh `seen`
- [x] Cancel before the next poll: the switch does not download
- [ ] Power cut during the download: the switch boots the old firmware, reports `ota_error`, and a later retry succeeds

### Round (`hue-round-switch`)

- [ ] Not in v1. See §7.

### Cleanup

- [ ] None: pre-0.6.0 Simple boards keep working without offers.

## 6. Open questions

1. **Heap test results** (answered 2026-09-28, Simple 0.5.0 build with temporary logging, XIAO ESP32-C6, 44 lights / 19 rooms+zones / 123 scenes, console `https://hue.tineira.com`). A sampler task read free heap and the largest free block every 10 ms:

   | Phase | Lowest free heap | Lowest largest block |
   | --- | --- | --- |
   | Idle, after register | ~254 KB | 147 KB |
   | Config poll (TLS open) | 153 KB (with a Hue dim running) | 131 KB |
   | Download after closing the poll, with Hue GET/PUTs (toggle, dim start/stop) in flight | 142.5 KB | 118.8 KB |
   | Lowest since boot (register: Bridge snapshot + POST) | 93.6 KB | — |

   The 0.5.0 `firmware.bin` (1,269,872 bytes) downloaded in 5.5–5.8 s over the console client with verified TLS; the sha256 matched the published one, and every Hue call during the download returned 200. A Hue TLS call costs ~40–50 KB. **Decision: §4.1 step 2 (sequential download in the console task).** The update-only reboot mode (step 3) is not built.

## 7. v2: Round

Same contract. Round-specific work, for its own spec update when v2 starts:

- Download in the console worker, never in the touch loop (`hue-round-switch/docs/specs/finished/input-during-hue.md`); don't start while the ring is dragged or a recipe is in flight. Preferably while the screen is asleep.
- App slot `default_8MB` (~3.2 MB); PSRAM makes heap much less of a concern.
- Console: add `round` to OTA-capable with its own minimum version.

## 8. Out of scope

- Automatic or scheduled updates.
- Delta updates, compression, SPIFFS updates.
- Image signing beyond the transport and sha256.
- An account-wide "update all" screen.
- Erasing NVS on update.
