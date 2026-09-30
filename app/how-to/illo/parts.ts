import * as THREE from "three";

// Extra parts for the build guide's illustrations, next to the landing's XIAO, headers, antenna
// and Round Display (app/landing/round-model.ts). Everything is in mm, unscaled: the scene puts
// all parts in one group scaled to metres. A mesh's `userData.tone` picks its fill colour in
// the line style (illo/render.ts); `userData.smooth` drops the crease lines of round parts.
// The carrier board and enclosure follow hue-simple-switch/hardware (layout.py, enclosure.scad).

export type Tone =
  | "hot"
  | "soft"
  | "ok"
  | "danger"
  | "live"
  | "neutral"
  | "earth"
  | "switched"
  | "wago"
  | "resistor"
  | "cap"
  | "brown"
  | "black"
  | "red"
  | "orange"
  | "gold"
  | "lit"
  | "screen";

const MAT = new THREE.MeshBasicMaterial();

export function mesh(geo: THREE.BufferGeometry, tone?: Tone, smooth = false): THREE.Mesh {
  const m = new THREE.Mesh(geo, MAT);
  if (tone) m.userData.tone = tone;
  if (smooth) m.userData.smooth = true;
  return m;
}

export function at<T extends THREE.Object3D>(o: T, x: number, y: number, z: number): T {
  o.position.set(x, y, z);
  return o;
}

export const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
export const cyl = (r: number, h: number, seg = 32) => new THREE.CylinderGeometry(r, r, h, seg);

// A 2D outline (x, y) extruded upward, as world (x, z) over y 0..h.
export function extrude(sh: THREE.Shape, h: number) {
  const g = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false, curveSegments: 32 });
  g.rotateX(Math.PI / 2);
  g.translate(0, h, 0);
  return g;
}

/** A wire through `pts` (mm), as a tube. */
export function wire(pts: [number, number, number][], tone: Tone, r = 0.6): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, "catmullrom", 0.2);
  return mesh(new THREE.TubeGeometry(curve, Math.max(24, pts.length * 16), r, 10, false), tone, true);
}

/** A solder joint: a low cone around a pin. */
export function solder(x: number, y: number, z: number, r = 0.95): THREE.Mesh {
  return at(mesh(new THREE.ConeGeometry(r, 0.8, 20), undefined, true), x, y + 0.4, z);
}

// ---------------------------------------------------------------------------- small parts

/** USB-C cable: metal tongue at z 0..6.6 (the part that goes in), overmould, then the cable. */
export function usbCable(bend: [number, number, number][] = [[0, 0, 60]]): THREE.Group {
  const g = new THREE.Group();
  const shell = new THREE.Shape();
  const r = 1.25, hx = 4.15 - r;
  shell.moveTo(-hx, -r);
  shell.lineTo(hx, -r);
  shell.absarc(hx, 0, r, -Math.PI / 2, Math.PI / 2, false);
  shell.lineTo(-hx, r);
  shell.absarc(-hx, 0, r, Math.PI / 2, Math.PI * 1.5, false);
  const tongue = new THREE.ExtrudeGeometry(shell, { depth: 6.6, bevelEnabled: false, curveSegments: 12 });
  g.add(mesh(tongue));
  const body = new THREE.Shape();
  const R = 3.2, HX = 6.2 - R;
  body.moveTo(-HX, -R);
  body.lineTo(HX, -R);
  body.absarc(HX, 0, R, -Math.PI / 2, Math.PI / 2, false);
  body.lineTo(-HX, R);
  body.absarc(-HX, 0, R, Math.PI / 2, Math.PI * 1.5, false);
  const over = new THREE.ExtrudeGeometry(body, { depth: 17, bevelEnabled: true, bevelSize: 0.6, bevelThickness: 0.6, bevelSegments: 2, curveSegments: 16 });
  g.add(at(mesh(over, undefined, true), 0, 0, 6.6));
  g.add(wire([[0, 0, 23], [0, 0, 30], ...bend], "switched", 1.6));
  return g;
}

/** 12 mm tactile push button, legs down; the cap top is at y ≈ 7.3 (4.3 when pressed). */
export function tactButton(pressed = false): THREE.Group {
  const g = new THREE.Group();
  g.add(at(mesh(box(12, 3.6, 12)), 0, 1.8, 0));
  g.add(at(mesh(box(12, 0.3, 12)), 0, 3.75, 0));
  g.add(at(mesh(cyl(3.4, pressed ? 0.8 : 3.4, 36), "hot", true), 0, 3.9 + (pressed ? 0.4 : 1.7), 0));
  for (const [x, z] of [[-6.25, -2.5], [6.25, -2.5], [-6.25, 2.5], [6.25, 2.5]]) g.add(at(mesh(box(0.7, 3.5, 0.4)), x, -1.2, z));
  return g;
}

