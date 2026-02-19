import express from "express";
import cors from "cors";
import { nodeRouter } from "./routes/node";
import { mempoolRouter } from "./routes/mempool";
import { networkRouter } from "./routes/network";
import { settingsRouter } from "./routes/settings";
import { healthRouter } from "./routes/health";

const app = express();
const PORT = process.env.PORT || 3001;

const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

// Simple ping for container health checks
app.get("/api/ping", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/node", nodeRouter);
app.use("/api/mempool", mempoolRouter);
app.use("/api/network", networkRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/health", healthRouter);

// TLS is terminated upstream by the nginx frontend or Umbrel app proxy.
// This server must not be exposed directly to untrusted networks.
app.listen(PORT, () => {
  console.log(`BTC-Prometheus API listening on port ${PORT}`);
});
