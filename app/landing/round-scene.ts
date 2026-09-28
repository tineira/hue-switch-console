import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { RoundState } from "@/app/landing/demo-data";
import {
  DIAL_SIZE,
  MM,
  SCREEN_R,
  applyLineStyle,
  buildAntenna,
  buildDisplay,
  buildHeaders,
  buildXiao,
  cssVar,
  disposeTree,
  drawDial,
  lineStyle,
  monoFont,
} from "@/app/landing/round-model";

// The Round card's 3D scene: the assembly drawn twice (line and shaded) into two stacked
// canvases, cross-faded by scroll progress p, with an SVG overlay of balloons and guides.
// Spec: docs/specs/finished/handoff_landing_v2/round-assembly.md.

export type ScreenEllipse = { cx: number; cy: number; rx: number; ry: number };

export type RoundScene = {
  /** Scroll progress 0..1. */
  setProgress: (p: number) => void;
  setScreen: (st: RoundState) => void;
  /** Re-read the theme tokens. */
  applyTheme: () => void;
  /** Screen-local position under a client point, in dial units (dx, dy ∈ −0.5..0.5 on the disc). */
  screenPoint: (clientX: number, clientY: number) => { dx: number; dy: number } | null;
  dispose: () => void;
};

type Els = {
  area: HTMLElement;
  line: HTMLCanvasElement;
  shade: HTMLCanvasElement;
  grid: HTMLElement;
  svg: SVGSVGElement;
};

const GAP = 7;
const Y = (() => {
  const aTop = 1.8, xOff = aTop + GAP + 4.36, xTop = xOff + 0.04, xUfl = xOff - 2.45, hBase = xTop + GAP;
  return { aTop, xOff, xTop, xUfl, hBase, dBase: hBase + 11.5 + GAP };
})();
const POSE = {
  ant: { a: 0, b: Y.xUfl - Y.aTop + 0.2 },
  hdr: { a: Y.hBase, b: Y.xTop - 3.0 },
  disp: { a: Y.dBase, b: Y.xTop + 2.5 },
};

const CALLS = [
  { n: 1, part: "disp", at: [-15.5, 7.3, 9.1], off: [-54, -40] },
  { n: 2, part: "xiao", at: [-8.9, 0.6, 7.0], off: [64, 34] },
  { n: 3, part: "ant", at: [0, 0.2, -23.5], off: [0, 58] },
] as const;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const ss = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function buildAsm(screenMat: THREE.Material) {
  const asm = new THREE.Group();
  const ant = buildAntenna();
  ant.rotation.y = Math.PI / 2;
  ant.position.set(-(3.8 + 32.5) * MM, 0, -7.5 * MM);
  const xiao = buildXiao();
  xiao.rotation.z = Math.PI;
  xiao.position.set(0, Y.xOff * MM, 1.5 * MM);
  const hdr = buildHeaders();
  hdr.position.set(0, Y.hBase * MM, 1.5 * MM);
  const { root: disp, screen } = buildDisplay(screenMat);
  disp.position.set(0, Y.dBase * MM, 0);
  asm.add(disp, hdr, xiao, ant);
  return { asm, ant, xiao, hdr, disp, screen };
}

