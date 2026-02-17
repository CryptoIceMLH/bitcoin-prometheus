const BASE = "/api";

async function fetchJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface NodeInfo {
  version: string;
  user_agent: string;
  chain: string;
  blocks: number;
  bestblockhash: string;
  difficulty: number;
  verification_progress: number;
  mempool_transactions: number;
  mempool_bytes: number;
  mempool_usage: number;
  connections: number;
  connections_in: number;
  connections_out: number;
  network_active: boolean;
  uptime: number;
}

export interface MempoolStats {
  size: number;
  bytes: number;
  usage: number;
  total_fee: number;
  maxmempool: number;
  mempoolminfee: number;
  minrelaytxfee: number;
  unbroadcastcount: number;
}

export interface NetworkStatus {
  tor_reachable: boolean;
  listen: boolean;
  network_active: boolean;
  onion_peers: number;
  clearnet_peers: number;
  total_peers: number;
  blocksonly: boolean;
}

export interface Peer {
  id: number;
  addr: string;
  subver: string;
  inbound: boolean;
  synced_headers: number;
  synced_blocks: number;
  connection_type: string;
  lat: number | null;
  lon: number | null;
  country: string | null;
}

export interface HealthInfo {
  uptime: number;
  bytes_recv: number;
  bytes_sent: number;
  banned_peers: number;
  dbcache_mb: number;
  pruning_enabled: boolean;
}

export type NetworkType = "ipv4" | "ipv6" | "onion" | "i2p";

export type DebugCategory =
  | "net" | "mempool" | "validation" | "rpc" | "http"
  | "addrman" | "bench" | "cmpctblock" | "coindb" | "estimatefee"
  | "mempoolrej" | "proxy" | "prune" | "reindex" | "tor" | "zmq";

export interface PolicySettings {
  // OP_RETURN / Data Carrier
  datacarrier: boolean;
  datacarriersize: number;

  // Storage & Performance
  dbcache: number;
  prune: number;
  txindex: boolean;
  par: number;

  // Mempool Policy
  maxmempool: number;
  mempoolexpiry: number;
  minrelaytxfee: number;
  incrementalrelayfee: number;
  limitancestorcount: number;
  limitdescendantcount: number;
  permitbaremultisig: boolean;
  bytespersigop: number;

  // Network & Privacy
  maxconnections: number;
  listen: boolean;
  blocksonly: boolean;
  maxuploadtarget: number;
  peerbloomfilters: boolean;
  proxy: string;
  onlynet: NetworkType[];
  upnp: boolean;
  natpmp: boolean;
  bantime: number;

  // Peer Management
  addnode: string[];

  // Mining & Relay
  blockmaxweight: number;
  blockmintxfee: number;

  // RPC & Server
  rpcthreads: number;
  rpcworkqueue: number;

  // Logging
  debug: DebugCategory[];
  logips: boolean;
  logtimestamps: boolean;
}

export interface SaveResult {
  ok: boolean;
  applied: string[];
  config_written: boolean;
  errors: string[];
}

export interface NodeLocation {
  lat: number;
  lon: number;
  country: string;
}

export interface RpcCredentials {
  rpcUser: string;
  rpcPassword: string;
  dashboardPassword: string;
}

export const api = {
  // Auth
  getCredentials: () => fetchJSON<RpcCredentials>("/auth/credentials"),

  // Node
  getNode: () => fetchJSON<NodeInfo>("/node"),
  getNodeLocation: () => fetchJSON<NodeLocation>("/node/location"),
  getMempool: () => fetchJSON<MempoolStats>("/mempool"),
  getNetwork: () => fetchJSON<NetworkStatus>("/network"),
  getPeers: () => fetchJSON<Peer[]>("/network/peers"),
  getHealth: () => fetchJSON<HealthInfo>("/health"),
  getSettings: () => fetchJSON<PolicySettings>("/settings"),
  saveSettings: async (settings: PolicySettings): Promise<SaveResult> => {
    const res = await fetch(`${BASE}/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    if (!res.ok) {
      throw new Error(`Save failed: ${res.status}`);
    }
    return res.json() as Promise<SaveResult>;
  },
  restartNode: async (): Promise<{ ok: boolean; message: string }> => {
    const res = await fetch(`${BASE}/node/restart`, {
      method: "POST",
    });
    if (!res.ok) {
      throw new Error(`Restart failed: ${res.status}`);
    }
    return res.json() as Promise<{ ok: boolean; message: string }>;
  },
};
