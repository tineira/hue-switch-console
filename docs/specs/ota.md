# Hue Switch — OTA and version in the console

**Product requirements** document. Covers `hue-switch-console` and the firmware of **both** devices (Round S3, Simple C6).

Not an implementation guide. The console **never** calls the Bridge. The Bridge **never** sees Vercel.

**Status:** requirements, not implemented.

Related: `docs/specs/finished/web-setup.md` (USB + Chrome = **blank** device). This spec is the device **already on the wall**: see which firmware runs, offer a new binary, confirm the rollout **arrived**.

---

## 1. Verdict

1. **Every device reports its version** on every poll (and on register). The console shows it and **compares** it with the published binary for that product.
2. **OTA is not automatic.** The user (on hue.tineira.com) chooses which MAC gets which version. Only then does the poll include an `ota` offer. Without an offer, the device downloads nothing.
3. **USB is not replaced.** A XIAO without Wi‑Fi still goes through the web installer. OTA is the update path.

The C6 is at its RAM limit: the OTA client must be the HTTP it **already** uses for the console (verified TLS), not a new stack. If the C6 cannot download the binary, that is documented and Simple stays on USB; Round does not wait for the C6 to get OTA.

---

## 2. What exists today

- Register already sends `firmware` (free string). Postgres `switches.firmware`. The list shows `· fw 0.5.13` if it came in the last register.
- The **GET config** poll does not send the version → between registers the console doesn't learn about a USB/OTA update.
- Partitions are **already** dual OTA (`app0`/`app1`) on Round (`default_8MB`, ~3.2 MB) and Simple (`min_spiffs`, ~1.9 MB). The sketch does not download.
- NVS (SSID, token, Bridge, recipes, pages) survives a proper OTA.

That is not enough to **control a rollout**: there is no catalog of "what's published", no per-MAC offer, and no "still on 0.5.12" signal.

---

## 3. Expected result

In the switch list (and in the device detail), English copy:

| Shown | Means |
| --- | --- |
| `fw 0.5.13` | What the device last **reported** |
| `latest 0.5.14` | Published binary for that product (`round` / `simple`) |
| `current` | Reported = latest (or = the target we asked for) |
| `behind` | Reported &lt; latest and there is **no** pending offer |
| `offered 0.5.14` | We sent OTA in the poll; it doesn't report that version yet |
| `failed` | The offer expired, or the device reported the old version again after a recent `seen` |
| `seen …` | Already exists (`last_seen_at`). Keeps "didn't update" apart from "is off" |

Actions (same signed-in user, not the device Bearer):

- **Offer update** to this MAC (or "to all Rounds / all Simples" = N offers, not a magic broadcast).
- **Cancel offer** (the next poll no longer carries `ota`).
- No "auto-update all at 04:00" in v1.

After a successful OTA: the device reboots, polls/registers with `firmware: "0.5.14"`, and the row becomes `current`. That **is** the rollout proof. No extra ack is needed if the report + `last_seen_at` are fresh.

---

## 4. Version

Same string as `FIRMWARE_VERSION` today: `major.minor.patch` (e.g. `0.5.13`). Required on register and poll. Reject empty in product firmware (dev can keep sending anything).

Compare as semver, not free text. Round and Simple have **separate lines** (a Round 0.5.13 is not a Simple 0.5.13).

---

## 5. Console

### 5.1 Binary catalog

Per product (`round` | `simple`):

- `version`
- HTTPS URL of the **app** `.bin` (the OTA slot; no need to resend the bootloader)
- `sha256`
- `size` (bytes)
- `publishedAt`

Source: CI on push to each repo's `main`, or a maintainer upload. The URL is on the same trusted host as the console URL (or a listed origin). Never plain HTTP in production.

"Latest" = the newest published for that product.

### 5.2 Per-MAC offer

A table (or columns), e.g. `ota_target_version`, `ota_offered_at` on `switches`.

Offer: store target = latest (or a pinned version). Cancel: clear the target.

The GET config includes an `ota` block **only** if that MAC has a target **and** `target != reported firmware`.

### 5.3 Poll reports the version

Today: `GET /api/device/config?mac=…`

Add a query parameter, **required in new firmware**:

```
GET /api/device/config?mac=aabbccddeeff&firmware=0.5.13
```

