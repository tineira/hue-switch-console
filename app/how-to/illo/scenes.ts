import * as THREE from "three";
import { DIAL_SIZE, buildAntenna, buildDisplay, buildHeaders, buildXiao, drawDial, monoFont } from "@/app/landing/round-model";
import {
  MECH,
  TACT_LEGS,
  at,
  breaker,
  bulb,
  carrierBoard,
  ceramicCap,
  enclosure,
  leverConnector,
  leverEntry,
  mechanism,
  mesh,
  projectBox,
  resistor,
  solder,
  tactButton,
  usbCable,
  wallBox,
  wire,
  type Tone,
} from "@/app/how-to/illo/parts";
import type { Anchor, Mark, Note, SceneDef, V3 } from "@/app/how-to/illo/render";
import type { IlloId } from "@/lib/how-to-build";

// One scene per illustration in the build guide (lib/how-to-build.ts names them). All in mm.
// XIAO-local: component side +y, USB-C at +z, D0–D6 pads on +x (D0 nearest USB-C), 5V, GND,
// 3V3 on -x (same pad map as app/landing/simple-render.ts).

export type { IlloId };

const T = 1.2; // XIAO board thickness
const PAD = (i: number): V3 => [7.62, T, 7.62 - i * 2.54]; // D0..D5
const GND: V3 = [-7.62, T, 5.08];
const V33: V3 = [-7.62, T, 2.54];
const BOOT: V3 = [-5.2, T + 0.5, 8.9];
const LED: V3 = [-5.3, T + 1.2, 4.8];
const JACK: V3 = [3.8, T + 1.3, -9.0];
const USB_MOUTH_Z = 11.0;

// Model roots come scaled to metres; the scene is in mm.
function part<O extends THREE.Object3D>(o: O): O {
  o.scale.setScalar(1);
  return o;
}

const xiao = () => part(buildXiao());

function group(...children: THREE.Object3D[]) {
  const g = new THREE.Group();
  if (children.length) g.add(...children);
  return g;
}

function dialTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = DIAL_SIZE;
  drawDial(c.getContext("2d")!, { page: 0, on: true, level: 64, scene: 0 }, monoFont());
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function display() {
  const { root, screen } = buildDisplay(new THREE.MeshBasicMaterial());
  screen.userData.texture = dialTexture();
  return part(root);
}

/** XIAO with its headers soldered (long pins down, soldered on the chip side), optionally with the antenna on. */
function xiaoWithHeaders(opts: { antenna?: boolean; hotSolder?: boolean } = {}) {
  const g = new THREE.Group();
  const x = xiao();
  g.add(x);
  const h = part(buildHeaders());
  h.rotation.x = Math.PI;
  h.position.y = 3;
  g.add(h);
  for (const side of [-1, 1])
    for (let i = 0; i < 7; i++) {
      const s = solder(side * 7.62, T, (i - 3) * 2.54);
      if (opts.hotSolder) s.userData.tone = "hot";
      g.add(s);
    }
  if (opts.antenna) g.add(tuckedAntenna());
  return { g, x };
}

/** The antenna folded flat over the chip side, as it ends up inside the Round. */
// Like the real flat antenna: amber film with a copper meander, the coax soldered at one end.
function tuckedAntenna() {
  const g = new THREE.Group();
  const top = T + 2.05, cx = -2.5, cz = -1.5, L = 16;
  g.add(at(mesh(new THREE.BoxGeometry(10, 0.25, L), "polyimide"), cx, top, cz));
  const ty = top + 0.14, z0 = cz - L / 2;
  for (let i = 0; i < 5; i++) g.add(at(mesh(new THREE.BoxGeometry(7.4, 0.04, 0.6), "brown"), cx, ty, z0 + 1.6 + i * 2.1));
  for (let i = 0; i < 4; i++) g.add(at(mesh(new THREE.BoxGeometry(0.6, 0.04, 2.1), "brown"), cx + (i % 2 ? -3.4 : 3.4), ty, z0 + 2.65 + i * 2.1));
  g.add(at(mesh(new THREE.SphereGeometry(0.7, 16, 8).scale(1, 0.5, 1.4), undefined, true), cx, ty + 0.1, z0 + 0.6));
  g.add(at(mesh(new THREE.CylinderGeometry(1, 1, 1.3, 32), undefined, true), JACK[0], JACK[1] + 0.65, JACK[2]));
  g.add(wire([[JACK[0], JACK[1] + 1.1, JACK[2]], [JACK[0] + 2.5, top + 0.6, JACK[2] - 1.5], [2, top + 0.6, -10.5], [-2.5, top + 0.3, -8.9]], "switched", 0.55));
  return g;
}

