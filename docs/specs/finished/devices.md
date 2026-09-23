# Devices — detect, flash and provision over USB

**Requirements** document. The product screen is called **Devices**. Install is an action on that screen, not a page of its own.

Covers `hue-switch-console` and the USB side of both firmwares. Flashing, the bins and the command that writes the token already exist; `docs/specs/web-setup.md` is closed and deprecated (reference only). This file sets **the order and which buttons are enabled**. Wi‑Fi OTA stays in `docs/specs/ota.md`. The Simple's orange LED (no PC) is in `hue-simple-switch/docs/specs/finished/led-status.md`.

**Status:** implemented (console `/devices`, Simple 0.2.8, Round 0.5.22). Spec archived. Not an implementation gap.

**Closed on 2026-09-22 (grilling):** §7. Do not reopen.

---

## 1. Verdict

A single entry action: **Detect device**. The user picks the COM port (Web Serial). The card shows what **this board** has stored, not what the console remembers from an old register.

After that, only the actions that card allows are enabled. There are no two wizards (install vs maintain). Wi‑Fi can be set without a token and without a Bridge. The token is only created once Wi‑Fi is associated.

The console never calls the Bridge. The browser does not talk to the Bridge. This slice does not test live whether the token works or whether the Bridge answers. That is out: on Simple, a 401 from those calls changes the LED.

---

## 2. What Detect shows

### Board (USB, without asking the sketch)

Chrome only provides `vendorId` and `productId` (`SerialPort.getInfo()`). There is no product name or USB revision.

| USB | Reading |
| --- | --- |
| Seeed `2886:0048` | XIAO ESP32-C6 |
| Seeed `2886:0056` | XIAO ESP32-S3 |
| Seeed `2886:0063` | XIAO ESP32-S3 Plus — not supported |
| Seeed `2886:0067` | XIAO ESP32-C5 — not supported |
| Espressif `303A:1001` | USB Serial/JTAG. Used by the ROM bootloader **and** the product sketch (C6, and Round with Hardware CDC). The PID does not tell C6 from S3 |
| Anything else, or no identifier | The user picks C6 or S3 and **Install** writes that firmware. While writing, the flasher reads the chip and stops if it doesn't match |

Seeed `2886:0048` / `2886:0056` win when they appear. On `303A:1001`, Detect opens the port and tries Improv and `HUEGET`. If the sketch reports the chip, that is the board and nothing is asked. If it doesn't answer, it's the bootloader: the UI asks C6 or S3. When flashing, the chip the flasher reads wins over that answer: if it doesn't match, nothing is written.

### Firmware (only if the sketch answers)

Improv already provides name and version. The rest is a text command on the same CDC as `HUESET`:

```
HUEGET
HUESTA mac=aabbccddeeff product=simple ver=0.2.7 chip=c6 ssid=Milka2 wifi=up ip=192.168.1.20 bid=001788fffe123456 bip=192.168.1.2 url=https://hue.tineira.com token=1 key=1
```

A single line. The keys are always present; the value is empty if nothing is stored. `wifi` is `up` or `down`. `token` and `key` are `1` or `0`.

| Field | Rule |
| --- | --- |
| `mac` | Wi‑Fi MAC, 12 lowercase hex, the same as in register |
| `product` + `ver` | `simple` / `round` + `FIRMWARE_VERSION` |
| `chip` | `c6` or `s3`, what the sketch believes it is. Cross-checked with USB |
| `ssid` | The stored name. **Never** the password |
| `wifi` + `ip` | `up` and the IP if associated. `down` and empty IP if not |
| `bid` + `bip` | Full `bridgeid` and Bridge IP, or empty. There is no short id |
| `url` | The stored URL, or empty |
| `token` | `1` only if what's stored is a console key (`hsw_…`). Any other text counts as no. The token is not sent |
| `key` | `1` if there is a Hue application key. The key is not sent. **Paired** = `key=1` |

The Wi‑Fi password, the token and the Hue key are never sent. The Hue tree, pages and recipes are not requested. Those live in the console if the device already registered.

There is no **"Tested now"** block in this slice. The card is only **"Stored"**.

If the `mac` is already in the database, next to it: when the console last saw it and the firmware the console believes it runs. If that doesn't match USB, the mismatch is shown. The USB card is not overwritten by the database row.

A firmware that doesn't understand `HUEGET` can still be flashed and save Wi‑Fi with Improv. For that board, Detect shows the PID and, if Improv answers, name and version. Token, Pair, Clear and the rest of the card wait for `HUEGET`.

Mismatch: the sketch's `chip` is not the USB one, or the `product` is not that board's (C6 = Simple, S3 = Round). No provisioning. The only flash offered is the USB board's firmware (§3).

---

## 3. Which button is enabled

| What Detect sees | Actions |
| --- | --- |
| Odd USB, C5, S3 Plus | None. "Not supported" |
| Bootloader `303A:1001` | Ask C6 or S3. Then **Install** that board's firmware |
| Seeed C6 or S3, the sketch doesn't speak our protocol | **Install** that board's firmware |
| Our firmware, chip and product match | Wi‑Fi. Token and Pair only with `wifi=up`. **Update** only if `ver` is lower than the manifest. Clear NVS |
| Our firmware up to date, chip and product match | No prominent Update. Wi‑Fi. Token and Pair only with `wifi=up`. Reinstall (secondary). Clear NVS |
| USB chip and the sketch's product (or chip) don't match | No Wi‑Fi, no token, no Pair, no Clear. **Install** the firmware matching the USB chip |

