# Definiciones — consola e interruptor Hue Wi‑Fi

Documento de producto y arquitectura. No es una guía de implementación ni un changelog.

Dos repos:

| Repo | Rol |
| --- | --- |
| `hue-simple-switch` | Firmware del XIAO ESP32-C6. Pulsación → Bridge Hue en la LAN (Clip v2). |
| `hue-switch-console` | App web (Vercel + Supabase). Cuenta de usuario, topología, asignación de funciones. |

La consola **nunca** llama al Bridge. El Bridge **nunca** ve Vercel. El dedo en el interruptor **nunca** espera a la web.

## Piezas

**Bridge.** Hue Bridge Pro en la LAN. Fuente de verdad de luces, rooms, zonas y escenas. API local Clip v2 por HTTPS (certificado propio).

**Switch / XIAO.** Placa Seeed XIAO ESP32-C6 (u otro XIAO Wi‑Fi). No es accesorio Zigbee ni se hace pasar por un interruptor Hue. Varios **canales** (entradas digitales o botones en pantalla). Cada canal tiene tipo de contacto y recetas por **evento leído**, no una sola receta “del switch”. El **nombre de pantalla** lo edita el usuario en la consola (`switches.label`); no se envía al aparato. Si está vacío, la UI muestra la MAC.

**Canal.** Un GPIO de entrada. El firmware declara `{ id, gpio, label, kind }`; la consola asigna recetas a ese `id`, no elige el pin. `kind`:

- `maintained` — interruptor de pared clásico: el circuito queda **cerrado** o **abierto** (dos estados estables).
- `momentary` — pulsador (p. ej. BOOT en el prototipo): pulso y vuelve.

Canales v1 (el firmware los declara; cerrado = GPIO a GND, `INPUT_PULLUP`):

| id | GPIO | kind | label |
| --- | --- | --- | --- |
| `boot` | 9 | `momentary` | BOOT |
| `d0` | 0 | `maintained` | D0 |
| `d1` | 1 | `maintained` | D1 |
| `d2` | 2 | `maintained` | D2 |

No usar GPIO 3/14 (RF), 15 (LED), ni USB.

**Consola.** Next.js en Vercel. Login humano. Recibe snapshots y guarda asignaciones. Host público previsto: `https://hue.tineira.com` (Cloudflare DNS → Vercel). **Toda la UI (copy, botones, errores, emails de Auth) es en inglés.** Este archivo de definiciones puede seguir en español.

**Supabase.** Auth (email + contraseña) y Postgres (cuentas, API keys de aparato, topología, recetas de cada switch).

**Hue application key.** Token que emite el Bridge al emparejar (`POST /api` con el botón del Bridge). Vive en la NVS del XIAO. No es el API key de la consola.

**API key de consola / `CONSOLE_TOKEN`.** Token de aparato. El usuario lo **crea y administra** en la consola (nombre, copiar una vez, revocar). El XIAO lo pone en `Authorization: Bearer`. No sirve para entrar a la página.

**Cuenta de usuario.** Email + contraseña en la consola. Solo humanos.

**Topología.** Snapshot de **un Bridge**. Lo sube cualquier XIAO emparejado a ese `bridgeid` (o `push-from-bridge`). No es “la topología del switch”. El JSON tiene que servir para pintar rooms y asignar `rid`:

```text
{
  bridgeid, bridge_ip, receivedAt,
  lights:  [{ id, name, on, caps[] }],
  rooms:   [{ id, name, grouped_light_id, light_ids[] }],
  scenes:  [{ id, name, group_rtype, group_rid }]
}
```

`grouped_light_id` es el destino de “todo el room”. Las escenas se listan bajo el room/zona cuyo `id` = `group_rid`. El ingest actual (solo luces + nombre de room) **no basta**; hay que ampliarlo.

**Receta / asignación.** Qué hacer cuando un **canal** emite un **evento**. Un XIAO tiene varias recetas: `(channelId, event) → acción Hue + destino`. La define el usuario en la consola. Copia en NVS.

**Evento (lo que se lee del GPIO).** No confundir con la acción Hue (`toggle`, `on`, `off`, `recall_scene`).

