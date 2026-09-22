# Devices — detectar, flashear y provisionar por USB

Documento de **requisitos**. La pantalla de producto se llama **Devices**. Install es una acción de esa pantalla, no una página propia.

Cubre `hue-switch-console` y el USB de los dos firmwares. El flash, los bins y el comando que escribe token ya están hechos; `docs/specs/web-setup.md` quedó cerrado y deprecado (solo referencia). Este archivo fija **el orden y qué botones se habilitan**. OTA por Wi-Fi sigue en `docs/specs/ota.md`. El LED naranja del simple (sin PC) está en `hue-simple-switch/docs/specs/finished/led-status.md`.

**Estado:** implementado (consola `/devices`, simple 0.2.8, round 0.5.22). Spec archivado. No es un hueco de implementación.

**Cerrado el 2026-09-22 (grilling):** §7. No reabrir.

---

## 1. Veredicto

Una sola acción de entrada: **Detect device**. El usuario elige el puerto COM (Web Serial). La ficha muestra lo que **esta placa** tiene guardado, no lo que la consola recuerda de un register viejo.

Después se habilitan solo las acciones que esa ficha permite. No hay dos wizards (instalar vs mantener). Wi-Fi se puede poner sin token y sin Bridge. El token solo se crea con Wi-Fi ya asociado.

La consola nunca llama al Bridge. El browser no habla con el Bridge. Este corte no prueba en vivo si el token entra ni si el Bridge contesta. Eso queda fuera: en el simple, un 401 de esas llamadas mueve el LED.

---

## 2. Qué muestra Detect

### Placa (USB, sin preguntarle al sketch)

Chrome solo entrega `vendorId` y `productId` (`SerialPort.getInfo()`). No hay nombre de producto ni revisión USB.

| USB | Lectura |
| --- | --- |
| Seeed `2886:0048` | XIAO ESP32-C6 |
| Seeed `2886:0056` | XIAO ESP32-S3 |
| Seeed `2886:0063` | XIAO ESP32-S3 Plus — no soportado |
| Seeed `2886:0067` | XIAO ESP32-C5 — no soportado |
| Espressif `303A:1001` | USB Serial/JTAG. Lo usa el bootloader ROM **y** el sketch de producto (C6, y Round con Hardware CDC). El PID no distingue C6 de S3 |
| Otra cosa, o sin identificador | Se elige C6 o S3 y **Install** graba ese firmware. Al escribir, el grabador lee el chip y no sigue si no coincide |

Seeed `2886:0048` / `2886:0056` mandan cuando aparecen. En `303A:1001` Detect abre el puerto y prueba Improv y `HUEGET`. Si el sketch dice el chip, esa es la placa y no se pregunta. Si no contesta, es bootloader: la UI pregunta C6 o S3. Al flashear, el chip que lee el grabador manda sobre esa respuesta: si no coincide, no se escribe.

### Firmware (solo si el sketch contesta)

Improv ya trae nombre y versión. Lo demás es un comando de texto en el mismo CDC que `HUESET`:

```
HUEGET
HUESTA mac=aabbccddeeff product=simple ver=0.2.7 chip=c6 ssid=Milka2 wifi=up ip=192.168.1.20 bid=001788fffe123456 bip=192.168.1.2 url=https://hue.tineira.com token=1 key=1
```

Una sola línea. Las claves van siempre; el valor va vacío si no hay nada guardado. `wifi` es `up` o `down`. `token` y `key` son `1` o `0`.

| Campo | Regla |
| --- | --- |
| `mac` | MAC Wi-Fi, 12 hex en minúsculas, la misma que el register |
| `product` + `ver` | `simple` / `round` + `FIRMWARE_VERSION` |
| `chip` | `c6` o `s3`, el que el sketch cree ser. Se cruza con el USB |
| `ssid` | El nombre guardado. **Nunca** la clave |
| `wifi` + `ip` | `up` y la IP si está asociado. `down` e IP vacía si no |
| `bid` + `bip` | `bridgeid` entero e IP del Bridge, o vacíos. No hay id corto |
| `url` | La URL guardada, o vacía |
| `token` | `1` solo si lo guardado es una key de consola (`hsw_…`). Cualquier otro texto cuenta como no. El token no sale |
| `key` | `1` si hay application key Hue. La key no sale. **Pareado** = `key=1` |

