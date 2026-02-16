#!/bin/sh
# BTC-Prometheus node entrypoint
# Generates dashboard credentials on first run.
# RPC uses cookie auth (standard practice) — no rpcuser/rpcpassword needed.

DATA_DIR="/home/prometheus/.prometheus"
CONF_FILE="${DATA_DIR}/prometheus.conf"
CRED_FILE="${DATA_DIR}/.credentials"

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

  echo "=== BTC-Prometheus First Run ==="
  echo "Dashboard password: ${DASH_PASS}"
  echo "Save this password! You need it to access the web dashboard."
  echo "================================"
fi

# Remove any legacy rpcuser/rpcpassword from prometheus.conf so cookie auth activates
if [ -f "$CONF_FILE" ]; then
  sed -i '/^rpcuser=/d' "$CONF_FILE"
  sed -i '/^rpcpassword=/d' "$CONF_FILE"
fi

# Start the node — cookie auth is automatic when no rpcpassword is set
exec prometheusd -conf="$CONF_FILE" "$@"
