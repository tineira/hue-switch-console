import * as THREE from "three";
import { MM, cssVar, disposeTree } from "@/app/landing/round-model";

// Still renders for the build guide, in the Switches board picture's style
// (app/landing/simple-render.ts): parts filled with the page colour, crease edges and a 1 px
// silhouette in the foreground colour, a few parts filled with a tone. Render once into a PNG,
// work out the SVG overlay (callouts, arrows, glows) from the same camera, dispose everything.

export type V3 = [number, number, number];

/** A point in an object's local mm, or in the scene's mm when `o` is left out. */
export type Anchor = { o?: THREE.Object3D; p: V3 };

/** `n`: a part balloon (circled number) before the text, matching the numbered row of a list. */
export type Note = { at: Anchor; text: string; side?: "left" | "right"; tone?: "hot" | "danger" | "ok"; n?: number };

export type Mark =
  | { kind: "dot"; at: Anchor; tone?: "hot" | "danger" | "ok" }
  | { kind: "glow"; at: Anchor; r?: number }
  | { kind: "cross"; at: Anchor }
  | { kind: "arrow"; from: Anchor; to: Anchor; tone?: "hot" | "muted" }
  | { kind: "press"; at: Anchor }
  | { kind: "badge"; at: Anchor; text: string; tone: "hot" | "danger" | "ok" };

export type SceneDef = {
  /** Everything in mm; the renderer scales it to metres. */
  root: THREE.Group;
  /** Camera direction (from the target toward the camera). */
  dir: V3;
  up?: V3;
  /** Frame these objects (default: the whole scene). */
  fit?: THREE.Object3D[];
  /** Margin around the framed parts, 1 = tight. */
  pad?: number;
  /** Callout lines wrap at this many characters (default WRAP); fewer leaves the parts more width. */
  wrap?: number;
  notes?: Note[];
  marks?: Mark[];
};

export type Still = { src: string; overlay: string; w: number; h: number };

// Fixed colours are real-world (wire insulation, resistor bands); the rest follow the theme.
const TONES: Record<string, string> = {
  hot: "--filament",
  soft: "--filament-soft",
  ok: "--ok",
  danger: "--danger",
  lit: "--filament-soft",
  live: "#8a5a2b",
  neutral: "#2f6fd6",
  earth: "#4fa84a",
  switched: "#2b2f36",
  // Low-voltage switch wires in the wall: a colour no mains wire has.
  signal: "#7c5cff",
  polyimide: "#e2a24a",
  wago: "#f08a24",
  resistor: "#d9c7a0",
  cap: "#d98a2b",
  brown: "#7a4a1e",
  black: "#1c1c1c",
  red: "#d23b2b",
  orange: "#f08a24",
  gold: "#c9a64b",
  // Solder.
  tin: "#b9bec6",
};

function colour(tone: string): string {
  const v = TONES[tone] ?? tone;
  return v.startsWith("--") ? cssVar(v) : v;
}

const LABEL_FONT = 12.5;
const CHAR_W = LABEL_FONT * 0.6;
const LINE_H = 15;
// A part balloon: its diameter plus the gap to the text.
const BALLOON_R = 11;
const BALLOON = 2 * BALLOON_R + 8;
const WRAP = 20;