/** Legs of a tact button, local coords. The two on the left (-x) are one side of the contact. */
export const TACT_LEGS = { a: [-6.25, -2.9, 2.5] as [number, number, number], b: [6.25, -2.9, 2.5] as [number, number, number] };

const BANDS: Record<string, Tone[]> = { "10k": ["brown", "black", "orange", "gold"], "1k": ["brown", "black", "red", "gold"] };

/** Axial resistor along x, body centred at the origin, leads to ±len/2. */
export function resistor(value: "10k" | "1k", len = 16): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.CapsuleGeometry(1.15, 4.2, 6, 20).rotateZ(Math.PI / 2);
  g.add(mesh(body, "resistor", true));
  BANDS[value].forEach((tone, i) => {
    const x = [-1.9, -0.9, 0.1, 1.9][i];
    g.add(at(mesh(cyl(1.2, 0.5, 20).rotateZ(Math.PI / 2), tone, true), x, 0, 0));
  });
  g.add(wire([[-len / 2, 0, 0], [-3, 0, 0]], "gold", 0.3));
  g.add(wire([[3, 0, 0], [len / 2, 0, 0]], "gold", 0.3));
  return g;
}

/** Ceramic disc capacitor standing up; legs end at (±1.25, -legs, 0). */
export function ceramicCap(legs = 8): THREE.Group {
  const g = new THREE.Group();
  g.add(at(mesh(cyl(2.6, 1.3, 32).rotateX(Math.PI / 2), "cap", true), 0, 2.6, 0));
  g.add(wire([[-1.25, 0.6, 0], [-1.25, -legs, 0]], "gold", 0.25));
  g.add(wire([[1.25, 0.6, 0], [1.25, -legs, 0]], "gold", 0.25));
  return g;
}

/** A light bulb, base down at the origin (height ~50). */
export function bulb(lit: boolean): THREE.Group {
  const g = new THREE.Group();
  g.add(at(mesh(new THREE.SphereGeometry(15, 40, 24), lit ? "lit" : undefined, true), 0, 34, 0));
  g.add(at(mesh(new THREE.CylinderGeometry(8.5, 6.5, 10, 32), lit ? "lit" : undefined, true), 0, 20, 0));
  for (let i = 0; i < 4; i++) g.add(at(mesh(cyl(6.6, 2, 32), undefined, true), 0, 6 + i * 2.6, 0));
  g.add(at(mesh(new THREE.CylinderGeometry(3, 5, 4, 24), undefined, true), 0, 2, 0));
  return g;
}

/** An open project box, inside w × d, walls h, opening up. */
export function projectBox(w: number, d: number, h: number, t = 2): THREE.Group {
  const g = new THREE.Group();
  g.add(at(mesh(box(w + 2 * t, t, d + 2 * t)), 0, t / 2, 0));
  g.add(at(mesh(box(t, h, d + 2 * t)), -(w + t) / 2, h / 2 + t, 0));
  g.add(at(mesh(box(t, h, d + 2 * t)), (w + t) / 2, h / 2 + t, 0));
  g.add(at(mesh(box(w, h, t)), 0, h / 2 + t, -(d + t) / 2));
  g.add(at(mesh(box(w, h, t)), 0, h / 2 + t, (d + t) / 2));
  return g;
}

// ---------------------------------------------------------------- carrier board (hardware/)

const BOARD_R = 26, BOARD_W = 21, BOARD_T = 1.6;

function flatDisc(r: number, w: number, holes: THREE.Path[] = []) {
  const sh = new THREE.Shape();
  const a = Math.acos(w / r); // angle where the flat meets the arc
  sh.absarc(0, 0, r, a, Math.PI - a, false);
  sh.absarc(0, 0, r, Math.PI + a, 2 * Math.PI - a, false);
  sh.closePath();
  sh.holes.push(...holes);
  return sh;
}

/** Terminal block with `n` ways along x, wire entry facing -z; body on y 0..h (goes on the underside). */
function terminal(n: number, pitch: number, h: number, depth: number, tone?: Tone) {
  const g = new THREE.Group();
  const w = n * pitch;
  g.add(at(mesh(box(w, h, depth), tone), 0, h / 2, 0));
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * pitch;
    g.add(at(mesh(box(pitch * 0.62, pitch * 0.55, 0.4)), x, h * 0.35, -depth / 2 - 0.2));
    g.add(at(mesh(cyl(pitch * 0.3, 0.4, 20), undefined, true), x, h + 0.2, depth * 0.15));
    g.add(at(mesh(box(pitch * 0.42, 0.2, 0.25)), x, h + 0.45, depth * 0.15));
  }
  return g;
}

