#!/bin/sh
# BTC-Prometheus node entrypoint
# Generates dashboard credentials on first run.
# RPC uses cookie auth (standard practice) — no rpcuser/rpcpassword needed.

DATA_DIR="/home/prometheus/.prometheus"
CONF_FILE="${DATA_DIR}/prometheus.conf"
CRED_FILE="${DATA_DIR}/.credentials"

# Ensure data directory exists and is owned by prometheus
mkdir -p "$DATA_DIR"
chown -R prometheus:prometheus "$DATA_DIR"

# Generate dashboard credentials on first run
if [ ! -f "$CRED_FILE" ]; then
  DASH_PASS=$(head -c 32 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 16)
  JWT_SECRET=$(head -c 64 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 64)

  cat > "$CRED_FILE" <<CREDEOF
{
  "dashboardPasswordHash": "",
  "dashboardPassword": "${DASH_PASS}",
  "jwtSecret": "${JWT_SECRET}"
}
CREDEOF
  chmod 600 "$CRED_FILE"
  chown prometheus:prometheus "$CRED_FILE"

  echo "=== BTC-Prometheus First Run ==="
  echo "Dashboard password: ${DASH_PASS}"
  echo "Save this password! You need it to access the web dashboard."
  echo "================================"
fi

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