No salen la clave Wi-Fi, el token ni la key Hue. No se pide el árbol Hue, ni páginas, ni recetas. Eso vive en la consola si el aparato ya se registró.

No hay bloque **“Probé ahora”** en este corte. La ficha es solo **“Guardado”**.

Si la `mac` ya está en la base, al lado: última vez que la consola la vio y firmware que la consola cree. Si no coincide con el USB, se muestra el desfase. No se pisa la ficha USB con la fila de la base.

Un firmware que no entiende `HUEGET` sigue pudiendo flashear y guardar Wi-Fi con Improv. De esa placa, Detect muestra el PID y, si Improv contesta, nombre y versión. Token, Pair, Clear y el resto de la ficha esperan a `HUEGET`.

Cruce: el `chip` del sketch no es el del USB, o el `product` no es el de esa placa (C6 = simple, S3 = Round). No se provisiona. El único flash es el firmware de la placa USB (§3).

---

## 3. Qué botón se enciende

| Lo que Detect ve | Acciones |
| --- | --- |
| USB raro, C5, S3 Plus | Ninguna. “No soportado” |
| Bootloader `303A:1001` | Preguntar C6 o S3. Luego **Install** del firmware de esa placa |
| C6 o S3 Seeed, el sketch no habla nuestro protocolo | **Install** del firmware de esa placa |
| Nuestro firmware, chip y producto coinciden | Wi-Fi. Token y Pair solo con `wifi=up`. **Update** solo si `ver` es menor que el manifest. Clear NVS |
| Nuestro firmware al día, chip y producto coinciden | Sin Update prominente. Wi-Fi. Token y Pair solo con `wifi=up`. Reinstalar (secundario). Clear NVS |
| Chip USB y producto (o chip) del sketch no coinciden | No Wi-Fi, no token, no Pair, no Clear. **Install** del firmware que corresponde al chip USB |

**Install y Update son el mismo flash** (`web-setup.md`: Web Serial, bins del manifest). Cambia el rótulo. Tras el reset el puerto se cae y hay que volver a elegir el COM; no se asume que el número siga igual.

| Placa | Firmware hoy | Selector |
| --- | --- | --- |
| C6 | solo simple | No se pregunta |
| S3 | solo Round | No se pregunta |
| Más de un bin para esa placa (futuro: S3 + simple) | | El usuario elige **antes** de flashear |

No ofrecer downgrade si la placa ya tiene una versión **mayor** que el manifest de **ese** producto. El Install de un cruce no compara versiones entre simple y Round: graba el binario actual de la placa USB.

**Clear NVS** no está en la fila de “cambiar Wi-Fi”. Solo con nuestro firmware y el chip coincidiendo con el producto. No en bootloader ni en cruce.

Borra el Wi-Fi que recuerda el Arduino (SSID y clave), el namespace `console` (token, URL), `hue` (IP, key, bridgeid), `recipes`, y en el Round también `pages` (páginas, eje, timeout, última escena). El simple no tiene `pages`. Deja el firmware. No borra el resto de la flash del chip.

Confirmación en inglés: *This forgets Wi-Fi, the console token, the Hue link, and saved recipes or pages. The firmware stays.*

El comando limpia la flash y la copia en RAM. No reinicia. La ficha se vuelve a leer en el mismo cable.

**Pair** solo con `wifi=up` y chip/producto coincidiendo. Hace lo mismo que aguantar BOOT 3 s: si ya hay key, la borra, busca el Bridge si todavía no hay IP, y espera hasta 90 s el botón del Bridge. El comando USB vuelve al tiro (`HUEOK pair`, o error si no hay Wi-Fi). Los 90 s corren en el aparato. La página relee `HUEGET` hasta que `key=1` o se cumple el tiempo.

