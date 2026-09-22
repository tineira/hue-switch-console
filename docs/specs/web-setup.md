# Hue Switch — instalar desde el navegador

Documento de **requisitos de producto**. Cubre `hue-switch-console` (hue.tineira.com) y el firmware de **los dos** aparatos:

| Producto | Repo | Chip |
| --- | --- | --- |
| Round Display | `hue-round-switch` | XIAO ESP32-S3 |
| Simple (GPIO) | `hue-simple-switch` | XIAO ESP32-C6 |

No es una guía de implementación ni un changelog. La consola **nunca** llama al Bridge. El Bridge **nunca** ve Vercel.

**Estado: cerrado y deprecado (2026-09-22).** El ritual ya está en la pantalla Install (flash, reconectar COM, Improv, `HUESET`). No se reabre. La confiabilidad del Scan y del `HUEOK` se ve después, fuera de este documento. La pantalla siguiente quedó implementada: `docs/specs/finished/devices.md`. Este archivo queda solo como referencia del **cómo** del USB (bins, Improv, token).

OTA del aparato ya en Wi‑Fi: `docs/specs/ota.md`.

Hoy cada XIAO se configura con `config.h` compilado (`WIFI_SSID`, `WIFI_PASSWORD`, `CONSOLE_URL`, `CONSOLE_TOKEN`) y un PC con Arduino. El Bridge ya es mDNS + BOOT + NVS en ambos. Este documento unifica **flash + Wi‑Fi + token** en **una** pantalla de la consola.

---

## 1. Veredicto

Un aparato **nuevo, virgen**, se deja listo **sin Arduino IDE ni arduino-cli** en el PC del usuario.

Chrome o Edge de **escritorio**, en `https://hue.tineira.com`, USB al XIAO:

1. **Flashea** el firmware ya compilado (Web Serial + esptool-js, el mismo *patrón* que ESP Web Tools: manifiesto + partes + offsets). No se usa el botón stock `<esp-web-install-button>`: hay que **conservar el puerto** para Improv y el comando del token.
2. Tras el reset, **la misma página vuelve a pedir el COM** (el puerto se cae; en el primer flash el COM puede cambiar de ROM a CDC).
3. **Improv Serial** escribe la red 2.4 GHz. Arduino **recuerda** esa red (STA persistente del core).
4. La consola **crea** una API key nueva y, por USB, un **comando nuestro** deja token + URL en NVS. El usuario no copia `hsw_…`.

Misma mecánica para Round y simple. Qué placa es, y si hay que preguntar el producto, lo define `docs/specs/finished/devices.md` (Detect primero; el selector de firmware solo si esa placa tiene más de un bin). Si el chip que aparece no es el de ese producto, **no se flashea**.

El navegador **no compila**. Los `.bin` los construye CI al pushear `main` de cada firmware y la web los sirve.

No hay portal SoftAP en el ESP. El C6 está al límite de RAM; un mini-sitio en el chip sería otra forma en el Round y no cabría igual en el simple. **La consola es el portal.** El firmware solo habla USB.

Esta pantalla **no** empareja Hue y **no** espera a que el MAC salga en la lista. Listo = Wi‑Fi recordada + token en NVS.

---

## 2. Qué queda igual

- Emparejar Hue: mDNS, botón del Bridge, NVS. BOOT 3 s re-pair. No pasa por Vercel.
- Recetas / páginas: poll de consola como hoy. El `POST /api/device/register` **sigue exigiendo** Bridge (`bridgeid` + snapshot). No se cambia ese contrato.
- TLS al host de la consola: verificar certificado. `setInsecure()` solo contra el Bridge.
- `config.h` sigue existiendo para **desarrollo**: si Arduino no tiene red recordada **y** NVS `console` no tiene token, el sketch usa los `#define`. En el binario que sirve el instalador web, esos `#define` van **vacíos**; manda lo escrito por USB.

---

## 3. Resultado esperado