/** The antenna with its plug `lift` mm above the U.FL socket, cable and FPC toward +x. */
function antennaOnJack(lift: number) {
  const a = part(buildAntenna());
  a.rotation.y = -Math.PI / 2;
  a.position.set(JACK[0] + 32.5, JACK[1] - 0.1 + lift, JACK[2]);
  return a;
}

function usbAt(x: number, y: number, z: number, bend: V3[] = [[0, 0, 60]]) {
  return at(usbCable(bend), x, y, z);
}

const note = (text: string, o: THREE.Object3D | undefined, p: V3, side?: "left" | "right", tone?: Note["tone"]): Note => ({
  text,
  at: { o, p },
  side,
  tone,
});
const A = (o: THREE.Object3D | undefined, p: V3): Anchor => ({ o, p });

// ---------------------------------------------------------------------------------- Round

function roundKit(): SceneDef {
  const root = group();
  const d = at(display(), -36, 0, 0);
  const x = at(xiao(), 4, 0, -16);
  const h = part(buildHeaders());
  h.rotation.z = Math.PI / 2;
  h.position.set(30, 1.3, -14);
  const a = part(buildAntenna());
  a.rotation.y = Math.PI / 2;
  a.position.set(14, 0, 22);
  root.add(d, x, h, a);
  return {
    root,
    dir: [0.45, 1.7, 1.2],
    pad: 1.04,
    notes: [
      note("1 Round Display", d, [-17, 6.5, 8], "left"),
      note("2 XIAO ESP32-S3", x, [8.9, T, -5], "right"),
      note("3 Pin headers, loose or already soldered", h, [0, 11, 3], "right"),
      note("4 Antenna, in the XIAO's bag", a, [0, 0.3, -24], "right"),
    ],
  };
}

function roundHeaders(): SceneDef {
  const { g, x } = xiaoWithHeaders({ hotSolder: true });
  return {
    root: group(g),
    dir: [1.0, 0.7, -0.6],
    pad: 1.08,
    notes: [
      note("Solder all 14 pins on the chip side", x, [7.62, T + 0.8, 0], "right", "hot"),
      note("Plastic strip on the back", x, [7.62, -1.3, 2.54], "right"),
      note("Long pins point away from the chip", x, [7.62, -8.2, -7.62], "right"),
      note("USB-C", x, [0, T + 1.6, 10.5], "left"),
      note("Same on the other row", x, [-7.62, T + 0.8, -2.54], "left"),
    ],
  };
}

function roundAntenna(): SceneDef {
  const { g, x } = xiaoWithHeaders();
  const a = antennaOnJack(9);
  const root = group(g, a);
  return {
    root,
    dir: [0.35, 0.9, 1.3],
    fit: [x, a],
    pad: 1.05,
    notes: [
      note("U.FL socket", x, JACK, "left", "hot"),
      note("Antenna plug: straight down until it clicks", a, [0, 1.4, 32.5], "right"),
      note("Flat antenna, tucked under the XIAO later", a, [0, 0.3, -24], "right"),
    ],
    marks: [
      { kind: "arrow", from: A(x, [JACK[0], JACK[1] + 7.5, JACK[2]]), to: A(x, [JACK[0], JACK[1] + 1.2, JACK[2]]) },
      { kind: "dot", at: A(x, JACK) },
    ],
  };
}

// The Round seen from below: display on top, the XIAO under it, flipped (chip side down).
function roundFromBelow(gap: number, hotSwitch: boolean) {
  const d = display();
  const { g: xa, x } = xiaoWithHeaders({ antenna: true });
  xa.rotation.z = Math.PI;
  // Header body against the sockets when gap = 0; pins 8.5 above the board's back.
  xa.position.set(0, -2.5 - gap, 1.5);
  if (hotSwitch)
    d.traverse((o) => {
      if (o.name === "power_switch_lever" || o.name === "power_switch") o.userData.tone = "hot";
    });
  const root = group(d, xa);
  const def: SceneDef = { root, dir: [0.7, -1.4, 1.1], pad: 1.05 };
  return { def, d, x };
}

function roundBelow(): SceneDef {
  const { def, d, x } = roundFromBelow(14, false);
  return {
    ...def,
    notes: [
      note("Sockets on the back of the display", d, [7.62, 0, 8], "right"),
      note("Pins go into the sockets", x, [-7.62, -8.4, 5.08], "right"),
      note("USB-C faces out, to the edge", x, [0, T + 1.6, 11], "left", "hot"),
      note("Chip side faces away from the display", x, [5.5, T + 0.3, -6], "left"),
      note("Antenna, folded flat over the chip side", x, [-2.5, T + 2.3, -3], "right", "hot"),
    ],
  };
}

