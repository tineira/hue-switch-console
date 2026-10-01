import * as THREE from "three";
import {
  DIAL_SIZE,
  MM,
  applyLineStyle,
  buildDisplay,
  buildXiao,
  cssVar,
  disposeTree,
  drawDial,
  lineStyle,
  monoFont,
} from "@/app/landing/round-model";

// Still line drawings for the landing's "What you need" cards: a Hue Bridge, Hue bulbs, and the
// two boards. Same line style as the Simple card: render once into an image, then dispose the
// renderer so no WebGL context stays open. Models are built in mm, like round-model.ts.

export type Point = [number, number];
export type NeedStill = { src: string; w: number; h: number; points: Record<string, Point> };
export type NeedKind = "bridge" | "lights" | "xiao" | "round";

type Model = {
  root: THREE.Object3D;
  /** Camera direction, from the model toward the camera. */
  dir: THREE.Vector3;
  /** Model-local points (mm) to project for the overlay. */
  marks?: Record<string, [number, number, number]>;
  /** Called after the line style is applied, for parts that keep their own material. */
  after?: () => void;
  dispose?: () => void;
};

const plain = () => new THREE.MeshBasicMaterial();

function group(name: string) {
  const root = new THREE.Group();
  root.name = name;
  root.scale.setScalar(MM);
  const add = (geo: THREE.BufferGeometry, x = 0, y = 0, z = 0, parent: THREE.Object3D = root) => {
    const m = new THREE.Mesh(geo, plain());
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  return { root, add };
}

function roundedSquare(s: number, r: number) {
  const sh = new THREE.Shape(), h = s / 2;
  sh.moveTo(-h + r, -h);
  sh.lineTo(h - r, -h);
  sh.absarc(h - r, -h + r, r, -Math.PI / 2, 0, false);
  sh.lineTo(h, h - r);
  sh.absarc(h - r, h - r, r, 0, Math.PI / 2, false);
  sh.lineTo(-h + r, h);
  sh.absarc(-h + r, h - r, r, Math.PI / 2, Math.PI, false);
  sh.lineTo(-h, -h + r);
  sh.absarc(-h + r, -h + r, r, Math.PI, Math.PI * 1.5, false);
  return sh;
}

// Hue Bridge: an 88 mm rounded square with soft edges, the round link button in the middle of
// the top, three status lights by the front edge, and the Ethernet and power ports at the back.
// No logo.
function bridge(): Model {
  const S = 88, H = 24, B = 4;
  const { root, add } = group("Hue_Bridge");
  const body = new THREE.ExtrudeGeometry(roundedSquare(S - 2 * B, 20), {
    depth: H - 2 * B,
    bevelEnabled: true,
    bevelThickness: B,
    bevelSize: B,
    bevelSegments: 8,
    curveSegments: 32,
  });
  // Shape (x, y) → world (x, z); the extrusion runs up from y = 0.
  body.rotateX(-Math.PI / 2);
  body.translate(0, B, 0);
  add(body);
  add(new THREE.CylinderGeometry(21, 21, 0.4, 96), 0, H - 0.1, 0);
  add(new THREE.CylinderGeometry(16.5, 17, 1.6, 96), 0, H + 0.6, 0);
  for (const x of [-7, 0, 7]) add(new THREE.CylinderGeometry(1.4, 1.4, 0.3, 24), x, H + 0.05, 34);
  // Back face is z = −S/2: an RJ45 socket and a round power jack.
  add(new THREE.BoxGeometry(16, 13, 1.2), -12, 11, -S / 2 + 0.3);
  add(new THREE.BoxGeometry(11, 6, 0.4), -12, 13, -S / 2 - 0.3);
  add(new THREE.CylinderGeometry(4.5, 4.5, 1.2, 32).rotateX(Math.PI / 2), 16, 11, -S / 2 + 0.3);
  add(new THREE.CylinderGeometry(1.4, 1.4, 1.4, 24).rotateX(Math.PI / 2), 16, 11, -S / 2 - 0.1);
  return {
    root,
    dir: new THREE.Vector3(-0.9, 1.15, -1.1),
    marks: { button: [6, H + 1.4, -12], ethernet: [-12, 13, -S / 2 - 0.5], center: [0, H / 2, 0] },
  };
}

// A60 bulb, E27 base: 60 mm globe, white collar, threaded cap.
function bulbGeometries() {
  // Glass: the neck (r 17.5 at y 44) flares into a sphere of r 30 centred at y 78, joining it 40°
  // below the equator.
  const cy = 78, R = 30, j = (-40 * Math.PI) / 180, jy = cy + R * Math.sin(j), jr = R * Math.cos(j);
  const globe: THREE.Vector2[] = [new THREE.Vector2(0.01, 44)];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    globe.push(new THREE.Vector2(17.5 + (jr - 17.5) * Math.sin((t * Math.PI) / 2), 44 + (jy - 44) * t));
  }
  for (let a = j + 0.06; a < Math.PI / 2; a += 0.06) globe.push(new THREE.Vector2(R * Math.cos(a), cy + R * Math.sin(a)));
  globe.push(new THREE.Vector2(0.01, cy + R));

  const collar = [
    new THREE.Vector2(13.5, 26),
    new THREE.Vector2(15, 27),
    new THREE.Vector2(17.5, 36),
    new THREE.Vector2(17.5, 44),
  ];
  const cap: THREE.Vector2[] = [new THREE.Vector2(0.01, 0), new THREE.Vector2(4, 0), new THREE.Vector2(5, 2), new THREE.Vector2(10, 3)];
  for (let y = 4; y < 26; y += 2.8) cap.push(new THREE.Vector2(13.4, y), new THREE.Vector2(12.4, y + 1.4));
  cap.push(new THREE.Vector2(13.5, 26));
  return {
    globe: new THREE.LatheGeometry(globe, 72),
    collar: new THREE.LatheGeometry(collar, 72),
    cap: new THREE.LatheGeometry(cap, 72),
  };
}