export type CarrierBoard = {
  root: THREE.Group;
  /** Local (mm) points of interest: terminal entries and the XIAO parts. */
  pts: Record<string, [number, number, number]>;
};

/**
 * The mains carrier board, XIAO side up (+y). KiCad (x, y) maps to (x, z): the view from above
 * matches KiCad's top view. `xiao` is the XIAO model to solder on (or null).
 */
export function carrierBoard(xiao: THREE.Object3D | null): CarrierBoard {
  const root = new THREE.Group();
  const slot = new THREE.Path();
  slot.moveTo(-19.4, -10.1);
  slot.lineTo(-2.2, -10.1);
  slot.absarc(-2.2, -10.6, 0.5, Math.PI / 2, -Math.PI / 2, true);
  slot.lineTo(-19.4, -11.1);
  slot.absarc(-19.4, -10.6, 0.5, -Math.PI / 2, Math.PI / 2, true);
  // extrude() maps shape (x, y) to (x, z), so KiCad y lands on +z as is.
  root.add(mesh(extrude(flatDisc(BOARD_R, BOARD_W, [slot]), BOARD_T)));

  // Bottom side (below y 0): power module, terminals, fuse.
  const under = new THREE.Group();
  under.rotation.x = Math.PI;
  root.add(under);
  under.add(at(mesh(box(20, 15, 34)), -9.5, 7.5, 0));
  const j1 = terminal(2, 5.08, 10, 8, "soft");
  j1.rotation.y = -Math.PI / 2;
  under.add(at(j1, 15.85, 0, 10.2));
  const j2 = terminal(4, 3.5, 8.5, 7, "soft");
  j2.rotation.y = -Math.PI / 2;
  under.add(at(j2, 15.85, 0, -6.25));
  const j3 = terminal(3, 3.5, 8.5, 7, "soft");
  under.add(at(j3, 7.9, 0, -17.45));
  under.add(at(mesh(cyl(4.2, 7.7, 32), undefined, true), 6.6, 3.85, 18.6));

  // Top side: varistor, diode, the RC rows, the XIAO.
  const T = BOARD_T;
  root.add(at(mesh(box(8, 4.5, 6.3)), -8.0, T + 2.25, -19.5));
  root.add(at(mesh(box(4.3, 2.2, 2.6)), -9.4, T + 1.1, 17.4));
  for (const y of [-0.5, 2.1, 4.7, 7.3, 9.9, 12.5])
    for (const x of [2.2, 5.8, 9.4]) root.add(at(mesh(box(1.6, 0.5, 0.8)), x, T + 0.25, y));
  if (xiao) {
    // Flat on its pads, USB-C over the left edge.
    xiao.rotation.y = -Math.PI / 2;
    xiao.position.set(-10.1, T, 2.8);
    root.add(xiao);
  }

  // Terminal entries (KiCad y on +z; the underside is -y).
  const pts: Record<string, [number, number, number]> = {
    L: [19.9, -4, -12.74],
    N: [19.9, -4, -7.66],
    D0: [19.4, -3, 1.0],
    D1: [19.4, -3, 4.5],
    D2: [19.4, -3, 8.0],
    D3: [19.4, -3, 11.5],
    D4: [11.4, -3, 21.0],
    D5: [7.9, -3, 21.0],
    GND: [4.4, -3, 21.0],
  };
  return { root, pts };
}