function roundSwitch(): SceneDef {
  const { def, d, x } = roundFromBelow(0, true);
  return {
    ...def,
    notes: [
      note("Slide the power switch to ON", d, [-14.6, 3.4, -11], "left", "hot"),
      note("XIAO pressed home, no gap", x, [8.9, 0, 0], "right"),
      note("USB-C at the edge", x, [0, T + 1.6, 11], "right"),
      note("Antenna folded flat over the chip side", x, [-2.5, T + 2.3, -3], "right"),
    ],
  };
}

function roundDone(): SceneDef {
  const d = display();
  const { g: xa } = xiaoWithHeaders();
  xa.rotation.z = Math.PI;
  xa.position.set(0, -2.5, 1.5);
  // USB-C cable in the port: the port mouth is at XIAO z ≈ 11, y = T + 1.58 (flipped: down).
  const cable = usbAt(0, -2.5 - (T + 1.58), 1.5 + USB_MOUTH_Z - 6.6, [[0, -6, 44], [0, -18, 70]]);
  return {
    root: group(d, xa, cable),
    dir: [0.5, 1.5, 1.35],
    fit: [d, cable],
    pad: 1.03,
    notes: [
      note("Screen on top", d, [-12, 6.5, -8], "left"),
      note("USB-C to a phone charger", cable, [0, 0, 30], "right"),
    ],
  };
}

// ---------------------------------------------------------------------------------- Simple

// Seen from the USB-C end's opposite side, from above: USB-C at the top, D0–D5 down the left,
// like the board picture on Switches.
const TOP: V3 = [0.12, 1.5, -0.8];

function simpleKitTry(): SceneDef {
  const x = xiao();
  const c = usbAt(0, T + 1.58, 24, [[0, 0, 50], [10, 0, 66]]);
  return {
    root: group(x, c),
    dir: TOP,
    pad: 1.04,
    notes: [note("XIAO ESP32-C6", x, [8.9, T, -4], "left"), note("USB-C cable that carries data", c, [0, 3, 14], "right")],
    marks: [{ kind: "arrow", from: A(c, [0, 0, -1]), to: A(x, [0, T + 1.58, USB_MOUTH_Z + 1]) }],
  };
}

function simplePlugged(extra: { led?: boolean; boot?: boolean }): SceneDef {
  const x = xiao();
  const c = usbAt(0, T + 1.58, USB_MOUTH_Z - 6.6, [[0, 0, 44], [10, 0, 60]]);
  const root = group(x, c);
  const notes: Note[] = [];
  const marks: Mark[] = [];
  const fit: THREE.Object3D[] = extra.boot ? [x] : [x, c];
  if (!extra.led && !extra.boot) {
    notes.push(note("USB-C to your computer", c, [0, 3, 16], "right"));
    notes.push(note("XIAO ESP32-C6", x, [8.9, T, -4], "left"));
  }
  if (extra.led) {
    marks.push({ kind: "glow", at: A(x, LED), r: 18 });
    notes.push(note("Orange LED: shows what the board needs next", x, LED, "right", "hot"));
    notes.push(note("Setup runs in Chrome over this cable", c, [0, 3, 16], "left"));
  }
  if (extra.boot) {
    const b = at(bulb(true), -46, -18, -4);
    b.scale.setScalar(0.5);
    root.add(b);
    fit.push(b);
    marks.push({ kind: "press", at: A(x, BOOT) });
    marks.push({ kind: "glow", at: A(b, [0, 34, 0]), r: 40 });
    notes.push(note("BOOT", x, BOOT, "left", "hot"));
    notes.push(note("The room's lights toggle", b, [-14, 38, 0], "right"));
  }
  return { root, dir: TOP, fit, pad: extra.boot ? 1.15 : 1.08, notes, marks };
}

function simpleKitBox(): SceneDef {
  const x = at(xiao(), 26, 0, 4);
  const b1 = at(tactButton(), -6, 3.5, 12);
  const b2 = at(tactButton(), -24, 3.5, 12);
  const r10 = at(resistor("10k"), -8, 1.2, -12);
  const r1 = at(resistor("1k"), -8, 1.2, -20);
  const cap = at(ceramicCap(6), -28, 6.5, -16);
  const wires = group(
    wire([[34, 0.6, -24], [14, 0.6, -28], [-4, 0.6, -32], [-30, 0.6, -30]], "hot", 0.6),
    wire([[34, 0.6, -30], [12, 0.6, -34], [-6, 0.6, -38], [-32, 0.6, -36]], "switched", 0.6),
  );
  return {
    root: group(x, b1, b2, r10, r1, cap, wires),
    dir: TOP,
    pad: 1.04,
    notes: [
      note("1 XIAO ESP32-C6", x, [8.9, T, 0], "left"),
      note("2 Switches or push buttons", b2, [0, 7, 0], "right"),
      note("3 Hook-up wire", wires, [34, 0.6, -27], "left"),
      note("4 For long wires: 10 kΩ and 1 kΩ", r10, [3, 0, 0], "left"),
      note("5 and 10 nF, one of each per input", cap, [0, 4, 0], "right"),
    ],
  };
}

