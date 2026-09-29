"use client";

import {
  RoundPagesEditor,
  type RoundDraft,
} from "@/app/switches/round-pages-editor";
import { SimpleChannelsEditor } from "@/app/switches/simple-channels-editor";
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
} from "@/lib/simple-channels";
import { BridgeContext } from "@/app/switches/bridge-context";
import { minutesSince } from "@/lib/ago";
import { SYNC_REFRESH_MS } from "@/lib/config-sync";
import type { BridgeSwitch, LoadedBridge } from "@/lib/bridge-switches";
import type {
  RoundRecipe,
  SimpleChannelConfig,
  SwitchPage,
  SwitchPublic,
  TopologySnapshot,
} from "@/lib/types";
import { otaCapable, otaErrorText, otaStatus, type OtaStatus } from "@/lib/ota";
import { UpdateNotes } from "@/app/update-notes";
import { firmwareChangelogHref } from "@/lib/changelog-href";
import type { FirmwareNotes } from "@/lib/firmware";
import { notesBetween } from "@/lib/firmware-notes";
import { compareVersions } from "@/lib/web-setup/devices";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type WorkspaceSwitch = BridgeSwitch;

type Notice = { text: string; tone: "ok" | "muted" };

type SaveResult = { ok: true; rev?: number } | { ok: false; error: string };

const SAVED_TAIL = "The switch picks this up on its next check-in.";

type SyncInfo = Pick<
  SwitchPublic,
  | "rev"
  | "applied_rev"
  | "config_status"
  | "rev_changed_at"
  | "next_poll_at"
  | "last_seen_at"
  | "firmware"
  | "firmware_seen_at"
  | "ota_offered_at"
  | "ota_error"
  | "ota_error_at"
>;

function syncOf(item: SyncInfo): SyncInfo {
  return {
    rev: item.rev,
    applied_rev: item.applied_rev,
    config_status: item.config_status,
    rev_changed_at: item.rev_changed_at,
    next_poll_at: item.next_poll_at,
    last_seen_at: item.last_seen_at,
    firmware: item.firmware,
    firmware_seen_at: item.firmware_seen_at,
    ota_offered_at: item.ota_offered_at,
    ota_error: item.ota_error,
    ota_error_at: item.ota_error_at,
  };
}

/**
 * Keeps every switch polling fast while this page is open, and returns each one's
 * config status (docs/specs/finished/config-sync.md §4.6). Null when the request fails.
 */
async function fetchSync(): Promise<Record<string, SyncInfo> | null> {
  try {
    const res = await fetch("/api/switches/sync", { method: "POST" });
    if (!res.ok) return null;
    const body = (await res.json()) as { switches?: (SyncInfo & { mac: string })[] };
    return Object.fromEntries((body.switches ?? []).map((item) => [item.mac, syncOf(item)]));
  } catch {
    return null;
  }
}

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

function formatUntil(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const min = Math.round((then - Date.now()) / 60000);
  if (min < 0) return null;
  if (min < 1) return "in under a minute";
  return `in about ${min} min`;
}

