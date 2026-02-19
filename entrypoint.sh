#!/bin/sh
# BTC-Prometheus node entrypoint

DATA_DIR="/home/prometheus/.prometheus"
CONF_FILE="${DATA_DIR}/prometheus.conf"

# Ensure data directory exists and is owned by prometheus
mkdir -p "$DATA_DIR"
chown -R prometheus:prometheus "$DATA_DIR"

# Create default config on first run if none exists
if [ ! -f "$CONF_FILE" ]; then
  cat > "$CONF_FILE" <<CONFEOF
# BTC-Prometheus configuration
server=1
txindex=0
CONFEOF
  chown prometheus:prometheus "$CONF_FILE"
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

chown prometheus:prometheus "$CONF_FILE"

# Drop to prometheus user and start the node
exec su -s /bin/sh prometheus -c "exec prometheusd -conf=\"$CONF_FILE\" \"\$@\"" -- "$@"
