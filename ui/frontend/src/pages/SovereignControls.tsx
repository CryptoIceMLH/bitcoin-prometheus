import { useEffect, useState } from "react";
import { api, PolicySettings, NetworkType, DebugCategory, RpcCredentials } from "../lib/api";


// ---------------------------------------------------------------------------
// Reusable components
// ---------------------------------------------------------------------------

function Toggle({ label, description, checked, defaultValue, onChange }: {
  label: string; description: string; checked: boolean; defaultValue: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between py-3">
      <div className="flex-1 mr-6">
        <p className="text-sm font-medium text-gray-200">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{description}</p>
        {checked !== defaultValue && (
          <button onClick={() => onChange(defaultValue)} className="text-[10px] text-fire-amber hover:underline mt-1">
            Reset to default ({defaultValue ? "on" : "off"})
          </button>
        )}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 ${checked ? "bg-fire-amber" : "bg-surface-light"}`}
      >
        <span className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </div>
  );
}

function Slider({ label, description, value, defaultValue, min, max, step = 1, unit = "", onChange }: {
  label: string; description: string; value: number; defaultValue: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void;
}) {
  return (
    <div className="py-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-medium text-gray-200">{label}</p>
        <p className="text-sm font-mono text-fire-amber">{value.toLocaleString()}{unit && ` ${unit}`}</p>
      </div>
      <p className="text-xs text-gray-500 mb-2 leading-relaxed">{description}</p>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 bg-surface-light rounded-full appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-fire-amber [&::-webkit-slider-thumb]:cursor-pointer
          [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(255,140,0,0.4)]" />
      <div className="flex justify-between text-[10px] text-gray-600 mt-1">
        <span>{min.toLocaleString()}{unit && ` ${unit}`}</span>
        <span>Default: {defaultValue.toLocaleString()}{unit && ` ${unit}`}</span>
        <span>{max.toLocaleString()}{unit && ` ${unit}`}</span>
      </div>
      {value !== defaultValue && (
        <button onClick={() => onChange(defaultValue)} className="text-[10px] text-fire-amber hover:underline mt-1">Reset to default</button>
      )}
    </div>
  );
}

function TextInput({ label, description, value, defaultValue, placeholder, unit, onChange }: {
  label: string; description: string; value: string; defaultValue: string; placeholder?: string; unit?: string; onChange: (v: string) => void;
}) {
  return (
    <div className="py-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-medium text-gray-200">{label}</p>
        {unit && <span className="text-xs text-gray-500">{unit}</span>}
      </div>
      <p className="text-xs text-gray-500 mb-2 leading-relaxed">{description}</p>
      <input type="text" value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="input-field" />
      {value !== defaultValue && (
        <button onClick={() => onChange(defaultValue)} className="text-[10px] text-fire-amber hover:underline mt-1">
          Reset to default{defaultValue ? ` (${defaultValue})` : ""}
        </button>
      )}
    </div>
  );
}

function MultiCheckbox({ label, description, options, selected, onChange }: {
  label: string; description: string;
  options: Array<{ value: string; label: string; desc?: string }>;
  selected: string[]; onChange: (v: string[]) => void;
}) {
  const toggle = (val: string) => {
    onChange(selected.includes(val) ? selected.filter((s) => s !== val) : [...selected, val]);
  };
  return (
    <div className="py-3">
      <p className="text-sm font-medium text-gray-200 mb-1">{label}</p>
      <p className="text-xs text-gray-500 mb-3 leading-relaxed">{description}</p>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
        {options.map((opt) => (
          <label key={opt.value} className="flex items-center gap-2 cursor-pointer group">
            <input type="checkbox" className="checkbox-fire"
              checked={selected.includes(opt.value)} onChange={() => toggle(opt.value)} />
            <div>
              <span className="text-xs text-gray-300 group-hover:text-gray-100">{opt.label}</span>
              {opt.desc && <p className="text-[10px] text-gray-600">{opt.desc}</p>}
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

function TagInput({ label, description, tags, placeholder, onChange }: {
  label: string; description: string; tags: string[]; placeholder?: string;
  onChange: (tags: string[]) => void;
}) {
  const [input, setInput] = useState("");
  const add = () => {
    const trimmed = input.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
      setInput("");
    }
  };
  const remove = (idx: number) => onChange(tags.filter((_, i) => i !== idx));
  return (
    <div className="py-3">
      <p className="text-sm font-medium text-gray-200 mb-1">{label}</p>
      <p className="text-xs text-gray-500 mb-2 leading-relaxed">{description}</p>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {tags.map((tag, i) => (
            <span key={i} className="tag-badge">{tag}<button onClick={() => remove(i)}>&times;</button></span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input type="text" value={input} placeholder={placeholder}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          className="input-field flex-1" />
        <button onClick={add}
          className="px-4 py-2 bg-surface-light text-gray-300 rounded-lg hover:bg-surface-hover text-sm flex-shrink-0">
          Add
        </button>
      </div>
    </div>
  );
}

function InfoDisplay({ label, description, value, badge, badgeColor = "gray" }: {
  label: string; description: string; value: string; badge?: string;
  badgeColor?: "green" | "amber" | "red" | "gray";
}) {
  const badgeColors = {
    green: "bg-green-500/20 text-green-400",
    amber: "bg-fire-amber/20 text-fire-amber",
    red: "bg-red-500/20 text-red-400",
    gray: "bg-gray-500/20 text-gray-400",
  };
  return (
    <div className="flex items-start justify-between py-3">
      <div className="flex-1 mr-4">
        <p className="text-sm font-medium text-gray-200">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{description}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-sm text-gray-300">{value}</span>
        {badge && <span className={`text-[10px] px-2 py-0.5 rounded-full ${badgeColors[badgeColor]}`}>{badge}</span>}
      </div>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface rounded-xl p-5">
      <h3 className="text-sm font-semibold text-fire-amber uppercase tracking-wider mb-2">{title}</h3>
      <div className="divide-y divide-surface-light/20">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULTS: PolicySettings = {
  datacarrier: true,
  datacarriersize: 83,
  dbcache: 450,
  prune: 0,
  txindex: false,
  par: 0,
  maxmempool: 300,
  mempoolexpiry: 336,
  minrelaytxfee: 0.00001,
  incrementalrelayfee: 0.00001,
  limitancestorcount: 25,
  limitdescendantcount: 25,
  permitbaremultisig: true,
  bytespersigop: 20,
  maxconnections: 125,
  listen: true,
  blocksonly: false,
  maxuploadtarget: 0,
  peerbloomfilters: false,
  proxy: "",
  onlynet: [],
  upnp: false,
  natpmp: false,
  bantime: 86400,
  addnode: [],
  blockmaxweight: 3996000,
  blockmintxfee: 0.00001,
  rpcthreads: 4,
  rpcworkqueue: 64,
  debug: [],
  logips: false,
  logtimestamps: true,
};

const NETWORK_OPTIONS: Array<{ value: string; label: string; desc?: string }> = [
  { value: "ipv4", label: "IPv4", desc: "Standard internet" },
  { value: "ipv6", label: "IPv6", desc: "Next-gen internet" },
  { value: "onion", label: "Tor (.onion)", desc: "Anonymous overlay" },
  { value: "i2p", label: "I2P", desc: "Invisible Internet" },
];

const DEBUG_OPTIONS: Array<{ value: string; label: string; desc?: string }> = [
  { value: "net", label: "Network" },
  { value: "mempool", label: "Mempool" },
  { value: "validation", label: "Validation" },
  { value: "rpc", label: "RPC" },
  { value: "http", label: "HTTP" },
  { value: "tor", label: "Tor" },
  { value: "addrman", label: "Address Manager" },
  { value: "bench", label: "Benchmarks" },
  { value: "cmpctblock", label: "Compact Blocks" },
  { value: "coindb", label: "Coin Database" },
  { value: "estimatefee", label: "Fee Estimation" },
  { value: "mempoolrej", label: "Mempool Rejects" },
  { value: "proxy", label: "Proxy" },
  { value: "prune", label: "Pruning" },
  { value: "reindex", label: "Reindex" },
  { value: "zmq", label: "ZeroMQ" },
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

function CredentialField({ label, value, masked = false }: { label: string; value: string; masked?: boolean }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const display = masked && !revealed ? "\u2022".repeat(Math.min(value.length, 24)) : value;
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex items-center justify-between py-2.5">
      <div className="flex-1 mr-4">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm text-gray-200 font-mono mt-0.5">{display}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {masked && (
          <button onClick={() => setRevealed(!revealed)}
            className="text-[10px] text-gray-500 hover:text-gray-300 px-2 py-1 rounded border border-surface-light/30 hover:border-surface-light/60">
            {revealed ? "Hide" : "Show"}
          </button>
        )}
        <button onClick={copy}
          className={`text-[10px] px-2 py-1 rounded border transition-colors ${copied ? "text-green-400 border-green-400/30" : "text-gray-500 hover:text-gray-300 border-surface-light/30 hover:border-surface-light/60"}`}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export default function SovereignControls() {
  const [settings, setSettings] = useState<PolicySettings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [credentials, setCredentials] = useState<RpcCredentials | null>(null);

  useEffect(() => {
    api.getSettings().then((s) => {
      setSettings(s);
      setLoaded(true);
    }).catch(() => setLoaded(true));
    api.getCredentials().then(setCredentials).catch(() => {});
  }, []);

  const update = <K extends keyof PolicySettings>(key: K, val: PolicySettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: val }));
    setSaved(false);
  };

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveDetails, setSaveDetails] = useState<string[]>([]);
  const [restarting, setRestarting] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveDetails([]);
    try {
      const result = await api.saveSettings(settings);
      setSaved(true);
      setSaveDetails(result.applied);
      if (!result.ok) {
        setSaveError(result.errors.join(", "));
      }
      setTimeout(() => { setSaved(false); setSaveDetails([]); }, 5000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleRestart = async () => {
    if (!window.confirm("Restart the node? It will be unavailable for 10-30 seconds while Docker restarts it.")) return;
    try {
      setRestarting(true);
      await api.restartNode();
    } catch {
      // Node may already be shutting down
    }
    setTimeout(() => setRestarting(false), 30000);
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Sovereign Controls</h1>
        <p className="text-sm text-gray-500 mt-1">
          Your node, your rules. Every setting below is non-consensus and safe to change. Adjust freely — you cannot break Bitcoin.
        </p>
      </div>

      {/* 0. Credentials */}
      {credentials && (
        <Section title="Credentials">
          <div className="py-2">
            <p className="text-xs text-gray-500 mb-3 leading-relaxed">
              RPC uses cookie authentication (standard practice). Cookie regenerates on every node restart.
              Use these credentials to connect external wallets (Sparrow, Electrum) or apps to your node.
            </p>
            <CredentialField label="RPC Username" value={credentials.rpcUser} />
            <CredentialField label="RPC Password" value={credentials.rpcPassword} masked />
            <CredentialField label="Dashboard Password" value={credentials.dashboardPassword} masked />
          </div>
        </Section>
      )}

      {/* 1. Storage & Performance */}
      <Section title="Storage & Performance">
        <Slider label="Database Cache (dbcache)" value={settings.dbcache} defaultValue={DEFAULTS.dbcache}
          min={4} max={16384} step={50} unit="MB"
          description="RAM allocated for the UTXO database cache. Larger values dramatically speed up initial sync and block validation. Set this as high as your RAM allows."
          onChange={(v) => update("dbcache", v)} />
        <Toggle label="Transaction Index (txindex)" checked={settings.txindex} defaultValue={DEFAULTS.txindex}
          description="Maintain a full index of all transactions. Required if you want to look up any transaction by its txid (e.g. for block explorers). Uses extra disk space and slows initial sync. Incompatible with pruning."
          onChange={(v) => update("txindex", v)} />
        <Toggle label="Enable Pruning" checked={settings.prune > 0} defaultValue={DEFAULTS.prune > 0}
          description="Delete old block data to save disk space. Your node keeps only the most recent blocks. Cannot be combined with txindex. Minimum 550 MB."
          onChange={(v) => update("prune", v ? 550 : 0)} />
        {settings.prune > 0 && (
          <Slider label="Prune Target" value={settings.prune} defaultValue={550}
            min={550} max={10000} step={50} unit="MB"
            description="How much block data to keep on disk. Lower values save more space but limit how far back you can serve blocks to peers."
            onChange={(v) => update("prune", v)} />
        )}
      </Section>

      {/* 2. Mempool Policy */}
      <Section title="Mempool Policy">
        <Slider label="Max Mempool Size" value={settings.maxmempool} defaultValue={DEFAULTS.maxmempool}
          min={50} max={2000} step={50} unit="MB"
          description="Maximum memory used by the mempool. When full, lowest-fee transactions are evicted. Higher values keep more unconfirmed transactions available for mining."
          onChange={(v) => update("maxmempool", v)} />
        <Slider label="Mempool Expiry" value={settings.mempoolexpiry} defaultValue={DEFAULTS.mempoolexpiry}
          min={1} max={720} unit="hours"
          description="Hours before an unconfirmed transaction is removed from the mempool. Default is 14 days (336 hours)."
          onChange={(v) => update("mempoolexpiry", v)} />
        <TextInput label="Min Relay Fee" value={String(settings.minrelaytxfee)} defaultValue={String(DEFAULTS.minrelaytxfee)}
          placeholder="0.00001" unit="BTC/kvB"
          description="Minimum fee rate to relay transactions. Transactions below this fee rate are dropped. Lowering this allows cheaper transactions but may increase spam."
          onChange={(v) => update("minrelaytxfee", parseFloat(v) || 0)} />
        <TextInput label="Incremental Relay Fee" value={String(settings.incrementalrelayfee)} defaultValue={String(DEFAULTS.incrementalrelayfee)}
          placeholder="0.00001" unit="BTC/kvB"
          description="Minimum fee rate increase required for Replace-By-Fee (RBF) replacements. Also used as the fee rate step for mempool eviction."
          onChange={(v) => update("incrementalrelayfee", parseFloat(v) || 0)} />
        <Slider label="Max Ancestor Count" value={settings.limitancestorcount} defaultValue={DEFAULTS.limitancestorcount}
          min={1} max={100}
          description="Maximum number of unconfirmed parent transactions allowed for a mempool entry. Limits long chains of unconfirmed transactions."
          onChange={(v) => update("limitancestorcount", v)} />
        <Slider label="Max Descendant Count" value={settings.limitdescendantcount} defaultValue={DEFAULTS.limitdescendantcount}
          min={1} max={100}
          description="Maximum number of unconfirmed child transactions allowed. Limits how many pending children a single transaction can spawn."
          onChange={(v) => update("limitdescendantcount", v)} />
        <Toggle label="Permit Bare Multisig" checked={settings.permitbaremultisig} defaultValue={DEFAULTS.permitbaremultisig}
          description="Relay bare (non-P2SH) multisig transactions. Disabling this filters out a class of non-standard transactions. Most nodes leave this enabled."
          onChange={(v) => update("permitbaremultisig", v)} />
        <Slider label="Bytes Per SigOp" value={settings.bytespersigop} defaultValue={DEFAULTS.bytespersigop}
          min={1} max={100}
          description="Equivalent bytes per signature operation for relay/mining limits. Higher values restrict transactions with many signature operations."
          onChange={(v) => update("bytespersigop", v)} />
      </Section>

      {/* 3. OP_RETURN / Data Carrier */}
      <Section title="OP_RETURN / Data Carrier">
        <Toggle label="Enable Data Carrier Relay" checked={settings.datacarrier} defaultValue={DEFAULTS.datacarrier}
          description="Allow relaying of transactions with OP_RETURN outputs. These are used for timestamping, token protocols, and other data-embedding use cases. Disabling this means your node won't relay data-embedding transactions."
          onChange={(v) => update("datacarrier", v)} />
        <Slider label="Max Data Carrier Size" value={settings.datacarriersize} defaultValue={DEFAULTS.datacarriersize}
          min={0} max={256} unit="bytes"
          description="Maximum size of OP_RETURN scripts your node will relay. The default (83 bytes) accommodates most protocols. Larger values allow more data per transaction."
          onChange={(v) => update("datacarriersize", v)} />
      </Section>

      {/* 4. Network & Privacy */}
      <Section title="Network & Privacy">
        <Slider label="Max Connections" value={settings.maxconnections} defaultValue={DEFAULTS.maxconnections}
          min={8} max={500}
          description="Maximum number of peer connections (inbound + outbound). More connections help the network but use more bandwidth and memory."
          onChange={(v) => update("maxconnections", v)} />
        <Toggle label="Accept Incoming Connections (listen)" checked={settings.listen} defaultValue={DEFAULTS.listen}
          description="Allow other nodes to connect to you. Helps the Bitcoin network stay healthy and decentralized, but makes your node's IP address visible to peers."
          onChange={(v) => update("listen", v)} />
        <Toggle label="Blocks-Only Mode" checked={settings.blocksonly} defaultValue={DEFAULTS.blocksonly}
          description="Only download blocks, don't relay or accept unconfirmed transactions. Saves significant bandwidth (~88% reduction) but your mempool will be empty."
          onChange={(v) => update("blocksonly", v)} />
        <Slider label="Max Upload Target" value={settings.maxuploadtarget} defaultValue={DEFAULTS.maxuploadtarget}
          min={0} max={10000} step={100} unit="MB/day"
          description="Daily upload bandwidth limit. 0 = unlimited. When the limit is reached, your node stops serving historical blocks to peers. Does not affect block relay or transactions."
          onChange={(v) => update("maxuploadtarget", v)} />
        <Toggle label="Peer Bloom Filters" checked={settings.peerbloomfilters} defaultValue={DEFAULTS.peerbloomfilters}
          description="Support BIP37 bloom filter requests from lightweight (SPV) wallets. This is a privacy concern as bloom filters leak wallet addresses. Disabled by default on mainnet."
          onChange={(v) => update("peerbloomfilters", v)} />
        <TextInput label="SOCKS5 Proxy" value={settings.proxy} defaultValue={DEFAULTS.proxy}
          placeholder="tor-proxy:9050"
          description="Route all outgoing connections through a SOCKS5 proxy. A Tor proxy is bundled — enter tor-proxy:9050 to enable anonymous connections. Leave empty to connect directly."
          onChange={(v) => update("proxy", v)} />
        <MultiCheckbox label="Allowed Networks (onlynet)" description="Restrict connections to only these network types. Leave all unchecked to allow all networks. Selecting only 'Tor' gives maximum privacy."
          options={NETWORK_OPTIONS} selected={settings.onlynet}
          onChange={(v) => update("onlynet", v as NetworkType[])} />
        <Toggle label="Enable UPnP" checked={settings.upnp} defaultValue={DEFAULTS.upnp}
          description="Automatically configure your router to forward the Bitcoin port using UPnP. Convenient but some consider UPnP a security risk."
          onChange={(v) => update("upnp", v)} />
        <Toggle label="Enable NAT-PMP" checked={settings.natpmp} defaultValue={DEFAULTS.natpmp}
          description="Automatically configure port forwarding using NAT-PMP (used by Apple routers). Similar to UPnP but simpler protocol."
          onChange={(v) => update("natpmp", v)} />
        <Slider label="Ban Duration" value={settings.bantime} defaultValue={DEFAULTS.bantime}
          min={60} max={604800} step={3600} unit="seconds"
          description="How long to ban misbehaving peers. Default is 24 hours (86400 seconds). Longer ban times give stricter punishment for protocol violations."
          onChange={(v) => update("bantime", v)} />
      </Section>

      {/* 5. Peer Management */}
      <Section title="Peer Management">
        <TagInput label="Add Node Addresses" tags={settings.addnode}
          placeholder="e.g. 192.168.1.50:8333 or xyz.onion:8333"
          description="Manually add peer addresses to connect to. Your node will try to maintain a connection to these peers in addition to automatically discovered ones."
          onChange={(v) => update("addnode", v)} />
        <InfoDisplay label="Outbound Connection Slots"
          value={`${Math.min(settings.maxconnections, 10)} automatic + ${Math.max(0, Math.min(settings.maxconnections - 10, 2))} block-relay-only`}
          description="Your node automatically fills outbound slots. 8 full-relay connections + 2 block-relay-only connections by default."
          badge="Auto-managed" badgeColor="gray" />
      </Section>

      {/* 6. Mining & Relay */}
      <Section title="Mining & Relay">
        <Slider label="Block Max Weight" value={settings.blockmaxweight} defaultValue={DEFAULTS.blockmaxweight}
          min={4000} max={4000000} step={1000} unit="WU"
          description="Maximum weight of blocks your node will create for mining. The consensus limit is 4,000,000 weight units. Lowering this creates smaller blocks."
          onChange={(v) => update("blockmaxweight", v)} />
        <TextInput label="Block Min Transaction Fee" value={String(settings.blockmintxfee)} defaultValue={String(DEFAULTS.blockmintxfee)}
          placeholder="0.00001" unit="BTC/kvB"
          description="Minimum fee rate for transactions to be included in blocks your node creates for mining. Transactions below this fee are not included in block templates."
          onChange={(v) => update("blockmintxfee", parseFloat(v) || 0)} />
        <InfoDisplay label="Non-Standard Transactions" value="Disabled"
          description="Your node will not accept or relay non-standard transactions. This is the safe default for mainnet and protects against potential exploits."
          badge="Read-Only" badgeColor="gray" />
      </Section>

      {/* 7. RPC & Server */}
      <Section title="RPC & Server">
        <Slider label="RPC Threads" value={settings.rpcthreads} defaultValue={DEFAULTS.rpcthreads}
          min={1} max={32}
          description="Number of worker threads handling RPC requests. Increase this if you're running applications that make heavy RPC use (block explorers, wallets, monitoring)."
          onChange={(v) => update("rpcthreads", v)} />
        <Slider label="RPC Work Queue" value={settings.rpcworkqueue} defaultValue={DEFAULTS.rpcworkqueue}
          min={16} max={512}
          description="Maximum depth of the RPC request queue. Requests beyond this depth are rejected. Increase if you see 'work queue depth exceeded' errors."
          onChange={(v) => update("rpcworkqueue", v)} />
      </Section>

      {/* 8. Logging */}
      <Section title="Logging">
        <MultiCheckbox label="Debug Categories" description="Enable debug logging for specific subsystems. Useful for troubleshooting but generates large log files. Leave all unchecked for normal operation."
          options={DEBUG_OPTIONS} selected={settings.debug}
          onChange={(v) => update("debug", v as DebugCategory[])} />
        <Toggle label="Log IP Addresses" checked={settings.logips} defaultValue={DEFAULTS.logips}
          description="Include peer IP addresses in debug log output. Helpful for diagnosing connection issues but reduces your privacy if logs are shared."
          onChange={(v) => update("logips", v)} />
        <Toggle label="Log Timestamps" checked={settings.logtimestamps} defaultValue={DEFAULTS.logtimestamps}
          description="Prepend timestamps to every debug log line. Almost always useful — only disable if another tool adds its own timestamps."
          onChange={(v) => update("logtimestamps", v)} />
      </Section>

      {/* Save bar */}
      <div className="sticky bottom-0 bg-surface-dark pt-2 pb-4 border-t border-surface-light/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-600">Peer changes apply immediately. Other settings require a node restart.</p>
            {saveError && <p className="text-xs text-red-400 mt-1">{saveError}</p>}
          </div>
          <div className="flex items-center gap-3">
            {saved && <span className="text-sm text-green-400">Saved</span>}
            <button onClick={handleSave} disabled={saving}
              className={`px-6 py-2.5 font-semibold rounded-lg transition-colors text-sm ${saving ? "bg-gray-600 text-gray-400 cursor-wait" : "bg-fire-amber text-black hover:bg-fire-gold"}`}>
              {saving ? "Saving..." : "Apply Changes"}
            </button>
            <button onClick={handleRestart} disabled={restarting}
              className={`flex items-center gap-2 px-5 py-2.5 font-semibold rounded-lg transition-colors text-sm ${restarting ? "bg-gray-600 text-gray-400 cursor-wait" : "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30"}`}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {restarting ? "Restarting..." : "Restart Node"}
            </button>
          </div>
        </div>
        {saveDetails.length > 0 && (
          <div className="mt-2 text-xs text-gray-500">
            {saveDetails.map((d, i) => <span key={i} className="mr-3">&#10003; {d}</span>)}
          </div>
        )}
      </div>
    </div>
  );
}