| Situación | Qué pasa |
| --- | --- |
| PC con Chrome, USB, usuario logueado en hue.tineira.com | Elige Round o Simple → *Install* → permite el puerto → si el chip no coincide, se aborta → flashea (versión del manifiesto visible) → reconecta COM → Wi‑Fi 2.4 GHz (scan + campo) → token por USB → *Wi-Fi saved. Press the Hue Bridge button, then hold BOOT 3s if it asks.* |
| Primer flash S3 o C6 | Puede hacer falta **BOOT** al enchufar. Copy: *Hold BOOT if this is the first flash*. |
| Chip ≠ producto elegido | No flashea. *This USB device is not a Round Display* / *not a simple switch*. |
| Flash ok, provision fail o se perdió el COM | *Configure Wi-Fi* sin volver a flashear. Volver a elegir el puerto. |
| Safari / iPhone / Firefox | Fuera. Copy: *Use Chrome or Edge on a computer*. |
| Arduino en el mismo PC | Sigue válido para quien desarrolla. No es el camino de producto. |
| Dev contra `localhost` | **Fuera de esta pantalla.** El XIAO no es el PC; `localhost` en el aparato no alcanza Next. Dev = `config.h` + arduino-cli. Producto = `https://hue.tineira.com`. |
| Aparato ya en la pared, cambió el Wi‑Fi, **con** USB | Sin reflash: Improv + comando token otra vez. |
| Aparato ya en la pared, cambió el Wi‑Fi, **sin** USB | Fuera de v1 (ni SoftAP ni BLE). |

Copy de UI en **inglés**.

---

## 4. Consola (hue.tineira.com)

Pantalla (o wizard) de instalación, autenticada (sesión humana, no el Bearer del aparato).

### 4.1 Flash

- **Un manifiesto por producto** (no un JSON mezclado que auto-elija). Partes: bootloader, `partitions`, `boot_app0`, app. Offsets = los del export de `arduino-cli` para ese `sketch.yaml` (Round `default_8MB`, simple `min_spiffs`).
- Antes de escribir: leer el chip por serial. S3 solo con manifiesto Round. C6 solo con manifiesto simple. Si no, abortar (§3).
- **No erase** de flash. NVS (Hue, recetas, páginas, `console`) sobrevive un reflash, igual que en OTA. Un virgen ya viene vacío.
- Web Serial en HTTPS (producción) o `http://localhost` **solo para quien desarrolla la consola**; el aparato de producto no apunta a localhost (§3).
- Tras el write, el XIAO resetea. El wizard **vuelve a pedir** el puerto. No asumir el mismo `COM`.

Artefactos: CI al pushear `main` de **cada** repo firmware (`arduino-cli compile --export-binaries` con `WIFI_SSID` / `CONSOLE_TOKEN` / `CONSOLE_URL` vacíos). Versionados con `FIRMWARE_VERSION` (p. ej. `0.5.13`). La consola sirve o proxea ese origin. Un zip de maintainer puede existir; **no** es el camino de hue.tineira.com.

### 4.2 Provisionar (misma sesión USB, otro open del puerto)

Orden fijo:

1. **Improv Serial** (CDC): red 2.4 GHz. UI = scan (`0x04`) + campo manual. Copy *Wi-Fi (2.4 GHz)*. Arduino persiste STA. Improv **no** lleva el token.
2. Si Improv queda `provisioned`: `POST /api/keys` con nombre tipo `USB 2026-09-20 14:02` (sesión humana). El plaintext **no se muestra**. No se reutiliza una key vieja (el servidor ya no la tiene).
3. En el mismo CDC, **después** de Improv (no mezclar con paquetes `IMPROV`), líneas ASCII `\n`:

```
HUESET token hsw_…
HUESET url https://hue.tineira.com
```

El aparato responde `HUEOK token` / `HUEOK url` (o `HUEERR …`). Guarda namespace NVS `console`, claves `token` y `url`.

`url` se omite en la UI de producto (siempre el default). El comando se manda igual, con `https://hue.tineira.com`, para que NVS no dependa del `#define`.

Si el flash fue ok y esto falla: *Configure Wi-Fi* sin reflash. No dejar una key huérfana a propósito: el mint es **después** del flash ok **y** de Improv `provisioned`. Si `HUESET` falla, esa key existe en la consola y no está en el aparato; el usuario puede revocarla en Keys. No es el camino feliz.

### 4.3 Después

El aparato hace STA con la red que Arduino recordó. El token en NVS habilita register **cuando haya Bridge**. Round vs simple se ramifica como ahora.

Emparejar Bridge = botón del Bridge + BOOT si hace falta, **no** esta pantalla. Copy de cierre: *Wi-Fi saved. Press the Hue Bridge button, then hold BOOT 3s if it asks.*

---

## 5. Firmware (ambos)

Mismo contrato en Round y simple.

### 5.1 NVS

| Dónde | Qué |
| --- | --- |
| Arduino STA persistente | SSID / clave (lo escribe Improv vía `WiFi.begin`) |
| Preferences namespace `console` | `token` (`hsw_…`), `url` (host de la consola) |
| Ya existe (`hue`, recetas, páginas) | Bridge IP, Hue app key, recetas / páginas. **No se toca** en este spec. |

