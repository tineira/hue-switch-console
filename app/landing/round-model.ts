import * as THREE from "three";
import { PAGES, clamp, type RoundState } from "@/app/landing/demo-data";

// three.js models of the Round's parts and the XIAO, shared by the Round and Simple cards
// (docs/specs/handoff_landing_v2). Everything is built in mm; each part's root is scaled to metres.
// Plain three.js, no React: only the landing page's 3D islands import it, through a dynamic import().

export const MM = 0.001;

type Mat = THREE.Material;

function builder(name: string) {
  const root = new THREE.Group();
  root.name = name;
  root.scale.setScalar(MM);
  const add = (n: string, geo: THREE.BufferGeometry, mat: Mat, x: number, y: number, z: number, parent: THREE.Object3D = root) => {
    const m = new THREE.Mesh(geo, mat);
    m.name = n;
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  return { root, add };
}

const std = (name: string, color: number, roughness: number, metalness = 0) =>
  new THREE.MeshStandardMaterial({ name, color, roughness, metalness });
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (r: number, h: number, seg = 48) => new THREE.CylinderGeometry(r, r, h, seg);

// Shape (x, y) → world (x, z), extruded upward over y 0..h.
function extrudeFlat(sh: THREE.Shape, h: number) {
  const g = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false, curveSegments: 24 });
  g.rotateX(Math.PI / 2);
  g.translate(0, h, 0);
  return g;
}

export const SCREEN_R = 16.2;

// Round Display for XIAO. `screen` is the disc that shows the dial texture.
export function buildDisplay(screenMat: Mat) {
  const R = 19.5;
  const H_HDR = 4.3, T_PCB = 1.2, T_LCD = 1.1, T_GLASS = 0.7;
  const Y_PCB = H_HDR, Y_LCD = Y_PCB + T_PCB, Y_GLASS = Y_LCD + T_LCD, Y_TOP = Y_GLASS + T_GLASS;
  const ROW_X = 7.62, PITCH = 2.54, HDR_Z = 1.5;
  const M = {
    soldermask: std("soldermask_black", 0x1a1c1f, 0.55, 0.05),
    bezel: std("lcd_frame", 0x2c3036, 0.6, 0.1),
    glass: std("cover_glass", 0x0b0c10, 0.08, 0.1),
    tin: std("tin_plated", 0xc4c8cd, 0.35, 0.35),
    plastic: std("plastic_black", 0x1e1e20, 0.75),
    nylon: std("plastic_white", 0xe9e5dc, 0.7),
    ceramic: std("ceramic", 0xb49a70, 0.6),
  };
  const { root, add } = builder("XIAO_Round_Display");
  const c96 = (r: number, h: number, seg = 96) => cyl(r, h, seg);

  add("pcb", c96(R, T_PCB), M.soldermask, 0, Y_PCB + T_PCB / 2, 0);
  add("lcd_module", c96(18.0, T_LCD), M.bezel, 0, Y_LCD + T_LCD / 2, 0);
  add("touch_cover_glass", c96(18.2, T_GLASS), M.glass, 0, Y_GLASS + T_GLASS / 2, 0);
  const screen = add("screen", new THREE.CircleGeometry(SCREEN_R, 128).rotateX(-Math.PI / 2), screenMat, 0, Y_TOP + 0.02, 0);

  // XIAO female headers (2 × 7, 2.54 pitch, rows 15.24 apart)
  for (const side of [-1, 1]) {
    const tag = side < 0 ? "L" : "R";
    add(`header_${tag}`, box(2.54, H_HDR, 7 * PITCH), M.plastic, side * ROW_X, H_HDR / 2, HDR_Z);
    for (let i = 0; i < 7; i++)
      add(`header_${tag}_socket_${i + 1}`, box(1.0, 0.04, 1.0), M.tin, side * ROW_X, -0.015, HDR_Z + (i - 3) * PITCH);
  }
  add("microsd_slot", box(11.4, 1.6, 14), M.tin, 0, Y_PCB - 0.8, -7.2);
  add("microsd_mouth", box(10.6, 0.9, 0.3), M.plastic, 0, Y_PCB - 0.8, -14.1);
  add("power_switch", box(6.7, 1.4, 2.6), M.tin, -13.6, Y_PCB - 0.7, -9.2);
  add("power_switch_lever", box(1.4, 1.0, 1.2), M.plastic, -14.6, Y_PCB - 0.9, -11.0);
  add("battery_jst", box(5.4, 3.4, 4.2), M.nylon, 14.0, Y_PCB - 1.7, -8.0);
  add("battery_jst_mouth", box(4.4, 2.2, 0.3), M.plastic, 14.0, Y_PCB - 1.8, -10.2);
  add("rtc_ic", box(3.0, 0.9, 3.0), M.plastic, -13.4, Y_PCB - 0.45, 6.2);
  add("user_button", box(3.6, 1.4, 4.2), M.tin, 13.6, Y_PCB - 0.7, 7.4);
  add("user_button_cap", cyl(0.9, 0.5, 32), M.plastic, 13.6, Y_PCB - 1.65, 7.4);
  [[-15.5, 1.2], [-16.2, -1.2], [15.8, 1.0], [16.4, -1.4], [-10.6, 11.6], [10.8, 12.4], [0, 14.8], [-2.6, 14.8]].forEach(
    ([x, z], i) => add(`passive_${i + 1}`, box(1.0, 0.5, 0.5), M.ceramic, x, Y_PCB - 0.25, z),
  );
  return { root, screen };
}

