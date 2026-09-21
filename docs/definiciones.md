# Definiciones — consola e interruptor Hue Wi‑Fi

Documento de producto y arquitectura. No es una guía de implementación ni un changelog.

Tres repos:

| Repo | Rol |
| --- | --- |
| `hue-simple-switch` | Firmware del XIAO ESP32-C6. Pulsación GPIO → Bridge Hue en la LAN (Clip v2). Canales `boot` / `d0` / `d1` / `d2`. |
| `hue-round-switch` | Firmware del XIAO ESP32-S3 + Round Display. Tap en el círculo, no pines. Páginas: `docs/round-pages.md`. |
| `hue-switch-console` | App web (Vercel + **Neon** Postgres). Cuenta de usuario, topología, asignación de funciones. Este repo. |

La consola **nunca** llama al Bridge. El Bridge **nunca** ve Vercel. El dedo en el interruptor **nunca** espera a la web.

Wire HTTP: `docs/device-api.md`. Páginas Round: `docs/round-pages.md` (esa copia manda el estado). Alta desde el navegador (`docs/specs/web-setup.md`) **no** entra en este v1; el aparato se flashea con Arduino y `config.h`.

## Piezas

**Bridge.** Hue Bridge Pro en la LAN. Fuente de verdad de luces, rooms, zonas y escenas. API local Clip v2 por HTTPS (certificado propio).

**Switch / XIAO.** Placa Seeed XIAO Wi‑Fi. No es accesorio Zigbee ni se hace pasar por un interruptor Hue.

- **Simple:** varios **canales** GPIO. El firmware declara `{ id, gpio, label, kind }`; la consola asigna recetas a ese `id`, no elige el pin.
- **Round:** no hay GPIO de receta. La consola inventa **páginas**; el poll baja `pages[]` + recetas con `pageId`. Ver `docs/round-pages.md`.

El **nombre de pantalla** lo edita el usuario en la consola (`switches.label`); no se envía al aparato. Si está vacío, la UI muestra la MAC.

**Canal (solo simple).** Un GPIO de entrada. `kind`:

- `maintained` — interruptor de pared clásico: el circuito queda **cerrado** o **abierto** (dos estados estables).
- `momentary` — pulsador (p. ej. BOOT): pulso y vuelve.

Canales v1 (el firmware los declara; cerrado = GPIO a GND, `INPUT_PULLUP`):

| id | GPIO | kind | label |
| --- | --- | --- | --- |
| `boot` | 9 | `momentary` | BOOT |
| `d0` | 0 | `maintained` | D0 |
| `d1` | 1 | `maintained` | D1 |
| `d2` | 2 | `maintained` | D2 |

No usar GPIO 3/14 (RF), 15 (LED), ni USB.

**Consola.** Next.js en Vercel. Login humano. Recibe snapshots y guarda asignaciones. Host: `https://hue.tineira.com` (Cloudflare DNS → Vercel). **Toda la UI (copy, botones, errores) es en inglés.** Este archivo de definiciones puede seguir en español.

**Postgres (Neon).** Cuentas (`users` con email + `password_hash`), API keys de aparato, topología, recetas, páginas Round. **No es Supabase Auth.** La sesión humana es la cookie `hsw_session` (HMAC). El runtime aplica `db/schema.sql` y `lib/ensure-schema.ts`. No aplicar migraciones en `docs/archive/supabase-DO-NOT-APPLY/`.

**Hue application key.** Token que emite el Bridge al emparejar (`POST /api` con el botón del Bridge). Vive en la NVS del XIAO. No es el API key de la consola.

**API key de consola / `CONSOLE_TOKEN`.** Token de aparato (`hsw_…`). El usuario lo **crea y administra** en la consola (nombre, copiar una vez, revocar). El XIAO lo pone en `Authorization: Bearer`. No sirve para entrar a la página.

**Cuenta de usuario.** Email + contraseña en la consola. Solo humanos. Signup público: no. Primera cuenta: seed `USER_EMAIL` / `USER_PASSWORD` (`.env.local`, no commitear).

**Topología.** Snapshot de **un Bridge**. Lo sube cualquier XIAO emparejado a ese `bridgeid` (o `push-from-bridge`) con `POST /api/device/register`. No es “la topología del switch”. El JSON tiene que servir para pintar rooms y asignar `rid`:

