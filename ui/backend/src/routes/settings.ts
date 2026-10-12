import { Router } from "express";
import { rpcCall } from "../rpc";
import * as fs from "fs";
import * as path from "path";
import { DEFAULTS, DATA_DIR, CONF_FILE, parseConfFile } from "../lib/config";


export const settingsRouter = Router();

// Keys that should NOT be written to the config file (managed elsewhere)
const SKIP_CONF_KEYS = new Set(["addnode"]);

// Only these keys may be written to bitcoin.conf by Sovereign Controls.
// publicinbound is Prometheus-only: entrypoint.sh turns it into bind/listenonion lines.
const ALLOWED_CONF_KEYS = new Set([
  "datacarrier", "datacarriersize", "dbcache", "prune", "txindex", "par",
  "maxmempool", "mempoolexpiry", "minrelaytxfee", "incrementalrelayfee",
  "limitancestorcount", "limitdescendantcount", "permitbaremultisig", "bytespersigop",
  "maxconnections", "publicinbound", "blocksonly", "maxuploadtarget", "peerbloomfilters",
  "proxy", "onlynet", "natpmp", "bantime",
  "blockmaxweight", "blockmintxfee", "rpcthreads", "rpcworkqueue",
  "debug", "logips", "logtimestamps",
]);

// BTC/kvB amounts
const FEE_RATE_KEYS = new Set(["minrelaytxfee", "incrementalrelayfee", "blockmintxfee"]);

// Keys older versions of the UI wrote that are now obsolete; removed on save
const LEGACY_CONF_KEYS = new Set(["upnp", "mempoolfullrbf"]);

const UI_BLOCK_HEADER = "# --- Sovereign Controls (managed by the Prometheus UI) ---";

// Address format: IPv4, bracketed IPv6, .onion hostname, or DNS name — with port
const ADDR_PATTERN = /^(?:(?:\d{1,3}\.){3}\d{1,3}|\[[0-9a-fA-F:]+\]|[\w.-]+\.onion|[\w.-]+):\d{1,5}$/;

// SOCKS5 proxy: IPv4, bracketed IPv6 or hostname, with port (bitcoind won't start on anything else)
const PROXY_PATTERN = /^(?:(?:\d{1,3}\.){3}\d{1,3}|\[[0-9a-fA-F:]+\]|[A-Za-z0-9][\w.-]*):\d{1,5}$/;

// Networks Prometheus can actually reach. i2p/cjdns need a router we don't ship, and
// onlynet=i2p without -i2psam stops bitcoind from starting.
const ONLYNET_VALUES = new Set(["ipv4", "ipv6", "onion"]);

const REINDEX_MARKER = path.join(DATA_DIR, ".prometheus-reindex");

// Merge settings into the existing bitcoin.conf. Lines for UI-managed keys are replaced;
// everything else (entrypoint-managed lines, operator's hand edits) is kept as-is.
function mergeConfFile(existing: string, settings: Record<string, unknown>): string {
  const kept: string[] = [];
  for (const line of existing.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === UI_BLOCK_HEADER) continue;
    const eqIdx = trimmed.indexOf("=");
    if (!trimmed.startsWith("#") && eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      if (ALLOWED_CONF_KEYS.has(key) || SKIP_CONF_KEYS.has(key) || LEGACY_CONF_KEYS.has(key)) continue;
    }
    kept.push(line);
  }
  while (kept.length > 0 && kept[kept.length - 1].trim() === "") kept.pop();

  return [...kept, "", ...toConfLines(settings)].join("\n");
}

