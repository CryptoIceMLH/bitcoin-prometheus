#!/bin/bash

# Static IP for the node on the Umbrel network
export APP_CRYPTOICE_BTC_PROMETHEUS_NODE_IP="10.21.22.20"

# Ports — same as official bitcoin app (we're a replacement via implements)
export APP_CRYPTOICE_BTC_PROMETHEUS_RPC_PORT="8332"
export APP_CRYPTOICE_BTC_PROMETHEUS_P2P_PORT="8333"
export APP_CRYPTOICE_BTC_PROMETHEUS_ZMQ_RAWBLOCK_PORT="28332"
export APP_CRYPTOICE_BTC_PROMETHEUS_ZMQ_RAWTX_PORT="28333"
export APP_CRYPTOICE_BTC_PROMETHEUS_ZMQ_HASHBLOCK_PORT="28334"
export APP_CRYPTOICE_BTC_PROMETHEUS_ZMQ_HASHTX_PORT="28335"

export APP_CRYPTOICE_BTC_PROMETHEUS_NETWORK="mainnet"

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
for var in \
    NODE_IP \
    RPC_PORT \
    P2P_PORT \
    ZMQ_RAWBLOCK_PORT \
    ZMQ_RAWTX_PORT \
    ZMQ_HASHBLOCK_PORT \
    ZMQ_HASHTX_PORT \
    NETWORK \
    RPC_USER \
    RPC_PASS
do
    bitcoin_var="APP_BITCOIN_${var}"
    prometheus_var="APP_CRYPTOICE_BTC_PROMETHEUS_${var}"
    if [ -n "${!prometheus_var-}" ]; then
        export "$bitcoin_var"="${!bitcoin_var:=${!prometheus_var}}"
    fi
done