// Callout text in lines of at most WRAP characters.
function wrap(text: string, max = WRAP): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const word of text.split(" ")) {
    if (cur && (cur + " " + word).length > max) {
      lines.push(cur);
      cur = word;
    } else cur = cur ? `${cur} ${word}` : word;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** `h` is the tallest the frame gets; it shrinks to fit a wide scene and its callouts. */
export function renderStill(def: SceneDef, w: number, maxH: number): Still {
  let h = maxH;
  const scene = new THREE.Scene();
  const world = new THREE.Group();
  world.scale.setScalar(MM);
  world.add(def.root);
  scene.add(world);
  world.updateMatrixWorld(true);

  // Line style, with tone fills.
  const fg = cssVar("--foreground");
  const fills = new Map<string, THREE.MeshBasicMaterial>();
  const fillFor = (tone: string) => {
    let m = fills.get(tone);
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color: colour(tone), polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
      fills.set(tone, m);
    }
    return m;
  };
  const edge = new THREE.LineBasicMaterial({ color: fg });
  const outline = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      thickness: { value: 1.0 },
      resolution: { value: new THREE.Vector2(w, h) },
      color: { value: new THREE.Color(fg) },
    },
    vertexShader: `uniform float thickness; uniform vec2 resolution;
      void main(){ vec4 c = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        vec3 n = normalize(normalMatrix * normal); vec2 d = n.xy; float l = length(d);
        if (l > 1e-4) c.xy += (d / l) * thickness * 2.0 / resolution * c.w; gl_Position = c; }`,
    fragmentShader: `uniform vec3 color; void main(){ gl_FragColor = vec4(color,1.0); }`,
  });
  const extra: THREE.BufferGeometry[] = [];
  const meshes: THREE.Mesh[] = [];
  world.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
  });
  for (const m of meshes) {
    const tex = m.userData.texture as THREE.Texture | undefined;
    if (tex) {
      m.material = new THREE.MeshBasicMaterial({ map: tex });
      continue;
    }
    m.material = fillFor(m.userData.tone ?? "--background");
    m.add(new THREE.Mesh(m.geometry, outline));
    if (!m.userData.smooth) {
      const eg = new THREE.EdgesGeometry(m.geometry, 20);
      extra.push(eg);
      m.add(new THREE.LineSegments(eg, edge));
    }
  }
  world.updateMatrixWorld(true);

  // Camera: orthographic along `dir`, framed on `fit`, leaving room for the callouts.
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.001, 10);
  const box = new THREE.Box3();
  for (const o of def.fit ?? [world]) box.expandByObject(o);
  const ctr = box.getCenter(new THREE.Vector3());
  const dir = new THREE.Vector3(...def.dir).normalize();
  if (def.up) cam.up.set(...def.up);
  cam.position.copy(ctr).addScaledVector(dir, 2);
  cam.lookAt(ctr);
  cam.updateMatrixWorld();
  // Fit the parts' outline in view, not their box: every vertex, in camera space.
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const v = new THREE.Vector3();
  const toView = new THREE.Matrix4();
  for (const f of def.fit ?? [world])
    f.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || m.material === outline) return;
      const pos = m.geometry.attributes.position;
      toView.multiplyMatrices(cam.matrixWorldInverse, m.matrixWorld);
      const step = Math.max(1, Math.floor(pos.count / 400));
      for (let i = 0; i < pos.count; i += step) {
        v.fromBufferAttribute(pos, i).applyMatrix4(toView);
        x0 = Math.min(x0, v.x);
        x1 = Math.max(x1, v.x);
        y0 = Math.min(y0, v.y);
        y1 = Math.max(y1, v.y);
      }
    });

  const world3 = (a: Anchor) => (a.o ?? def.root).localToWorld(new THREE.Vector3(...a.p));
  const notes = (def.notes ?? []).map((n) => {
    const v = world3(n.at).applyMatrix4(cam.matrixWorldInverse);
    const side = n.side ?? (v.x < (x0 + x1) / 2 ? "left" : "right");
    const lines = wrap(n.text, def.wrap);
    return { ...n, side, lines, width: Math.max(...lines.map((l) => l.length)) * CHAR_W + 22 + (n.n ? BALLOON : 0) };
  });
  const margin = (side: string) => Math.max(0, ...notes.filter((n) => n.side === side).map((n) => n.width)) + (notes.some((n) => n.side === side) ? 14 : 0);
  const lm = Math.max(16, margin("left")), rm = Math.max(16, margin("right"));
  const pad = def.pad ?? 1.12;
  const aw = Math.max(40, w - lm - rm), ah = h - 24;
  const s = Math.min(aw / ((x1 - x0) * pad), ah / ((y1 - y0) * pad));
  const stack = (side: string) =>
    notes.filter((n) => n.side === side).reduce((sum, n) => sum + n.lines.length * LINE_H + 10, 0);
  h = Math.round(Math.min(maxH, Math.max(220, (y1 - y0) * pad * s + 40, stack("left") + 30, stack("right") + 30)));
  const left = x0 - (lm + (aw - (x1 - x0) * s) / 2) / s;
  const cy = (y0 + y1) / 2;
  cam.left = left;
  cam.right = left + w / s;
  cam.top = cy + h / (2 * s);
  cam.bottom = cy - h / (2 * s);
  cam.updateProjectionMatrix();

  const canvas = document.createElement("canvas");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  (outline.uniforms.resolution.value as THREE.Vector2).set(w, h);
  renderer.render(scene, cam);
  const src = canvas.toDataURL("image/png");

  const px = (a: Anchor): [number, number] => {
    const v = world3(a).project(cam);
    return [((v.x + 1) / 2) * w, ((1 - v.y) / 2) * h];
  };
  const overlay = drawMarks(def.marks ?? [], px) + drawNotes(notes, px, w, h, lm, rm);

  disposeTree(def.root);
  extra.forEach((g) => g.dispose());
  fills.forEach((m) => m.dispose());
  edge.dispose();
  outline.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  return { src, overlay, w, h };
}

