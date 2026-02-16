import express from "express";
import cors from "cors";
import { getCredentials } from "./lib/credentials";
import { authMiddleware } from "./middleware/auth";
import { authRouter } from "./routes/auth";
import { nodeRouter } from "./routes/node";
import { mempoolRouter } from "./routes/mempool";
import { networkRouter } from "./routes/network";
import { settingsRouter } from "./routes/settings";
import { healthRouter } from "./routes/health";

// Initialize credentials on startup (generates on first run)
getCredentials();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Auth routes (login does NOT require JWT)
app.use("/api/auth", authRouter);

// Simple ping for container health checks (no auth)
app.get("/api/ping", (_req, res) => {
  res.json({ ok: true });
});

// All other routes require authentication
app.use(authMiddleware);

app.use("/api/node", nodeRouter);
app.use("/api/mempool", mempoolRouter);
app.use("/api/network", networkRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/health", healthRouter);

app.listen(PORT, () => {
  console.log(`BTC-Prometheus API listening on port ${PORT}`);
});