**Install and Update are the same flash** (`web-setup.md`: Web Serial, manifest bins). Only the label changes. After the reset the port drops and the COM must be picked again; the number is not assumed to stay the same.

| Board | Firmware today | Picker |
| --- | --- | --- |
| C6 | Simple only | Not asked |
| S3 | Round only | Not asked |
| More than one bin for that board (future: S3 + Simple) | | The user picks **before** flashing |

Do not offer a downgrade if the board already has a **higher** version than the manifest of **that** product. Install on a mismatch does not compare versions between Simple and Round: it writes the current binary for the USB board.

**Clear NVS** is not in the "change Wi‑Fi" row. Only with our firmware and the chip matching the product. Not on the bootloader or a mismatch.

It erases the Wi‑Fi Arduino remembers (SSID and password), the `console` namespace (token, URL), `hue` (IP, key, bridgeid), `recipes`, and on Round also `pages` (pages, axis, timeout, last scene). Simple has no `pages`. It keeps the firmware. It does not erase the rest of the chip's flash.

English confirmation: *This forgets Wi-Fi, the console token, the Hue link, and saved recipes or pages. The firmware stays.*

The command clears flash and the RAM copy. It does not reboot. The card is read again on the same cable.

**Pair** only with `wifi=up` and chip/product matching. It does the same as holding BOOT for 3 s: if there is a key it deletes it, looks for the Bridge if there is no IP yet, and waits up to 90 s for the Bridge button. The USB command returns immediately (`HUEOK pair`, or an error if there's no Wi‑Fi). The 90 s run on the device. The page re-reads `HUEGET` until `key=1` or the time runs out.

If `key=0`, it starts right away. If `key=1`, the page confirms first: *This forgets the current Hue link and starts pairing again.* Then: *Press the button on the Hue Bridge.* Paired on the card = `key=1`, not a GET to the Bridge.

**URL and token are not a form.** Token only with `wifi=up`. A paired Bridge is not needed. Each click creates a new API key. Over USB, that key and `https://hue.tineira.com` are written with the existing `HUESET`. The user does not see the token. "Change token" is that same click again.

---

## 4. Order for a new device

1. Detect.
2. If it's the bootloader, the person says C6 or S3. If the PID is already Seeed, nothing is asked.
3. Install (the single firmware, or the chosen one if there are several).
4. The port drops; Detect again (as in `web-setup.md`).
5. With the sketch running: Wi‑Fi (scan on the device, Improv). With `wifi=up`, token. Then Pair if Hue is wanted.
6. The card re-reads itself when each action finishes.

Provisioning done = Wi‑Fi remembered + token in NVS. Pair is needed for the lever or the disc to talk to Hue, but it does not block the flash or the token. The page does not wait for the MAC to appear in the console list.

---

## 5. What does not change

- No SoftAP. No Arduino IDE on the user's PC.
- The browser does not compile. The bins come from CI, served by the console.
- The Wi‑Fi password and the token are not written on the page, and they don't come back in the read.
- The Simple's LED is not used for this card. It's for when there is no PC. This slice does not trigger the calls that move that LED.
- OTA over the network does not replace this USB path.

---

## 6. USB commands

In addition to Improv and `HUESET`, on Simple and Round:

| Command | Answer | Does |
| --- | --- | --- |
| `HUEGET` | one `HUESTA` line (§2) | Read-only view of what is stored. No HTTP |
| `HUEPAIR` | `HUEOK pair` or `HUEERR no-wifi` | Starts the same re-pair as BOOT 3 s and returns immediately |
| `HUECLR` | `HUEOK clear` | Erases what §3 lists, RAM included, without rebooting |

`HUEPAIR` with Wi‑Fi and no Bridge IP looks for the Bridge like the existing re-pair. If it doesn't find it, the key doesn't appear and the card stays unpaired.

Firmware older than Simple 0.2.8 or Round 0.5.22 does not understand these commands. In that case Detect only shows the USB PID and, if Improv answers, the name and version.

---

## 7. Closed decisions (grilling 2026-09-22)

Do not reopen in the slice.

| # | Decision |
| --- | --- |
| 1 | `HUEGET` → one `HUESTA` line with what is stored, MAC included, full `bridgeid`. No secrets. No tests in that line. |
| 2 | This slice has no "Tested now". The card is only "Stored". |
| 3 | Pair = BOOT hold 3 s. The command returns immediately. Confirmation only if there is already a key. Paired = `key=1`. |
| 4 | Clear erases Arduino's Wi‑Fi, `console`, `hue`, `recipes` and, on Round, `pages`. Keeps the firmware. No reboot. Only if chip and product match. |
| 5 | Mismatched chip and firmware: no provisioning. The only flash is the USB chip's firmware. |
| 6 | Token only with Wi‑Fi associated. Each click creates a new key and writes `https://hue.tineira.com`. The Bridge is not needed. |