// Leads from D0 and GND out toward the viewer, to wherever they end.
function leadD0(end: V3): THREE.Mesh {
  const [px, , pz] = PAD(0);
  return wire([[px, T + 0.4, pz], [px + 3, T + 1.5, pz], [px + 9, T, pz - 5], [end[0] + 2, end[1] + 3, end[2] + 12], end], "hot");
}
function leadGnd(end: V3): THREE.Mesh {
  const [gx, , gz] = GND;
  return wire([[gx, T + 0.4, gz], [gx - 3, T + 1.5, gz], [gx - 9, T, gz - 5], [end[0] - 2, end[1] + 3, end[2] + 12], end], "switched");
}
function hotSolder(p: V3) {
  const s = solder(...p);
  s.userData.tone = "hot";
  return s;
}

function simpleWires(): SceneDef {
  const x = xiao();
  const root = group(x, leadD0([16, 0, -30]), leadGnd([-16, 0, -30]), hotSolder(PAD(0)), hotSolder(GND));
  return {
    root,
    dir: TOP,
    pad: 1.06,
    notes: [
      note("D0: top pad on the left", x, PAD(0), "left", "hot"),
      note("GND: second pad on the right", x, GND, "right", "hot"),
      note("USB-C at the top", x, [0, T + 3, 11], "right"),
      note("To the switch", root, [16, 0, -30], "left"),
    ],
  };
}

function oneButton(pressed: boolean, lamp: boolean): SceneDef {
  const x = xiao();
  const Z = -40;
  const btn = at(tactButton(pressed), 0, 3.4, Z);
  const la: V3 = [TACT_LEGS.a[0], 3.4 + TACT_LEGS.a[1], Z + TACT_LEGS.a[2]];
  const lb: V3 = [TACT_LEGS.b[0], 3.4 + TACT_LEGS.b[1], Z + TACT_LEGS.b[2]];
  const root = group(x, btn, leadD0(lb), leadGnd(la), solder(...PAD(0)), solder(...GND));
  const notes: Note[] = [];
  const marks: Mark[] = [];
  const fit: THREE.Object3D[] = [x, btn];
  if (!lamp) {
    notes.push(note("One wire to each terminal, either way round", btn, [0, 4, -6], "right"));
  } else {
    const b = at(bulb(true), -44, -16, -18);
    b.scale.setScalar(0.5);
    root.add(b);
    fit.push(b);
    marks.push({ kind: "press", at: A(btn, [0, 5, 0]) });
    marks.push({ kind: "glow", at: A(b, [0, 34, 0]), r: 38 });
    notes.push(note("The lights react", b, [-14, 38, 0], "right"));
  }
  notes.push(note("D0", x, PAD(0), "left", "hot"));
  notes.push(note("GND", x, GND, "right"));
  return { root, dir: TOP, fit, pad: 1.08, notes, marks };
}

function simpleAll(): SceneDef {
  const x = xiao();
  const root = group(x);
  const Z = -46;
  const notes: Note[] = [];
  const bxs = [0, 1, 2, 3, 4, 5].map((i) => 45 - 18 * i);
  bxs.forEach((bx, i) => {
    const btn = at(tactButton(), bx, 3.4, Z);
    root.add(btn);
    const [px, , pz] = PAD(i);
    const lb: V3 = [bx + TACT_LEGS.b[0], 0.5, Z + TACT_LEGS.b[2]];
    root.add(wire([[px, T + 0.4, pz], [px + 3 + i * 1.6, T + 1.4, pz], [12 + i * 2, 0.6, pz - 5], [lb[0], 0.6, Z + 20 - i * 1.5], lb], "hot", 0.5));
    root.add(solder(px, T, pz, 0.8));
    // Spur from the other leg down to the common GND wire.
    const la: V3 = [bx + TACT_LEGS.a[0], 0.5, Z + TACT_LEGS.a[2]];
    root.add(wire([la, [la[0], 0.5, Z - 13]], "switched", 0.5));
    notes.push(note(`D${i}`, btn, [0, 7.3, 0], i < 3 ? "left" : "right", "hot"));
  });
  const busL = bxs[0] + TACT_LEGS.a[0];
  root.add(
    wire([[GND[0], T + 0.4, GND[2]], [GND[0] - 5, T + 1.2, GND[2]], [-62, 0.6, 2], [-62, 0.6, Z - 13], [busL, 0.6, Z - 13]], "switched", 0.55),
  );
  root.add(solder(...GND, 0.8));
  notes.push(note("GND: one wire joins every switch's other terminal", x, GND, "right"));
  return { root, dir: TOP, pad: 1.03, notes };
}

