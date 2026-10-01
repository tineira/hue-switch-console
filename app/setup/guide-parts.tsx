"use client";

import type { ReactNode } from "react";
import { Rich } from "@/app/rich-text";
import { CANT_BREAK, PORT_NAME } from "@/lib/setup-guide";

// Building blocks of the Set up over USB stepper (docs/specs/setup-guide.md §2.1).

export type StepState = "done" | "warn" | "error" | "current" | "later";

/** A part balloon in HTML, drawn like the ones in the 3D pictures (illo/render.ts). */
export function Balloon({ n }: { n: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] border-foreground bg-cream text-[11px] font-semibold text-foreground tabular-nums"
    >
      {n}
    </span>
  );
}

const DOT: Record<StepState, string> = {
  done: "bg-ok text-background",
  warn: "bg-warn text-background",
  error: "bg-danger text-background",
  current: "bg-filament text-filament-ink",
  later: "border border-line text-muted",
};

function Mark({ state, n }: { state: StepState; n: number }) {
  const mark = state === "done" ? "✓" : state === "warn" ? "!" : state === "error" ? "✕" : String(n);
  return (
    <span
      className={`mt-3.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${DOT[state]}`}
    >
      {mark}
    </span>
  );
}

/**
 * One row of the stepper. Open: the step's whole body. Closed: one line with the summary;
 * finished rows open on click, later rows don't.
 */
export function StepRow({
  n,
  title,
  state,
  summary,
  open,
  last,
  onToggle,
  children,
}: {
  n: number;
  title: string;
  state: StepState;
  summary?: ReactNode;
  open: boolean;
  last?: boolean;
  onToggle?: () => void;
  children?: ReactNode;
}) {
  const sr = { done: "done", warn: "needs a look", error: "problem", current: "current step", later: "later" }[state];
  const head = (
    <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
      <span className={`font-semibold ${state === "later" ? "text-muted" : ""}`}>{title}</span>
      <span className="sr-only">({sr})</span>
      {summary && !open ? <span className="min-w-0 text-sm text-muted">{summary}</span> : null}
    </span>
  );
  return (
    <li className="grid grid-cols-[24px_minmax(0,1fr)] gap-x-3 sm:gap-x-4">
      <div className="flex flex-col items-center">
        <Mark state={state} n={n} />
        {last ? null : <span className="mt-1.5 w-px flex-1 bg-line" />}
      </div>
      <div
        className={`mb-3 rounded-xl border text-sm ${
          open ? "border-line bg-cream" : state === "later" ? "border-transparent" : "border-line"
        }`}
      >
        {onToggle && state !== "later" && !(state === "current" && open) ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          >
            {head}
            <span aria-hidden="true" className="shrink-0 text-xs text-muted">
              {open ? "Close" : state === "done" ? "Change" : "Open"}
            </span>
          </button>
        ) : (
          <div className="px-4 py-3">{head}</div>
        )}
        {open ? <div className="flex flex-col gap-4 px-4 pb-4">{children}</div> : null}
      </div>
    </li>
  );
}

/** "Why this step" and "If it goes wrong", closed by default so the action stays in view. */
export function StepHelp({ why, trouble }: { why: string; trouble: string[] }) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-line pt-3">
      <details className="group">
        <summary className="cursor-pointer text-sm font-medium text-muted hover:text-foreground">
          Why this step
        </summary>
        <p className="mt-1.5 text-sm text-muted">
          <Rich text={why} />
        </p>
      </details>
      <details className="group">
        <summary className="cursor-pointer text-sm font-medium text-muted hover:text-foreground">
          If it goes wrong
        </summary>
        <ul className="mt-1.5 flex list-disc flex-col gap-1.5 pl-5 text-sm text-muted">
          {trouble.map((line) => (
            <li key={line}>
              <Rich text={line} />
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

export function CantBreak() {
  return (
    <div className="flex gap-3 rounded-lg border border-ok/40 bg-ok-soft px-3 py-2.5 text-sm">
      <span aria-hidden="true" className="mt-0.5 text-ok">
        <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
          <path d="M10 1.5 3 4.3v5.2c0 4.3 3 7.6 7 9 4-1.4 7-4.7 7-9V4.3L10 1.5Zm3.7 6.2-4.4 4.6a.8.8 0 0 1-1.1 0L6.3 10.4a.8.8 0 1 1 1.1-1.1l1.3 1.3 3.9-4a.8.8 0 0 1 1.1 1.1Z" />
        </svg>
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="font-medium text-ok">You can&apos;t break the XIAO this way.</span>
        <span className="text-muted">
          <Rich text={CANT_BREAK} />
        </span>
      </span>
    </div>
  );
}

/** Numbered things to do, each with the balloon of the part it names in the picture. */
export function ButtonSteps({ items }: { items: { n?: number; text: string }[] }) {
  return (
    <ol className="flex flex-col gap-2 text-sm">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5">
          <span className="mt-0.5 w-4 shrink-0 text-right text-xs font-semibold text-muted tabular-nums">
            {i + 1}.
          </span>
          <span className="flex items-start gap-1.5">
            {item.n ? <Balloon n={item.n} /> : null}
            <span>
              <Rich text={item.text} />
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * A drawing of Chrome's serial port window with the board's entry marked ①. Connect asks for
 * XIAO vendor ids only, so the board is the one entry (checked on the maintainer's PC, where
 * three Bluetooth ports dropped out).
 */
export function PortPickerMock() {
  const rows = [`${PORT_NAME} (COM3)`];
  return (
    <figure className="flex min-w-0 flex-col gap-2">
      <div
        aria-hidden="true"
        className="rounded-xl border border-line bg-background p-3 shadow-sm select-none"
      >
        <p className="mb-2 text-[13px] font-semibold">This site wants to connect to a serial port</p>
        <ul className="flex flex-col rounded-md border border-line p-1 text-[12.5px]">
          {rows.map((row, i) => {
            const board = i === 0;
            return (
              <li
                key={row}
                className={`flex items-center justify-between gap-2 rounded px-2 py-1.5 ${
                  board ? "bg-filament-soft font-medium text-foreground" : "text-muted"
                }`}
              >
                <span className="min-w-0 truncate">{row}</span>
                {board ? <Balloon n={1} /> : null}
              </li>
            );
          })}
        </ul>
        <div className="mt-2.5 flex justify-end gap-2 text-[12px]">
          <span className="rounded-full bg-filament px-3 py-1 font-medium text-filament-ink">Connect</span>
          <span className="rounded-full border border-line px-3 py-1">Cancel</span>
        </div>
      </div>
      <figcaption className="flex items-start gap-1.5 text-xs text-muted">
        <Balloon n={1} />
        <span>
          <span className="font-medium text-foreground">{PORT_NAME}</span> is the board. On Windows it
          ends in a port number such as (COM3).
        </span>
      </figcaption>
    </figure>
  );
}

export function ChipList({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-0.5 text-xs text-muted">{label}</span>
      {items.map((item) => (
        <span key={item} className="rounded-full border border-line px-2 py-1 text-xs">
          {item}
        </span>
      ))}
    </div>
  );
}