No hay un segundo par nuestro `ssid` / `psk`. Una sola memoria de la red.

Arranque STA:

1. Si Arduino tiene red recordada → conectar a eso.
2. Si no, y `config.h` tiene `WIFI_SSID` no vacío → eso (dev).
3. Si no → **no** quemar `setup` en `WiFi.begin` vacío. LED / pantalla de Wi‑Fi fail como hoy, e **Improv + `HUESET` vivos en el `loop` ya**. Sin SoftAP.

Con red ya guardada, Improv **sigue** escuchando por USB (cambiar de Wi‑Fi o reescribir token sin reflash).

Register y poll leen `console.token` / `console.url` (si están); si no, los `#define`. Producto: `#define` vacíos.

### 5.2 USB

Binario de **producto**: CDC abierto siempre (`Serial.begin`). Parser Improv + `HUESET` en el `loop`. **Logs USB apagados** (no mezclar `println` con Improv). Round hoy, con `SERIAL_DEBUG=0`, ni siquiera abre Serial: eso cambia en el binario del instalador.

Dev con `config.h` puede seguir logueando; no es el binario que sirve hue.tineira.com.

Parser Improv **chico**: sin `WebServer`, sin `DNSServer`, sin WiFiManager. El Round usa el mismo protocolo, no uno más rico.

Hue, GPIO, círculo, idle, páginas: no cambian en este spec.

---

## 6. Fuera de alcance (v1)

- Compilar el sketch **en** el navegador.
- Safari, iOS, Firefox (sin Web Serial usable).
- SoftAP / captive portal / WiFiManager en el ESP.
- SmartConfig / ESP-Touch como camino principal.
- Improv BLE (reconfigurar en la pared sin USB).
- Flashear un producto con el binario del otro (**se impide** por detección de chip; no es “si pasa, mala suerte”).
- Cambiar Clip v2, recetas, el emparejado Hue, o el register sin `bridgeid`.
- Pedir al usuario arduino-cli para un aparato de producto.
- Apuntar el aparato a `localhost` desde esta pantalla.
- Auto-erase de NVS al instalar.

---

## 7. Criterio de hecho

- En hue.tineira.com, logueado, se puede flashear un XIAO **S3 Round** y un **C6 simple** desde Chrome, USB, sin Arduino en esa máquina. La UI muestra la versión del manifiesto.
- Un C6 en el flujo Round (o al revés) **no** se flashea.
- Tras el flash, la misma página (reconectando el COM) deja Wi‑Fi (Arduino) + token/url (NVS `console`). Copy de *Wi-Fi saved…*, **sin** exigir que el MAC aparezca en la lista.
- Con el Bridge emparejado **después** (ritual de siempre), el aparato registra y sale en la lista. Eso valida el token; no es el ok de *esta* pantalla.
- Un segundo USB, sin reflash, puede cambiar la red y reescribir el token.
- Un reflash **no** borra recetas ni la key Hue.
- Un desarrollador puede seguir usando `config.h` + arduino-cli. Esta pantalla no instala contra localhost.
- El C6 no sirve una página HTML. El S3 tampoco, en v1: un solo protocolo USB.
- Un simple-switch y un Round no tienen dos rituales de alta distintos.

---

## 8. Decisiones cerradas (grilling 2026-09-20)

No reabrir en el recorte. Si alguien las pelea, vuelve a captain-idle.

| # | Decisión |
| --- | --- |
| 1 | Listo de esta pantalla = Wi‑Fi + token guardados. La lista espera el botón del Bridge. No se cambia el register. |
| 2 | Improv = solo red. Token = comando `HUESET` en el mismo CDC, **después** de Improv. Cada Install **crea** una API key nueva; el usuario no la ve. |
| 3 | Binario de producto: CDC siempre, logs USB apagados. |
| 4 | Sin red: no rendirse en `setup`. Improv/`HUESET` en el `loop` desde el primer arranque. Con red, Improv sigue vivo por USB. |
| 5 | Arduino recuerda el Wi‑Fi. NVS nuestro = namespace `console` (`token`, `url`). No duplicar ssid/psk. |
| 6 | USB no hace erase. NVS sobrevive, como OTA. |
| 7 | Dos manifiestos. Chip detectado ≠ producto → no flashear. |
| 8 | CI de cada firmware publica el `.bin` de producto (defines vacíos). No “subir a mano” como camino de hue.tineira.com. |
| 9 | Mint del token **después** de flash ok e Improv `provisioned`. Producto = `https://hue.tineira.com`. Localhost no es esta pantalla. |
