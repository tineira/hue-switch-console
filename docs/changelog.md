# Changelog

What changed in the console, the Round switch, and the Simple switch. Newest first.

<!-- Contributors: write each entry as what changed for the person using it, not how the code changed. -->
<!-- Round and Simple versions are not written here: each firmware repo keeps them in its own CHANGELOG.md, and they reach /changelog with the firmware upload (docs/specs/finished/firmware-uploads.md). This file keeps the console entries and each product intro. -->
<!-- Rebuilt from git history on 2026-09-22. Docs-only commits, scratch notes, and ignore-file chores are left out. -->

## Console

The console has no version number. Each heading is the day the change went live.

### 2026-09-26

- The Bridge page is redesigned: each gesture opens where it is shown and offers only choices that work for it, instead of picking a slot and then a light or scene in a side list.
- Round pages show a large preview of the screen, a strip of page dials, and the theme picker next to it. A new page starts with tap toggling its room and double tap turning it off; changing a page's room resets both the same way.
- Simple inputs are rows that sum up every gesture in one line. A toggle switch's empty double-click now reads "Does nothing".
- Save all saves every switch with unsaved changes at once.

- On a Simple push button, double-click now only cycles scenes, and hold dims or turns off the whole room or zone. Choices that repeated the click (toggle, turn on) are gone.

### 2026-09-25

- Each Simple switch input is set up like a Round page: pick a room or zone, then choose Toggle switch or Push button. A toggle switch turns the lights on and off with the lever, and a double-click cycles up to 8 scenes. A push button toggles the lights on each click, and its double-click and hold can each toggle, turn on, turn off, or cycle scenes.
- A push button's hold can dim: hold to ramp the light up or down, let go to stop. Each hold goes the other way. Needs Simple firmware 0.4.0.
- BOOT is a push button with the same double-click and hold. Its hold still re-pairs with the Bridge unless you give it another action.
- Simple switches need firmware 0.3.0 or later. Assignments made before this change were removed; set each switch up again after updating it.

### 2026-09-24

- New firmware reaches Devices as soon as it is released, without waiting for a console update.
- Installing on a Simple with firmware 0.2.11 or later no longer needs the BOOT button. Older Simples still ask for BOOT and RESET, at the right moment.
- Install on a Simple no longer stops right after connecting.
- After Install, the Round and the Simple restart on the new firmware by themselves.
- The USB debug log on Devices shows how Install connected.

### 2026-09-23

- Devices flags a board whose key was revoked on API keys, instead of calling it set up, and points you to Replace console key.
- API keys lists each key by the board that uses it, with a link to that board on its Bridge page. Keys no board uses are grouped under Not in use.
- API keys shows when each key was last used, with a green or amber dot for whether the board is still checking in.
- Revoking a key names the board that will stop getting changes, instead of a generic browser prompt.
- Creating a key on API keys moved under New key for a developer build, below the list.
- Keys that Devices creates are named after the board and its MAC.
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

## Simple

The Simple switch (XIAO ESP32-C6 with wired buttons). Each heading is the firmware version Devices shows.

<!-- 337e20c -->

### before 0.1.1 — 2026-09-19

- First Simple switch firmware. The BOOT button toggles a light, and the switch finds and pairs with the Hue Bridge.