// Convert settings object to bitcoin.conf lines
function toConfLines(settings: Record<string, unknown>): string[] {
  const lines: string[] = [UI_BLOCK_HEADER];

  for (const [key, value] of Object.entries(settings)) {
    if (SKIP_CONF_KEYS.has(key)) continue;
    if (!ALLOWED_CONF_KEYS.has(key)) continue;
    if (value === "" || value === undefined || value === null) continue;

    if (Array.isArray(value)) {
      // Repeated keys (onlynet, debug)
      for (const item of value) {
        lines.push(`${key}=${item}`);
      }
    } else if (typeof value === "boolean") {
      lines.push(`${key}=${value ? "1" : "0"}`);
    } else if (FEE_RATE_KEYS.has(key) && typeof value === "number") {
      // bitcoind rejects exponent notation (String(1e-8) === "1e-8"), so always write fixed decimals
      lines.push(`${key}=${value.toFixed(8)}`);
    } else {
      lines.push(`${key}=${value}`);
    }
  }

  // Write addnode entries separately
  const addnodes = settings.addnode as string[] | undefined;
  if (addnodes && addnodes.length > 0) {
    for (const addr of addnodes) {
      lines.push(`addnode=${addr}`);
    }
  }

  lines.push("");
  return lines;
}

// GET current policy settings
settingsRouter.get("/", async (_req, res) => {
  // Read saved settings from config file (includes dbcache, addnode, etc.)
  const confSettings = parseConfFile();

  // Filter confSettings to only include whitelisted keys (prevents dev server cruft from leaking to frontend)
  const knownConf = Object.fromEntries(
    Object.entries(confSettings).filter(
      ([k]) => ALLOWED_CONF_KEYS.has(k) || k === "addnode"
    )
  );

  // Live policy from the node. If the node is down (e.g. failed to start), still show the
  // saved config so the operator can fix it — never fall back to bare defaults, or saving
  // would overwrite their real settings.
  let policy: Record<string, unknown> = {};
  let rpcAddnodes: string[] = [];
  try {
    // Only keys the UI may save: getpolicy also reports read-only values (e.g. listen),
    // and sending those back would make every save fail with "Invalid config keys"
    const livePolicy = (await rpcCall("getpolicy")) as Record<string, unknown>;
    policy = Object.fromEntries(
      Object.entries(livePolicy).filter(([k]) => ALLOWED_CONF_KEYS.has(k))
    );

    // Read addnode from RPC (runtime-added nodes not yet in config)
    try {
      const added = (await rpcCall("getaddednodeinfo")) as Array<{
        addednode: string;
      }>;
      rpcAddnodes = added.map((n) => n.addednode);
    } catch { }
  } catch { }

  // Merge addnode from config + RPC
  const confAddnodes = Array.isArray(confSettings.addnode) ? confSettings.addnode as string[] : [];
  const allAddnodes = [...new Set([...confAddnodes, ...rpcAddnodes])];

  // Drop unsupported networks from an older config (entrypoint.sh strips them too)
  if (Array.isArray(knownConf.onlynet)) {
    knownConf.onlynet = (knownConf.onlynet as string[]).filter((n) => ONLYNET_VALUES.has(n));
  }

  // Layer: defaults < config file < RPC policy (most authoritative)
  res.json({ ...DEFAULTS, ...knownConf, ...policy, addnode: allAddnodes });
});

