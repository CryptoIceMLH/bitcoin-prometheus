import { useEffect, useState, useRef } from "react";
import { api, NodeInfo, NetworkStatus, HealthInfo, Peer } from "../lib/api";
import { createFireMap, FireMapRenderer } from "../lib/fireMap";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatSpeed(bytesPerSec: number): string {
  const mbps = (bytesPerSec * 8) / 1_000_000;
  if (mbps < 0.1) return "0 Mbps";
  if (mbps >= 1000) return `${(mbps / 1000).toFixed(1)} Gbps`;
  return `${mbps.toFixed(1)} Mbps`;
}

function formatDifficulty(d: number): string {
  if (d >= 1e12) return `${(d / 1e12).toFixed(1)} T`;
  if (d >= 1e9) return `${(d / 1e9).toFixed(1)} B`;
  if (d >= 1e6) return `${(d / 1e6).toFixed(1)} M`;
  if (d >= 1e3) return `${(d / 1e3).toFixed(1)} K`;
  return d.toFixed(0);
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActivityEvent {
  id: number;
  time: number;
  type: "block" | "peer_change" | "mempool" | "sync" | "network";
  message: string;
  icon: string;
}

// ---------------------------------------------------------------------------
// [A] EternalFlame — Unified hero: peer viz + connections donut + fire + block
// ---------------------------------------------------------------------------

function EternalFlame({
  node,
  peers,
  network,
  health,
  blockPulse,
  nodeLocation,
  onLocationSaved,
}: {
  node: NodeInfo | null;
  peers: Peer[];
  network: NetworkStatus | null;
  health: HealthInfo | null;
  blockPulse: boolean;
  nodeLocation: { lat: number; lon: number } | null;
  onLocationSaved: (lat: number, lon: number) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const fireMapRef = useRef<FireMapRenderer | null>(null);
  const [picking, setPicking] = useState(false);

  // Initialize the fire map
  useEffect(() => {
    if (!mapRef.current) return;
    const fm = createFireMap(mapRef.current);
    fireMapRef.current = fm;
    fm.start();
    return () => fm.stop();
  }, []);

  // Update fire map peers
  useEffect(() => {
    if (!fireMapRef.current) return;
    const mapPeers = peers
      .filter((p) => p.lat != null && p.lon != null)
      .map((p) => ({ lat: p.lat!, lon: p.lon!, inbound: p.inbound }));
    fireMapRef.current.setPeers(mapPeers);
  }, [peers]);

  // Update fire map node location
  useEffect(() => {
    if (!fireMapRef.current || !nodeLocation) return;
    fireMapRef.current.setNodeLocation(nodeLocation.lat, nodeLocation.lon);
  }, [nodeLocation]);

  const startPicking = () => {
    if (!fireMapRef.current) return;
    setPicking(true);
    fireMapRef.current.enableLocationPicker((lat, lon) => {
      api.saveNodeLocation(lat, lon).then(() => {
        onLocationSaved(lat, lon);
        setPicking(false);
        fireMapRef.current?.disableLocationPicker();
      }).catch(() => {});
    });
  };

  const cancelPicking = () => {
    setPicking(false);
    fireMapRef.current?.disableLocationPicker();
  };

  // --- Connections Donut ---
  const totalPeers = node?.connections ?? peers.length;
  const clearnetCount = network?.clearnet_peers ?? node?.connections_out ?? 0;
  const onionCount = network?.onion_peers ?? 0;
  const donutR = 52;
  const donutStroke = 12;
  const donutC = 2 * Math.PI * donutR;
  const clearnetFrac = totalPeers > 0 ? clearnetCount / totalPeers : 1;
  const onionFrac = totalPeers > 0 ? onionCount / totalPeers : 0;
  const clearnetDash = clearnetFrac * donutC;
  const onionDash = onionFrac * donutC;

  // Sync
  const pct = node ? Math.min(node.verification_progress * 100, 100) : 0;
  const synced = pct >= 99.9;

  return (
    <div
      className={`relative hero-fire-bg glass-card glass-card-no-lift overflow-hidden ${
        blockPulse ? "block-pulse-active" : ""
      }`}
    >
      {/* Header row */}
      <div className="relative z-10 flex items-center justify-between px-4 sm:px-6 lg:px-8 pt-5">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-gray-300">Dashboard</h1>
          {node && (
            <span
              className={`px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider ${
                node.chain === "main"
                  ? "bg-fire-amber/20 text-fire-amber"
                  : node.chain === "test"
                  ? "bg-blue-500/20 text-blue-400"
                  : node.chain === "signet"
                  ? "bg-purple-500/20 text-purple-400"
                  : "bg-gray-500/20 text-gray-400"
              }`}
            >
              {node.chain === "main"
                ? "Mainnet"
                : node.chain === "test"
                ? "Testnet"
                : node.chain}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {node?.network_active !== undefined && (
            <span
              className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full ${
                node.network_active
                  ? "bg-green-500/15 text-green-400"
                  : "bg-red-500/15 text-red-400"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  node.network_active ? "bg-green-400" : "bg-red-400"
                }`}
              />
              {node.network_active ? "Online" : "Offline"}
            </span>
          )}
        </div>
      </div>

      {/* === FULL-WIDTH Fire Map === */}
      <div className="relative z-10 px-4 lg:px-6 mt-3">
        <div className="relative rounded-lg overflow-hidden border border-white/5" style={{ background: "#0a0a0a" }}>
          <div
            ref={mapRef}
            style={{ height: "380px", width: "100%" }}
          />
          {/* Overlay: Uptime (top-left) */}
          <div className="absolute top-3 left-4" style={{ zIndex: 600 }}>
            <p className="flex items-center gap-2 text-sm font-medium text-green-400">
              <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]" />
              Running for {formatUptime(health?.uptime ?? node?.uptime ?? 0)}
            </p>
          </div>
          {/* Overlay: Set Node Location */}
          {!nodeLocation && !picking && (
            <div className="absolute top-3 right-4" style={{ zIndex: 600 }}>
              <button
                onClick={startPicking}
                className="px-3 py-1.5 text-xs font-medium bg-fire-orange/20 text-fire-amber border border-fire-amber/30 rounded-lg hover:bg-fire-orange/30 transition-colors"
              >
                Set Node Location
              </button>
            </div>
          )}
          {picking && (
            <div className="absolute top-3 right-4 flex items-center gap-2" style={{ zIndex: 600 }}>
              <span className="text-xs text-fire-amber">Drag pin to your location</span>
              <button
                onClick={cancelPicking}
                className="px-2 py-1 text-xs font-medium bg-gray-700/50 text-gray-300 rounded hover:bg-gray-600/50 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* === Bottom row: Block Height (left) + Connections (right) === */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 px-6 lg:px-8 pt-4 pb-5">
        {/* LEFT: Block height */}
        <div className="text-center lg:text-left">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">
            Block Height
          </p>
          <p
            className={`text-3xl lg:text-4xl font-bold fire-glow text-fire-amber tabular-nums tracking-tight ${
              blockPulse ? "block-text-flash" : ""
            }`}
          >
            {node ? formatNumber(node.blocks) : "---"}
          </p>
          {node?.bestblockhash && (
            <p className="text-[10px] text-gray-600 mt-1 font-mono truncate max-w-xl">
              {node.bestblockhash}
            </p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            {node?.user_agent || "Loading..."}
          </p>
        </div>

        {/* RIGHT: Connections donut + breakdown */}
        <div className="flex items-center gap-5">
          <svg width="120" height="120" viewBox="0 0 120 120" className="shrink-0">
            <circle cx="60" cy="60" r={donutR} fill="none" stroke="#2a2a2a" strokeWidth={donutStroke} />
            <circle
              cx="60" cy="60" r={donutR}
              fill="none" stroke="#FF8C00" strokeWidth={donutStroke}
              strokeLinecap="round"
              strokeDasharray={`${clearnetDash} ${donutC}`}
              strokeDashoffset={0}
              transform="rotate(-90 60 60)"
              style={{ transition: "stroke-dasharray 0.8s ease" }}
            />
            {onionCount > 0 && (
              <circle
                cx="60" cy="60" r={donutR}
                fill="none" stroke="#a855f7" strokeWidth={donutStroke}
                strokeLinecap="round"
                strokeDasharray={`${onionDash} ${donutC}`}
                strokeDashoffset={-clearnetDash}
                transform="rotate(-90 60 60)"
                style={{ transition: "stroke-dasharray 0.8s ease, stroke-dashoffset 0.8s ease" }}
              />
            )}
            <text x="60" y="55" textAnchor="middle" fill="#e6e6e6" fontSize="22" fontWeight="700">{totalPeers}</text>
            <text x="60" y="72" textAnchor="middle" fill="#888" fontSize="10">Peers</text>
          </svg>

          <div className="space-y-1.5">
            <h3 className="text-sm font-bold text-gray-200 mb-2">Connections</h3>
            <div className="flex items-center justify-between gap-6">
              <span className="flex items-center gap-2 text-xs text-gray-300">
                <span className="w-2 h-2 rounded-full bg-fire-amber" /> Clearnet
              </span>
              <span className="text-xs font-semibold text-gray-200 tabular-nums">{clearnetCount}</span>
            </div>
            <div className="flex items-center justify-between gap-6">
              <span className="flex items-center gap-2 text-xs text-gray-300">
                <span className="w-2 h-2 rounded-full bg-purple-500" /> Tor
              </span>
              <span className="text-xs font-semibold text-purple-400 tabular-nums">{onionCount}</span>
            </div>
            <div className="flex items-center justify-between gap-6">
              <span className="flex items-center gap-2 text-xs text-gray-500">
                <span className="w-2 h-2 rounded-full bg-gray-600" /> I2P
              </span>
              <span className="text-xs font-semibold text-gray-600 tabular-nums">0</span>
            </div>
          </div>
        </div>
      </div>

      {/* === Sync Progress Bar === */}
      <div className="relative z-10 px-6 lg:px-8 pb-5">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-gray-500">Blockchain Sync</p>
          <p className={`text-xs font-bold ${synced ? "text-green-400" : "text-fire-amber"}`}>
            {synced ? "Synchronized" : `${pct.toFixed(1)}%`}
          </p>
        </div>
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000 ease-out"
            style={{
              width: `${Math.max(pct, 0.5)}%`,
              background: synced
                ? "linear-gradient(90deg, #22c55e, #4ade80)"
                : "linear-gradient(90deg, #FF4500, #FF8C00, #FFBF00)",
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// [B] Genesis Quote
// ---------------------------------------------------------------------------

function GenesisQuote() {
  return (
    <div className="genesis-quote">
      <p className="text-sm italic text-gray-500 leading-relaxed">
        &ldquo;The Times 03/Jan/2009 Chancellor on brink of second bailout for
        banks.&rdquo;
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// [D] ChainStats — Dense info panel
// ---------------------------------------------------------------------------

function ChainStats({
  node,
  health,
  recvSpeed,
  sentSpeed,
  expanded,
  onToggle,
}: {
  node: NodeInfo | null;
  health: HealthInfo | null;
  recvSpeed: number;
  sentSpeed: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  if (!node) return null;

  const rows: { label: string; value: string; color?: string }[] = [
    { label: "Difficulty", value: formatDifficulty(node.difficulty), color: "text-fire-amber" },
    {
      label: "Best Block",
      value: node.bestblockhash
        ? `${node.bestblockhash.slice(0, 8)}...${node.bestblockhash.slice(-8)}`
        : "---",
    },
    { label: "User Agent", value: node.user_agent },
    {
      label: "DB Cache",
      value: health ? `${formatNumber(health.dbcache_mb)} MB` : "---",
    },
    {
      label: "Pruning",
      value: health ? (health.pruning_enabled ? "Enabled" : "Disabled") : "---",
      color: health?.pruning_enabled ? "text-fire-amber" : "text-gray-400",
    },
    {
      label: "Banned Peers",
      value: health ? `${health.banned_peers}` : "---",
      color: health && health.banned_peers > 0 ? "text-red-400" : "text-gray-400",
    },
    {
      label: "Downloaded",
      value: health ? formatBytes(health.bytes_recv) : "---",
      color: "text-green-400",
    },
    {
      label: "Uploaded",
      value: health ? formatBytes(health.bytes_sent) : "---",
      color: "text-fire-amber",
    },
    {
      label: "DL Speed",
      value: formatSpeed(recvSpeed),
      color: "text-green-400",
    },
    {
      label: "UL Speed",
      value: formatSpeed(sentSpeed),
      color: "text-fire-amber",
    },
  ];

  return (
    <div className="glass-card glass-card-fire-top p-5">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between text-left"
      >
        <h3 className="text-sm font-semibold text-gray-300">Chain Stats</h3>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
            expanded ? "rotate-180" : ""
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="mt-3">
          {rows.map((row) => (
            <div key={row.label} className="stat-row px-1">
              <span className="text-xs text-gray-500">{row.label}</span>
              <span
                className={`text-xs font-medium tabular-nums ${
                  row.color || "text-gray-200"
                } ${row.label === "Best Block" ? "font-mono" : ""}`}
              >
                {row.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// [E] ActivityFeed — Vertical live event feed
// ---------------------------------------------------------------------------

function ActivityFeed({
  events,
  expanded,
  onToggle,
}: {
  events: ActivityEvent[];
  expanded: boolean;
  onToggle: () => void;
}) {
  if (events.length === 0) return null;

  const formatTime = (ts: number) => {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  const borderColors: Record<string, string> = {
    block: "border-l-fire-gold",
    peer_change: "border-l-blue-400",
    mempool: "border-l-purple-400",
    sync: "border-l-green-400",
    network: "border-l-fire-amber",
  };

  return (
    <div className="glass-card p-5">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-300">
            Live Activity{" "}
            <span className="text-gray-500 font-normal">({events.length})</span>
          </h3>
          <span className="flex items-center gap-1.5 text-[10px] text-gray-500">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            LIVE
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
            expanded ? "rotate-180" : ""
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {expanded && (
        <div className="activity-feed-vertical space-y-1.5 mt-3">
          {events.map((event) => (
            <div
              key={event.id}
              className={`flex items-center gap-3 border-l-2 ${
                borderColors[event.type] || "border-l-gray-600"
              } pl-3 py-1.5 feed-item-enter-v`}
            >
              <span className="text-sm flex-shrink-0">{event.icon}</span>
              <span className="text-xs text-gray-300 flex-1">
                {event.message}
              </span>
              <span className="text-[10px] text-gray-600 flex-shrink-0 tabular-nums">
                {formatTime(event.time)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// [F] PeerRow — Table row for peer list
// ---------------------------------------------------------------------------

function PeerRow({ peer }: { peer: Peer }) {
  const isOnion = peer.addr?.includes(".onion");
  return (
    <tr
      className={`border-b border-white/5 hover:bg-surface-hover/30 ${
        isOnion ? "bg-purple-500/5" : ""
      }`}
    >
      <td className="py-2 px-3 text-sm">
        <span className="font-mono text-xs">{peer.addr}</span>
        {isOnion && (
          <span className="ml-2 text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">
            TOR
          </span>
        )}
      </td>
      <td className="py-2 px-3 text-sm text-gray-400">{peer.subver}</td>
      <td className="py-2 px-3 text-sm">
        <span
          className={`text-xs px-2 py-0.5 rounded ${
            peer.inbound
              ? "bg-blue-500/20 text-blue-400"
              : "bg-fire-amber/20 text-fire-amber"
          }`}
        >
          {peer.inbound ? "IN" : "OUT"}
        </span>
      </td>
      <td className="py-2 px-3 text-sm text-gray-500">
        {peer.connection_type}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

export default function Dashboard() {
  const [node, setNode] = useState<NodeInfo | null>(null);
  const [network, setNetwork] = useState<NetworkStatus | null>(null);
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [recvSpeed, setRecvSpeed] = useState(0);
  const [sentSpeed, setSentSpeed] = useState(0);
  const prevHealth = useRef<{
    bytes_recv: number;
    bytes_sent: number;
    time: number;
  } | null>(null);

  // Node geolocation (for fire map arc origin)
  const [nodeLocation, setNodeLocation] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    api.getNodeLocation().then((loc) => {
      if (loc.lat != null && loc.lon != null) {
        setNodeLocation({ lat: loc.lat, lon: loc.lon });
      }
    }).catch(() => {});
  }, []);

  // Activity + animation state
  const [blockPulse, setBlockPulse] = useState(false);
  const [activityLog, setActivityLog] = useState<ActivityEvent[]>([]);
  const [peersExpanded, setPeersExpanded] = useState(false);
  const [activityExpanded, setActivityExpanded] = useState(false);
  const [statsExpanded, setStatsExpanded] = useState(true);
  const prevBlockHeight = useRef<number | null>(null);
  const prevPeerCount = useRef<number | null>(null);
  const prevMempoolSize = useRef<number | null>(null);
  const activityIdRef = useRef(0);

  const addActivity = (event: Omit<ActivityEvent, "id" | "time">) => {
    activityIdRef.current += 1;
    setActivityLog((prev) => [
      { ...event, id: activityIdRef.current, time: Date.now() },
      ...prev.slice(0, 19),
    ]);
  };

  const fetchAll = async () => {
    try {
      const [n, net, h, p] = await Promise.all([
        api.getNode(),
        api.getNetwork(),
        api.getHealth(),
        api.getPeers().catch(() => [] as Peer[]),
      ]);
      setNode(n);
      setNetwork(net);
      setHealth(h);
      setPeers(p);
      setError(null);

      // Live speed calculation
      const now = Date.now();
      if (prevHealth.current && h) {
        const elapsed = (now - prevHealth.current.time) / 1000;
        if (elapsed > 1) {
          setRecvSpeed(
            Math.max(
              0,
              (h.bytes_recv - prevHealth.current.bytes_recv) / elapsed
            )
          );
          setSentSpeed(
            Math.max(
              0,
              (h.bytes_sent - prevHealth.current.bytes_sent) / elapsed
            )
          );
        }
      }
      if (h) {
        prevHealth.current = {
          bytes_recv: h.bytes_recv,
          bytes_sent: h.bytes_sent,
          time: now,
        };
      }

      // --- Activity events ---

      if (prevBlockHeight.current === null) {
        addActivity({
          type: "network",
          message: "Connected to node",
          icon: "\u{1F525}",
        });
      }

      // Block height change
      if (
        prevBlockHeight.current !== null &&
        n.blocks > prevBlockHeight.current
      ) {
        const blocksAdv = n.blocks - prevBlockHeight.current;
        addActivity({
          type: "block",
          message:
            blocksAdv > 1
              ? `+${blocksAdv} blocks (${formatNumber(n.blocks)})`
              : `New block #${formatNumber(n.blocks)}`,
          icon: "\u26CF",
        });
        setBlockPulse(true);
        setTimeout(() => setBlockPulse(false), 1500);
      }
      prevBlockHeight.current = n.blocks;

      // Peer count change
      if (
        prevPeerCount.current !== null &&
        p.length !== prevPeerCount.current
      ) {
        const diff = p.length - prevPeerCount.current;
        addActivity({
          type: "peer_change",
          message:
            diff > 0
              ? `+${diff} peer${diff > 1 ? "s" : ""} connected`
              : `${diff} peer${Math.abs(diff) > 1 ? "s" : ""} disconnected`,
          icon: diff > 0 ? "\u{1F517}" : "\u{1F50C}",
        });
      }
      prevPeerCount.current = p.length;

      // Mempool milestones
      const prevK = Math.floor((prevMempoolSize.current || 0) / 1000);
      const currK = Math.floor(n.mempool_transactions / 1000);
      if (
        prevMempoolSize.current !== null &&
        currK !== prevK &&
        currK > 0
      ) {
        addActivity({
          type: "mempool",
          message: `Mempool crossed ${currK}k transactions`,
          icon: "\u{1F4CB}",
        });
      }
      prevMempoolSize.current = n.mempool_transactions;
    } catch {
      setError("Unable to connect to node. Is prometheusd running?");
    }
  };

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 5000);
    return () => clearInterval(interval);
  }, []);

  // --- Error state ---
  if (error && !node) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="glass-card p-8 text-center max-w-md">
          <div className="text-fire-orange text-4xl mb-4">&#9888;</div>
          <h2 className="text-xl font-bold text-gray-200 mb-2">
            Node Unavailable
          </h2>
          <p className="text-gray-400 text-sm">{error}</p>
          <button
            onClick={fetchAll}
            className="mt-4 px-4 py-2 bg-fire-orange/20 text-fire-amber rounded-lg hover:bg-fire-orange/30 transition-colors text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* [A] Hero — Unified command center */}
      <EternalFlame node={node} peers={peers} network={network} health={health} blockPulse={blockPulse} nodeLocation={nodeLocation} onLocationSaved={(lat, lon) => setNodeLocation({ lat, lon })} />

      {/* [B] Genesis Quote */}
      <GenesisQuote />

      {/* [C] Chain Stats */}
      <ChainStats
        node={node}
        health={health}
        recvSpeed={recvSpeed}
        sentSpeed={sentSpeed}
        expanded={statsExpanded}
        onToggle={() => setStatsExpanded(!statsExpanded)}
      />

      {/* [E] Live Activity Feed */}
      <ActivityFeed events={activityLog} expanded={activityExpanded} onToggle={() => setActivityExpanded(!activityExpanded)} />

      {/* [F] Peer Table (collapsible) */}
      {peers.length > 0 && (
        <div className="glass-card p-5">
          <button
            onClick={() => setPeersExpanded(!peersExpanded)}
            className="w-full flex items-center justify-between text-left"
          >
            <h3 className="text-sm font-semibold text-gray-300">
              Connected Peers{" "}
              <span className="text-gray-500 font-normal">
                ({peers.length})
              </span>
            </h3>
            <svg
              className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
                peersExpanded ? "rotate-180" : ""
              }`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {peersExpanded && (
            <div className="overflow-x-auto mt-4">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10 text-left">
                    <th className="py-2 px-3 text-xs text-gray-500 font-medium">
                      Address
                    </th>
                    <th className="py-2 px-3 text-xs text-gray-500 font-medium">
                      User Agent
                    </th>
                    <th className="py-2 px-3 text-xs text-gray-500 font-medium">
                      Direction
                    </th>
                    <th className="py-2 px-3 text-xs text-gray-500 font-medium">
                      Type
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {peers.slice(0, 50).map((p) => (
                    <PeerRow key={p.id} peer={p} />
                  ))}
                </tbody>
              </table>
              {peers.length > 50 && (
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Showing 50 of {peers.length} peers
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
