# Setup over USB as a step-by-step guide

Console-only spec. No device endpoint, payload or NVS change, so the cross-repo order in `AGENTS.md` does not apply; the user still approves this before code.

**Status:** draft

## 1. What and why

Someone with a new XIAO opens Switches → Set up over USB and is walked through it one step at a time: connect, install firmware, Wi-Fi, console link, Hue Bridge, done. Only the current step is open. It shows one primary button, a render of what to do with their hands, what they will see, why the step exists, and what to do if it goes wrong.

Today `/setup` is a status page: a Detect card, a checklist, the board identity, and an Actions card with buttons of equal weight. It answers "what state is this board in" but not "what do I do now". The first firmware install is the highest friction in the product: people don't know which port to pick, whether they must press BOOT, and whether they can break the board. The How-to "Set up" section explains the board states, not the process, and it lives on a different page from the buttons.

## 2. Changes

### 2.1 Page layout

The Detect, Setup, board-identity and Actions cards are replaced by one vertical stepper, in the style of the How-to setup list (numbered dots joined by a line).

- **Current step:** open. It contains a title, one or two sentences, an illustration, a primary button, a status line while it runs, and two disclosures, **Why this step** and **If it goes wrong**, both closed by default.
- **Finished steps:** one line with a ✓ and a summary (`Firmware · Simple 0.8.0`, `Wi-Fi · HomeNet`, `Paired with 001788fffe…`). Clicking one reopens it, to change Wi-Fi for example.
- **Later steps:** greyed out, titles only, so the person sees how far they have to go.
- **After Detect:** the steps that are already done are marked ✓ and the first undone step opens. A board that is fully set up opens on **Done**.
- **Maintenance** (a disclosure under the stepper, shown only once a board is connected): Reinstall, Pair again, Clear settings, and the existing Details log. Nothing in it is needed for a first setup.
- Sections with nothing in them are hidden, not shown as "all clear".

The `Next:` line goes away; the open step is the next step.

### 2.2 Steps

Text below is the proposed wording. "Why" and "If it goes wrong" are the disclosure contents.

**Before you start** (a row of chips above step 1, as on How-to): the XIAO, a USB-C cable that carries data, Chrome or Edge on a computer, your 2.4 GHz Wi-Fi name and password, the Hue Bridge on that same network.

#### 1. Connect the board

- **Do:** Plug the XIAO into this computer with a USB-C cable, then click **Connect**. In the list Chrome shows, pick **USB JTAG/serial debug unit** (on Windows it ends in a port number such as `(COM3)`), then click Connect.
- **Today's list is not just the XIAO.** Chrome lists every serial port it can see, Bluetooth ones included. On the maintainer's PC (2026-10-01) it showed four entries: a pair of Bluetooth headphones, `USB JTAG/serial debug unit (COM3)`, `JL_SPP (COM5)` and `Bluetooth Peripheral Device (COM6)`. The step text must name the entry to pick and say what the others are:
  - Entries with "Bluetooth" or a device name (headphones, phones, `…_SPP`) are Bluetooth devices. They are not the board.
  - "Paired" after an entry is Chrome's note that this site was allowed to use that port before. It does not say which one is the board.
  - If you are unsure, unplug the board: the entry that disappears is the board.
