# Firmware e instalador USB

## Pipeline

Push a `main` en un repo firmware → Actions construye 4 bins → `POST /api/firmware/{product}` con `FIRMWARE_UPLOAD_TOKEN` → `firmware_releases` + `firmware_parts` + `firmware_current`. Setup lee `/firmware/{product}/manifest.json` y baja parts públicos.

Offsets fijos (no vienen del upload). `checkImage` exige magic `0xe9` y chip id 9 (S3 / round) o 13 (C6 / simple) en `firmware.bin` y `bootloader.bin`.

## Hallazgos

### HIGH — Promote automático

Un upload válido **es** el current. No hay cola ni botón en `/admin`. El token es la única puerta.

### MED — Sin tope de tamaño en la ruta

`checkImage` mira 24 bytes. `partitions.bin` / `boot_app0.bin` no se validan. Un FormData enorme llena memoria del isolate y Neon (`bytea`).

Poner `maxDuration` + límite por part (p.ej. firmware.bin < 4 MB, resto < 64 KB) y rechazar antes de `arrayBuffer()`.

### MED — `bytea` + base64

`uploadRelease` convierte cada part a base64 en JS y `decode(..., 'base64')` en SQL. `readPart` hace lo inverso. Doble copia. HEAD también carga el blob (02-seguridad).

Guardar bins en Blob store (Vercel Blob / R2) y en DB solo sha256+url bajaria Neon Free (0.5 GB) y el backup.

### MED — `sql().transaction` vs driver Neon HTTP

`lib/sql.ts`: default `neon(url) as SqlClient`. `.transaction` y `.query` están implementados solo en `pgClient` (`DATABASE_DRIVER=pg`).

`uploadRelease` llama `db.transaction(...)`. En Neon HTTP eso puede ser `undefined` y romper el upload, **o** funcionar si prod usa `DATABASE_DRIVER=pg` con la URL pooled.

**Acción:** confirmar env de producción. Si es Neon HTTP, o se implementa `transaction` con `neonConfig` / pipelining, o se documenta que firmware exige `pg`.

### MED — Prune = 5 releases con bins

Rollback más atrás pierde parts. Las filas de notes quedan. `/admin` no avisa.

### LOW — `.env.example` no lista `FIRMWARE_UPLOAD_TOKEN`

Está en README. Fácil de olvidar en un self-host.

### LOW — Setup siempre apunta a `https://hue.tineira.com`

Documentado en README: el wizard no flashea contra localhost. Dev de contrato device exige placa + prod o un override que hoy no existe en UI.

## Web Serial (`lib/web-setup/*`) — revisión de equipo

- `hueset.ts`: escribe token + URL en claro por serial (esperado; NVS local).
- Cada flash mintea una device key (`POST /api/keys`) → presiona `LIMIT_KEYS`.
- `fetchFirmwareParts` no verifica sha256 del manifest (el manifest tampoco trae hashes).
- `eraseAll: false` a propósito: NVS (Wi-Fi, Hue, recipes, console) sobrevive. Bien para update; mal si se quiere “factory”.
- Improv: el provision de Wi-Fi no loguea el paquete (bien). Scan sí loguea TX hex recortado.

## GOOD

- Token compare timing-safe.
- Chip mismatch aborta el flash.
- Versión `major.minor.patch`; bins de una versión no se pisan (409).
- Credits JSON validado (https only, 50 entries).
- Cache `immutable` 1 año en parts: correcto si nunca cambian.
