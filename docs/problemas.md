# Problemas para analizar — producto Hue

Documento de **análisis**, no de implementación ni changelog. Lo arma el capitán (2026-09-20) cruzando consola + Round + simple contra `docs/device-api.md`, `docs/definiciones.md` y `docs/round-pages.md`.

**No se implementó nada.** El recorte siguiente se decide aquí, no en el código.

Mapa Herdr (esta sesión, no recrear): `hue-captain` w4 · `hue-console` w5 · `hue-round` w6 · `hue-simple` w7. `tinei` w2 no se toca.

Audits crudos de los impl (anexo, no contrato):

- consola: `docs/_audit-console.md` (C1–C24)
- round: `C:\Users\tinei\Arduino\hue-round-switch\docs\_audit-round.md` (R1–R14)
- simple: `C:\Users\tinei\Arduino\hue-simple-switch\docs\_audit-simple.md` (S1–S9)

---

## Cómo leer esto

| Severidad | Significa |
| --- | --- |
| **Contrato** | El spec se contradice, o código y spec no pueden ser ciertos a la vez. Hay que **decidir** antes de tocar código. |
| **Runtime** | Con el contrato actual, un usuario o un segundo aparato se rompe. |
| **Docs** | El código ya hizo el recorte; los docs mandan el recorte viejo. Agentes y humanos van a reimplementar o a saltarse el hecho. |
| **Deuda** | No bloquea el ritual de hoy; se pudre si se deja. |

Lo que **sí** está alineado (no reabrir): `POST /api/ingest` → 410; register + poll Bearer; TLS consola con bundle / `setInsecure` solo Bridge; Round manda `product:"round"` + `channels:[]`; simple omite `product` y manda GPIO; `group`/`dim` se parsean en firmware 0.5.13; idle + swipe + worker de receta/aro en Round; máquina GPIO maintained (400 ms, fallback doble → `on`); poll 1 min / 1 h.

---

## 1. El contrato se miente a sí mismo

Estos hay que cerrar **en papel** o cada impl va a “arreglar” el mundo de 2026-09-18.

### P1 — `definiciones.md` describe otro producto

**Severidad:** Docs (contamina Contrato) · C1, R5, S8

El archivo sigue siendo el de producto, pero el “hoy” es falso:

- Auth = Supabase; infra Vercel/Supabase/DNS “pendiente”. Runtime: Neon + cookie `hsw_session` (`lib/auth.ts`).
- “Hoy: `POST /api/ingest` + snapshot local”. Runtime: ingest 410, register rico.
- `config.h` “solo SSID/password”. Ambos firmwares ya tienen `CONSOLE_URL` / `CONSOLE_TOKEN`.
- API aparato = `{ rev, recipes[] }` con `channelId`. Round necesita `pages` + `pageId` o restaura NVS.
- Fallback `double_click` → `on` es de **pared**. El círculo es no-op si el doble está vacío.
- Sección Repos: no lista `hue-round-switch`.
- “Hoyos de producto: ninguno” y web-setup sigue siendo requisitos.

`device-api.md` es más nuevo y también arrastra cookie `sb-…` (C3). Quien lea solo definiciones reabre ingest.

**Decidir:** reescribir el estado (Auth Neon, register, Round = `round-pages.md`, simple = GPIO) y dejar de tener una sección “Hoy” que caduca, **o** marcar definiciones como solo simple-switch y apuntar el resto a device-api / round-pages.

### P2 — Dos copias “canónicas” de páginas no coinciden en el estado

**Severidad:** Docs · R1, R2, R3, R4, R6

`docs/round-pages.md` L7/L662: grupo + `dim.mode` **ya** persisten y el firmware consume el poll.

`hue-round-switch/docs/pages-requirements.md` L7/L662: **aún no está en código**.

El firmware 0.5.13 **sí** parsea `group`/`dim`, idle, worker. Además:

- `AGENTS.md` y README Round siguen el modelo `c1` / gpio 0 / “el aro dimmea la receta”. El registro real es `channels:[]`.
- `idle-display.md` vivo dice “no implementado”; hay copia en `docs/specs/finished/`.
- `input-during-hue.md` encabezado 0.5.8 vs cuerpo “hoy 0.5.7”.

**Decidir:** una sola copia manda el **estado**. El cuerpo de §8.2 ya es el mismo; el párrafo de estado no.

### P3 — `rev = 0` no vacía NVS

**Severidad:** Contrato · C5

device-api: cambio de `bridgeid` borra recetas y `rev` pasa a **0**.

Firmware (simple y round): si `rev` local ≥ remoto, **no** escribe NVS.

`upsertSwitch` (`lib/db.ts` ~L304–332) pone `rev = 0` en consola. Un XIAO con NVS `rev=12` que se re-empareja a otro Bridge ve remoto 0 y **conserva recetas del Bridge anterior** (salvo que el firmware resetee `rev` al cambiar `bid`, que simple sí intenta en `recipesBindBridge` — hay que confirmar que Round hace lo mismo **antes** del poll).