```text
{
  bridgeid, bridge_ip, receivedAt,
  lights:  [{ id, name, on, caps[] }],
  rooms:   [{ id, name, grouped_light_id, light_ids[], rtype? }],
  scenes:  [{ id, name, group_rtype, group_rid }]
}
```

`grouped_light_id` es el destino de “todo el room”. Las escenas se listan bajo el room/zona cuyo `id` = `group_rid`. `lights` / `rooms` / `scenes` son **required** (arrays; `[]` es legal si el Bridge está vacío). Omitir el campo es 400; un POST incompleto no debe pisar el árbol.

**Receta / asignación.** Qué hacer cuando un **canal** (simple) o una **página** (Round) emite un **evento**. La define el usuario en la consola. Copia en NVS.

**Evento (lo que se lee del GPIO o del círculo).** No confundir con la acción Hue (`toggle`, `on`, `off`, `recall_scene`).

**NVS.** Flash del ESP32. Guarda IP del Bridge, key de Hue, recetas (y páginas Round) y `rev`. El GPIO / el dedo disparan solo esto.

**`config.h`.** Wi‑Fi y consola:

```
WIFI_SSID
WIFI_PASSWORD
CONSOLE_URL      // https://hue.tineira.com  (dev: http://localhost:3000)
CONSOLE_TOKEN    // API key de aparato, generada en la UI
```

El resto (Bridge IP, key de Hue, receta / páginas) se descubre, se empareja o llega por poll, y vive en NVS.

**Cuenta de la consola.** El login (email + contraseña). No es un “Hogar” Hue.

## Por Bridge (no hay Casa)

Esta app **no** modela una casa con varios Bridges. Ese “Hogar” es de la app oficial (cloud). Clip v2 no lo tiene y nosotros tampoco.

El contexto de configuración es **un Bridge** (`bridgeid`):

- **Topología = del Bridge**, no del switch. Luces, rooms, zonas, escenas y `grouped_light` son un snapshot de ese Bridge. Varios XIAO emparejados al mismo Bridge **comparten** el mismo árbol.
- **Varios switches → un Bridge.** Cada placa se registra (MAC, firmware, `product`, lista de canales o `[]`) contra el `bridgeid` con el que se emparejó.
- Un switch habla con **un** solo Bridge (una IP, una Hue application key). Su receta solo puede apuntar a `rid` de ese `bridgeid`.
- Si apareciera otro Bridge, sería **otro contexto** (otra pantalla / otro `bridgeid`), no un padre “casa” que los une.

## Eventos que se leen (canal `maintained`, simple)

Un interruptor de pared **no es un toggle de firmware**. El contacto tiene estado: cerrado = prendido, abierto = apagado. El XIAO lee **flancos y un patrón corto**, no “invierte la lámpara porque alguien pulsó”.

Eventos v1:

| Evento | Qué pasa en el circuito | Uso típico en Hue |
| --- | --- | --- |
| `on` | Pasa a **cerrado** y se queda | `on` (prender destino) |
| `off` | Pasa a **abierto** y se queda | `off` (apagar destino) |
| `double_click` | Estaba **cerrado**, se **abre** y **vuelve a cerrar** en una ventana corta (p. ej. &lt; 400 ms) | Tercera acción: escena, brillo, otro room |

`on`/`off` copian el palo de la pared a Hue (sin GET). El doble click es un “extra” sin un segundo palo.

No hace falta en v1: triple click, long-off, double_off. Ruido y cables largos se comen el doble click si la ventana es muy corta; se calibra en firmware.

**Canal `momentary`** (BOOT): eventos distintos — `short`, `long`. `long` en BOOT queda reservado para re-pair Hue, no es receta. Un pulsador **no** genera `on`/`off` estables.

**Round:** no usa esta máquina de GPIO. Eventos de receta por página: `short` (tap) y `double_click` (doble tap). **No** hay fallback `double_click` → `on` en el círculo (hueco vacío = no-op). Detalle: `docs/round-pages.md`.

## Visualización y receta (simple: por canal y evento)

Un Bridge a la vez. Dos columnas.

**Izquierda — switches.** XIAO de *este* `bridgeid`.

- **Simple:** canales (`kind` + etiqueta). Por canal `maintained` se asignan **hasta tres** recetas: `on`, `off`, `double_click`. Vacías = no hace nada.
- **Round:** **páginas**, no GPIO. Grupo room/zona, tap / doble, lista de escenas, theme, eje, timeout. `docs/round-pages.md`.

El XIAO no se dibuja dentro del árbol Hue.

