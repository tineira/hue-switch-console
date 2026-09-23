# Changelog

What shipped on main for the console, the Round Display, and the Simple switch. Rebuilt from git history on 2026-09-22. Newest first.

A firmware heading is the FIRMWARE_VERSION that landed on main. Add the next heading in the same change that bumps that version. Copies of installer images into this repo are listed under the firmware.

Docs-only commits, scratch notes, and ignore-file chores are left out.

## Console

The web app has no user-facing version. Each heading is the day the change landed.

### 2026-09-23

- How-to explains the Simple switch orange LED.
- Install asks you to hold BOOT. It does not toggle the USB reset lines that hang on Windows. If the chip does not name itself, the write is aborted.

### 2026-09-22

- Devices is the USB screen, and /install redirects there. One page detects the XIAO, flashes firmware, writes Wi-Fi, and stores the device token.
- An unidentified port says the board was not identified. Choose C6 or S3 before Install.
- Detect does not read the chip with esptool, so Chrome is not killed.
- 303A:1001 is a running sketch when the board answers HUEGET.
- The Devices card shows the board MAC.

### 2026-09-21

- The installer waits for a full Improv frame and logs leftover USB bytes.
- Opening the serial port no longer pulses DTR.
- After a DTR reset drops the COM port, the page opens Web Serial again.

### 2026-09-20

- Chrome can install a switch: flash, an Improv Wi-Fi list, and HUESET for the console token. The wizard shows Improv packets, waits out the scan, and pings the board before listing networks.
- Round pages have an editor, inline names, a dim target, and a room or zone anchor. Device config GET fills in the group and the dim set.
- Round screen timeout is stored with the device config.
- Device config carries the contract fields for revision, product, and dim caps.
- A channel can run a scene on short press, on, and off. The Hue action menu uses the console theme.
- The theme picker has 17 palettes, drawn as swatches, collapsed until opened, including on a narrow screen.
- A switch can have a display name that exists only in the console.
- Sign-in, API keys, and Bridge assignment. Persistence moved from Supabase to Neon.

### 2026-09-19

- A switch can post its topology, and the console shows that Bridge's lights, rooms, and scenes.

## Round

Headings are FIRMWARE_VERSION on main for the Round Display (XIAO ESP32-S3). 0.4.1 was never tagged. The 0.5.7 commit moved the macro from 0.5.0 to 0.5.7, so 0.5.1 through 0.5.6 were never tagged. 0.5.14 was a web-setup branch build, also copied into an installer image here. On main the macro went from 0.5.13 to 0.5.15, then to 0.5.16.

<!-- 2deb44b -->

### 0.5.26 — 2026-09-23

- After a restart, the board uses the Wi-Fi network saved by Improv instead of showing No Wi-Fi.

<!-- ced21c6 -->

### 0.5.25 — 2026-09-23

- The disc stays on Token rejected after the console returns 401, and on No Bridge when the Hue key is refused.

<!-- e4e9ed0 -->

### 0.5.24 — 2026-09-22

- A new Hue key is kept if the first check after pairing fails.

<!-- 8ea396f -->

### 0.5.23 — 2026-09-22

- Only an hsw_ key counts as a console token.

<!-- a8739e5 -->

### 0.5.22 — 2026-09-22

- The board answers HUEGET, HUEPAIR, and HUECLR over USB.

<!-- 26d918d -->

### 0.5.21 — 2026-09-21

- A Wi-Fi scan retries when the radio reports FAILED.

<!-- 04fe9c1 -->

### 0.5.20 — 2026-09-21

- Boot pushes Improv READY without calling Serial.flush.

<!-- f60fde6 -->

### 0.5.19 — 2026-09-20

- An Improv Wi-Fi scan is acknowledged over USB, and the board keeps polling during boot.

<!-- 59becd3 -->

### 0.5.18 — 2026-09-20

- An Improv scan is acknowledged as soon as the request arrives.

<!-- cdcae20 -->

### 0.5.17 — 2026-09-20

- The board waits until the Wi-Fi scan finishes before answering Improv with an empty list.

<!-- 6a0cd0d -->

### 0.5.16 — 2026-09-20

- Improv Serial and HUESET for USB setup from the console. The product build keeps CDC logs off, stores Wi-Fi through the Arduino STA API, and keeps the console token and URL in NVS.

<!-- be53698 -->

