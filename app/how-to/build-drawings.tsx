import type { ReactNode } from "react";
import type { WireStep } from "@/lib/how-to-build";

// Line drawings for the Build part of /how-to. Plain SVG in the theme's colours, so they
// follow every theme and print. The XIAO ESP32-C6 is drawn from the component side with
// USB-C at the top: D0–D6 down the left edge, 5V, GND, 3V3, D10–D7 down the right.

const FG = "var(--foreground)";
const MUTED = "var(--muted)";
const HOT = "var(--filament)";
const LINE = "var(--line)";

const LEFT = ["D0", "D1", "D2", "D3", "D4", "D5", "D6"];
const RIGHT = ["5V", "GND", "3V3", "D10", "D9", "D8", "D7"];
const BOARD_W = 84;
const BOARD_H = 100;
const PITCH = 11;
const FIRST = 20;

function Frame({ w, h, label, children }: { w: number; h: number; label: string; children: ReactNode }) {
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={label}
      className="h-auto w-full font-mono"
    >
      {children}
    </svg>
  );
}

// Pad centre on the board edge, in drawing coordinates.
function pad(x: number, y: number, name: string): [number, number] {
  const l = LEFT.indexOf(name);
  if (l >= 0) return [x, y + FIRST + l * PITCH];
  const r = RIGHT.indexOf(name);
  return [x + BOARD_W, y + FIRST + r * PITCH];
}

function Xiao({
  x,
  y,
  hot = [],
  boot = false,
  labels = true,
}: {
  x: number;
  y: number;
  hot?: string[];
  boot?: boolean;
  labels?: boolean;
}) {
  return (
    <g>
      <rect x={x + BOARD_W / 2 - 16} y={y - 9} width={32} height={14} rx={4} fill="var(--cream)" stroke={FG} strokeWidth={1.2} />
      <rect x={x} y={y} width={BOARD_W} height={BOARD_H} rx={7} fill="var(--cream)" stroke={FG} strokeWidth={1.5} />
      <rect x={x + 24} y={y + 38} width={36} height={32} rx={2} fill="none" stroke={MUTED} strokeWidth={1} />
      <text x={x + BOARD_W / 2} y={y + 58} textAnchor="middle" fontSize={7} fill={MUTED} letterSpacing="0.08em">
        C6
      </text>
      {/* BOOT (B) and RESET (R) either side of the USB-C port. */}
      <rect x={x + 10} y={y + 6} width={10} height={8} rx={1.5} fill={boot ? HOT : "none"} stroke={boot ? HOT : MUTED} />
      <rect x={x + BOARD_W - 20} y={y + 6} width={10} height={8} rx={1.5} fill="none" stroke={MUTED} />
      {LEFT.map((name) => {
        const [px, py] = pad(x, y, name);
        const on = hot.includes(name);
        return (
          <g key={name}>
            <circle cx={px} cy={py} r={4} fill={on ? HOT : "var(--filament-soft)"} stroke={on ? HOT : MUTED} />
            {labels ? (
              <text x={px + 8} y={py + 3} fontSize={7.5} fill={on ? FG : MUTED} fontWeight={on ? 700 : 400}>
                {name}
              </text>
            ) : null}
          </g>
        );
      })}
      {RIGHT.map((name) => {
        const [px, py] = pad(x, y, name);
        const on = hot.includes(name);
        return (
          <g key={name}>
            <circle cx={px} cy={py} r={4} fill={on ? HOT : "var(--filament-soft)"} stroke={on ? HOT : MUTED} />
            {labels ? (
              <text x={px - 8} y={py + 3} fontSize={7.5} textAnchor="end" fill={on ? FG : MUTED} fontWeight={on ? 700 : 400}>
                {name}
              </text>
            ) : null}
          </g>
        );
      })}
    </g>
  );
}

// A plain contact, terminals at (x, y) and (x + 40, y).
function Contact({ x, y, closed = false, label }: { x: number; y: number; closed?: boolean; label?: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={3} fill="var(--cream)" stroke={FG} strokeWidth={1.3} />
      <circle cx={x + 40} cy={y} r={3} fill="var(--cream)" stroke={FG} strokeWidth={1.3} />
      <line
        x1={x + 3}
        y1={y}
        x2={closed ? x + 37 : x + 34}
        y2={closed ? y : y - 13}
        stroke={closed ? HOT : FG}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      {label ? (
        <text x={x + 20} y={y + 15} textAnchor="middle" fontSize={8} fill={MUTED}>
          {label}
        </text>
      ) : null}
    </g>
  );
}

