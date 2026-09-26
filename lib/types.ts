export type ChannelKind = "maintained" | "momentary";
export type ChannelEvent = "on" | "off" | "double_click" | "short";
export type HueAction = "on" | "off" | "recall_scene" | "toggle";
export type TargetRtype = "light" | "grouped_light" | "scene";

/** A pin the Simple firmware registered. `kind` is only sent by firmware < 0.3.0 and is ignored. */
export type Channel = {
  id: string;
  gpio: number;
  label: string;
  kind?: ChannelKind;
};

export type Light = {
  id: string;
  name: string;
  on?: boolean;
  caps?: string[];
};

export type Room = {
  id: string;
  name: string;
  grouped_light_id?: string | null;
  light_ids?: string[];
  rtype?: "room" | "zone";
};

export type Scene = {
  id: string;
  name: string;
  group_rtype: string;
  group_rid: string;
};

export type RecipeTarget = {
  rtype: TargetRtype;
  rid: string;
};

export type Recipe = {
  channelId: string;
  event: ChannelEvent;
  action: HueAction;
  target: RecipeTarget;
};

export type SimpleEvent = "on" | "off" | "double_click" | "short" | "hold";

/** What a push-button double-click or hold does. */
export type SimpleGesture =
  | { action: "on" | "off" | "toggle"; target: RecipeTarget }
  | { action: "recall_scene"; targets: SceneListItem[] };

/** What the user configures per Simple channel (docs/specs/simple-channel-types.md). */
export type SimpleChannelConfig = {
  id: string;
  kind: ChannelKind;
  group: PageGroup;
  /** `light` or `grouped_light` inside the group. */
  target: RecipeTarget;
  /** Double-click scene list (maintained only). */
  scenes: SceneListItem[];
  /** Double-click (momentary only). */
  double: SimpleGesture | null;
  /** Hold (momentary only). On BOOT, null = re-pair with the Bridge. */
  hold: SimpleGesture | null;
};

export type SimpleRecipe = {
  channelId: string;
  event: SimpleEvent;
  action: HueAction;
  target?: RecipeTarget;
  targets?: SceneListItem[];
};

export type SwitchProduct = "simple" | "round";
export type PageSwipeAxis = "horizontal" | "vertical";
export type RoundEvent = "short" | "double_click";

export type PageGroup = {
  rtype: "room" | "zone";
  rid: string;
  groupedLightRid: string;
};

export type DimSet =
  | { mode: "group"; rid: string }
  | { mode: "lights"; rids: string[] };

export type SceneListItem = {
  rtype: "scene";
  rid: string;
  name: string;
};

export type SwitchPage = {
  id: string;
  name: string;
  sortOrder: number;
  theme: string;
  group: PageGroup | null;
  dim: DimSet | null;
};

export type RoundRecipe = {
  pageId: string;
  event: RoundEvent;
  action: HueAction;
  target?: RecipeTarget;
  targets?: SceneListItem[];
};

export type TopologySnapshot = {
  receivedAt: string;
  bridgeid: string;
  bridgeIp?: string;
  source?: string;
  lights: Light[];
  rooms: Room[];
  scenes: Scene[];
};

export type ApiKeyPublic = {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
  /** Switch most recently seen with this key (register or config poll). */
  last_switch_mac: string | null;
  last_switch_label: string | null;
  last_switch_bridgeid: string | null;
};

export type SwitchPublic = {
  mac: string;
  label: string | null;
  firmware: string | null;
  bridgeid: string;
  bridge_ip: string | null;
  channels: Channel[];
  rev: number;
  last_seen_at: string | null;
  product: SwitchProduct;
  pageSwipeAxis: PageSwipeAxis;
  screenTimeoutSec: number;
};
