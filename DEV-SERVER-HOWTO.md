# Dev Server How-To

**Dev server:** 192.168.1.114
**User:** prometheus
**SSH:** `ssh prometheus@192.168.1.114`
**Repo path:** `/home/prometheus/BTC-Prometheus`

---

## Key Facts

- Dev server builds images **locally from source** using `docker-compose.yml`
- Umbrel uses pre-built GHCR images from `ghcr.io/cryptoicemlh/`
- Blockchain data lives at: `/home/prometheus/.bitcoin/` (host bind mount) — **NEVER DELETE THIS**
- UI accessible at: **http://192.168.1.114:3000/**
- RPC exposed to Docker network on `0.0.0.0:8332` for API connectivity

---

## Starting Fresh on Dev Server

### 1. Clone repo
```bash
git clone https://github.com/CryptoIceMLH/bitcoin-prometheus.git
cd bitcoin-prometheus
```

### 2. Build and start
```bash
docker compose build   # takes 10-20 mins (compiles Bitcoin Core from source)
docker compose up -d
```

### 3. Check status
```bash
docker ps
docker logs btc-prometheus --tail=50
```

### 4. Access UI
Open browser: http://192.168.1.114:3000/

---

## Stopping / Restarting

```bash
docker compose down      # stop containers (keeps blockchain data)
docker compose up -d     # start again (no rebuild needed)
```

## Full Clean (keep blockchain data)

```bash
docker compose down
docker system prune -af --volumes   # removes images, forces rebuild
# Blockchain data at /home/prometheus/.bitcoin/ is never affected
```

**The blockchain data at `/home/prometheus/.bitcoin/` is a host bind mount — it persists across container restarts.**

---

## Umbrel Deployment

Umbrel pulls pre-built images from GHCR:
- `ghcr.io/cryptoicemlh/btc-prometheus-node:vX.X.X`
- `ghcr.io/cryptoicemlh/btc-prometheus-api:vX.X.X`
- `ghcr.io/cryptoicemlh/btc-prometheus-ui:vX.X.X`

Configuration via environment variables (Umbrel orchestration):
- `RPC_USER`, `RPC_PASS` — for rpcauth generation
- `RPC_PORT`, `P2P_PORT` — for custom port configuration
- `TOR_PROXY` — for Tor proxy routing
- `ZMQ_*_PORT` — for ZMQ endpoints

Update on Umbrel: `sudo systemctl restart umbrel.service`

---

## Push Images to GHCR (after dev test passes)

```bash
# Tag
docker tag btc-prometheus-prometheus-node ghcr.io/cryptoicemlh/btc-prometheus-node:vX.X.X
docker tag btc-prometheus-ui-backend ghcr.io/cryptoicemlh/btc-prometheus-api:vX.X.X
docker tag btc-prometheus-ui-frontend ghcr.io/cryptoicemlh/btc-prometheus-ui:vX.X.X

# Push
docker push ghcr.io/cryptoicemlh/btc-prometheus-node:vX.X.X
docker push ghcr.io/cryptoicemlh/btc-prometheus-api:vX.X.X
docker push ghcr.io/cryptoicemlh/btc-prometheus-ui:vX.X.X
```

---

## Git Workflow (Important!)

**Branch Structure:**
- **Local:** `master` — development branch
- **Remote:** `origin/main` — production branch (what Umbrel watches)
- Only `main` exists on GitHub; no `master` branch on remote

**When pushing changes to Umbrel:**

1. **Edit files locally on `master`**
   ```bash
   git checkout master
   # make changes, test locally
   ```

2. **Commit and push to `main` on GitHub**
   ```bash
   git add <files>
   git commit -m "message"
   git push origin master:main    # pushes local master to remote main
   ```

