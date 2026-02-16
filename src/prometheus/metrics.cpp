// Copyright (c) 2026 The BTC-Prometheus developers
// Distributed under the MIT software license, see the accompanying
// file COPYING or https://opensource.org/license/mit/.

#include <prometheus/metrics.h>

#include <banman.h>
#include <chainparams.h>
#include <clientversion.h>
#include <common/system.h>
#include <httpserver.h>
#include <logging.h>
#include <rpc/protocol.h>
#include <net.h>
#include <node/context.h>
#include <rpc/blockchain.h>
#include <txmempool.h>
#include <util/time.h>
#include <validation.h>

#include <sstream>
#include <string>

using node::NodeContext;

static NodeContext* g_node_context{nullptr};

static std::string FormatGauge(const std::string& name, const std::string& help, int64_t value)
{
    std::ostringstream ss;
    ss << "# HELP " << name << " " << help << "\n";
    ss << "# TYPE " << name << " gauge\n";
    ss << name << " " << value << "\n";
    return ss.str();
}

static std::string FormatGaugeDouble(const std::string& name, const std::string& help, double value)
{
    std::ostringstream ss;
    ss << "# HELP " << name << " " << help << "\n";
    ss << "# TYPE " << name << " gauge\n";
    ss << name << " " << value << "\n";
    return ss.str();
}

static std::string FormatCounter(const std::string& name, const std::string& help, int64_t value)
{
    std::ostringstream ss;
    ss << "# HELP " << name << " " << help << "\n";
    ss << "# TYPE " << name << " counter\n";
    ss << name << " " << value << "\n";
    return ss.str();
}

static bool PrometheusMetricsHandler(HTTPRequest* req, const std::string& strURIPart)
{
    if (!g_node_context) {
        req->WriteReply(HTTP_INTERNAL_SERVER_ERROR, "Node context not available");
        return true;
    }

    std::ostringstream metrics;

    // Chain info
    if (g_node_context->chainman) {
        ChainstateManager& chainman = *g_node_context->chainman;
        LOCK(cs_main);
        const CChain& active_chain = chainman.ActiveChain();
        const CBlockIndex* tip = active_chain.Tip();

        if (tip) {
            metrics << FormatCounter("prometheus_blocks_total", "Total blocks in the active chain", tip->nHeight);
            metrics << FormatGauge("prometheus_block_timestamp", "Timestamp of the chain tip block", tip->GetBlockTime());
            metrics << FormatGaugeDouble("prometheus_difficulty", "Current mining difficulty", GetDifficulty(*tip));
            metrics << FormatGauge("prometheus_chain_size_bytes", "Estimated size of the block and undo files on disk", (int64_t)tip->nDataPos);
        }

        double verification_progress = chainman.GuessVerificationProgress(tip);
        metrics << FormatGaugeDouble("prometheus_verification_progress", "Chain verification progress (0.0 to 1.0)", verification_progress);
    }

    // Mempool info
    if (g_node_context->mempool) {
        CTxMemPool& mempool = *g_node_context->mempool;
        LOCK(mempool.cs);
        metrics << FormatGauge("prometheus_mempool_transactions", "Number of transactions in the mempool", mempool.size());
        metrics << FormatGauge("prometheus_mempool_bytes", "Total size of all transactions in the mempool in bytes", mempool.GetTotalTxSize());
        metrics << FormatGauge("prometheus_mempool_usage_bytes", "Total memory usage for the mempool", mempool.DynamicMemoryUsage());
    }

    // Connection info
    if (g_node_context->connman) {
        CConnman& connman = *g_node_context->connman;
        int total = 0;
        int inbound = 0;
        int outbound = 0;

        connman.ForEachNode([&](CNode* pnode) {
            total++;
            if (pnode->IsInboundConn()) {
                inbound++;
            } else {
                outbound++;
            }
        });

        metrics << FormatGauge("prometheus_peers_connected", "Number of connected peers", total);
        metrics << FormatGauge("prometheus_peers_inbound", "Number of inbound peer connections", inbound);
        metrics << FormatGauge("prometheus_peers_outbound", "Number of outbound peer connections", outbound);

        // Bandwidth
        uint64_t total_bytes_recv = connman.GetTotalBytesRecv();
        uint64_t total_bytes_sent = connman.GetTotalBytesSent();
        metrics << FormatCounter("prometheus_net_bytes_received_total", "Total bytes received from network", (int64_t)total_bytes_recv);
        metrics << FormatCounter("prometheus_net_bytes_sent_total", "Total bytes sent to network", (int64_t)total_bytes_sent);
    }

    // Ban info
    if (g_node_context->banman) {
        BanMan& banman = *g_node_context->banman;
        banmap_t banmap;
        banman.GetBanned(banmap);
        metrics << FormatGauge("prometheus_banned_peers", "Number of banned peer addresses", (int64_t)banmap.size());
    }

    // Uptime
    metrics << FormatGauge("prometheus_uptime_seconds", "Node uptime in seconds", GetTime() - GetStartupTime());

    // Version info (as a labeled gauge)
    metrics << "# HELP prometheus_node_info Node version information\n";
    metrics << "# TYPE prometheus_node_info gauge\n";
    metrics << "prometheus_node_info{version=\"" << FormatFullVersion() << "\",user_agent=\"/Prometheus:" << FormatFullVersion() << "/\"} 1\n";

    std::string body = metrics.str();
    req->WriteHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    req->WriteReply(HTTP_OK, body);
    return true;
}

void RegisterPrometheusMetrics(NodeContext& node)
{
    g_node_context = &node;
    RegisterHTTPHandler("/metrics", true, PrometheusMetricsHandler);
    LogInfo("Prometheus metrics endpoint registered at /metrics\n");
}

void UnregisterPrometheusMetrics()
{
    UnregisterHTTPHandler("/metrics", true);
    g_node_context = nullptr;
}
