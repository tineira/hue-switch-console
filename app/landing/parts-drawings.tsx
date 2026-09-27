import { Fragment, type CSSProperties, type ReactNode } from "react";
import { DrawingScale } from "@/app/landing/drawing-scale";

// Isometric part drawings for "What you need", on a 520×440 canvas. Each part is a slab:
// copies of its shape stacked in Z (sides in `line`, the lowest with a `muted` edge) under a
// top face. To place a 2D label over a local point (x, y, z), relative to the stage centre:
//   sx = 0.7071·x + 0.7071·y
//   sy = (−0.7071·x + 0.7071·y)·cos55° − z·sin55°

const ISO = "rotateX(55deg) rotateZ(-45deg)";

type SlabProps = {
  w: number;
  h: number;
  radius: number | string;
  x?: number;
  y?: number;
  /** Bottom and top of the slab in Z. */
  z: [number, number];
  step?: number;
  side?: string;
  edge?: string;
  top?: string;
  topBorder?: string;
  children?: ReactNode;
};

function Slab({
  w,
  h,
  radius,
  x = 0,
  y = 0,
  z: [z0, z1],
  step = 1.5,
  side = "var(--line)",
  edge = "1px solid var(--muted)",
  top = "var(--cream)",
  topBorder = "1.5px solid var(--foreground)",
  children,
}: SlabProps) {
  const zs: number[] = [];
  for (let z = z0; z < z1 - 1e-6; z += step) zs.push(z);
  zs.push(z1);
  const base = (z: number): CSSProperties => ({
    position: "absolute",
    left: 0,
    top: 0,
    width: w,
    height: h,
    boxSizing: "border-box",
    borderRadius: radius,
    transform: `translate(-50%, -50%) translate(${x}px, ${y}px) translateZ(${z}px)`,
  });
  return (
    <>
      {zs.map((z, i) =>
        i === zs.length - 1 ? (
          <div key={z} style={{ ...base(z), background: top, border: topBorder }}>
            {children}
          </div>
        ) : (
          <div key={z} style={{ ...base(z), background: side, border: i === 0 ? edge : undefined }} />
        ),
      )}
    </>
  );
}

function Stage({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <div className="absolute h-0 w-0" style={{ left: x, top: y, transformStyle: "preserve-3d", transform: ISO }}>
      {children}
    </div>
  );
}

function Abs({ style, children, className }: { style: CSSProperties; children?: ReactNode; className?: string }) {
  return (
    <div className={`absolute ${className ?? ""}`} style={style}>
      {children}
    </div>
  );
}

function Balloon({ top, n }: { top: number; n: number }) {
  return (
    <Abs
      className="box-border flex items-center justify-center rounded-full border-[1.5px] border-foreground bg-cream text-[13px]"
      style={{ left: 438, top, width: 28, height: 28 }}
    >
      {n}
    </Abs>
  );
}

const PAD: CSSProperties = {
  display: "block",
  width: 8,
  height: 8,
  borderRadius: "50%",
  boxSizing: "border-box",
  background: "var(--filament-soft)",
  border: "1px solid var(--muted)",
};

function PadRow({ edge }: { edge: "top" | "bottom" }) {
  return (
    <div className="absolute flex justify-between" style={{ left: 18, right: 18, [edge]: 5 }}>
      {Array.from({ length: 7 }, (_, i) => (
        <i key={i} style={PAD} />
      ))}
    </div>
  );
}