// XIAO ESP32-S3 body. The Simple card uses it for the C6 too (an illustration, owner's call).
export function buildXiao() {
  const W = 17.8, L = 21.0, T_PCB = 1.2, PITCH = 2.54;
  const PAD_X = 7.62, HOLE_R = 0.5;
  const PAD_ZS = Array.from({ length: 7 }, (_, i) => (i - 3) * PITCH);
  const M = {
    soldermask: std("soldermask_black", 0x1a1c1f, 0.55, 0.05),
    gold: std("enig_gold", 0xd9b25a, 0.35, 0.35),
    tin: std("tin_plated", 0xc4c8cd, 0.35, 0.35),
    plastic: std("plastic_black", 0x1e1e20, 0.75),
    ceramic: std("ceramic", 0xb49a70, 0.6),
    led: std("led_lens", 0xf2efe6, 0.3),
  };
  const { root, add } = builder("XIAO_ESP32S3");

  function roundRect(w: number, d: number, r: number, h: number, holes: number[][]) {
    const sh = new THREE.Shape(), x = -w / 2, y = -d / 2;
    sh.moveTo(x + r, y);
    sh.lineTo(x + w - r, y);
    sh.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
    sh.lineTo(x + w, y + d - r);
    sh.absarc(x + w - r, y + d - r, r, 0, Math.PI / 2, false);
    sh.lineTo(x + r, y + d);
    sh.absarc(x + r, y + d - r, r, Math.PI / 2, Math.PI, false);
    sh.lineTo(x, y + r);
    sh.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
    for (const [hx, hz, hr] of holes) {
      const p = new THREE.Path();
      p.absarc(hx, hz, hr, 0, Math.PI * 2, true);
      sh.holes.push(p);
    }
    return extrudeFlat(sh, h);
  }
  // Pad from just inboard of the hole out to the board edge, with the drilled hole.
  function padGeo(side: number, z: number) {
    const x0 = side * (PAD_X - 0.85), x1 = side * (W / 2), sh = new THREE.Shape();
    const lo = Math.min(x0, x1), hi = Math.max(x0, x1);
    sh.moveTo(lo, z - 0.8);
    sh.lineTo(hi, z - 0.8);
    sh.lineTo(hi, z + 0.8);
    sh.lineTo(lo, z + 0.8);
    sh.closePath();
    const p = new THREE.Path();
    p.absarc(side * PAD_X, z, HOLE_R, 0, Math.PI * 2, true);
    sh.holes.push(p);
    return extrudeFlat(sh, 0.04);
  }

  add("pcb", roundRect(W, L, 1.2, T_PCB, [-1, 1].flatMap((sd) => PAD_ZS.map((z) => [sd * PAD_X, z, HOLE_R]))), M.soldermask, 0, 0, 0);
  M.gold.side = THREE.DoubleSide;
  for (const side of [-1, 1])
    for (let i = 0; i < 7; i++) {
      const z = (i - 3) * PITCH, tag = (side < 0 ? "L" : "R") + (i + 1);
      add("pad_top_" + tag, padGeo(side, z), M.gold, 0, T_PCB + 0.001, 0);
      add("pad_bot_" + tag, padGeo(side, z), M.gold, 0, -0.041, 0);
      add(
        "via_barrel_" + tag,
        new THREE.CylinderGeometry(HOLE_R - 0.01, HOLE_R - 0.01, T_PCB + 0.08, 32, 1, true),
        M.gold,
        side * PAD_X,
        T_PCB / 2,
        z,
      );
    }
  // USB-C receptacle at the +z end (slight overhang)
  {
    const r = 1.58, hx = 8.94 / 2 - r, sh = new THREE.Shape();
    sh.moveTo(-hx, -r);
    sh.lineTo(hx, -r);
    sh.absarc(hx, 0, r, -Math.PI / 2, Math.PI / 2, false);
    sh.lineTo(-hx, r);
    sh.absarc(-hx, 0, r, Math.PI / 2, Math.PI * 1.5, false);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 7.35, bevelEnabled: false, curveSegments: 16 });
    g.translate(0, 0, -7.35 / 2);
    add("usb_c", g, M.tin, 0, T_PCB + 1.58, L / 2 - 3.2);
  }
  add("usb_c_mouth", box(7.6, 1.9, 0.3), M.plastic, 0, T_PCB + 1.58, L / 2 - 3.2 + 3.55);
  add("rf_shield", box(12.6, 1.9, 9.6), M.tin, 0, T_PCB + 0.95, -2.4);
  add("ufl_connector", box(2.6, 0.6, 2.6), M.plastic, 3.8, T_PCB + 0.3, -9.0);
  add("ufl_jack", cyl(1.0, 0.65, 32), M.gold, 3.8, T_PCB + 0.6 + 0.325, -9.0);
  add("button_boot", box(2.6, 0.9, 1.6), M.tin, -5.3, T_PCB + 0.45, 4.8);
  add("button_boot_cap", box(1.2, 0.3, 0.8), M.plastic, -5.3, T_PCB + 1.05, 4.8);
  add("button_reset", box(2.6, 0.9, 1.6), M.tin, 5.3, T_PCB + 0.45, 4.8);
  add("button_reset_cap", box(1.2, 0.3, 0.8), M.plastic, 5.3, T_PCB + 1.05, 4.8);
  add("charge_led", box(1.0, 0.5, 0.6), M.led, 5.2, T_PCB + 0.25, 8.9);
  [[-5.2, 8.9], [-6.0, 2.9], [6.0, 2.9], [-2.0, 3.4], [2.0, 3.4], [-6.0, -9.2], [-3.6, -9.2]].forEach(([x, z], i) =>
    add("passive_" + (i + 1), box(1.0, 0.5, 0.5), M.ceramic, x, T_PCB + 0.25, z),
  );
  add("bat_pad_pos", box(2.2, 0.04, 1.4), M.gold, -1.8, -0.015, -6.5);
  add("bat_pad_neg", box(2.2, 0.04, 1.4), M.gold, 1.8, -0.015, -6.5);
  return root;
}

