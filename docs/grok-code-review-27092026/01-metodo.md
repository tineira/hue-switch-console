# Método

## Qué se leyó

Árbol completo del repo (~274 paths). Lectura directa de:

- `README.md`, `AGENTS.md`, `db/schema.sql`, `lib/ensure-schema.ts`
- Auth: `lib/auth.ts` (resumen de equipo), `lib/better-auth.ts`, `lib/account-config.ts`, `lib/auth-limits.ts`, `lib/tokens.ts`, `lib/device-auth.ts`, `app/login/actions.ts`
- Admin: `lib/admin.ts`, `app/admin/actions.ts`, `app/admin/page.tsx`
- Device: `app/api/device/config/route.ts`, `app/api/device/register/route.ts`, `app/api/ingest/route.ts`
- Switches: `app/api/switches/[mac]/route.ts`, `.../pages/route.ts`
- Firmware: `lib/firmware.ts`, `app/api/firmware/[product]/route.ts`, `.../current/route.ts`, `app/firmware/.../route.ts`
- Infra: `lib/sql.ts`, `lib/http.ts`, `lib/env.ts`, `lib/limits.ts`, `proxy.ts`, `next.config.ts`, `vercel.json`, `.env.example`, `.github/workflows/ci.yml`
- Cron y mail: `app/api/cron/cleanup/route.ts`, `app/api/webhooks/resend/route.ts`

No se ejecutó la app ni se tocó producción. No se imprimieron secretos.

## Qué no se cubrió al 100%

- Cuerpo completo de `lib/db.ts` (grande; se infirió por callers y `docs/problems.md`).
- UI de switches (`workspace.tsx`, editors) línea a línea.
- Firmware C/C++ de los dos repos XIAO: solo contrato y hallazgos ya documentados en `docs/problems.md`.
- Dependencias npm (no se corrió `npm audit`).

## Criterio

Hallazgos anclados a archivo. Si algo está solo en `docs/problems.md` (P3–P17) y el código actual aún lo permite, se marca como **sigue vivo** hasta que un test o un cambio de código lo cierre.