**Decidir:** o la consola **incrementa** `rev` al vaciar (el poll sustituye), o el contrato exige reset de NVS en firmware al cambiar `bridgeid` y se deja de usar `0` como semáforo. Hoy pide las dos cosas y no cuadran.

### P4 — Snapshot omitido / vacío pisa el árbol del Bridge

**Severidad:** Contrato + Runtime · C8, S2, S3

Último snapshot gana. Eso es correcto **si el POST es un árbol real**.

- Parser: `lights` omitido → 400. `rooms` / `scenes` omitidos → `[]` y el register **acepta** (C8). Un POST incompleto deja la UI sin grupos.
- Simple: `hueBuildSnapshot` **siempre** `return true` (`snapshot.h:214–239`). Si Clip v2 falla, POSTEA `[]`. Un C6 con key mala **borra** living/escenas de todos los XIAO de ese `bridgeid` (S2).
- Objeto escena Clip v2 > 20 KB (`JsonDataSink::kMaxObj`) se descarta: faltan escenas para `double_click` → `recall_scene` (S3). Round usa el mismo patrón de stream; hay que mirar si comparte el tope.

**Decidir:** ¿register sin `rooms`/`scenes` es 400? ¿POST con streams Hue ≠ 200 se omite (no pisa)? ¿El parser de escena puede no copiar `actions`?

### P5 — Inferencia `product` es frágil

**Severidad:** Contrato · C6, C23, S1

Contrato: `product` opcional; `[]` o `c1` ⇒ round; GPIO ⇒ simple.

Código: `channels.length === 0` ⇒ round. Un Round **sin** `product` y con cualquier canal que no sea `[]`/`c1` se clasifica simple y **borra páginas** (`lib/db.ts` L297–299). Un simple que mande `[]` recibe poll Round (`pageId`) y al subir `rev` se queda sin recetas GPIO.

Simple hoy **omite** `product` (legal) y manda GPIO (seguro). Round manda `product:"round"` (seguro). El hueco es el camino de inferencia y el wipe round→simple.

**Decidir:** ¿wipe solo con `product:"simple"` explícito? ¿Simple debe mandar `"product":"simple"` siempre?

### P6 — Grupo obligatorio vs página `p1` sin grupo

**Severidad:** Contrato · C12

round-pages §12: grupo obligatorio. §14: si no se infiere, la página queda **sin grupo**. El register crea `p1` / “Page 1” con `group: null`. El PUT humano también acepta `group: null` si no hay recetas.

**Decidir:** el default sin grupo es estado “recién registrado” (permitido hasta el primer save), o el PUT exige grupo siempre.

### P7 — Dual-stack Round pre-páginas

**Severidad:** Contrato (solo si hay placas viejas) · C22

El poll Round **solo** emite `pageId` + `pages[]`. No hay dual-write `c1`. Spec: “v1 asume flash junto con la consola.”

**Decidir:** ¿queda alguna Round en campo con firmware pre-`pages`? Si no, no es recorte. Si sí, el poll actual las deja ciegas.

---

## 2. Runtime — el dedo o el árbol se rompen

### P8 — HTTP síncrono en el `loop` (GPIO y toque)

**Severidad:** Runtime · S4, R11

Contrato: el contacto / el dedo **no** esperan Vercel. Simple: `loop` = `channelsPoll` + `consolePollTick`. Un register armado hace 4 GET Hue (timeout 20 s) + POST consola (15 s) + GET config **sin muestrear pines**. Ventana de doble click = 400 ms → un poll parte el doble en `off`+`on`.

Round sacó receta/aro/refresh a `hue_job` (cumple input-during-hue para gestos). El **poll horario** sigue en el loop (`console.h`: si hay recetas, re-POSTA snapshot). Durante ese tramo el toque no corre.

**Analizar juntos:** no son dos bugs distintos. Es la misma decisión: ¿el snapshot periódico sale del camino de input, o se acepta freeze 1 h × N segundos?

### P9 — Ciclo de escenas sin GET al Bridge (Round)

**Severidad:** Runtime · R7, R12

§8.1: verdad = `status.active` en el Bridge; si hay activa → siguiente; si ninguna → primera. El worker **no GET-ea**. Cicla desde `pagesLastSceneRid()` (último PUT local). Un cambio en la app Hue desincroniza el círculo. Un `rid` 404 en `targets[]` falla el gesto entero (el aro sí salta 404).

`recipeFindActiveScene` en `channels.h` hace el GET, pero el camino vivo es `hue_job` y no lo llama.

### P10 — Toggle post-swipe puede apagar el room nuevo (Round)

**Severidad:** Runtime · R8

