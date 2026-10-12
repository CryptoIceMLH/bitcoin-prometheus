#!/bin/sh
# BTC-Prometheus node entrypoint

DATA_DIR="/home/bitcoin/.bitcoin"
CONF_FILE="${DATA_DIR}/bitcoin.conf"

# Auto-migrate from old .prometheus path if upgrading from v0.1.x
OLD_DIR="/home/bitcoin/.prometheus"
if [ -d "$OLD_DIR" ] && [ ! -d "$DATA_DIR" ]; then
  echo "Migrating data from $OLD_DIR to $DATA_DIR..."
  mv "$OLD_DIR" "$DATA_DIR"
fi

# Ensure data directory exists and is owned by bitcoin
mkdir -p "$DATA_DIR"
chown -R bitcoin:bitcoin "$DATA_DIR"

# Create default config on first run if none exists
if [ ! -f "$CONF_FILE" ]; then
  cat > "$CONF_FILE" <<CONFEOF
# BTC-Prometheus configuration
server=1
txindex=1
CONFEOF
  chown bitcoin:bitcoin "$CONF_FILE"
fi

# Read the last value of a key from bitcoin.conf (empty if unset)
conf_get() {
  grep -E "^$1=" "$CONF_FILE" | tail -n 1 | cut -d= -f2-
}

# Always ensure server=1 is set (required for RPC — may be missing if config was restored from backup)
sed -i '/^server=/d' "$CONF_FILE"
echo "server=1" >> "$CONF_FILE"

# txindex vs prune — Bitcoin Core refuses to start with both, so pruning wins:
#   prune > 0         → txindex=0 (Electrs, Mempool and Fulcrum need an unpruned node)
#   txindex unset     → txindex=1 (default, required for Mempool and block explorers)
#   otherwise         → keep the operator's choice from Sovereign Controls
PRUNE="$(conf_get prune)"
TXINDEX="$(conf_get txindex)"
if [ -n "$PRUNE" ] && [ "$PRUNE" != "0" ]; then
  if [ "$TXINDEX" != "0" ]; then
    echo "Pruning enabled (prune=${PRUNE}): disabling txindex. Electrs, Mempool and Fulcrum need an unpruned node."
  fi
  TXINDEX=0
elif [ -z "$TXINDEX" ]; then
  TXINDEX=1
fi
sed -i '/^txindex=/d' "$CONF_FILE"
echo "txindex=${TXINDEX}" >> "$CONF_FILE"

# Remove any legacy rpcuser/rpcpassword so cookie auth activates when no RPC env vars set
sed -i '/^rpcuser=/d' "$CONF_FILE"
sed -i '/^rpcpassword=/d' "$CONF_FILE"

# If RPC_USER and RPC_PASS are set (Umbrel mode), generate proper rpcauth line
if [ -n "$RPC_USER" ] && [ -n "$RPC_PASS" ]; then
  sed -i '/^rpcauth=/d' "$CONF_FILE"
  RPCAUTH_LINE=$(python3 /usr/local/bin/rpcauth.py "$RPC_USER" "$RPC_PASS" | grep '^rpcauth=')
  echo "$RPCAUTH_LINE" >> "$CONF_FILE"
fi

# Write network config from env vars if set (Umbrel deployment)
if [ -n "$RPC_PORT" ]; then
  sed -i '/^rpcport=/d' "$CONF_FILE"
  echo "rpcport=${RPC_PORT}" >> "$CONF_FILE"
fi

if [ -n "$P2P_PORT" ]; then
  sed -i '/^port=/d' "$CONF_FILE"
  echo "port=${P2P_PORT}" >> "$CONF_FILE"
fi

# Public inbound — "Accept Incoming Connections" in Sovereign Controls is stored as
# publicinbound=0|1 (a Prometheus-only key; bitcoind ignores it). Core itself must always
# have listen=1 because whitebind (needed by Electrs/Mempool/Fulcrum) fails with listen=0.
# Migrate a legacy listen=0 from older versions into publicinbound=0.
PUBLIC_INBOUND="$(conf_get publicinbound)"
if [ -z "$PUBLIC_INBOUND" ]; then
  if [ "$(conf_get listen)" = "0" ]; then PUBLIC_INBOUND=0; else PUBLIC_INBOUND=1; fi
fi
sed -i '/^publicinbound=/d' "$CONF_FILE"
sed -i '/^listen=/d' "$CONF_FILE"
sed -i '/^discover=/d' "$CONF_FILE"
echo "publicinbound=${PUBLIC_INBOUND}" >> "$CONF_FILE"
echo "listen=1" >> "$CONF_FILE"

# P2P bind — match official Bitcoin Core / Umbrel pattern:
#   bind=0.0.0.0:8333           → public P2P listener (explicit, because whitebind suppresses the default)
#                                 127.0.0.1:8333 instead when public inbound is off
#   whitebind=0.0.0.0:8335      → trusted internal listener for dependent apps (Electrs, Mempool, Fulcrum)
#   bind=127.0.0.1:8334=onion   → target of our Tor onion service (added below when Tor is enabled)
# Both 8333 and 8335 lines are required: whitebind alone kills the public 8333 listener.
sed -i '/^bind=/d' "$CONF_FILE"
sed -i '/^whitebind=/d' "$CONF_FILE"
sed -i '/^whitelist=/d' "$CONF_FILE"
P2P="${P2P_PORT:-8333}"
if [ "$PUBLIC_INBOUND" = "1" ]; then
  echo "bind=0.0.0.0:${P2P}" >> "$CONF_FILE"