const toneVar = (t?: string) => (t === "danger" ? "var(--danger)" : t === "ok" ? "var(--ok)" : t === "muted" ? "var(--muted)" : "var(--filament)");
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function drawMarks(marks: Mark[], px: (a: Anchor) => [number, number]): string {
  let out = "";
  for (const m of marks) {
    if (m.kind === "dot") {
      const [x, y] = px(m.at);
      out += `<circle cx="${x}" cy="${y}" r="7" fill="none" stroke="${toneVar(m.tone)}" stroke-width="2"/><circle cx="${x}" cy="${y}" r="3.2" fill="${toneVar(m.tone)}"/>`;
    } else if (m.kind === "glow") {
      const [x, y] = px(m.at);
      const r = m.r ?? 16;
      out += `<circle cx="${x}" cy="${y}" r="${r}" fill="#ff8a1f" opacity="0.28" style="filter:blur(${r / 3}px)"/><circle cx="${x}" cy="${y}" r="${Math.max(3, r / 4)}" fill="#ff8a1f" style="filter:drop-shadow(0 0 5px rgb(255 138 31 / .9))"/>`;
    } else if (m.kind === "cross") {
      const [x, y] = px(m.at);
      out += `<circle cx="${x}" cy="${y}" r="10" fill="var(--background)" stroke="var(--danger)" stroke-width="2"/><path d="M${x - 4.5} ${y - 4.5}L${x + 4.5} ${y + 4.5}M${x + 4.5} ${y - 4.5}L${x - 4.5} ${y + 4.5}" stroke="var(--danger)" stroke-width="2.2" stroke-linecap="round"/>`;
    } else if (m.kind === "arrow") {
      const [ax, ay] = px(m.from), [bx, by] = px(m.to);
      const a = Math.atan2(by - ay, bx - ax), c = toneVar(m.tone);
      const hx = (k: number) => bx - 9 * Math.cos(a + k), hy = (k: number) => by - 9 * Math.sin(a + k);
      out += `<line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="${c}" stroke-width="2" stroke-dasharray="5 4"/><path d="M${hx(0.45)} ${hy(0.45)}L${bx} ${by}L${hx(-0.45)} ${hy(-0.45)}" fill="none" stroke="${c}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`;
    } else if (m.kind === "press") {
      const [x, y] = px(m.at);
      out += `<path d="M${x} ${y - 44}V${y - 10}M${x - 7} ${y - 18}L${x} ${y - 9}L${x + 7} ${y - 18}" fill="none" stroke="var(--filament)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><text x="${x}" y="${y - 50}" text-anchor="middle" font-size="12" font-weight="600" fill="var(--filament)">press</text>`;
    } else if (m.kind === "badge") {
      const [x, y] = px(m.at);
      const bw = m.text.length * 7.4 + 18;
      out += `<rect x="${x - bw / 2}" y="${y - 12}" width="${bw}" height="24" rx="12" fill="var(--background)" stroke="${toneVar(m.tone)}" stroke-width="1.8"/><text x="${x}" y="${y + 0.5}" text-anchor="middle" dominant-baseline="middle" font-size="12" font-weight="700" fill="${toneVar(m.tone)}">${esc(m.text)}</text>`;
    }
  }
  return out;
}

