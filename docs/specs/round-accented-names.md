# Accented names on the Round

Cross-repo spec. Process: `AGENTS.md` → "Cross-repo changes".

**Status:** in progress (approved 2026-10-01; console done, Round firmware pending)

## 1. What and why

Page and scene names on the Round show ñ, á, é, í, ó, ú, ü, ç and the other letters its built-in font already has, instead of folding them to plain ASCII. `Niños` shows as `Niños`, not `Ninos`, and a scene called `Canción` keeps its accent. The circle keeps the 5×7 font, its sizes and its layout. Letters the font has no glyph for (Á, Í, Ó, Ú, Ł, ő, …) still fold to their base letter as today, and emoji and other scripts are still dropped. The console's name field shows exactly what the circle will show.

## 2. The font

The Round draws text with the built-in font of GFX Library for Arduino (`font/glcdfont.h`, 256 glyphs). The glyphs follow IBM code page 437 with no offset; this was checked against the glyph data on 2026-10-01 (ñ = `0xA4`, Ñ = `0xA5`, ß = `0xE1`). The library prints bytes `0x80`–`0xFF` straight from that table when UTF-8 printing is off, which is the Round's setting.

Characters that get their own glyph (the **circle set**):

| Glyph | CP437 | Glyph | CP437 | Glyph | CP437 | Glyph | CP437 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Ç | `80` | ü | `81` | é | `82` | â | `83` |
| ä | `84` | à | `85` | å | `86` | ç | `87` |
| ê | `88` | ë | `89` | è | `8A` | ï | `8B` |
| î | `8C` | ì | `8D` | Ä | `8E` | Å | `8F` |
| É | `90` | æ | `91` | Æ | `92` | ô | `93` |
| ö | `94` | ò | `95` | û | `96` | ù | `97` |
| ÿ | `98` | Ö | `99` | Ü | `9A` | á | `A0` |
| í | `A1` | ó | `A2` | ú | `A3` | ñ | `A4` |
| Ñ | `A5` | ¿ | `A8` | ¡ | `AD` | ß | `E1` |

Everything else in Latin-1 and Latin Extended-A folds as `asciiFold` does today (Á → A, Ø → O, Ł → L, ő → o). Other non-ASCII is dropped.

The circle set is a fixed list in both repos. It changes only if the font changes.

## 3. Contract change

No endpoint or payload field changes. The meaning of two existing fields widens:

- `pages[].name` (console → Round): UTF-8 in NFC form, at most 12 characters (not bytes). It may contain ASCII printable characters and the circle set. **Additive.** Today the console only sends ASCII.
- Scene `name` in a recipe's `targets[]`: unchanged on the wire (the console already sends the Hue name). The firmware now keeps circle-set letters instead of folding them.

`docs/device-api.md` and `docs/round-pages.md` (§5.2 names, the editor section, NVS contents, rules 20 and "ASCII on the circle") are updated to say "circle set" instead of ASCII.

## 4. Firmware design (Round)

- **Storage stays UTF-8.** Names are kept as UTF-8 in RAM and in the NVS JSON, so the stored JSON stays valid. Conversion to font bytes happens only at draw time.
- **Ingest:** `asciiFold` becomes `circleFold`. It keeps ASCII and the circle set as UTF-8 and folds or drops the rest as today. `asciiFoldClip` becomes `circleFoldClip` and clips by characters, never splitting a UTF-8 sequence. The limits stay at 12 characters for a page and 24 for a scene.
- **Buffers:** a circle-set character is 2 bytes in UTF-8, so name buffers double. `PageDef.name` goes from 13 to 25 bytes. Scene `name` in `recipes.h`, `sceneName` in `hue_job.h` and `gSceneName` in `ui.h` go from 25 to 49 bytes. Measured on 0.6.5: global RAM grows by about 4.2 KB (16 recipes × 8 scene slots × 24 bytes, plus each copy of the job struct) and flash by 676 bytes. The pages blob stays well under the 4000-byte `putString` limit. Recipes already chunk to fit, but the worst case (12 recipes of 8 scenes with 24 two-byte characters each, about 1,060 bytes per recipe) now fills the 4 stored parts exactly; more pages, events or scenes would need a fifth part.
- **Draw:** `displayTextCenter` and `displayTextEllipsis` convert UTF-8 to single CP437 bytes into a local buffer first. Measuring and ellipsis then work as today, with one byte per character.
- **Old NVS:** names saved by older firmware are ASCII and stay valid. They show folded until the console pushes the pages again. No migration.
- × and ÷ are dropped (they used to fold to `x`), matching the console.
- Host tests: `circleFold` keeps `Niños`, `Canción` and `¿Qué?`, folds `Ángel` → `Angel` and `Łazienka` → `Lazienka`, and drops emoji. Clipping never cuts `ñ` in half. The UTF-8 → CP437 conversion maps every circle-set entry.

## 5. Console design

- `foldAscii` in `lib/pages.ts` becomes `foldForCircle`: it normalizes to NFC, keeps ASCII and the circle set, decomposes and strips the accent from other letters (as today), and drops the rest. It's used in the page-name input in `round-pages-editor.tsx` and in `normalizePageName` (default names from Hue rooms and zones).
- The 12-character limit counts characters after NFC. JavaScript `length` is correct for the circle set because each of its letters is one UTF-16 unit.
- The circle set lives in one exported constant next to `PAGE_NAME_MAX`, with a comment pointing to this spec and to the firmware table.
- Scene names are not folded in the console. They're shown in the console with their Hue names, as today.

## 6. Compatibility

- Console with a board that has **not** updated: the board receives UTF-8 names and folds them with its own `asciiFold`, so it shows `Ninos` as today. No console-side compatibility path is needed.
- Board with a console that has **not** deployed: the board receives ASCII page names (folded by the console) and shows them as today. Scene names already arrive with accents, so they show correctly as soon as the board updates.
- Firmware versions that need an old path: none.
- Old path to remove: none.

## 7. Checklist

### Console (`hue-switch-console`)

- [x] `foldForCircle` in `lib/pages.ts` and `ROUND_CIRCLE_CHARS` in `lib/round-themes.ts`; page-name input and default names use it
- [x] `docs/device-api.md` and `docs/round-pages.md` updated in the same commit
- [x] `docs/changelog.md` entry
- [ ] Deployed; checked on production (type `Niños` and `Ángel` in a page name: they stay `Niños` and become `Angel`)

### Round (`hue-round-switch`)

- [x] `circleFold`/`circleFoldClip`, bigger name buffers, UTF-8 → CP437 at draw time
- [ ] Host tests in `tests/host/test_json.cpp` (written; must pass in CI on the pull request)
- [x] `FIRMWARE_VERSION` bumped to 0.6.5; `CHANGELOG.md` entry (user-facing: names keep ñ and accents)
- [ ] Release uploaded; `/firmware/round/manifest.json` shows the new version
- [ ] Tested on a board by the user: a page named `Niños` and a scene with an accent are readable at both text sizes

### Simple (`hue-simple-switch`)

No change. The Simple switch has no screen.

## 8. Decisions

1. Uppercase Á, Í, Ó and Ú have no glyph and fold to the plain capital (A, I, O, U), not to the lowercase accented glyph. A lowercase letter at the start of a name looks like a mistake. (Approved 2026-10-01.)
2. ¿ and ¡ are in the circle set. They cost nothing and are common in Spanish scene names. (Approved 2026-10-01.)