/** A plain left click on a link that leaves the switch pages; modified clicks open elsewhere. */
function leavingLink(event: MouseEvent, switchesPath: string): HTMLAnchorElement | null {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const link = (event.target as Element | null)?.closest?.("a[href]");
  if (!(link instanceof HTMLAnchorElement)) return null;
  if (link.target && link.target !== "_self") return null;
  if (link.hasAttribute("download")) return null;
  const url = new URL(link.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  // `/switches` redirects to a switch inside the same layout, so drafts stay.
  if (url.pathname === switchesPath || url.pathname.startsWith(`${switchesPath}/`)) return null;
  return link;
}

const SWITCHES_PATH = "/switches";

// Boards with recipes poll hourly (docs/definitions.md, "Polling"): three missed polls.
const NOT_SEEN_MIN = 180;

const EMPTY_SNAPSHOT: TopologySnapshot = {
  receivedAt: "",
  bridgeid: "",
  lights: [],
  rooms: [],
  scenes: [],
};

function notSeenText(min: number): string {
  const hours = Math.round(min / 60);
  return hours < 48 ? `${hours} h` : `${Math.round(hours / 24)} days`;
}

/**
 * The editor for every switch in the account, with tabs grouped by Bridge. The URL
 * names the selected switch (`/switches/<mac>`); tabs change it with `pushState`, so
 * drafts on other switches survive and Back / Forward move between switches.
 */
export function SwitchesWorkspace({
  bridges,
  switches,
  latestFirmware,
  releaseNotes,
}: {
  bridges: LoadedBridge[];
  switches: WorkspaceSwitch[];
  latestFirmware: { round: string; simple: string };
  releaseNotes: { round: FirmwareNotes[]; simple: FirmwareNotes[] };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const pathMac = pathname.startsWith(`${SWITCHES_PATH}/`)
    ? pathname.slice(SWITCHES_PATH.length + 1).split("/")[0]
    : null;
  const selectedMac =
    switches.find((item) => item.mac === pathMac)?.mac ?? switches[0]?.mac ?? null;
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
  const [sync, setSync] = useState<Record<string, SyncInfo>>(() =>
    Object.fromEntries(switches.map((item) => [item.mac, syncOf(item)])),
  );
  const [replacing, setReplacing] = useState(false);
  // The switch mac or Bridge id an OTA request is running for.
  const [otaBusy, setOtaBusy] = useState<string | null>(null);
  // The update panel (what changes) and the details row, for the selected switch.
  const [updateOpen, setUpdateOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [names, setNames] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(switches.map((item) => [item.mac, item.label])),
  );
  const [editingMac, setEditingMac] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  // Only one gesture card open on the page at a time.
  const [openGesture, setOpenGesture] = useState<string | null>(null);
  // The switch the open cards, notice and rename form belong to. A tab or Back / Forward
  // changes the URL; reset them during render when it does.
  const [shownMac, setShownMac] = useState(selectedMac);
  if (shownMac !== selectedMac) {
    setShownMac(selectedMac);
    setEditingMac(null);
    setOpenGesture(null);
    setNotice(null);
    setError(null);
    setUpdateOpen(false);
    setDetailsOpen(false);
  }

  const selected = switches.find((item) => item.mac === selectedMac) ?? null;
  const snapshot = selected ? snapshotOf(selected) : EMPTY_SNAPSHOT;
  const round = isRoundItem(selected);
  const simpleConfigs = selected ? (drafts[selected.mac] ?? []) : [];
  const roundDraft = selected ? roundDrafts[selected.mac] : undefined;
  const dirty = selected ? itemDirty(selected) : false;
  const staleCount = selected ? staleFor(selected) : 0;
  const dirtyOthers = switches.filter(
    (item) => item.mac !== selected?.mac && itemDirty(item),
  );
  const dirtyCount = dirtyOthers.length + (dirty ? 1 : 0);
  const dirtyNames = switches.filter((item) => itemDirty(item)).map(boardName);
  const leaveQuestion =
    dirtyNames.length > 0
      ? `Unsaved changes on ${dirtyNames.join(", ")}. Leave without saving?`
      : null;
  const selectedName = selected ? boardName(selected) : null;

  useEffect(() => {
    if (selectedName) document.title = `${selectedName} · Hue switch console`;
  }, [selectedName]);

  // While this page is visible, switches poll fast and their sync status stays current.
  useEffect(() => {
    let alive = true;
    async function refresh() {
      if (document.visibilityState !== "visible") return;
      const next = await fetchSync();
      if (alive && next) setSync(next);
    }
    void refresh();
    const timer = window.setInterval(refresh, SYNC_REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  // Ask before a reload, a tab close, or a link out of the switch pages loses drafts.
  // Tabs between switches keep them, so they do not ask.
  useEffect(() => {
    if (!leaveQuestion) return;
    const question = leaveQuestion;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    function onClick(event: MouseEvent) {
      if (!leavingLink(event, SWITCHES_PATH)) return;
      if (window.confirm(question)) return;
      event.preventDefault();
      event.stopPropagation();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("click", onClick, true);
    };
  }, [leaveQuestion]);

  function snapshotOf(item: WorkspaceSwitch): TopologySnapshot {
    return bridges.find((bridge) => bridge.bridgeid === item.bridgeid)?.snapshot ?? EMPTY_SNAPSHOT;
  }

  // Assignments in the draft that point at something no longer in the Bridge's snapshot.
  function staleFor(item: WorkspaceSwitch): number {
    const itemSnapshot = snapshotOf(item);
    if (isRoundItem(item)) {
      return staleRoundCount(roundDrafts[item.mac]?.recipes ?? [], itemSnapshot);
    }
    return (drafts[item.mac] ?? []).filter((config) => isSimpleChannelStale(config, itemSnapshot))
      .length;
  }

  function syncFor(item: WorkspaceSwitch): SyncInfo {
    return sync[item.mac] ?? syncOf(item);
  }

  function notSeenMin(item: WorkspaceSwitch): number | null {
    const min = minutesSince(syncFor(item).last_seen_at);
    return min !== null && min > NOT_SEEN_MIN ? min : null;
  }

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
      showNotice("Reverted to the last saved switches.");
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
          label: config.label?.trim() || null,
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
      return { ok: false, error: body.details ?? body.error ?? "Could not save switches" };
    }
    const next = body.channels ?? configs;
    setDrafts((current) => ({ ...current, [mac]: next }));
    setSaved((current) => ({ ...current, [mac]: next }));
    return { ok: true, rev: body.rev };
  }

  async function saveSwitch(item: WorkspaceSwitch): Promise<SaveResult> {
    return isRoundItem(item) ? saveRound(item.mac) : saveSimple(item.mac);
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
          ? `Saved ${items.length} switches. Each picks this up on its next check-in.`
          : `Saved · rev ${lastRev}. ${SAVED_TAIL}`,
        "ok",
      );
      const next = await fetchSync();
      if (next) setSync(next);
      // Refresh the server data so Back and the overview show what was saved. The
      // switches layout keeps this component mounted, so drafts on other switches stay.
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function replaceConfig(item: WorkspaceSwitch) {
    const question =
      `${boardName(item)} keeps a newer config than the console has. ` +
      "Replace it with what the console shows? Anything only on the switch is lost.";
    if (!window.confirm(question)) return;
    setReplacing(true);
    setError(null);
    try {
      const res = await fetch(`/api/switches/${item.mac}/replace-config`, { method: "POST" });
      const body = (await res.json()) as { rev?: number; error?: string; details?: string };
      if (!res.ok) {
        setError(body.details ?? body.error ?? "Could not replace the switch's config");
        return;
      }
      const next = await fetchSync();
      if (next) setSync(next);
    } catch {
      setError("Could not replace the switch's config");
    } finally {
      setReplacing(false);
    }
  }

  // One line on whether the switch runs the saved config (docs/specs/finished/config-sync.md §4.6).
  function syncLine(item: WorkspaceSwitch): { text: string; tone: "ok" | "muted" | "warn" } | null {
    const info = syncFor(item);
    switch (info.config_status) {
      case "current":
        return null;
      case "pending": {
        const saved = info.rev_changed_at ? `Saved ${formatWhen(info.rev_changed_at)}` : "Saved";
        const until = formatUntil(info.next_poll_at);
        return {
          text: until
            ? `${saved}, not on the switch yet. It checks in ${until}.`
            : `${saved}, not on the switch yet. It has not checked in since ${formatWhen(info.last_seen_at)}.`,
          tone: "muted",
        };
      }
      case "not_applied":
        return {
          text:
            "Not applied: the switch received this config but did not keep it. " +
            "Connect it over USB and check its serial log.",
          tone: "warn",
        };
      case "ahead":
        return {
          text:
            `Ahead of the console: the switch keeps rev ${info.applied_rev}, newer than ` +
            `this console's rev ${info.rev}, and ignores changes until it is replaced.`,
          tone: "warn",
        };
      default:
        return null;
    }
  }

  function selectBoard(item: WorkspaceSwitch) {
    if (item.mac === selectedMac) return;
    window.history.pushState(null, "", `${SWITCHES_PATH}/${item.mac}`);
  }

  // Newer uploaded firmware for this board's product, or null when it is current.
  function updateFor(item: WorkspaceSwitch): string | null {
    const latest = latestFor(item);
    return compareVersions(syncFor(item).firmware ?? "", latest) === -1 ? latest : null;
  }

  function latestFor(item: WorkspaceSwitch): string {
    return latestFirmware[isRoundItem(item) ? "round" : "simple"];
  }

  // Wi-Fi updates (docs/specs/ota.md §3.1). Null when the switch cannot update over Wi-Fi.
  function otaFor(item: WorkspaceSwitch): OtaStatus | null {
    const info = syncFor(item);
    if (!otaCapable({ product: item.product, firmware: info.firmware })) return null;
    return otaStatus(info, latestFor(item));
  }

  async function otaRequest(key: string, url: string, method: "POST" | "DELETE", failed: string) {
    setOtaBusy(key);
    setError(null);
    try {
      const res = await fetch(url, { method });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string; details?: string };
        setError(body.details ?? body.error ?? failed);
        return;
      }
      const next = await fetchSync();
      if (next) setSync(next);
    } catch {
      setError(failed);
    } finally {
      setOtaBusy(null);
    }
  }

  function offerOta(item: WorkspaceSwitch) {
    return otaRequest(item.mac, `/api/switches/${item.mac}/ota`, "POST", "Could not offer the update");
  }

  function cancelOta(item: WorkspaceSwitch) {
    return otaRequest(item.mac, `/api/switches/${item.mac}/ota`, "DELETE", "Could not cancel the update");
  }

  function offerOtaToBridge(bridgeid: string) {
    return otaRequest(
      bridgeid,
      `/api/bridges/${encodeURIComponent(bridgeid)}/ota`,
      "POST",
      "Could not offer the update",
    );
  }

  // One line on a pending or failed Wi-Fi update.
  function otaLine(item: WorkspaceSwitch): { text: string; tone: "muted" | "warn" } | null {
    const status = otaFor(item);
    const latest = latestFor(item);
    if (status === "offered") {
      const until = formatUntil(syncFor(item).next_poll_at);
      return {
        text:
          `The switch installs ${latest} when it next checks in` +
          `${until ? ` (${until})` : ""}, then restarts. ` +
          (isRoundItem(item)
            ? "It shows the update on its screen while it installs."
            : "Its buttons keep working until then."),
        tone: "muted",
      };
    }
    if (status === "failed") {
      return {
        text:
          `The update to ${latest} didn't finish: ${otaErrorText(syncFor(item).ota_error)}. ` +
          `The switch still runs ${syncFor(item).firmware ?? "its old firmware"} and tries again within an hour.`,
        tone: "warn",
      };
    }
    return null;
  }

  function boardName(item: WorkspaceSwitch): string {
    return (names[item.mac] || "").trim() || formatMac(item.mac);
  }

  // One short state for a tab, only when something needs attention; null when all is well.
  function tabState(item: WorkspaceSwitch): { text: string; tone: string } | null {
    const ota = otaFor(item);
    if (ota === "failed") return { text: "update failed", tone: "text-danger" };
    if (ota === "offered") return { text: "updating", tone: "text-filament" };
    const unseen = notSeenMin(item);
    if (unseen !== null) return { text: `offline ${notSeenText(unseen)}`, tone: "text-warn" };
    if (!syncFor(item).last_seen_at) return { text: "never seen", tone: "text-warn" };
    const status = syncFor(item).config_status;
    if (status === "not_applied") return { text: "not applied", tone: "text-warn" };
    if (status === "ahead") return { text: "ahead", tone: "text-warn" };
    const stale = staleFor(item);
    if (stale > 0) return { text: `${stale} stale`, tone: "text-warn" };
    if (status === "pending") return { text: "pending", tone: "text-filament" };
    return null;
  }

  function renderTab(item: WorkspaceSwitch) {
    const active = item.mac === selectedMac;
    const state = tabState(item);
    const update = updateFor(item);
    return (
      <button
        key={item.mac}
        type="button"
        aria-current={active ? "true" : undefined}
        onClick={() => selectBoard(item)}
        className={`flex min-h-11 min-w-0 max-w-full items-center gap-2 rounded-xl border px-3.5 py-2 text-left ${
          active
            ? "border-filament/60 bg-filament-soft shadow-[0_0_0_1px_var(--filament)]"
            : "border-line bg-cream hover:border-filament/40"
        }`}
      >
        <ProductIcon round={isRoundItem(item)} />
        <span className="truncate text-sm font-medium">{boardName(item)}</span>
        {itemDirty(item) ? (
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-filament"
            aria-label="Unsaved changes"
            title="Unsaved changes"
          />
        ) : null}
        {state ? <span className={`shrink-0 text-xs ${state.tone}`}>{state.text}</span> : null}
        {!state && update ? (
          <span className="shrink-0 text-filament" title={`Update to ${update} available`}>
            <UpdateIcon label={`Update to ${update} available`} />
          </span>
        ) : null}
      </button>
    );
  }

  const statusText =
    notice?.text ??
    (dirty
      ? "Unsaved changes"
      : round
        ? "Empty gestures do nothing."
        : "Unused pins do nothing.");
  const statusClass = notice
    ? notice.tone === "ok"
      ? "text-ok"
      : "text-muted"
    : dirty
      ? "text-filament"
      : "text-muted";

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Switches</h1>
        <Link
          href="/setup"
          className="rounded-md bg-filament px-3 py-1.5 text-sm font-medium text-filament-ink"
        >
          Add a switch
        </Link>
      </section>

      {error ? (
        <p
          className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {bridges.map((bridge) => {
        const onBridge = switches.filter((item) => item.bridgeid === bridge.bridgeid);
        const empty =
          bridge.snapshot.lights.length === 0 &&
          bridge.snapshot.rooms.length === 0 &&
          bridge.snapshot.scenes.length === 0;
        return (
          <section
            key={bridge.bridgeid}
            aria-label={`Bridge ${bridge.bridgeid}`}
            className="flex flex-col gap-2"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <BridgeContext bridge={bridge} />
              {(() => {
                const behind = onBridge.filter((item) => otaFor(item) === "behind").length;
                if (behind === 0) return null;
                return (
                  <button
                    type="button"
                    disabled={otaBusy !== null}
                    onClick={() => offerOtaToBridge(bridge.bridgeid)}
                    className="rounded-md border border-filament/50 px-2.5 py-1 text-xs font-medium text-filament hover:bg-filament-soft disabled:opacity-50"
                  >
                    {otaBusy === bridge.bridgeid ? "Offering…" : `Update all (${behind})`}
                  </button>
                );
              })()}
            </div>
            {empty ? (
              <p className="text-sm text-muted">
                No lights yet. A switch paired with this Bridge sends its rooms,
                lights, and scenes when it checks in.
              </p>
            ) : null}
            {onBridge.length > 0 ? (
              <nav aria-label={`Switches on ${bridge.bridgeid}`} className="flex flex-wrap gap-2">
                {onBridge.map(renderTab)}
              </nav>
            ) : (
              <p className="text-sm text-muted">No switches on this Bridge yet.</p>
            )}
          </section>
        );
      })}

      {selected ? (
        <section
          aria-label={`${boardName(selected)} settings`}
          className="rounded-xl border border-line bg-cream"
        >
          <header className="flex flex-col gap-3 px-5 py-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex min-w-0 items-center gap-2 text-base font-medium">
                <ProductIcon round={round} />
                <span className="truncate">{boardName(selected)}</span>
                <button
                  type="button"
                  className="shrink-0 rounded-md p-1.5 text-muted hover:bg-filament-soft hover:text-filament"
                  aria-label={`Rename ${boardName(selected)}`}
                  onClick={() => setEditingMac(selected.mac)}
                >
                  <PencilIcon />
                </button>
                {dirty ? (
                  <span className="rounded-full bg-filament-soft px-2 py-0.5 text-[11px] font-medium text-filament">
                    Unsaved
                  </span>
                ) : savedAt === selected.mac ? (
                  <span className="rounded-full bg-ok-soft px-2 py-0.5 text-[11px] font-medium text-ok">
                    Saved
                  </span>
                ) : null}
              </h2>
              <div className="flex items-center gap-2">
                <UpdateActions
                  status={otaFor(selected)}
                  latest={latestFor(selected)}
                  usbUpdate={updateFor(selected)}
                  busy={otaBusy === selected.mac}
                  panelOpen={updateOpen}
                  onTogglePanel={() => setUpdateOpen((open) => !open)}
                  onOffer={() => offerOta(selected)}
                  onCancel={() => cancelOta(selected)}
                />
                <button
                  type="button"
                  aria-label="Details"
                  aria-expanded={detailsOpen}
                  onClick={() => setDetailsOpen((open) => !open)}
                  className={`shrink-0 rounded-md border p-1.5 ${
                    detailsOpen
                      ? "border-filament/60 bg-filament-soft text-filament"
                      : "border-line text-muted hover:text-filament"
                  }`}
                >
                  <InfoIcon />
                </button>
              </div>
            </div>
            {(() => {
              const line = syncLine(selected);
              if (!line) return null;
              const tone =
                line.tone === "ok" ? "text-ok" : line.tone === "warn" ? "text-warn" : "text-muted";
              return (
                <p className={`text-sm ${tone}`}>
                  {line.text}
                  {syncFor(selected).config_status === "ahead" ? (
                    <>
                      {" "}
                      <button
                        type="button"
                        disabled={replacing}
                        onClick={() => replaceConfig(selected)}
                        className="font-medium underline underline-offset-2 disabled:opacity-50"
                      >
                        {replacing ? "Replacing…" : "Replace the switch's config"}
                      </button>
                    </>
                  ) : null}
                </p>
              );
            })()}
            {(() => {
              const line = otaLine(selected);
              if (!line) return null;
              return (
                <p className={`text-sm ${line.tone === "warn" ? "text-warn" : "text-muted"}`}>
                  {line.text}
                </p>
              );
            })()}
            {notSeenMin(selected) !== null ? (
              <p className="text-sm text-warn">
                Offline for {notSeenText(notSeenMin(selected) as number)}. Changes and
                updates reach it when it checks in again.
              </p>
            ) : null}
            {updateOpen && updateFor(selected) ? (
              <UpdatePanel
                firmware={syncFor(selected).firmware ?? ""}
                latest={latestFor(selected)}
                notes={notesBetween(
                  releaseNotes[round ? "round" : "simple"],
                  syncFor(selected).firmware ?? "",
                  latestFor(selected),
                )}
                wifi={otaFor(selected) === "behind"}
                round={round}
                mac={selected.mac}
                busy={otaBusy === selected.mac}
                onUpdate={async () => {
                  await offerOta(selected);
                  setUpdateOpen(false);
                }}
                onClose={() => setUpdateOpen(false)}
              />
            ) : null}
            {detailsOpen ? (
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 rounded-lg bg-background px-3.5 py-3 text-xs">
                <dt className="text-muted">Firmware</dt>
                <dd>
                  {syncFor(selected).firmware ?? "Unknown"}
                  {(() => {
                    const firmware = syncFor(selected).firmware;
                    const href = firmware
                      ? firmwareChangelogHref(round ? "round" : "simple", firmware)
                      : null;
                    return href ? (
                      <>
                        {" · "}
                        <Link href={href} className="text-filament underline underline-offset-2">
                          What changed
                        </Link>
                      </>
                    ) : null;
                  })()}
                </dd>
                <dt className="text-muted">Last check-in</dt>
                <dd>{syncFor(selected).last_seen_at ? formatWhen(syncFor(selected).last_seen_at) : "Never"}</dd>
                <dt className="text-muted">Board</dt>
                <dd>
                  {round ? "Round" : "Simple"} · <span className="font-mono">{formatMac(selected.mac)}</span>
                </dd>
                <dt className="text-muted">{round ? "Screen" : "Status light"}</dt>
                <dd>
                  <Link
                    href={`/how-to?product=${round ? "round" : "simple"}#status`}
                    className="text-filament underline underline-offset-2"
                  >
                    {round ? "What the screen shows" : "What the LED shows"}
                  </Link>
                </dd>
              </dl>
            ) : null}
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
              mac={selected.mac}
              channels={selected.channels}
              configs={simpleConfigs}
              snapshot={snapshot}
              firmware={supportsChannelTypes(selected.firmware)}
              openGesture={openGesture}
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
              {pending ? "Saving…" : "Save changes"}
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

const PRIMARY_BUTTON =
  "shrink-0 rounded-md bg-filament px-3 py-1.5 text-sm font-medium text-filament-ink disabled:opacity-50";
const SECONDARY_BUTTON =
  "shrink-0 rounded-md border border-line px-3 py-1.5 text-sm text-muted hover:border-filament/50 hover:text-filament disabled:opacity-50";

/**
 * The firmware action next to a switch's name (docs/specs/ota.md §3.1). Update opens the
 * panel that says what changes; a switch without an OTA client gets the same button, and
 * the panel sends it to Setup. Nothing when the switch runs the current release.
 */
function UpdateActions({
  status,
  latest,
  usbUpdate,
  busy,
  panelOpen,
  onTogglePanel,
  onOffer,
  onCancel,
}: {
  status: OtaStatus | null;
  latest: string;
  usbUpdate: string | null;
  busy: boolean;
  panelOpen: boolean;
  onTogglePanel: () => void;
  onOffer: () => void;
  onCancel: () => void;
}) {
  if (status === "offered" || status === "failed") {
    return (
      <>
        {status === "offered" ? (
          <span className="rounded-md bg-filament-soft px-3 py-1.5 text-sm font-medium text-filament">
            Updating to {latest}…
          </span>
        ) : (
          <button type="button" disabled={busy} onClick={onOffer} className={PRIMARY_BUTTON}>
            {busy ? "Offering…" : "Try again"}
          </button>
        )}
        <button type="button" disabled={busy} onClick={onCancel} className={SECONDARY_BUTTON}>
          {busy && status === "offered" ? "Cancelling…" : "Cancel"}
        </button>
      </>
    );
  }
  if (status === "ahead") {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          if (window.confirm(`Install ${latest}, older than the firmware on this switch?`)) onOffer();
        }}
        className={SECONDARY_BUTTON}
      >
        {busy ? "Offering…" : `Downgrade to ${latest}`}
      </button>
    );
  }
  if (status === "behind" || (status === null && usbUpdate)) {
    return (
      <button
        type="button"
        aria-expanded={panelOpen}
        onClick={onTogglePanel}
        className={PRIMARY_BUTTON}
      >
        Update to {latest}
      </button>
    );
  }
  return null;
}

/** What an update changes, then how it installs: over Wi-Fi now, or once over USB from Setup. */
function UpdatePanel({
  firmware,
  latest,
  notes,
  wifi,
  round,
  mac,
  busy,
  onUpdate,
  onClose,
}: {
  firmware: string;
  latest: string;
  notes: ReturnType<typeof notesBetween>;
  wifi: boolean;
  round: boolean;
  mac: string;
  busy: boolean;
  onUpdate: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-filament/40 bg-filament-soft/40 p-2">
      {notes.length > 0 ? (
        <UpdateNotes installed={firmware} latest={latest} notes={notes} />
      ) : (
        <p className="px-2 pt-1 text-sm text-muted">
          Update from <span className="font-mono">{firmware}</span> to{" "}
          <span className="font-mono">{latest}</span>.
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-filament/30 px-2 pt-3 pb-1">
        <p className="max-w-xl text-sm text-muted">
          {wifi
            ? `The switch installs it when it next checks in, then restarts. Its ${
                round ? "pages" : "buttons"
              }, Wi-Fi and Hue pairing stay as they are.`
            : `This switch runs ${firmware}, which needs a USB cable for this one update. After that it updates over Wi-Fi.`}
        </p>
        <div className="flex items-center gap-2">
          {wifi ? (
            <button type="button" disabled={busy} onClick={onUpdate} className={PRIMARY_BUTTON}>
              {busy ? "Offering…" : "Update now"}
            </button>
          ) : (
            <Link href={`/setup?mac=${mac}`} className={PRIMARY_BUTTON}>
              Open Setup
            </Link>
          )}
          <button type="button" onClick={onClose} className={SECONDARY_BUTTON}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}

/** Round (a dial) or Simple (a board with pins), next to a switch's name. */
function ProductIcon({ round }: { round: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      className="h-4 w-4 shrink-0 text-muted"
      role="img"
      aria-label={round ? "Round" : "Simple"}
    >
      <title>{round ? "Round" : "Simple"}</title>
      {round ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
        </>
      ) : (
        <>
          <rect x="6" y="3" width="12" height="18" rx="2" />
          <path d="M3 7h3M3 12h3M3 17h3M18 7h3M18 12h3M18 17h3" />
        </>
      )}
    </svg>
  );
}

function UpdateIcon({ label }: { label: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      role="img"
      aria-label={label}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16V8M8.5 11.5 12 8l3.5 3.5" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
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