function lights(): Model {
  const { root, add } = group("Hue_Bulbs");
  const geo = bulbGeometries();
  const at: [number, number][] = [[-70, 10], [0, -8], [70, 10]];
  const marks: Record<string, [number, number, number]> = {};
  at.forEach(([x, z], i) => {
    const b = new THREE.Group();
    b.position.set(x, 0, z);
    root.add(b);
    add(geo.globe, 0, 0, 0, b);
    add(geo.collar, 0, 0, 0, b);
    add(geo.cap, 0, 0, 0, b);
    marks[`bulb${i}`] = [x, 78, z];
  });
  return { root, dir: new THREE.Vector3(0.35, 0.55, 1), marks };
}

function xiao(): Model {
  const root = new THREE.Group();
  const board = buildXiao();
  root.add(board);
  return { root, dir: new THREE.Vector3(0.8, 2.2, -1) };
}

// The Round Display on its own, screen up, showing the Living page.
function round(): Model {
  const dial = document.createElement("canvas");
  dial.width = dial.height = DIAL_SIZE;
  drawDial(dial.getContext("2d")!, { page: 0, on: true, level: 72, scene: 0 }, monoFont());
  const tex = new THREE.CanvasTexture(dial);
  tex.colorSpace = THREE.SRGBColorSpace;
  const screenMat = new THREE.MeshBasicMaterial({ map: tex });
  const { root, screen } = buildDisplay(plain());
  return {
    root,
    dir: new THREE.Vector3(-0.55, 1.5, 1),
    after: () => {
      screen.material = screenMat;
    },
    dispose: () => {
      screenMat.dispose();
      tex.dispose();
    },
  };
}

const MODELS: Record<NeedKind, () => Model> = { bridge, lights, xiao, round };

/** Loads the font the Round's dial uses; call before rendering `round`. */
export async function loadDialFont() {
  const font = monoFont();
  await Promise.all([`400 110px ${font}`].map((f) => document.fonts.load(f).catch(() => [])));
}

/** Renders one model to a transparent PNG of w × h, fitted with `pad` (fraction of the frame) round it. */
export function renderNeed(kind: NeedKind, w: number, h: number, fill: string, pad = 0.14): NeedStill {
  const model = MODELS[kind]();
  const style = lineStyle();
  applyLineStyle(model.root, style);
  model.after?.();
  style.setColors(cssVar("--foreground"), cssVar(fill));
  style.setResolution(w, h);
  const scene = new THREE.Scene();
  scene.add(model.root);
  model.root.updateMatrixWorld(true);

  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.001, 2);
  const bb = new THREE.Box3().setFromObject(model.root), ctr = bb.getCenter(new THREE.Vector3());
  cam.position.copy(ctr).addScaledVector(model.dir.normalize(), 0.5);
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
  let hw = (x1 - x0) / 2 / (1 - 2 * pad), hv = (y1 - y0) / 2 / (1 - 2 * pad);
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
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h, false);
  renderer.render(scene, cam);
  // Same task as render(), so the drawing buffer has not been cleared yet.
  const src = canvas.toDataURL("image/png");

  const points: Record<string, Point> = {};
  for (const [k, [x, y, z]] of Object.entries(model.marks ?? {})) {
    const v = model.root.localToWorld(new THREE.Vector3(x, y, z)).project(cam);
    points[k] = [((v.x + 1) / 2) * w, ((1 - v.y) / 2) * h];
  }

  model.dispose?.();
  disposeTree(model.root);
  style.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
  return { src, w, h, points };
}