3. **Tag and push images to GHCR** (from dev server after testing)
   ```bash
   # On 192.168.1.114 after docker compose build:
   docker tag btc-prometheus-prometheus-node ghcr.io/cryptoicemlh/btc-prometheus-node:vX.X.X
   docker tag btc-prometheus-ui-backend ghcr.io/cryptoicemlh/btc-prometheus-api:vX.X.X
   docker tag btc-prometheus-ui-frontend ghcr.io/cryptoicemlh/btc-prometheus-ui:vX.X.X

   docker push ghcr.io/cryptoicemlh/btc-prometheus-node:vX.X.X
   docker push ghcr.io/cryptoicemlh/btc-prometheus-api:vX.X.X
   docker push ghcr.io/cryptoicemlh/btc-prometheus-ui:vX.X.X
   ```

4. **Update Umbrel** (on 192.168.1.213)
   ```bash
   sudo systemctl restart umbrel.service
   ```
   This will pull the new images from GHCR based on updated `cryptoice-btc-prometheus/docker-compose.yml` on `main`.

---

## Dev Server Rebuild Workflow

When code changes require a rebuild (e.g., entrypoint.sh, source code):

```bash
# 1. Stop existing containers (keeps blockchain data)
docker compose down

# 2. Pull latest from GitHub main
git fetch origin
git merge origin/main

# 3. Rebuild images fresh (no cache)
docker compose build --no-cache

# 4. Start containers
docker compose up -d

# 5. Monitor build progress
docker logs -f btc-prometheus
```

Blockchain data at `/home/prometheus/.bitcoin/` is never lost.

---

## Version Bump Checklist

When bumping version (e.g., v0.2.1 → v0.2.2):

- [ ] **`CMakeLists.txt` — `CLIENT_VERSION_BUILD` (MUST be updated or binary shows wrong version!)** ⚠️ **CRITICAL**
- [ ] `umbrel-app.yml` (root) — `version:` field + `releaseNotes:`
- [ ] `cryptoice-btc-prometheus/umbrel-app.yml` — `version:` field + `releaseNotes:`
- [ ] **`cryptoice-btc-prometheus/docker-compose.yml` — update ALL image tags** ⚠️ **CRITICAL**
- [ ] `ui/frontend/src/components/Layout.tsx` — version display
- [ ] Commit to `master`
- [ ] Push `master:main` to GitHub
- [ ] Rebuild on dev server with `docker compose build --no-cache`
- [ ] Test on dev server
- [ ] Tag and push images to GHCR with new version
- [ ] Update Umbrel with `sudo systemctl restart umbrel.service`

**⚠️ CRITICAL: `cryptoice-btc-prometheus/docker-compose.yml` image tags MUST be updated!**

The Umbrel deployment file contains hardcoded image version tags:
```yaml
  prometheus-node:
    image: ghcr.io/cryptoicemlh/btc-prometheus-node:vX.X.X   # ← UPDATE THIS
  ui-backend:
    image: ghcr.io/cryptoicemlh/btc-prometheus-api:vX.X.X   # ← UPDATE THIS
  ui-frontend:
    image: ghcr.io/cryptoicemlh/btc-prometheus-ui:vX.X.X    # ← UPDATE THIS
```

**If you skip this step:**
- Umbrel will pull OLD images from GHCR (wrong version)
- New code changes won't be deployed
- All the development work goes to waste
- You'll debug for hours wondering why nothing changed

Update all three image tags to match the new version number BEFORE pushing to GitHub.

---

## v0.2.2 Changes

**Fixed Issues:**
- ✅ JSON-RPC 1.1 compatibility: Electrs and Mempool now work (prometheusd accepts "1.1" as legacy)
- ✅ P2P port binding: Fixed inbound peer connections (env var P2P_PORT now propagates to bitcoin.conf)
- ✅ Tor hidden service wiring: TOR_CONTROL env var enables inbound Tor (listenonion) without forcing outbound routing

**Configuration Management:**
- All settings managed via environment variables in entrypoint.sh
- `bitcoin.conf` dynamically generated on container startup
- No hardcoded paths — fully containerized
