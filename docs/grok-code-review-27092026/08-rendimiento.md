# Rendimiento y costos

## Hot path: poll de placas

Una placa Simple/Round en idle ~900 s; en edición o “behind” mucho más frecuente.

Por GET `/api/device/config`:

| Paso | Costo |
| --- | --- |
| `ensureSchema` | DDL si cold start |
| `authenticateDevice` | 2–3 queries + write `last_used_at` + `banned` |
| `getSwitchByMac` + `getBridge` | 2 |
| Round: 2× `listPages` + recipes + persist | 3–5 + write |
| `recordConfigPoll` | write |
| `accountLimits` no corre aquí | — |

Eso × N placas × polls/mes es el número que `/admin` estima (2 900 calls/switch/mes). Optimizar este GET es la palanca de Vercel Hobby y de Neon compute.

**204 no ahorra trabajo:** el cuerpo se omite *después* de persistir.

## Conexiones

- `lib/sql.ts` Pool `max: 5` si `pg`.
- Better Auth abre **otro** Pool `max: 3`.
- Neon HTTP default: no hay pool TCP, pero cada tagged template es un round-trip HTTP.

Dos pools en self-host `pg` = hasta 8 conexiones por isolate.

## Firmware I/O

Upload: 4 bins en memoria + base64. Download: encode bytea. HEAD no debería.

## Admin

`listAccounts` 1000 rows × 3 scalar subqueries. Sort en Node. OK a decenas de users; no a miles.

## Front

No se midió bundle. `esptool-js` se transpila (`next.config.ts`) y vive en `/setup` — correcto que no vaya al landing. Confirmar code-splitting: `setup-panel.tsx` debe ser client-only.

## Bloqueo

`scryptSync` en seed/password. Irrelevante en hosted con OTP.
