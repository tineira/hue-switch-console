"use client";

import { useState, type ReactNode } from "react";
import { EditorShot } from "@/app/how-to/editor-shot";
import { Illo } from "@/app/how-to/illo/illo";
import { Rich } from "@/app/rich-text";
import { PRODUCT_INFO, type Product } from "@/lib/how-to";
import type { LevelId } from "@/lib/how-to-nav";
import {
  BOX_BUY,
  BOX_KIT,
  BOX_STEPS,
  DESIGN_STATUS_LABEL,
  DESIGN_STATUS_TEXT,
  HARDWARE_README,
  INPUT_EXPLAINED,
  NEVER,
  RESISTORS,
  STAIRCASE,
  ROUND_ASSEMBLE,
  ROUND_BUY,
  ROUND_KIT,
  ROUND_STATUS,
  SIMPLE_LEVELS,
  TRY_BUY,
  TRY_KIT,
  TRY_STEPS,
  WALL_AFTER,
  WALL_BEFORE,
  WALL_BOARD,
  WALL_INSTALL,
  WALL_REQUIREMENTS,
  buildSummary,
  type BuyItem,
  type DesignStatus,
  type Pic,
} from "@/lib/how-to-build";

const SELECTED = "border-filament shadow-[0_0_0_1px_var(--filament)]";
const CARD = "rounded-xl border border-line bg-cream";

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
            <span className="flex items-baseline gap-2 font-semibold">
              {item.pic ? (
                // Same part balloon as in the picture above.
                <span
                  aria-label={`Part ${item.pic} in the picture`}
                  className="box-border flex h-[22px] w-[22px] shrink-0 items-center justify-center self-center rounded-full border-[1.5px] border-foreground bg-cream text-xs font-semibold tabular-nums"
                >
                  {item.pic}
                </span>
              ) : null}
              <span>{item.name}</span>
            </span>
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

// A step's picture: a render of the 3D models, or the real Switches editor.
function Picture({ pic }: { pic: Pic }) {
  return (
    <div className="overflow-hidden rounded-[10px] bg-background p-2">
      {"illo" in pic ? <Illo id={pic.illo} alt={pic.alt} /> : <EditorShot state={pic.editor} alt={pic.alt} />}
    </div>
  );
}

function PicSteps({ steps }: { steps: { title: string; body: string; pic: Pic; more?: Pic }[] }) {
  return (
    <Steps>
      {steps.map((step, i) => (
        <Step key={step.title} n={i + 1}>
          <StepText title={step.title} body={step.body} />
          <Picture pic={step.pic} />
          {step.more ? <Picture pic={step.more} /> : null}
        </Step>
      ))}
    </Steps>
  );
}

function Buy({ kit, items }: { kit: Pic; items: BuyItem[] }) {
  return (
    <Sub id="buy" title="What to buy">
      <Picture pic={kit} />
      <BuyList items={items} />
    </Sub>
  );
}