**Derecha — topología del Bridge.** Por **room** (en Round, filtrada al grupo de la página):

1. El room entero (`grouped_light`)
2. Las lámparas
3. Las escenas de ese room

**Receta simple**

```text
switch + channelId + event (on | off | double_click | short)
  → acción Hue: on | off | recall_scene | toggle
  → destino: { rtype, rid }   // light | grouped_light | scene
```

`toggle` (GET + invertir) es acción Hue, no evento de GPIO. En un `maintained` el mapeo natural es `on`→`on`, `off`→`off`, no toggle.

No hay multi-selección suelta de luces. No hay una receta única “del switch”.

Al guardar, `rev` sube. NVS guarda el array. Al registrarse el firmware simple manda `{ id, gpio, label, kind }[]` y `"product": "simple"`. Round manda `"product": "round"` y `channels: []`.

## Asignar en la app e implementar en el switch

La app **escribe** recetas / páginas. El switch **las ejecuta** en la LAN. El GPIO / el dedo nunca llama a Vercel.

### Qué declara el switch (registro)

`POST /api/device/register` (Bearer del aparato), junto al `bridgeid` y la MAC:

- Simple: `product: "simple"`, canales GPIO.
- Round: `product: "round"`, `channels: []`.
- Snapshot: `lights[]`, `rooms[]`, `scenes[]` (required; `[]` vacío de verdad es legal).

La UI no inventa pines. Si un canal no viene, no se asigna. `kind` decide qué **eventos** se pueden mapear (`on`/`off`/`double_click` vs `short`).

Wipe round→simple **solo** si el body trae `"product": "simple"` explícito. Inferir por canales no borra páginas.

### Cómo asigna el usuario (consola, simple)

1. Elegir un **switch** (izquierda).
2. Ver sus **canales**. Un `maintained` muestra **tres huecos** (copy en inglés: On / Off / Double-click):
   - On (`on`)
   - Off (`off`)
   - Double-click (`double_click`) — opcional
3. Elegir un hueco y un **destino** en la topología (derecha). Destino = `{ rtype, rid }` de **este** Bridge.
4. La app rellena la **acción Hue** con el default del hueco (se puede cambiar):

| Hueco (evento) | Default acción Hue | Destinos que encajan |
| --- | --- | --- |
| `on` | `on` | `light`, `grouped_light`, o `scene` (`recall_scene`) |
| `off` | `off` | el **mismo** destino que `on`, o `scene`, o vacío |
| `double_click` | `recall_scene` | `scene` (o otro light/group si se quiere) |
| `short` (momentary) | `toggle` | light, grouped_light, o `scene` (`recall_scene`) |

Atajo de UI (inglés): “Use this room for on and off” llena `on` y `off` juntos al mismo `grouped_light`. Double-click queda vacío hasta que elijan una escena.

Un hueco vacío = el switch **no hace nada** en ese evento. Guardar incompleto es válido (`on`+`off` sin double-click).

Frase de confirmación (inglés, no solo UUIDs): *“D0 on → turn on Living · off → turn off Living · double-click → scene Relax”*.

Validar al guardar: `rid` existe en el snapshot de ese `bridgeid`; `recall_scene` solo con `rtype: scene`; `on` / `off` / `toggle` no apuntan a una escena (el hueco `on`/`off`/`short` sí puede tener acción `recall_scene`).

`rev` incrementa. Eso es lo que el poll compara.

Round: el Save (PUT páginas) **exige grupo** en todas las páginas. El register del aparato puede crear `p1` sin grupo. Ver `docs/round-pages.md`.

### Contrato que baja el switch

`GET /api/device/config?mac=` (Bearer del aparato). **No** trae la topología.

**Simple:**

```text
{
  rev: 12,
  recipes: [
    { channelId: "d0", event: "on", action: "on", target: { rtype: "grouped_light", rid: "…" } },
    …
  ]
}
```

**Round** (`product: "round"`): `rev`, `product`, `pageSwipeAxis`, `screenTimeoutSec`, `pages[]` (con `group` + `dim`), `recipes[]` con `pageId`. Ver `docs/round-pages.md` §11.2 y `docs/device-api.md`.

Si `rev` local ≥ `rev` remoto, el firmware **no** escribe NVS. Si el remoto es mayor, **sustituye** todo el array local (y páginas). Nunca se usa `rev = 0` como semáforo de “vacío”: un cambio de `bridgeid` **borra** recetas/páginas y **incrementa** `rev`.

