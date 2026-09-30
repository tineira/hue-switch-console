"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import { Conversion, InputRc, WireStepDrawing, WiringAll } from "@/app/how-to/build-drawings";
import { Rich } from "@/app/rich-text";
import { RoundDrawing } from "@/app/landing/parts-drawings";
import { PRODUCT_INFO, type Product } from "@/lib/how-to";
import {
  BOX_BUY,
  BOX_STEPS,
  BUILD_ANCHORS,
  HARDWARE_README,
  INPUT_EXPLAINED,
  NEVER,
  RESISTORS,
  ROUND_ASSEMBLE,
  ROUND_BUY,
  SIMPLE_LEVELS,
  TRY_STEPS,
  WALL_INSTALL,
  WALL_REQUIREMENTS,
  buildSummary,
  type BuyItem,
  type Level,
} from "@/lib/how-to-build";

const GROUP_LABEL = "text-[10px] font-medium uppercase tracking-[0.14em] text-muted";
const SELECTED = "border-filament shadow-[0_0_0_1px_var(--filament)]";
const CARD = "rounded-xl border border-line bg-cream";

type LevelId = Level["id"];

// Which Simple level an anchor belongs to.
function levelFor(hash: string): LevelId | null {
  if (hash === "wire" || hash === "resistors") return "box";
  if (hash === "in-wall" || hash === "install") return "wall";
  return null;
}

function currentHash(): string {
  return window.location.hash.slice(1);
}

function isBuildAnchor(hash: string): boolean {
  return (BUILD_ANCHORS as readonly string[]).includes(hash) || hash === "resistors";
}

function Sub({ id, title, lead, children }: { id?: string; title: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <div id={id} className="flex scroll-mt-6 flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold">{title}</h3>
        {lead ? <p className="text-sm text-muted">{lead}</p> : null}
      </div>
      {children}
    </div>
  );
}

function BuyList({ items }: { items: BuyItem[] }) {
  return (
    <ul className={`flex flex-col divide-y divide-line text-sm ${CARD}`}>
      {items.map((item) => (
        <li key={item.name} className="flex flex-col gap-1 px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span className="font-semibold">{item.name}</span>
            <span className="flex flex-wrap items-center gap-2">
              {item.have ? (
                <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">
                  You may have it
                </span>
              ) : null}
              {item.optional ? (
                <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">Optional</span>
              ) : null}
              {item.href ? (
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-filament underline underline-offset-2"
                >
                  seeedstudio.com ↗
                </a>
              ) : null}
            </span>
          </div>
          <p className="text-muted">
            <Rich text={item.why} />
          </p>
        </li>
      ))}
    </ul>
  );
}

// Numbered cards on a rail, like the Set up steps.
function Steps({ children }: { children: ReactNode[] }) {
  return <ol className="flex flex-col">{children}</ol>;
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="grid grid-cols-[24px_minmax(0,1fr)] gap-x-4">
      <div className="flex flex-col items-center">
        <span className="mt-4 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-filament-soft text-xs font-semibold text-filament tabular-nums">
          {n}
        </span>
        <span className="mt-1.5 w-px flex-1 bg-line" />
      </div>
      <div className={`mb-3 flex flex-col gap-3 p-4 text-sm ${CARD}`}>{children}</div>
    </li>
  );
}

function StepText({ title, body, tag }: { title: string; body: string; tag?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-semibold">{title}</span>
        {tag}
      </p>
      <p className="text-muted">
        <Rich text={body} />
      </p>
    </div>
  );
}

function DrawingBox({ children }: { children: ReactNode }) {
  return <div className="@container overflow-hidden rounded-[10px] bg-background p-2">{children}</div>;
}

function RoundBuild() {
  return (
    <>
      <Sub id="buy" title="What to buy">
        <BuyList items={ROUND_BUY} />
      </Sub>
      <Sub id="assemble" title="Put it together" lead="About two minutes. Do it before you plug in USB.">
        <Steps>
          {ROUND_ASSEMBLE.map((step, i) => (
            <Step key={step.title} n={i + 1}>
              <StepText title={step.title} body={step.body} />
              <DrawingBox>
                <RoundDrawing stage={step.stage} />
              </DrawingBox>
            </Step>
          ))}
        </Steps>
      </Sub>
    </>
  );
}