Ack optimista: `gLightOn` nace `true` y sobrevive al swipe. Un tap antes del GET de fondo puede PUT `off` al destino de la página nueva. El split (dos luces) trata unknown como off y manda **on**; el disco entero no.

### P11 — `group`/`dim` del poll se ignoran si `rev` no sube

**Severidad:** Runtime · C4, R9

GET config Round **reescribe** `group`/`dim` en Postgres (`persistPageGroupAndDim`) **sin** bumpear `rev`. El JSON de esa respuesta ya trae valores nuevos; el firmware los tira si `localRev >= remote`. Un cambio de `grouped_light` en el snapshot no llega a NVS.

Además el firmware, si `dim` viene `null`, **reinfiere** el aro desde recetas (`pagesFillDimFromRecipes`). Spec: la consola calcula `dim`; el aparato no infiere el room desde una escena.

**Decidir:** poll read-only + `rev` solo en PUT, **o** bumpear `rev` cuando group/dim persistidos cambian. ¿Se borra el fill local?

### P12 — Wi-Fi fail en simple no reintenta

**Severidad:** Runtime · S5

`setup`: 60 × 250 ms, `return`. `loop` no llama `WiFi.begin`. Round sí reintenta. El C6 no registra, no aparece en la consola. GPIO primed; recetas skip “WiFi down”.

### P13 — Timeout 1–9 s en el input Round

**Severidad:** Runtime (UX) · C7

Contrato: **0** o **10–600**. El input HTML es `min=0 max=600`. PUT 400 y **no guarda** el resto del draft de páginas.

### P14 — `computeDim` no mira `caps`

**Severidad:** Runtime (aro) · C18

Regla 4: nada dimmable → `dim: null`. El código no lee `caps[]`. Luces on/off-only igual bajan `{ mode: "lights" }` o `group`; el firmware PUT `dimming`.

### P15 — Nombre de página Unicode

**Severidad:** Runtime (círculo) · C13

Spec: ASCII, `Niños` → `Ninos`. El pliegue solo corre al crear desde el nombre Hue. Rename + PUT aceptan `"Niños"`. Preview web ≠ GC9A01.

---

## 3. Docs y fósiles (van a hacer daño a un agente)

| Id | Qué | Riesgo |
| --- | --- | --- |
| P16 | `supabase/migrations/…_init.sql` es Auth+RLS+`channel_id NOT NULL`, sin `pages`. Runtime = Neon `db/schema.sql` + `ensure-schema.ts` (C2) | Aplicar la migración fósil deja un Postgres que **no puede** guardar Round ni esta auth |
| P17 | `ensure-schema.ts` crea `switches` **sin** CHECK de product/axis/timeout que sí están en `schema.sql` (C11) | Dos Postgres distintos según `migrate` vs cold start |
| P18 | Columnas muertas `pages.dim_target_*` (C10). Spec: no hay `dimTarget` | Confunde migraciones |
| P19 | README consola y home: “recipes per channel”. README simple: “una lámpara”, recetas “aún no”, `CONSOLE_*` “cuando existan keys”. `hue-lights.md` pide `HUE_LIGHT_ID` (C9, S7, R4) | Onboarding al recorte viejo |
| P20 | web-setup: requisitos en `docs/specs/web-setup.md`. Ni UI ni Improv ni `.bin`. Alta real = `config.h` (C14, S6) | ¿v1 cerrada sin esto, o recorte bloqueante? |
| P21 | Parser JSON simple no tolera espacio tras `:` (S9). `Response.json()` compacto suele funcionar | Un pretty-print en consola deja NVS viejo |
| P22 | Código muerto Round: `recipeFire` / `uiRefreshState` síncronos (R10) | Re-cablear congela Ready otra vez |

---

## 4. Deuda de consola (no wire, sí producto)

- **C16** GET `/recipes` en Round devuelve `[]`; PUT es 400 `round_switch_uses_pages`.
- **C17** Al cambiar `bridgeid` se calculan reset de eje/timeout/`page_seq` y el `ON CONFLICT` **no los escribe**.
- **C19** Double-click simple: definiciones default `recall_scene`; click en “Whole room” asigna `on`.
- **C24** Reordenar páginas/escenas: spec “drag o flechas”; UI solo flechas.
- **C20** Cero tests. C6–C8, C12, C18 no tienen red.
- **C21** 500 `database_error` y 410 con `message` (no `details`) no están en la tabla de device-api.

---

## 5. Decisiones cerradas (2026-09-20, grilling)

No reabrir en un recorte. Si alguien las pelea, vuelve al capitán.

