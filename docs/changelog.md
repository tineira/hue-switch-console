# Changelog

What changed in the console, the Round switch, and the Simple switch. Newest first.

<!-- Contributors: write each entry as what changed for the person using it, not how the code changed. -->
<!-- Round and Simple versions are not written here: each firmware repo keeps them in its own CHANGELOG.md, and they reach /changelog with the firmware upload (docs/specs/finished/firmware-uploads.md). This file keeps the console entries and each product intro. -->
<!-- Rebuilt from git history on 2026-09-22. Docs-only commits, scratch notes, and ignore-file chores are left out. -->

## Console

The console has no version number. Each heading is the day the change went live.

### 2026-10-01

- **Accents on the Round.** Page names keep ñ, á, é, í, ó, ú, ü, ç, ¿, ¡ and the other letters the Round's screen can draw, so `Niños` stays `Niños`. Capital Á, Í, Ó and Ú, and letters such as Ł, still show as the plain letter, and emoji are left out. The name field shows exactly what the circle will. The Round shows these letters from its next firmware release; until you update, it shows the plain letters as before.

### 2026-09-30

- **Terms and a Safety notice.** The console now has a **Safety notice** (mains danger, uncertified and unproven designs, rules that differ by country) and, on hue.tineira.com, **Terms of Use**, both linked in the footer. Before using the console, every account reads and accepts them once, and again if they change. Switches already on the wall keep working whether or not you have accepted.
- **Each build shows how proven it is.** The build guides label every design: **Built by the maintainer** or **Experimental** (the in-wall board, not yet installed). The in-wall warning now also says the rules and wire colors differ by country, and the install steps say to identify each wire by testing it, never by its color.
- For people who run a console: the Accounts tab shows which version of the Safety notice and Terms each account accepted. Set `TERMS_URL` and `TERMS_VERSION` to have accounts accept your own Terms.
- **How-to, one question at a time.** How-to opens on two big cards, one per switch. Pick yours, then what you want to do: **Build it**, **Set up**, **Everyday tasks**, or **Reading the screen** (Round) / **Reading the LED** (Simple). Only that part shows, and for the Simple's build guide you pick Try it, Button box or In the wall. Each choice has its own address, so you can bookmark or share it and Back takes you to the previous one. Build and Set up end with a link to the next part. Old How-to links still land in the right place.
- **Wall switches can toggle on each flip.** A Simple wall switch has a new **Flip** setting. **Each flip toggles the lights**: any flip, up or down, turns the lights on if they're off and off if they're on, so the lever never disagrees with lights you changed from the Hue app or another switch. **The lever sets on or off** keeps the old behavior: up is on, down is off. A quick flick and back still steps through the double-click scenes, from either lever position. New wall switches start on **Each flip toggles**; the ones you already have keep **The lever sets**. Toggling on each flip needs Simple firmware 0.8.0.
- **Two switches for one lamp.** A staircase or hallway pair now works: one board in each switch housing, both inputs set to **Wall switch** with **Each flip toggles the lights**, on the same room or zone. The build guide shows how, including how to wire an old 3-way switch.
- **Build guides.** How-to now starts with **Build it**: what to buy and how it goes together. The Round gets a shopping list and three assembly steps, no soldering. The Simple has three ways to build it: try it with BOOT alone, a button box on USB-C (wired one input at a time, with drawings, what never to connect, and whether you need resistors), or our board inside the wall behind your existing switch (what your wall box needs, what changes in the wiring, and the installation order for your electrician). The home page links to it.
- **Build guide pictures.** Every step of the build guides now has its own picture, drawn from 3D models of the real parts in the same style as the board picture on Switches: the Round's headers, antenna and display from below, the Simple's wires, buttons and resistors on the XIAO, and each step of the in-wall install. The steps that happen on Switches show the real editor. The Round guide now says the pin headers may come loose and need soldering, and **Try it** has its own shopping list.
- **Remove a switch or a Bridge.** A switch's details (the ⓘ button on Switches) have **Remove from console**: its settings leave the console, its key is revoked, and it stops counting toward your 25 switches. The board keeps working on the LAN with what it saved; Link to console on Setup adds it back. A Bridge with no switches left has **Remove this Bridge**. How-to's "Retire a lost or given-away board" uses it.
- For people who run a console: the Overview's **Needs you** section only appears when something does.
- For people who run a console: Overview notices about bounced emails and refused boards have **Dismiss**. They stay hidden until a new bounce or refusal comes in; the Emails number still counts every bounce in 30 days.
- **For people who run a console: `/admin` in tabs.** Admin opens on an **Overview** that lists only what needs you (a release waiting to go live, people in line, seats nearly full, failed updates, a refused board, bounced emails), each linking to where you fix it, then four numbers and the latest activity. **Accounts** has the waitlist queue, the accounts and invites (open ones by default); **Firmware**, **Settings** (sign-up mode, cap, limit defaults, email budgets) and **Activity** (filter by admins, the console or firmware CI) each have their own tab. Old `/admin` links to accounts or invites still land in the right place.
- **For people who run a console: Manage opens a full-width row.** On `/admin`, **Manage** opens a row under the account with Suspend, Limits and Delete side by side, instead of a narrow box in the last column. It stays open after you save, and the address remembers it. Admin accounts, yours included, now have **Manage** too, for their limits; suspending or deleting an admin still means removing the address from `ADMIN_EMAILS` first.
- **Renaming a switch finishes.** After **Save** (or **Cancel**) the name form stayed on screen saying "Saving…", even on other switches, although the name was saved. It now closes.
- **The changelog shows its formatting.** Bold words and code (such as `CONTACT_EMAIL`) used to show their `**` and backticks on this page; now they render. Firmware notes too.
- **Switch tabs show when a switch is online:** a small green dot, next to the "offline" label a switch gets after 3 hours without checking in.
- **How-to gives the right timing:** a saved change reaches a switch within about 15 minutes, and faster while Switches stays open. It used to say "within an hour".
- The theme button no longer shows the default theme's name for a moment when a page loads.
- **The Round preview shows the whole page name.** Names up to the 12-character limit were cut off in the preview (for example "Velador…") although the switch shows them in full. The preview now sizes the name like the screen does.
- On a Round page whose Tap and Double tap control single lights, the Ring row names the lights it dims instead of "those lights".
- **API keys** fits a phone again: the page no longer scrolls sideways; only its table does.
- **API keys** no longer repeats a board's name and date under Key when Setup named the key after that board.
- **Privacy** lists an email address for questions and requests, privacy@tineira.com, next to X. **Credits** thanks Resend and Cloudflare too.
- For people who run a console: the waitlist's "Joined, total" on `/admin` can no longer read lower than the 7- or 30-day count.
- **For people who run a console: a clearer `/admin`.** Firmware shows, per product, how many switches run each version, how many were quiet for 24 hours and how many failed an update, with older versions highlighted. Releases that only keep notes fold under "Older releases". Activity also lists what nobody clicked: waitlist admissions the console made on its own and releases firmware CI uploaded. Account limits have readable labels and show what the account uses. An open invite without an email gets **New link**, and a bounced one says why it can't be used. Links at the top jump to each section.