Si `key=0`, arranca directo. Si `key=1`, la página confirma antes: *This forgets the current Hue link and starts pairing again.* Después: *Press the button on the Hue Bridge.* Pareado en la ficha = `key=1`, no un GET al Bridge.

**URL y token no son un formulario.** Token solo con `wifi=up`. No hace falta Bridge pareado. Cada clic crea una API key nueva. Por USB se escribe esa key y `https://hue.tineira.com`, con el `HUESET` que ya existe. El usuario no ve el token. “Cambiar token” es ese mismo clic otra vez.

---

## 4. Orden de un aparato nuevo

1. Detect.
2. Si es bootloader, la persona dice C6 o S3. Si el PID ya es Seeed, no se pregunta.
3. Install (un solo firmware, o el elegido si hay más de uno).
4. El puerto se cae; Detect de nuevo (como `web-setup.md`).
5. Con el sketch ya corriendo: Wi-Fi (scan en el aparato, Improv). Con `wifi=up`, token. Luego Pair si se quiere Hue.
6. La ficha se relee sola al cerrar cada acción.

Listo de provisioning = Wi-Fi recordada + token en NVS. Pair es necesario para que el palo o el disco hablen con Hue, pero no bloquea el flash ni el token. La página no espera a que la MAC aparezca en la lista de la consola.

---

## 5. Lo que no cambia

- Sin SoftAP. Sin Arduino IDE en el PC del usuario.
- El browser no compila. Los bins salen de CI, servidos por la consola.
- No se escribe la clave Wi-Fi ni el token en la página, ni vuelven en la lectura.
- El LED del simple no se usa para esta ficha. Es para cuando no hay PC. Este corte no dispara las llamadas que mueven ese LED.
- OTA por la red no sustituye este USB.

---

## 6. Comandos USB

Además de Improv y `HUESET`, en simple y Round:

| Comando | Respuesta | Hace |
| --- | --- | --- |
| `HUEGET` | una línea `HUESTA` (§2) | Solo lectura de lo guardado. No hace HTTP |
| `HUEPAIR` | `HUEOK pair` o `HUEERR no-wifi` | Arranca el mismo re-pair que BOOT 3 s y vuelve al tiro |
| `HUECLR` | `HUEOK clear` | Borra lo dicho en §3, RAM incluida, sin reiniciar |

`HUEPAIR` con Wi-Fi y sin IP de Bridge busca el Bridge como el re-pair de hoy. Si no lo encuentra, la key no aparece y la ficha sigue en no pareado.

Un firmware anterior a simple 0.2.8 o round 0.5.22 no entiende estos comandos. En ese caso Detect solo muestra el PID USB y, si Improv responde, el nombre y la versión.

---

## 7. Decisiones cerradas (grilling 2026-09-22)

No reabrir en el recorte.

| # | Decisión |
| --- | --- |
| 1 | `HUEGET` → una línea `HUESTA` con lo guardado, MAC incluida, `bridgeid` entero. Sin secretos. Sin pruebas en esa línea. |
| 2 | Este corte no tiene “Probé ahora”. La ficha es solo “Guardado”. |
| 3 | Pair = hold de BOOT 3 s. El comando vuelve al tiro. Confirmación solo si ya hay key. Pareado = `key=1`. |
| 4 | Clear borra Wi-Fi del Arduino, `console`, `hue`, `recipes` y, en el Round, `pages`. Deja el firmware. Sin reiniciar. Solo si chip y producto coinciden. |
| 5 | Chip y firmware cruzados: no se provisiona. El único flash es el firmware del chip USB. |
| 6 | Token solo con Wi-Fi asociado. Cada clic crea una key nueva y escribe `https://hue.tineira.com`. No hace falta el Bridge. |
