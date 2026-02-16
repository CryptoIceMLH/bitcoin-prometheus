// Copyright (c) 2026 The BTC-Prometheus developers
// Distributed under the MIT software license, see the accompanying
// file COPYING or https://opensource.org/license/mit/.

#ifndef BITCOIN_PROMETHEUS_METRICS_H
#define BITCOIN_PROMETHEUS_METRICS_H

#include <string>

class HTTPRequest;
namespace node {
struct NodeContext;
}

/** Register the /metrics HTTP handler for Prometheus-compatible scraping. */
void RegisterPrometheusMetrics(node::NodeContext& node);

/** Unregister the /metrics HTTP handler. */
void UnregisterPrometheusMetrics();

#endif // BITCOIN_PROMETHEUS_METRICS_H
