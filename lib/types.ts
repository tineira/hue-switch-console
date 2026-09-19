export type Light = {
  id: string;
  name: string;
  on?: boolean;
  caps?: string[];
};

export type Room = {
  id: string;
  name: string;
};

export type TopologySnapshot = {
  receivedAt: string;
  bridgeid: string;
  bridgeIp?: string;
  source?: string;
  lights: Light[];
  rooms: Room[];
};

export type StoreFile = {
  snapshots: Record<string, TopologySnapshot>;
};

export type IngestPayload = {
  bridgeid: string;
  bridge_ip?: string;
  source?: string;
  lights: Light[];
  rooms?: Room[];
};
