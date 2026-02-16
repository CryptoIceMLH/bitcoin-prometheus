// Copyright (c) 2026 The BTC-Prometheus developers
// Distributed under the MIT software license, see the accompanying
// file COPYING or https://opensource.org/license/mit/.

#ifndef BITCOIN_QT_DASHBOARDPAGE_H
#define BITCOIN_QT_DASHBOARDPAGE_H

#include <qt/clientmodel.h>

#include <QWidget>
#include <QTimer>

class PlatformStyle;

QT_BEGIN_NAMESPACE
class QLabel;
class QProgressBar;
class QGroupBox;
class QVBoxLayout;
QT_END_NAMESPACE

class DashboardPage : public QWidget
{
    Q_OBJECT

public:
    explicit DashboardPage(const PlatformStyle* platformStyle, QWidget* parent = nullptr);
    ~DashboardPage();

    void setClientModel(ClientModel* clientModel);

private:
    void setupUI();
    QGroupBox* createNodeHealthGroup();
    QGroupBox* createMempoolGroup();
    QGroupBox* createNetworkGroup();
    QGroupBox* createChainStatsGroup();
    void applyDarkStyle(QWidget* widget);

    ClientModel* m_client_model{nullptr};
    const PlatformStyle* m_platform_style;
    QTimer* m_refresh_timer{nullptr};

    // Node Health widgets
    QLabel* m_sync_progress_label{nullptr};
    QProgressBar* m_sync_progress_bar{nullptr};
    QLabel* m_peer_count_label{nullptr};
    QLabel* m_bandwidth_in_label{nullptr};
    QLabel* m_bandwidth_out_label{nullptr};
    QLabel* m_uptime_label{nullptr};
    QLabel* m_network_active_label{nullptr};

    // Mempool widgets
    QLabel* m_mempool_tx_count_label{nullptr};
    QLabel* m_mempool_size_label{nullptr};
    QLabel* m_mempool_usage_label{nullptr};
    QLabel* m_mempool_max_label{nullptr};
    QProgressBar* m_mempool_usage_bar{nullptr};

    // Network widgets
    QLabel* m_inbound_peers_label{nullptr};
    QLabel* m_outbound_peers_label{nullptr};
    QLabel* m_total_peers_label{nullptr};
    QLabel* m_network_name_label{nullptr};

    // Chain Stats widgets
    QLabel* m_block_height_label{nullptr};
    QLabel* m_difficulty_label{nullptr};
    QLabel* m_last_block_time_label{nullptr};
    QLabel* m_best_block_hash_label{nullptr};
    QLabel* m_chain_name_label{nullptr};
    QLabel* m_verification_progress_label{nullptr};

private Q_SLOTS:
    void refreshDashboard();
    void updateNumBlocks(int count, const QDateTime& blockDate, double nVerificationProgress, SyncType synctype, SynchronizationState sync_state);
    void updateNumConnections(int count);
    void updateMempoolStats(long count, size_t mempoolSizeInBytes, size_t mempoolMaxSizeInBytes);
    void updateBandwidth(quint64 totalBytesIn, quint64 totalBytesOut);
    void updateNetworkActive(bool active);
};

#endif // BITCOIN_QT_DASHBOARDPAGE_H
