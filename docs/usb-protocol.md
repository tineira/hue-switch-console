# USB protocol

Contract between Setup (`/setup`, in Chrome or Edge over Web Serial) and both switch firmwares, [`hue-round-switch`](https://github.com/tineira/hue-round-switch) and [`hue-simple-switch`](https://github.com/tineira/hue-simple-switch), on the USB serial port. The HTTP side is in [`device-api.md`](device-api.md). A change here is a cross-repo change (`AGENTS.md`, "Cross-repo changes").

Console code: `lib/web-setup/` (`improv.ts`, `huecmd.ts`, `hueset.ts`, `devices.ts`, `flash.ts`) and `app/setup/setup-panel.tsx`. Firmware: `usb.h` (Simple), `usb_setup.h` (Round).

## Port and framing

- USB CDC, 115200 baud. The product binary always opens the port (`Serial.begin`) and keeps USB logs off (`SERIAL_DEBUG` 0), so log lines never mix with Improv packets. A debug build may log; Setup skips lines it does not understand.
- Two kinds of traffic share the port:
  - **Improv Serial** binary packets, starting with the bytes `IMPROV` ([improv-wifi.com/serial](https://www.improv-wifi.com/serial/)).
  - **ASCII command lines**: printable ASCII ending in `\n` (a trailing `\r` is ignored), at most 191 bytes. Every command starts with `HUE`; every answer is one line starting with `HUE`.
- The board listens from the first boot, with or without Wi‑Fi, and keeps listening after it joins a network, so a second USB session can change Wi‑Fi or the token without reflashing. There is no SoftAP, web page or BLE on the board.
- Setup reads answers by skipping any line that does not start with `HUE`.

## Improv (Wi‑Fi only)

Version 1 of Improv Serial. The firmware handles these RPCs:

| RPC | Use |
| --- | --- |
| `0x01` Wi‑Fi settings | SSID (1–32 bytes) and password (0–64 bytes). The board joins and stores the network in Arduino's persistent STA config. Answers `provisioned` (`0x04`) on success, error `0x03` (unable to connect) otherwise (after 20 s on Simple, 30 s on Round) |
| `0x02` current state | `ready` (`0x02`), `provisioning` (`0x03`) or `provisioned` (`0x04`, Wi‑Fi associated) |
| `0x03` device info | Four strings: firmware name, `FIRMWARE_VERSION`, hardware, device name. Simple: `hue-simple-switch`, version, `XIAO_ESP32C6/esp32-c6`, `Hue simple switch`. Round: `hue-round-switch`, version, `XIAO_ESP32S3/esp32-s3`, `Round Display` |
| `0x04` scan | One result per visible network, then an empty result as the terminator |

Improv carries the network only, never the console token. There is no second SSID/password copy of our own in NVS.

## Commands

| Command | Answer | Does | Since |
| --- | --- | --- | --- |
| `HUESET token <token>` | `HUEOK token` or `HUEERR …` | Stores `token` in NVS namespace `console`. A new token clears a remembered `401` | all |
| `HUESET url <url>` | `HUEOK url` or `HUEERR …` | Stores `url` in NVS namespace `console`. Accepts any `http://` or `https://` URL that fits (Round: under 128 bytes); no host allowlist | all |
| `HUEGET` | one `HUESTA` line | Read-only view of what the board has stored. No HTTP | Simple 0.2.8, Round 0.5.22 |
| `HUEPAIR` | `HUEOK pair` or `HUEERR no-wifi` | Starts the same Hue re-pair as holding BOOT for 3 s (forget the key, find the Bridge if there is no IP, wait up to 90 s for the Bridge button) and answers at once. Needs Wi‑Fi | Simple 0.2.8, Round 0.5.22 |
| `HUECLR` | `HUEOK clear` | Erases the stored Wi‑Fi network and the namespaces `console`, `hue`, `recipes` and, on Round, `pages`, in NVS and RAM. Keeps the firmware. Does not reboot | Simple 0.2.8, Round 0.5.22 |
| `HUEBOOT` | `HUEOK boot` | Simple only. Answers, waits ~100 ms so the line leaves, sets the chip's force-download-boot flag and restarts into the ROM serial bootloader. NVS and flash are untouched. Round answers `HUEERR unknown` (it resets into its bootloader over DTR/RTS) | Simple 0.2.11 |

Any other line answers `HUEERR unknown`; that is how Setup tells older firmware from newer. The text after `HUEERR ` is a reason for logs (for example `no-wifi`, `token`, `url`, `missing value`); Setup treats any `HUEERR` as a failure and only matches `no-wifi` by name.

### `HUESTA`

```
HUESTA mac=aabbccddeeff product=simple ver=0.7.1 chip=c6 ssid=HomeWiFi wifi=up ip=192.168.1.20 bid=001788fffe123456 bip=192.168.1.2 url=https%3A%2F%2Fhue.tineira.com token=1 key=1
```

One line, the twelve keys always present and in this order: `mac product ver chip ssid wifi ip bid bip url token key`. Fields are separated by one space; each is `key=value`. A value is empty when nothing is stored.

Values are percent-encoded: bytes other than `A–Z a–z 0–9 - . _ ~` are sent as `%HH` with uppercase hex, and the decoded bytes are UTF-8. Setup rejects the whole line on a broken `%` sequence, a missing or misordered key, or a value out of range.

| Key | Value |
| --- | --- |
| `mac` | Wi‑Fi MAC, 12 lowercase hex, the same as in register |
| `product`, `ver` | `simple` or `round`, and `FIRMWARE_VERSION` |
| `chip` | `c6` or `s3`: what the sketch was built for. Setup cross-checks it with the USB ids |
| `ssid` | The stored network name. Never the password |
| `wifi`, `ip` | `up` and the IP when associated; `down` and empty otherwise |
| `bid`, `bip` | Full `bridgeid` and Bridge IP from NVS `hue`, or empty |
| `url` | NVS `console` `url`, or empty |
| `token` | `1` only if NVS `console` `token` looks like a console key (`hsw_` plus 16–76 base64url characters); else `0`. The token itself is never sent |
| `key` | `1` if a Hue application key is stored (paired); else `0`. The key itself is never sent |

The Wi‑Fi password, the console token and the Hue key never leave the board over USB.

## NVS written over USB

| Where | What | Written by |
| --- | --- | --- |
| Arduino persistent STA (Wi‑Fi driver NVS) | SSID and password | Improv `0x01` |
| Preferences namespace `console` | `token` (`hsw_…`), `url` (console origin) | `HUESET` |

The firmware owns every other namespace (`hue`, `recipes`, `pages`, `ota`); USB only reads `hue` through `HUEGET` and erases namespaces through `HUECLR`. Register and poll read the console URL and token from `console` only; nothing is compiled in (`config.h` holds only `SERIAL_DEBUG`).

## Flashing

Setup writes four parts with esptool-js at fixed offsets: `bootloader.bin` `0x0`, `partitions.bin` `0x8000`, `boot_app0.bin` `0xe000`, `firmware.bin` `0x10000` (README, "Flash layout"). It never erases flash, so NVS (Wi‑Fi, `console`, `hue`, recipes, pages) survives a reflash, as it does an OTA update. Before writing, it reads the chip and stops unless it matches the product: ESP32-C6 for Simple, ESP32-S3 for Round.

USB ids Setup recognizes (Chrome exposes only vendor and product id):

| USB id | Board |
| --- | --- |
| `2886:0048` | XIAO ESP32-C6 |
| `2886:0056` | XIAO ESP32-S3 |
| `2886:0063` | XIAO ESP32-S3 Plus (not supported) |
| `2886:0067` | XIAO ESP32-C5 (not supported) |
| `303A:1001` | Espressif USB Serial/JTAG: the ROM bootloader, and also the running sketch on C6 and on Round. Does not tell C6 from S3; Improv info or `HUESTA` `chip` does |

Simple install: when the firmware answered at Detect, Setup sends `HUEBOOT` and, on `HUEOK boot`, keeps the same port open and connects esptool without a reset (reopening the C6 port would reset it out of download mode). On `HUEERR unknown` or no answer within 1.5 s, it asks the person to hold BOOT and tap RESET. After the write, Setup clears the force-download-boot flag (`LP_AON_SYS_CFG_REG` bit 30 on the C6) and asks for one RESET press. Round resets into its bootloader over DTR/RTS. After a flash the port drops and the person picks it again; the COM number may change.

## Order

1. **Detect:** pick the port, Improv device info, then `HUEGET`. Older firmware that does not know `HUEGET` can still be flashed and given Wi‑Fi.
2. **Install or Update** when needed (same flash; the label depends on the version). A mismatched chip or product gets no provisioning, only the firmware for the USB board.
3. **Wi‑Fi** with Improv.
4. **Token**, only with `wifi=up`: Setup creates a new device key (`POST /api/keys`, the person never sees it), then sends `HUESET token`, then `HUESET url`, each waiting for its `HUEOK`. Always after Improv, never interleaved with Improv packets. The URL is the console's `DEVICE_CONSOLE_URL` (else `BETTER_AUTH_URL`, else the Setup page's origin); Setup asks before it moves a board whose stored `url` has another host. If `HUESET` fails, the new key exists only in the console and can be revoked on API keys.
5. **Pair** (`HUEPAIR`), optional, only with `wifi=up`: Setup re-reads `HUEGET` until `key=1` or the 90 s run out.

Setup is done when Wi‑Fi and the token are stored. The board registers once it has paired with a Bridge (`device-api.md`).

History: [`devices.md`](archive/specs/devices.md), [`web-setup.md`](archive/specs/web-setup.md) and [`usb-download-mode.md`](archive/specs/usb-download-mode.md) in the frozen archive.