- **Join the waitlist from the home page.** The home page takes your email address right under the headline instead of sending you to the sign-in page, and says you're on the list without leaving the page. The bot check appears only once you start typing. The **Join the waitlist** button at the bottom of the page brings you back to that form.
- **No bot check for Google or GitHub.** The sign-in page no longer shows Cloudflare's "Verify you are human" box to everyone. It appears only once you start typing in the email sign-in or waitlist form, so signing in with Google or GitHub never loads it.
- **The sign-in page is only for signing in.** The waitlist box under the sign-in card is gone. New people get a **Join the waitlist** link in the intro (and after a refused Google or GitHub sign-in) that takes them to the form on the home page.
- **New default look: Slate.** The console and home page now start in **Slate** (cool blue-gray with the Round's orange) when your device is in dark mode, and **Slate Light** otherwise. A theme you picked yourself stays as it was.
- **A new set of 15 themes.** Besides Slate and Matrix, the picker now has themes that match Omarchy's: Tokyo Night, Catppuccin, Gruvbox, Everforest, Kanagawa, Nord, Matte Black, Osaka Jade and Ristretto (dark), and Catppuccin Latte, Flexoki Light and Rosé Pine Dawn (light). Every theme is checked for readable text and status colours. Retired themes move to the closest new one, on the same side: Ember becomes Ristretto, Paper becomes Flexoki Light, Night and Graphite become Matte Black, Ink and Ocean become Tokyo Night, Plum and Dracula become Catppuccin, Porcelain becomes Rosé Pine Dawn, Linen and Meadow become Flexoki Light, and Snow, Sky, Mist and Phosphor become Slate Light.
- **The home page keeps your theme.** It used to switch to Ember or Paper when you signed out. Now it shows the theme you picked, and its light/dark button takes you to the last theme you used on the other side (or Slate / Slate Light).

### 2026-09-29

- **Signing in takes you back.** If a page such as Setup or Switches (for example from a How-to link) sends you to sign in, you land back on that page afterwards instead of the home page. This works with Google, GitHub, an emailed code and a password.
- **Setup shows which console a board will talk to** before **Link to console** saves the key ("This board will talk to https://hue.tineira.com"). If the board was set up for a different console, Setup says so and asks before moving it here with **Move to this console**.
- **For people who run a console: self-hosting.** Setup now points boards at your own console instead of hue.tineira.com. It uses `DEVICE_CONSOLE_URL`, else `BETTER_AUTH_URL`, else the address of the Setup page. A console other than hue.tineira.com shows a short Privacy page saying its owner runs it, and its link preview, sitemap and robots.txt use its own address. `scripts/import-firmware.mjs` copies a released firmware from hue.tineira.com (or any console) into yours, so Setup has something to install without building it. The step-by-step guide is `docs/self-hosting.md`.
- If your Hue Bridge briefly reports no lights when a switch checks in, the console keeps the rooms, lights and scenes it already had, so the pickers on Switches no longer go empty until the next good check-in.
- The console starts in the light **Paper** theme. If your phone or computer is set to dark mode it starts in **Ember**, and a theme you picked yourself stays as it was.
- **New icon and link preview.** The browser tab shows a small Round screen instead of the placeholder icon, and so does the icon on an iPhone home screen. Links shared in WhatsApp, iMessage, Slack or X show the Round with "Build a wall switch for your Hue lights." on the light theme.
- **For people who run a console: firmware waits for you.** A firmware release uploaded by CI no longer goes live on its own. It waits in `/admin` under **Firmware**, marked **waiting** (with a note at the top of the page), until an admin presses **Make current**. Only then does Setup install it, Switches offer it over Wi-Fi, and `/changelog` list it. Rolling back is also done there; the old rollback endpoint for the upload token is gone.

### 2026-09-28

- **Update over Wi-Fi (Round).** A Round Display on firmware 0.6.0 or newer can be updated from Switches like a Simple switch: press **Update to …**, read what changes and press **Update now**. Older Rounds update over USB from Setup; the first update to 0.6.0 has to be over USB.
- **Switches is quieter.** A switch's tab shows its name and a Round or Simple icon, plus one short note only when something needs you (offline, updating, update failed, not applied) or an arrow when an update is available. Next to the name there's one **Update to …** button: it opens what's new in that version and then installs it over Wi-Fi, or, for a switch that still needs a cable, sends you to Setup. The firmware version, last check-in and board address are under the info button, and **What the LED shows** (or **What the screen shows**) sits under the board drawing.
- **Update over Wi-Fi (Simple).** Switches shows each switch's firmware next to the latest release. A Simple switch on firmware 0.6.0 or newer gets an **Update to …** button: it installs the new firmware the next time it checks in, then restarts, with no USB cable. **Update all behind** on a Bridge does it for every switch there that is behind, and **Cancel update** stops an offer that hasn't been picked up yet. If an update fails, Switches says why and the switch keeps its current firmware. After a rollback, a switch on newer firmware can be moved back with **Downgrade to …**. Older Simple switches and the Round still update over USB from Setup; the first update to 0.6.0 has to be over USB.
- The **Simple** editor on Switches is redesigned. It shows the board, in 3D or from the top, with each pin you use lit up; click a free pin to add a switch there. The list shows only the switches you wired, and you can name each one ("Front door") so two switches in one room are easy to tell apart. **Add a switch** asks what you wired (a **wall switch**, the new name for a toggle switch, or a push button), which pin, and which room. **Wired as** lets you change the type or move a switch to another pin after rewiring. **Remove** names the switch it removes ("Remove Front door") and frees its pin.
- **BOOT**, the button on the board, sits at the top of the list and is the suggested first step: pick a room, save and press it to check everything works before you wire anything. It works like any push button; only its **Hold** is special, because by default it pairs the board with the Bridge again.
- Named Simple switches show by name on **Lights**.
- A push button's **Hold → Dim** always dims what its **Click** controls. Pick one light for Click and Dim follows it; there is no separate light to choose for Dim.
- The save button on Switches reads **Save changes** for both Round and Simple. **Save all** still saves every switch with unsaved changes.

### 2026-09-27

- The **home page** puts the Round together as you scroll: the antenna, pin headers and screen come together, the screen wakes up, and you can tap, double tap, drag the ring or swipe right on it. The Simple card shows the board with its inputs, BOOT button and status LED next to its try-it wall switch. The trust strip and the closing band link to the source on GitHub.
- When a board plugged into **Setup** has older firmware, Setup lists what changed in every version between the board's and the one **Update** installs. Notes marked **Important** (something to know or do around the update) are shown first, and the checklist counts them.
- **For people who run a console: admin tools.** `/admin` can search accounts by email and page through all of them, make any stored firmware release the one Setup installs (to roll back or forward), and shows a log of what admins did in the last year. A suspension can have a reason, seen only by admins, and an end date, after which it lifts on its own. The invite list shows every invite, filtered by state, and each account shows why its last register was refused. Admin accounts can't be suspended or deleted from the console; remove the address from `ADMIN_EMAILS` first.
- Signing in with **GitHub** joins an existing account only when GitHub says that email address is verified.
- **Waitlist.** "Request an invite" is now **Join the waitlist**, and it only asks for your email. While there is room, your invite arrives right away; when the console is full, you get one email saying you're on the list, and your invite comes as soon as a spot opens. The console runs on free servers, so people are let in in batches. That email has a link to leave the waitlist, and the console is open source if you'd rather run your own.
- The **home page** is redesigned. Try both switches right on the page: tap, double tap, drag the ring or swipe on the Round, click, double-click or hold the Simple, and watch a small room light up. It also shows what to buy for each switch, with drawings and links to Seeed Studio, and the three setup steps. A button in the header switches between a dark and a light look.
- **hue.tineira.com** now opens on a short page that says what the console is, shows the two switches and how setup works, and links to sign-in and Privacy. Once you are signed in it still takes you straight to your switches.
- The footer and the **Credits** page have a **Sponsor** link. The console stays free; sponsoring on GitHub helps pay for its development.
- Links to the console shared on GitHub, X or in chat now show a preview card with its name and what it does.
- **How-to** and **Changelog** open without an account, so you can read the setup guide before you build a switch and send someone a link to an answer. How-to is also in the footer, and the home page links to it.

### 2026-09-26

- **Accounts.** The console can now host more than one person. Sign in with **Google**, **GitHub** or a **6-digit code** sent to your email; there is no password to remember. Sign-up is by invitation for now, and anyone can ask for an invite from the sign-in page. Everyone is signed out once by this update; sign in again with the same email and all your switches are there. Consoles without email set up keep signing in with the password.
- New **Account** page (in the menu under your email): change your email, sign out on every device, or delete your account and everything in it. It also shows how many switches, Bridges and API keys you use out of your limit (25, 5 and 25).
- If a board is refused because the account is at its limit, Setup and Switches say so. Existing switches and Bridges keep updating; only new ones are refused.
- New **Privacy** page (in the footer and on the sign-in page): what the console stores, why, who helps run it, and how to delete it.
- Switches that are idle now check in every 15 minutes instead of 5, so a saved change can take up to 15 minutes to reach one. Opening the Switches page still speeds them up, from their next check-in.

- **How-to** is rebuilt around your switch. Pick Round or Simple once and the page shows only what applies to it. Setup is a six-step guide where each step shows the screen or LED the switch should show next. Everyday tasks (change what a button or page does, update, pair again, retire a board) are short separate items. To diagnose a board, pick the screen or blink that matches it and get what it means and what to do. The "What the screen shows" and "What the LED shows" links on Setup and Switches open the right guide.

- Every page ends with a footer: who built the console, links to GitHub and X, **Credits** and **Changelog**.
- New public **Credits** page: thanks to Vercel, Neon, Seeed Studio and Espressif, the open-source software in the console, and what each switch's current firmware is built on. It also carries the Philips Hue trademark notice.

- Each switch shows whether it runs the config you saved: **Up to date**, **Pending** (with when you saved and when the switch checks in next), or a warning when the switch received a config but did not keep it. Needs the next Round and Simple firmware; older firmware shows no status.
- Saved changes reach the switch faster: within about 30 seconds while the Switches page is open, about 5 minutes otherwise, instead of up to an hour. A switch with nothing set up yet checks in every 30 seconds. Needs the same firmware.
- If a switch holds a newer config than the console (for example after a restore), the console sends its own config again when it has one, and otherwise offers **Replace the switch's config**.

- New **Lights** page: a map of the Bridge's rooms, lights and zones that shows which switch reaches each one, directly or through a room or zone, and which lights no switch reaches. A Round page shows as a chip with its name: filled when it controls the light, outlined when it reaches it through a room or zone. Hover or click a light, room or zone to see who controls it; hover or click a switch to see everything it reaches. On a phone, tap anything to open its details.

- The menu is now Switches, Setup and How-to. **Switches** opens on your switches, grouped by Bridge; a tab is marked when its switch has not been seen for 3 hours or points at lights or scenes the Bridge no longer has. Each switch has its own link. **Setup** is the old Devices page. Old links still work.
- Leaving a switch page with unsaved changes asks first.
- Room and zone counts are shown separately.

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
