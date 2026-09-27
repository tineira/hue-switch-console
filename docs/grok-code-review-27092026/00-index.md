# Code review — hue-switch-console

**Fecha:** 2026-09-27  
**Ref:** `main` @ `34aaefdc`  
**Alcance:** consola Next.js (primario). Firmwares `hue-simple-switch` / `hue-round-switch` solo por contrato (register, poll, product).  
**Regla:** no se tocó código de aplicación ni secretos. Solo esta carpeta de hallazgos.

## Cómo leer

| Severidad | Significado |
| --- | --- |
| **crit** | Explotable o pérdida de datos de otros usuarios con poco esfuerzo |
| **high** | Impacto real de seguridad, integridad o flota |
| **med** | Bug, deuda o superficie que conviene cerrar pronto |
| **low** | UX, ops, docs |
| **nit** | Estilo |

Cada hallazgo: impacto + recomendación. Lo que está bien también se anota para no «reabrir».

## Archivos

| Archivo | Tema |
| --- | --- |
| [security.md](./security.md) | Auth de dispositivos, tokens, leaks, cron, webhooks |
| [auth-admin.md](./auth-admin.md) | Better Auth, seed user, roles, waitlist |
| [device-api.md](./device-api.md) | register, config poll, ingest |
| [firmware.md](./firmware.md) | Upload CI, bins en Neon, installer público |
| [web-setup.md](./web-setup.md) | Web Serial, flash, Improv, HUESET |
| [data-model.md](./data-model.md) | Schema, ensure-schema, límites |
| [performance.md](./performance.md) | Polls, pools, ensureSchema, queries |
| [admin-gaps.md](./admin-gaps.md) | Lo que /admin no hace |
| [contract-inconsistencies.md](./contract-inconsistencies.md) | problems.md vs código de hoy |
| [frontend-ci-ops.md](./frontend-ci-ops.md) | UI, CI, env, scripts |

## Prioridad sugerida

1. No sobrescribir snapshot vacío del Bridge (P4 vivo).
2. Poll GET sin trabajo pesado ni side-effects de group/dim sin bump de `rev` (P11).
3. Rate-limit / no filtrar `err.message` en APIs de dispositivo y firmware.
4. Staging de firmware (token CI no debería publicar current sin control).
5. Tests de contrato (register product, rev en bridge change, parse `[]`).
6. Admin: last-admin, firmware, búsqueda, audit log.

## Lo que no se revisó línea a línea

- `package-lock.json` / árbol de dependencias CVE.
- Binarios en Postgres (contenido).
- Firmwares C/C++ salvo inconsistencias de contrato ya documentadas.
- Deploy Cloudflare/Vercel (WAF, headers reales en prod).
