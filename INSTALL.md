# BTC-Prometheus Installation Guide

## What is this?

BTC-Prometheus is a sovereign Bitcoin node. It runs as 3 Docker containers:

- **prometheus-node** — The Bitcoin node itself (prometheusd)
- **ui-backend** — Express API server (port 3001, internal)
- **ui-frontend** — Web dashboard (port 3000, nginx)

## Requirements

- **OS:** Ubuntu 22.04+ / Debian 12+ (any Linux with Docker)
- **Docker:** Docker Engine 24+ with Docker Compose v2
- **RAM:** 4 GB minimum (8 GB+ recommended for faster sync)
- **Disk:** 700 GB+ free for full blockchain (or use pruning)
- **CPU:** 2+ cores (4+ recommended)
- **Network:** Open port 8333 (TCP) for inbound peer connections

## Quick Start

### 1. Install Docker

```bash
# Ubuntu/Debian
sudo apt update && sudo apt install -y docker.io docker-compose-v2
sudo usermod -aG docker $USER
# Log out and back in for group to take effect
```

### 2. Clone the repo

```bash
git clone <your-repo-url> BTC-Prometheus
cd BTC-Prometheus
```

### 3. Configure

Edit `docker-compose.yml` to set your preferences:

```yaml
services:
  prometheus-node:
    command:
      - -printtoconsole
      - -rpcallowip=0.0.0.0/0
      - -rpcbind=0.0.0.0
      - -rpcuser=prometheus        # Change this
      - -rpcpassword=changeme      # CHANGE THIS!
      - -dbcache=450               # RAM for UTXO cache (MB). Higher = faster sync
```

**Important settings to change:**
- `-rpcpassword` — Change from `changeme` to something secure
- `-dbcache` — Set based on your available RAM. Use ~75% of free RAM during initial sync, then lower to 450 after sync completes. On spinning disks (HDD), keep under 1000 MB to avoid long flush pauses.

If you change the RPC credentials, also update them in the `ui-backend` environment section:

```yaml
  ui-backend:
    environment:
      - RPC_USER=prometheus          # Must match node
      - RPC_PASSWORD=changeme        # Must match node
```

### 4. Build and start

```bash
docker compose build
docker compose up -d
```

First build compiles the node from source — this takes 15-30 minutes depending on your hardware.

### 5. Access the dashboard

Open your browser to:

```
http://<your-server-ip>:3000
```

The node will start syncing the blockchain immediately. You can watch progress in the dashboard — the sync progress bar shows the percentage.

## Useful Commands

```bash
# View all container status
docker compose ps

# View node logs (follow mode)
docker compose logs -f prometheus-node

# View last 50 lines of node logs
docker compose logs --tail 50 prometheus-node

# Stop everything
docker compose down

# Stop and remove all data (DELETES BLOCKCHAIN DATA)
docker compose down -v

# Rebuild after code changes
docker compose build --no-cache ui-frontend && docker compose up -d ui-frontend
docker compose build --no-cache ui-backend && docker compose up -d ui-backend

# Rebuild the node (only needed if you modify the node source code)
docker compose build --no-cache prometheus-node && docker compose up -d prometheus-node

# Check blockchain sync progress via RPC
docker exec btc-prometheus prometheus-cli -rpcuser=prometheus -rpcpassword=changeme getblockchaininfo
```

## Architecture

```
Port 3000 (Web UI)
  |
  nginx (ui-frontend container)
  |   |
  |   +-- Static files (React SPA)
  |   +-- /api/* --> proxy to ui-backend:3001
  |
Port 3001 (API, internal only)
  |
  Express (ui-backend container)
  |
  +-- RPC calls to prometheus-node:8332
  |
Port 8332 (RPC, internal)
Port 8333 (P2P, public)
  |
  prometheusd (prometheus-node container)
  |
  +-- Blockchain data in Docker volume "prometheus-data"
```

## Firewall / Port Forwarding

- **Port 3000** — Web dashboard. Only expose on your LAN or behind a reverse proxy.
- **Port 8333** — Bitcoin P2P. Forward this port on your router if you want inbound peer connections (helps the network).
- **Port 8332** — RPC. Do NOT expose to the internet. Only used internally between containers.

## Initial Blockchain Sync

Full sync takes 1-7 days depending on hardware:

| Hardware | Approximate Time |
|----------|-----------------|
| SSD + 8 cores + 8 GB RAM | 1-2 days |
| SSD + 4 cores + 4 GB RAM | 2-4 days |
| HDD + 4 cores + 4 GB RAM | 5-7 days |

Tips for faster sync:
- Use an SSD if possible (biggest impact)
- Set `-dbcache` as high as your RAM allows during sync
- Set `-par=0` (auto-detect CPU cores, this is the default)

## Pruning (Save Disk Space)

If you don't have 700 GB free, enable pruning. Add to the node command in `docker-compose.yml`:

```yaml
      - -prune=550    # Keep only 550 MB of block data (minimum)
```

This reduces disk usage to ~10 GB but you won't be able to serve historical blocks to other nodes.

## Tor Support

A Tor SOCKS5 proxy is bundled in the Docker stack (`tor-proxy` service). To enable Tor:

1. Open the web dashboard at `http://<your-server-ip>:3000`
2. Go to **Sovereign Controls** (Settings page)
3. In **Network & Privacy**, set **SOCKS5 Proxy** to `tor-proxy:9050`
4. Optionally check **Tor (.onion)** under **Allowed Networks** to connect only via Tor
5. Click **Apply Changes**, then **Restart Node**

After restart, your node will route connections through Tor. Onion peers will start appearing in the dashboard within a few minutes.

To verify Tor is working:

```bash
# Check if Tor proxy container is running
docker compose ps tor-proxy

# Check node sees Tor as reachable
docker exec btc-prometheus bitcoin-cli -rpcuser=prometheus -rpcpassword=changeme getnetworkinfo | grep -A3 onion
```

## Troubleshooting

**Dashboard shows "Node Unavailable"**
- Check if the node is running: `docker compose ps`
- Check node logs: `docker compose logs --tail 20 prometheus-node`
- The node may be doing a UTXO flush (can take several minutes on HDD). Wait and retry.

**Node stuck at same block height**
- Check logs for "Flushing UTXO" messages — this is normal, wait for it to finish
- Check if you're I/O bound (HDD): `docker stats` — low CPU + high block I/O = disk bottleneck

**RPC errors / "work queue depth exceeded"**
- Increase RPC work queue: add `-rpcworkqueue=128` to the node command
- Or increase RPC threads: add `-rpcthreads=8`

**Settings don't apply after changing docker-compose.yml**
- You need to recreate the container: `docker compose up -d prometheus-node`
- Or use the "Restart Node" button on the Sovereign Controls (Settings) page

**Can't connect to dashboard from another machine**
- Check firewall: `sudo ufw allow 3000/tcp`
- Make sure you're using the server's IP, not localhost