**NVS.** Flash del ESP32. Guarda IP del Bridge, key de Hue, recetas por canal/evento y `rev`. El GPIO dispara solo esto.

**`config.h`.** Hoy solo `WIFI_SSID` / `WIFI_PASSWORD`. Cuando la consola pueda emitir API keys, se agregan `CONSOLE_URL` y `CONSOLE_TOKEN`. No lleva IP del Bridge, key de Hue ni UUID de lámpara.

**Cuenta de la consola.** El login (email + contraseña). No es un “Hogar” Hue.

## Por Bridge (no hay Casa)

Esta app **no** modela una casa con varios Bridges. Ese “Hogar” es de la app oficial (cloud). Clip v2 no lo tiene y nosotros tampoco.

El contexto de configuración es **un Bridge** (`bridgeid`):

- **Topología = del Bridge**, no del switch. Luces, rooms, zonas, escenas y `grouped_light` son un snapshot de ese Bridge. Varios XIAO emparejados al mismo Bridge **comparten** el mismo árbol; no sube cada uno “su” casa.
- **Varios switches → un Bridge.** Cada placa se registra (MAC, firmware, lista de canales) contra el `bridgeid` con el que se emparejó. Las recetas son **por canal**; los destinos se eligen en la topología compartida.
- Un switch habla con **un** solo Bridge (una IP, una Hue application key). Su receta solo puede apuntar a `rid` de ese `bridgeid`.
- Si apareciera otro Bridge, sería **otro contexto** (otra pantalla / otro `bridgeid`), no un padre “casa” que los une. V1 asume un Bridge.

## Eventos que se leen (canal `maintained`)

Un interruptor de pared **no es un toggle de firmware**. El contacto tiene estado: cerrado = prendido, abierto = apagado. El XIAO lee **flancos y un patrón corto**, no “invierte la lámpara porque alguien pulsó”.

Eventos v1:

| Evento | Qué pasa en el circuito | Uso típico en Hue |
| --- | --- | --- |
| `on` | Pasa a **cerrado** y se queda | `on` (prender destino) |
| `off` | Pasa a **abierto** y se queda | `off` (apagar destino) |
| `double_click` | Estaba **cerrado**, se **abre** y **vuelve a cerrar** en una ventana corta (p. ej. &lt; 400 ms) | Tercera acción: escena, brillo, otro room |

Eso tiene sentido: `on`/`off` copian el palo de la pared a Hue (sin GET). El doble click es un “extra” sin un segundo palo: un apagón-encendido rápido que termina **prendido**.

No hace falta en v1: triple click, long-off, double_off (abrir-cerrar-abrir). Ruido y cables largos se comen el doble click si la ventana es muy corta; se calibra en firmware.

**Canal `momentary`** (BOOT del prototipo, pulsador): eventos distintos — `short`, `long`. `long` en BOOT queda reservado para re-pair Hue, no es receta. Un pulsador **no** genera `on`/`off` estables.

## Visualización y receta (por canal y evento)

Un Bridge a la vez. Dos columnas.

**Izquierda — switches y canales.** XIAO de *este* `bridgeid`. Al elegir uno, cada canal (`kind` + etiqueta). Por canal `maintained` se asignan **hasta tres** recetas: `on`, `off`, `double_click`. Vacías = no hace nada. El XIAO no se dibuja dentro del árbol Hue.

**Derecha — topología del Bridge.** Por **room**:

1. El room entero (`grouped_light`)
2. Las lámparas
3. Las escenas de ese room

Destino habitual de un canal de pared: el **room** (on/off) y opcionalmente una **escena** en el doble click.

**Receta**

```text
switch + channelId + event (on | off | double_click)
  → acción Hue: on | off | recall_scene | toggle
  → destino: { rtype, rid }   // light | grouped_light | scene
```

`toggle` (GET + invertir) es acción Hue, no evento de GPIO. En un `maintained` el mapeo natural es `on`→`on`, `off`→`off`, no toggle.

Ejemplo: canal D0, room Living:

