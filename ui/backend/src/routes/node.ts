import { Router } from "express";
import * as fs from "fs";
import * as path from "path";
import { rpcCall } from "../rpc";

const DATA_DIR = process.env.DATA_DIR || "/data";
const LOCATION_FILE = path.join(DATA_DIR, "node-location.json");

export const nodeRouter = Router();

nodeRouter.get("/", async (_req, res) => {
  try {
    const info = (await rpcCall("getprometheusinfo")) as Record<string, unknown>;
    res.json(info);
  } catch (err: unknown) {
    // Fallback: assemble from standard RPCs if custom command not available
    try {
      const [blockchainInfo, networkInfo, uptimeVal, peerInfo, mempoolInfo] = await Promise.all([
        rpcCall("getblockchaininfo") as Promise<Record<string, unknown>>,
        rpcCall("getnetworkinfo") as Promise<Record<string, unknown>>,
        rpcCall("uptime") as Promise<number>,
        rpcCall("getpeerinfo") as Promise<Array<Record<string, unknown>>>,
        rpcCall("getmempoolinfo").catch(() => ({ size: 0, bytes: 0, usage: 0 })) as Promise<Record<string, unknown>>,
      ]);

      const totalPeers = peerInfo.length;
      const inbound = peerInfo.filter((p) => p.inbound === true).length;
      const outbound = totalPeers - inbound;

      res.json({
        version: networkInfo.subversion,
        user_agent: networkInfo.subversion,
        chain: blockchainInfo.chain,
        blocks: blockchainInfo.blocks,
        bestblockhash: blockchainInfo.bestblockhash,
        difficulty: blockchainInfo.difficulty,
        verification_progress: blockchainInfo.verificationprogress,
        mempool_transactions: mempoolInfo.size ?? 0,
        mempool_bytes: mempoolInfo.bytes ?? 0,
        mempool_usage: mempoolInfo.usage ?? 0,
        connections: totalPeers,
        connections_in: inbound,
        connections_out: outbound,
        network_active: networkInfo.networkactive,
        uptime: uptimeVal,
      });
    } catch (fallbackErr: unknown) {
      console.error("[node] RPC error:", fallbackErr);
      res.status(502).json({ error: "Node unavailable" });
    }
  }
});

// ---------------------------------------------------------------------------
// Node location — user-settable via UI (saved to DATA_DIR/node-location.json)
// ---------------------------------------------------------------------------

nodeRouter.get("/location", (_req, res) => {
  try {
    const data = fs.readFileSync(LOCATION_FILE, "utf8");
    const loc = JSON.parse(data) as { lat: number; lon: number };
    res.json(loc);
  } catch {
    res.json({ lat: null, lon: null });
  }
});

nodeRouter.post("/location", (req, res) => {
  const { lat, lon } = req.body as { lat?: number; lon?: number };
  if (typeof lat !== "number" || typeof lon !== "number") {
    res.status(400).json({ error: "lat and lon must be numbers" });
    return;
  }
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(LOCATION_FILE, JSON.stringify({ lat, lon }), "utf8");
    res.json({ ok: true });
  } catch (err: unknown) {
    console.error("[node] save location error:", err);
    res.status(500).json({ error: "Failed to save location" });
  }
});

// ---------------------------------------------------------------------------
// Restart node (sends RPC "stop", Docker restart policy brings it back)
// ---------------------------------------------------------------------------

nodeRouter.post("/restart", async (_req, res) => {
  try {
    await rpcCall("stop");
    res.json({ ok: true, message: "Node shutdown initiated, Docker will restart it" });
  } catch (err: unknown) {
    console.error("[node] restart error:", err);
    res.status(500).json({ error: "Failed to stop node" });
  }
});