// Two 1 × 7 male pin headers, 15.24 mm apart.
export function buildHeaders() {
  const PITCH = 2.54, N = 7, ROW_X = 7.62, BODY = 2.5, PIN = 0.64;
  const SHORT = 3.0, LONG = 6.0, Y_BODY0 = SHORT, Y_BODY1 = SHORT + BODY, Y_MAX = SHORT + BODY + LONG;
  const M = { plastic: std("pbt_black", 0x1e1e20, 0.7), gold: std("gold_plated", 0xd9b25a, 0.3, 0.35) };
  const { root, add } = builder("Pin_Headers_2x_1x7");
  const CH = 0.35;
  const tip = () => new THREE.CylinderGeometry(0.16, PIN / Math.SQRT2, CH, 4, 1).rotateY(Math.PI / 4);
  for (const side of [-1, 1]) {
    const tag = side < 0 ? "A" : "B", row = new THREE.Group();
    row.name = "header_" + tag;
    row.position.x = side * ROW_X;
    root.add(row);
    for (let i = 0; i < N; i++) {
      const z = (i - (N - 1) / 2) * PITCH;
      add(`header_${tag}_body_${i + 1}`, box(BODY, BODY, PITCH - 0.02), M.plastic, 0, (Y_BODY0 + Y_BODY1) / 2, z, row);
      add(`header_${tag}_pin_${i + 1}`, box(PIN, Y_MAX - 2 * CH, PIN), M.gold, 0, Y_MAX / 2, z, row);
      add(`header_${tag}_pin_${i + 1}_tip`, tip(), M.gold, 0, Y_MAX - CH / 2, z, row);
      add(`header_${tag}_pin_${i + 1}_tail`, tip().rotateX(Math.PI), M.gold, 0, CH / 2, z, row);
    }
  }
  return root;
}