function Bulb({ x, y, lit }: { x: number; y: number; lit: boolean }) {
  return (
    <g>
      {lit
        ? [0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
            const r = (a * Math.PI) / 180;
            return (
              <line
                key={a}
                x1={x + Math.cos(r) * 17}
                y1={y + Math.sin(r) * 17}
                x2={x + Math.cos(r) * 23}
                y2={y + Math.sin(r) * 23}
                stroke={HOT}
                strokeWidth={1.5}
                strokeLinecap="round"
              />
            );
          })
        : null}
      <circle cx={x} cy={y} r={12} fill={lit ? "var(--filament-soft)" : "none"} stroke={lit ? HOT : MUTED} strokeWidth={1.5} />
      <path d={`M${x - 5} ${y + 12} v6 h10 v-6`} fill="none" stroke={lit ? HOT : MUTED} strokeWidth={1.5} />
    </g>
  );
}

function Wire({ d, hot = false, dashed = false }: { d: string; hot?: boolean; dashed?: boolean }) {
  return (
    <path
      d={d}
      fill="none"
      stroke={hot ? HOT : FG}
      strokeWidth={1.6}
      strokeLinejoin="round"
      strokeDasharray={dashed ? "5 4" : undefined}
    />
  );
}

function Note({ x, y, children, anchor = "start", tone = MUTED }: { x: number; y: number; children: ReactNode; anchor?: "start" | "middle" | "end"; tone?: string }) {
  return (
    <text x={x} y={y} fontSize={9} fill={tone} textAnchor={anchor}>
      {children}
    </text>
  );
}

// Board at (60, 40); one switch below it between D0 and GND.
function OneSwitch({ closed, lamp, withSwitch }: { closed: boolean; lamp: boolean | null; withSwitch: boolean }) {
  const [dx, dy] = pad(60, 40, "D0");
  const [gx, gy] = pad(60, 40, "GND");
  return (
    <>
      <Xiao x={60} y={40} hot={["D0", "GND"]} />
      <Wire d={`M${dx} ${dy} H30 V180 H${withSwitch ? 150 : 110}`} hot />
      <Wire d={`M${gx} ${gy} H210 V180 H${withSwitch ? 190 : 230}`} hot />
      {withSwitch ? <Contact x={150} y={180} closed={closed} label="switch or button" /> : (
        <>
          <circle cx={110} cy={180} r={2.5} fill={HOT} />
          <circle cx={230} cy={180} r={2.5} fill={HOT} />
          <Note x={170} y={184} anchor="middle">to the switch</Note>
        </>
      )}
      {lamp !== null ? <Bulb x={270} y={70} lit={lamp} /> : null}
    </>
  );
}

function ConsoleMock() {
  const row = (y: number, k: string, v: string, hot = false) => (
    <g key={k}>
      <text x={48} y={y} fontSize={9} fill={MUTED}>
        {k}
      </text>
      <rect x={130} y={y - 12} width={140} height={18} rx={4} fill="var(--background)" stroke={hot ? HOT : LINE} />
      <text x={138} y={y + 1} fontSize={9} fill={FG}>
        {v}
      </text>
    </g>
  );
  return (
    <>
      <rect x={30} y={24} width={260} height={160} rx={10} fill="var(--cream)" stroke={LINE} />
      <text x={48} y={50} fontSize={11} fill={FG} fontWeight={600}>
        Add a switch
      </text>
      {row(80, "What it is", "Wall switch · Push button")}
      {row(108, "Pin", "D0", true)}
      {row(136, "Room", "Living room")}
      <rect x={184} y={152} width={86} height={20} rx={5} fill={HOT} />
      <text x={227} y={166} fontSize={9} fill="var(--filament-ink)" textAnchor="middle" fontWeight={600}>
        Save changes
      </text>
    </>
  );
}