| # | Decisión | Qué implica |
| --- | --- | --- |
| 1 | `definiciones.md` se **reescribe al estado real**. Sigue siendo el doc de producto (simple + Round). | Borrar el «Hoy» falso (ingest, Supabase, config.h solo Wi‑Fi). Round detalla en `round-pages.md`. Wire en `device-api.md`. |
| 2 | **Estado** de páginas / idle / input-during-hue lo manda `docs/round-pages.md` (consola). | Alinear `pages-requirements.md`, `AGENTS.md` Round (`c1` fuera), idle e input-during-hue al firmware 0.5.13. |
| 3 | Cambio de `bridgeid`: consola **bumpea `rev`** al borrar **y** firmware resetea NVS. | Nunca `rev = 0` como semáforo. Poll: remoto > local sustituye. Defensa en profundidad. |
| 4 | Register con snapshot vacío/Hue caído **no pisa**. Last **good** snapshot wins. | `rooms`/`scenes` omitidos = 400. Stream Clip ≠ 200 → no reemplazar el árbol. |
| 5 | Wipe round→simple **solo** con `product: "simple"` explícito. Ambos firmwares **mandan `product`**. | Inferencia por canales = solo placas viejas. Un canal raro no borra páginas. |
| 6 | `p1` sin grupo es **legal al registrar**. **Save** (PUT humano) **exige grupo**. | No hay página de producto «sin room». El alta del XIAO no inventa un grupo. |
| 7 | **No** hay Round en campo pre-páginas. Solo placas propias, flash propio. | No dual-write `c1`. v1 = flash junto con la consola. C22 cerrado. |
| 8 | Snapshot / register **salen del loop** de GPIO y toque, **los dos** productos. | El palo de 400 ms y el dedo no esperan GET Hue ni Vercel. |
| 9 | Ciclo de escenas = **caché local** (último PUT / NVS), no GET `status.active`. | **Enmienda de spec**, no bugfix. Cambiar §8.1. Ver nota. |
| 10 | `dim` del poll es **sagrado**. Borrar `pagesFillDimFromRecipes`. | `dim: null` = sin aro. Un solo algoritmo §8.2, en consola. |
| 11 | web-setup **no** entra en este v1. Alta = Arduino + `config.h`. | `docs/specs/web-setup.md` sigue requisitos. No es este recorte. |
| 12 | `supabase/` se **borra o archiva con DO NOT APPLY**. | No reescribirla a Neon. Runtime = `db/schema.sql` + `ensure-schema.ts`. |

### Nota — pregunta 9 / hallazgo P9 (R7)

§8.1 hoy dice: verdad = Bridge (`status.active`); si hay activa → siguiente; si ninguna → primera. El código hace caché del último PUT.

Elegiste **el código**. R7 **deja de ser producto-roto**: el círculo no persigue la app Hue. Coste: Relax en el teléfono, tap en el disco, puede PUT la «siguiente» desde el último recall local (un paso atrasado, o no la primera tras un off en la app). Off **local** (doble tap) ya limpia el rid y vuelve a la primera.

Al reescribir `round-pages.md` §8.1: el GET de escena activa queda para **pintar el nombre** (refresh), no para elegir el próximo `rid`. El ciclo es NVS. Un `rid` 404 en `targets[]` (R12) sigue siendo runtime: saltar al siguiente, no fallar el gesto.

Sigue abierto (no se preguntó): **P10 / R8** toggle post-swipe puede apagar el room nuevo.

---

## 6. Orden del siguiente recorte (ya no es «decidir»)

Papel primero, luego runtime. El capitán parte a los impl; esto no es un plan de PRs.

1. **Papel:** decisiones 1–2, enmienda §8.1 (decisión 9), fósil `supabase/` (12), READMEs (P19). Para que el próximo agente no reabra ingest ni `c1`.
2. **No pisar el Bridge:** P4 — parser + no POST vacío. Consola + simple (+ Round si comparte el stream).
3. **Input fuera del HTTP:** decisión 8, los dos firmwares. Simple: Wi-Fi retry (P12) en el mismo recorte si cabe.
4. **Wire producto:** `rev` (3), `product` (5), grupo al Save (6), borrar fill dim (10), poll no pisa NVS sin `rev` (P11).
5. **Círculo menor:** R8 toggle post-swipe, P13 timeout 1–9, P14 caps, P15 ASCII.
6. **Fuera de este v1:** web-setup (decisión 11).

---

## 7. Mapa de IDs (impl → este doc)

| Aquí | De |
| --- | --- |
| P1 | C1, R5, S8 |
| P2 | R1–R4, R6 |
| P3 | C5 |
| P4 | C8, S2, S3 |
| P5 | C6, C23, S1 |
| P6 | C12 |
| P7 | C22 |
| P8 | S4, R11 |
| P9 | R7, R12 |
| P10 | R8 |
| P11 | C4, R9 |
| P12 | S5 |
| P13 | C7 |
| P14 | C18 |
| P15 | C13 |
| P16–P22 | C2, C11, C10, C9/S7/R4, C14/S6, S9, R10 |
