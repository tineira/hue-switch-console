/**
 * Corre en el PC, en la LAN del Bridge. Baja luces/rooms (Clip v2) y las
 * sube a POST /api/ingest. El certificado del Bridge es self-signed.
 *
 *   HUE_BRIDGE_IP=192.168.100.12 HUE_APP_KEY=... INGEST_TOKEN=... npm run push-from-bridge
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const bridgeIp = process.env.HUE_BRIDGE_IP;
const appKey = process.env.HUE_APP_KEY;
const token = process.env.INGEST_TOKEN;
const consoleUrl = (process.env.CONSOLE_URL || "http://localhost:3000").replace(
  /\/$/,
  "",
);

if (!bridgeIp || !appKey || !token) {
  console.error(
    "Need HUE_BRIDGE_IP, HUE_APP_KEY, INGEST_TOKEN (optional CONSOLE_URL)",
  );
  process.exit(1);
}

async function hueGet(resource) {
  const res = await fetch(`https://${bridgeIp}/clip/v2/resource/${resource}`, {
    headers: { "hue-application-key": appKey },
  });
  if (!res.ok) {
    throw new Error(`Hue GET ${resource} ${res.status} ${await res.text()}`);
  }
  return res.json();
}

function capsFor(light) {
  const caps = [];
  if (light.dimming) caps.push("dim");
  if (light.color) caps.push("color");
  else if (light.color_temperature) caps.push("ct");
  return caps;
}

const [lightsJson, roomsJson, configJson] = await Promise.all([
  hueGet("light"),
  hueGet("room"),
  fetch(`https://${bridgeIp}/api/config`).then((r) => r.json()),
]);

const payload = {
  bridgeid: configJson.bridgeid,
  bridge_ip: bridgeIp,
  source: "push-from-bridge",
  lights: (lightsJson.data || []).map((light) => ({
    id: light.id,
    name: light.metadata?.name ?? light.id,
    on: light.on?.on,
    caps: capsFor(light),
  })),
  rooms: (roomsJson.data || []).map((room) => ({
    id: room.id,
    name: room.metadata?.name ?? room.id,
  })),
};

const ingest = await fetch(`${consoleUrl}/api/ingest`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
});

const body = await ingest.text();
if (!ingest.ok) {
  console.error(`ingest ${ingest.status} ${body}`);
  process.exit(1);
}
console.log(body);
