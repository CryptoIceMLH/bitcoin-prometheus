import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import {
  getDashboardPasswordHash,
  getDashboardPassword,
  getJwtSecret,
  getRpcCookieAuth,
  isFirstRun,
  markClaimed,
} from "../lib/credentials";

export const authRouter = Router();

// GET /api/auth/setup — public: tells frontend if this is first run (shows password)
authRouter.get("/setup", (_req, res) => {
  if (isFirstRun()) {
    res.json({ firstRun: true, password: getDashboardPassword() });
  } else {
    res.json({ firstRun: false });
  }
});

// POST /api/auth/login — exchange password for JWT
authRouter.post("/login", (req, res) => {
  const { password } = req.body as { password?: string };
  if (!password) {
    res.status(400).json({ error: "Password required" });
    return;
  }

  if (!bcrypt.compareSync(password, getDashboardPasswordHash())) {
    res.status(401).json({ error: "Invalid password" });
    return;
  }

  // Mark as claimed on first successful login — password won't show on screen again
  if (isFirstRun()) {
    markClaimed();
  }

  const token = jwt.sign({ sub: "dashboard" }, getJwtSecret(), { expiresIn: "24h" });
  res.json({ token });
});

// GET /api/auth/check — verify JWT is valid
authRouter.get("/check", (req, res) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ ok: false });
    return;
  }

  try {
    jwt.verify(header.slice(7), getJwtSecret());
    res.json({ ok: true });
  } catch {
    res.status(401).json({ ok: false });
  }
});

// GET /api/auth/credentials — return RPC cookie + dashboard password for Settings display
authRouter.get("/credentials", (req, res) => {
  let rpcUser = "";
  let rpcPassword = "";

  try {
    const cookie = getRpcCookieAuth();
    const colonIdx = cookie.indexOf(":");
    if (colonIdx !== -1) {
      rpcUser = cookie.slice(0, colonIdx);
      rpcPassword = cookie.slice(colonIdx + 1);
    }
  } catch {
    rpcPassword = "Node not running";
  }

  res.json({
    rpcUser,
    rpcPassword,
  });
});