- **Illustration:** render of the XIAO (C6 or S3, from the product picked on the page) with the cable going in; next to it an HTML mock of Chrome's port picker with several entries, Bluetooth ones included, and `USB JTAG/serial debug unit (COM3)` highlighted with a numbered balloon.
- **Port picker filter (to try):** `requestPort()` gets `filters` for the Seeed (`0x2886`) and Espressif (`0x303a`) USB vendor IDs. Bluetooth ports have no USB vendor ID, so they should drop out and leave only the board. Verify on the maintainer's PC before relying on it. The text still names the entry to pick, because the filter can fail and a **My board isn't in the list** link reopens the picker without filters.
- **Entry name per board:** the C6 shows as `USB JTAG/serial debug unit` (the chip's built-in USB). Check what the Round's S3 shows, both factory-fresh and on our firmware, and on macOS, and name each in the text.
- **Board:** detection names the chip (`XIAO ESP32-C6`) and product. The manual C6/S3 choice appears only when the port did not identify the board, with a render of each so the person can compare with the one in their hand.
- **Why:** A web page can only talk to a USB device you pick yourself. Chrome asks every time, and the page sees nothing else on your computer.
- **If it goes wrong:**
  - *The board isn't in the list:* the cable may be charge-only (many are). Try another cable or another USB port.
  - *You picked the wrong entry:* nothing is sent to that device's firmware and nothing changes on it. The page finds no XIAO there and asks you to pick again.

#### 2. Install the firmware

- **Do:** click **Install**. On the first install the page shows the button sequence *before* the write starts:
  - **Simple (C6), first install** (blank board, or firmware older than 0.2.11): ① hold **BOOT**, ② tap **RESET**, ③ click OK, ④ let go of BOOT when the page says *Writing firmware*. After the write: tap **RESET** once.
  - **Simple already on our firmware:** no buttons until the end (`HUEBOOT`), then tap **RESET** once.
  - **Round (S3):** no buttons; the console resets it itself.
- **Illustration:** render of the board from the USB side with numbered balloons on BOOT and RESET that match the numbered sequence (no part moves on the approved model). Round gets a render of the plugged-in kit instead.
- **What you'll see:** a progress bar (about a minute), then the board restarts. A preview of the LED or screen state it should show next (`StateVisual`, as on How-to).
- **Reassurance box** (always visible on this step, not in a disclosure): **You can't break the XIAO this way.** The install mode lives in read-only memory inside the chip, and no firmware can erase it. Holding BOOT and tapping RESET always gets back to it. If an install stops half-way, just install again.
- **Why:** The XIAO ships with a demo program from the factory. This replaces it with the switch firmware, the version the console currently serves.
- **If it goes wrong:**
  - *The chip does not answer:* hold BOOT, tap RESET, and try again.
  - *It stopped part-way:* install again.
  - *It says this is the other chip:* nothing was written; pick the right product.
- **Done when:** the board reports the current release. A board already on the latest release skips straight to ✓.

#### 3. Wi-Fi

- **Do:** **Scan**, pick your network, type the password, **Save**.
- **Why:** The switch talks to your Hue Bridge and to this console over Wi-Fi. The XIAO's radio is 2.4 GHz only, and it must be the same network as the Bridge.
- **If it goes wrong:**
  - *Your network isn't listed:* it may be 5 GHz only. Many routers have a 2.4 GHz band you can turn on or name separately.
  - *It doesn't connect:* check the password; the board shows the error state.
- **Illustration:** `StateVisual` of the Wi-Fi-connected state.

#### 4. Link to this console

- **Do:** click **Link**. It creates a key for this board and saves it over USB.
- **Why:** The board downloads its button setup from this console. The key proves the board is yours, so no one else's switch can read your setup, and lets you revoke it later from Keys.
- **If it goes wrong:**
  - *It says the board can't reach the console:* check Wi-Fi first.
- Shows the console URL the board will use, as today.

#### 5. Pair with the Hue Bridge

- **Do:** click **Pair**, then **press the round button on top of the Hue Bridge once**. A short press is enough. The board keeps trying for 90 seconds; the step turns ✓ when the Bridge accepts it.
- **Illustration:** new 3D Hue Bridge render (§2.3) with a numbered balloon on the link button and a press cue.
- **Why:** The Bridge only lets in a new app or device after someone presses its button, which proves you are standing next to it. After this, the switch talks to the Bridge directly on your network. The console never talks to your Bridge.
- **If it goes wrong:**
  - *Time ran out:* click Pair and press the button again.
  - *The board finds no Bridge:* the Bridge and the board must be on the same network, and the Bridge's lights must be on.

#### 6. Done

Green card, as on How-to: **This board is set up.**

- **Primary button:** Set up its buttons (Simple) / pages (Round), linking to that switch in Switches.
- **Next:** unplug it and mount it. Changes reach the switch within about 15 minutes, or right away after unplugging and plugging back in.
- **Secondary button:** **Set up another board**, which disconnects and returns to step 1.

### 2.3 Illustrations

All are renders of 3D models in the existing `app/how-to/illo` system, one per step (no flat line drawings).

| Step | Scene |
| --- | --- |
| 1 | XIAO (C6 / S3 kit) with a USB-C cable plugged in; HTML mock of Chrome's port picker with Bluetooth entries and the board's entry highlighted |
| 2 | Board seen from the USB end, numbered balloons on BOOT and RESET (Simple); plugged Round kit |
| 3, 4 | `StateVisual` of the resulting LED or screen state |
| 5 | **New:** Hue Bridge model, numbered balloon on the link button, press cue |
| 6 | Existing "done" scene for the product |

**Hue Bridge model:** a generic square Bridge (rounded square, large round link button in the middle, three status LEDs on the front edge), with no Philips/Hue logo or name on it. It is reused in How-to (pairing) and can be used on the landing page.

### 2.4 One source for the step texts

The step texts, illustrations and "why" live in one module (`lib/setup-steps.ts` or next to the stepper) used by both `/setup` and the How-to "Set up" section. How-to keeps a short overview of the steps (titles, one line each, "Then it shows" visuals) and links to `/setup` to do them, so there is one process and one wording.

## 3. Compatibility

- The USB flows (`HUEBOOT`, Improv Wi-Fi, `HUESET`, `HUEPAIR`) are unchanged; only their presentation moves. Boards on older firmware get the BOOT+RESET path in step 2 as today.
- Port filters: a board that enumerates under another vendor ID is still reachable through **My board isn't in the list**.

## 4. Checklist

### Console (`hue-switch-console`)

- [ ] Step data module (titles, texts, why, troubleshooting, illustration ids) shared by `/setup` and How-to
- [ ] `/setup` stepper replacing Detect / Setup / identity / Actions; Maintenance disclosure
- [ ] Step 1 names the entry to pick (`USB JTAG/serial debug unit` on the C6) and explains the other entries
- [ ] `lib/web-setup/serial.ts`: vendor-ID filters plus the unfiltered fallback, checked on the maintainer's PC (Bluetooth entries gone?)
- [ ] Port entry names recorded for the Round (factory-fresh and our firmware) and on macOS
- [ ] Step 2: pre-install button sequence with numbered render; "can't break it" box; progress and "what you'll see"
- [ ] Hue Bridge 3D model and the pairing scene
- [ ] BOOT/RESET balloon scene for the Simple, plugged scene for the Round
- [ ] How-to "Set up" section shortened to the overview plus a link to `/setup`
- [ ] Round's pairing window checked in `hue-round-switch` and stated correctly in step 5
- [ ] `docs/changelog.md` entry
- [ ] Deployed; the user sets up a blank C6 and a Round from production

## 5. Open questions

1. **Round pairing window.** The Simple keeps trying for 90 s (`kPairTimeoutMs`). I haven't found the Round's value yet. Recommendation: read it from the Round firmware during implementation; if it differs, step 5 says each product's own number.
2. **Factory USB IDs and port names.** I haven't checked which vendor ID and port name a factory-fresh XIAO C6 or S3 shows before our firmware is on it, or what the Round shows. Recommendation: keep both vendor-ID filters plus the unfiltered fallback, always name the entry in the text, and confirm on the next new board you plug in.
3. **Bridge generation.** Recommendation: model the square Bridge (v2), the one most people own. A Bridge Pro look can come later if people ask.
4. **How-to "Set up" section.** Recommendation: shorten it to an overview plus a link (§2.4) rather than removing it, because How-to is public and people read it before buying.
