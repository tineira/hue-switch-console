# <Feature name>

Cross-repo spec. Copy to `docs/specs/<feature>.md`. Body may be Spanish; product copy quoted here is English. Process: `AGENTS.md` → "Cross-repo changes".

**Status:** draft | approved | in progress | done (move to `finished/`)

## 1. What and why

What the person using the switch or the console can do afterwards. One paragraph.

## 2. Contract change

Exact diff to `docs/device-api.md` (endpoint, request/response fields, error codes, NVS keys written over USB). Mark each change **additive** or **breaking**.

## 3. Compatibility

- Console behavior with a board that has **not** updated:
- Board behavior with a console that has **not** deployed (if firmware could ship first):
- Firmware versions that need the old path: `round < X.Y.Z`, `simple < X.Y.Z`
- When the old path can be removed:

## 4. Checklist

### Console (`hue-switch-console`)

- [ ] Backward-compatible endpoint/UI change
- [ ] `docs/device-api.md` updated in the same commit
- [ ] Deployed; checked on production

### Round (`hue-round-switch`)

- [ ] Implemented; `FIRMWARE_VERSION` bumped
- [ ] `docs/changelog.md` `## Round` entry (user-facing wording)
- [ ] Installer bins synced to `public/firmware/round/`
- [ ] Tested on a board by the user

### Simple (`hue-simple-switch`)

- [ ] Implemented; `FIRMWARE_VERSION` bumped
- [ ] `docs/changelog.md` `## Simple` entry (user-facing wording)
- [ ] Installer bins synced to `public/firmware/simple/`
- [ ] Tested on a board by the user

### Cleanup

- [ ] Old path removed from the console (user OK, no switch on an older `firmware`)

## 5. Open questions
