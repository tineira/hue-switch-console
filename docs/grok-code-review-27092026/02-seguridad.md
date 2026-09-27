# Seguridad

## CRIT / HIGH

### HIGH — Fuga de detalle interno en 500

Casi todas las rutas API hacen:

```ts
const details = err instanceof Error ? err.message : "unknown";
return jsonError(500, "database_error", { details });
```

Visto en: `app/api/device/config/route.ts`, `register/route.ts`, `app/api/keys/route.ts`, `app/api/switches/[mac]/route.ts`, `pages/route.ts`, firmware upload/download/current.

**Impacto:** un 500 de Postgres o de Neon puede devolver SQL, nombres de columna, o el texto de un check constraint al cliente (dispositivo o browser).

**Fix:** loguear `err` en servidor; al cliente solo `{ error: "database_error" }`.

### HIGH — GET `/api/device/config` muta estado

El poll que hacen las placas (cada ~15–900 s) escribe:

- `persistPageGroupAndDim`
- a veces `incrementSwitchRev` / `bumpSwitchRevPast`
- `recordConfigPoll` (last_seen, served_rev, apply_failed, next_poll_at)
- `touchApiKey` dentro de `authenticateDevice`

Además de violar semántica HTTP, un retry o un proxy que revalide GET puede bump-ear `rev` o reescribir `pages.group/dim`. Relacionado con P11 de `docs/problems.md`.

**Fix:** GET idempotente que solo lea; writes en un POST de ack, o al menos no persistir group/dim ni bump de rev en el GET.

### HIGH — Token de upload = control del instalador

`FIRMWARE_UPLOAD_TOKEN` con `uploadTokenMatches` (sha256 + `timingSafeEqual`: bien) autoriza:

- `POST /api/firmware/{product}` — sube bins y **pone `firmware_current`**
- `POST /api/firmware/{product}/current` — rollback/forward

No hay staging ni aprobación en `/admin`. Quien tenga el token cambia lo que Setup flashea a todas las placas USB.

Mitigaciones actuales: token no está en el repo; comparación timing-safe. Falta rotación documentada en `.env.example` y un paso “promote” humano.

### MED — Comparación de `CRON_SECRET` en claro

`app/api/cron/cleanup/route.ts`:

```ts
if (req.headers.get("authorization") !== `Bearer ${secret}`)
```

No es `timingSafeEqual`. En Vercel el cron envía el bearer si `CRON_SECRET` existe; el riesgo práctico es bajo, pero el patrón de firmware ya está mejor. Unificar.

### MED — Sin rate limit en auth de dispositivo

`authenticateDevice` hashea y busca. Fallos no se cuentan. Un atacante puede martillar `/api/device/*` (CPU sha256 + queries). Las placas en la red del usuario tienen el token; el endpoint es público en Internet.

**Fix:** rate limit por IP (ya hay tabla `rate_limits`) en 401 de device.

### MED — Account linking Google + GitHub

Better Auth `trustedProviders: google, github` + match por email. Si un proveedor entrega un email no verificado, hay escenario clásico de toma de cuenta. Confirmar `email_verified` en el callback y no linkear si el mail no está verificado.

### MED — `verifyCode` y change-email filtran mensajes de Better Auth

`app/login/actions.ts` reenvía el `message` si coincide `/invitation|suspended/i`. `sendCode` está bien diseñado (misma respuesta). El paso 2 puede confirmar que un mail existe y está suspendido o necesita invite.

`app/account` change-email, si muestra "Email already in use", enumera cuentas.

### MED — HEAD de firmware carga el binario

`app/firmware/[product]/[version]/[name]/route.ts` `HEAD` llama `readPart()`, que hace `encode(p.data, 'base64')` del `bytea`. Un HEAD no debería tocar el blob.

### LOW — `proxy.ts` no es un auth gate

El “middleware” solo copia `?invite=inv_…` a cookie httpOnly. `/admin` se protege en el server component con `requireAdmin()`. Está bien si nadie asume que el edge filtra. El matcher es amplio y corre en casi todas las rutas.

### LOW — Session tokens en tabla `sessions`

Columna `token text unique`. Depende de si Better Auth guarda hash o valor. Verificar en la lib; si es plaintext, es el modelo de Better Auth y hay que tratar backups como secreto.

## Lo que está bien

- Device keys: `hsw_` + 24 bytes, guardado como sha256, prefijo 12 chars, revoke + `last_used_at`.
- Invite codes: hash + prefix (mismo patrón).
- OAuth tokens: `encryptOAuthTokens: true`.
- OTP: hashed, 6 dígitos, 600 s, 5 intentos.
- Webhook Resend: verifica firma Svix sobre el body crudo.
- Turnstile en send-code y waitlist.
- Payload register limitado por `snapshotKb` (413).
- Cuenta suspendida → device 403 `account_suspended`; sesiones borradas al ban.
- `POST /api/ingest` es 410 (ya no hay ingest anónimo).
- Password sign-in se apaga cuando hay email.
- `sendCode` no enumera cuentas.
- Bins públicos del firmware son deliberados (Web Serial); no hay secretos ahí.
