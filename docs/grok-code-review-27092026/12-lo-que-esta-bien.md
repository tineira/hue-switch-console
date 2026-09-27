# Lo que está bien

No romper esto al “arreglar” el resto.

- Separación consola ↔ Bridge: la nube nunca tiene la Hue key.
- Tres repos, contrato en la consola, firmwares MIT / consola AGPL.
- Device tokens hasheados, invites hasheados, OTP hasheados, OAuth tokens encrypted.
- Upload token comparado con sha256 + `timingSafeEqual`.
- Signup gate anti-enumeración en `sendCode` y waitlist.
- Turnstile + caps de email + disposable list + bounce/complaint → sale de la fila.
- Ban corta sesiones y el device API.
- Límites por cuenta (switches/bridges/keys/snapshot) con override en admin.
- Ingest anónimo muerto (410).
- Webhook Resend verifica firma y ignora bounces transitorios.
- Flash no borra NVS; offsets de part fijos; chip id chequeado.
- Version pin: mismos bins no se pisan; 409 pide bump.
- Admin no muestra topology de terceros.
- CI sin secretos.
- `envValue()` trim — evita keys pegadas con newline.
- Documentación de producto (`docs/device-api.md`, specs finished) es mejor que el promedio de side-projects.

El sistema es coherente para un hosted pequeño. Los problemas graves son: fugas de error, writes en el GET de poll, snapshot vacío que pisa el bridge, y cero tests alrededor de ese contrato.
