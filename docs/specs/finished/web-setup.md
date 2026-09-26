# Hue Switch — install from the browser

**Product requirements** document. Covers `hue-switch-console` (hue.tineira.com) and the firmware of **both** devices:

| Product | Repo | Chip |
| --- | --- | --- |
| Round Display | `hue-round-switch` | XIAO ESP32-S3 |
| Simple (GPIO) | `hue-simple-switch` | XIAO ESP32-C6 |

Not an implementation guide or a changelog. The console **never** calls the Bridge. The Bridge **never** sees Vercel.

**Status: closed and deprecated (2026-09-22).** The ritual is already in the Install screen (flash, reconnect COM, Improv, `HUESET`). It is not reopened. Scan and `HUEOK` reliability are handled later, outside this document. The follow-up screen was implemented: `docs/specs/finished/devices.md`. This file remains only as a reference for **how** USB works (bins, Improv, token).

OTA for devices already on Wi‑Fi: `docs/specs/ota.md`.

At the time of writing, each XIAO was configured with a compiled `config.h` (`WIFI_SSID`, `WIFI_PASSWORD`, `CONSOLE_URL`, `CONSOLE_TOKEN`) and a PC with Arduino. The Bridge was already mDNS + BOOT + NVS on both. This document unifies **flash + Wi‑Fi + token** in **one** console screen.

---

## 1. Verdict

A **new, blank** device is made ready **without Arduino IDE or arduino-cli** on the user's PC.

**Desktop** Chrome or Edge, on `https://hue.tineira.com`, USB to the XIAO:

