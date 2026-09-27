# Seguridad

## Bien hecho

- Device keys: `hsw_` + 24 bytes `base64url`, se guarda **SHA-256 hex**, el plaintext solo sale al crear (`lib/tokens.ts`, `app/api/keys/route.ts`).
- Firmware upload: `uploadTokenMatches` hashea ambos lados y usa `timingSafeEqual` (`lib/firmware.ts`).
- Webhook Resend: verifica firma Svix sobre el body crudo; ignora bounces transitorios (`app/api/webhooks/resend/route.ts`).
- Cuentas suspendidas: `authenticateDevice` mira `users.banned` → 403 `account_suspended`.
- Register limita tamaño del snapshot (`snapshotKb`).
- OAuth tokens cifrados en Better Auth (`encryptOAuthTokens`).
- OTP guardado hasheado.
- `/api/ingest` es 410 (ya no hay ingest anónimo).
- Firmware download público es **intencional** para Web Serial; ETag = sha256.

## Hallazgos

### MED — 500 filtra `err.message`

**Dónde:** `app/api/device/config/route.ts`, `register/route.ts`, `app/api/firmware/*`, `app/api/keys/route.ts`, `app/api/switches/*`, `lib/http.ts` `jsonError(..., { details })`.

**Impacto:** un fallo de Neon/SQL (columna, constraint, timeout) llega al XIAO o al browser. Ayuda a mapear schema.

**Recomendación:** loguear el error en servidor; al cliente solo `database_error` + id de request. Reservar `details` para errores de validación.

### MED — Sin rate limit en Bearer de dispositivo

**Dónde:** `lib/device-auth.ts`.

**Impacto:** fuerza bruta de tokens es inviable (192 bits), pero cada fallo es un SHA-256 + SELECT. Un bot puede saturar Neon/CPU. Tokens válidos no tienen throttle de poll más allá de `X-Poll-Sec` (el firmware puede ignorarlo).

**Recomendación:** rate limit por IP + por hash prefix en register/config. No incrementar `last_used_at` en un cron aparte si se quiere menos writes; o batch.

### MED — `CRON_SECRET` comparado en claro

**Dónde:** `app/api/cron/cleanup/route.ts` — `authorization !== \`Bearer ${secret}\``.

**Impacto:** timing leak menor (secreto largo). Inconsistente con firmware token.

**Recomendación:** mismo patrón sha256 + `timingSafeEqual`. Si `CRON_SECRET` no está en Vercel, el cron diario 06:00 UTC falla 503 (ops).

### MED — Token de upload = publicación inmediata

**Dónde:** `uploadRelease` hace `insert into firmware_current`.

**Impacto:** un token CI filtrado cambia lo que `/setup` flashea a **toda** la flota que reinstala. No hay aprobación en /admin.

**Recomendación:** upload ≠ current. Un POST `.../current` (ya existe) o un botón admin para promover.

### MED — Firmware POST sin tope de tamaño

**Dónde:** `app/api/firmware/[product]/route.ts` — lee cada part a `arrayBuffer`.

**Impacto:** con token válido (o si el token se filtra) se puede inflar Neon con bins enormes. `checkImage` solo mira magic `0xe9` + chip id en 24 bytes de `firmware.bin`/`bootloader.bin`.

**Recomendación:** límite duro (p.ej. 4 MiB/part), validar offsets/tamaños esperados.

### LOW — Account linking OAuth

**Dónde:** Better Auth `trustedProviders: google, github`.

**Impacto:** si un IdP entrega email no verificado, se puede vincular a una cuenta existente. Google suele verificar; GitHub emails secundarios son un clásico de takeover.

**Recomendación:** exigir email verificado; no auto-link GitHub sin confirmación.

### LOW — Keys POST TOCTOU

**Dónde:** `activeKeyCount` luego `insertApiKey` sin transacción.

**Impacto:** dos flashes USB simultáneos pueden pasar el límite de keys.

### LOW — GET `/api/switches/[mac]` responde `{ found: false }`

No es 404. Menor (hace falta sesión). No enumera MACs de otros users.

### NIT — `proxy.ts` no es authz

Solo cookie de invite. `/admin` se protege en server components (`requireAdmin`), no en edge. Correcto si no se asume lo contrario.

## Secretos (no rotos aquí)

No se listan valores. `.env.example` no incluye `FIRMWARE_UPLOAD_TOKEN` ni `LIMIT_*`. El seed `USER_PASSWORD` vive en env **y** como hash en `accounts` — ver [auth-admin.md](./auth-admin.md).