- `on` → `{ action: on, rtype: grouped_light, rid: Living }`
- `off` → `{ action: off, … Living }`
- `double_click` → `{ action: recall_scene, rid: Relax }`

No hay multi-selección suelta de luces. No hay una receta única “del switch”.

Al guardar, `rev` sube. NVS guarda el array `(channelId, event, action, rtype, rid)`. Al registrarse el firmware manda `{ id, gpio, label, kind }[]`.

## Asignar en la app e implementar en el switch

La app **escribe** recetas. El switch **las ejecuta** en la LAN. El GPIO nunca llama a Vercel.

### Qué declara el switch (registro)

Al conectarse manda, junto al `bridgeid` y la MAC, los canales que **existen en hardware**:

```text
channels: [
  { id: "boot", gpio: 9, label: "BOOT", kind: "momentary" },
  { id: "d0",   gpio: 0, label: "D0",   kind: "maintained" },
  …
]
```

La UI no inventa pines. Si un canal no viene, no se asigna. `kind` decide qué **eventos** se pueden mapear (`on`/`off`/`double_click` vs `short`).

### Cómo asigna el usuario (consola)

Flujo de la pantalla del Bridge (gastar tiempo aquí: estados vacío / incompleto / guardado).

1. Elegir un **switch** (izquierda).
2. Ver sus **canales**. Un `maintained` muestra **tres huecos** (copy en inglés: On / Off / Double-click), no un solo combo “action”:
   - On (`on`)
   - Off (`off`)
   - Double-click (`double_click`) — opcional
3. Elegir un hueco y un **destino** en la topología (derecha). Destino = `{ rtype, rid }` de **este** Bridge.
4. La app rellena la **acción Hue** con el default del hueco (se puede cambiar):

| Hueco (evento) | Default acción Hue | Destinos que encajan |
| --- | --- | --- |
| `on` | `on` | `light` o `grouped_light` |
| `off` | `off` | el **mismo** destino que `on`, o vacío |
| `double_click` | `recall_scene` | `scene` (o otro light/group si se quiere) |
| `short` (momentary) | `toggle` | light o grouped_light |

Atajo de UI (inglés): “Use this room for on and off” llena `on` y `off` juntos al mismo `grouped_light`. Double-click queda vacío hasta que elijan una escena.

Un hueco vacío = el switch **no hace nada** en ese evento. Guardar incompleto es válido (`on`+`off` sin double-click).

Frase de confirmación (inglés, no solo UUIDs): *“D0 on → turn on Living · off → turn off Living · double-click → scene Relax”*.

Validar al guardar: `rid` existe en el snapshot de ese `bridgeid`; `recall_scene` solo con `rtype: scene`; `on`/`off` no apuntan a una escena.

`rev` incrementa. Eso es lo que el poll compara.

### Contrato que baja el switch

`GET` de config (Bearer del aparato), mismo `bridgeid`:

```text
{
  rev: 12,
  recipes: [
    { channelId: "d0", event: "on",            action: "on",            target: { rtype: "grouped_light", rid: "…" } },
    { channelId: "d0", event: "off",           action: "off",           target: { rtype: "grouped_light", rid: "…" } },
    { channelId: "d0", event: "double_click",  action: "recall_scene",  target: { rtype: "scene",         rid: "…" } }
  ]
}
```

El switch **no** recibe la topología entera en este GET (eso es el POST de registro/snapshot). Solo recetas. Si `rev` local ≥ `rev` remoto, no escribe NVS. Si `rev` es mayor, **sustituye** todo el array local.

### Qué tiene que hacer el firmware

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

Al boot: cargar recetas de NVS **antes** de atender GPIO. La primera lectura de cada GPIO **solo fija el estado**; no dispara `on`/`off` (un reboot del XIAO no reescribe las luces). No hay “aplicar el palo al Hue” en el arranque. Luego Wi‑Fi, poll, etc.

Si el usuario cambia la receta en la app, el switch se entera en el poll (1 min si ninguna receta; si ya hay alguna, al boot y cada 1 h). Reboot = bajar recetas ya; no dispara eventos de GPIO.