// 2.4 GHz FPC antenna on a Ø1.13 coax with a U.FL plug.
export function buildAntenna() {
  const FW = 10.0, FL = 20.0, FT = 0.2;
  const CR = 0.565, CL = 45.0;
  const PLUG_R = 1.0, PLUG_H = 1.3;
  const TOTAL = FL + CL + PLUG_R * 2, Z0 = -TOTAL / 2;
  const Z_FPC1 = Z0 + FL, Z_PLUG = Z0 + TOTAL - PLUG_R;
  const CY = FT + CR;
  const M = {
    polyimide: std("polyimide_amber", 0xc98a2c, 0.45),
    copper: std("copper_trace", 0xd58a5a, 0.35, 0.35),
    jacket: std("coax_jacket", 0x8e9196, 0.6),
    tin: std("tin_plated", 0xc4c8cd, 0.35, 0.35),
    plastic: std("plastic_black", 0x1e1e20, 0.75),
  };
  const { root, add } = builder("FPC_Antenna_A02");
  add("fpc_substrate", box(FW, FT, FL), M.polyimide, 0, FT / 2, Z0 + FL / 2);
  const TY = FT + 0.011, TW = 0.6;
  for (let i = 0; i < 6; i++) add("radiator_run_" + (i + 1), box(7.6, 0.02, TW), M.copper, 0, TY, Z0 + 1.5 + i * 2.2);
  for (let i = 0; i < 5; i++)
    add("radiator_turn_" + (i + 1), box(TW, 0.02, 2.2), M.copper, (i % 2 ? -1 : 1) * 3.5, TY, Z0 + 1.5 + i * 2.2 + 1.1);
  add("feed_line", box(TW, 0.02, FL - 13.5), M.copper, -3.5, TY, Z0 + 12.5 + (FL - 13.5) / 2 - 0.5);
  add("ground_pad", box(4.0, 0.02, 3.2), M.copper, 1.6, TY, Z_FPC1 - 2.4);
  add("solder_joint", new THREE.SphereGeometry(0.75, 24, 12).scale(1, 0.55, 1.6), M.tin, 0, FT + 0.2, Z_FPC1 - 3.4);
  add("coax_cable", cyl(CR, CL + 1.5, 32).rotateX(Math.PI / 2), M.jacket, 0, CY, Z_FPC1 - 3 + (CL + 1.5) / 2);
  add("ufl_crimp", box(1.2, 1.0, 1.8), M.tin, 0, CY, Z_PLUG - PLUG_R - 0.6);
  add("ufl_body", cyl(PLUG_R, PLUG_H, 48), M.tin, 0, 0.1 + PLUG_H / 2, Z_PLUG);
  add("ufl_cap", cyl(PLUG_R * 0.7, 0.4, 48), M.tin, 0, 0.1 + PLUG_H + 0.2, Z_PLUG);
  add("ufl_insulator", cyl(0.45, 0.3, 32), M.plastic, 0, 0.1 - 0.15 + 0.001, Z_PLUG);
  return root;
}

// ---------- Line style: card-coloured fill, 20° creases, 1 px back-face silhouette ----------

export type LineStyle = {
  fill: THREE.MeshBasicMaterial;
  edge: THREE.LineBasicMaterial;
  outline: THREE.ShaderMaterial;
  setColors: (foreground: string, cream: string) => void;
  setResolution: (w: number, h: number) => void;
  dispose: () => void;
};

export function lineStyle(): LineStyle {
  const fill = new THREE.MeshBasicMaterial({ polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const edge = new THREE.LineBasicMaterial();
  const outline = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      thickness: { value: 1.0 },
      resolution: { value: new THREE.Vector2(1, 1) },
      color: { value: new THREE.Color() },
    },
    vertexShader: `uniform float thickness; uniform vec2 resolution;
      void main(){ vec4 c = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        vec3 n = normalize(normalMatrix * normal); vec2 d = n.xy; float l = length(d);
        if (l > 1e-4) c.xy += (d / l) * thickness * 2.0 / resolution * c.w; gl_Position = c; }`,
    fragmentShader: `uniform vec3 color; void main(){ gl_FragColor = vec4(color,1.0); }`,
  });
  return {
    fill,
    edge,
    outline,
    setColors(fg, cr) {
      fill.color.set(cr);
      edge.color.set(fg);
      (outline.uniforms.color.value as THREE.Color).set(fg);
    },
    setResolution(w, h) {
      (outline.uniforms.resolution.value as THREE.Vector2).set(w, h);
    },
    dispose() {
      fill.dispose();
      edge.dispose();
      outline.dispose();
    },
  };
}

