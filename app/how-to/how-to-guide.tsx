"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { BuildSection } from "@/app/how-to/build-section";
import { StateVisual } from "@/app/how-to/visuals";
import { Rich } from "@/app/rich-text";
import {
  HOWTO_PRODUCT_KEY,
  NEEDS,
  PRODUCT_INFO,
  PRODUCTS,
  isProduct,
  setupSteps,
  statuses,
  tasks,
  type Product,
  type Status,
} from "@/lib/how-to";

const SELECTED = "border-filament shadow-[0_0_0_1px_var(--filament)]";
const GROUP_LABEL = "text-[10px] font-medium uppercase tracking-[0.14em] text-muted";

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      width="16"
      height="16"
      aria-hidden="true"
      className={`shrink-0 text-muted transition-transform duration-150 ${open ? "rotate-180" : ""}`}
    >
      <path d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" />
    </svg>
  );
}

function ProductPicker({
  product,
  onChoose,
}: {
  product: Product;
  onChoose: (id: Product) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Which switch">
      {PRODUCTS.map((id) => {
        const info = PRODUCT_INFO[id];
        const selected = id === product;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChoose(id)}
            className={`flex min-h-11 flex-[1_1_240px] touch-manipulation items-center gap-3 rounded-xl border bg-cream px-3.5 py-3 text-left sm:max-w-[332px] ${
              selected ? SELECTED : "border-line"
            }`}
          >
            <span
              aria-hidden="true"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-background"
            >
              <StateVisual visual={info.visual} label="" size={40} version={null} />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm font-semibold">{info.name}</span>
              <span className="text-xs text-muted">{info.blurb}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SetupSection({ product, version }: { product: Product; version: string | null }) {
  const steps = setupSteps(product);
  return (
    <section id="setup" className="flex scroll-mt-6 flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Set up a {PRODUCT_INFO[product].name}</h2>
        <p className="text-sm text-muted">
          About five minutes, once per board. After each step the switch itself shows what
          it needs next, so you always know where you are.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-0.5 text-xs text-muted">You need</span>
        {NEEDS.map((need) => (
          <span key={need} className="rounded-full border border-line px-2 py-1 text-xs">
            {need}
          </span>
        ))}
      </div>

      <ol className="flex flex-col">
        {steps.map((step, i) => (
          <li key={step.title} className="grid grid-cols-[24px_minmax(0,1fr)] gap-x-4">
            <div className="flex flex-col items-center">
              <span className="mt-4 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-filament-soft text-xs font-semibold text-filament tabular-nums">
                {i + 1}
              </span>
              <span className="mt-1.5 w-px flex-1 bg-line" />
            </div>
            <div className="mb-3 flex flex-wrap gap-4 rounded-xl border border-line bg-cream p-4 text-sm">
              <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-2">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-semibold">{step.title}</span>
                  {step.where && step.href ? (
                    <Link
                      href={step.href}
                      className="text-xs text-filament underline underline-offset-2"
                    >
                      {step.where}
                    </Link>
                  ) : null}
                </p>
                <p className="text-muted">
                  <Rich text={step.body} />
                </p>
                {step.note ? (
                  <p className="border-t border-line pt-2 text-xs text-muted">
                    <Rich text={step.note} />
                  </p>
                ) : null}
              </div>
              {step.shows ? (
                <div className="flex flex-[1_1_148px] flex-col items-center justify-center gap-2.5 rounded-[10px] bg-background p-3 text-center sm:flex-[0_0_148px]">
                  <span className={GROUP_LABEL}>Then it shows</span>
                  <span className="flex min-h-16 items-center justify-center">
                    <StateVisual
                      visual={step.shows.visual}
                      label={step.shows.caption}
                      size={64}
                      version={version}
                    />
                  </span>
                  <span className="text-xs text-balance">{step.shows.caption}</span>
                </div>
              ) : null}
            </div>
          </li>
        ))}
        <li className="grid grid-cols-[24px_minmax(0,1fr)] gap-x-4">
          <div className="flex justify-center">
            <span className="mt-4 flex h-6 w-6 items-center justify-center rounded-full bg-ok-soft text-ok">
              <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor" aria-hidden="true">
                <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.58l7.3-7.3a1 1 0 0 1 1.4 0Z" />
              </svg>
            </span>
          </div>
          <div className="flex flex-col gap-1 rounded-xl border border-ok/40 bg-ok-soft p-4 text-sm">
            <span className="font-semibold text-ok">Unplug it and mount it.</span>
            <span className="text-muted">
              Setup&apos;s card turns green and says{" "}
              <span className="font-medium text-foreground">This board is set up</span>. Later
              changes reach the switch within about 15 minutes, or right away if you unplug it and plug
              it back in.
            </span>
          </div>
        </li>
      </ol>
    </section>
  );
}

function TasksSection({ product }: { product: Product }) {
  const items = tasks(product);
  const [open, setOpen] = useState(0);
  return (
    <section id="tasks" className="flex scroll-mt-6 flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">Everyday tasks</h2>
        <p className="text-sm text-muted">Once it&apos;s set up, this is what you&apos;ll come back for.</p>
      </div>
      <div className="flex flex-col divide-y divide-line overflow-hidden rounded-xl border border-line bg-cream text-sm">
        {items.map((task, i) => {
          const expanded = open === i;
          const bodyId = `task-${i}`;
          return (
            <div key={task.title}>
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={bodyId}
                onClick={() => setOpen(expanded ? -1 : i)}
                className="flex min-h-11 w-full touch-manipulation items-center justify-between gap-3 px-4 py-3.5 text-left font-medium hover:bg-filament-soft/40"
              >
                <span>{task.title}</span>
                <Chevron open={expanded} />
              </button>
              {expanded ? (
                <ol id={bodyId} className="flex flex-col gap-2 px-4 pb-4">
                  {task.steps.map((step, j) => (
                    <li key={j} className="grid grid-cols-[20px_minmax(0,1fr)] gap-2.5 text-muted">
                      <span className="text-xs leading-5 font-semibold text-filament tabular-nums">
                        {j + 1}
                      </span>
                      <span>
                        <Rich text={step} />
                      </span>
                    </li>
                  ))}
                </ol>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

const TAG: Record<Status["group"], { text: string; className: string }> = {
  setup: { text: "Setting up", className: "text-muted" },
  ok: { text: "All good", className: "text-ok" },
  bad: { text: "Problem", className: "text-danger" },
};

function StatusTiles({
  title,
  items,
  selected,
  onSelect,
  version,
  cols = "grid-cols-[repeat(auto-fill,minmax(124px,1fr))]",
}: {
  title?: string;
  items: Status[];
  selected: string;
  onSelect: (key: string) => void;
  version: string | null;
  cols?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      {title ? <p className={GROUP_LABEL}>{title}</p> : null}
      <div className={`grid ${cols} gap-2`}>
        {items.map((item) => {
          const on = item.key === selected;
          const tag = TAG[item.group];
          return (
            <button
              key={item.key}
              type="button"
              aria-pressed={on}
              aria-controls={`status-${item.key}`}
              onClick={() => onSelect(item.key)}
              className={`flex touch-manipulation flex-col items-center gap-2.5 rounded-xl border bg-cream px-2.5 pt-3.5 pb-3 ${
                on ? SELECTED : "border-line"
              }`}
            >
              <span className="flex h-[72px] items-center justify-center">
                <StateVisual visual={item.visual} label={item.see} size={64} version={version} />
              </span>
              <span className="flex flex-col gap-0.5 text-center">
                <span className="text-[13px] leading-[18px] font-medium">{item.state}</span>
                <span className={`text-[11px] leading-[14px] ${tag.className}`}>{tag.text}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StatusDetail({
  item,
  hidden,
  version,
}: {
  item: Status;
  hidden: boolean;
  version: string | null;
}) {
  const tone = item.group === "ok" ? "text-ok" : item.group === "bad" ? "text-danger" : "text-foreground";
  return (
    <div
      id={`status-${item.key}`}
      hidden={hidden}
      className="flex flex-wrap gap-5 rounded-xl border border-line bg-cream p-5 text-sm"
    >
      <div className="flex h-[152px] flex-[0_0_152px] items-center justify-center rounded-[10px] bg-background">
        <StateVisual visual={item.visual} label={item.see} size={112} version={version} />
      </div>
      <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-2.5">
        <div className="flex flex-col gap-0.5">
          <span className={`text-base font-semibold ${tone}`}>{item.state}</span>
          <span className="text-xs text-muted">{item.see}</span>
        </div>
        <p className="text-muted">
          <Rich text={item.means} />
        </p>
        {item.fix ? (
          <div className="flex flex-col gap-2.5 border-t border-line pt-3">
            <p>
              <span className="font-semibold">What to do: </span>
              <Rich text={item.fix} />
            </p>
            {item.href && item.cta ? (
              <Link
                href={item.href}
                className="self-start rounded-md bg-filament px-3 py-1.5 font-medium text-filament-ink"
              >
                {item.cta}
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StatusSection({ product, version }: { product: Product; version: string | null }) {
  const items = statuses(product);
  const round = product === "round";
  const setupItems = items.filter((item) => item.group !== "bad");
  const badItems = items.filter((item) => item.group === "bad");
  // People usually arrive here when something is wrong.
  const [pick, setPick] = useState(badItems[0]?.key ?? items[0].key);
  const sel = items.find((item) => item.key === pick) ?? items[0];

  return (
    <section id="status" className="flex scroll-mt-6 flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">{round ? "Reading the screen" : "Reading the LED"}</h2>
        <p className="text-sm text-muted">
          {round
            ? "Match the Round's screen to one below. Colours on your Round follow its page theme."
            : "Match the orange LED on the XIAO to one below. The red charge LED, BOOT and RESET aren't part of this list."}
        </p>
      </div>

      {round ? (
        <>
          <StatusTiles
            title="Setting up, in order"
            items={setupItems}
            selected={sel.key}
            onSelect={setPick}
            version={version}
          />
          <StatusTiles
            title="Something's wrong"
            items={badItems}
            selected={sel.key}
            onSelect={setPick}
            version={version}
          />
        </>
      ) : (
        // Six LED states: one grid, 3 + 3 (2 columns on a narrow phone). Each tile carries
        // its own tag, so no group headings.
        <StatusTiles
          items={[...setupItems, ...badItems]}
          selected={sel.key}
          onSelect={setPick}
          version={version}
          cols="grid-cols-2 min-[420px]:grid-cols-3"
        />
      )}

      {/* Every state's details are in the HTML, so search finds them; only the selected
          one is shown. */}
      <div aria-live="polite">
        {items.map((item) => (
          <StatusDetail key={item.key} item={item} hidden={item.key !== sel.key} version={version} />
        ))}
      </div>
    </section>
  );
}

// Old links: /how-to#round and /how-to#simple pointed at the state catalogues.
function legacyHash(): Product | null {
  const hash = window.location.hash.slice(1);
  return isProduct(hash) ? hash : null;
}

function readStored(): Product | null {
  try {
    const stored = localStorage.getItem(HOWTO_PRODUCT_KEY);
    return isProduct(stored) ? stored : null;
  } catch {
    return null;
  }
}

function subscribeStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

// The server renders `initial` (the ?product= deep link, else round). Without a deep link the
// client then switches to an old #round / #simple anchor or the stored choice, so a Simple
// reader can see Round for one frame.
export function HowToGuide({
  version,
  initial,
  fromQuery,
}: {
  version: string | null;
  initial: Product;
  fromQuery: boolean;
}) {
  const [chosen, setChosen] = useState<Product | null>(null);
  const remembered = useSyncExternalStore(
    subscribeStorage,
    () => legacyHash() ?? readStored(),
    () => null,
  );
  const product = chosen ?? (fromQuery ? initial : (remembered ?? initial));

  useEffect(() => {
    if (legacyHash()) document.getElementById("status")?.scrollIntoView();
  }, []);

  function choose(id: Product) {
    setChosen(id);
    try {
      localStorage.setItem(HOWTO_PRODUCT_KEY, id);
    } catch {}
  }

  const round = product === "round";

  return (
    <>
      <section className="flex max-w-2xl flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">How-to</h1>
        <p className="text-sm text-muted">
          Build a switch, set it up, change what it does, and read what it&apos;s telling you.
          Pick your switch and the guide shows only what applies to it.
        </p>
      </section>

      <ProductPicker product={product} onChoose={choose} />

      <div className="flex flex-col gap-10 lg:flex-row lg:items-start">
        <nav
          aria-label="On this page"
          className="flex flex-col gap-1 text-sm lg:sticky lg:top-6 lg:w-44 lg:shrink-0"
        >
          <p className={`mb-1.5 ${GROUP_LABEL}`}>On this page</p>
          {[
            ["#build", "Build it"],
            ["#setup", "Set up a switch"],
            ["#tasks", "Everyday tasks"],
            ["#status", round ? "Reading the screen" : "Reading the LED"],
          ].map(([href, label], i) => (
            <a
              key={href}
              href={href}
              className="flex gap-2.5 rounded-md px-2 py-1.5 hover:bg-cream"
            >
              <span className="text-muted tabular-nums">{i + 1}</span>
              {label}
            </a>
          ))}
        </nav>

        {/* Keyed by product so the task list and status selection reset on a switch. */}
        <div key={product} className="flex min-w-0 max-w-2xl flex-1 flex-col gap-14">
          <BuildSection product={product} />
          <SetupSection product={product} version={version} />
          <TasksSection product={product} />
          <StatusSection product={product} version={version} />
        </div>
      </div>
    </>
  );
}
