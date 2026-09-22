# Hue Switch — OTA y versión en consola

Documento de **requisitos de producto**. Cubre `hue-switch-console` y el firmware de **los dos** aparatos (Round S3, simple C6).

No es una guía de implementación. La consola **nunca** llama al Bridge. El Bridge **nunca** ve Vercel.

**Estado:** requisitos, no implementado.

Relacionado: `docs/specs/web-setup.md` (USB + Chrome = aparato **virgen**). Este spec es el aparato **ya en la pared**: ver qué firmware corre, ofrecer un binario nuevo, comprobar que el rollout **llegó**.

---

## 1. Veredicto

1. **Cada aparato reporta su versión** en cada poll (y en register). La consola la muestra y la **compara** con el binario publicado para ese producto.
2. **OTA no es automático.** El usuario (en hue.tineira.com) elige qué MAC debe bajar qué versión. El poll solo entonces incluye una oferta `ota`. Sin oferta, el aparato no descarga nada.
3. **USB no se sustituye.** Un XIAO sin Wi‑Fi sigue el instalador web. OTA es el update.

El C6 está al límite de RAM: el cliente OTA tiene que ser el HTTP que **ya** usa para la consola (TLS verificado), no un stack nuevo. Si el C6 no puede bajar el binario, se documenta y el simple se queda en USB; el Round no espera al C6 para OTA.

---

## 2. Qué hay hoy

- Register ya manda `firmware` (string libre). Postgres `switches.firmware`. La lista muestra `· fw 0.5.13` si vino en el último register.
- El poll **GET config** no manda versión → entre registers la consola no se entera de un USB/OTA.
- Particiones **ya** son dual OTA (`app0`/`app1`) en Round (`default_8MB`, ~3,2 MB) y simple (`min_spiffs`, ~1,9 MB). El sketch no descarga.
- NVS (SSID, token, Bridge, recetas, páginas) sobrevive un OTA bien hecho.

Eso no basta para **controlar un rollout**: no hay catálogo de “lo publicado”, ni oferta por MAC, ni señal de “sigue en 0.5.12”.

---

## 3. Resultado esperado

En la lista de switches (y en el detalle del aparato), copy en **inglés**:

| Se ve | Significa |
| --- | --- |
| `fw 0.5.13` | Lo último que **reportó** el aparato |
| `latest 0.5.14` | Binario publicado para ese producto (`round` / `simple`) |
| `current` | Reportado = latest (o = el target que le pedimos) |
| `behind` | Reportado &lt; latest y **no** hay oferta pendiente |
| `offered 0.5.14` | Le mandamos OTA en el poll; aún no reporta esa versión |
| `failed` | Oferta caducó o el aparato reportó otra vez la versión vieja tras un `seen` reciente |
| `seen …` | Ya existe (`last_seen_at`). Sirve para no confundir “no actualizó” con “está apagado” |

Acciones (mismo usuario logueado, no el Bearer del aparato):

- **Offer update** a este MAC (o “a todos los Round / todos los simple” = N ofertas, no un broadcast mágico).
- **Cancel offer** (el siguiente poll ya no trae `ota`).
- No hay “auto-update all at 04:00” en v1.

Tras un OTA ok: el aparato reboot, poll/register con `firmware: "0.5.14"`, la fila pasa a `current`. Eso **es** la prueba de rollout. No hace falta un ack extra si el report + `last_seen_at` son frescos.

---

## 4. Versión

Mismo string que `FIRMWARE_VERSION` hoy: `major.minor.patch` (ej. `0.5.13`). Obligatorio en register y poll. Rechazar vacío en firmware de producto (dev puede seguir mandando lo que sea).

Comparar como semver, no como texto libre. Round y simple tienen **líneas distintas** (un 0.5.13 Round no es un 0.5.13 simple).

---

## 5. Consola

### 5.1 Catálogo de binarios

Por producto (`round` | `simple`):

- `version`
- URL HTTPS del `.bin` de **app** (el slot OTA; no hace falta reenviar bootloader)
- `sha256`
- `size` (bytes)
- `publishedAt`

Fuente: CI al pushear `main` de cada repo, o carga del maintainer. La URL es del mismo host de confianza que `CONSOLE_URL` (o un origin listado). Nunca HTTP plano en producción.

“Latest” = el publicado más nuevo para ese producto.

### 5.2 Oferta por MAC

Tabla (o columnas) p. ej. `ota_target_version`, `ota_offered_at` en `switches`.

Offer: guarda target = latest (o una versión pinneada). Cancel: limpia target.

El GET config **solo** incluye bloque `ota` si ese MAC tiene target **y** `target != firmware reportado`.

### 5.3 Poll reporta versión

Hoy: `GET /api/device/config?mac=…`

Añadir query **obligatoria en firmware nuevo**:

