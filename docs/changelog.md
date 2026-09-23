# Changelog

What changed in the console, the Round switch, and the Simple switch. Newest first.

<!-- Contributors: write each entry as what changed for the person using it, not how the code changed. -->
<!-- A firmware heading is the FIRMWARE_VERSION that landed on main. Add the next heading in the same change that bumps that version. -->
<!-- Rebuilt from git history on 2026-09-22. Docs-only commits, scratch notes, and ignore-file chores are left out. -->

## Console

The console has no version number. Each heading is the day the change went live.

### 2026-09-23

- How-to shows what the Simple switch LED and the Round screen mean, with an animated LED and a drawing of each screen, and what to do next.
- The Bridge page shows one switch at a time. Switches are tabs across the top, and the lights and scenes list stays in view while you edit.
- A switch running older firmware than the latest release is flagged on the Bridge page, with a link to update it from Devices.
- Devices and the Bridge page link straight to the matching How-to section.
- API keys, Changelog, and Sign out moved into a menu under your email. Page intros are shorter, and browser tabs show the page name.
- Installing on a Simple switch asks you to hold BOOT first, which avoids a hang on Windows. A Round switch restarts into install mode on its own. If the board cannot be identified, the install stops before writing anything.

### 2026-09-22

- Devices is the one page for USB setup: it finds the board, installs firmware, saves Wi-Fi, and links the board to the console. The old Install address opens Devices.
- If Devices cannot tell which board is plugged in, it asks you to choose Simple or Round before installing.
- Finding a board no longer crashes the Chrome tab.
- Devices recognises a board that is already running switch firmware, and shows its MAC address.

### 2026-09-21

- USB setup is more reliable. Opening the connection no longer restarts the board, and the page reconnects if the board restarts during setup.

### 2026-09-20

- You can set up a switch from Chrome: install firmware, pick a Wi-Fi network, and link the board to the console.
- Round pages have an editor: name each page, pick its room or zone, and choose what the dimmer ring controls.
- You can set how long a Round screen stays on before it sleeps.
- A Simple switch button can recall a scene on a short press, on, or off.
- The console has 17 colour themes.
- You can give each switch a name. The name is only used in the console.
- Sign-in, API keys, and assigning switches to a Bridge.

### 2026-09-19

- A switch can send its Bridge's rooms, lights, and scenes, and the console lists them.

## Round

The Round switch (XIAO ESP32-S3 with the round display). Each heading is the firmware version shown on the screen at start-up.

<!-- 0.4.1 was never tagged. The 0.5.7 commit moved the macro from 0.5.0 to 0.5.7, so 0.5.1 through 0.5.6 were never tagged. 0.5.14 was a web-setup branch build, also copied into an installer image here. On main the macro went from 0.5.13 to 0.5.15, then to 0.5.16. -->

<!-- 2deb44b -->

### 0.5.26 — 2026-09-23

- The switch remembers the Wi-Fi network you saved during setup after it restarts, instead of showing No Wi-Fi.

<!-- ced21c6 -->

### 0.5.25 — 2026-09-23

- The screen keeps showing Token rejected or No Bridge until the problem is fixed, instead of flickering back.

<!-- e4e9ed0 -->

### 0.5.24 — 2026-09-22

- Pairing with the Bridge no longer fails if the first check right after pairing does not go through.

<!-- 8ea396f -->

### 0.5.23 — 2026-09-22

- The switch ignores a console token that is not a real API key.

<!-- a8739e5 -->

### 0.5.22 — 2026-09-22

- Devices can read the switch's status, start pairing, and clear its saved settings over USB.

<!-- 26d918d -->

### 0.5.21 — 2026-09-21

- The Wi-Fi network list during setup tries again if the first scan fails.

<!-- 04fe9c1 -->

### 0.5.20 — 2026-09-21

- USB setup responds sooner after the switch starts.

<!-- f60fde6 -->

### 0.5.19 — 2026-09-20

- The Wi-Fi network list during setup is more reliable while the switch is starting.

<!-- 59becd3 -->

### 0.5.18 — 2026-09-20

- The switch answers a Wi-Fi scan request during setup straight away.

<!-- cdcae20 -->

### 0.5.17 — 2026-09-20

