import { Router } from "express";
import geoip from "geoip-lite";
import { rpcCall } from "../rpc";

export const networkRouter = Router();

// ---------------------------------------------------------------------------
// IP extraction helpers
// ---------------------------------------------------------------------------

function extractIP(addr: string): string | null {
  if (!addr) return null;
  if (addr.includes(".onion")) return null;
  if (addr.startsWith("[")) {
    const closing = addr.indexOf("]");
    if (closing === -1) return null;
    let ip = addr.slice(1, closing);
    if (ip.startsWith("::ffff:")) ip = ip.slice(7);
    return isPrivateIP(ip) ? null : ip;
  }
  const lastColon = addr.lastIndexOf(":");
  const ip = lastColon !== -1 ? addr.slice(0, lastColon) : addr;
  return isPrivateIP(ip) ? null : ip;
}

function isPrivateIP(ip: string): boolean {
  if (ip.startsWith("10.") || ip.startsWith("127.") || ip.startsWith("0.")) return true;
  if (ip.startsWith("192.168.")) return true;
  if (ip.startsWith("172.")) {
    const second = parseInt(ip.split(".")[1], 10);
    if (second >= 16 && second <= 31) return true;
  }
  if (ip === "::1" || ip === "localhost") return true;
  return false;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

networkRouter.get("/", async (_req, res) => {
  try {
    const privacy = (await rpcCall("getprivacystatus")) as Record<string, unknown>;
    res.json(privacy);
  } catch (err: unknown) {
    // Fallback
    try {
      const networkInfo = (await rpcCall("getnetworkinfo")) as Record<string, unknown>;
      const peerInfo = (await rpcCall("getpeerinfo")) as Array<Record<string, unknown>>;

      let onionPeers = 0;
      let clearnetPeers = 0;
      for (const peer of peerInfo) {
        const addr = String(peer.addr || "");
        if (addr.endsWith(".onion") || addr.includes(".onion:")) {
          onionPeers++;
        } else {
          clearnetPeers++;
        }
      }

      res.json({
        tor_reachable: false,
        listen: true,
        network_active: networkInfo.networkactive,
        onion_peers: onionPeers,
        clearnet_peers: clearnetPeers,
        total_peers: peerInfo.length,
        blocksonly: false,
      });
    } catch (fallbackErr: unknown) {
      console.error("[network] RPC error:", fallbackErr);
      res.status(502).json({ error: "Node unavailable" });
    }
  }
});

// Peer list endpoint (with local geolocation via geoip-lite)
networkRouter.get("/peers", async (_req, res) => {
  try {
    const peers = (await rpcCall("getpeerinfo")) as Array<Record<string, unknown>>;

    const simplified = peers.map((p) => {
      const ip = extractIP(String(p.addr || ""));
      let lat: number | null = null;
      let lon: number | null = null;
      let country: string | null = null;
      if (ip) {
        const geo = geoip.lookup(ip);
        if (geo) {
          lat = geo.ll[0];
          lon = geo.ll[1];
          country = geo.country;
        }
      }
      return {
        id: p.id,
        addr: p.addr,
        subver: p.subver,
        inbound: p.inbound,
        synced_headers: p.synced_headers,
        synced_blocks: p.synced_blocks,
        connection_type: p.connection_type,
        lat,
        lon,
        country,
      };
    });
    res.json(simplified);
  } catch (err: unknown) {
    console.error("[network] peers error:", err);
    res.status(502).json({ error: "Node unavailable" });
  }
});