// Swap every mesh under `root` to the line style. Geometry is shared, so the shaded copy's
// materials are left alone.
export function applyLineStyle(root: THREE.Object3D, style: LineStyle) {
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
  });
  for (const m of meshes) {
    m.material = style.fill;
    m.add(new THREE.Mesh(m.geometry, style.outline));
    m.add(new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 20), style.edge));
  }
}

export function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as Mat | Mat[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose();
  });
}

// Read a CSS custom property off <html> (theme tokens).
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// ---------- Dial texture: .round-dial drawn at 104 and scaled, like RoundScreen ----------

export const DIAL_SIZE = 1024;

export function drawDial(ctx: CanvasRenderingContext2D, st: RoundState, font: string) {
  const S = DIAL_SIZE, K = S / 104, C = S / 2;
  const page = PAGES[st.page], T = page.pal, on = st.on, scene = page.scenes[st.scene];
  const accent = on ? T.accent : T.track, deg = clamp(st.level, 0, 100) * 2.7;
  const rad = (d: number) => ((d - 90) * Math.PI) / 180;
  const annulus = (from: number, sweep: number, rO: number, rI: number, color: string) => {
    ctx.beginPath();
    ctx.arc(C, C, rO, rad(from), rad(from + sweep));
    ctx.arc(C, C, rI, rad(from + sweep), rad(from), true);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  const spacing = (px: number) => {
    if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${px}px`;
  };

  ctx.clearRect(0, 0, S, S);
  ctx.beginPath();
  ctx.arc(C, C, C, 0, Math.PI * 2);
  ctx.fillStyle = T.bg;
  ctx.fill();
  const rO = C - 4 * K, rI = rO - 8 * K;
  annulus(225, 270, rO, rI, T.track);
  if (deg > 0) {
    ctx.globalAlpha = on ? 1 : 0.35;
    annulus(225, deg, rO, rI, accent);
    ctx.globalAlpha = 1;
  }
  const rF = C - 16 * K;
  ctx.beginPath();
  ctx.arc(C, C, rF, 0, Math.PI * 2);
  ctx.fillStyle = on ? T.fillOn : T.fillOff;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(C, C, rF - K, 0, Math.PI * 2);
  ctx.lineWidth = 2 * K;
  ctx.strokeStyle = accent;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const nameH = 11 * K * 1.2, sceneH = on && scene ? 7 * K * 1.2 : 0, gap = sceneH ? 3 * K : 0;
  const top = C - (nameH + gap + sceneH) / 2;
  ctx.font = `400 ${11 * K}px ${font}`;
  spacing(0.3 * K);
  ctx.fillStyle = on ? T.ink : T.mute;
  ctx.fillText(page.name, C, top + nameH / 2);
  if (sceneH) {
    ctx.font = `400 ${7 * K}px ${font}`;
    spacing(0.2 * K);
    ctx.globalAlpha = 0.88;
    ctx.fillStyle = T.ink;
    ctx.fillText(scene, C, top + nameH + gap + sceneH / 2);
    ctx.globalAlpha = 1;
  }
  const dot = 4 * K, dg = 3 * K, n = PAGES.length, w = n * dot + (n - 1) * dg, y = S - 22 * K - dot / 2;
  PAGES.forEach((_, i) => {
    ctx.beginPath();
    ctx.arc(C - w / 2 + dot / 2 + i * (dot + dg), y, dot / 2, 0, Math.PI * 2);
    if (i === st.page) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = on ? T.ink : T.mute;
    } else {
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = T.ink;
    }
    ctx.fill();
    ctx.globalAlpha = 1;
  });
}

// The font stack behind Tailwind's font-mono (next/font gives Geist Mono a generated family name).
export function monoFont(): string {
  return cssVar("--font-geist-mono") || '"Geist Mono", ui-monospace, monospace';
}