// POST save settings
settingsRouter.post("/", async (req, res) => {
  const { confirm_unprune: confirmUnprune, ...settings } = req.body as Record<string, unknown>;

  // Reject unknown config keys
  const invalidKeys = Object.keys(settings).filter(
    (k) => !ALLOWED_CONF_KEYS.has(k) && !SKIP_CONF_KEYS.has(k)
  );
  if (invalidKeys.length > 0) {
    res.status(400).json({ error: `Invalid config keys: ${invalidKeys.join(", ")}` });
    return;
  }

  // Values Bitcoin Core refuses at startup — reject them here so a save can't stop the node
  const prune = Number(settings.prune ?? 0);
  if (prune !== 0 && prune !== 1 && prune < 550) {
    res.status(400).json({ error: "Prune target must be at least 550 MB" });
    return;
  }
  const proxy = typeof settings.proxy === "string" ? settings.proxy.trim() : "";
  if (proxy !== "" && !PROXY_PATTERN.test(proxy)) {
    res.status(400).json({ error: `SOCKS5 proxy must be host:port (e.g. 127.0.0.1:9050), got "${proxy}"` });
    return;
  }
  settings.proxy = proxy;
  const onlynet = Array.isArray(settings.onlynet) ? settings.onlynet.map(String) : [];
  const badNets = onlynet.filter((n) => !ONLYNET_VALUES.has(n));
  if (badNets.length > 0) {
    res.status(400).json({ error: `Unsupported network(s) for onlynet: ${badNets.join(", ")} (Prometheus has no I2P or CJDNS router)` });
    return;
  }
  // Pruning and txindex can't be combined; pruning wins (entrypoint.sh enforces the same)
  if (prune > 0) settings.txindex = false;

  // Going from pruned back to unpruned needs a one-time -reindex (re-downloads the whole
  // chain), otherwise Core refuses to start. Require explicit confirmation from the UI.
  const savedPrune = Number(parseConfFile().prune ?? 0);
  const unpruning = savedPrune > 0 && prune === 0;
  if (unpruning && confirmUnprune !== true) {
    res.status(400).json({ error: "Turning pruning off re-downloads the whole blockchain; confirmation required" });
    return;
  }

  const applied: string[] = [];
  const errors: string[] = [];
  let configWritten = false;

  // 1. Apply runtime changes via RPC (addnode)
  const addnodes = settings.addnode as string[] | undefined;

  // Remove stale addnodes that the user deleted from the list
  try {
    const current = (await rpcCall("getaddednodeinfo")) as Array<{
      addednode: string;
    }>;
    const newSet = new Set(addnodes || []);
    for (const node of current) {
      if (!newSet.has(node.addednode)) {
        try {
          await rpcCall("addnode", [node.addednode, "remove"]);
          applied.push(`removed addnode ${node.addednode}`);
        } catch { }
      }
    }
  } catch { }

  // Add new addnodes (invalid ones are reported and kept out of bitcoin.conf)
  if (addnodes && addnodes.length > 0) {
    settings.addnode = addnodes.filter((addr) => ADDR_PATTERN.test(addr));
    for (const addr of addnodes) {
      if (!ADDR_PATTERN.test(addr)) {
        errors.push(`Invalid address format: ${addr}`);
        continue;
      }
      try {
        await rpcCall("addnode", [addr, "add"]);
        applied.push(`addnode ${addr}`);
      } catch (err: unknown) {
        // "already added" is not an error
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("already added") || msg.includes("already connected")) {
          applied.push(`addnode ${addr} (already connected)`);
        } else {
          console.error(`[settings] addnode ${addr} failed:`, err);
          errors.push(`addnode ${addr}: failed`);
        }
      }
    }
  }

  // 2. Write config file for settings that need restart
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    let existing = "";
    try { existing = fs.readFileSync(CONF_FILE, "utf8"); } catch { }
    fs.writeFileSync(CONF_FILE, mergeConfFile(existing, settings), "utf8");
    configWritten = true;
    applied.push("bitcoin.conf updated");
    // entrypoint.sh starts the node once with -reindex when this marker exists
    if (unpruning) {
      fs.writeFileSync(REINDEX_MARKER, "requested by Sovereign Controls: prune turned off\n", "utf8");
      applied.push("full re-download scheduled for next restart");
    }
  } catch (err: unknown) {
    console.error("[settings] config write error:", err);
    errors.push("Config write failed");
  }

  res.json({
    ok: errors.length === 0,
    applied,
    config_written: configWritten,
    errors,
  });
});

// GET /credentials — return RPC credentials for Sovereign Controls display
settingsRouter.get("/credentials", (_req, res) => {
  let rpcUser = process.env.RPC_USER || "";
  let rpcPassword = process.env.RPC_PASS || "";
  if (!rpcUser || !rpcPassword) {
    try {
      const cookiePath = `${DATA_DIR}/.cookie`;
      const cookie = fs.readFileSync(cookiePath, "utf8").trim();
      const colonIdx = cookie.indexOf(":");
      if (colonIdx !== -1) {
        rpcUser = cookie.slice(0, colonIdx);
        rpcPassword = cookie.slice(colonIdx + 1);
      }
    } catch {
      rpcPassword = "Node not running";
    }
  }
  res.json({ rpcUser, rpcPassword });
});