function LevelPicker({ level, onChoose }: { level: LevelId; onChoose: (id: LevelId) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="How you'll build it">
      {SIMPLE_LEVELS.map((item) => {
        const on = item.id === level;
        return (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChoose(item.id)}
            className={`flex touch-manipulation flex-col gap-1.5 rounded-xl border bg-cream p-3.5 text-left text-sm ${
              on ? SELECTED : "border-line"
            }`}
          >
            <span className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-filament-soft text-xs font-semibold text-filament">
                {item.letter}
              </span>
              <span className="font-semibold">{item.name}</span>
            </span>
            <span className="text-muted">{item.needs}</span>
            <span className="text-xs text-muted">{item.who}</span>
          </button>
        );
      })}
    </div>
  );
}

function TryIt() {
  return (
    <Sub title="Try it with BOOT" lead="The quickest way to see the switch work, and the first test for every build.">
      <ol className={`flex flex-col gap-2 p-4 text-sm ${CARD}`}>
        {TRY_STEPS.map((step, i) => (
          <li key={i} className="grid grid-cols-[20px_minmax(0,1fr)] gap-2.5 text-muted">
            <span className="text-xs leading-5 font-semibold text-filament tabular-nums">{i + 1}</span>
            <span>
              <Rich text={step} />
            </span>
          </li>
        ))}
      </ol>
    </Sub>
  );
}