else
  echo "Public inbound disabled: P2P listener bound to 127.0.0.1 only"
  echo "bind=127.0.0.1:${P2P}" >> "$CONF_FILE"
  echo "discover=0" >> "$CONF_FILE"
fi
echo "whitebind=0.0.0.0:8335" >> "$CONF_FILE"

# RPC binding — allow connections from Docker network
sed -i '/^rpcallowip=/d' "$CONF_FILE"
sed -i '/^rpcbind=/d' "$CONF_FILE"
echo "rpcallowip=0.0.0.0/0" >> "$CONF_FILE"
echo "rpcbind=0.0.0.0" >> "$CONF_FILE"

# Make .cookie world-readable so dependent apps (electrs, Fulcrum) can read it
sed -i '/^rpccookieperms=/d' "$CONF_FILE"
echo "rpccookieperms=all" >> "$CONF_FILE"

# SOCKS5 proxy — TOR_PROXY env var overrides; otherwise keep whatever the operator
# set in Sovereign Controls (e.g. proxy=127.0.0.1:9050 to route everything over Tor)
if [ -n "$TOR_PROXY" ]; then
  sed -i '/^proxy=/d' "$CONF_FILE"
  echo "proxy=${TOR_PROXY#socks5://}" >> "$CONF_FILE"
fi

# Built-in Tor (TOR_ENABLED=1): runs inside this container so bitcoind can use cookie auth
# on 127.0.0.1:9051 and the onion service can reach the node on 127.0.0.1:8334.
#   onion=127.0.0.1:9050 → reach .onion peers via Tor (clearnet stays direct unless proxy= is set)
#   listenonion=1        → publish an onion service for inbound Tor peers
sed -i '/^torcontrol=/d' "$CONF_FILE"
sed -i '/^listenonion=/d' "$CONF_FILE"
sed -i '/^onion=/d' "$CONF_FILE"
if [ "$TOR_ENABLED" = "1" ]; then
  TOR_DIR="${DATA_DIR}/tor"
  mkdir -p "$TOR_DIR"
  chown bitcoin:bitcoin "$TOR_DIR"
  chmod 700 "$TOR_DIR"
  cat > /etc/tor/prometheus-torrc <<TOREOF
SocksPort 127.0.0.1:9050
ControlPort 127.0.0.1:9051
CookieAuthentication 1
DataDirectory ${TOR_DIR}
Log notice file ${TOR_DIR}/notices.log
RunAsDaemon 1
TOREOF
  if su -s /bin/sh bitcoin -c "tor -f /etc/tor/prometheus-torrc"; then
    echo "onion=127.0.0.1:9050" >> "$CONF_FILE"
    if [ "$PUBLIC_INBOUND" = "1" ]; then
      echo "torcontrol=127.0.0.1:9051" >> "$CONF_FILE"
      echo "listenonion=1" >> "$CONF_FILE"
      echo "bind=127.0.0.1:8334=onion" >> "$CONF_FILE"
    else
      echo "listenonion=0" >> "$CONF_FILE"
    fi
  else
    echo "WARNING: Tor failed to start, continuing without Tor (see ${TOR_DIR}/notices.log)"
  fi
fi

# ZMQ endpoints
if [ -n "$ZMQ_RAWBLOCK_PORT" ]; then
  sed -i '/^zmqpubrawblock=/d' "$CONF_FILE"
  echo "zmqpubrawblock=tcp://0.0.0.0:${ZMQ_RAWBLOCK_PORT}" >> "$CONF_FILE"
fi

if [ -n "$ZMQ_RAWTX_PORT" ]; then
  sed -i '/^zmqpubrawtx=/d' "$CONF_FILE"
  echo "zmqpubrawtx=tcp://0.0.0.0:${ZMQ_RAWTX_PORT}" >> "$CONF_FILE"
fi

if [ -n "$ZMQ_HASHBLOCK_PORT" ]; then
  sed -i '/^zmqpubhashblock=/d' "$CONF_FILE"
  echo "zmqpubhashblock=tcp://0.0.0.0:${ZMQ_HASHBLOCK_PORT}" >> "$CONF_FILE"
fi

if [ -n "$ZMQ_HASHTX_PORT" ]; then
  sed -i '/^zmqpubhashtx=/d' "$CONF_FILE"
  echo "zmqpubhashtx=tcp://0.0.0.0:${ZMQ_HASHTX_PORT}" >> "$CONF_FILE"
fi

if [ -n "$ZMQ_SEQUENCE_PORT" ]; then
  sed -i '/^zmqpubsequence=/d' "$CONF_FILE"
  echo "zmqpubsequence=tcp://0.0.0.0:${ZMQ_SEQUENCE_PORT}" >> "$CONF_FILE"
fi

chown bitcoin:bitcoin "$CONF_FILE"

# Drop to bitcoin user and start the node
exec su -s /bin/sh bitcoin -c "exec prometheusd -conf=\"$CONF_FILE\" \"\$@\"" -- "$@"