**Otras reglas:**

- El `GET` de config **reemplaza** el array de recetas en NVS (no es un patch). Huecos que ya no vienen se borran.
- Si cambia el `bridgeid` emparejado, se **tiran** las recetas (los `rid` son de otro Bridge).
- Dos switches (o la app Hue) sobre el mismo destino: **gana el último evento**. No hay 3-way ni sincronizar palos.
- Chrome de la consola en inglés; los **nombres Hue** (Living, Velador Tomás) se muestran tal cual.
- Varios POSTs de topología del mismo `bridgeid`: **último snapshot gana**.
- API key revocada: el poll falla; las recetas en NVS **siguen** ejecutándose en la LAN.
- Signup público: no. Solo la cuenta sembrada (`USER_EMAIL`).

## Dos puertas

| Quién | Cómo |
| --- | --- |
| Usuario en el navegador | Email + contraseña (Supabase Auth) |
| XIAO o `push-from-bridge` | `CONSOLE_TOKEN` (API key de aparato) |

El usuario logueado **genera y administra** las API keys en la consola: crear, nombrar, copiar (una vez), revocar. Cada key es un token de aparato. Varios XIAO pueden compartir una, o usar una por placa (mejor para revocar). No hay un `INGEST_TOKEN` eterno en el server como sustituto de esto.

## Cómo implementar (ambos repos + UI)

Los cambios avanzan **en paralelo** en `hue-switch-console` y `hue-simple-switch`. Un recorte no se da por cerrado si deja al otro repo a medias (p. ej. token en la web sin campo en `config.h`, o poll en el C6 sin endpoint).

La interfaz no es un añadido al final. Copy **en inglés**. En cada pantalla (login, API keys, switches y canales | topología, receta por **canal y evento**):

- Diseñar el flujo y los estados (vacío, error, sin asignar, guardado).
- Implementar, **usar** la pantalla, criticar (claridad, toques de más, qué pasa si no hay Bridge/switch).
- Corregir antes de pasar al siguiente recorte.

Gastar tiempo ahí. No fusionar la primera maqueta.

## `config.h`

Hoy (solo Wi‑Fi):

```
WIFI_SSID
WIFI_PASSWORD
```

Cuando existan keys en la consola, agregar:

```
CONSOLE_URL      // https://hue.tineira.com
CONSOLE_TOKEN    // API key de aparato, generada en la UI
```

El resto (Bridge IP, Hue key, receta) se descubre, se empareja o llega por poll, y vive en NVS.

## Primer arranque del XIAO

No hay receta todavía.

1. Conecta al Wi‑Fi.
2. Descubre el Bridge (`mDNS _hue._tcp`, luego NVS, `discovery.meethue.com`).
3. Si no hay key de Hue válida: LED parpadea, `POST /api` hasta que pulsen el botón del Bridge. Key e IP a NVS.
4. **Registro + upload:** “soy esta MAC, Bridge `bridgeid`” y sube la topología a la consola.
5. Pregunta recetas → lista vacía.
6. Los canales no disparan Hue (huecos vacíos). Poll cada ~1 minuto.

El usuario asigna por canal y evento (sección anterior). El poll siguiente escribe NVS y los GPIO empiezan a ejecutar.

## Polling

| Estado | Ritmo | Qué pide |
| --- | --- | --- |
| Ninguna receta en NVS | ~1 min | ¿Hay recetas? (`rev`) |
| Ya hay alguna receta | Al boot y cada 1 h | Topología si cambió + ¿`rev` nuevo? |

Si el usuario cambia recetas en la web, el XIAO puede tardar hasta 1 h salvo reboot (el reboot es “aplicar ya”). El GPIO no usa Vercel: NVS → Bridge.

## Qué no es esto

- La consola no es el camino de la luz (no hay “app en el medio” al pulsar).
- Vercel no alcanza `192.168.x.x`; el IP del Bridge identifica al aparato en la LAN, no abre un túnel.
- No hay API remota de Hue en el v1.
- No hay Zigbee, ni impersonar accesorios Hue, ni mezclar este árbol con el sketch Arduino.

