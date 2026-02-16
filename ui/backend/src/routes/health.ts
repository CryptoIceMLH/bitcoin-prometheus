import { Router } from "express";
import { rpcCall } from "../rpc";
import { parseConfFile } from "../lib/config";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  try {
    const health = (await rpcCall("getnodehealth")) as Record<string, unknown>;
    res.json(health);
  } catch (err: unknown) {
    // Fallback: build health response from standard RPC calls + config file
    try {
      const networkInfo = (await rpcCall("getnetworkinfo")) as Record<string, unknown>;
      const uptimeVal = (await rpcCall("uptime")) as number;

      // Read real values from prometheus.conf
      const conf = parseConfFile();
      const dbcache = typeof conf.dbcache === "number" ? conf.dbcache : 450;
      const pruning = typeof conf.prune === "number" && conf.prune > 0;

      // Get banned peers count from RPC
      let bannedPeers = 0;
      try {
        const banned = (await rpcCall("listbanned")) as unknown[];
        bannedPeers = banned.length;
      } catch { }

      res.json({
        uptime: uptimeVal,
        bytes_recv: networkInfo.totalbytesrecv || 0,
        bytes_sent: networkInfo.totalbytessent || 0,
        banned_peers: bannedPeers,
        dbcache_mb: dbcache,
        pruning_enabled: pruning,
      });
    } catch (fallbackErr: unknown) {
      const message = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
      res.status(502).json({ error: "Node unavailable", details: message });
    }
  }
});
