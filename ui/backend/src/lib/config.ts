import * as fs from "fs";
import * as path from "path";

export const DATA_DIR = process.env.DATA_DIR || "/data";
export const CONF_FILE = path.join(DATA_DIR, "prometheus.conf");

export const DEFAULTS: Record<string, unknown> = {
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

// Parse prometheus.conf into a settings object
export function parseConfFile(): Record<string, unknown> {
  try {
    const content = fs.readFileSync(CONF_FILE, "utf8");
    const result: Record<string, unknown> = {};
    const arrayKeys = new Set(["onlynet", "debug", "addnode"]);

    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();

      if (arrayKeys.has(key)) {
        if (!Array.isArray(result[key])) result[key] = [];
        (result[key] as string[]).push(val);
      } else if (val === "0" || val === "1") {
        // Check if this key is boolean in DEFAULTS
        if (typeof DEFAULTS[key] === "boolean") {
          result[key] = val === "1";
        } else {
          result[key] = Number(val);
        }
      } else if (!isNaN(Number(val)) && val !== "") {
        result[key] = Number(val);
      } else {
        result[key] = val;
      }
    }
    return result;
  } catch {
    return {};
  }
}
