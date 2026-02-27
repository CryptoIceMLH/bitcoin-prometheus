# Dev Server How-To

**Dev server:** 192.168.1.114
**User:** prometheus
**SSH:** `ssh prometheus@192.168.1.114`

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

## v0.2.1 Changes

**Fixed Issues:**
- ✅ Proxy clearing: entrypoint.sh now always removes old proxy setting before setting new one
- ✅ RPC exposure: RPC port now bound to `0.0.0.0:8332` for Docker network access
- ✅ Data persistence: Using host bind mount (`/home/prometheus/.bitcoin`) instead of Docker volumes

**Configuration Management:**
- All settings managed via environment variables in entrypoint.sh
- `bitcoin.conf` dynamically generated on container startup
- No hardcoded paths — fully containerized
