"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BuildSection, LevelPicker } from "@/app/how-to/build-section";
import { ProductPicture } from "@/app/how-to/product-picture";
import { StateVisual } from "@/app/how-to/visuals";
import { Rich } from "@/app/rich-text";
import { Illo } from "@/app/how-to/illo/illo";
import { BEFORE_YOU_START } from "@/lib/setup-guide";
import {
  PRODUCT_INFO,
  PRODUCTS,
  setupSteps,
  statuses,
  tasks,
  type Product,
  type Status,
} from "@/lib/how-to";
import {
  DEFAULT_LEVEL,
  TOPICS,
  fromOldAnchor,
  howToHref,
  howToTitle,
  readHowTo,
  topicHint,
  topicLabel,
  type HowTo,
  type Topic,
} from "@/lib/how-to-nav";

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

// First row: the two switches. Big cards until one is picked, then a compact row.
function ProductPicker({
  product,
  onChoose,
}: {
  product: Product | null;
  onChoose: (id: Product) => void;
}) {
  const compact = product !== null;
  return (
    <div className="grid grid-cols-2 gap-2.5" role="radiogroup" aria-label="Which switch">
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
            className={`flex min-w-0 touch-manipulation overflow-hidden rounded-xl border bg-cream text-left ${
              compact ? "flex-row items-center" : "flex-col"
            } ${selected ? SELECTED : "border-line hover:border-muted"}`}
          >
            <span
              className={`relative aspect-[16/10] shrink-0 bg-background ${
                compact ? "w-16 self-stretch border-r border-line sm:w-[92px]" : "w-full border-b border-line"
              }`}
            >
              <span className={`absolute ${compact ? "inset-[8%]" : "inset-x-[8%] inset-y-[10%]"}`}>
                <ProductPicture product={id} />
              </span>
            </span>
            <span className={`flex min-w-0 flex-col gap-0.5 ${compact ? "px-3 py-2" : "px-3.5 pt-3 pb-3.5"}`}>
              <span className={`font-semibold ${compact ? "text-sm" : "text-[15px]"}`}>{info.name}</span>
              <span className={`text-xs text-muted ${compact ? "hidden sm:block" : ""}`}>{info.blurb}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Second row: what to do with that switch. Tabs rather than cards, so the rows read as navigation.
function TopicPicker({
  product,
  topic,
  onChoose,
}: {
  product: Product;
  topic: Topic | null;
  onChoose: (id: Topic) => void;
}) {
  return (
    <div
      className="grid grid-cols-2 gap-2 min-[600px]:grid-cols-4"
      role="radiogroup"
      aria-label="What you want to do"
    >
      {TOPICS.map((id) => {
        const on = id === topic;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChoose(id)}
            className={`flex min-w-0 touch-manipulation flex-col gap-0.5 rounded-[10px] border px-3 py-2.5 text-left ${
              on ? "border-filament bg-filament-soft" : "border-line hover:bg-cream"
            }`}
          >
            <span className={`text-[13.5px] font-semibold ${on ? "text-filament" : ""}`}>{topicLabel(product, id)}</span>
            <span className="text-[11.5px] leading-snug text-muted">{topicHint(product, id)}</span>
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
          About five minutes, once per board, on{" "}
          <Link href="/setup" className="text-filament underline underline-offset-2">
            Set up over USB
          </Link>
          . It walks you through these steps one at a time with the board plugged in, and says why
          each one is needed. After each step the switch itself shows what it needs next.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-0.5 text-xs text-muted">You need</span>
        {BEFORE_YOU_START.map((need) => (
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
                {step.illo ? (
                  <div className="mt-1 w-full max-w-xl">
                    <Illo id={step.illo.id} alt={step.illo.alt} />
                  </div>
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

function subscribeHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function readHash() {
  return window.location.hash.slice(1);
}

function StatusSection({ product, version }: { product: Product; version: string | null }) {
  const items = statuses(product);
  const round = product === "round";
  const setupItems = items.filter((item) => item.group !== "bad");
  const badItems = items.filter((item) => item.group === "bad");
  // A link to one state (#status-<key>) selects it; otherwise people usually arrive here when
  // something is wrong. A tile click wins over both.
  const hash = useSyncExternalStore(subscribeHash, readHash, () => "");
  const linked = hash.startsWith("status-") ? items.find((item) => `status-${item.key}` === hash)?.key : undefined;
  const [chosen, setPick] = useState<string | null>(null);
  const pick = chosen ?? linked ?? badItems[0]?.key ?? items[0].key;
  const sel = items.find((item) => item.key === pick) ?? items[0];

  useEffect(() => {
    if (linked) document.getElementById(`status-${linked}`)?.scrollIntoView();
  }, [linked]);

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

function NextTopic({ product, topic, onGo }: { product: Product; topic: Topic; onGo: (id: Topic) => void }) {
  return (
    <button
      type="button"
      onClick={() => onGo(topic)}
      className="self-start text-sm font-medium text-filament underline underline-offset-2"
    >
      Next: {topicLabel(product, topic)} →
    </button>
  );
}

// Where Build leads: the Round and the in-wall board still need setting up; Try it and the
// button box set the board up in their own first steps.
function afterBuild(product: Product, level: HowTo["level"]): Topic {
  return product === "simple" && level !== "wall" ? "tasks" : "setup";
}

// Switch, then topic, then (Simple build) build type. The query string holds all three
// (lib/how-to-nav.ts); choosing updates it in place, so the server renders the same view for the
// same URL and Back steps through topics (docs/specs/finished/how-to-navigation.md).
export function HowToGuide({ version }: { version: string | null }) {
  const params = useSearchParams();
  const view = readHowTo((key) => params.get(key));
  const { product, topic, level } = view;
  const topicsRef = useRef<HTMLDivElement>(null);
  // An anchor to scroll to once the view it belongs to has rendered.
  const pending = useRef<string | null>(null);

  // Old links (/how-to?product=simple#status, #install, ...) pointed into one long page. On
  // arrival the router may not be listening to history yet, so this goes through it.
  const router = useRouter();
  useEffect(() => {
    function follow() {
      const query = new URLSearchParams(window.location.search);
      const old = fromOldAnchor(window.location.hash.slice(1), readHowTo((key) => query.get(key)));
      if (!old) return;
      if (old.hash && !old.hash.startsWith("status-")) pending.current = old.hash;
      router.replace(howToHref(old.to, old.hash), { scroll: false });
    }
    follow();
    window.addEventListener("hashchange", follow);
    return () => window.removeEventListener("hashchange", follow);
  }, [router]);

  useEffect(() => {
    const id = pending.current;
    const el = id ? document.getElementById(id) : null;
    if (!el) return;
    pending.current = null;
    el.scrollIntoView();
  }, [product, topic, level]);

  // Choosing doesn't reload the page, so the tab title follows here; the server sets it on load.
  const title = howToTitle(view);
  useEffect(() => {
    const suffix = document.title.split(" · ").slice(1).join(" · ");
    document.title = suffix ? `${title} · ${suffix}` : title;
  }, [title]);

  function go(next: HowTo, mode: "push" | "replace" = "push") {
    const href = howToHref(next);
    if (mode === "push") window.history.pushState(null, "", href);
    else window.history.replaceState(null, "", href);
  }

  function chooseProduct(id: Product) {
    if (id !== product) go({ product: id, topic, level: DEFAULT_LEVEL });
  }

  function chooseTopic(id: Topic) {
    if (product && id !== topic) go({ product, topic: id, level: DEFAULT_LEVEL });
  }

  function nextTopic(id: Topic) {
    chooseTopic(id);
    topicsRef.current?.scrollIntoView({ block: "start" });
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">How-to</h1>
        <p className="text-sm text-muted">
          Build a switch, set it up, change what it does, and read what it&apos;s telling you. Pick your
          switch to start.
        </p>
      </section>

      <ProductPicker product={product} onChoose={chooseProduct} />

      {product ? (
        <div ref={topicsRef} className="scroll-mt-6">
          <TopicPicker product={product} topic={topic} onChoose={chooseTopic} />
        </div>
      ) : null}

      {product === "simple" && topic === "build" ? (
        <LevelPicker level={level} onChoose={(id) => go({ product, topic, level: id }, "replace")} />
      ) : null}

      {product && !topic ? <p className="py-2 text-center text-sm text-muted">Pick what you want to do.</p> : null}

      {product && topic ? (
        // Keyed by view, so the task list and status selection start fresh on each.
        <div key={`${product}-${topic}-${level}`} className="flex flex-col gap-8 border-t border-line pt-6">
          {topic === "build" ? (
            <>
              <BuildSection product={product} level={level} />
              <NextTopic product={product} topic={afterBuild(product, level)} onGo={nextTopic} />
            </>
          ) : topic === "setup" ? (
            <>
              <SetupSection product={product} version={version} />
              <NextTopic product={product} topic="tasks" onGo={nextTopic} />
            </>
          ) : topic === "tasks" ? (
            <TasksSection product={product} />
          ) : (
            <StatusSection product={product} version={version} />
          )}
        </div>
      ) : null}
    </div>
  );
}
