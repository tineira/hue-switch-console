# Code review — hue-switch-console

**Fecha:** 2026-09-27  
**Repo:** `tineira/hue-switch-console` @ `main` (`34aaefdc`)  
**Alcance secundario:** contrato con `hue-simple-switch` y `hue-round-switch` (no se auditó línea a línea el firmware).  
**Regla de esta entrega:** solo documentos. No se cambió código ni secretos.

## Cómo leer

Cada archivo es un concepto. Severidades:

| Tag | Significado |
| --- | --- |
| CRIT | Explotable o pérdida de datos / control del fleet |
| HIGH | Debe corregirse pronto; impacto real en prod o seguridad |
| MED | Deuda o riesgo con condiciones |
| LOW | Calidad, DX, hygiene |
| GOOD | Vale la pena no romperlo |

## Archivos

1. [01-metodo.md](01-metodo.md) — método y límites
2. [02-seguridad.md](02-seguridad.md) — vulnerabilidades y superficie
3. [03-auth.md](03-auth.md) — Better Auth, sesiones, seed, OAuth
4. [04-admin.md](04-admin.md) — `/admin` y huecos
5. [05-device-api.md](05-device-api.md) — register / config / keys
6. [06-firmware.md](06-firmware.md) — pipeline de bins y Setup USB
7. [07-base-de-datos.md](07-base-de-datos.md) — schema, migraciones, Neon
8. [08-rendimiento.md](08-rendimiento.md) — hot path y costos
9. [09-inconsistencias.md](09-inconsistencias.md) — contrato, docs, dual sources
10. [10-funcionalidades-faltantes.md](10-funcionalidades-faltantes.md) — admin y producto
11. [11-testing-ops.md](11-testing-ops.md) — CI, cron, observabilidad
12. [12-lo-que-esta-bien.md](12-lo-que-esta-bien.md) — no romper

## Prioridad sugerida

1. Dejar de filtrar `err.message` en JSON 500 (HIGH, barato).
2. Sacar `ensureSchema()` + writes del poll GET `/api/device/config` (HIGH perf + correctness P11).
3. Unificar fuente de admin (`ADMIN_EMAILS` vs `users.role`) y last-admin guard (MED/HIGH).
4. Tope de tamaño en upload de firmware + no cargar `bytea` en HEAD (MED).
5. Tests del contrato device-api y de `parse*` (HIGH deuda).
6. Admin: search/paginación, firmware current, audit log (producto).
