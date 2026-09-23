# Product firmware images (web-setup)

The install wizard (`/install`) serves **one manifest per product**. It does not
auto-pick a chip from a mixed JSON.

| Product | Manifest | Chip | Arduino profile | Version |
| --- | --- | --- | --- | --- |
| Round Display | `/firmware/round/manifest.json` | ESP32-S3 | `hue-round-switch` `xiao-s3` (`default_8MB`, 8MB) | `0.5.26` |
| Simple | `/firmware/simple/manifest.json` | ESP32-C6 | `hue-simple-switch` `xiao-c6` (sketch `partitions.csv` = min_spiffs) | `0.2.10` |

The four parts per product (`bootloader.bin`, `partitions.bin`, `boot_app0.bin`,
`firmware.bin`) **are in this tree** and are what Vercel serves. They are the
compiled product images (empty `WIFI_*` / `CONSOLE_*`). Do not check in dummy
`.bin` files. Do not gitignore them.

A `git push` of this console repo is what hue.tineira.com `/install` flashes.

## How bins get here

Firmware `git push` to `main` rebuilds and publishes a rolling GitHub Release
tag `usb-installer`. If the firmware repo has `CONSOLE_REPO_TOKEN` (PAT with
`repo` on this console), that workflow dispatches `firmware-bins` here
(`.github/workflows/sync-firmware-bins.yml`), which downloads the release,
updates `manifest.json` `version`, and commits.

Without that secret: run **Sync USB installer bins** by hand (`workflow_dispatch`),
or copy `dist/installer/` from a local compile into
`public/firmware/{round,simple}/`.

## Offsets (Arduino-ESP32 3.3.12)

Not guessed. Same four addresses on both boards:

| Part | File | Offset |
| --- | --- | --- |
| bootloader | `bootloader.bin` | `0x0` |
| partition table | `partitions.bin` | `0x8000` |
| otadata / boot_app0 | `boot_app0.bin` | `0xe000` |
| application | `firmware.bin` | `0x10000` |

Sources:

- Bootloader `0x0`: `boards.txt` `XIAO_ESP32S3.build.bootloader_addr` and
  `XIAO_ESP32C6.build.bootloader_addr` in Arduino-ESP32 **3.3.12**.
- Partition table `0x8000`: ESP32 image layout used by that platform.
- `0xe000` / `0x10000`: `otadata` and `app0` in
  `tools/partitions/default_8MB.csv` (Round FQBN) and
  `hue-simple-switch/partitions.csv` (min_spiffs).

The wizard never passes erase-flash. NVS (Hue, recipes, pages, `console`)
must survive a reflash.
