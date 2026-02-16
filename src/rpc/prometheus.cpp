// Copyright (c) 2026 The BTC-Prometheus developers
// Distributed under the MIT software license, see the accompanying
// file COPYING or https://opensource.org/license/mit/.

#include <rpc/prometheus.h>

#include <banman.h>
#include <chainparams.h>
#include <clientversion.h>
#include <common/args.h>
#include <common/system.h>
#include <kernel/cs_main.h>
#include <net.h>
#include <net_processing.h>
#include <netbase.h>
#include <node/context.h>
#include <policy/policy.h>
#include <rpc/blockchain.h>
#include <rpc/server.h>
#include <rpc/server_util.h>
#include <rpc/util.h>
#include <txmempool.h>
#include <util/time.h>
#include <validation.h>

#include <univalue.h>

using node::NodeContext;

static RPCHelpMan getprometheusinfo()
{
    return RPCHelpMan{"getprometheusinfo",
        "\nReturns a combined snapshot of node status, chain info, mempool, and network state.\n",
        {},
        RPCResult{
            RPCResult::Type::OBJ, "", "",
            {
                {RPCResult::Type::STR, "version", "Node version string"},
                {RPCResult::Type::STR, "user_agent", "Node user agent"},
                {RPCResult::Type::STR, "chain", "Current network (main, test, signet, regtest)"},
                {RPCResult::Type::NUM, "blocks", "Current block height"},
                {RPCResult::Type::STR_HEX, "bestblockhash", "Hash of the best (tip) block"},
                {RPCResult::Type::NUM, "difficulty", "Current difficulty"},
                {RPCResult::Type::NUM, "verification_progress", "Chain verification progress (0.0 to 1.0)"},
                {RPCResult::Type::NUM, "mempool_transactions", "Number of transactions in mempool"},
                {RPCResult::Type::NUM, "mempool_bytes", "Mempool size in bytes"},
                {RPCResult::Type::NUM, "mempool_usage", "Mempool memory usage in bytes"},
                {RPCResult::Type::NUM, "connections", "Total number of peer connections"},
                {RPCResult::Type::NUM, "connections_in", "Number of inbound connections"},
                {RPCResult::Type::NUM, "connections_out", "Number of outbound connections"},
                {RPCResult::Type::BOOL, "network_active", "Whether the network is active"},
                {RPCResult::Type::NUM, "uptime", "Node uptime in seconds"},
            }},
        RPCExamples{
            HelpExampleCli("getprometheusinfo", "")
            + HelpExampleRpc("getprometheusinfo", "")
        },
        [&](const RPCHelpMan& self, const JSONRPCRequest& request) -> UniValue
{
    NodeContext& node = EnsureAnyNodeContext(request.context);
    ChainstateManager& chainman = EnsureAnyChainman(request.context);

    UniValue obj(UniValue::VOBJ);

    obj.pushKV("version", FormatFullVersion());
    obj.pushKV("user_agent", strprintf("/Prometheus:%s/", FormatFullVersion()));

    {
        LOCK(cs_main);
        const CBlockIndex* tip = chainman.ActiveChain().Tip();
        obj.pushKV("chain", chainman.GetParams().GetChainTypeString());

        if (tip) {
            obj.pushKV("blocks", tip->nHeight);
            obj.pushKV("bestblockhash", tip->GetBlockHash().GetHex());
            obj.pushKV("difficulty", GetDifficulty(*tip));
            obj.pushKV("verification_progress",
                chainman.GuessVerificationProgress(tip));
        } else {
            obj.pushKV("blocks", 0);
            obj.pushKV("bestblockhash", "");
            obj.pushKV("difficulty", 0.0);
            obj.pushKV("verification_progress", 0.0);
        }
    }

    if (node.mempool) {
        LOCK(node.mempool->cs);
        obj.pushKV("mempool_transactions", (int64_t)node.mempool->size());
        obj.pushKV("mempool_bytes", (int64_t)node.mempool->GetTotalTxSize());
        obj.pushKV("mempool_usage", (int64_t)node.mempool->DynamicMemoryUsage());
    } else {
        obj.pushKV("mempool_transactions", 0);
        obj.pushKV("mempool_bytes", 0);
        obj.pushKV("mempool_usage", 0);
    }

    if (node.connman) {
        int total = 0, inbound = 0, outbound = 0;
        node.connman->ForEachNode([&](CNode* pnode) {
            total++;
            if (pnode->IsInboundConn()) inbound++;
            else outbound++;
        });
        obj.pushKV("connections", total);
        obj.pushKV("connections_in", inbound);
        obj.pushKV("connections_out", outbound);
        obj.pushKV("network_active", node.connman->GetNetworkActive());
    } else {
        obj.pushKV("connections", 0);
        obj.pushKV("connections_in", 0);
        obj.pushKV("connections_out", 0);
        obj.pushKV("network_active", false);
    }

    obj.pushKV("uptime", GetTime() - GetStartupTime());

    return obj;
},
    };
}