### Qué tiene que hacer el firmware (simple)

Por cada canal `maintained` (contacto a GND = cerrado, pull-up, debounce ~50 ms):

1. Leer GPIO. Estado estable cerrado/abierto.
2. Máquina de **doble click** (importante: no disparar `off` y luego `on` si era un doble):
   - Cerrado → abierto: **no** dispares `off` aún. Arranca ventana (~300–500 ms).
   - Si en la ventana vuelve a cerrado: evento `double_click` (y **no** `off` ni `on`).
   - Si la ventana vence abierto: evento `off`.
   - Abierto → cerrado **sin** ventana pendiente: evento `on`.
3. Buscar en NVS receta `(channelId, event)`. Si el evento es `double_click` y **no** hay receta para ese hueco, tratarlo como `on` (el contacto terminó cerrado; el usuario espera luz prendida). Cualquier otro miss: no-op.
4. Ejecutar en el Bridge (HTTPS Clip v2, key Hue en NVS):

| `action` | Clip v2 |
| --- | --- |
| `on` | `PUT …/{rtype}/{rid}` `{ "on": { "on": true } }` |
| `off` | idem `false` |
| `recall_scene` | `PUT …/scene/{rid}` `{ "recall": { "action": "active" } }` |
| `toggle` | GET `on` + PUT inverso (sobre todo `momentary` / `short`) |

5. El camino del contacto **no** usa `CONSOLE_URL`. Si el PUT falla, log y seguir; no bloquear otros canales.

Canal `momentary` (BOOT): `short` → receta si existe; `long` 3 s → re-pair, no receta.

Al boot: cargar recetas de NVS **antes** de atender GPIO. La primera lectura de cada GPIO **solo fija el estado**; no dispara `on`/`off`. Luego Wi‑Fi, poll, etc.

Si el usuario cambia la receta en la app, el switch se entera en el poll (1 min si ninguna receta; si ya hay alguna, al boot y cada 1 h). Reboot = bajar recetas ya; no dispara eventos de GPIO.

**Otras reglas:**

- El `GET` de config **reemplaza** el array de recetas en NVS (no es un patch). Huecos que ya no vienen se borran.
- Si cambia el `bridgeid` emparejado: firmware tira recetas en NVS **y** la consola borra + incrementa `rev` (defensa en profundidad).
- Dos switches (o la app Hue) sobre el mismo destino: **gana el último evento**. No hay 3-way ni sincronizar palos.
- Chrome de la consola en inglés; los **nombres Hue** (Living, Velador Tomás) se muestran tal cual.
- Varios POSTs de topología del mismo `bridgeid`: **último snapshot bueno gana**. Un register sin `rooms`/`scenes` (omitidos) es 400; no pisa.
- API key revocada: el poll falla; las recetas en NVS **siguen** ejecutándose en la LAN.
- Signup público: no. Solo la cuenta sembrada (`USER_EMAIL`).
- Receta huérfana (el `rid` ya no está en el snapshot): se conserva; el PUT Hue falla; la UI marca stale.

## Dos puertas

| Quién | Cómo |
| --- | --- |
| Usuario en el navegador | Email + contraseña; cookie `hsw_session` |
| XIAO o `push-from-bridge` | `CONSOLE_TOKEN` (API key de aparato) |

El usuario logueado **genera y administra** las API keys en la consola: crear, nombrar, copiar (una vez), revocar. Cada key es un token de aparato. Varios XIAO pueden compartir una, o usar una por placa (mejor para revocar). No hay un `INGEST_TOKEN` eterno en el server. `POST /api/ingest` responde `410 gone`; usar `POST /api/device/register`.

## `config.h`

```
WIFI_SSID
WIFI_PASSWORD
CONSOLE_URL      // https://hue.tineira.com
CONSOLE_TOKEN    // API key de aparato, generada en la UI
```

El resto (Bridge IP, Hue key, receta / páginas) se descubre, se empareja o llega por poll, y vive en NVS.

## Primer arranque del XIAO

No hay receta todavía.

1. Conecta al Wi‑Fi (`config.h`).
2. Descubre el Bridge (`mDNS _hue._tcp`, luego NVS, `discovery.meethue.com`).
3. Si no hay key de Hue válida: LED / disco parpadea, `POST /api` hasta que pulsen el botón del Bridge. Key e IP a NVS.
4. **Registro + upload:** MAC, `product`, `bridgeid`, canales o `[]`, snapshot rico a `POST /api/device/register`.
5. Pregunta config → simple: `recipes: []`; Round: página `p1` vacía, a menudo sin grupo hasta el Save en consola.
6. Los canales / el círculo no disparan Hue (huecos vacíos). Poll cada ~1 minuto.

