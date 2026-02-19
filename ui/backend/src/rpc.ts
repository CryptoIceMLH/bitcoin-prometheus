import * as fs from "fs";
import * as path from "path";

const DATA_DIR = process.env.DATA_DIR || "/data";
const COOKIE_FILE = path.join(DATA_DIR, ".cookie");
const RPC_HOST = process.env.RPC_HOST || "prometheus-node";
const RPC_PORT = process.env.RPC_PORT || "8332";

function getRpcCookieAuth(): string {
  return fs.readFileSync(COOKIE_FILE, "utf8").trim();
}

let requestId = 0;

export async function rpcCall(method: string, params: unknown[] = []): Promise<unknown> {
  const id = ++requestId;
  const url = `http://${RPC_HOST}:${RPC_PORT}/`;

  const body = JSON.stringify({
    jsonrpc: "1.0",
    id,
    method,
    params,
  });

  // Cookie auth: .cookie file contains "__cookie__:HEX" — already user:pass format
  const auth = Buffer.from(getRpcCookieAuth()).toString("base64");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`RPC error ${res.status}: ${text}`);
  }

  const json = (await res.json()) as { result: unknown; error: unknown };
  if (json.error) {
    throw new Error(`RPC method error: ${JSON.stringify(json.error)}`);
  }

  return json.result;
}
