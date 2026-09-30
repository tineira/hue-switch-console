import * as THREE from "three";
import { DIAL_SIZE, HDR_Z, buildAntenna, buildDisplay, buildHeaders, buildXiao, drawDial, monoFont } from "@/app/landing/round-model";
import {
  BUTTON_LUGS,
  MECH,
  WALL_D,
  at,
  box,
  breaker,
  bulb,
  carrierBoard,
  ceramicCap,
  enclosure,
  joint,
  leverConnector,
  leverEntry,
  mechOut,
  mechanism,
  mesh,
  panelButton,
  plate,
  resistor,
  solder,
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
const USB_MOUTH_Z = 11.7;

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

// Screen off (no power yet) unless `on`; DIP switches as shipped (OFF) unless `dipOn`.
function display({ on = false, dipOn = false, dialTurn = 0 }: { on?: boolean; dipOn?: boolean; dialTurn?: number } = {}) {
  const { root, screen } = buildDisplay(new THREE.MeshBasicMaterial(), { dipOn });
  if (on) {
    const t = dialTexture();
    t.center.set(0.5, 0.5);
    t.rotation = dialTurn;
    screen.userData.texture = t;
  } else screen.userData.tone = "black";
  return part(root);
}

const DIP_Z = HDR_Z - 12.1;

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
  if (opts.antenna) g.add(sideAntenna());
  return { g, x };
}

/** The antenna plugged in and lying to one side, clear of the XIAO and the display. */
// Like the real flat antenna: amber film with a copper meander, the coax soldered at one end.
const ANT_AT: V3 = [-8, T + 2.05, -40];
function sideAntenna() {
  const g = new THREE.Group();
  const top = ANT_AT[1], cx = ANT_AT[0], cz = ANT_AT[2], L = 16;
  g.add(at(mesh(new THREE.BoxGeometry(10, 0.25, L), "polyimide"), cx, top, cz));
  const ty = top + 0.14, z0 = cz - L / 2;
  for (let i = 0; i < 5; i++) g.add(at(mesh(new THREE.BoxGeometry(7.4, 0.04, 0.6), "brown"), cx, ty, z0 + 1.6 + i * 2.1));
  for (let i = 0; i < 4; i++) g.add(at(mesh(new THREE.BoxGeometry(0.6, 0.04, 2.1), "brown"), cx + (i % 2 ? -3.4 : 3.4), ty, z0 + 2.65 + i * 2.1));
  const feed = cz + L / 2 - 0.6; // the coax is soldered at the end nearest the XIAO
  g.add(at(mesh(new THREE.SphereGeometry(0.7, 16, 8).scale(1, 0.5, 1.4), undefined, true), cx, ty + 0.1, feed));
  g.add(at(mesh(new THREE.CylinderGeometry(1, 1, 1.3, 32), undefined, true), JACK[0], JACK[1] + 0.65, JACK[2]));
  g.add(wire([[JACK[0], JACK[1] + 1.1, JACK[2]], [JACK[0] - 6, top + 0.8, JACK[2] - 1.5], [cx + 1.5, top + 0.5, feed + 4], [cx, top + 0.3, feed]], "switched", 0.55));
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
      note("Flat antenna: leave it to one side", a, [0, 0.3, -24], "right"),
    ],
    marks: [
      { kind: "arrow", from: A(x, [JACK[0], JACK[1] + 7.5, JACK[2]]), to: A(x, [JACK[0], JACK[1] + 1.2, JACK[2]]) },
      { kind: "dot", at: A(x, JACK) },
    ],
  };
}

function roundDip(): SceneDef {
  const d = display({ dipOn: true });
  d.traverse((o) => {
    if (o.name.startsWith("dip_slider")) o.userData.tone = "hot";
  });
  const Y = 4.3; // the display's PCB underside
  // Close on the switch block and the sockets it sits past.
  const fit = ["dip_switch", "header_L", "header_R", "microsd_slot"].map((n) => d.getObjectByName(n)!);
  return {
    root: group(d),
    dir: [0.45, -1.5, 0.9],
    fit,
    pad: 1.02,
    notes: [
      note("DIP switches 1 and 2: slide both to ON", d, [1.35, Y - 1.8, DIP_Z - 1.3], "right", "hot"),
      note("They ship OFF", d, [-1.35, Y - 1.8, DIP_Z + 1.3], "right"),
      note("The XIAO's sockets: once it's on it covers the switches", d, [7.62, 0, 4], "right"),
    ],
    marks: [
      { kind: "arrow", from: A(d, [-2.6, Y - 1.9, DIP_Z - 1.3]), to: A(d, [2.4, Y - 1.9, DIP_Z - 1.3]) },
      { kind: "arrow", from: A(d, [-2.6, Y - 1.9, DIP_Z + 1.3]), to: A(d, [2.4, Y - 1.9, DIP_Z + 1.3]) },
    ],
  };
}

