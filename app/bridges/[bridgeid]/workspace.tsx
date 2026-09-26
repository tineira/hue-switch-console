"use client";

import {
  RoundPagesEditor,
  type RoundDraft,
} from "@/app/bridges/[bridgeid]/round-pages-editor";
import { SimpleChannelsEditor } from "@/app/bridges/[bridgeid]/simple-channels-editor";
import { formatMac } from "@/lib/mac";
import {
  DEFAULT_SCREEN_TIMEOUT_SEC,
  clearStaleRoundRecipes,
  isScreenTimeoutSec,
  pagesEqual,
  roundRecipesEqual,
  staleRoundCount,
} from "@/lib/pages";
import {
  clearStaleSimple,
  isSimpleChannelStale,
  simpleChannelsEqual,
  supportsChannelTypes,
  supportsHoldDim,
} from "@/lib/simple-channels";
import type {
  RoundRecipe,
  SimpleChannelConfig,
  SwitchPage,
  SwitchPublic,
  TopologySnapshot,
} from "@/lib/types";
import { compareVersions } from "@/lib/web-setup/devices";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type WorkspaceSwitch = SwitchPublic & {
  simpleChannels: SimpleChannelConfig[];
  pages: SwitchPage[];
  roundRecipes: RoundRecipe[];
};

type Notice = { text: string; tone: "ok" | "muted" };

type SaveResult = { ok: true; rev?: number } | { ok: false; error: string };

const SAVED_TAIL = "The switch picks this up on poll, or immediately after reboot.";

function isRoundItem(item: WorkspaceSwitch | null | undefined): boolean {
  return item?.product === "round";
}

function roundDraftOf(item: WorkspaceSwitch): RoundDraft {
  return {
    pages: item.pages ?? [],
    recipes: item.roundRecipes ?? [],
    pageSwipeAxis: item.pageSwipeAxis ?? "horizontal",
    screenTimeoutSec: item.screenTimeoutSec ?? DEFAULT_SCREEN_TIMEOUT_SEC,
  };
}

function roundDraftsEqual(a: RoundDraft, b: RoundDraft): boolean {
  return (
    a.pageSwipeAxis === b.pageSwipeAxis &&
    a.screenTimeoutSec === b.screenTimeoutSec &&
    pagesEqual(a.pages, b.pages) &&
    roundRecipesEqual(a.recipes, b.recipes)
  );
}