type Placed = Note & { side: "left" | "right"; width: number; lines: string[] };

function drawNotes(notes: Placed[], px: (a: Anchor) => [number, number], w: number, h: number, lm: number, rm: number): string {
  let out = "";
  for (const side of ["left", "right"] as const) {
    const col = notes
      .filter((n) => n.side === side)
      .map((n) => ({ n, a: px(n.at), y: 0 }))
      .sort((p, q) => p.a[1] - q.a[1]);
    // Spread the labels apart (by their height), inside the frame, as close to their anchors
    // as possible. `y` is the label's first line.
    const tall = (c: (typeof col)[number]) => Math.max((c.n.lines.length - 1) * LINE_H, c.n.n ? 2 * BALLOON_R - LINE_H + 6 : 0);
    const GAP = 10 + LINE_H;
    col.forEach((c, i) => (c.y = Math.max(c.a[1] - tall(c) / 2, i ? col[i - 1].y + tall(col[i - 1]) + GAP : 14)));
    for (let i = col.length - 1; i >= 0; i--)
      col[i].y = Math.min(col[i].y, i < col.length - 1 ? col[i + 1].y - tall(col[i]) - GAP : h - 12 - tall(col[i]));
    for (const c of col) {
      const { n, a, y } = c;
      const col_ = n.tone ? toneVar(n.tone) : "var(--foreground)";
      const b = n.n ? BALLOON : 0;
      // The balloon sits on the leader's end, the text beyond it.
      const tx = side === "left" ? lm - 12 - b : w - rm + 12 + b;
      const sx = side === "left" ? lm - 6 : w - rm + 6;
      const ly = y + tall(c) / 2;
      const ty = n.n ? ly - ((n.lines.length - 1) * LINE_H) / 2 : y;
      out += `<line x1="${sx}" y1="${ly}" x2="${a[0]}" y2="${a[1]}" stroke="${col_}" stroke-width="1.2"/>`;
      out += `<circle cx="${a[0]}" cy="${a[1]}" r="2.6" fill="${col_}"/>`;
      if (n.n) {
        const bx = side === "left" ? lm - 6 - BALLOON_R : w - rm + 6 + BALLOON_R;
        out += `<circle cx="${bx}" cy="${ly}" r="${BALLOON_R}" fill="var(--cream)" stroke="var(--foreground)" stroke-width="1.5"/>`;
        out += `<text x="${bx}" y="${ly + 0.5}" text-anchor="middle" dominant-baseline="middle" font-size="12" font-weight="600" font-family="var(--font-geist-sans), sans-serif" fill="var(--foreground)">${n.n}</text>`;
      }
      out += `<text x="${tx}" y="${ty}" text-anchor="${side === "left" ? "end" : "start"}" dominant-baseline="middle" font-size="${LABEL_FONT}" font-weight="500" fill="${col_}" stroke="var(--background)" stroke-width="4" stroke-linejoin="round" paint-order="stroke">`;
      n.lines.forEach((line, i) => (out += `<tspan x="${tx}" dy="${i ? LINE_H : 0}">${esc(line)}</tspan>`));
      out += `</text>`;
    }
  }
  return out;
}