1. **Flash** the prebuilt firmware (Web Serial + esptool-js, the same *pattern* as ESP Web Tools: manifest + parts + offsets). The stock `<esp-web-install-button>` is not used: the **port must be kept** for Improv and the token command.
2. After the reset, **the same page asks for the COM port again** (the port drops; on the first flash the COM can change from ROM to CDC).
3. **Improv Serial** writes the 2.4 GHz network. Arduino **remembers** that network (the core's persistent STA).
4. The console **creates** a new API key and, over USB, **our own command** stores token + URL in NVS. The user does not copy `hsw_…`.

Same mechanism for Round and Simple. Which board it is, and whether the product must be asked, is defined in `docs/specs/finished/devices.md` (Detect first; the firmware picker only if that board has more than one bin). If the chip that shows up is not that product's, **it is not flashed**.

The browser **does not compile**. The `.bin` files are built by CI on push to each firmware's `main` and served by the web.

There is no SoftAP portal on the ESP. The C6 is at its RAM limit; a mini-site on the chip would be one thing on Round and would not fit the same way on Simple. **The console is the portal.** The firmware only speaks USB.

This screen does **not** pair Hue and does **not** wait for the MAC to appear in the list. Done = Wi‑Fi remembered + token in NVS.

---

## 2. What stays the same

- Hue pairing: mDNS, Bridge button, NVS. BOOT 3 s re-pair. Does not go through Vercel.
- Recipes / pages: console poll as before. `POST /api/device/register` **still requires** a Bridge (`bridgeid` + snapshot). That contract does not change.
- TLS to the console host: verify the certificate. `setInsecure()` only against the Bridge.
- `config.h` still exists for **development**: if Arduino has no remembered network **and** NVS `console` has no token, the sketch uses the `#define`s. In the binary served by the web installer, those `#define`s are **empty**; what was written over USB wins. (Later: `config.h` was reduced to `SERIAL_DEBUG` only.)

---

## 3. Expected result

| Situation | What happens |
| --- | --- |
| PC with Chrome, USB, user signed in to hue.tineira.com | Picks Round or Simple → *Install* → allows the port → if the chip doesn't match, abort → flash (manifest version visible) → reconnect COM → 2.4 GHz Wi‑Fi (scan + field) → token over USB → *Wi-Fi saved. Press the Hue Bridge button, then hold BOOT 3s if it asks.* |
| First flash of an S3 or C6 | **BOOT** may be needed while plugging in. Copy: *Hold BOOT if this is the first flash*. |
| Chip ≠ chosen product | Does not flash. *This USB device is not a Round Display* / *not a simple switch*. |
| Flash ok, provisioning failed or the COM was lost | *Configure Wi-Fi* without flashing again. Pick the port again. |
| Safari / iPhone / Firefox | Out. Copy: *Use Chrome or Edge on a computer*. |
| Arduino on the same PC | Still valid for developers. Not the product path. |
| Dev against `localhost` | **Outside this screen.** The XIAO is not the PC; `localhost` on the device doesn't reach Next. Dev = arduino-cli. Product = `https://hue.tineira.com`. |
| Device already on the wall, Wi‑Fi changed, **with** USB | No reflash: Improv + token command again. |
| Device already on the wall, Wi‑Fi changed, **without** USB | Out of v1 (no SoftAP or BLE). |

UI copy in **English**.

---

## 4. Console (hue.tineira.com)

Install screen (or wizard), authenticated (human session, not the device Bearer).

### 4.1 Flash

- **One manifest per product** (not a mixed JSON that auto-picks). Parts: bootloader, `partitions`, `boot_app0`, app. Offsets = those of the `arduino-cli` export for that `sketch.yaml` (Round `default_8MB`, Simple `min_spiffs`).
- Before writing: read the chip over serial. S3 only with the Round manifest. C6 only with the Simple manifest. Otherwise abort (§3).
- **No erase** of flash. NVS (Hue, recipes, pages, `console`) survives a reflash, as with OTA. A blank device is already empty.
- Web Serial over HTTPS (production) or `http://localhost` **only for console developers**; the product device does not point to localhost (§3).
- After the write, the XIAO resets. The wizard **asks for the port again**. Do not assume the same `COM`.

Artifacts: CI on push to `main` of **each** firmware repo (`arduino-cli compile --export-binaries` with empty `WIFI_SSID` / `CONSOLE_TOKEN` / `CONSOLE_URL`). Versioned with `FIRMWARE_VERSION` (e.g. `0.5.13`). The console serves or proxies that origin. A maintainer zip may exist; it is **not** the hue.tineira.com path.

### 4.2 Provision (same USB session, another open of the port)

Fixed order:

1. **Improv Serial** (CDC): 2.4 GHz network. UI = scan (`0x04`) + manual field. Copy *Wi-Fi (2.4 GHz)*. Arduino persists the STA. Improv does **not** carry the token.
2. If Improv ends `provisioned`: `POST /api/keys` with a name like `USB 2026-09-20 14:02` (human session). The plaintext is **not shown**. An old key is not reused (the server no longer has it).
3. On the same CDC, **after** Improv (do not mix with `IMPROV` packets), ASCII lines ending in `\n`:

```
HUESET token hsw_…
HUESET url https://hue.tineira.com
```

The device answers `HUEOK token` / `HUEOK url` (or `HUEERR …`). It stores NVS namespace `console`, keys `token` and `url`.

`url` is not shown in the product UI (always the default). The command is still sent, with `https://hue.tineira.com`, so NVS does not depend on the `#define`.

If the flash succeeded and this fails: *Configure Wi-Fi* without reflashing. Do not leave an orphan key on purpose: the mint happens **after** a successful flash **and** Improv `provisioned`. If `HUESET` fails, that key exists in the console and not on the device; the user can revoke it in Keys. It is not the happy path.

### 4.3 Afterwards

The device joins STA with the network Arduino remembered. The token in NVS enables register **once there is a Bridge**. Round vs Simple branch as before.

Pairing the Bridge = Bridge button + BOOT if needed, **not** this screen. Closing copy: *Wi-Fi saved. Press the Hue Bridge button, then hold BOOT 3s if it asks.*

---

## 5. Firmware (both)

Same contract on Round and Simple.

### 5.1 NVS

| Where | What |
| --- | --- |
| Arduino persistent STA | SSID / password (written by Improv via `WiFi.begin`) |
| Preferences namespace `console` | `token` (`hsw_…`), `url` (console host) |
| Already exists (`hue`, recipes, pages) | Bridge IP, Hue app key, recipes / pages. **Not touched** by this spec. |

There is no second `ssid` / `psk` pair of our own. A single memory of the network.

STA startup:

1. If Arduino has a remembered network → connect to it.
2. If not, and `config.h` has a non-empty `WIFI_SSID` → use that (dev).
3. If not → do **not** burn `setup` on an empty `WiFi.begin`. Wi‑Fi fail LED / screen as before, with **Improv + `HUESET` live in the `loop` right away**. No SoftAP.

With a network saved, Improv **keeps** listening over USB (change Wi‑Fi or rewrite the token without reflashing).

Register and poll read `console.token` / `console.url` (if present); otherwise the `#define`s. Product: empty `#define`s.

### 5.2 USB

**Product** binary: CDC always open (`Serial.begin`). Improv + `HUESET` parser in the `loop`. **USB logs off** (don't mix `println` with Improv). Round at the time, with `SERIAL_DEBUG=0`, didn't even open Serial: that changes in the installer binary.

Dev builds can keep logging; that is not the binary hue.tineira.com serves.

**Small** Improv parser: no `WebServer`, no `DNSServer`, no WiFiManager. Round uses the same protocol, not a richer one.

Hue, GPIO, circle, idle, pages: unchanged by this spec.

---

## 6. Out of scope (v1)

- Compiling the sketch **in** the browser.
- Safari, iOS, Firefox (no usable Web Serial).
- SoftAP / captive portal / WiFiManager on the ESP.
- SmartConfig / ESP-Touch as the main path.
- Improv BLE (reconfiguring on the wall without USB).
- Flashing one product with the other's binary (**prevented** by chip detection; not "bad luck if it happens").
- Changing Clip v2, recipes, Hue pairing, or register without `bridgeid`.
- Asking the user for arduino-cli for a product device.
- Pointing the device at `localhost` from this screen.
- Auto-erasing NVS on install.

---

## 7. Definition of done

- On hue.tineira.com, signed in, an **S3 Round** XIAO and a **C6 Simple** can be flashed from Chrome over USB, without Arduino on that machine. The UI shows the manifest version.
- A C6 in the Round flow (or the reverse) is **not** flashed.
- After the flash, the same page (reconnecting the COM) stores Wi‑Fi (Arduino) + token/url (NVS `console`). *Wi-Fi saved…* copy, **without** requiring the MAC to appear in the list.
- With the Bridge paired **afterwards** (the usual ritual), the device registers and shows up in the list. That validates the token; it is not *this* screen's success.
- A second USB session, without reflashing, can change the network and rewrite the token.
- A reflash does **not** erase recipes or the Hue key.
- A developer can keep using arduino-cli. This screen does not install against localhost.
- The C6 does not serve an HTML page. Neither does the S3, in v1: a single USB protocol.
- A Simple switch and a Round do not have two different onboarding rituals.

---

## 8. Closed decisions (grilling 2026-09-20)

Do not reopen in the slice. If someone disputes them, go back to captain-idle.

| # | Decision |
| --- | --- |
| 1 | This screen's done = Wi‑Fi + token saved. The list waits for the Bridge button. Register does not change. |
| 2 | Improv = network only. Token = `HUESET` command on the same CDC, **after** Improv. Every Install **creates** a new API key; the user doesn't see it. |
| 3 | Product binary: CDC always, USB logs off. |
| 4 | Without a network: don't give up in `setup`. Improv/`HUESET` in the `loop` from the first boot. With a network, Improv stays live over USB. |
| 5 | Arduino remembers the Wi‑Fi. Our NVS = namespace `console` (`token`, `url`). Don't duplicate ssid/psk. |
| 6 | USB does not erase. NVS survives, like OTA. |
| 7 | Two manifests. Detected chip ≠ product → don't flash. |
| 8 | Each firmware's CI publishes the product `.bin` (empty defines). "Uploading by hand" is not the hue.tineira.com path. |
| 9 | Token mint **after** a successful flash and Improv `provisioned`. Product = `https://hue.tineira.com`. Localhost is not this screen. |