function simpleRc(): SceneDef {
  const x = xiao();
  const root = group(x);
  const [px, , pz] = PAD(0);
  const r1 = at(resistor("1k", 14), px + 12, T + 1.2, pz);
  const r10 = at(resistor("10k", 10), 0, T + 4, 15.5);
  const cap = at(ceramicCap(4), px + 25.25, 4.5, pz - 4);
  root.add(r1, r10, cap);
  // 10 kΩ: D0 up over the USB end to 3V3.
  root.add(wire([[px, T + 0.3, pz], [px, T + 3, pz + 3], [5, T + 4, 15.5]], "gold", 0.3));
  root.add(wire([[-5, T + 4, 15.5], [V33[0] - 1.5, T + 3, 10], [V33[0] - 1.5, T + 2, 4], [V33[0], T + 0.3, V33[2]]], "gold", 0.3));
  // Node after the 1 kΩ: the capacitor's first leg, then the wire to the switch.
  const node: V3 = [px + 24, T + 1.2, pz];
  root.add(wire([[px + 19, T + 1.2, pz], node, [px + 34, 0.8, pz - 4], [px + 40, 0.6, pz - 24]], "hot", 0.6));
  root.add(wire([[px + 24, 0.5, pz - 4], node], "gold", 0.28));
  // GND: from its pad, round the bottom of the board, to the capacitor's second leg and on.
  root.add(
    wire(
      [[GND[0], T + 0.4, GND[2]], [GND[0] - 4, T + 1, GND[2] - 2], [-14, 0.6, -14], [8, 0.6, -18], [px + 26.5, 0.6, pz - 12], [px + 26.5, 0.5, pz - 4], [px + 30, 0.6, pz - 16], [px + 34, 0.6, pz - 28]],
      "switched",
      0.6,
    ),
  );
  root.add(hotSolder(PAD(0)), solder(...V33), solder(...GND));
  return {
    root,
    dir: TOP,
    pad: 1.04,
    notes: [
      note("10 kΩ: D0 to 3V3", r10, [0, 1.2, 0], "right", "hot"),
      note("1 kΩ between D0 and the wire", r1, [0, 1.2, 0], "left", "hot"),
      note("10 nF: wire side of the 1 kΩ to GND", cap, [0, 5, 0], "left", "hot"),
      note("To the switch", root, [px + 40, 0.6, pz - 24], "left"),
      note("3V3", x, V33, "right"),
      note("GND", x, GND, "right"),
    ],
  };
}

function simpleBox(): SceneDef {
  const bx = projectBox(44, 34, 20);
  const x = at(xiao(), 4, 3, 0);
  x.rotation.y = -Math.PI / 2; // USB-C toward -x, the box's left wall
  const cable = usbCable([[0, 0, 40], [0, -10, 60]]);
  cable.rotation.y = -Math.PI / 2;
  cable.position.set(4 - USB_MOUTH_Z + 6.6, 3 + T + 1.58, 0);
  const lid = at(mesh(new THREE.BoxGeometry(48, 2, 38)), 0, 44, 0);
  const b = [-12, 0, 12].map((lx) => at(tactButton(), lx, 45, 0));
  const leads = [-12, 0, 12].map((lx, i) =>
    wire([[lx + 6.25, 41.6, 2.5], [lx + 4, 32, 8 - i * 3], [10, 12, 6 - i * 2.2], [4 - 7.62 + i * 2.54, 3 + T + 0.4, -7.62]], "hot", 0.45),
  );
  const gnd = wire([[-12 - 6.25, 41.6, 2.5], [-22, 28, 10], [-6, 12, 8], [4 - 5.08, 3 + T + 0.4, 7.62]], "switched", 0.45);
  return {
    root: group(bx, x, cable, lid, ...b, ...leads, gnd),
    dir: [0.8, 1.2, 1.5],
    pad: 1.04,
    notes: [
      note("Lid with the buttons", lid, [-24, 1, 10], "left"),
      note("USB-C out through a hole in the wall", cable, [0, 3, 16], "left", "hot"),
      note("XIAO inside, on double-sided tape", x, [0, T + 2, 0], "right"),
      note("Any project box", bx, [22, 12, 17], "right"),
    ],
  };
}

