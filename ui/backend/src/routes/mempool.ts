import { Router } from "express";
import { rpcCall, isWarmingUp } from "../rpc";

export const mempoolRouter = Router();

mempoolRouter.get("/", async (_req, res) => {
  try {
    const stats = (await rpcCall("getmempoolstats")) as Record<string, unknown>;
    res.json(stats);
  } catch (err: unknown) {
    // Fallback to standard RPC
    try {
      const info = (await rpcCall("getmempoolinfo")) as Record<string, unknown>;
      res.json({
        size: info.size,
        bytes: info.bytes,
        usage: info.usage,
        total_fee: info.total_fee || 0,
        maxmempool: info.maxmempool,
        mempoolminfee: info.mempoolminfee,
        minrelaytxfee: info.minrelaytxfee,
        unbroadcastcount: info.unbroadcastcount,
      });
    } catch (fallbackErr: unknown) {
      if (isWarmingUp(fallbackErr)) {
        return res.json({ syncing: true, size: 0, bytes: 0, usage: 0, total_fee: 0, maxmempool: 0, mempoolminfee: 0, minrelaytxfee: 0, unbroadcastcount: 0 });
      }
      console.error("[mempool] RPC error:", fallbackErr);
      res.status(502).json({ error: "Node unavailable" });
    }
  }
});
