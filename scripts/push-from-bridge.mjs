/**
 * Runs on a PC on the Bridge LAN. Pulls Clip v2 lights/rooms/zones/scenes
 * and POSTs /api/device/register. The Bridge certificate is self-signed.
 *
 *   HUE_BRIDGE_IP=192.168.100.12 HUE_APP_KEY=... CONSOLE_TOKEN=... npm run push-from-bridge
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const bridgeIp = process.env.HUE_BRIDGE_IP;
const appKey = process.env.HUE_APP_KEY;
const token = process.env.CONSOLE_TOKEN;
const consoleUrl = (process.env.CONSOLE_URL || "http://localhost:3000").replace(
  /\/$/,
  "",
);

if (!bridgeIp || !appKey || !token) {
  console.error(
    "Need HUE_BRIDGE_IP, HUE_APP_KEY, CONSOLE_TOKEN (optional CONSOLE_URL)",
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

function groupedLightId(group) {
  const svc = (group.services || []).find((s) => s.rtype === "grouped_light");
  return svc?.rid ?? null;
}

function lightIdsForGroup(group, lights) {
  const ids = [];
  for (const child of group.children || []) {
    if (child.rtype === "light") ids.push(child.rid);
    else if (child.rtype === "device") {
      for (const light of lights) {
        if (light.owner?.rid === child.rid) ids.push(light.id);
      }
    }
  }
  return ids;
}

function mapGroup(group, rtype, lights) {
  return {
    id: group.id,
    name: group.metadata?.name ?? group.id,
    grouped_light_id: groupedLightId(group),
    light_ids: lightIdsForGroup(group, lights),
    rtype,
  };
}

const [lightsJson, roomsJson, zonesJson, scenesJson, configJson] =
  await Promise.all([
    hueGet("light"),
    hueGet("room"),
    hueGet("zone"),
    hueGet("scene"),
    fetch(`https://${bridgeIp}/api/config`).then((r) => r.json()),
  ]);

const lightsRaw = lightsJson.data || [];

const payload = {
  bridgeid: configJson.bridgeid,
  bridge_ip: bridgeIp,
  source: "push-from-bridge",
  lights: lightsRaw.map((light) => ({
    id: light.id,
    name: light.metadata?.name ?? light.id,
    on: light.on?.on,
    caps: capsFor(light),
  })),
  rooms: [
    ...(roomsJson.data || []).map((room) => mapGroup(room, "room", lightsRaw)),
    ...(zonesJson.data || []).map((zone) => mapGroup(zone, "zone", lightsRaw)),
  ],
  scenes: (scenesJson.data || []).map((scene) => ({
    id: scene.id,
    name: scene.metadata?.name ?? scene.id,
    group_rtype: scene.group?.rtype ?? "",
    group_rid: scene.group?.rid ?? "",
  })),
  channels: [],
};

const ingest = await fetch(`${consoleUrl}/api/device/register`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
});

const body = await ingest.text();
if (!ingest.ok) {
  console.error(`register ${ingest.status} ${body}`);
  process.exit(1);
}
console.log(body);