// ---------------------------------------------------------------------------------- In the wall

function boardWithXiao() {
  const x = xiao();
  const b = carrierBoard(x);
  return { ...b, x };
}

function wallBoard(): SceneDef {
  const { root: b, x } = boardWithXiao();
  const { base, lid } = enclosure();
  base.position.y = -44;
  lid.position.y = 16;
  const root = group(b, base, lid);
  return {
    root,
    dir: [0.8, 1.1, 1.3],
    pad: 1.04,
    notes: [
      note("Lid: window over BOOT and the LED", lid, [-18, 9.6, -3], "left"),
      note("XIAO soldered flat, USB-C over the edge", x, [0, T + 1.9, -2], "left", "hot"),
      note("Power module under the board", b, [-9.5, -12, 17], "left"),
      note("Terminals: L N, and D0–D5 GND", b, [19.9, -4, -3], "right"),
      note("Base with wire holes. Together 46 × 56 × 26 mm", base, [23, 8, 6], "right"),
    ],
  };
}

function wallUsb(): SceneDef {
  const { root: b, pts } = boardWithXiao();
  const cable = usbCable([[0, 0, 36], [-12, 0, 50]]);
  cable.rotation.y = -Math.PI / 2;
  cable.position.set(-21 - 6.6 + 4.1, T + 1.6 + 1.58, 2.8);
  const root = group(b, cable);
  return {
    root,
    dir: [0.6, 1.6, 1.2],
    fit: [b, cable],
    pad: 1.03,
    notes: [
      note("USB-C: install, Wi-Fi, pairing, inputs", cable, [0, 3, 14], "right", "hot"),
      note("Nothing on the mains terminal", b, pts.L, "right", "danger"),
    ],
    marks: [{ kind: "cross", at: A(b, [pts.L[0] + 3, pts.L[1], (pts.L[2] + pts.N[2]) / 2]) }],
  };
}

function wallBreaker(): SceneDef {
  const root = group();
  const rail = at(mesh(new THREE.BoxGeometry(110, 8, 4)), 0, 0, -46);
  root.add(rail);
  const bs = [-36, -18, 0, 18, 36].map((x, i) => at(breaker(i !== 2), x, 0, 0));
  root.add(...bs);
  return {
    root,
    dir: [0.35, 0.35, 1.3],
    pad: 1.1,
    notes: [
      note("This circuit's breaker: OFF", bs[2], [0, -7, 24], "right", "danger"),
      note("Then check the box with a voltage tester", bs[0], [0, 30, 10], "left"),
    ],
  };
}

type WallOpts = {
  /** Old wiring: live through the switch to the lamp. */
  before?: boolean;
  /** Lamp's switched live joined to the permanent live. */
  lampJoined?: boolean;
  board?: boolean;
  switchWires?: boolean;
  mains?: boolean;
  inEnclosure?: boolean;
  /** Switch mounted in the box instead of pulled out in front. */
  mounted?: boolean;
  lit?: boolean;
};

// Relative position of `p` (local to `o`, a direct child of the scene root) in scene mm.
function inScene(o: THREE.Object3D, p: V3): V3 {
  o.updateMatrix();
  const v = new THREE.Vector3(...p).applyMatrix4(o.matrix);
  return [v.x, v.y, v.z];
}