// The Round seen from below: display on top, the XIAO under it, flipped (chip side down).
function roundFromBelow(gap: number, hotSwitch: boolean) {
  const d = display({ dipOn: true });
  const { g: xa, x } = xiaoWithHeaders({ antenna: true });
  xa.rotation.z = Math.PI;
  // Header body against the sockets when gap = 0; pins 8.5 above the board's back.
  xa.position.set(0, -2.5 - gap, HDR_Z);
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
      note("Chip side faces away from the display", x, [-2.5, T + 1.9, -2.4], "left"),
      note("Antenna on its cable, to one side", x, ANT_AT, "right"),
    ],
  };
}

function roundSwitch(): SceneDef {
  const { def, d, x } = roundFromBelow(0, true);
  return {
    ...def,
    notes: [
      note("Slide the power switch to ON, along the edge", d, [-11.5, 3.4, -15.0], "left", "hot"),
      note("XIAO pressed home, no gap", x, [8.9, 0, 0], "right"),
      note("USB-C at the edge", x, [0, T + 1.6, 11], "right"),
      note("Antenna to one side", x, ANT_AT, "right"),
    ],
  };
}

// Turn the finished Round so USB-C leaves to the right of the upright screen.
const DONE_TURN = 2.2;

function roundDone(): SceneDef {
  // The dial texture turned back so its text reads level from this camera.
  const d = display({ on: true, dipOn: true, dialTurn: -1.74 });
  const { g: xa } = xiaoWithHeaders();
  xa.rotation.z = Math.PI;
  xa.position.set(0, -2.5, HDR_Z);
  // USB-C cable in the port: the port mouth is at XIAO z ≈ 11, y = T + 1.58 (flipped: down).
  const cable = usbAt(0, -2.5 - (T + 1.58), HDR_Z + USB_MOUTH_Z - 6.6, [[0, -1.5, 34], [0, -3.5, 46]]);
  const turned = group(d, xa, cable);
  turned.rotation.y = DONE_TURN;
  return {
    root: group(turned),
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
  const c = usbAt(0, T + 1.58, 24, [[0, 0, 40], [6, 0, 52]]);
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
  const c = usbAt(0, T + 1.58, USB_MOUTH_Z - 6.6, extra.boot ? [[0, 0, 30], [4, 0, 38]] : [[0, 0, 34], [6, 0, 46]]);
  const root = group(x, c);
  const notes: Note[] = [];
  const marks: Mark[] = [];
  const fit: THREE.Object3D[] = [x, c];
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
    const b = at(bulb(true), -46, -18, -18);
    b.scale.setScalar(0.5);
    root.add(b);
    fit.push(b);
    marks.push({ kind: "press", at: A(x, BOOT) });
    marks.push({ kind: "glow", at: A(b, [0, 34, 0]), r: 40 });
    notes.push(note("BOOT", x, BOOT, "right", "hot"));
    notes.push(note("The room's lights toggle", b, [-14, 38, 0], "right"));
  }
  return { root, dir: TOP, fit, pad: extra.boot ? 1.12 : 1.08, notes, marks };
}

// A panel push button lying on the desk, cap toward +z (the XIAO), lugs toward -z.
// Local → scene: (x, y, z) → (bx + x, AXIS_Y - z, bz + y).
const AXIS_Y = 8;
function lyingButton(bx: number, bz: number, pressed = false) {
  const g = panelButton(pressed);
  g.rotation.x = Math.PI / 2;
  g.position.set(bx, AXIS_Y, bz);
  const lug = (l: V3): V3 => [bx + l[0], AXIS_Y + 0.5, bz + l[1]];
  return { g, a: lug(BUTTON_LUGS.a), b: lug(BUTTON_LUGS.b), cap: [bx, AXIS_Y, bz + (pressed ? 3.1 : 5.5)] as V3 };
}

