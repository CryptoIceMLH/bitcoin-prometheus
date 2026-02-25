#!/bin/bash

# Static IP for the node on the Umbrel network
export APP_CRYPTOICE_BTC_PROMETHEUS_NODE_IP="10.21.22.20"

# Ports — aligned with standard Bitcoin Core
export APP_CRYPTOICE_BTC_PROMETHEUS_RPC_PORT="8332"
export APP_CRYPTOICE_BTC_PROMETHEUS_P2P_PORT="8333"
export APP_CRYPTOICE_BTC_PROMETHEUS_ZMQ_RAWBLOCK_PORT="28332"
export APP_CRYPTOICE_BTC_PROMETHEUS_ZMQ_RAWTX_PORT="28333"
export APP_CRYPTOICE_BTC_PROMETHEUS_ZMQ_HASHBLOCK_PORT="28334"
export APP_CRYPTOICE_BTC_PROMETHEUS_ZMQ_SEQUENCE_PORT="28335"
export APP_CRYPTOICE_BTC_PROMETHEUS_ZMQ_HASHTX_PORT="28336"

export APP_CRYPTOICE_BTC_PROMETHEUS_NETWORK="mainnet"

# Data directory — for dependent apps to locate blockchain data and .cookie
export APP_CRYPTOICE_BTC_PROMETHEUS_DATA_DIR="${EXPORTS_APP_DIR}/data/bitcoin"

# RPC credentials — generate once, persist in .env
BITCOIN_ENV_FILE="${EXPORTS_APP_DIR}/.env"

if [[ ! -f "${BITCOIN_ENV_FILE}" ]]; then

	if [[ -z ${BITCOIN_RPC_USER+x} ]] || [[ -z ${BITCOIN_RPC_PASS+x} ]]; then
		BITCOIN_RPC_USER="umbrel"
		BITCOIN_RPC_DETAILS=$("${EXPORTS_APP_DIR}/scripts/rpcauth.py" "${BITCOIN_RPC_USER}")
		BITCOIN_RPC_PASS=$(echo "$BITCOIN_RPC_DETAILS" | tail -1)
	fi

	echo "export APP_CRYPTOICE_BTC_PROMETHEUS_RPC_USER='${BITCOIN_RPC_USER}'"	>> "${BITCOIN_ENV_FILE}"
	echo "export APP_CRYPTOICE_BTC_PROMETHEUS_RPC_PASS='${BITCOIN_RPC_PASS}'"	>> "${BITCOIN_ENV_FILE}"
fi

. "${BITCOIN_ENV_FILE}"

# Compatibility aliases — dependent apps (Mempool, Electrs, Fulcrum) look for APP_BITCOIN_*
# ALWAYS override existing values (don't use :=) because we are the bitcoin implementation
for var in \
    NODE_IP \
    RPC_PORT \
    P2P_PORT \
    ZMQ_RAWBLOCK_PORT \
    ZMQ_RAWTX_PORT \
    ZMQ_HASHBLOCK_PORT \
    ZMQ_HASHTX_PORT \
    ZMQ_SEQUENCE_PORT \
    NETWORK \
    RPC_USER \
    RPC_PASS \
    DATA_DIR
do
    bitcoin_var="APP_BITCOIN_${var}"
    prometheus_var="APP_CRYPTOICE_BTC_PROMETHEUS_${var}"
    if [ -n "${!prometheus_var-}" ]; then
        export "$bitcoin_var"="${!prometheus_var}"
    fi
done

# Additional variables that don't have matching Prometheus names
export APP_BITCOIN_NETWORK_ELECTRS="bitcoin"
export APP_BITCOIN_P2P_WHITEBIND_PORT="8335"
export APP_BITCOIN_TOR_PORT="8334"