// A cutaway wall box (right side open) seen from the front right. The switch is pulled out to
// the front left, turned round so its terminals show.
function wallScene(o: WallOpts) {
  const root = group();
  root.add(wallBox());
  const mech = mechanism();
  if (o.mounted) mech.position.set(0, 0, 0);
  else {
    mech.position.set(-54, -14, 38);
    mech.rotation.y = -2.5;
  }
  root.add(mech);
  const lampBulb = at(bulb(Boolean(o.lit)), 72, 44, -28);
  lampBulb.scale.setScalar(0.85);
  root.add(lampBulb);

  const w = (pts: V3[], tone: Tone, r = 0.9) => root.add(wire(pts, tone, r));
  // Sheathed cables in through the top: supply on the left, lamp on the right.
  const sup: V3 = [-18, 30, -34], lamp: V3 = [18, 30, -34];
  root.add(wire([[-18, 70, -34], [-18, 33, -34]], "switched", 3));
  root.add(wire([[18, 33, -34], [18, 58, -34], [44, 70, -30], [72, 66, -28], [72, 48, -28]], "switched", 3));

  const L = inScene(mech, MECH.l), SL = inScene(mech, MECH.sl);
  const nN = o.mains ? 3 : 2;
  const nConn = at(leverConnector(nN), -10, -24, -14);
  const eConn = at(leverConnector(2), 14, -24, -14);
  root.add(nConn, eConn);
  const entry = (c: THREE.Object3D, n: number, i: number) => inScene(c, leverEntry(n, i));
  w([[sup[0] - 2.5, sup[1], sup[2]], [-26, 8, -30], [-26, -18, -20], entry(nConn, nN, 0)], "neutral");
  w([[lamp[0] - 2.5, lamp[1], lamp[2]], [6, 10, -36], [-24, -12, -26], entry(nConn, nN, 1)], "neutral");
  w([[sup[0] + 2.5, sup[1], sup[2]], [-6, 12, -36], [0, -16, -24], entry(eConn, 2, 0)], "earth");
  w([[lamp[0] + 2.5, lamp[1], lamp[2]], [24, 8, -34], [4, -14, -22], entry(eConn, 2, 1)], "earth");

  let lConn: THREE.Object3D | null = null;
  if (o.before) {
    w([sup, [-20, 18, -16], [-34, 6, 8], L], "live");
    w([lamp, [16, 16, -14], [-20, 2, 14], SL], "switched");
  } else if (o.lampJoined) {
    const n = o.mains ? 3 : 2;
    lConn = at(leverConnector(n), -10, 14, -16);
    root.add(lConn);
    w([sup, [-22, 22, -22], entry(lConn, n, 0)], "live");
    w([lamp, [8, 24, -30], [-26, 18, -18], entry(lConn, n, 1)], "switched");
  }

  let board: ReturnType<typeof boardWithXiao> | null = null;
  if (o.board) {
    board = boardWithXiao();
    board.root.rotation.x = Math.PI / 2;
    board.root.position.set(4, 2, -30);
    root.add(board.root);
    if (o.inEnclosure) {
      const { base, lid } = enclosure();
      base.position.y = -17.2;
      const enc = group(base, lid);
      enc.rotation.x = Math.PI / 2;
      enc.position.set(4, 2, -30);
      root.add(enc);
    }
  }
  const bw = (p: V3): V3 => inScene(board!.root, p);
  if (board && o.switchWires) {
    const d0 = bw(board.pts.D0), gnd = bw(board.pts.GND);
    w([L, [L[0] + 10, L[1] + 8, L[2] - 6], [30, 10, -8], [d0[0] + 8, d0[1], d0[2] + 2], d0], "signal", 0.8);
    w([SL, [SL[0] + 10, SL[1] - 10, SL[2] - 4], [16, -34, -10], [gnd[0], gnd[1] - 8, gnd[2] + 2], gnd], "signal", 0.8);
  }
  if (board && o.mains && lConn) {
    const bl = bw(board.pts.L), bn = bw(board.pts.N);
    w([entry(lConn, 3, 2), [4, 26, -10], [bl[0] + 8, bl[1] + 6, bl[2] + 4], bl], "live");
    w([entry(nConn, 3, 2), [24, -16, -8], [bn[0] + 8, bn[1] - 2, bn[2] + 4], bn], "neutral");
  }
  return { root, mech, lampBulb, nConn, eConn, lConn, board, bw, L, SL };
}

const WALL_DIR: V3 = [0.85, 0.55, 1.0];

function wallBefore(labels: boolean): SceneDef {
  const s = wallScene({ before: true });
  const notes: Note[] = labels
    ? [
        note("Permanent live (L), from the supply", s.root, [-30, 8, 0], "left"),
        note("Switched live, to the lamp", s.root, [-10, 6, 6], "left"),
        note("Neutrals (N), joined", s.nConn, [0, 8, 0], "right"),
        note("Earths, joined", s.eConn, [0, 8, 0], "right"),
        note("The wall switch, pulled out", s.mech, [0, -22, -10], "left"),
      ]
    : [
        note("Live runs through the switch to the lamp", s.mech, [0, -22, -10], "left"),
        note("The lamp is off when the switch is", s.lampBulb, [14, 36, 0], "right"),
      ];
  return { root: s.root, dir: WALL_DIR, pad: 1.03, notes };
}

function wallLamp(): SceneDef {
  const s = wallScene({ lampJoined: true });
  return {
    root: s.root,
    dir: WALL_DIR,
    pad: 1.03,
    notes: [
      note("Lamp's live joined to the permanent live", s.lConn!, [0, 10, 0], "right", "hot"),
      note("The lamp stays powered", s.lampBulb, [14, 36, 0], "right"),
      note("Nothing on the switch now", s.mech, [0, 14, -24], "left"),
    ],
    marks: [
      { kind: "cross", at: A(s.mech, MECH.l) },
      { kind: "cross", at: A(s.mech, MECH.sl) },
    ],
  };
}

