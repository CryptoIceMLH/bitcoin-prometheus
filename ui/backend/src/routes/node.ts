import { Router } from "express";
import http from "http";
import { rpcCall } from "../rpc";

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
      const message = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
      res.status(502).json({ error: "Node unavailable", details: message });
    }
  }
});

// ---------------------------------------------------------------------------
// Node's own geolocation (for fire map arc origin)
// ---------------------------------------------------------------------------

let cachedLocation: { lat: number; lon: number; country: string } | null = null;

nodeRouter.get("/location", async (_req, res) => {
  if (cachedLocation) {
    return res.json(cachedLocation);
  }

  try {
    const data = await new Promise<string>((resolve, reject) => {
      const req = http.get("http://ip-api.com/json/?fields=lat,lon,country,status", (resp) => {
        let chunks = "";
        resp.on("data", (c) => (chunks += c));
        resp.on("end", () => resolve(chunks));
        resp.on("error", reject);
      });
      req.on("error", reject);
      req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
      req.setTimeout(5000);
    });

    const parsed = JSON.parse(data) as { status: string; lat?: number; lon?: number; country?: string };
    if (parsed.status === "success" && parsed.lat != null && parsed.lon != null) {
      cachedLocation = { lat: parsed.lat, lon: parsed.lon, country: parsed.country ?? "" };
      res.json(cachedLocation);
    } else {
      // Fallback: London
      res.json({ lat: 51.5, lon: -0.1, country: "Unknown" });
    }
  } catch {
    res.json({ lat: 51.5, lon: -0.1, country: "Unknown" });
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
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Failed to stop node", details: message });
  }
});