/** The printed enclosure: base (under the board) and lid (over the XIAO), outside 46 × 56 × 26. */
export function enclosure(): { base: THREE.Group; lid: THREE.Group } {
  const inR = 26.4, inW = 21.4, outR = 28, outW = 23;
  const base = new THREE.Group();
  const floorT = 1.2, below = 16, boardT = 1.6;
  const shell = (h: number, withFloor: boolean) => {
    const sh = flatDisc(outR, outW, [pathOf(flatDisc(inR, inW))]);
    const g = new THREE.Group();
    g.add(mesh(extrude(sh, h)));
    if (withFloor) g.add(mesh(extrude(flatDisc(outR, outW), floorT)));
    return g;
  };
  base.add(shell(floorT + below + boardT, true));
  // Wire holes on the right wall (J1, J2) and the bottom wall (J3), drawn as dark plugs.
  for (const z of [-12.74, -7.66]) base.add(at(mesh(cyl(1.8, 0.6, 24).rotateZ(Math.PI / 2), "black", true), outW + 0.1, floorT + below - 4.2, z));
  for (const z of [1.0, 4.5, 8.0, 11.5]) base.add(at(mesh(cyl(1.5, 0.6, 24).rotateZ(Math.PI / 2), "black", true), outW + 0.1, floorT + below - 2.4, z));

  const lid = new THREE.Group();
  const lidH = 6 + 1.2 + 2.4;
  const ring = new THREE.Group();
  ring.add(mesh(extrude(flatDisc(outR, outW, [pathOf(flatDisc(outR - 1.6, outW - 1.6))]), lidH - 1.2)));
  lid.add(ring);
  const win = new THREE.Path();
  win.moveTo(-20.4, 4.7);
  win.lineTo(-15.2, 4.7);
  win.lineTo(-15.2, -10.3);
  win.lineTo(-20.4, -10.3);
  win.closePath();
  const roof = extrude(flatDisc(outR, outW, [win]), 1.2);
  lid.add(at(mesh(roof), 0, lidH - 1.2, 0));
  return { base, lid };
}

function pathOf(sh: THREE.Shape): THREE.Path {
  const p = new THREE.Path();
  const pts = sh.getPoints(96);
  p.moveTo(pts[0].x, pts[0].y);
  for (const q of pts.slice(1)) p.lineTo(q.x, q.y);
  p.closePath();
  return p;
}

// ------------------------------------------------------------------------- in the wall

/** A flush wall box, opening toward +z at z = 0, inside 64 × 64, 45 deep; cut away on the right. */
export function wallBox(): THREE.Group {
  const g = new THREE.Group();
  const s = 64, d = 45, t = 2;
  g.add(at(mesh(box(s + 2 * t, s + 2 * t, t)), 0, 0, -d - t / 2));
  g.add(at(mesh(box(t, s + 2 * t, d)), -(s + t) / 2, 0, -d / 2));
  g.add(at(mesh(box(s + t, t, d)), -t / 2, (s + t) / 2, -d / 2));
  g.add(at(mesh(box(s + t, t, d)), -t / 2, -(s + t) / 2, -d / 2));
  return g;
}

/** A one-way wall switch: back box with two screw terminals (at `MECH.l` and `MECH.sl`), rocker plate in front. */
export function mechanism(): THREE.Group {
  const g = new THREE.Group();
  g.add(at(mesh(box(44, 44, 20)), 0, 0, -10));
  for (const x of [-12, 12]) {
    g.add(at(mesh(box(8, 8, 6), "soft"), x, 14, -21));
    g.add(at(mesh(cyl(2, 1, 20).rotateX(Math.PI / 2), undefined, true), x, 14, -17.5));
  }
  g.add(at(mesh(box(80, 80, 3)), 0, 0, 1.5));
  g.add(at(mesh(box(26, 40, 4)), 0, 0, 5));
  g.add(at(mesh(box(22, 3, 1)), 0, 12, 7.3));
  return g;
}

export const MECH = { l: [-12, 14, -24] as [number, number, number], sl: [12, 14, -24] as [number, number, number] };

/** WAGO 221-style lever connector with `n` poles, entries facing -x. */
export function leverConnector(n: number): THREE.Group {
  const g = new THREE.Group();
  const p = 5.8;
  g.add(at(mesh(box(18, 8.5, n * p), "soft"), 0, 4.25, 0));
  for (let i = 0; i < n; i++) g.add(at(mesh(box(12, 2.2, p - 1.2), "wago"), 2.5, 9.6, (i - (n - 1) / 2) * p));
  return g;
}

/** Wire entry of pole `i` of a lever connector, in its local coords. */
export function leverEntry(n: number, i: number): [number, number, number] {
  return [-9.5, 3.5, (i - (n - 1) / 2) * 5.8];
}

/** A DIN-rail breaker, lever up (on) or down (off), front toward +z. */
export function breaker(on: boolean): THREE.Group {
  const g = new THREE.Group();
  g.add(at(mesh(box(18, 82, 44)), 0, 0, -22));
  g.add(at(mesh(box(18, 44, 18)), 0, 0, 9));
  const lever = mesh(box(10, 14, 6), on ? "ok" : "danger");
  lever.position.set(0, on ? 7 : -7, 21);
  lever.rotation.x = on ? -0.35 : 0.35;
  g.add(lever);
  return g;
}