export function RoundDrawing() {
  return (
    <DrawingScale>
      <Stage x={200} y={230}>
        {/* 3. Antenna */}
        <Slab w={110} h={36} radius={4} z={[-112, -110]}>
          <Abs style={{ inset: 7, border: "1px solid var(--muted)", borderRadius: 2 }} />
          <Abs style={{ left: 14, right: 40, top: 16, borderTop: "1px solid var(--muted)" }} />
        </Slab>
        {/* 2. XIAO ESP32-S3 */}
        <Slab w={126} h={107} radius={8} z={[-4.5, 0]}>
          <PadRow edge="top" />
          <PadRow edge="bottom" />
          <Abs style={{ left: 14, top: 24, width: 10, height: 8, border: "1px solid var(--foreground)", borderRadius: 2 }} />
          <Abs style={{ left: 14, top: 75, width: 10, height: 8, border: "1px solid var(--foreground)", borderRadius: 2 }} />
          <Abs style={{ left: 28, top: 50, width: 5, height: 5, borderRadius: "50%", background: "var(--filament)" }} />
        </Slab>
        <Slab w={58} h={52} radius={3} x={6} z={[2, 8]}>
          <Abs
            className="inset-0 flex items-center justify-center text-muted"
            style={{ fontSize: 9, letterSpacing: "0.1em" }}
          >
            XIAO
          </Abs>
        </Slab>
        <Slab w={18} h={34} radius={6} x={-62} z={[1.5, 9]} topBorder="1.5px solid var(--filament)" />
        <Slab w={10} h={10} radius="50%" x={48} y={-26} z={[1, 4]} />
        {/* 1. Display board, parts on its underside drawn dashed */}
        <Slab w={234} h={234} radius="50%" z={[95.5, 100]}>
          {[
            { left: 62, top: 66, width: 110, height: 12 },
            { left: 62, top: 156, width: 110, height: 12 },
            { left: 186, top: 94, width: 30, height: 46 },
            { left: 24, top: 106, width: 16, height: 22 },
          ].map((b) => (
            <Abs key={`${b.left}-${b.top}`} style={{ ...b, border: "1px dashed var(--muted)", borderRadius: 2 }} />
          ))}
          <Abs style={{ left: 84, top: 102, width: 16, height: 12, border: "1px solid var(--foreground)", borderRadius: 1 }} />
          <Abs style={{ left: 128, top: 112, width: 12, height: 12, border: "1px solid var(--foreground)", borderRadius: 1 }} />
          <Abs style={{ left: 110, top: 130, width: 8, height: 6, background: "var(--muted)", borderRadius: 1 }} />
        </Slab>
        {/* 1. Glass with the brightness ring */}
        <Slab w={234} h={234} radius="50%" z={[142.5, 150]}>
          <Abs
            className="rounded-full"
            style={{
              inset: 14,
              background: "radial-gradient(circle at 35% 30%, var(--cream), var(--background) 75%)",
              border: "1px solid var(--muted)",
            }}
          />
          <Abs
            className="rounded-full"
            style={{
              inset: 40,
              background:
                "conic-gradient(from 225deg, var(--filament) 0 170deg, var(--muted) 170deg 270deg, transparent 270deg)",
              WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 9px), #000 calc(100% - 8px))",
              mask: "radial-gradient(farthest-side, transparent calc(100% - 9px), #000 calc(100% - 8px))",
            }}
          />
          <Abs
            className="rounded-full"
            style={{ inset: 60, background: "var(--filament-soft)", border: "1px solid var(--filament)" }}
          />
        </Slab>
      </Stage>
      <svg className="absolute left-0 top-0 overflow-visible" width="520" height="440" aria-hidden="true">
        <path d="M167 339 C 150 300, 240 250, 215 200" fill="none" stroke="var(--muted)" strokeWidth="1.5" />
      </svg>
      <Abs style={{ left: 200, top: 107, height: 213, borderLeft: "1px dashed var(--muted)" }} />
      <Abs style={{ left: 83, top: 14, height: 93, borderLeft: "1px solid var(--muted)", opacity: 0.6 }} />
      <Abs style={{ left: 317, top: 14, height: 93, borderLeft: "1px solid var(--muted)", opacity: 0.6 }} />
      <Abs style={{ left: 83, top: 20, width: 234, borderTop: "1px solid var(--muted)" }} />
      <Abs className="bg-cream px-1.5 text-xs leading-[18px]" style={{ left: 176, top: 11 }}>
        Ø 39
      </Abs>
      <Abs className="text-right text-[11px] leading-4 text-muted" style={{ left: 0, top: 132, width: 74 }}>
        sockets
        <br />
        below
      </Abs>
      <Abs style={{ left: 78, top: 148, width: 12, borderTop: "1px solid var(--muted)" }} />
      <Abs style={{ left: 325, top: 107, width: 113, borderTop: "1px solid var(--foreground)" }} />
      <Abs style={{ left: 290, top: 230, width: 148, borderTop: "1px solid var(--foreground)" }} />
      <Abs style={{ left: 262, top: 320, width: 176, borderTop: "1px solid var(--foreground)" }} />
      <Balloon top={93} n={1} />
      <Balloon top={216} n={2} />
      <Balloon top={306} n={3} />
    </DrawingScale>
  );
}

