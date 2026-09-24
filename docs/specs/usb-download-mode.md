# Install the Simple without buttons

Cross-repo spec. Process: `AGENTS.md` → "Cross-repo changes".

**Status:** draft

## 1. What and why

Installing firmware on the Simple from Devices needs no button presses. Today the console cannot reset the ESP32-C6 into its bootloader on Windows (the USB-Serial-JTAG `setSignals` call hangs there), so Install asks the person to hold BOOT, tap RESET, and keep holding BOOT while it connects, and to press RESET again when the write ends. Afterwards: click Install, watch it write, and the Simple restarts on the new firmware by itself.

The Round already resets into its bootloader over DTR/RTS and is out of scope.

## 2. Contract change

### 2.1 USB command `HUEBOOT` (Simple) — additive

Added to the USB commands table (`docs/specs/finished/devices.md` §6), next to `HUEGET`, `HUEPAIR`, `HUECLR`:

| Command | Answer | Does |
| --- | --- | --- |
| `HUEBOOT` | `HUEOK boot` | Flushes the reply, then restarts the chip into the ROM download mode (serial bootloader). NVS and flash are untouched. |

- The firmware sets the chip's force-download-boot flag and calls `esp_restart()`. On the C6 that is `LP_AON_SYS_CFG_REG` / `LP_AON_FORCE_DOWNLOAD_BOOT` in `soc/lp_aon_reg.h`. Take the names from the Arduino-ESP32 3.3.12 headers, not from this spec.
- It answers before restarting, and waits ~100 ms so the line leaves over USB.
- It needs no Wi-Fi, token or Hue state, and works from every screen/state of the switch.
- Firmware that does not know it answers `HUEERR unknown` (already the case for any unknown line), which is how the console tells old from new.

### 2.2 Console Install flow (Devices) — console only

For a Simple whose firmware answered at Detect:

1. Send `HUEBOOT` on the open Detect session.
   - `HUEOK boot`: close the session, wait for the board to come back on USB (`reattachPort`), connect with `no_reset`. No dialog.
   - `HUEERR unknown` or no answer within 1.5 s: fall back to today's dialog (hold BOOT, tap RESET, OK).
2. Flash as today (watchdogs off, no baud change).
3. After the write:
   - Clear the force-download-boot flag with a register write (in case the ROM keeps it set, so the next reset boots the app).
   - Restart the chip with a watchdog reset, the way Python esptool does for USB-Serial-JTAG (`--after watchdog-reset`: LP_WDT RWDT with a short timeout that resets the system). Values copied from esptool's `esp32c6.py` / `esp32c3.py` and checked.
   - The page then says the board is restarting and to click Detect when it is back, instead of "Press RESET on the board".
   - If the watchdog reset fails, keep today's text ("Press RESET on the board").

A Simple that did not answer at Detect (blank chip, or already in the bootloader) keeps today's dialog.

## 3. Compatibility

- Console with a Simple that has **not** updated (`< 0.2.11`): `HUEERR unknown` → today's dialog. Nothing breaks. The first update to `0.2.11` still needs the buttons once.
- Firmware before the console deploys: nobody sends `HUEBOOT`; the command is inert.
- The post-write watchdog reset needs no firmware support; it works for every Simple once the console ships.
- Old path: the BOOT dialog stays as the fallback for blank boards and old firmware. It is never removed.

## 4. Checklist

### Console (`hue-switch-console`)

- [ ] `lib/web-setup/huecmd.ts`: `hueBoot(session)` → `"ok" | "unknown" | "timeout"`
- [ ] Devices Install: `HUEBOOT` first, dialog as the fallback (§2.2)
- [ ] `lib/web-setup/flash.ts`: after the write, clear the flag and watchdog-reset the C6; new end text; keep the RESET text when it fails
- [ ] `docs/specs/finished/devices.md` §6: `HUEBOOT` row
- [ ] Deployed; the user installs a Simple on `0.2.11`+ with no buttons, and a Simple on `0.2.10` still works with the dialog

### Simple (`hue-simple-switch`)

- [ ] `HUEBOOT` in `usbHandleAscii` (`usb.h`): reply `HUEOK boot`, flush, ~100 ms, set force-download-boot, `esp_restart()`
- [ ] Verify on a board with `arduino-cli monitor` or the Devices USB debug log: after `HUEBOOT` the port comes back and esptool connects without BOOT (`downloadMode` / sync OK)
- [ ] Verify a RESET after that (without flashing) boots the app, not the bootloader again; report whether the flag sticks
- [ ] `FIRMWARE_VERSION` → `0.2.11`; `CHANGELOG.md` entry (user wording: installing from Devices no longer needs the buttons, after this update)
- [ ] AGENTS.md: the spec link moved to `docs/specs/finished/firmware-uploads.md`
- [ ] Pushed; CI upload `201`

### Round (`hue-round-switch`)

- Not in scope. Round resets over DTR/RTS already.

## 5. Open questions

1. **Does the force-download flag stick** after a RESET on the C6? The firmware checklist answers it on a board. The console clears it after flashing either way.
2. **Also add `HUEBOOT` to the Round** for symmetry? Proposal: no, until the Round needs it.