El usuario asigna (canales o páginas). El poll siguiente (si `rev` remoto > local) escribe NVS y empiezan a ejecutar.

## Polling

| Estado | Ritmo | Qué pide |
| --- | --- | --- |
| Ninguna receta / páginas en NVS | ~1 min | ¿Hay config? (`rev`) |
| Ya hay alguna receta / páginas | Al boot y cada 1 h | ¿`rev` nuevo? |

Si el usuario cambia recetas en la web, el XIAO puede tardar hasta 1 h salvo reboot (el reboot es “aplicar ya”). El GPIO / el dedo no usan Vercel: NVS → Bridge.

## Qué no es esto

- La consola no es el camino de la luz (no hay “app en el medio” al pulsar).
- Vercel no alcanza `192.168.x.x`; el IP del Bridge identifica al aparato en la LAN, no abre un túnel.
- No hay API remota de Hue en el v1.
- No hay Zigbee, ni impersonar accesorios Hue, ni mezclar este árbol con el sketch Arduino.
- Web-setup (flash + Wi‑Fi + token desde Chrome) **no** es este v1.

## Infra (hecha)

| Qué | Para qué | Estado |
| --- | --- | --- |
| Proyecto **Vercel** (`hue-switch-console`) | Build y serverless | Hecho |
| **Neon** Postgres | Cuentas, API keys, topología, recetas, páginas | Hecho (`db/schema.sql`) |
| **Cloudflare** DNS: `hue.tineira.com` → Vercel | `CONSOLE_URL` del XIAO | Hecho |
| Auth | Cookie `hsw_session`; seed `USER_EMAIL` / `USER_PASSWORD` | Hecho. No es Supabase Auth |
| UI de API keys | Crear, copiar una vez, revocar | Hecho |
| Snapshot rico + pantalla Bridge | Simple = canales; Round = páginas | Hecho |

Host de producción: `https://hue.tineira.com`. En Cloudflare, CNAME `hue` al target que dé Vercel; TLS en el borde.

## Cerrado para implementar (no reinventar)

- UI **inglés**. Serial del firmware: inglés.
- Switch id = MAC del ESP32 (hex). El API key de aparato pertenece a una cuenta; el switch que registra con esa key queda de esa cuenta.
- API key: se muestra **una vez**, se guarda hash (SHA-256), en la lista solo nombre + prefijo.
- HTTPS a `hue.tineira.com`: **verificar** el certificado (bundle de Arduino). `setInsecure()` solo contra el Bridge Hue.
- Poll: sin recetas ~1 min; con recetas al boot y cada **1 h**. GPIO / dedo no esperan.
- Receta huérfana: se conserva; el PUT Hue falla; la UI marca stale.
- Double-click GPIO sin receta → se ejecuta `on`. En el círculo, hueco vacío = no-op. Boot no sintetiza eventos GPIO. Poll reemplaza el set si `rev` remoto > local. Último evento gana. Cambio de `bridgeid` borra recetas/páginas **y sube `rev`**. Sin signup público.
- API mínima:
  - Humano (cookie `hsw_session`): login; CRUD API keys; GET topología; PATCH label del switch; PUT recetas (simple) / PUT páginas (Round).
  - Aparato (Bearer key): `POST /api/device/register`; `GET /api/device/config?mac=` (`{ rev, recipes[] }` simple; Round añade `pages`, `pageId`, eje, timeout).
- Tablas (Neon): `users`, `device_api_keys`, `bridges` (snapshot JSON), `switches` (`product`, eje, timeout), `pages`, `recipes`. El server filtra por `user_id`; no hay RLS de Supabase.

## Repos

- Simple: `C:\Users\tinei\Arduino\hue-simple-switch` — [github.com/tineira/hue-simple-switch](https://github.com/tineira/hue-simple-switch)
- Round: `C:\Users\tinei\Arduino\hue-round-switch` — [github.com/tineira/hue-round-switch](https://github.com/tineira/hue-round-switch)
- Consola: `C:\Users\tinei\hue-switch-console` — [github.com/tineira/hue-switch-console](https://github.com/tineira/hue-switch-console)
