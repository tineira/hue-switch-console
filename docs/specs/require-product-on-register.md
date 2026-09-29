# Require `product` on register

Cross-repo spec. Process: `AGENTS.md` → "Cross-repo changes". Issue: [#19](https://github.com/tineira/hue-switch-console/issues/19).

**Status:** approved 2026-09-29 (by the coordinating session, with the user's standing OK for this run). Phase 1 in progress; phase 2 waits for the check in §3 and the user's OK.

## 1. What and why

Both firmwares send `product` (`"simple"` or `"round"`) on every register. The console still guesses the product when it is missing (`inferProduct` in `lib/pages.ts`: empty channels or a lone `c1` means Round, anything else Simple). Once no board relies on the guess, the console should refuse a register without `product` instead of guessing, so a new switch is never set up as the wrong product.

## 2. Contract change

`POST /api/device/register`:

- **Phase 1 (additive, now):** `docs/device-api.md` marks `product` as required for current firmware and an omitted `product` as deprecated. The console keeps inferring, and logs each register that omits it (`console.warn` with the MAC and `firmware`), so the deprecated path is visible in Vercel logs.
- **Phase 2 (breaking, later):** a register with a `mac` and no valid `product` returns `400 product_required`. `inferProduct` and `isPlaceholderRoundChannels` are removed with their callers. A register without `mac` (`push-from-bridge`) is unaffected.

## 3. Compatibility

- Firmware versions that need the old path: those before the first release that sends `product`. Neither firmware `CHANGELOG.md` mentions `product` (they are user-facing notes), so the versions below come from each repo's commit history of `console.h`, the file that builds the register body:
  - **Simple:** none. `product: "simple"` has been in the register body since the first firmware that registers at all (`d256757`, `FIRMWARE_VERSION` `0.1.1`, 2026-09-21). The earlier "before 0.1.1" build had no console code.
  - **Round:** only the very first build (`1879448`, 2026-09-20) omits it. `product: "round"` was added in `3c2de1d` (Pages, the release the changelog calls 0.4.0). Both builds still reported `FIRMWARE_VERSION` `"0.1.0"`, because the in-code version was bumped only later (to `0.5.x`). So a Round reporting `0.1.0` may or may not send `product`; any Round reporting a higher version sends it.
  - In practice, a board is on the old path only if it reports Round `0.1.0` (or no `firmware`). The phase 1 warning names those boards by MAC.
- When phase 2 can ship: when `select product, firmware, count(*) from switches group by 1, 2` on production shows no switch below those versions, no deprecation warning has been logged for 30 days, and the user says OK.

## 4. Checklist

### Console (`hue-switch-console`)

- [x] Phase 1: `docs/device-api.md` marks omitted `product` deprecated; register logs it
- [x] Minimum firmware versions filled in §3
- [ ] Phase 2 (user OK): `400 product_required`, inference removed, `docs/device-api.md` updated in the same commit

### Round, Simple

- No change. Both already send `product`.
