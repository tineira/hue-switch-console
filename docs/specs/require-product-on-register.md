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

- Firmware versions that need the old path: those before the first release that sends `product`. The console session that implements phase 1 finds those versions in each firmware's `CHANGELOG.md` and writes them here.
- When phase 2 can ship: when `select product, firmware, count(*) from switches group by 1, 2` on production shows no switch below those versions, no deprecation warning has been logged for 30 days, and the user says OK.

## 4. Checklist

### Console (`hue-switch-console`)

- [ ] Phase 1: `docs/device-api.md` marks omitted `product` deprecated; register logs it
- [ ] Minimum firmware versions filled in §3
- [ ] Phase 2 (user OK): `400 product_required`, inference removed, `docs/device-api.md` updated in the same commit

### Round, Simple

- No change. Both already send `product`.