- The Wi-Fi network list during setup is no longer empty when the scan is slow.

<!-- 6a0cd0d -->

### 0.5.16 — 2026-09-20

- You can set up the switch from the console over USB: Wi-Fi and the console link are saved on the switch.

<!-- be53698 -->

### 0.5.15 — 2026-09-20

- Touch and page swipes keep working while the switch checks in with the console, and the dimmer ring follows the lights chosen in the console.

<!-- ce79b2c -->

### 0.5.13 — 2026-09-20

- The screen goes fully dark when it sleeps.

<!-- 068f269 -->

### 0.5.12 — 2026-09-20

- Fixed the screen staying lit when it should sleep.

<!-- fe6e100 -->

### 0.5.11 — 2026-09-20

- The screen sleeps after a set time without a touch. The first touch only wakes it, so it never changes a light by accident.

<!-- a1571e8 -->

### 0.5.10 — 2026-09-20

- After a scene is recalled, the dimmer ring shows the new brightness.

<!-- db42f61 -->

### 0.5.9 — 2026-09-20

- When tap and double tap control two different lights, the disc is split in half to show each one.

<!-- f95cd58 -->

### 0.5.8 — 2026-09-20

- The screen keeps responding to touch while a command is on its way to the Bridge.

<!-- bf39161 -->

### 0.5.7 — 2026-09-20

- Restored double tap and dimming behaviour that an earlier build had broken.

<!-- a80af98 -->

### 0.5.0 — 2026-09-20

- Each page belongs to a room or zone, and the dimmer ring controls that group or the page's lights.

<!-- b0c9fc9 -->

### 0.4.2 — 2026-09-20

- More reliable saving of settings and USB connection.

<!-- 3c2de1d -->

### 0.4.0 — 2026-09-20

- Pages: swipe between rooms, each with its own colours and scene cycling.

<!-- c09a679 -->

### 0.3.0 — 2026-09-20

- The centre button shows whether the lights are on, and the dimmer ring stays in sync with the Hue app.

<!-- 8f12724 -->

### 0.2.0 — 2026-09-20

- Brightness ring, a loading screen, and better touch.

<!-- 1879448 -->

### 0.1.0 — 2026-09-20

- First Round switch firmware.

## Simple

The Simple switch (XIAO ESP32-C6 with wired buttons). Each heading is the firmware version Devices shows.

<!-- 45421a8 -->

### 0.2.10 — 2026-09-22

- Pairing with the Bridge no longer fails if the first check right after pairing does not go through.

<!-- d8ea208 -->

### 0.2.9 — 2026-09-22

- The switch ignores a console token that is not a real API key.

<!-- b4412cc -->

### 0.2.8 — 2026-09-22

- Devices can read the switch's status, start pairing, and clear its saved settings over USB.

<!-- 851ee76 -->

### 0.2.7 — 2026-09-22

- The orange LED shows the setup step as a count of blinks. See How-to.

<!-- 05ee847 -->

### 0.2.6 — 2026-09-21

- The Wi-Fi network list during setup tries again if the first scan fails.

<!-- 7e00bcf -->

### 0.2.5 — 2026-09-21

- USB setup stays connected while you pick a Wi-Fi network.

<!-- 79bbc18 -->

### 0.2.4 — 2026-09-21

- USB setup still works right after the switch restarts.

<!-- 70c0f8e -->

### 0.2.3 — 2026-09-20

- The Wi-Fi network list during setup is more reliable while the switch is starting.

<!-- 288f3e5 -->

### 0.2.2 — 2026-09-20

- The switch answers a Wi-Fi scan request during setup straight away.

<!-- 405b53f -->

### 0.2.1 — 2026-09-20

- The Wi-Fi network list during setup is no longer empty when the scan is slow.

<!-- 9fa2611 -->

### 0.2.0 — 2026-09-20

- You can set up the switch from the console over USB: Wi-Fi and the console link are saved on the switch.

<!-- d256757 -->

### 0.1.1 — 2026-09-20

- Buttons stay responsive while the switch checks in with the console. If a check-in fails, the switch keeps its last good settings.

<!-- 337e20c -->

### before 0.1.1 — 2026-09-19

- First Simple switch firmware. The BOOT button toggles a light, and the switch finds and pairs with the Hue Bridge.
