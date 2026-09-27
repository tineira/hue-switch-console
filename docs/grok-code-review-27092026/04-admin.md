# Admin (`/admin`)

Página server-rendered, `requireAdmin()`, wide shell. Muestra conteos, nunca recipes ni snapshot (correcto).

## Lo que hay

- Waitlist: modo invite/waitlist, cap, seats, stats 7/30/90 días, emails 24 h, bounces, load Vercel/Neon.
- Fila de espera: admit / remove.
- Invites: crear (email opcional), email-again (rota código), revoke. Lista recortada a 30.
- Accounts: sort client-side, filtro dormant (60 días, 0 switches). Manage: suspend, limits, delete con confirmación de email.
- Self-guard en `suspendAction` y `deleteAccountAction` (`id === admin.id`).
- `app/account` permite que un admin se borre a sí mismo (last-admin). `/admin` no; `/account` sí.
- `register_refused_at` / `reason` existen (`lastRegisterRefusal`) y no se muestran en la tabla.
- Al borrar, `admitQuietly` libera el asiento.

## Huecos

| Falta | Por qué importa |
| --- | --- |
| Search / paginación | `listAccounts` `LIMIT 1000` y sort en memoria. A 1k+ la página se vuelve inútil. |
| Last-admin guard | Actions evitan auto-borrado, no evitan borrar al único otro admin (si algún día role vive en DB). Con allowlist de env el riesgo es menor. |
| Audit log | No hay tabla de “quién suspendió / cambió limits / admitió”. Solo `auth_events` de mail. |
| Firmware current | Rollback hoy es curl + `FIRMWARE_UPLOAD_TOKEN`. Un admin no-ops no puede promover un bin. |
| Sesiones | Ban borra sessions. No hay lista “dispositivos con sesión” ni revoke suelto. |
| Motivo de ban | Hardcoded `"Suspended by admin"`. Columna `ban_reason` / `ban_expires` existen y no se usan. |
| Promover admin | Solo env `ADMIN_EMAILS`. |
| Export / CSV | Cero. |
| Impersonation | No (y mejor no sin audit). |
| Ver switches de un user | Intencional (privacidad). Un link “N switches” a una vista redactada ayudaría soporte. |
| Invites > 30 | Silencioso. |
| Cap alert UI | `cap_alert_sent` en settings; no se ve el historial en la tabla. |
| Custom limits vacíos | Placeholder = default env. Guardar form vacío pisa `users.limits` a `{}` (vuelve a defaults). OK si se documenta; el form no lo dice. |

## Calidad de implementación

- `lib/admin.ts` `setBanned` / `deleteAccountById` no tienen guards; solo las actions. Cualquier otro caller futuro es peligroso.
- `setLimits` acepta cualquier `Record<string, number>`; la action sí filtra keys.
- Stats de Neon/Vercel son yardsticks hardcoded (2 900 calls/switch/mes, 0.5 GB). Útiles, no medidos.
- 10+ queries en paralelo al pintar `/admin` (bien). `listAccounts` sigue siendo 3 subqueries correlacionadas por user.