/** A scene list with no scene yet cannot be saved; say which gesture. */
function emptySceneList(draft: RoundDraft): string | null {
  for (const recipe of draft.recipes) {
    if (recipe.action === "recall_scene" && (recipe.targets ?? []).length === 0) {
      const page = draft.pages.find((item) => item.id === recipe.pageId);
      const gesture = recipe.event === "double_click" ? "Double tap" : "Tap";
      return `Pick at least one scene for ${gesture} on ${page?.name || "a page"}, or set it to Nothing.`;
    }
  }
  return null;
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "Unknown";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const min = Math.round((Date.now() - then) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr} h ago`;
  return new Date(iso).toLocaleString();
}

export function BridgeWorkspace({
  bridgeid,
  bridgeIp,
  updatedAt,
  snapshot,
  switches,
  initialMac,
  latestFirmware,
}: {
  bridgeid: string;
  bridgeIp: string | null;
  updatedAt: string;
  snapshot: TopologySnapshot;
  switches: WorkspaceSwitch[];
  initialMac?: string | null;
  latestFirmware: { round: string; simple: string };
}) {
  const router = useRouter();
  const first = switches.find((item) => item.mac === initialMac) ?? switches[0];
  const [selectedMac, setSelectedMac] = useState<string | null>(first?.mac ?? null);
  const [drafts, setDrafts] = useState<Record<string, SimpleChannelConfig[]>>(() =>
    Object.fromEntries(switches.map((item) => [item.mac, item.simpleChannels])),
  );
  const [saved, setSaved] = useState<Record<string, SimpleChannelConfig[]>>(() =>
    Object.fromEntries(switches.map((item) => [item.mac, item.simpleChannels])),
  );
  const [roundDrafts, setRoundDrafts] = useState<Record<string, RoundDraft>>(() =>
    Object.fromEntries(
      switches.filter(isRoundItem).map((item) => [item.mac, roundDraftOf(item)]),
    ),
  );
  const [roundSaved, setRoundSaved] = useState<Record<string, RoundDraft>>(() =>
    Object.fromEntries(
      switches.filter(isRoundItem).map((item) => [item.mac, roundDraftOf(item)]),
    ),
  );
  const [revs, setRevs] = useState<Record<string, number>>(() =>
    Object.fromEntries(switches.map((item) => [item.mac, item.rev])),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [names, setNames] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(switches.map((item) => [item.mac, item.label])),
  );
  const [editingMac, setEditingMac] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  // Only one gesture card, and one Simple channel row, open on the page at a time.
  const [openGesture, setOpenGesture] = useState<string | null>(null);
  const [openChannel, setOpenChannel] = useState<string | null>(null);

  const selected = switches.find((item) => item.mac === selectedMac) ?? null;
  const round = isRoundItem(selected);
  const simpleConfigs = selected ? (drafts[selected.mac] ?? []) : [];
  const roundDraft = selected ? roundDrafts[selected.mac] : undefined;
  const dirty = selected ? itemDirty(selected) : false;
  const staleCount = round
    ? staleRoundCount(roundDraft?.recipes ?? [], snapshot)
    : simpleConfigs.filter((config) => isSimpleChannelStale(config, snapshot)).length;
  const dirtyOthers = switches.filter(
    (item) => item.mac !== selected?.mac && itemDirty(item),
  );
  const dirtyCount = dirtyOthers.length + (dirty ? 1 : 0);

  function itemDirty(item: WorkspaceSwitch): boolean {
    if (isRoundItem(item)) {
      const draft = roundDrafts[item.mac];
      const base = roundSaved[item.mac];
      return Boolean(draft && base && !roundDraftsEqual(draft, base));
    }
    return !simpleChannelsEqual(drafts[item.mac] ?? [], saved[item.mac] ?? []);
  }

  function showNotice(text: string | null, tone: Notice["tone"] = "muted") {
    setNotice(text ? { text, tone } : null);
  }

  function setSimpleFor(mac: string, next: SimpleChannelConfig[]) {
    setDrafts((current) => ({ ...current, [mac]: next }));
    showNotice(null);
  }

  function setRoundDraft(mac: string, next: RoundDraft) {
    setRoundDrafts((current) => ({ ...current, [mac]: next }));
    showNotice(null);
  }

  function discard() {
    if (!selected) return;
    if (round) {
      setRoundDrafts((current) => ({
        ...current,
        [selected.mac]: roundSaved[selected.mac] ?? roundDraftOf(selected),
      }));
      showNotice("Reverted to the last saved pages.");
    } else {
      setDrafts((current) => ({ ...current, [selected.mac]: saved[selected.mac] ?? [] }));
      showNotice("Reverted to the last saved channels.");
    }
    setError(null);
    setOpenGesture(null);
  }

  function clearStale() {
    if (!selected) return;
    if (round && roundDraft) {
      setRoundDraft(selected.mac, {
        ...roundDraft,
        recipes: clearStaleRoundRecipes(roundDraft.recipes, snapshot),
      });
    } else {
      setSimpleFor(selected.mac, clearStaleSimple(simpleConfigs, snapshot));
    }
    showNotice("Cleared assignments that are missing from this snapshot.");
  }

  async function saveRound(mac: string): Promise<SaveResult> {
    const draft = roundDrafts[mac];
    if (!draft) return { ok: true };
    if (!isScreenTimeoutSec(draft.screenTimeoutSec)) {
      return { ok: false, error: "Screen timeout must be 0 (always on) or 10–600 seconds." };
    }
    const empty = emptySceneList(draft);
    if (empty) return { ok: false, error: empty };
    const res = await fetch(`/api/switches/${mac}/pages`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pageSwipeAxis: draft.pageSwipeAxis,
        screenTimeoutSec: draft.screenTimeoutSec,
        pages: draft.pages.map((page) => ({
          id: page.id,
          name: page.name,
          theme: page.theme,
          group: page.group,
        })),
        recipes: draft.recipes,
      }),
    });
    const body = (await res.json()) as {
      rev?: number;
      pages?: SwitchPage[];
      recipes?: RoundRecipe[];
      pageSwipeAxis?: RoundDraft["pageSwipeAxis"];
      screenTimeoutSec?: number;
      error?: string;
      details?: string;
    };
    if (!res.ok) {
      return { ok: false, error: body.details ?? body.error ?? "Could not save pages" };
    }
    const next: RoundDraft = {
      pages: body.pages ?? draft.pages,
      recipes: body.recipes ?? draft.recipes,
      pageSwipeAxis: body.pageSwipeAxis ?? draft.pageSwipeAxis,
      screenTimeoutSec: body.screenTimeoutSec ?? draft.screenTimeoutSec,
    };
    setRoundDrafts((current) => ({ ...current, [mac]: next }));
    setRoundSaved((current) => ({ ...current, [mac]: next }));
    return { ok: true, rev: body.rev };
  }

  async function saveSimple(mac: string): Promise<SaveResult> {
    const configs = drafts[mac] ?? [];
    const res = await fetch(`/api/switches/${mac}/channels`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channels: configs.map((config) => ({
          id: config.id,
          kind: config.kind,
          group: { rtype: config.group.rtype, rid: config.group.rid },
          target: config.target,
          scenes: config.scenes.map((item) => item.rid),
          double: config.double,
          hold: config.hold,
        })),
      }),
    });
    const body = (await res.json()) as {
      rev?: number;
      channels?: SimpleChannelConfig[];
      error?: string;
      details?: string;
    };
    if (!res.ok) {
      return { ok: false, error: body.details ?? body.error ?? "Could not save channels" };
    }
    const next = body.channels ?? configs;
    setDrafts((current) => ({ ...current, [mac]: next }));
    setSaved((current) => ({ ...current, [mac]: next }));
    return { ok: true, rev: body.rev };
  }

  async function saveSwitch(item: WorkspaceSwitch): Promise<SaveResult> {
    const result = isRoundItem(item) ? await saveRound(item.mac) : await saveSimple(item.mac);
    if (result.ok && typeof result.rev === "number") {
      setRevs((current) => ({ ...current, [item.mac]: result.rev as number }));
    }
    return result;
  }

  async function saveMany(items: WorkspaceSwitch[]) {
    if (items.length === 0) return;
    setPending(true);
    setError(null);
    showNotice(null);
    try {
      let lastRev: number | undefined;
      for (const item of items) {
        const result = await saveSwitch(item);
        if (!result.ok) {
          setError(items.length > 1 ? `${boardName(item)}: ${result.error}` : result.error);
          return;
        }
        lastRev = result.rev;
      }
      setOpenGesture(null);
      if (selected) setSavedAt(selected.mac);
      showNotice(
        items.length > 1
          ? `Saved ${items.length} switches. Each picks this up on poll, or immediately after reboot.`
          : `Saved · rev ${lastRev}. ${SAVED_TAIL}`,
        "ok",
      );
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  function selectBoard(item: WorkspaceSwitch) {
    if (item.mac === selectedMac) return;
    setSelectedMac(item.mac);
    setEditingMac(null);
    setOpenGesture(null);
    setOpenChannel(null);
    showNotice(null);
    setError(null);
  }

  // Newer uploaded firmware for this board's product, or null when it is current.
  function updateFor(item: WorkspaceSwitch): string | null {
    const latest = latestFirmware[isRoundItem(item) ? "round" : "simple"];
    return compareVersions(item.firmware ?? "", latest) === -1 ? latest : null;
  }

  function boardName(item: WorkspaceSwitch): string {
    return (names[item.mac] || "").trim() || formatMac(item.mac);
  }

  const lightCount = snapshot.lights.length;
  const roomCount = snapshot.rooms.length;
  const sceneCount = snapshot.scenes.length;
  const topologyEmpty = lightCount === 0 && roomCount === 0 && sceneCount === 0;

  const statusText =
    notice?.text ??
    (dirty
      ? "Unsaved changes"
      : round
        ? "Empty gestures do nothing."
        : "Channels without a room do nothing.");
  const statusClass = notice
    ? notice.tone === "ok"
      ? "text-ok"
      : "text-muted"
    : dirty
      ? "text-filament"
      : "text-muted";

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Bridge</h1>
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-muted">
          <span className="font-mono text-foreground">{bridgeid}</span>
          {bridgeIp ? <span className="font-mono">{bridgeIp}</span> : null}
          <span>
            {lightCount} lights · {roomCount} rooms · {sceneCount} scenes
          </span>
          <span>Snapshot {formatWhen(updatedAt)}</span>
        </p>
      </section>

      {error ? (
        <p
          className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {topologyEmpty ? (
        <div className="rounded-xl border border-dashed border-line bg-cream p-5 text-sm text-muted">
          <p className="font-medium text-foreground">No lights yet</p>
          <p className="mt-2">
            A switch paired with this Bridge sends its rooms, lights, and scenes
            when it checks in.
          </p>
        </div>
      ) : null}

      {switches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-cream p-5 text-sm text-muted">
          <p className="font-medium text-foreground">No switches on this Bridge</p>
          <p className="mt-2">
            Set up a board on{" "}
            <Link href="/devices" className="text-filament underline underline-offset-2">
              Devices
            </Link>
            . It shows up here once it pairs with this Bridge.
          </p>
        </div>
      ) : (
        <nav aria-label="Switches" className="flex flex-wrap gap-2">
          {switches.map((item) => {
            const active = item.mac === selectedMac;
            return (
              <button
                key={item.mac}
                type="button"
                aria-current={active ? "true" : undefined}
                onClick={() => selectBoard(item)}
                className={`flex min-w-0 max-w-full flex-col items-start gap-0.5 rounded-xl border px-3.5 py-2 text-left ${
                  active
                    ? "border-filament/60 bg-filament-soft shadow-[0_0_0_1px_var(--filament)]"
                    : "border-line bg-cream hover:border-filament/40"
                }`}
              >
                <span className="flex max-w-full items-center gap-2">
                  <span className="truncate text-sm font-medium">{boardName(item)}</span>
                  {itemDirty(item) ? (
                    <span
                      className="h-2 w-2 shrink-0 rounded-full bg-filament"
                      aria-label="Unsaved changes"
                      title="Unsaved changes"
                    />
                  ) : null}
                </span>
                <span className="text-xs text-muted">
                  {isRoundItem(item) ? "Round" : "Simple"}
                  {item.last_seen_at ? ` · seen ${formatWhen(item.last_seen_at)}` : " · never seen"}
                  {updateFor(item) ? <span className="text-filament"> · update</span> : null}
                </span>
              </button>
            );
          })}
        </nav>
      )}

      {selected ? (
        <section
          aria-label={`${boardName(selected)} settings`}
          className="rounded-xl border border-line bg-cream"
        >
          <header className="flex items-start gap-2 px-5 py-3.5">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <h2 className="flex flex-wrap items-center gap-2 text-base font-medium">
                <span className="truncate">{boardName(selected)}</span>
                <span className="rounded-full border border-line px-2 py-0.5 text-[11px] font-medium text-muted">
                  {round ? "Round" : "Simple"}
                </span>
                {dirty ? (
                  <span className="rounded-full bg-filament-soft px-2 py-0.5 text-[11px] font-medium text-filament">
                    Unsaved
                  </span>
                ) : savedAt === selected.mac ? (
                  <span className="rounded-full bg-ok-soft px-2 py-0.5 text-[11px] font-medium text-ok">
                    Saved
                  </span>
                ) : null}
                {updateFor(selected) ? (
                  <Link
                    href="/devices"
                    title="Plug the board in over USB and install from Devices"
                    className="rounded-full border border-filament/50 px-2 py-0.5 text-[11px] font-medium text-filament hover:bg-filament-soft"
                  >
                    Update to {updateFor(selected)}
                  </Link>
                ) : null}
              </h2>
              <p className="text-xs text-muted">
                <span className="font-mono">{formatMac(selected.mac)}</span>
                {selected.firmware ? ` · firmware ${selected.firmware}` : ""}
                {` · rev ${revs[selected.mac] ?? selected.rev}`}
                {" · "}
                <Link
                  href={round ? "/how-to#round" : "/how-to#simple"}
                  className="text-filament underline underline-offset-2"
                >
                  {round ? "What the screen shows" : "What the LED shows"}
                </Link>
              </p>
            </div>
            <button
              type="button"
              className="mt-0.5 shrink-0 rounded-md p-1.5 text-muted hover:bg-filament-soft hover:text-filament"
              aria-label={`Rename ${boardName(selected)}`}
              onClick={() => setEditingMac(selected.mac)}
            >
              <PencilIcon />
            </button>
          </header>
          {editingMac === selected.mac ? (
            <SwitchRenameForm
              key={selected.mac}
              mac={selected.mac}
              initial={(names[selected.mac] || "").trim()}
              onCancel={() => setEditingMac(null)}
              onSaved={(label) => {
                setNames((current) => ({ ...current, [selected.mac]: label }));
                setEditingMac(null);
              }}
              onError={setError}
            />
          ) : null}

          {round && roundDraft ? (
            <RoundPagesEditor
              key={selected.mac}
              snapshot={snapshot}
              draft={roundDraft}
              openGesture={openGesture}
              onOpenGesture={setOpenGesture}
              onChange={(next) => setRoundDraft(selected.mac, next)}
              onNotice={(text) => showNotice(text)}
            />
          ) : null}

          {!round ? (
            <SimpleChannelsEditor
              key={selected.mac}
              channels={selected.channels}
              configs={simpleConfigs}
              snapshot={snapshot}
              firmware={supportsChannelTypes(selected.firmware)}
              dimSupported={supportsHoldDim(selected.firmware)}
              openChannel={openChannel}
              openGesture={openGesture}
              onOpenChannel={setOpenChannel}
              onOpenGesture={setOpenGesture}
              onChange={(next) => setSimpleFor(selected.mac, next)}
              onNotice={(text) => showNotice(text)}
            />
          ) : null}

          {staleCount > 0 ? (
            <div className="mx-3 mt-3 flex flex-wrap items-center gap-2 px-1">
              <p className="text-xs text-warn">
                {staleCount} assignment{staleCount === 1 ? " is" : "s are"} missing
                from this snapshot. Saving will be rejected until{" "}
                {staleCount === 1 ? "it is" : "they are"} cleared.
              </p>
              <button
                type="button"
                onClick={clearStale}
                className="text-xs font-medium text-warn hover:underline"
              >
                Clear stale
              </button>
            </div>
          ) : null}

          <div className="sticky bottom-3 m-3 flex flex-wrap items-center gap-2 rounded-[10px] border border-line bg-cream/95 px-3 py-2 backdrop-blur">
            <button
              type="button"
              onClick={() => (dirty ? saveMany([selected]) : undefined)}
              disabled={!dirty || pending}
              className="rounded-md bg-filament px-3 py-1.5 text-sm font-medium text-filament-ink disabled:opacity-50"
            >
              {pending ? "Saving…" : round ? "Save pages" : "Save channels"}
            </button>
            <button
              type="button"
              onClick={discard}
              disabled={!dirty || pending}
              className="rounded-md border border-line px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Discard
            </button>
            <span className={`text-xs ${statusClass}`} role="status">
              {statusText}
            </span>
            {dirtyOthers.length > 0 ? (
              <span className="ml-auto flex items-center gap-2.5 text-xs text-muted">
                <span>Also unsaved: {dirtyOthers.map(boardName).join(", ")}</span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    saveMany(switches.filter((item) => itemDirty(item)))
                  }
                  className="rounded-md border border-filament px-2.5 py-[5px] text-[13px] font-medium text-filament disabled:opacity-50"
                >
                  Save all ({dirtyCount})
                </button>
              </span>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function PencilIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M13.586 3.586a2 2 0 0 1 2.828 2.828l-8.486 8.486a2 2 0 0 1-.707.464l-3.04 1.013a.5.5 0 0 1-.64-.64l1.013-3.04a2 2 0 0 1 .464-.707l8.486-8.486ZM15 5l-1-1" />
    </svg>
  );
}

function SwitchRenameForm({
  mac,
  initial,
  onCancel,
  onSaved,
  onError,
}: {
  mac: string;
  initial: string;
  onCancel: () => void;
  onSaved: (label: string | null) => void;
  onError: (message: string | null) => void;
}) {
  const [value, setValue] = useState(initial);
  const [pending, setPending] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    onError(null);
    try {
      const label = value.trim() || null;
      const res = await fetch(`/api/switches/${mac}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      const body = (await res.json()) as { error?: string; details?: string; label?: string | null };
      if (!res.ok) {
        onError(body.details ?? body.error ?? "Could not rename switch");
        return;
      }
      onSaved(body.label ?? label);
    } catch {
      onError("Could not rename switch");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-2 border-t border-line px-5 py-3">
      <label
        className="text-xs font-medium uppercase tracking-[0.12em] text-muted"
        htmlFor={`rename-${mac}`}
      >
        Display name
      </label>
      <input
        id={`rename-${mac}`}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
        maxLength={80}
        autoFocus
        placeholder={formatMac(mac)}
        className="rounded-md border border-line bg-background px-3 py-1.5 text-sm outline-none focus:border-filament"
        disabled={pending}
      />
      <p className="text-xs text-muted">Shown only in this console. The switch keeps using its MAC.</p>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-filament px-3 py-1.5 text-sm font-medium text-filament-ink disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="rounded-md border border-line px-3 py-1.5 text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
