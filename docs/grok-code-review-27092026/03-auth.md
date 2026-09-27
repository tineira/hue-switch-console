# Auth y sesiones

## Modelo

Better Auth vive en el mismo Postgres (`users`, `sessions`, `accounts`, `verifications`, `rate_limits`). Cookie prefix `hsw`. Sesión 7 días, `updateAge` 1 día. Sin servicio de auth aparte.

Modos (`lib/account-config.ts`):

- Sin Resend → `closed` + password del seed.
- Con Resend → `SIGNUP_MODE` = closed | invite | waitlist | open.
- `/admin` puede flippear solo entre invite y waitlist.

## HIGH / MED

### Dual source de admin

- `requireAdmin()` usa `isAdminEmail()` → `ADMIN_EMAILS` o `USER_EMAIL`.
- En `session.create` se escribe `users.role` según esa allowlist.

`users.role` no es la fuente de verdad. Cambiar `ADMIN_EMAILS` promueve/degrada en el próximo login, no al instante. No hay UI para nombrar otro admin. Quitar tu mail de env te deja fuera de `/admin` aunque `role=admin` en DB.

**Fix:** una sola fuente. O env (y deja de escribir role) o role en DB (y `/admin` para promover).

### Seed user

`ensureSeedUser` hashea `USER_PASSWORD` a `accounts.password` en el primer request. El flag `seeded` es por isolate: cada cold start de Vercel vuelve a SELECT/UPDATE. El password en claro sigue en env para siempre.

En hosted con email, el password sign-in está off, pero la fila `credential` puede existir. Tratar `USER_PASSWORD` como secreto de bootstrap y rotarlo / dejar de exigirlo en prod.

### OAuth linking

`trustedProviders: google, github`. Ver 02-seguridad.md.

### Rate limits de códigos

`lib/auth-limits.ts`: 3 códigos / 15 min por email, 10 / hora por IP, 30 fails / hora por IP, waitlist 3 / hora / IP y 50 / día global. Bien pensado.

IP = primer hop de `x-forwarded-for`. En Vercel eso es el cliente; no spoofeable si no se lee el header en otro host.

`codeCheckAllowed(ip=null)` retorna `true`: sin IP no hay tope de intentos. Mismo patrón en `inviteRequestAllowed`.

`lib/email.ts` `send()` no aplica `EMAIL_DAILY_CAP`. El cap vive en `sendCode` / change-email. Invites, alerts y notices de admin pueden pasarse del free tier de Resend.

### `scryptSync` (`lib/password.ts`)

Bloquea el event loop. Solo importa en self-host con password. En hue.tineira.com el path de password está apagado.

## GOOD

- Banned → sesión null + delete sessions al suspender.
- OTP hashed.
- Cookie invite httpOnly, SameSite=lax, 1 h, solo `inv_*`.
- Waitlist join: misma respuesta para ya-cuenta / ya-en-fila / nuevo.
- Disposable emails bloqueados en waitlist.
- Turnstile opcional pero cableado.
