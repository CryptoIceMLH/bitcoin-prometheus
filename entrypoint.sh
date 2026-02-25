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
txindex=0
CONFEOF
  chown bitcoin:bitcoin "$CONF_FILE"
fi

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

# RPC binding — allow connections from Docker network
sed -i '/^rpcallowip=/d' "$CONF_FILE"
sed -i '/^rpcbind=/d' "$CONF_FILE"
echo "rpcallowip=0.0.0.0/0" >> "$CONF_FILE"
echo "rpcbind=0.0.0.0" >> "$CONF_FILE"

# Make .cookie world-readable so dependent apps (electrs, Fulcrum) can read it
sed -i '/^rpccookieperms=/d' "$CONF_FILE"
echo "rpccookieperms=all" >> "$CONF_FILE"

# Tor proxy support — strip socks5:// prefix if present (Bitcoin Core expects host:port)
if [ -n "$TOR_PROXY" ]; then
  sed -i '/^proxy=/d' "$CONF_FILE"
  TOR_PROXY_ADDR="${TOR_PROXY#socks5://}"
  echo "proxy=${TOR_PROXY_ADDR}" >> "$CONF_FILE"
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
