export type ChannelKind = "maintained" | "momentary";
export type ChannelEvent = "on" | "off" | "double_click" | "short";
export type HueAction = "on" | "off" | "recall_scene" | "toggle";
export type TargetRtype = "light" | "grouped_light" | "scene";

export type Channel = {
  id: string;
  gpio: number;
  label: string;
  kind: ChannelKind;
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

export type SwitchProduct = "simple" | "round";
export type PageSwipeAxis = "horizontal" | "vertical";
export type RoundEvent = "short" | "double_click";

export type DimTarget = {
  rtype: "light" | "grouped_light";
  rid: string;
};

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
  dimTarget: DimTarget | null;
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
};
