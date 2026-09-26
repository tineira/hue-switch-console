"use client";

// One gesture (Tap, Double tap, Click, Hold, …) configured in place: a header with the
// summary sentence, and when open only the choices that are valid for it.
// Design: docs/specs/design-bridge-v2/README.md, "Gesture picker".

import { groupLights, groupScenes, type GestureAction } from "@/lib/gestures";
import { MAX_SCENE_LIST, sceneListItem } from "@/lib/pages";
import type {
  PageGroup,
  RecipeTarget,
  SceneListItem,
  TopologySnapshot,
} from "@/lib/types";

export type GestureOption = {
  value: GestureAction;
  label: string;
  disabled?: boolean;
};

const TARGET_ACTIONS: GestureAction[] = ["toggle", "on", "off", "dim", "onoff"];

export function choiceClass(selected: boolean): string {
  return `rounded-md border px-3 py-1.5 text-sm ${
    selected ? "border-filament bg-filament-soft" : "border-line hover:border-filament/50"
  }`;
}

function moveItem<T>(items: T[], index: number, dir: -1 | 1): T[] {
  const to = index + dir;
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

export function GesturePicker({
  label,
  summary,
  muted,
  open,
  onToggle,
  options,
  action,
  onAction,
  fixedTarget = false,
  group,
  snapshot,
  target,
  onTarget,
  scenes,
  onScenes,
}: {
  label: string;
  summary: string;
  /** The gesture does nothing: the summary is muted. */
  muted: boolean;
  open: boolean;
  onToggle: () => void;
  /** Omitted for target-only slots (On / Off, Click). */
  options?: GestureOption[];
  action: GestureAction;
  onAction?: (action: GestureAction) => void;
  /** The action has a fixed target (hold turn off): no light chips. */
  fixedTarget?: boolean;
  group: PageGroup;
  snapshot: TopologySnapshot;
  target: RecipeTarget | null;
  onTarget: (target: RecipeTarget) => void;
  scenes: SceneListItem[];
  onScenes: (scenes: SceneListItem[]) => void;
}) {
  const room = snapshot.rooms.find((item) => item.id === group.rid);
  const roomName = room?.name ?? "this group";
  const showTargets = TARGET_ACTIONS.includes(action) && !fixedTarget;
  const showScenes = action === "scenes";

  return (
    <div
      className={`rounded-[10px] border ${
        open ? "border-filament bg-background" : "border-line"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full flex-wrap items-baseline gap-x-3.5 gap-y-1 px-4 py-3.5 text-left"
      >
        <span className="w-[88px] shrink-0 text-xs font-medium text-muted">{label}</span>
        <span
          className={`min-w-0 flex-[1_1_200px] text-[15px] text-pretty ${
            muted ? "text-muted" : "text-foreground"
          }`}
        >
          {summary}
        </span>
        <span className="text-xs font-medium text-filament">{open ? "Done" : "Change"}</span>
      </button>

      {open ? (
        <div className="flex flex-col gap-3.5 px-4 pb-4">
          {options && onAction ? (
            <div className="flex flex-wrap gap-1.5">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={option.disabled}
                  onClick={() => {
                    if (option.value !== action) onAction(option.value);
                  }}
                  className={`${choiceClass(option.value === action)} disabled:opacity-40`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          ) : null}

          {showTargets ? (
            <div className="flex flex-col gap-2">
              <span className="text-xs text-muted">Which lights in {roomName}</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    onTarget({ rtype: "grouped_light", rid: group.groupedLightRid })
                  }
                  className={`inline-flex items-baseline gap-2 ${choiceClass(
                    target?.rtype === "grouped_light",
                  )}`}
                >
                  <span>Whole {group.rtype}</span>
                  <span className="text-xs text-muted">all lights</span>
                </button>
                {groupLights(snapshot, group).map((light) => (
                  <button
                    key={light.id}
                    type="button"
                    onClick={() => onTarget({ rtype: "light", rid: light.id })}
                    className={choiceClass(
                      target?.rtype === "light" && target.rid === light.id,
                    )}
                  >
                    {light.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {showScenes ? (
            <SceneChooser
              roomName={roomName}
              group={group}
              snapshot={snapshot}
              scenes={scenes}
              onScenes={onScenes}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SceneChooser({
  roomName,
  group,
  snapshot,
  scenes,
  onScenes,
}: {
  roomName: string;
  group: PageGroup;
  snapshot: TopologySnapshot;
  scenes: SceneListItem[];
  onScenes: (scenes: SceneListItem[]) => void;
}) {
  const available = groupScenes(snapshot, group);
  const full = scenes.length >= MAX_SCENE_LIST;

  if (available.length === 0) {
    return (
      <p className="text-xs text-muted">
        {roomName} has no scenes. Create one in the Hue app; it shows up here
        after the next snapshot.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs text-muted">
        {scenes.length > 0
          ? `${scenes.length} of ${MAX_SCENE_LIST} · click order is cycle order`
          : `Click scenes in ${roomName} in the order to cycle them. Up to ${MAX_SCENE_LIST}.`}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {available.map((scene) => {
          const index = scenes.findIndex((item) => item.rid === scene.id);
          const picked = index >= 0;
          const blocked = full && !picked;
          return (
            <button
              key={scene.id}
              type="button"
              disabled={blocked}
              onClick={() =>
                onScenes(
                  picked
                    ? scenes.filter((item) => item.rid !== scene.id)
                    : [...scenes, sceneListItem(snapshot, scene.id)],
                )
              }
              className={`inline-flex items-center gap-2 disabled:opacity-40 ${choiceClass(picked)}`}
            >
              {picked ? (
                <span className="inline-grid h-[18px] min-w-[18px] place-items-center rounded-full bg-filament text-[11px] font-semibold text-filament-ink">
                  {index + 1}
                </span>
              ) : null}
              <span>{scene.name}</span>
            </button>
          );
        })}
      </div>
      {scenes.length > 1 ? (
        <ol className="flex max-w-[360px] flex-col gap-0.5">
          {scenes.map((item, index) => (
            <li key={item.rid} className="flex items-center gap-2 py-[3px] text-[13px]">
              <span className="w-[18px] font-mono text-xs text-muted">{index + 1}</span>
              <span className="min-w-0 flex-1 truncate">
                {item.name || "Unknown scene"}
              </span>
              <button
                type="button"
                aria-label={`Move ${item.name || "scene"} up`}
                disabled={index === 0}
                onClick={() => onScenes(moveItem(scenes, index, -1))}
                className="px-1 text-xs text-muted disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`Move ${item.name || "scene"} down`}
                disabled={index === scenes.length - 1}
                onClick={() => onScenes(moveItem(scenes, index, 1))}
                className="px-1 text-xs text-muted disabled:opacity-30"
              >
                ↓
              </button>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