static RPCHelpMan getmempoolstats()
{
    return RPCHelpMan{"getmempoolstats",
        "\nReturns enhanced mempool analytics including fee distribution.\n",
        {},
        RPCResult{
            RPCResult::Type::OBJ, "", "",
            {
                {RPCResult::Type::NUM, "size", "Number of transactions"},
                {RPCResult::Type::NUM, "bytes", "Total size in bytes"},
                {RPCResult::Type::NUM, "usage", "Memory usage in bytes"},
                {RPCResult::Type::NUM, "total_fee", "Total fees in satoshis"},
                {RPCResult::Type::NUM, "maxmempool", "Maximum mempool size in bytes"},
                {RPCResult::Type::NUM, "mempoolminfee", "Minimum fee rate for mempool entry (sat/vB)"},
                {RPCResult::Type::NUM, "minrelaytxfee", "Minimum relay fee rate (sat/vB)"},
                {RPCResult::Type::NUM, "unbroadcastcount", "Number of unbroadcast transactions"},
            }},
        RPCExamples{
            HelpExampleCli("getmempoolstats", "")
            + HelpExampleRpc("getmempoolstats", "")
        },
        [&](const RPCHelpMan& self, const JSONRPCRequest& request) -> UniValue
{
    NodeContext& node = EnsureAnyNodeContext(request.context);
    CTxMemPool& mempool = EnsureMemPool(node);

    UniValue obj(UniValue::VOBJ);

    {
        LOCK(mempool.cs);
        obj.pushKV("size", (int64_t)mempool.size());
        obj.pushKV("bytes", (int64_t)mempool.GetTotalTxSize());
        obj.pushKV("usage", (int64_t)mempool.DynamicMemoryUsage());

        CAmount total_fee{0};
        for (const auto& entry : mempool.mapTx) {
            total_fee += entry.GetFee();
        }
        obj.pushKV("total_fee", total_fee);

        obj.pushKV("maxmempool", (int64_t)mempool.m_opts.max_size_bytes);
        obj.pushKV("mempoolminfee", ValueFromAmount(mempool.GetMinFee().GetFeePerK()));
        obj.pushKV("minrelaytxfee", ValueFromAmount(mempool.m_opts.min_relay_feerate.GetFeePerK()));
        obj.pushKV("unbroadcastcount", (int64_t)mempool.GetUnbroadcastTxs().size());
    }

    return obj;
},
    };
}

static RPCHelpMan getprivacystatus()
{
    return RPCHelpMan{"getprivacystatus",
        "\nReturns the privacy status of your node connections.\n",
        {},
        RPCResult{
            RPCResult::Type::OBJ, "", "",
            {
                {RPCResult::Type::BOOL, "tor_reachable", "Whether Tor connections are possible"},
                {RPCResult::Type::BOOL, "listen", "Whether the node is accepting incoming connections"},
                {RPCResult::Type::BOOL, "network_active", "Whether the network is active"},
                {RPCResult::Type::NUM, "onion_peers", "Number of peers connected via Tor"},
                {RPCResult::Type::NUM, "clearnet_peers", "Number of clearnet (IPv4/IPv6) peers"},
                {RPCResult::Type::NUM, "total_peers", "Total number of connected peers"},
                {RPCResult::Type::BOOL, "blocksonly", "Whether the node is in blocks-only mode"},
            }},
        RPCExamples{
            HelpExampleCli("getprivacystatus", "")
            + HelpExampleRpc("getprivacystatus", "")
        },
        [&](const RPCHelpMan& self, const JSONRPCRequest& request) -> UniValue
{
    NodeContext& node = EnsureAnyNodeContext(request.context);

    UniValue obj(UniValue::VOBJ);

    Proxy onion_proxy;
    bool tor_reachable = GetProxy(NET_ONION, onion_proxy);
    obj.pushKV("tor_reachable", tor_reachable);
    obj.pushKV("listen", node.args ? node.args->GetBoolArg("-listen", true) : false);
    obj.pushKV("network_active", node.connman ? node.connman->GetNetworkActive() : false);

    int onion_peers = 0, clearnet_peers = 0, total = 0;
    if (node.connman) {
        node.connman->ForEachNode([&](CNode* pnode) {
            total++;
            if (pnode->ConnectedThroughNetwork() == NET_ONION) {
                onion_peers++;
            } else {
                clearnet_peers++;
            }
        });
    }

    obj.pushKV("onion_peers", onion_peers);
    obj.pushKV("clearnet_peers", clearnet_peers);
    obj.pushKV("total_peers", total);
    obj.pushKV("blocksonly", node.args ? node.args->GetBoolArg("-blocksonly", false) : false);

    return obj;
},
    };
}