function Never() {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-danger/50 bg-danger-soft p-4 text-sm">
      <p className="font-semibold text-danger">Never</p>
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-muted marker:text-danger">
        {NEVER.map((line) => (
          <li key={line}>
            <Rich text={line} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ButtonBox() {
  return (
    <>
      <Sub id="buy" title="What to buy">
        <BuyList items={BOX_BUY} />
      </Sub>
      <Never />
      <Sub
        id="wire"
        title="Wire it, one input at a time"
        lead="Finish and test each input before you start the next, so a mistake shows up on the first wire, not the sixth."
      >
        <Steps>
          {BOX_STEPS.map((step, i) => (
            <Step key={step.title} n={i + 1}>
              <StepText title={step.title} body={step.body} />
              <DrawingBox>
                <div className="mx-auto max-w-[360px]">
                  <WireStepDrawing drawing={step.drawing} />
                </div>
              </DrawingBox>
            </Step>
          ))}
        </Steps>
      </Sub>
      <Sub title="How an input works">
        <p className="text-sm text-muted">
          <Rich text={INPUT_EXPLAINED} />
        </p>
        <DrawingBox>
          <div className="mx-auto max-w-[420px]">
            <WiringAll />
          </div>
        </DrawingBox>
      </Sub>
      <Sub id="resistors" title="Do I need resistors?">
        <div className={`flex flex-col divide-y divide-line text-sm ${CARD}`}>
          {RESISTORS.map((r) => (
            <p key={r.lead} className="px-4 py-3 text-muted">
              <span className="font-semibold text-foreground">{r.lead}</span> <Rich text={r.body} />
            </p>
          ))}
        </div>
        <DrawingBox>
          <div className="mx-auto max-w-[420px]">
            <InputRc />
          </div>
        </DrawingBox>
      </Sub>
    </>
  );
}

function InWall() {
  return (
    <>
      <div className="flex flex-col gap-2 rounded-xl border border-danger/50 bg-danger-soft p-4 text-sm">
        <p className="font-semibold text-danger">Mains voltage can kill.</p>
        <p className="text-muted">
          This board is an uncertified design: no lab has tested it and it carries no approval mark. An
          electrician installs it, with the circuit off at the breaker. Build and install it at your own
          risk.
        </p>
      </div>
      <Sub
        id="in-wall"
        title="Can I use it?"
        lead="A small board with its own power supply that sits in the wall box and reads the switches already there. Check all four before you order anything."
      >
        <ul className={`flex flex-col divide-y divide-line text-sm ${CARD}`}>
          {WALL_REQUIREMENTS.map((r) => (
            <li key={r.need} className="grid grid-cols-[20px_minmax(0,1fr)] gap-2.5 px-4 py-3">
              <span aria-hidden="true" className="mt-0.5 h-4 w-4 rounded border border-muted" />
              <span className="flex flex-col gap-0.5">
                <span className="font-semibold">{r.need}</span>
                <span className="text-muted">{r.why}</span>
              </span>
            </li>
          ))}
        </ul>
      </Sub>
      <Sub title="What changes in the wall">
        <Conversion />
      </Sub>
      <Sub
        title="Get the board"
        lead="Order it assembled from JLCPCB with the files in the firmware repo, solder the XIAO on, and print the enclosure in PETG or ASA (not PLA)."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <Image
            src="/how-to/carrier-board-top.png"
            alt="Carrier board, XIAO side: the XIAO sits flat with USB-C over the left edge, screw terminals for D0 to D5 and GND"
            width={1176}
            height={984}
            sizes="(min-width: 640px) 336px, 100vw"
            className="h-auto w-full rounded-[10px] border border-line bg-white"
          />
          <Image
            src="/how-to/carrier-board-bottom.png"
            alt="Carrier board, power side: the sealed 5 V power module, fuse and mains terminal"
            width={1176}
            height={984}
            sizes="(min-width: 640px) 336px, 100vw"
            className="h-auto w-full rounded-[10px] border border-line bg-white"
          />
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {[
            ["Order from JLCPCB", "#order-assembled-boards-jlcpcb"],
            ["Solder the XIAO", "#solder-the-xiao"],
            ["Print the enclosure", "#print-the-enclosure"],
            ["Schematic and parts", "#what-is-on-the-board"],
          ].map(([label, anchor]) => (
            <li key={anchor}>
              <a
                href={`${HARDWARE_README}${anchor}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-filament underline underline-offset-2"
              >
                {label} ↗
              </a>
            </li>
          ))}
        </ul>
      </Sub>
      <Sub
        id="install"
        title="Install it"
        lead="In this order. Steps 2 to 9 are the electrician's; show them this page."
      >
        <Steps>
          {WALL_INSTALL.map((step, i) => (
            <Step key={step.title} n={i + 1}>
              <StepText
                title={step.title}
                body={step.body}
                tag={
                  <>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] ${
                        step.who === "electrician" ? "bg-warn-soft text-warn" : "bg-filament-soft text-filament"
                      }`}
                    >
                      {step.who === "electrician" ? "Electrician" : "You"}
                    </span>
                    {step.more ? (
                      <a
                        href={`${HARDWARE_README}${step.more}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-filament underline underline-offset-2"
                      >
                        Details ↗
                      </a>
                    ) : null}
                  </>
                }
              />
            </Step>
          ))}
        </Steps>
      </Sub>
    </>
  );
}

function SimpleBuild({ level, onLevel }: { level: LevelId; onLevel: (id: LevelId) => void }) {
  return (
    <>
      <LevelPicker level={level} onChoose={onLevel} />
      {level === "try" ? <TryIt /> : level === "box" ? <ButtonBox /> : <InWall />}
    </>
  );
}

// Starts closed: most readers already have a built switch. Any Build anchor in the URL opens it
// (and picks the Simple level the anchor belongs to), then scrolls there once it exists.
export function BuildSection({ product }: { product: Product }) {
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<LevelId>("try");

  useEffect(() => {
    function follow() {
      const hash = currentHash();
      if (!isBuildAnchor(hash)) return;
      setOpen(true);
      const l = levelFor(hash);
      if (l) setLevel(l);
      requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView());
    }
    follow();
    window.addEventListener("hashchange", follow);
    return () => window.removeEventListener("hashchange", follow);
  }, []);

  const bodyId = "build-body";

  return (
    <section id="build" className="flex scroll-mt-6 flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Build a {PRODUCT_INFO[product].name}</h2>
        <p className="text-sm text-muted">{buildSummary(product)}</p>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen(!open)}
          className="self-start rounded-md border border-line bg-cream px-3 py-1.5 text-sm font-medium hover:border-filament"
        >
          {open ? "Hide the build guide" : "Show the build guide"}
        </button>
      </div>
      {open ? (
        <div id={bodyId} className="flex flex-col gap-8">
          {product === "round" ? <RoundBuild /> : <SimpleBuild level={level} onLevel={setLevel} />}
          <p className={GROUP_LABEL}>Built? Set it up next.</p>
        </div>
      ) : null}
    </section>
  );
}