// Six switches on D0–D5; every second terminal on one GND. Board on the right.
export function WiringAll({ showRc = false }: { showRc?: boolean }) {
  const bx = 220;
  const by = 30;
  const names = ["D0", "D1", "D2", "D3", "D4", "D5"];
  const [gx, gy] = pad(bx, by, "GND");
  return (
    <Frame w={340} h={220} label="Six switches wired to D0 to D5 on the XIAO, the other terminal of each joined to GND">
      <Xiao x={bx} y={by} hot={[...names, "GND"]} labels />
      {names.map((n, i) => {
        const [px, py] = pad(bx, by, n);
        const sy = 36 + i * 26;
        return (
          <g key={n}>
            <Wire d={`M${px} ${py} C ${px - 40} ${py}, 150 ${sy}, 120 ${sy}`} />
            <Contact x={80} y={sy} />
            <Wire d={`M80 ${sy} H40`} />
            <text x={100} y={sy + 13} fontSize={7.5} fill={MUTED} textAnchor="middle">
              {`SW${i + 1}`}
            </text>
          </g>
        );
      })}
      <Wire d={`M40 36 V200 H326 V${gy} H${gx}`} hot />
      <Note x={48} y={214}>GND: the other terminal of every switch</Note>
      {showRc ? <Note x={236} y={160}>+ 10k / 1k / 10nF per input</Note> : null}
    </Frame>
  );
}

// One input with the long-wire parts, at the board end.
export function InputRc() {
  return (
    <Frame w={340} h={200} label="One input with a 10 kΩ pull-up to 3V3, a 1 kΩ series resistor and a 10 nF capacitor to GND">
      {/* 3V3 rail and the pull-up */}
      <Note x={40} y={26} tone={FG}>3V3</Note>
      <Wire d="M60 22 H80 V44" />
      <rect x={74} y={44} width={12} height={30} rx={2} fill="var(--cream)" stroke={HOT} strokeWidth={1.5} />
      <Note x={92} y={63} tone={FG}>10 kΩ</Note>
      <Wire d="M80 74 V100" />
      {/* pin */}
      <circle cx={80} cy={100} r={3} fill={HOT} />
      <Note x={40} y={104} tone={FG}>D0</Note>
      {/* series 1k */}
      <Wire d="M80 100 H116" />
      <rect x={116} y={94} width={30} height={12} rx={2} fill="var(--cream)" stroke={HOT} strokeWidth={1.5} />
      <Note x={131} y={88} anchor="middle" tone={FG}>1 kΩ</Note>
      <Wire d="M146 100 H176" />
      <circle cx={176} cy={100} r={2.5} fill={FG} />
      {/* 10 nF to GND */}
      <Wire d="M176 100 V128" />
      <line x1={164} y1={128} x2={188} y2={128} stroke={HOT} strokeWidth={2} />
      <line x1={164} y1={135} x2={188} y2={135} stroke={HOT} strokeWidth={2} />
      <Note x={194} y={135} tone={FG}>10 nF</Note>
      <Wire d="M176 135 V168" />
      {/* long wire to the switch and back */}
      <Wire d="M176 100 H240" dashed />
      <Contact x={240} y={100} />
      <Wire d="M280 100 H310 V168" dashed />
      <Wire d="M40 168 H310" />
      <Note x={40} y={184} tone={FG}>GND</Note>
      <Note x={258} y={80} anchor="middle">long wire</Note>
      <rect x={30} y={10} width={176} height={176} rx={8} fill="none" stroke={LINE} strokeDasharray="3 3" />
      <Note x={118} y={198} anchor="middle">at the board</Note>
    </Frame>
  );
}

