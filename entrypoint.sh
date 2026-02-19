#!/bin/sh
# BTC-Prometheus node entrypoint
# RPC uses cookie auth (standard practice) — no rpcuser/rpcpassword needed.

DATA_DIR="/home/prometheus/.prometheus"
CONF_FILE="${DATA_DIR}/prometheus.conf"

# Ensure data directory exists and is owned by prometheus
mkdir -p "$DATA_DIR"
chown -R prometheus:prometheus "$DATA_DIR"

# Create default config on first run if none exists
if [ ! -f "$CONF_FILE" ]; then
  cat > "$CONF_FILE" <<CONFEOF
# BTC-Prometheus configuration
# RPC cookie auth is used by default (no rpcuser/rpcpassword needed)
server=1
txindex=0
CONFEOF
  chown prometheus:prometheus "$CONF_FILE"
fi

# Remove any legacy rpcuser/rpcpassword from prometheus.conf so cookie auth activates
sed -i '/^rpcuser=/d' "$CONF_FILE"
sed -i '/^rpcpassword=/d' "$CONF_FILE"

# Drop to prometheus user and start the node
exec su -s /bin/sh prometheus -c "exec prometheusd -conf=\"$CONF_FILE\" \"\$@\"" -- "$@"
