# Funcionalidades faltantes

## Admin (prioridad producto)

1. Buscar cuenta por email y paginar.
2. Ver / promover `firmware_current` sin el token de CI.
3. Audit log de acciones admin.
4. Motivo y expiry de suspensión (`ban_reason`, `ban_expires` ya están en schema).
5. Listar invites completos (no 30) + filtro used/expired.
6. Texto en el form de limits: vacío = default global.
7. Indicador “placa en firmware < 0.3.0, config vacía a propósito”.
8. Alerta cuando Neon/Vercel yardstick > 80% (hay `cap_alert_sent` para asientos, no para DB size).

## Producto / contrato

- OTA (`docs/specs/ota.md` sigue open). Hoy solo USB.
- Factory reset desde Setup (hoy `eraseAll: false`).
- Manifest con sha256 y verificación en `fetchFirmwareParts`.
- Historial de snapshots del bridge (P4 se vuelve reversible).
- Rate limit visible para device 401.
- Página “tu cuenta está suspendida” en vez de bounce a `/`.

## DX

- Tests del parser y del device contract (hoy cero).
- `ensureSchema` fuera del request path.
- Una sola fuente de schema.
- `.env.example` completo.

## Fuera de alcance razonable

Impersonation, email blast, multi-tenant orgs, i18n de UI (el producto es EN a propósito).
