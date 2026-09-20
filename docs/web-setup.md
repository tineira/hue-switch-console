# Hue Switch — instalar desde el navegador

Documento de **requisitos de producto**. Cubre `hue-switch-console` (hue.tineira.com) y el firmware de **los dos** aparatos:

| Producto | Repo | Chip |
| --- | --- | --- |
| Round Display | `hue-round-switch` | XIAO ESP32-S3 |
| Simple (GPIO) | `hue-simple-switch` | XIAO ESP32-C6 |

No es una guía de implementación ni un changelog. La consola **nunca** llama al Bridge. El Bridge **nunca** ve Vercel.

**Estado:** requisitos, no implementado.

Hoy cada XIAO se configura con `config.h` compilado (`WIFI_SSID`, `WIFI_PASSWORD`, `CONSOLE_URL`, `CONSOLE_TOKEN`) y un PC con Arduino. El Bridge ya es mDNS + BOOT + NVS en ambos. Este documento unifica **flash + Wi‑Fi + token** en **una** pantalla de la consola.

---

## 1. Veredicto

Un aparato **nuevo, virgen**, se deja listo **sin Arduino IDE ni arduino-cli** en el PC del usuario.

Chrome o Edge de **escritorio**, en `https://hue.tineira.com`, USB al XIAO:

1. **Flashea** el firmware ya compilado (Web Serial + esptool, el mismo patrón que ESP Web Tools).
2. **En la misma sesión USB**, escribe en NVS: SSID 2.4 GHz, clave, token de aparato (`hsw_…`). Opcional: `CONSOLE_URL` si no es el default.

Misma UI para Round y simple. El usuario elige el producto; el binario y el chip cambian, el ritual no.

El navegador **no compila**. Los `.bin` los construye CI (o el maintainer) y la web los sirve.

No hay portal SoftAP en el ESP. El C6 está al límite de RAM; un mini-sitio en el chip sería otra forma en el Round y no cabría igual en el simple. **La consola es el portal.** El firmware solo habla USB.

---

## 2. Qué queda igual

- Emparejar Hue: mDNS, botón del Bridge, NVS. BOOT 3 s re-pair. No pasa por Vercel.
- Recetas / páginas: poll de consola como hoy.
- TLS al host de la consola: verificar certificado. `setInsecure()` solo contra el Bridge.
- `config.h` sigue existiendo para **desarrollo**: si NVS no tiene SSID, el sketch puede usar los `#define` como respaldo. En un binario de “instalador web”, esos `#define` van vacíos o de fábrica; manda NVS.

---

## 3. Resultado esperado

| Situación | Qué pasa |
| --- | --- |
| PC con Chrome, USB, usuario logueado en hue.tineira.com | Elige Round o Simple → *Install* → permite el puerto serial → flashea → pide Wi‑Fi 2.4 GHz → guarda token → listo |
| Primer S3 | Puede hacer falta **BOOT** al enchufar, igual que hoy con esptool |
| C6 simple | El mismo flujo; otro `.bin` / manifiesto |
| Safari / iPhone | Fuera. Copy: use Chrome or Edge on a computer |
| Arduino en el mismo PC | Sigue válido para quien desarrolla. No es el camino de producto |
| Aparato ya en la pared, cambió el Wi‑Fi, sin USB | Fuera de v1 (ni SoftAP ni BLE). Se vuelve a enchufar USB o se edita NVS como ahora |

Copy de UI en **inglés**, p. ej. *Install device*, *Connect USB*, *Hold BOOT if this is the first flash*, *Wi-Fi (2.4 GHz)*, *Done*.

---

## 4. Consola (hue.tineira.com)

Pantalla (o wizard) de instalación, autenticada (sesión humana, no el Bearer del aparato).

### 4.1 Flash

- Sirve un **manifiesto** por producto: bootloader, `partitions`, firmware app (y lo que pida esptool-js / ESP Web Tools para S3 vs C6).
- El navegador usa **Web Serial** (HTTPS). El usuario elige el COM.
- Al terminar, el XIAO resetea y ya corre el firmware de producto.

Los artefactos salen de CI al hacer push a `main` de cada repo (o un job que publique ambos). No se suben a mano como único camino. Versionados (p. ej. `0.5.13`).

### 4.2 Provisionar (misma sesión USB)

Después del reset, la misma página habla de nuevo por serial (**Improv Wi-Fi** y, si Improv no basta para el token, un comando extra documentado en firmware):

Escribe en NVS:

- `ssid`, `psk` (red **2.4 GHz**)
- `console_token` (`hsw_…` que **esta** sesión acaba de crear o reutilizar)
- `console_url` opcional; default `https://hue.tineira.com`

El token se crea en el servidor (SHA-256 guardado, como hoy). No se pide al usuario que copie `hsw_…` a un `.h`.

Si el flash fue ok pero el provision falla, copy de reintento *Configure Wi-Fi* sin volver a flashear.

### 4.3 Después

El aparato hace STA, `POST /api/device/register` con el Bearer, aparece en la lista. Round vs simple se ramifica como ahora. Emparejar Bridge = BOOT, no esta pantalla.

---

## 5. Firmware (ambos)

Un **mismo contrato NVS** (nombres de clave alineados entre repos):

| Clave (ilustrativa) | Contenido |
| --- | --- |
| Wi-Fi ssid / psk | STA |
| console url / token | poll y register |
| (ya existe) | Bridge IP, Hue app key, recetas / páginas |

Arranque STA:

1. Si NVS tiene ssid → `WiFi.begin` eso.
2. Si no, y `config.h` tiene `WIFI_SSID` no vacío → eso (dev).
3. Si no → no hay red; no abrir SoftAP en v1. LED / pantalla de Wi‑Fi fail como hoy.

Parser **Improv Serial** (CDC). En el C6 tiene que ser **chico**: sin `WebServer`, sin `DNSServer`, sin WiFiManager. El Round usa el mismo protocolo, no uno más rico.

Hue, GPIO, círculo, idle, páginas: no cambian en este spec.

---

## 6. Fuera de alcance (v1)

- Compilar el sketch **en** el navegador.
- Safari, iOS, Firefox (sin Web Serial usable).
- SoftAP / captive portal / WiFiManager en el ESP.
- SmartConfig / ESP-Touch como camino principal.
- Improv BLE (reconfigurar en la pared sin USB).
- Flashear un producto con el binario del otro.
- Cambiar Clip v2, recetas, o el emparejado Hue.
- Pedir al usuario arduino-cli para un aparato de producto.

---

## 7. Criterio de hecho

- En hue.tineira.com, logueado, se puede flashear un XIAO **S3 Round** y un **C6 simple** desde Chrome, USB, sin Arduino en esa máquina.
- Tras el flash, la misma página deja SSID + token en NVS; el aparato registra y sale en la lista.
- Un desarrollador puede seguir usando `config.h` + arduino-cli.
- El C6 no sirve una página HTML. El S3 tampoco, en v1: un solo protocolo.
- Un simple-switch y un Round no tienen dos rituales de alta distintos.