## Infra bloqueada (hacer antes de Auth)

Nada de esto está creado todavía. Sin esto no hay login real ni host público.

| Qué | Para qué | Estado |
| --- | --- | --- |
| Proyecto **Vercel** (link al repo `hue-switch-console`) | Build y serverless de la consola | Pendiente |
| Proyecto **Supabase** (Auth + Postgres) | Cuentas, API keys de aparato, topología, recetas | Pendiente |
| **Cloudflare** DNS: `hue.tineira.com` → Vercel | URL pública que irá en `CONSOLE_URL` del XIAO | Pendiente |
| Variables en Vercel / Supabase | URL de Supabase, anon/service keys; no un token de ingest fijo | Pendiente |
| Primera cuenta | Seed desde `.env.local` (`USER_EMAIL`, `USER_PASSWORD`) al activar Auth. **No commitear** esas claves. | Solo local |

Host de producción: `https://hue.tineira.com` (no el `*.vercel.app` por defecto). En Cloudflare, CNAME `hue` al target que dé Vercel; TLS en el borde.

Hasta que exista el proyecto Supabase, no hay signup público: la primera cuenta se crea a mano con `USER_EMAIL` / `USER_PASSWORD` de `.env.local` (ver `.env.example` para los nombres).

## Cerrado para implementar (no reinventar en el recorte)

- UI **inglés**. Serial del firmware: inglés (ya).
- Switch id = MAC del ESP32 (hex). El API key de aparato pertenece a una cuenta; el switch que registra con esa key queda de esa cuenta.
- API key: se muestra **una vez**, se guarda hash (SHA-256), en la lista solo nombre + prefijo. CRUD en la consola.
- HTTPS a `hue.tineira.com`: **verificar** el certificado (bundle de Arduino). `setInsecure()` solo contra el Bridge Hue.
- Poll: sin recetas ~1 min; con recetas al boot y cada **1 h**. GPIO no espera.
- Receta huérfana (el `rid` ya no está en el snapshot): se conserva; el PUT falla; la UI marca stale.
- Double-click sin receta → se ejecuta `on`. Boot no sintetiza eventos GPIO. Poll reemplaza el set de recetas. Último evento gana. Cambio de `bridgeid` borra recetas. Sin signup público.
- API mínima:
  - Humano (sesión Supabase): login; CRUD API keys; GET topología del Bridge; PUT recetas del switch.
  - Aparato (Bearer key): `POST` registro (MAC, firmware, `bridgeid`, IP, `channels[]`, snapshot); `GET` config (`rev` + `recipes[]`).
- Tablas (Supabase): `device_api_keys`, `bridges` (snapshot JSON), `switches`, `recipes`. RLS: el usuario solo ve lo ligado a sus keys.

## Hoyos de producto

Ninguno abierto. Infra (Vercel / Supabase / DNS), el snapshot rico y la UI de API keys **ya están definidos**; faltan **hacerlos**, no decidirlos. SQL, paths REST y el label editable del switch los define quien implemente.

## Estado actual vs este documento

Hoy: `POST /api/ingest` + página de snapshot (archivo local, copy de plantilla). Firmware: Wi‑Fi, mDNS, pair Hue, un BOOT. `config.h` solo SSID/password.

Orden de implementación (paralelo console + firmware, UI en inglés, ciclo diseñar → usar → criticar → corregir):

1. Infra: Supabase + Vercel + `hue.tineira.com`.
2. Auth + seed de la primera cuenta + **UI de API keys**.
3. Snapshot rico + pantalla Bridge (switches/canales | topología).
4. PUT recetas; firmware `CONSOLE_URL` / `CONSOLE_TOKEN`, registro, poll, NVS, GPIO `maintained` + máquina de double-click.

## Repos

- Firmware: `C:\Users\tinei\Arduino\hue-simple-switch` — [github.com/tineira/hue-simple-switch](https://github.com/tineira/hue-simple-switch)
- Consola: `C:\Users\tinei\hue-switch-console` — [github.com/tineira/hue-switch-console](https://github.com/tineira/hue-switch-console)
