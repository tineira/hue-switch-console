# Keep the topology when a register arrives empty

Cross-repo spec. Process: `AGENTS.md` → "Cross-repo changes". Issue: [#18](https://github.com/tineira/hue-switch-console/issues/18).

**Status:** approved 2026-09-29 (by the coordinating session, with the user's standing OK for this run)

## 1. What and why

A Bridge that answers `200` with an empty `data` array makes a board register `lights: []`. The console stores that tree, and every switch on that `bridgeid` loses its light, room and scene pickers until the next good register. After this change, an empty register never replaces a stored tree that has lights: pickers and scene names stay as they were.

## 2. Contract change

`POST /api/device/register`, **additive**:

- If `lights` is empty and the account already has a snapshot for that `bridgeid` with at least one light, the console keeps the stored snapshot (`lights`, `rooms`, `scenes`, `receivedAt`). Everything else in the request is still applied: the switch row (`firmware`, `bridge_ip`, `channels`, `product`, `last_seen_at`) is upserted as today.
- The `200` response gains `"snapshot": "stored"` or `"snapshot": "kept"`. `lights`, `rooms` and `scenes` in the response still count what the request carried.
- A first register for a `bridgeid` with `lights: []` is stored as today (there is nothing to keep).

## 3. Compatibility

- Boards that have not updated: unchanged. They get the same `200` and ignore the new field.
- Firmware: no change needed. Both firmwares already skip the register when a Clip v2 stream is not `200`.
- No old path to remove.

## 4. Checklist

### Console (`hue-switch-console`)

- [ ] Register keeps the stored snapshot on an empty `lights` (§2); `snapshot` field in the response
- [ ] `docs/device-api.md` updated in the same commit
- [ ] Deployed; checked on production (a normal register still returns `"snapshot": "stored"`)

### Round, Simple

- No change.