export async function createRoundScene(
  els: Els,
  hooks: { onFrame: (screen: ScreenEllipse) => void; onFirstFrame: () => void },
): Promise<RoundScene> {
  const font = monoFont();
  await Promise.all([`400 110px ${font}`, `500 13px ${font}`].map((f) => document.fonts.load(f).catch(() => [])));

  // Dial texture
  const dial = document.createElement("canvas");
  dial.width = dial.height = DIAL_SIZE;
  const dctx = dial.getContext("2d")!;
  const tex = new THREE.CanvasTexture(dial);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const screenMat = new THREE.MeshStandardMaterial({
    name: "screen_ui",
    color: 0x000000,
    emissive: 0xffffff,
    emissiveMap: tex,
    emissiveIntensity: 0,
    roughness: 0.15,
    metalness: 0,
  });

  const shade = buildAsm(screenMat);
  const line = buildAsm(screenMat);
  const style = lineStyle();
  applyLineStyle(line.asm, style);

  const mk = (canvas: HTMLCanvasElement) => {
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    r.setClearColor(0, 0);
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    return r;
  };
  const rLine = mk(els.line);
  const rShade = mk(els.shade);
  rShade.outputColorSpace = THREE.SRGBColorSpace;
  const sLine = new THREE.Scene();
  sLine.add(line.asm);
  const sShade = new THREE.Scene();
  sShade.add(shade.asm);
  const pmrem = new THREE.PMREMGenerator(rShade);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  pmrem.dispose();
  sShade.environment = envRT.texture;
  sShade.environmentIntensity = 0.9;
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(0.3, 1, 0.5);
  sShade.add(sun);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.001, 2);

  let W = 1, H = 1, p = 0, dirty = true, raf = 0, first = true, disposed = false;
  const kick = () => {
    dirty = true;
    if (!raf && !disposed) raf = requestAnimationFrame(frame);
  };

  const ro = new ResizeObserver(() => {
    W = Math.max(1, els.area.clientWidth);
    H = Math.max(1, els.area.clientHeight);
    rLine.setSize(W, H, false);
    rShade.setSize(W, H, false);
    style.setResolution(W, H);
    kick();
  });
  ro.observe(els.area);

  const DIR_A = new THREE.Vector3(1, 0.78, 1.15).normalize();
  const DIR_B = new THREE.Vector3(0, 1, 0.55).normalize();
  const bbox = new THREE.Box3(), focus = new THREE.Box3();
  const corners = Array.from({ length: 8 }, () => new THREE.Vector3());
  const v3 = new THREE.Vector3();

  const toPx = (obj: THREE.Object3D, x: number, y: number, z: number): [number, number] => {
    const v = obj.localToWorld(v3.set(x, y, z)).project(cam);
    return [((v.x + 1) / 2) * W, ((1 - v.y) / 2) * H];
  };

  function pose() {
    const tA = ss(0.1, 0.4, p), tH = ss(0.22, 0.5, p), tD = ss(0.4, 0.68, p);
    for (const set of [shade, line]) {
      set.ant.position.y = lerp(POSE.ant.a, POSE.ant.b, tA) * MM;
      set.hdr.position.y = lerp(POSE.hdr.a, POSE.hdr.b, tH) * MM;
      set.disp.position.y = lerp(POSE.disp.a, POSE.disp.b, tD) * MM;
      set.asm.updateMatrixWorld(true);
    }
    // Camera: the direction eases toward the face, and the frame refits to the current parts.
    const dir = DIR_A.clone().lerp(DIR_B, ss(0.35, 0.82, p)).normalize();
    bbox.setFromObject(shade.asm);
    const tF = ss(0.55, 0.9, p);
    if (tF > 0) {
      focus.makeEmpty().expandByObject(shade.disp).expandByObject(shade.xiao);
      bbox.min.lerp(focus.min, tF);
      bbox.max.lerp(focus.max, tF);
    }
    const c = bbox.getCenter(new THREE.Vector3());
    cam.position.copy(c).addScaledVector(dir, 0.5);
    cam.up.set(0, 1, 0);
    cam.lookAt(c);
    cam.updateMatrixWorld();
    const { min, max } = bbox;
    let i = 0;
    for (const x of [min.x, max.x])
      for (const y of [min.y, max.y])
        for (const z of [min.z, max.z]) corners[i++].set(x, y, z).applyMatrix4(cam.matrixWorldInverse);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const v of corners) {
      x0 = Math.min(x0, v.x);
      x1 = Math.max(x1, v.x);
      y0 = Math.min(y0, v.y);
      y1 = Math.max(y1, v.y);
    }
    const pad = lerp(1.28, 1.3, ss(0.5, 0.85, p)), a = W / H;
    let hw = ((x1 - x0) / 2) * pad, hh = ((y1 - y0) / 2) * pad;
    if (hw / hh > a) hh = hw / a;
    else hw = hh * a;
    // In the finished state the screen sits a little high, above the Try-it pills.
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2 - hh * 0.14 * tF;
    cam.left = cx - hw;
    cam.right = cx + hw;
    cam.top = cy + hh;
    cam.bottom = cy - hh;
    cam.updateProjectionMatrix();

    const tS = ss(0.3, 0.72, p);
    els.grid.style.opacity = (1 - tS).toFixed(3);
    els.shade.style.opacity = tS.toFixed(3);
    els.line.style.opacity = (1 - tS).toFixed(3);
    screenMat.emissiveIntensity = ss(0.8, 0.88, p);
    drawOverlay(1 - ss(0.12, 0.3, p), 1 - ss(0.3, 0.55, p));
  }

  const NS = "http://www.w3.org/2000/svg";
  function el(tag: string, attrs: Record<string, string | number>) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, String(attrs[k]));
    return e;
  }
  function drawOverlay(aCall: number, aGuide: number) {
    const svg = els.svg;
    svg.replaceChildren();
    const fg = "var(--foreground)";
    if (aGuide > 0.01) {
      const g = el("g", { opacity: aGuide.toFixed(3), stroke: "var(--muted)", "stroke-width": 1, "stroke-dasharray": "5 4", fill: "none" });
      const seg = (a: [number, number], b: [number, number]) =>
        g.append(el("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }));
      for (const sx of [-1, 1])
        for (const sz of [-1, 1]) {
          const x = sx * 7.62, z = sz * 7.62;
          seg(toPx(line.disp, x, 0, 1.5 + z), toPx(line.hdr, x, 11.5, z));
          seg(toPx(line.hdr, x, 0, z), toPx(line.xiao, -x, 0, z));
        }
      seg(toPx(line.ant, 0, 1.4, 32.5), toPx(line.xiao, 3.8, 2.45, -9.0));
      svg.append(g);
    }
    if (aCall > 0.01) {
      const g = el("g", { opacity: aCall.toFixed(3) });
      for (const c of CALLS) {
        const [ax, ay] = toPx(line[c.part], c.at[0], c.at[1], c.at[2]);
        const bx = ax + c.off[0], by = ay + c.off[1];
        const d = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / d, uy = (by - ay) / d;
        g.append(el("line", { x1: ax, y1: ay, x2: bx - ux * 14, y2: by - uy * 14, stroke: fg, "stroke-width": 1 }));
        g.append(el("circle", { cx: ax, cy: ay, r: 2, fill: fg }));
        g.append(el("circle", { cx: bx, cy: by, r: 13.25, fill: "var(--cream)", stroke: fg, "stroke-width": 1.5 }));
        const t = el("text", { x: bx, y: by + 0.5, "text-anchor": "middle", "dominant-baseline": "middle" });
        t.textContent = String(c.n);
        g.append(t);
      }
      svg.append(g);
    }
  }

  function frame() {
    raf = 0;
    if (!dirty || disposed) return;
    dirty = false;
    pose();
    rLine.render(sLine, cam);
    rShade.render(sShade, cam);
    const [cx, cy] = toPx(shade.screen, 0, 0, 0);
    const [ex] = toPx(shade.screen, SCREEN_R, 0, 0);
    const [, fy] = toPx(shade.screen, 0, 0, SCREEN_R);
    hooks.onFrame({ cx, cy, rx: Math.abs(ex - cx), ry: Math.abs(fy - cy) });
    if (first) {
      first = false;
      hooks.onFirstFrame();
    }
  }

  // Screen plane under a client point. The dial disc is the screen mesh's local y = 0 plane
  // (CircleGeometry rotated −90° about X), so u − 0.5 = x / 2R and 0.5 − v = z / 2R.
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), inv = new THREE.Matrix4();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  function screenPoint(clientX: number, clientY: number) {
    const r = els.area.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    inv.copy(shade.screen.matrixWorld).invert();
    ray.ray.applyMatrix4(inv);
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    return { dx: hit.x / (2 * SCREEN_R), dy: hit.z / (2 * SCREEN_R) };
  }

  function applyTheme() {
    style.setColors(cssVar("--foreground"), cssVar("--cream"));
    kick();
  }
  applyTheme();

  return {
    setProgress(np) {
      if (np !== p) {
        p = np;
        kick();
      }
    },
    setScreen(st) {
      drawDial(dctx, st, font);
      tex.needsUpdate = true;
      kick();
    },
    applyTheme,
    screenPoint,
    dispose() {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      disposeTree(shade.asm);
      // The line copy shares geometry with nothing else but its materials are the line style's.
      line.asm.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
      style.dispose();
      screenMat.dispose();
      tex.dispose();
      envRT.dispose();
      rLine.dispose();
      rShade.dispose();
    },
  };
}