```
GET /api/device/config?mac=aabbccddeeff&firmware=0.5.13
```

El server actualiza `switches.firmware` y `last_seen_at` en **cada** poll, no solo en register. Firmware viejo sin query: se conserva la columna; la UI puede mostrar `fw unknown` si `last_seen` es reciente y no hay string.

### 5.4 Respuesta `ota` (solo si hay oferta)

Junto a `rev` / `recipes` / `pages`:

```json
"ota": {
  "version": "0.5.14",
  "url": "https://hue.tineira.com/…/round-0.5.14.bin",
  "sha256": "…",
  "size": 1234567
}
```

Sin oferta, **omitir** `ota`. El aparato no interpreta “ausente” como “borra firmware”.

Round y simple: el mismo campo; el `url` apunta al binario de **ese** producto. Flashear el binario del otro es error de catálogo, no del gesto.

### 5.5 UI

En la fila del switch (junto a MAC · fw · round · rev · seen):

- Versión reportada **siempre** visible (hoy se pierde si `firmware` es null).
- Badge `current` / `behind` / `offered` / `failed` según §3.
- Botón `Offer update` si behind o si latest &gt; reported. `Cancel` si offered.

No hace falta una pantalla de “flota” en v1: la lista del bridge **es** el tablero de rollout.

Copy inglés.

---

## 6. Firmware (ambos)

### 6.1 Reportar

Cada GET config lleva `firmware=<FIRMWARE_VERSION>`. Register sigue mandando el campo JSON `firmware`.

### 6.2 Aplicar OTA

Si el JSON trae `ota` y `ota.version` ≠ la local:

- No empezar si hay receta/dimmer en vuelo, ni touch down, ni (Round) drag del aro.
- Round: puede estar en **reposo** (BL off); mejor así (radio sí, panel no).
- HTTPS GET del `url` con **el mismo** trust que el poll (bundle; no `setInsecure()`).
- Comprobar `size` / `sha256` antes de marcar el slot booteable.
- Escribir el slot **inactivo**; al ok, `otadata` + reboot.
- NVS no se borra.
- Un solo intento por oferta. Si falla (TLS, espacio, sha, corte): **no** ladrar en loop. El siguiente poll, si la oferta sigue, puede reintentar con backoff (mín. minutos). La consola ve `offered` + `fw` viejo + `seen` fresco → el humano decide cancelar o dejar reintentar.

C6: si el download no cabe en RAM, el firmware **ignora** `ota` y sigue reportando la versión vieja. La consola no miente: sigue `offered` / `behind`. No inventar un SoftAP ni un segundo HTTP stack.

### 6.3 Hue / toque

OTA no bloquea el disco más de lo que ya bloquea un poll largo. Preferir worker o la misma tarea que el poll de consola (el loop de toque Round **no** debe hacer el download síncrono: ver `docs/specs/finished/input-during-hue.md`). Simple: el loop GPIO puede tolerar un download; igual no mezclar con un PUT Hue.

### 6.4 Fallo de boot

Dual slot: si el nuevo app no arranca, el ROM vuelve al anterior. Al volver, poll con la versión **vieja** → consola `failed` / `offered` según §3.

---

## 7. Relación con web-setup

| | USB (`web-setup`) | OTA (este spec) |
| --- | --- | --- |
| Aparato nuevo | Sí | No |
| Ya en Wi‑Fi | Posible, incómodo | Sí |
| Quién elige el binario | Página Install | Offer por MAC |
| Prueba de que corrió | Register `firmware` | Poll `firmware` + seen |

Mismos artefactos CI. El manifiesto USB puede incluir bootloader; OTA solo el app.

---

## 8. Fuera de alcance (v1)

- Auto-update silencioso / horario fijo.
- Delta updates, compress raro, A/B de spiffs.
- Firmar con llave distinta a TLS del host (v1 = HTTPS + sha256).
- Eventstream, portal SoftAP, Improv (siguen en sus specs).
- Forzar OTA al simple si el binario no entra en RAM.
- Borrar NVS o recetas al actualizar.
- Mostrar el `.bin` a un switch del producto contrario.

---

## 9. Criterio de hecho

- La lista de un bridge muestra **fw reportado** de cada MAC, actualizado en el **poll**, no solo al register.
- Se ve **latest** por producto y un badge current / behind / offered / failed.
- Offer update a un Round en campo: el poll trae `ota`; tras reboot, esa fila muestra la versión nueva y `current` (con `seen` fresco).
- Cancel offer: el poll deja de traer `ota`; el aparato no descarga.
- Sin offer, ningún aparato baja un binario solo porque CI publicó.
- USB install (`web-setup`) sigue siendo el camino virgen.
- Un desarrollador con `config.h` + arduino-cli no se rompe; al conectar, el poll igual actualiza `firmware` en la lista.
