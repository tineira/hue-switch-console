import * as THREE from "three";
import { MM, applyLineStyle, buildHeaders, buildXiao, cssVar, disposeTree, lineStyle } from "@/app/landing/round-model";

// One still line drawing of the XIAO for the Simple card: render once into an image, work out
// the overlay from the same camera, then dispose the renderer. No live WebGL context stays open.

export type SimpleDrawing = { src: string; overlay: string };

const PAD_Z = [7.62, 5.08, 2.54, 0, -2.54, -5.08];
const T = 1.25; // board top, XIAO-local mm

export function renderSimpleDrawing(w: number, h: number): SimpleDrawing {
  const grp = new THREE.Group();
  const board = buildXiao();
  const headers = buildHeaders();
  headers.rotation.x = Math.PI;
  headers.position.set(0, 3 * MM, 0);
  grp.add(board, headers);
  const style = lineStyle();
  applyLineStyle(grp, style);
  style.setColors(cssVar("--foreground"), cssVar("--cream"));
  style.setResolution(w, h);
  const scene = new THREE.Scene();
  scene.add(grp);
  grp.updateMatrixWorld(true);

  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.001, 2);
  const bb = new THREE.Box3().setFromObject(grp), ctr = bb.getCenter(new THREE.Vector3());
  cam.position.copy(ctr).addScaledVector(new THREE.Vector3(0.8, 2.2, -1).normalize(), 0.5);
  cam.lookAt(ctr);
  cam.updateMatrixWorld();
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const x of [bb.min.x, bb.max.x])
    for (const y of [bb.min.y, bb.max.y])
      for (const z of [bb.min.z, bb.max.z]) {
        const v = new THREE.Vector3(x, y, z).applyMatrix4(cam.matrixWorldInverse);
        x0 = Math.min(x0, v.x);
        x1 = Math.max(x1, v.x);
        y0 = Math.min(y0, v.y);
        y1 = Math.max(y1, v.y);
      }
  const a = w / h;
  let hw = ((x1 - x0) / 2) * 2.25, hv = ((y1 - y0) / 2) * 1.5;
  if (hw / hv > a) hv = hw / a;
  else hw = hv * a;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  cam.left = cx - hw;
  cam.right = cx + hw;
  cam.top = cy + hv;
  cam.bottom = cy - hv;
  cam.updateProjectionMatrix();

  const canvas = document.createElement("canvas");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h, false);
  renderer.render(scene, cam);
  // Same task as render(), so the drawing buffer has not been cleared yet.
  const src = canvas.toDataURL("image/png");

  const overlay = drawOverlay(board, cam, w, h);

  disposeTree(board);
  headers.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
  style.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  return { src, overlay };
}

function drawOverlay(board: THREE.Object3D, cam: THREE.Camera, w: number, h: number): string {
  const px = (x: number, y: number, z: number): [number, number] => {
    const v = board.localToWorld(new THREE.Vector3(x, y, z)).project(cam);
    return [((v.x + 1) / 2) * w, ((1 - v.y) / 2) * h];
  };
  const fg = "var(--foreground)";
  const L = (p: number[], q: number[]) =>
    `<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" stroke="${fg}" stroke-width="1"/>`;
  const dot = (p: number[]) => `<circle cx="${p[0]}" cy="${p[1]}" r="2" fill="${fg}"/>`;
  const txt = (x: number, y: number, s: string, anchor: string) =>
    `<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="middle" fill="${fg}">${s}</text>`;

  // USB-C: its curved sides have no crease edges, so trace its silhouette (convex hull).
  let usb: THREE.Mesh | null = null;
  board.traverse((o) => {
    if (o.name === "usb_c") usb = o as THREE.Mesh;
  });
  const pts: [number, number][] = [];
  if (usb) {
    const m = usb as THREE.Mesh, pos = m.geometry.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      m.localToWorld(v);
      const q = v.project(cam);
      pts.push([((q.x + 1) / 2) * w, ((1 - q.y) / 2) * h]);
    }
  }
  let out = `<polygon points="${hull(pts).map((p) => p.join(",")).join(" ")}" fill="none" stroke="${fg}" stroke-width="1.5" stroke-linejoin="round"/>`;

  const pads = PAD_Z.map((z) => px(7.62, T, z));
  const boot = px(-5.2, T + 0.5, 8.9), led = px(-5.3, T + 1.2, 4.8);
  out += pads.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="3.2" fill="var(--filament)"/>`).join("");
  out += `<circle cx="${led[0]}" cy="${led[1]}" r="3.5" fill="#ff8a1f" style="filter:drop-shadow(0 0 4px rgb(255 138 31 / .8))"/>`;

  // Two label columns just outside the board; each label sits on a short shelf, then one
  // straight leader to its part.
  const edge = [[8.9, 10.5], [-8.9, 10.5], [8.9, -10.5], [-8.9, -10.5]].flatMap(([x, z]) => [px(x, T, z), px(x, -3, z)]);
  const bx0 = Math.min(...edge.map((q) => q[0])), bx1 = Math.max(...edge.map((q) => q[0]));
  const by0 = Math.min(...edge.map((q) => q[1]));
  const LX = Math.max(96, bx0 - 20), RX = Math.min(w - 104, bx1 + 20), SH = 18;
  const call = (side: number, y: number, anchor: number[], s: string) => {
    const x = side < 0 ? LX : RX, k = [x - side * (6 + SH), y];
    out += L([side < 0 ? x + 6 : x - 6, y], k) + L(k, anchor) + dot(anchor) + txt(x, y, s, side < 0 ? "end" : "start");
  };
  const mid = [(pads[2][0] + pads[3][0]) / 2, (pads[2][1] + pads[3][1]) / 2];
  const yTop = by0 + 8;
  call(-1, Math.max(mid[1], yTop + 34), mid, "D0–D5 · 1–6");
  call(1, yTop - 14, boot, "BOOT · 7");
  call(1, yTop + 12, led, "Status LED");

  // Part balloon "1", same style as the Round card, with a leader to the metal cover.
  const an = px(1.5, T + 1.9, -1.0), bx = RX + 14, by = yTop + 62, d = Math.hypot(bx - an[0], by - an[1]);
  out +=
    L(an, [bx - ((bx - an[0]) / d) * 14, by - ((by - an[1]) / d) * 14]) +
    dot(an) +
    `<circle cx="${bx}" cy="${by}" r="13.25" fill="var(--cream)" stroke="${fg}" stroke-width="1.5"/>` +
    `<text x="${bx}" y="${by + 0.5}" text-anchor="middle" dominant-baseline="middle" font-size="13" font-weight="500" fill="${fg}">1</text>`;
  return out;
}

function hull(P: [number, number][]): [number, number][] {
  if (P.length < 3) return P;
  const s = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: [number, number][] = [], up: [number, number][] = [];
  for (const p of s) {
    while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop();
    lo.push(p);
  }
  for (const p of s.reverse()) {
    while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop();
    up.push(p);
  }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