The server updates `switches.firmware` and `last_seen_at` on **every** poll, not only on register. Old firmware without the parameter: the column is kept; the UI can show `fw unknown` if `last_seen` is recent and there is no string.

### 5.4 `ota` response (only if there is an offer)

Alongside `rev` / `recipes` / `pages`:

```json
"ota": {
  "version": "0.5.14",
  "url": "https://hue.tineira.com/…/round-0.5.14.bin",
  "sha256": "…",
  "size": 1234567
}
```

Without an offer, **omit** `ota`. The device does not interpret "absent" as "erase firmware".

Round and Simple: the same field; the `url` points to **that** product's binary. Flashing the other product's binary is a catalog error, not a gesture error.

### 5.5 UI

In the switch row (next to MAC · fw · round · rev · seen):

- Reported version **always** visible (today it is lost if `firmware` is null).
- Badge `current` / `behind` / `offered` / `failed` per §3.
- `Offer update` button if behind or if latest &gt; reported. `Cancel` if offered.

No "fleet" screen in v1: the bridge list **is** the rollout board.

English copy.

---

## 6. Firmware (both)

### 6.1 Report

Every GET config carries `firmware=<FIRMWARE_VERSION>`. Register keeps sending the JSON `firmware` field.

### 6.2 Apply OTA

If the JSON carries `ota` and `ota.version` ≠ the local one:

- Do not start if a recipe/dimmer is in flight, a touch is down, or (Round) the ring is being dragged.
- Round: may be **asleep** (backlight off); better that way (radio on, panel off).
- HTTPS GET of the `url` with **the same** trust as the poll (bundle; no `setInsecure()`).
- Check `size` / `sha256` before marking the slot bootable.
- Write the **inactive** slot; on success, `otadata` + reboot.
- NVS is not erased.
- One attempt per offer. If it fails (TLS, space, sha, power cut): **do not** retry in a tight loop. The next poll, if the offer is still there, may retry with backoff (minimum minutes). The console sees `offered` + old `fw` + fresh `seen` → the human decides to cancel or let it retry.

C6: if the download does not fit in RAM, the firmware **ignores** `ota` and keeps reporting the old version. The console does not lie: it stays `offered` / `behind`. Do not invent a SoftAP or a second HTTP stack.

### 6.3 Hue / touch

OTA must not block the disc more than a long poll already does. Prefer a worker or the same task as the console poll (the Round touch loop must **not** do the download synchronously: see `hue-round-switch/docs/specs/finished/input-during-hue.md`). Simple: the GPIO loop can tolerate a download; still, don't mix it with a Hue PUT.

### 6.4 Boot failure

Dual slot: if the new app doesn't boot, the ROM falls back to the previous one. On return, it polls with the **old** version → console `failed` / `offered` per §3.

---

## 7. Relation to web-setup

| | USB (`web-setup`) | OTA (this spec) |
| --- | --- | --- |
| New device | Yes | No |
| Already on Wi‑Fi | Possible, awkward | Yes |
| Who picks the binary | Install page | Per-MAC offer |
| Proof it ran | Register `firmware` | Poll `firmware` + seen |

Same CI artifacts. The USB manifest may include the bootloader; OTA only the app.

---

## 8. Out of scope (v1)

- Silent auto-update / fixed schedule.
- Delta updates, unusual compression, SPIFFS A/B.
- Signing with a key other than the host's TLS (v1 = HTTPS + sha256).
- Eventstream, SoftAP portal, Improv (they stay in their own specs).
- Forcing OTA on Simple if the binary doesn't fit in RAM.
- Erasing NVS or recipes on update.
- Offering a `.bin` to a switch of the other product.

---

## 9. Definition of done

- A bridge's list shows each MAC's **reported fw**, updated on the **poll**, not only on register.
- **Latest** per product is visible, with a current / behind / offered / failed badge.
- Offer update to a Round in the field: the poll carries `ota`; after reboot, that row shows the new version and `current` (with a fresh `seen`).
- Cancel offer: the poll stops carrying `ota`; the device does not download.
- Without an offer, no device downloads a binary just because CI published one.
- USB install (`web-setup`) is still the path for blank devices.
- A developer build with arduino-cli does not break; once connected, the poll still updates `firmware` in the list.
