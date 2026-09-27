# Inconsistencias

## problems.md vs código (2026-09-27)

| ID | Estado |
| --- | --- |
| P3 rev=0 al cambiar bridge | **Fixed** (`rev = existing.rev + 1`) |
| P4 snapshot `[]` pisa bridge | **Vivo** |
| P5 inferencia simple borra pages | **Fixed** (wipe solo round→simple explícito) |
| P11 poll escribe group/dim sin que el firmware lo aplique | **Vivo** (diseño actual) |
| P17 drift schema/ensure-schema | **Parcial**; CHECKs ya están en ambos |
| C16 recipes GET vacío en Round | **Fixed** — `.../recipes` es 410 |
| C17 ON CONFLICT resetea axis/timeout | **Likely fixed** (columnas se escriben) |

`docs/problems.md` (2026-09-20) está desfasado. O se actualiza o se archiva.

## Dual sources

- Admin: `ADMIN_EMAILS` vs `users.role`.
- Signup mode: env `SIGNUP_MODE` vs `console_settings.signup_mode` (solo invite/waitlist). `open` no se puede activar desde UI.
- User cap: `USER_CAP` vs settings.
- Contrato device: tres repos; la consola es SSOT (`AGENTS.md`). Bien, siempre que firmware no redefina payloads.

## Proxy vs middleware

Archivo se llama `proxy.ts` (Next 16). No autentica. Quien busque `middleware.ts` no lo encuentra.

## Recipes Simple

Spec: “`recipes` holds Round only; Simple se deriva de `simple_channels`”. El config Simple manda `recipes` derivadas. El endpoint `/recipes` es 410. Consistente con spec nueva; docs viejos pueden hablar de PUT recipes.

## Idioma

`AGENTS.md`: English everywhere. Este review está en español porque lo pediste así. No vive en UI.

## Env

`.env.example` no lista `FIRMWARE_UPLOAD_TOKEN`, `LIMIT_SWITCHES|BRIDGES|KEYS|SNAPSHOT_KB`, `CONTACT_EMAIL`, `PRIVACY_URL`, `TERMS_URL`, `EMAIL_DAILY_CAP`. README sí.