### 0.5.15 — 2026-09-20

- Touch and pages stay live while the board polls the console, and dimming follows the console dim set.

<!-- ce79b2c -->

### 0.5.13 — 2026-09-20

- Idle holds the backlight PWM at zero, so the panel actually goes dark.

<!-- 068f269 -->

### 0.5.12 — 2026-09-20

- The backlight pin leaves the UART matrix, so idle can turn it off.

<!-- fe6e100 -->

### 0.5.11 — 2026-09-20

- The display sleeps after the idle timeout. The first touch only wakes it.

<!-- a1571e8 -->

### 0.5.10 — 2026-09-20

- After a scene recall, the dimmer ring refreshes from the Bridge.

<!-- db42f61 -->

### 0.5.9 — 2026-09-20

- The Ready fill splits when tap and double-tap target two different child lights.

<!-- f95cd58 -->

### 0.5.8 — 2026-09-20

- Ready keeps taking touch while a Hue request runs on a worker.

<!-- bf39161 -->

### 0.5.7 — 2026-09-20

- HWCDC flashing, SERIAL_DEBUG, the original double-tap, and the dim fallback are restored.
- This commit moved the version macro from 0.5.0 to 0.5.7.

<!-- a80af98 -->

### 0.5.0 — 2026-09-20

- Each page is anchored to a Hue group. Dimming targets that group or the action lights.

<!-- b0c9fc9 -->

### 0.4.2 — 2026-09-20

- Config backups no longer stack. USB CDC uses TinyUSB.

<!-- 3c2de1d -->

### 0.4.0 — 2026-09-20

- Pages, swipe between them, and themed scene cycling.

<!-- c09a679 -->

### 0.3.0 — 2026-09-20

- The center button follows Hue on/off, and the dimmer ring stays in sync.

<!-- 8f12724 -->

### 0.2.0 — 2026-09-20

- Brightness ring, loading screen, and touch mapping.

<!-- 1879448 -->

### 0.1.0 — 2026-09-20

- First Round Display firmware for the XIAO ESP32-S3.

## Simple

Headings are FIRMWARE_VERSION on main for the Simple switch (XIAO ESP32-C6). The first numbered build is 0.1.1.

<!-- 45421a8 -->

### 0.2.10 — 2026-09-22

- The orange LED stays on the new Hue key step if the first check after pairing fails.

<!-- d8ea208 -->

### 0.2.9 — 2026-09-22

- Only an hsw_ key counts as a console token.

<!-- b4412cc -->

### 0.2.8 — 2026-09-22

- The board answers HUEGET, HUEPAIR, and HUECLR over USB.

<!-- 851ee76 -->

### 0.2.7 — 2026-09-22

- The orange LED plays a counted burst and is driven active-low.

<!-- 05ee847 -->

### 0.2.6 — 2026-09-21

- A Wi-Fi scan retries when the radio reports FAILED.

<!-- 7e00bcf -->

### 0.2.5 — 2026-09-21

- USB CDC stays up for Improv. Serial.printf goes through LOG, so a product build stays quiet.

<!-- 79bbc18 -->

### 0.2.4 — 2026-09-21

- Boot keeps pumping USB so Improv still answers after a DTR reset.

<!-- 70c0f8e -->

### 0.2.3 — 2026-09-20

- An Improv Wi-Fi scan is acknowledged over USB, and the board keeps polling during boot.

<!-- 288f3e5 -->

### 0.2.2 — 2026-09-20

- An Improv scan is acknowledged as soon as the request arrives.

<!-- 405b53f -->

### 0.2.1 — 2026-09-20

- The board waits until the Wi-Fi scan finishes before answering Improv with an empty list.

<!-- 9fa2611 -->

### 0.2.0 — 2026-09-20

- Improv Serial and HUESET for USB setup from the console. The product build keeps CDC logs off, stores Wi-Fi through the Arduino STA API, and keeps the console token and URL in NVS.

<!-- d256757 -->

### 0.1.1 — 2026-09-20

- Console polling runs off the GPIO path. A failed poll keeps the last good snapshot.

<!-- 337e20c -->

### before 0.1.1 — 2026-09-19

- First sketch for the XIAO ESP32-C6, with no version macro.
- BOOT toggles one Clip v2 light. The board discovers the Bridge, stores its address and application key, and can pair when the Bridge button is pressed.
