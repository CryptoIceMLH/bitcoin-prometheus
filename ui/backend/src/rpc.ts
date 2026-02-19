import * as fs from "fs";
import * as path from "path";

const DATA_DIR = process.env.DATA_DIR || "/data";
const COOKIE_FILE = path.join(DATA_DIR, ".cookie");
const RPC_HOST = process.env.RPC_HOST || "prometheus-node";
const RPC_PORT = process.env.RPC_PORT || "8332";
const RPC_USER = process.env.RPC_USER || "";
const RPC_PASS = process.env.RPC_PASS || "";

function getRpcAuth(): string {
  // Prefer env var credentials (Umbrel mode), fall back to cookie auth (standalone)
  if (RPC_USER && RPC_PASS) {
    return `${RPC_USER}:${RPC_PASS}`;
  }
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

  const auth = Buffer.from(getRpcAuth()).toString("base64");

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