// How proven this design is, and for low-voltage builds the one rule that keeps them low voltage
// (docs/specs/finished/terms-and-safety.md §2.5).
function StatusNote({ status, mains }: { status: DesignStatus; mains?: boolean }) {
  return (
    <div className={`flex flex-col gap-1.5 px-4 py-3 text-sm ${CARD}`}>
      <p className="flex flex-wrap items-center gap-2">
        <a
          href="/safety#status"
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            status === "experimental" ? "bg-warn-soft text-warn" : "bg-filament-soft text-filament"
          }`}
        >
          {DESIGN_STATUS_LABEL[status]}
        </a>
        <span className="text-muted">{DESIGN_STATUS_TEXT[status]}</span>
      </p>
      {mains ? null : (
        <p className="text-muted">
          Low voltage only. Never connect any pin to anything that is or was on mains.
        </p>
      )}
    </div>
  );
}

function RoundBuild() {
  return (
    <>
      <StatusNote status={ROUND_STATUS} />
      <Buy kit={ROUND_KIT} items={ROUND_BUY} />
      <Sub
        id="assemble"
        title="Put it together"
        lead="A few minutes, plus soldering if the headers came loose. Do it before you plug in USB."
      >
        <PicSteps steps={ROUND_ASSEMBLE} />
      </Sub>
    </>
  );
}

// The third choice on /how-to, under the topics, once Simple and Build it are picked.
export function LevelPicker({ level, onChoose }: { level: LevelId; onChoose: (id: LevelId) => void }) {
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
            <span className={`text-xs ${item.status === "experimental" ? "text-warn" : "text-muted"}`}>
              {DESIGN_STATUS_LABEL[item.status]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function TryIt() {
  return (
    <>
      <Buy kit={TRY_KIT} items={TRY_BUY} />
      <Sub id="try" title="Try it with BOOT" lead="The quickest way to see the switch work, and the first test for every build.">
        <PicSteps steps={TRY_STEPS} />
      </Sub>
    </>
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
      <Buy kit={BOX_KIT} items={BOX_BUY} />
      <Never />
      <Sub title="How an input works">
        <p className="text-sm text-muted">
          <Rich text={INPUT_EXPLAINED} />
        </p>
        <p className={`${CARD} px-4 py-3 text-sm text-muted`}>
          <Rich text={STAIRCASE} />
        </p>
      </Sub>
      <Sub
        id="wire"
        title="Wire it, one input at a time"
        lead="Finish and test each input before you start the next, so a mistake shows up on the first wire, not the sixth."
      >
        <PicSteps steps={BOX_STEPS} />
      </Sub>
      <Sub id="resistors" title="Do I need resistors?">
        <div className={`flex flex-col divide-y divide-line text-sm ${CARD}`}>
          {RESISTORS.map((r) => (
            <p key={r.lead} className="px-4 py-3 text-muted">
              <span className="font-semibold text-foreground">{r.lead}</span> <Rich text={r.body} />
            </p>
          ))}
        </div>
      </Sub>
    </>
  );
}

function InWall() {
  const [checked, setChecked] = useState<string[]>([]);
  const all = checked.length === WALL_REQUIREMENTS.length;
  return (
    <>
      {/* The anchor is on the warning, so a link to #in-wall never lands below it. */}
      <div
        id="in-wall"
        className="flex scroll-mt-6 flex-col gap-2 rounded-xl border border-danger/50 bg-danger-soft p-4 text-sm"
      >
        <p className="font-semibold text-danger">Mains voltage can kill.</p>
        <p className="text-muted">
          This board is an uncertified design, made with AI assistance and checked only by design-rule tools: no
          lab has tested it and it carries no approval mark. An electrician installs it, with the circuit off at
          the breaker. Build and install it at your own risk.
        </p>
        <p className="text-muted">
          <b className="font-semibold text-foreground">Never connect USB while the board is on mains.</b> A fault
          or a wrongly wired switch line would put mains on the cable and your computer.
        </p>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-muted marker:text-danger">
          <li>I am not an electrical engineer. This is a hobby design.</li>
          <li>
            Rules and wire colors differ by country. In some countries only a licensed electrician may change
            fixed wiring.
          </li>
          <li>An uncertified device in your home&apos;s wiring may affect your home insurance.</li>
        </ul>
        <a href="/safety" className="self-start font-medium text-danger underline underline-offset-2">
          Read the Safety notice
        </a>
      </div>
      <Sub
        title="Can I use it?"
        lead="A small board with its own power supply that sits in the wall box and reads the switches already there. Check all four before you order anything."
      >
        <ul className={`flex flex-col divide-y divide-line text-sm ${CARD}`}>
          {WALL_REQUIREMENTS.map((r) => (
            <li key={r.need}>
              <label className="grid cursor-pointer grid-cols-[20px_minmax(0,1fr)] gap-2.5 px-4 py-3">
                <input
                  type="checkbox"
                  checked={checked.includes(r.need)}
                  onChange={(e) =>
                    setChecked((c) => (e.target.checked ? [...c, r.need] : c.filter((x) => x !== r.need)))
                  }
                  className="mt-0.5 h-4 w-4 accent-[var(--filament)]"
                />
                <span className="flex flex-col gap-0.5">
                  <span className="font-semibold">{r.need}</span>
                  <span className="text-muted">{r.why}</span>
                  {r.more ? (
                    <a
                      href={`${HARDWARE_README}${r.more.anchor}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="self-start text-filament underline underline-offset-2"
                    >
                      {r.more.label} ↗
                    </a>
                  ) : null}
                </span>
              </label>
            </li>
          ))}
        </ul>
        <div aria-live="polite">
          {all ? (
            <div className="flex items-center gap-4 rounded-xl border-2 border-ok bg-ok-soft p-5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ok text-background">
                <svg viewBox="0 0 20 20" width="26" height="26" fill="currentColor" aria-hidden="true">
                  <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.58l7.3-7.3a1 1 0 0 1 1.4 0Z" />
                </svg>
              </span>
              <span className="flex flex-col gap-1">
                <span className="text-lg font-semibold text-ok">Your box is ready for it.</span>
                <span className="text-sm text-muted">
                  All four hold. Next, get the board, then show <b className="font-medium text-foreground">Install it</b> to
                  your electrician.
                </span>
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-line bg-cream px-4 py-3 text-sm text-muted">
              <span className="text-base font-semibold text-foreground tabular-nums">
                {checked.length} / {WALL_REQUIREMENTS.length}
              </span>
              <span>Check all four. If one doesn&apos;t hold for your box, build the button box on USB-C instead.</span>
            </div>
          )}
        </div>
      </Sub>
      <Sub
        title="What changes in the wall"
        lead="Colors in these drawings are for telling the wires apart, not the colors in your wall."
      >
        <div className="grid gap-3">
          <figure className="flex flex-col gap-1.5">
            <Picture pic={WALL_BEFORE} />
            <figcaption className="text-xs text-muted">
              <span className="font-medium text-foreground">Before.</span> The switch cuts the lamp&apos;s live. A Hue
              bulb loses its connection whenever it&apos;s off.
            </figcaption>
          </figure>
          <figure className="flex flex-col gap-1.5">
            <Picture pic={WALL_AFTER} />
            <figcaption className="text-xs text-muted">
              <span className="font-medium text-foreground">After.</span> The lamp stays powered and the Bridge switches
              it. The board, in its enclosure at the back of the box, takes live and neutral, and the old switch wires
              carry only 3.3 V to it.
            </figcaption>
          </figure>
        </div>
      </Sub>
      <Sub
        title="Get the board"
        lead="Order it assembled from JLCPCB with the files in the firmware repo. Set the XIAO up over USB (step 1 below) before you solder it on. Print the enclosure in PETG, ASA or PC, not PLA."
      >
        <Picture pic={WALL_BOARD} />
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
        lead={
          <>
            In this order. Steps 2 to 9 are the electrician&apos;s; show them this page, and the{" "}
            <a href="/safety" className="text-danger underline underline-offset-2">
              Safety notice
            </a>
            . Mains voltage can kill.
          </>
        }
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
              <Picture pic={step.pic} />
            </Step>
          ))}
        </Steps>
      </Sub>
    </>
  );
}

// The build guide for the chosen switch, and for the Simple the chosen build type (picked above
// it, in the guide's third row).
export function BuildSection({ product, level }: { product: Product; level: LevelId }) {
  return (
    <section id="build" className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Build a {PRODUCT_INFO[product].name}</h2>
        <p className="text-sm text-muted">{buildSummary(product)}</p>
      </div>
      {product === "simple" ? (
        <StatusNote
          status={SIMPLE_LEVELS.find((l) => l.id === level)?.status ?? "experimental"}
          mains={level === "wall"}
        />
      ) : null}
      {product === "round" ? <RoundBuild /> : level === "try" ? <TryIt /> : level === "box" ? <ButtonBox /> : <InWall />}
    </section>
  );
}