export function WireStepDrawing({ drawing }: { drawing: WireStep["drawing"] }) {
  switch (drawing) {
    case "bare":
      return (
        <Frame w={320} h={200} label="The XIAO on its own, on a USB-C cable to the computer">
          <Xiao x={118} y={60} />
          <Wire d="M160 51 V16" />
          <Note x={170} y={24}>USB-C to the computer</Note>
          <Note x={160} y={186} anchor="middle">Nothing wired yet</Note>
        </Frame>
      );
    case "boot":
      return (
        <Frame w={320} h={200} label="Press the BOOT button on the XIAO and the lights react">
          <Xiao x={90} y={50} boot />
          <Wire d="M105 50 C 100 30, 70 26, 56 26" hot />
          <Note x={20} y={29} tone={FG}>BOOT</Note>
          <Bulb x={260} y={100} lit />
          <Note x={260} y={150} anchor="middle">lights react</Note>
        </Frame>
      );
    case "pads":
      return (
        <Frame w={320} h={200} label="A wire soldered to D0 and one to GND">
          <OneSwitch closed={false} lamp={null} withSwitch={false} />
        </Frame>
      );
    case "switch":
      return (
        <Frame w={320} h={200} label="The two wires go to the two terminals of a switch">
          <OneSwitch closed={false} lamp={null} withSwitch />
        </Frame>
      );
    case "console":
      return (
        <Frame w={320} h={200} label="On Switches, Add a switch: pick what it is, pin D0 and a room, then Save changes">
          <ConsoleMock />
        </Frame>
      );
    case "test":
      return (
        <Frame w={320} h={200} label="Close the switch and the lights react">
          <OneSwitch closed lamp withSwitch />
        </Frame>
      );
    case "all":
      return <WiringAll />;
    case "rc":
      return <InputRc />;
    case "done":
      return (
        <Frame w={320} h={200} label="The board in a box, on a USB-C charger, wires out to the switches">
          <rect x={70} y={40} width={150} height={130} rx={10} fill="none" stroke={FG} strokeWidth={1.5} />
          <Xiao x={103} y={62} labels={false} />
          <Wire d="M145 53 V20 H250" />
          <rect x={250} y={10} width={40} height={24} rx={4} fill="var(--cream)" stroke={FG} strokeWidth={1.3} />
          <Note x={270} y={48} anchor="middle">5 V charger</Note>
          <Wire d="M220 110 H290" />
          <Wire d="M220 124 H290" />
          <Wire d="M220 138 H290" />
          <Note x={255} y={160} anchor="middle">to the switches</Note>
        </Frame>
      );
  }
}

// Before and after converting one wall switch. Left: the switch cuts the lamp's live.
// Right: the lamp is on permanent live, the board takes L and N, the switch wires carry 3.3 V.
export function Conversion() {
  const lamp = (x: number, y: number) => <Bulb x={x} y={y} lit={false} />;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <figure className="flex flex-col gap-2">
        <Frame w={300} h={200} label="Before: live runs through the wall switch to the lamp">
          <Note x={20} y={36} tone={FG}>L</Note>
          <Note x={20} y={176} tone={FG}>N</Note>
          <Wire d="M34 32 H90" />
          <Contact x={90} y={32} closed label="wall switch" />
          <Wire d="M130 32 H240 V78" />
          {lamp(240, 100)}
          <Wire d="M240 124 V172 H34" />
          <Note x={186} y={24}>switched live</Note>
        </Frame>
        <figcaption className="text-xs text-muted">
          <span className="font-medium text-foreground">Before.</span> The switch cuts the lamp&apos;s power. A Hue bulb loses its connection whenever it&apos;s off.
        </figcaption>
      </figure>
      <figure className="flex flex-col gap-2">
        <Frame w={300} h={200} label="After: the lamp is on permanent live; the carrier board takes live and neutral; the switch wires only carry 3.3 volts to the board">
          <Note x={20} y={36} tone={FG}>L</Note>
          <Note x={20} y={176} tone={FG}>N</Note>
          <Wire d="M34 32 H240 V78" />
          {lamp(240, 100)}
          <Wire d="M240 124 V172 H34" />
          <circle cx={70} cy={32} r={2.5} fill={FG} />
          <circle cx={90} cy={172} r={2.5} fill={FG} />
          <Wire d="M70 32 V70" />
          <Wire d="M90 172 V120" />
          <rect x={52} y={70} width={100} height={50} rx={6} fill="var(--cream)" stroke={FG} strokeWidth={1.5} />
          <Note x={102} y={90} anchor="middle" tone={FG}>carrier board</Note>
          <Note x={102} y={104} anchor="middle">L N · D0 GND</Note>
          <Wire d="M152 84 H170 V52 H178" hot />
          <Wire d="M152 106 H228 V52 H218" hot />
          <Contact x={178} y={52} label="" />
          <Note x={140} y={144} tone={HOT}>3.3 V only</Note>
        </Frame>
        <figcaption className="text-xs text-muted">
          <span className="font-medium text-foreground">After.</span> The lamp stays powered and the Bridge switches it. The old switch wires are off mains at both ends and only join the switch to the board.
        </figcaption>
      </figure>
    </div>
  );
}