// A wire from a pad of the XIAO (flat on the desk) out past the board edge, then along `via`.
function fromPad(p: V3, side: 1 | -1, via: V3[], tone: Tone, r = 0.6): THREE.Mesh {
  return wire([[p[0], T + 0.4, p[2]], [p[0] + side * 2, T + 1.1, p[2]], [p[0] + side * 3.5, T + 0.8, p[2]], ...via], tone, r);
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

function simpleKitBox(): SceneDef {
  const x = at(xiao(), 44, 0, -8);
  const b1 = lyingButton(16, 8);
  const b2 = lyingButton(-6, 8);
  const r10 = at(resistor("10k"), -34, 1.2, 10);
  const r1 = at(resistor("1k"), -34, 1.2, 3);
  const cap = ceramicCap(5);
  cap.rotation.x = -Math.PI / 2;
  cap.position.set(-34, 1.3, -10);
  const wires = group(
    wire([[56, 0.6, -26], [30, 0.6, -29], [0, 0.6, -33], [-44, 0.6, -31]], "hot", 0.6),
    wire([[56, 0.6, -32], [28, 0.6, -35], [-2, 0.6, -39], [-44, 0.6, -37]], "switched", 0.6),
  );
  return {
    root: group(x, b1.g, b2.g, r10, r1, cap, wires),
    dir: TOP,
    pad: 1.04,
    notes: [
      note("1 XIAO ESP32-C6", x, [8.9, T, 0], "left"),
      note("2 Switches or push buttons", b1.g, [0, 5.5, -4.5], "left"),
      note("3 Hook-up wire", wires, [56, 0.6, -29], "left"),
      note("4 For long wires: 10 kΩ and 1 kΩ", r10, [-6, 0, 0], "right"),
      note("5 and 10 nF, one of each per input", cap, [-2.6, 2.6, 0], "right"),
    ],
  };
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

const BZ = -34; // button row, centre of the threaded body's panel face

function oneButton(pressed: boolean, lamp: boolean): SceneDef {
  const x = xiao();
  const btn = lyingButton(0, BZ, pressed);
  const [ax, ay, az] = btn.a, [bx, by, bz] = btn.b;
  const root = group(
    x,
    btn.g,
    fromPad(PAD(0), 1, [[13, 1.5, 3], [13.5, 3, BZ - 8], [12.5, 6, az - 1], [9, ay, az], [ax, ay, az]], "hot"),
    fromPad(GND, -1, [[-13, 1.5, 1], [-13.5, 3, BZ - 8], [-12.5, 6, bz - 1], [-9, by, bz], [bx, by, bz]], "switched"),
    solder(...PAD(0)),
    solder(...GND),
    joint(ax, ay - 0.2, az),
    joint(bx, by - 0.2, bz),
  );
  const notes: Note[] = [];
  const marks: Mark[] = [];
  const fit: THREE.Object3D[] = [x, btn.g];
  if (!lamp) {
    notes.push(note("One wire to each lug, either way round", root, btn.b, "right"));
  } else {
    const b = at(bulb(true), -44, -16, -18);
    b.scale.setScalar(0.5);
    root.add(b);
    fit.push(b);
    marks.push({ kind: "press", at: A(root, btn.cap) });
    marks.push({ kind: "glow", at: A(b, [0, 34, 0]), r: 38 });
    notes.push(note("The lights react", b, [-14, 38, 0], "right"));
  }
  notes.push(note("D0", x, PAD(0), "left", "hot"));
  notes.push(note("GND", x, GND, "right"));
  return { root, dir: TOP, fit, pad: 1.08, notes, marks };
}

// Six buttons in a row, D0 on the left. Each D wire leaves its pad, turns down at its own x,
// runs along its own lane and drops through the gap left of its button to the left lug. The
// right lugs are chained, switch to switch, under the row and back up the right to GND.
function simpleAll(): SceneDef {
  const x = xiao();
  const root = group(x);
  const marks: Mark[] = [];
  const bxs = [0, 1, 2, 3, 4, 5].map((i) => 50 - 20 * i);
  const turn = [19, 17.5, 16, 14.5, 13, 11.8];
  const lane = [-16, -19, -22, -19, -16.5, -14];
  const btns = bxs.map((bx) => lyingButton(bx, BZ));
  btns.forEach((b, i) => {
    root.add(b.g);
    const p = PAD(i), gap = bxs[i] + 10, tx = turn[i], lz = lane[i], dir = gap > tx ? 1 : -1;
    const [ax, ay, az] = b.a;
    root.add(
      fromPad(p, 1, [[tx, 1, p[2] - 1.5], [tx, 1, lz + 1.5], [tx + dir * 1.5, 1, lz], [gap - dir * 1.5, 1, lz], [gap, 1.5, lz - 1.5], [gap, 4, az + 6], [gap - 1.5, 6.5, az], [ax + 4, ay, az], [ax, ay, az]], "hot", 0.5),
      solder(p[0], T, p[2], 0.8),
      joint(ax, ay - 0.2, az, 1),
      joint(b.b[0], b.b[1] - 0.2, b.b[2], 1),
    );
    marks.push({ kind: "badge", at: A(root, [bxs[i], AXIS_Y + 6, BZ - 7]), text: `D${i}`, tone: "hot" });
  });
  // The chain: right lug of each switch to the right lug of the next, dipping under the row.
  const dip = BZ - 26;
  for (let i = 0; i < 5; i++) {
    const [ux, uy, uz] = btns[i].b, [vx] = btns[i + 1].b;
    root.add(wire([[ux, uy, uz], [ux, 5, uz - 3.5], [ux - 2.5, 2, dip], [vx + 2.5, 2, dip], [vx, 5, uz - 3.5], [vx, uy, uz]], "switched", 0.5));
  }
  const [lx, ly, lzz] = btns[5].b;
  root.add(
    wire([[lx, ly, lzz], [lx, 5, lzz - 3.5], [lx - 2.5, 2, dip], [-62, 1.5, dip], [-64, 1, dip + 3], [-64, 1, 2], [-61, 1, GND[2]], [GND[0] - 3.5, T + 0.8, GND[2]], [GND[0] - 2, T + 1.1, GND[2]], [GND[0], T + 0.4, GND[2]]], "switched", 0.5),
    solder(...GND, 0.8),
  );
  return {
    root,
    dir: TOP,
    pad: 1.03,
    notes: [
      note("GND: one wire from switch to switch, then to the board", root, [-10, 2, dip], "right"),
      note("GND", x, GND, "right"),
      note("One wire per pad, to one lug", root, [bxs[0] + 10, 2, -26], "left", "hot"),
    ],
    marks,
  };
}

// Per input, at the board (seen as in simple-wires): the 10 kΩ bridges over the board from the
// D0 pad to the 3V3 pad; the 1 kΩ runs out from the D0 pad to a joint where the switch wire
// starts; the 10 nF stands between that joint and a GND joint beside it. The GND wire comes
// over the USB end from the GND pad to that joint and carries on to the switch.
function simpleRc(): SceneDef {
  const x = xiao();
  const root = group(x);
  const [px, , pz] = PAD(0);
  const Y = T + 0.45;
  // 1 kΩ from the D0 pad out to the left; its far lead ends at the joint N.
  const r1 = at(resistor("1k", 16), px + 8, Y, pz);
  const N: V3 = [px + 16, Y, pz];
  const G: V3 = [N[0] + 3.5, Y, pz];
  // 10 kΩ over the board, D0 to 3V3, body clear of the USB-C receptacle.
  const u = new THREE.Vector3(V33[0] - px, 0, V33[2] - pz).normalize();
  const r10 = resistor("10k", 8);
  r10.rotation.y = Math.atan2(-u.z, u.x) + Math.PI;
  const C: V3 = [0, 6.6, (pz + V33[2]) / 2];
  r10.position.set(...C);
  const e0: V3 = [C[0] - u.x * 4, C[1], C[2] - u.z * 4]; // D0 end
  const e1: V3 = [C[0] + u.x * 4, C[1], C[2] + u.z * 4]; // 3V3 end
  root.add(
    wire([e0, [px - 1.2, 6.2, pz - 0.4], [px, 4.2, pz], [px, T + 0.2, pz], [px, -0.8, pz]], "gold", 0.3),
    wire([e1, [V33[0] + 1.2, 6.2, V33[2] + 0.4], [V33[0], 4.2, V33[2]], [V33[0], T + 0.2, V33[2]], [V33[0], -0.8, V33[2]]], "gold", 0.3),
  );
  // 10 nF standing on its legs over the two joints, disc toward the USB end.
  const cap = ceramicCap(5);
  cap.rotation.x = Math.PI / 2;
  cap.position.set((N[0] + G[0]) / 2, Y, pz + 5);
  // Its legs sit at ±1.25; bend them out to the joints.
  cap.children.slice(1).forEach((c) => (c.visible = false));
  root.add(
    wire([[(N[0] + G[0]) / 2 - 1.25, Y, pz + 4.4], [N[0] + 0.2, Y, pz + 2], N], "gold", 0.25),
    wire([[(N[0] + G[0]) / 2 + 1.25, Y, pz + 4.4], [G[0] - 0.2, Y, pz + 2], G], "gold", 0.25),
  );
  root.add(r1, r10, cap);
  // Switch wire from N; GND wire from its pad, over the USB end, to G and on to the switch.
  const END = -30;
  root.add(wire([N, [N[0] - 0.5, Y - 0.2, pz - 3], [N[0] - 0.5, 0.8, END]], "hot", 0.6));
  root.add(
    fromPad(GND, -1, [[-11.5, 1.5, GND[2] + 3], [-11.5, 2, 15], [-8, 2.5, 25], [G[0] + 4, 2.5, 25], [G[0] + 6, 2, 22], [G[0] + 6, Y, pz + 2], [G[0] + 3, Y, pz], G], "switched", 0.6),
  );
  root.add(wire([G, [G[0] + 0.5, Y - 0.2, pz - 3], [G[0] + 0.5, 0.8, END]], "switched", 0.6));
  root.add(hotSolder(PAD(0)), solder(...V33), solder(...GND), joint(...N, 0.9), joint(...G, 0.9));
  return {
    root,
    dir: TOP,
    pad: 1.04,
    // The values as tags beside each part: callout lines would cross the joints.
    marks: [
      { kind: "badge", at: A(root, [px + 8, Y, pz + 3.8]), text: "1 kΩ", tone: "hot" },
      { kind: "badge", at: A(root, [(N[0] + G[0]) / 2, Y, pz + 12.6]), text: "10 nF", tone: "hot" },
      { kind: "badge", at: A(root, [0, 6.6, 9.8]), text: "10 kΩ", tone: "hot" },
      { kind: "badge", at: A(root, [12.8, T, 3.6]), text: "D0", tone: "hot" },
    ],
    notes: [
      note("To the switch", root, [(N[0] + G[0]) / 2, 0.8, END], "left"),
      note("3V3", x, V33, "right"),
      note("GND", x, GND, "right"),
    ],
  };
}

// The box open, from the front: the XIAO taped to the floor, the USB-C plug out through a slot
// in the right wall; the lid hinged back behind it, inside face toward us, the buttons' lugs
// wired down to the XIAO. (Box camera: +x is to the right.)
function simpleBox(): SceneDef {
  const W = 50, D = 34, H = 22, t = 2;
  const usbY = t + T + 1.58;
  const wallR = plate(H + t, D + 2 * t, t, [], [[-(usbY - (H + t) / 2), 0, 6.2, 10.6]]);
  wallR.rotation.z = -Math.PI / 2; // plate x (height) → -y, thickness → +x
  wallR.position.set(W / 2, (H + t) / 2, 0);
  const bx = group(
    at(mesh(box(W, t, D)), 0, t / 2, 0),
    at(mesh(box(t, H + t, D + 2 * t)), -(W + t) / 2, (H + t) / 2, 0),
    at(mesh(box(W, H + t, t)), 0, (H + t) / 2, -(D + t) / 2),
    at(mesh(box(W, H + t, t)), 0, (H + t) / 2, (D + t) / 2),
    wallR,
  );

  // XIAO, USB-C toward the right wall, its mouth 5 mm inside it. Local (x, y, z) → (XX + z, t + y, -x).
  const XX = W / 2 - 5 - USB_MOUTH_Z;
  const x = at(xiao(), XX, t, 0);
  x.rotation.y = Math.PI / 2;
  const onX = (p: V3): V3 => [XX + p[2], t + p[1], -p[0]];
  const cable = usbCable([[0, 0, 26], [0, -usbY + 1.2, 38], [0, -usbY + 1.2, 52]]);
  cable.rotation.y = Math.PI / 2;
  cable.position.set(XX + USB_MOUTH_Z - 6.6, usbY, 0);

  // Lid hinged up behind the back wall: inside face toward +z at z = LZ.
  const LT = 2, LW = W + 2 * t + 2, LH = 40, LZ = -D / 2 - t, LY = H + t + LH / 2;
  const lxs = [14, 0, -14]; // D0, D1, D2
  const lid = plate(LW, LH, LT, lxs.map((lx) => [lx, 0, 6.1] as [number, number, number]));
  lid.rotation.x = -Math.PI / 2; // plate z → y, thickness → -z
  lid.position.set(0, LY, LZ);
  const btns = lxs.map((lx) => {
    const g = panelButton();
    g.rotation.x = -Math.PI / 2; // cap → -z (the outside), lugs → +z (toward us)
    g.position.set(lx, LY, LZ - LT);
    // Local (x, y, z) → (lx + x, LY + z, LZ - LT - y).
    const lug = (l: V3): V3 => [lx + l[0], LY + 0.6, LZ - LT - l[1]];
    return { g, a: lug(BUTTON_LUGS.a), b: lug(BUTTON_LUGS.b) };
  });

  const root = group(bx, x, cable, lid, ...btns.map((b) => b.g));
  const turnY = [30, 24, 16];
  btns.forEach((b, i) => {
    const p = onX(PAD(i));
    const [ax, ay, az] = b.a;
    root.add(
      // Down at its own x, then over to its pad: D2 runs lowest, so no wire crosses another.
      wire([[ax, ay, az], [ax, ay - 2, az - 1], [ax, turnY[i] + 3, -10.5], [ax + 1.5, turnY[i], -11], [p[0], 8, -11], [p[0], T + t + 1.2, p[2] - 1.8], [p[0], T + t + 0.4, p[2]]], "hot", 0.45),
      solder(p[0], p[1], p[2], 0.8),
      joint(ax, ay - 0.1, az, 0.9),
      joint(b.b[0], b.b[1] - 0.1, b.b[2], 0.9),
    );
  });
  // The other lugs chained over the top, then down the left to GND (front edge of the XIAO).
  for (let i = 0; i < 2; i++) {
    const [ux, uy, uz] = btns[i].b, [vx] = btns[i + 1].b;
    root.add(wire([[ux, uy, uz], [ux, uy + 2.5, uz - 1], [ux - 3, uy + 5, uz - 2.5], [vx + 3, uy + 5, uz - 2.5], [vx, uy + 2.5, uz - 1], [vx, uy, uz]], "switched", 0.45));
  }
  const [gx, gy, gz] = btns[2].b, gp = onX(GND);
  root.add(
    wire([[gx, gy, gz], [gx - 1, gy - 2.5, gz + 2], [-W / 2 + 5, H, gz + 6], [-W / 2 + 6, 6, 8], [XX - 12.5, 3, gp[2] + 4], [gp[0] - 2, 3.6, gp[2] + 3.5], [gp[0], T + t + 1.2, gp[2] + 1.8], [gp[0], T + t + 0.4, gp[2]]], "switched", 0.45),
    solder(gp[0], gp[1], gp[2], 0.8),
  );
  return {
    root,
    dir: [0.3, 2.6, 1.3],
    pad: 1.03,
    notes: [
      note("Lid: the buttons' lugs face in", lid, [-LW / 2 + 3, 0, -LH / 2 + 6], "left"),
      note("One lug to D0, D1, D2; the others chained to GND", root, [btns[1].b[0], btns[1].b[1] + 5, btns[1].b[2] - 2.5], "right"),
      note("XIAO on double-sided tape", x, [-4, T + 1.9, -3], "left"),
      note("USB-C out through a slot in the wall", cable, [0, 2.6, 16], "right", "hot"),
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
  // Exploded along the assembly axis, far enough apart that the lid doesn't hide the XIAO.
  base.position.y = -52;
  lid.position.y = 34;
  const root = group(b, base, lid);
  return {
    root,
    dir: [0.8, 0.75, 1.3],
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
  // The XIAO's USB-C mouth is 11.7 out from its centre (-10.1): the tongue goes all the way in.
  const cable = usbCable([[0, 0, 36], [-12, 0, 50]]);
  cable.rotation.y = -Math.PI / 2;
  cable.position.set(-10.1 - USB_MOUTH_Z + 6.6, 1.6 + T + 1.58, 2.8);
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

// A cutaway wall box (right side and top open) seen from the front right, above. The switch is pulled out to
// the front left, turned round so its terminal openings face us. Lever connectors lie with
// their openings toward the front. The carrier board stands at the back, XIAO side to the
// front, turned so J1/J2 open upward and J3 opens to the right (the open side): every wire
// visibly goes into an opening.
function wallScene(o: WallOpts) {
  const root = group();
  root.add(wallBox());
  const mech = mechanism();
  if (!o.mounted) {
    mech.position.set(-54, -14, 38);
    mech.rotation.y = -2.5;
  }
  root.add(mech);
  // The lamp only where the step is about it; elsewhere its cable just leaves the picture.
  const withLamp = Boolean(o.before || o.lit || !o.board);
  const lampBulb = at(bulb(Boolean(o.lit)), 72, 44, -28);
  lampBulb.scale.setScalar(0.85);
  if (withLamp) root.add(lampBulb);

  const w = (pts: V3[], tone: Tone, r = 0.9) => root.add(wire(pts, tone, r));
  // Sheathed cables in through the top, supply and lamp, both on the left and near the front:
  // from this camera they don't hide the board's terminals.
  const CZ = -8;
  const sup: V3 = [-26, 30, CZ], lamp: V3 = [-12, 30, CZ];
  root.add(wire([[sup[0], 70, CZ], [sup[0], 32.5, CZ]], "switched", 3));
  const lampUp: V3[] = withLamp ? [[lamp[0], 58, CZ], [20, 72, CZ - 6], [72, 66, -28], [72, 48, -28]] : [[lamp[0], 70, CZ]];
  root.add(wire([[lamp[0], 32.5, CZ], ...lampUp], "switched", 3));

  // Into a mechanism terminal (from outside), or out of it.
  const mOut = (t: "l" | "sl", d: number) => inScene(mech, mechOut(t, d));
  const reach = o.mounted ? 3 : 9;
  const intoMech = (t: "l" | "sl"): V3[] => [mOut(t, reach), mOut(t, 3), inScene(mech, t === "l" ? MECH.l : MECH.sl)];

  // Lever connectors in a row on the box floor, openings toward the front. With the switch back
  // in, the only room left is a 10 mm strip on each side of it (and in front of the floor row),
  // so wires run: along the top, down the left (live, neutral) or right (earth) side, along the
  // floor row's front into their openings. Local (x, y, z) → (cx + z, cy + y, cz - x).
  const lever = (n: number, x: number) => {
    const c = at(leverConnector(n), x, -32, -20);
    c.rotation.y = Math.PI / 2;
    root.add(c);
    return c;
  };
  const nN = o.mains ? 3 : 2, nL = o.mains ? 3 : 2;
  const nConn = lever(nN, -3);
  const eConn = lever(2, 16);
  const lv = (c: THREE.Object3D, n: number, i: number, d: number) => inScene(c, leverEntry(n, i, d));
  const intoLever = (c: THREE.Object3D, n: number, i: number): V3[] => [lv(c, n, i, 10), lv(c, n, i, 3), lv(c, n, i, 0)];
  // From a cable end down a side strip at x `sx`, then along the front of the floor row.
  const drop = (from: V3, sx: number, c: THREE.Object3D, n: number, i: number): V3[] => {
    const a = lv(c, n, i, 10);
    return [from, [from[0], 26, CZ + 2], [sx, 23, -3.5], [sx, -24.5, -3], [a[0] + (a[0] > sx ? -2 : 2), -26, -1.3], ...intoLever(c, n, i)];
  };
  // Out of a connector, back along the floor row (behind the incoming hooks), up the left side
  // deep in the box, over the top behind the switch.
  const riseLeft = (c: THREE.Object3D, n: number, i: number, sx: number, zDeep: number): V3[] => {
    const a = lv(c, n, i, 10);
    return [...intoLever(c, n, i).reverse(), [a[0], -24.6, -2.5], [sx + 2, -24.3, -3.5], [sx, -22, zDeep], [sx, 22, zDeep], [sx + 6, 27, zDeep - 8]];
  };

  const lConn = o.lampJoined ? lever(nL, -22) : null;
  w(drop([sup[0] - 2.5, sup[1], sup[2]], -26.5, nConn, nN, 0), "neutral");
  w(drop([lamp[0] - 2.5, lamp[1], lamp[2]], -24.5, nConn, nN, 1), "neutral");
  w(drop([sup[0] + 2.5, sup[1], sup[2]], 25, eConn, 2, 0), "earth");
  w(drop([lamp[0] + 2.5, lamp[1], lamp[2]], 27, eConn, 2, 1), "earth");

  if (o.before) {
    w([sup, [-24, 20, -10], [-30, 6, 30], ...intoMech("l")], "live");
    w([lamp, [-4, 16, 4], [-10, -8, 30], [-36, -10, 62], ...intoMech("sl")], "switched");
  } else if (lConn) {
    w(drop(sup, -30.5, lConn, nL, 0), "live");
    w(drop(lamp, -28.5, lConn, nL, 1), "switched");
  }

  let board: ReturnType<typeof boardWithXiao> | null = null;
  // Board-local → scene: KiCad x (J1/J2 side) up, the XIAO side to the front, J3's end to the right.
  const BOARD_AT: V3 = [0, 0, -WALL_D + 17.2];
  const turn = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0));
  if (o.board) {
    board = boardWithXiao();
    board.root.setRotationFromMatrix(turn);
    board.root.position.set(...BOARD_AT);
    root.add(board.root);
    if (o.inEnclosure) {
      const { base, lid } = enclosure();
      base.position.y = -17.2;
      lid.position.y = -0.8;
      const enc = group(base, lid);
      enc.setRotationFromMatrix(turn);
      enc.position.set(...BOARD_AT);
      root.add(enc);
    }
  }
  const bw = (p: V3): V3 => inScene(board!.root, p);
  // Into a board terminal, straight into its opening. The enclosure leaves about 9 mm to the
  // box's top wall over J1/J2, and 4 mm to the side wall past J3.
  const intoBoard = (k: string): V3[] => {
    const p = board!.pts[k], u = board!.out[k];
    const off = (d: number): V3 => bw([p[0] + u[0] * d, p[1] + u[1] * d, p[2] + u[2] * d]);
    return u[0] ? [off(8), off(3), bw(p)] : [off(5), off(2), bw(p)];
  };
  if (board && o.switchWires) {
    const l = inScene(mech, MECH.l), sl = inScene(mech, MECH.sl);
    if (o.mounted) {
      w([...intoMech("l").reverse(), [l[0] + 6, 24, -26], [2, 27, -36], ...intoBoard("D0")], "signal", 0.8);
      w([...intoMech("sl").reverse(), [sl[0] + 10, 10, -26], [29, 6, -36], ...intoBoard("GND")], "signal", 0.8);
    } else {
      w([...intoMech("l").reverse(), [l[0] + 18, l[1] + 20, l[2] - 6], [8, 27, 0], [4, 28, -30], ...intoBoard("D0")], "signal", 0.8);
      w([...intoMech("sl").reverse(), [sl[0] + 16, sl[1] - 16, sl[2] - 4], [10, -26, 20], [29, -8, -10], [29, 2, -38], ...intoBoard("GND")], "signal", 0.8);
    }
  }
  if (board && o.mains && lConn) {
    w([...riseLeft(lConn, nL, 2, -30.5, -12), ...intoBoard("L")], "live");
    w([...riseLeft(nConn, nN, 2, -28, -15), ...intoBoard("N")], "neutral");
  }
  return { root, mech, lampBulb, nConn, eConn, lConn, board, bw, L: inScene(mech, MECH.l), SL: inScene(mech, MECH.sl) };
}

const WALL_DIR: V3 = [0.85, 0.8, 1.0];

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
        note("Enclosure at the back of the box", s.root, s.bw([-10, 8.8, -12]), "right", "hot"),
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
    case "round-dip":
      return roundDip();
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