// Pad centres down each long edge of the C6, top to bottom. D0, D1 and D2 are the first three
// on the left, as in the hue-simple-switch README.
const C6_PAD_TOPS = [20, 40, 61, 81, 101, 122, 142];
const PIN_YS = Array.from({ length: 7 }, (_, i) => -59 + i * 20.3);

export function SimpleDrawing() {
  const pin = { side: "var(--muted)", top: "var(--muted)", edge: "0", topBorder: "0", step: 2 };
  const header = { side: "var(--foreground)", top: "var(--foreground)", edge: "0", topBorder: "0", step: 2 };
  const leader = (x1: number, y1: number, x2: number, y2: number, dot: [number, number] | null, muted = false) => (
    <g key={`${x1}-${y1}`}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={muted ? "var(--muted)" : "var(--foreground)"} strokeWidth="1" />
      {dot ? <circle cx={dot[0]} cy={dot[1]} r="2" fill="var(--foreground)" /> : null}
    </g>
  );
  return (
    <DrawingScale>
      <div className="absolute inset-0 text-xs leading-4">
        <Stage x={260} y={215}>
          {/* Pin headers underneath. No wrapper elements inside a stage: they would flatten the 3D. */}
          {[-60, 60].map((x) => (
            <Fragment key={x}>
              {PIN_YS.map((y) => (
                <Slab key={y} w={3} h={3} radius={1} x={x} y={y} z={[-32, -12]} {...pin} />
              ))}
              <Slab w={12} h={146} radius={2} x={x} y={2} z={[-12, -4]} {...header} />
            </Fragment>
          ))}
          {/* XIAO ESP32-C6 */}
          <Slab w={140} h={168} radius={10} z={[-4.5, 0]}>
            {C6_PAD_TOPS.flatMap((top, i) =>
              [5, 125].map((left) => {
                const signal = left === 5 && i < 3;
                return (
                  <i
                    key={`${left}-${top}`}
                    className="absolute box-border rounded-full"
                    style={{
                      left,
                      top,
                      width: 10,
                      height: 10,
                      background: signal ? "var(--filament)" : "var(--filament-soft)",
                      border: signal ? undefined : "1px solid var(--muted)",
                    }}
                  />
                );
              }),
            )}
          </Slab>
          <Slab w={84} h={76} radius={3} y={16} z={[2, 8]}>
            <Abs
              className="inset-0 flex items-center justify-center text-muted"
              style={{ fontSize: 10, letterSpacing: "0.12em" }}
            >
              XIAO
            </Abs>
          </Slab>
          <Slab w={36} h={16} radius={6} y={-84} z={[1.5, 9]} topBorder="1.5px solid var(--filament)" />
          <Slab w={18} h={12} radius={3} x={-37} y={-62} z={[1, 4]} />
          <div
            className="absolute left-0 top-0 h-[9px] w-[9px] rounded-full"
            style={{
              background: "#ff8a1f",
              boxShadow: "0 0 8px 2px rgb(255 138 31 / 60%)",
              transform: "translate(-50%, -50%) translate(35px, -64px) translateZ(1px)",
            }}
          />
        </Stage>
        <svg className="absolute left-0 top-0 overflow-visible" width="520" height="440" aria-hidden="true">
          {leader(126, 130, 190, 202, [190, 202])}
          {leader(126, 170, 176, 215, [176, 215])}
          {leader(126, 196, 190, 223, [190, 223])}
          {leader(126, 222, 205, 231, [205, 231])}
          {leader(239, 174, 400, 140, [239, 174])}
          {leader(280, 301, 379, 245, null, true)}
          {leader(270, 277, 282, 307, null, true)}
          {leader(369, 221, 381, 251, null, true)}
          {leader(135, 235, 254, 303, null, true)}
          {leader(151, 209, 131, 241, null, true)}
        </svg>
        {[
          { top: 122, text: "BOOT button" },
          { top: 162, text: "D0 · switch 1" },
          { top: 188, text: "D1 · switch 2" },
          { top: 214, text: "D2 · switch 3" },
        ].map((l) => (
          <Abs key={l.text} className="text-right" style={{ left: 0, top: l.top, width: 120 }}>
            {l.text}
          </Abs>
        ))}
        <Abs style={{ left: 406, top: 132 }}>LED</Abs>
        <Abs className="text-muted" style={{ left: 336, top: 275 }}>
          17.5
        </Abs>
        <Abs className="text-muted" style={{ left: 165, top: 271 }}>
          21
        </Abs>
      </div>
    </DrawingScale>
  );
}