static RPCHelpMan getnodehealth()
{
    return RPCHelpMan{"getnodehealth",
        "\nReturns system resource usage and node health metrics.\n",
        {},
        RPCResult{
            RPCResult::Type::OBJ, "", "",
            {
                {RPCResult::Type::NUM, "uptime", "Node uptime in seconds"},
                {RPCResult::Type::NUM, "bytes_recv", "Total bytes received"},
                {RPCResult::Type::NUM, "bytes_sent", "Total bytes sent"},
                {RPCResult::Type::NUM, "banned_peers", "Number of banned peers"},
                {RPCResult::Type::NUM, "dbcache_mb", "Database cache size in MB"},
                {RPCResult::Type::BOOL, "pruning_enabled", "Whether pruning is enabled"},
            }},
        RPCExamples{
            HelpExampleCli("getnodehealth", "")
            + HelpExampleRpc("getnodehealth", "")
        },
        [&](const RPCHelpMan& self, const JSONRPCRequest& request) -> UniValue
{
    NodeContext& node = EnsureAnyNodeContext(request.context);

    UniValue obj(UniValue::VOBJ);

    obj.pushKV("uptime", GetTime() - GetStartupTime());

    if (node.connman) {
        obj.pushKV("bytes_recv", (int64_t)node.connman->GetTotalBytesRecv());
        obj.pushKV("bytes_sent", (int64_t)node.connman->GetTotalBytesSent());
    } else {
        obj.pushKV("bytes_recv", 0);
        obj.pushKV("bytes_sent", 0);
    }

    if (node.banman) {
        banmap_t banmap;
        node.banman->GetBanned(banmap);
        obj.pushKV("banned_peers", (int64_t)banmap.size());
    } else {
        obj.pushKV("banned_peers", 0);
    }

    obj.pushKV("dbcache_mb", node.args ? node.args->GetIntArg("-dbcache", 450) : 450);

    ChainstateManager& chainman = EnsureAnyChainman(request.context);
    obj.pushKV("pruning_enabled", chainman.m_blockman.IsPruneMode());

    return obj;
},
    };
}

static RPCHelpMan getpolicy()
{
    return RPCHelpMan{"getpolicy",
        "\nReturns the current node policy settings.\n",
        {},
        RPCResult{
            RPCResult::Type::OBJ, "", "",
            {
                {RPCResult::Type::BOOL, "datacarrier", "Whether data carrier (OP_RETURN) relay is enabled"},
                {RPCResult::Type::NUM, "datacarriersize", "Maximum data carrier size in bytes"},
                {RPCResult::Type::NUM, "maxmempool", "Maximum mempool size in MB"},
                {RPCResult::Type::NUM, "mempoolexpiry", "Mempool expiry time in hours"},
                {RPCResult::Type::NUM, "maxconnections", "Maximum number of connections"},
                {RPCResult::Type::BOOL, "blocksonly", "Whether the node is in blocks-only mode"},
                {RPCResult::Type::BOOL, "listen", "Whether the node accepts incoming connections"},
                {RPCResult::Type::NUM, "blockmaxweight", "Maximum block weight for mining"},
                {RPCResult::Type::NUM, "limitancestorcount", "Maximum ancestor count for mempool"},
                {RPCResult::Type::NUM, "limitdescendantcount", "Maximum descendant count for mempool"},
            }},
        RPCExamples{
            HelpExampleCli("getpolicy", "")
            + HelpExampleRpc("getpolicy", "")
        },
        [&](const RPCHelpMan& self, const JSONRPCRequest& request) -> UniValue
{
    NodeContext& node = EnsureAnyNodeContext(request.context);
    const ArgsManager& args = *Assert(node.args);

    UniValue obj(UniValue::VOBJ);

    obj.pushKV("datacarrier", args.GetBoolArg("-datacarrier", true));
    obj.pushKV("datacarriersize", args.GetIntArg("-datacarriersize", MAX_OP_RETURN_RELAY));
    obj.pushKV("maxmempool", args.GetIntArg("-maxmempool", 300));
    obj.pushKV("mempoolexpiry", args.GetIntArg("-mempoolexpiry", 336));
    obj.pushKV("maxconnections", args.GetIntArg("-maxconnections", 125));
    obj.pushKV("blocksonly", args.GetBoolArg("-blocksonly", false));
    obj.pushKV("listen", args.GetBoolArg("-listen", true));
    obj.pushKV("blockmaxweight", args.GetIntArg("-blockmaxweight", DEFAULT_BLOCK_MAX_WEIGHT));
    obj.pushKV("limitancestorcount", args.GetIntArg("-limitancestorcount", DEFAULT_ANCESTOR_LIMIT));
    obj.pushKV("limitdescendantcount", args.GetIntArg("-limitdescendantcount", DEFAULT_DESCENDANT_LIMIT));

    return obj;
},
    };
}

void RegisterPrometheusRPCCommands(CRPCTable& t)
{
    static const CRPCCommand commands[]{
        {"prometheus", &getprometheusinfo},
        {"prometheus", &getmempoolstats},
        {"prometheus", &getprivacystatus},
        {"prometheus", &getnodehealth},
        {"prometheus", &getpolicy},
    };
    for (const auto& c : commands) {
        t.appendCommand(c.name, &c);
    }
}