function wallOffMains(): SceneDef {
  const s = wallScene({ lampJoined: true, board: true });
  return {
    root: s.root,
    dir: WALL_DIR,
    pad: 1.03,
    notes: [
      note("Switch wires: off mains at both ends", s.mech, [0, 14, -24], "left", "danger"),
      note("The board goes at the back of the box", s.board!.root, [-18, 2, 0], "right"),
    ],
    marks: [{ kind: "badge", at: A(s.mech, [0, 28, -24]), text: "No L, no N", tone: "danger" }],
  };
}

function wallSwitches(): SceneDef {
  const s = wallScene({ lampJoined: true, board: true, switchWires: true });
  return {
    root: s.root,
    dir: WALL_DIR,
    pad: 1.03,
    notes: [
      note("One switch terminal to D0", s.root, s.bw(s.board!.pts.D0), "right"),
      note("The other to GND", s.root, s.bw(s.board!.pts.GND), "right"),
      note("Violet: 3.3 V switch wires only", s.mech, [0, 14, -24], "left"),
    ],
  };
}

function wallMains(check: boolean): SceneDef {
  const s = wallScene({ lampJoined: true, board: true, switchWires: true, mains: true });
  const notes: Note[] = check
    ? [
        note("No switch wire touches L or N", s.mech, [0, 14, -24], "left", "ok"),
        note("Mains only on the L N terminal", s.root, s.bw(s.board!.pts.L), "right"),
      ]
    : [
        note("Permanent live to L", s.root, s.bw(s.board!.pts.L), "right", "hot"),
        note("Neutral to N", s.root, s.bw(s.board!.pts.N), "right", "hot"),
        note("Earth stays with the box's earth wires", s.eConn, [0, 8, 0], "left"),
      ];
  const marks: Mark[] = check ? [{ kind: "badge", at: A(s.mech, [0, 30, -24]), text: "Checked", tone: "ok" }] : [];
  return { root: s.root, dir: WALL_DIR, pad: 1.03, notes, marks };
}

function wallFit(on: boolean): SceneDef {
  const s = wallScene({ lampJoined: true, board: true, switchWires: true, mains: true, inEnclosure: true, mounted: on, lit: on });
  const notes: Note[] = on
    ? [
        note("Switch back in the box, plate on", s.mech, [30, 30, 3], "left"),
        note("Breaker on: press the switch, the lamp reacts", s.lampBulb, [14, 36, 0], "right", "ok"),
      ]
    : [
        note("Enclosure at the back of the box", s.root, [-18, 2, -16], "right", "hot"),
        note("Switch goes back in front of it", s.mech, [0, -22, -10], "left"),
      ];
  const marks: Mark[] = on ? [{ kind: "glow", at: A(s.lampBulb, [0, 34, 0]), r: 40 }] : [];
  return { root: s.root, dir: WALL_DIR, pad: 1.03, notes, marks };
}

export function buildScene(id: IlloId): SceneDef {
  switch (id) {
    case "round-kit":
      return roundKit();
    case "round-headers":
      return roundHeaders();
    case "round-antenna":
      return roundAntenna();
    case "round-below":
      return roundBelow();
    case "round-switch":
      return roundSwitch();
    case "round-done":
      return roundDone();
    case "simple-kit-try":
      return simpleKitTry();
    case "simple-plug":
      return simplePlugged({});
    case "simple-led":
      return simplePlugged({ led: true });
    case "simple-boot":
      return simplePlugged({ boot: true });
    case "simple-kit-box":
      return simpleKitBox();
    case "simple-wires":
      return simpleWires();
    case "simple-switch":
      return oneButton(false, false);
    case "simple-test":
      return oneButton(true, true);
    case "simple-all":
      return simpleAll();
    case "simple-rc":
      return simpleRc();
    case "simple-box":
      return simpleBox();
    case "wall-board":
      return wallBoard();
    case "wall-usb":
      return wallUsb();
    case "wall-breaker":
      return wallBreaker();
    case "wall-before":
      return wallBefore(false);
    case "wall-identify":
      return wallBefore(true);
    case "wall-lamp":
      return wallLamp();
    case "wall-offmains":
      return wallOffMains();
    case "wall-switches":
      return wallSwitches();
    case "wall-mains":
      return wallMains(false);
    case "wall-check":
      return wallMains(true);
    case "wall-fit":
      return wallFit(false);
    case "wall-on":
      return wallFit(true);
  }
}
