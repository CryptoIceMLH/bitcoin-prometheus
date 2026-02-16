import { Router } from "express";
import http from "http";
import { rpcCall } from "../rpc";

export const networkRouter = Router();

// ---------------------------------------------------------------------------
// IP Geolocation cache + batch resolver (ip-api.com, free, no key)
// ---------------------------------------------------------------------------

interface GeoResult {
  lat: number | null;
  lon: number | null;
  country: string | null;
}

const geoCache = new Map<string, GeoResult>();

function extractIP(addr: string): string | null {
  if (!addr) return null;
  // Skip .onion
  if (addr.includes(".onion")) return null;
  // IPv6 bracket notation: [::ffff:1.2.3.4]:8333
  if (addr.startsWith("[")) {
    const closing = addr.indexOf("]");
    if (closing === -1) return null;
    let ip = addr.slice(1, closing);
    // Handle IPv4-mapped IPv6 like ::ffff:1.2.3.4
    if (ip.startsWith("::ffff:")) ip = ip.slice(7);
    return isPrivateIP(ip) ? null : ip;
  }
  // IPv4: 1.2.3.4:8333
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

async function resolveGeo(ips: string[]): Promise<void> {
  // Only resolve IPs not already cached
  const uncached = ips.filter((ip) => !geoCache.has(ip));
  if (uncached.length === 0) return;

  // Batch up to 100
  const batch = uncached.slice(0, 100);

  try {
    const body = JSON.stringify(batch.map((ip) => ({ query: ip, fields: "lat,lon,country,status,query" })));

    const data = await new Promise<string>((resolve, reject) => {
      const req = http.request(
        {
          hostname: "ip-api.com",
          port: 80,
          path: "/batch",
          method: "POST",
          headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
          timeout: 5000,
        },
        (res) => {
          let chunks = "";
          res.on("data", (c) => (chunks += c));
          res.on("end", () => resolve(chunks));
          res.on("error", reject);
        }
      );
      req.on("error", reject);
      req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
      req.write(body);
      req.end();
    });

    const results = JSON.parse(data) as Array<{ status: string; lat?: number; lon?: number; country?: string; query?: string }>;
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const key = batch[i];
      if (r.status === "success" && r.lat != null && r.lon != null) {
        geoCache.set(key, { lat: r.lat, lon: r.lon, country: r.country ?? null });
      } else {
        geoCache.set(key, { lat: null, lon: null, country: null });
      }
    }
  } catch {
    // Geolocation failed — continue without it
    for (const ip of batch) {
      if (!geoCache.has(ip)) {
        geoCache.set(ip, { lat: null, lon: null, country: null });
      }
    }
  }
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
      const message = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
      res.status(502).json({ error: "Node unavailable", details: message });
    }
  }
});

// Peer list endpoint (with geolocation)
networkRouter.get("/peers", async (_req, res) => {
  try {
    const peers = (await rpcCall("getpeerinfo")) as Array<Record<string, unknown>>;

    // Extract IPs for geolocation
    const ips: string[] = [];
    for (const p of peers) {
      const ip = extractIP(String(p.addr || ""));
      if (ip) ips.push(ip);
    }

    // Resolve geo (cached, fast after first call)
    await resolveGeo(ips);

    const simplified = peers.map((p) => {
      const ip = extractIP(String(p.addr || ""));
      const geo = ip ? geoCache.get(ip) : null;
      return {
        id: p.id,
        addr: p.addr,
        subver: p.subver,
        inbound: p.inbound,
        synced_headers: p.synced_headers,
        synced_blocks: p.synced_blocks,
        connection_type: p.connection_type,
        lat: geo?.lat ?? null,
        lon: geo?.lon ?? null,
        country: geo?.country ?? null,
      };
    });
    res.json(simplified);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: "Node unavailable", details: message });
  }
});
