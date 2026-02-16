// Copyright (c) 2026 The BTC-Prometheus developers
// Distributed under the MIT software license, see the accompanying
// file COPYING or https://opensource.org/license/mit/.

#include <qt/dashboardpage.h>

#include <qt/clientmodel.h>
#include <qt/guiconstants.h>
#include <qt/guiutil.h>
#include <qt/platformstyle.h>

#include <interfaces/node.h>

#include <QDateTime>
#include <QGroupBox>
#include <QHBoxLayout>
#include <QLabel>
#include <QProgressBar>
#include <QScrollArea>
#include <QVBoxLayout>

DashboardPage::DashboardPage(const PlatformStyle* platformStyle, QWidget* parent)
    : QWidget(parent),
      m_platform_style(platformStyle)
{
    setupUI();

    m_refresh_timer = new QTimer(this);
    connect(m_refresh_timer, &QTimer::timeout, this, &DashboardPage::refreshDashboard);
    m_refresh_timer->start(5000); // Refresh every 5 seconds
}

DashboardPage::~DashboardPage() = default;

void DashboardPage::applyDarkStyle(QWidget* widget)
{
    widget->setStyleSheet(
        "QGroupBox { "
        "  background-color: #262626; "
        "  border: 1px solid #444; "
        "  border-radius: 6px; "
        "  margin-top: 14px; "
        "  padding: 16px 12px 12px 12px; "
        "  color: #e6e6e6; "
        "  font-weight: bold; "
        "} "
        "QGroupBox::title { "
        "  subcontrol-origin: margin; "
        "  left: 12px; "
        "  padding: 0 6px; "
        "  color: #FF8C00; "
        "  font-size: 13px; "
        "} "
        "QLabel { color: #e6e6e6; } "
        "QProgressBar { "
        "  background-color: #1a1a1a; "
        "  border: 1px solid #555; "
        "  border-radius: 6px; "
        "  text-align: center; "
        "  color: #e6e6e6; "
        "  height: 20px; "
        "} "
        "QProgressBar::chunk { "
        "  background: qlineargradient(x1:0, y1:0, x2:1, y2:0, "
        "    stop:0 #FF4500, stop:0.5 #FF8C00, stop:1 #FFBF00); "
        "  border-radius: 6px; "
        "} "
    );
}

static QLabel* createValueLabel(const QString& text)
{
    QLabel* label = new QLabel(text);
    label->setStyleSheet("color: #FFBF00; font-size: 14px; font-weight: bold;");
    return label;
}

static QLabel* createKeyLabel(const QString& text)
{
    QLabel* label = new QLabel(text);
    label->setStyleSheet("color: #a0a0a0; font-size: 12px;");
    return label;
}

static QHBoxLayout* createStatRow(const QString& key, QLabel*& valueLabel, const QString& defaultValue = "---")
{
    QHBoxLayout* row = new QHBoxLayout();
    row->addWidget(createKeyLabel(key));
    row->addStretch();
    valueLabel = createValueLabel(defaultValue);
    row->addWidget(valueLabel);
    return row;
}

QGroupBox* DashboardPage::createNodeHealthGroup()
{
    QGroupBox* group = new QGroupBox(tr("Node Health"));

    QVBoxLayout* layout = new QVBoxLayout(group);
    layout->setSpacing(8);

    // Sync progress bar
    QLabel* syncLabel = createKeyLabel(tr("Synchronization:"));
    layout->addWidget(syncLabel);

    m_sync_progress_bar = new QProgressBar();
    m_sync_progress_bar->setRange(0, 10000);
    m_sync_progress_bar->setValue(0);
    m_sync_progress_bar->setFormat("%p%");
    layout->addWidget(m_sync_progress_bar);

    m_sync_progress_label = createValueLabel("0.00%");
    m_sync_progress_label->setAlignment(Qt::AlignRight);
    layout->addWidget(m_sync_progress_label);

    layout->addLayout(createStatRow(tr("Connected Peers:"), m_peer_count_label, "0"));
    layout->addLayout(createStatRow(tr("Network:"), m_network_active_label, "---"));
    layout->addLayout(createStatRow(tr("Bandwidth In:"), m_bandwidth_in_label, "0 B"));
    layout->addLayout(createStatRow(tr("Bandwidth Out:"), m_bandwidth_out_label, "0 B"));
    layout->addLayout(createStatRow(tr("Uptime:"), m_uptime_label, "---"));

    return group;
}

QGroupBox* DashboardPage::createMempoolGroup()
{
    QGroupBox* group = new QGroupBox(tr("Mempool"));

    QVBoxLayout* layout = new QVBoxLayout(group);
    layout->setSpacing(8);

    layout->addLayout(createStatRow(tr("Transactions:"), m_mempool_tx_count_label, "0"));
    layout->addLayout(createStatRow(tr("Size:"), m_mempool_size_label, "0 B"));
    layout->addLayout(createStatRow(tr("Memory Usage:"), m_mempool_usage_label, "0 B"));
    layout->addLayout(createStatRow(tr("Max Size:"), m_mempool_max_label, "---"));

    QLabel* usageBarLabel = createKeyLabel(tr("Capacity:"));
    layout->addWidget(usageBarLabel);

    m_mempool_usage_bar = new QProgressBar();
    m_mempool_usage_bar->setRange(0, 100);
    m_mempool_usage_bar->setValue(0);
    m_mempool_usage_bar->setFormat("%p%");
    layout->addWidget(m_mempool_usage_bar);

    return group;
}

QGroupBox* DashboardPage::createNetworkGroup()
{
    QGroupBox* group = new QGroupBox(tr("Network"));

    QVBoxLayout* layout = new QVBoxLayout(group);
    layout->setSpacing(8);

    layout->addLayout(createStatRow(tr("Total Peers:"), m_total_peers_label, "0"));
    layout->addLayout(createStatRow(tr("Inbound:"), m_inbound_peers_label, "0"));
    layout->addLayout(createStatRow(tr("Outbound:"), m_outbound_peers_label, "0"));
    layout->addLayout(createStatRow(tr("Chain:"), m_network_name_label, "---"));

    return group;
}

QGroupBox* DashboardPage::createChainStatsGroup()
{
    QGroupBox* group = new QGroupBox(tr("Chain Statistics"));

    QVBoxLayout* layout = new QVBoxLayout(group);
    layout->setSpacing(8);

    layout->addLayout(createStatRow(tr("Block Height:"), m_block_height_label, "0"));
    layout->addLayout(createStatRow(tr("Difficulty:"), m_difficulty_label, "---"));
    layout->addLayout(createStatRow(tr("Last Block:"), m_last_block_time_label, "---"));
    layout->addLayout(createStatRow(tr("Verification:"), m_verification_progress_label, "0.00%"));
    layout->addLayout(createStatRow(tr("Best Block:"), m_best_block_hash_label, "---"));

    m_best_block_hash_label->setStyleSheet(
        "color: #FFBF00; font-size: 10px; font-weight: bold;");

    return group;
}

void DashboardPage::setupUI()
{
    QVBoxLayout* mainLayout = new QVBoxLayout(this);
    mainLayout->setContentsMargins(0, 0, 0, 0);

    // Title
    QLabel* titleLabel = new QLabel(tr("Dashboard"));
    titleLabel->setStyleSheet(
        "font-size: 22px; font-weight: bold; color: #FF8C00; "
        "padding: 16px 0 4px 16px;");
    mainLayout->addWidget(titleLabel);

    QLabel* subtitleLabel = new QLabel(tr("Real-time node monitoring and statistics."));
    subtitleLabel->setStyleSheet(
        "font-size: 12px; color: #a0a0a0; padding: 0 0 8px 16px;");
    mainLayout->addWidget(subtitleLabel);

    // Scrollable content
    QScrollArea* scrollArea = new QScrollArea();
    scrollArea->setWidgetResizable(true);
    scrollArea->setFrameShape(QFrame::NoFrame);
    scrollArea->setStyleSheet("QScrollArea { background: transparent; border: none; }");

    QWidget* scrollWidget = new QWidget();
    QVBoxLayout* scrollLayout = new QVBoxLayout(scrollWidget);
    scrollLayout->setSpacing(16);
    scrollLayout->setContentsMargins(16, 8, 16, 16);

    // Two-column layout for groups
    QHBoxLayout* topRow = new QHBoxLayout();
    QGroupBox* nodeHealthGroup = createNodeHealthGroup();
    QGroupBox* mempoolGroup = createMempoolGroup();
    applyDarkStyle(nodeHealthGroup);
    applyDarkStyle(mempoolGroup);
    topRow->addWidget(nodeHealthGroup);
    topRow->addWidget(mempoolGroup);
    scrollLayout->addLayout(topRow);

    QHBoxLayout* bottomRow = new QHBoxLayout();
    QGroupBox* networkGroup = createNetworkGroup();
    QGroupBox* chainStatsGroup = createChainStatsGroup();
    applyDarkStyle(networkGroup);
    applyDarkStyle(chainStatsGroup);
    bottomRow->addWidget(networkGroup);
    bottomRow->addWidget(chainStatsGroup);
    scrollLayout->addLayout(bottomRow);

    scrollLayout->addStretch();
    scrollArea->setWidget(scrollWidget);
    mainLayout->addWidget(scrollArea);
}

static QString formatBytes(quint64 bytes)
{
    if (bytes < 1024) return QString("%1 B").arg(bytes);
    if (bytes < 1024 * 1024) return QString("%1 KB").arg(bytes / 1024.0, 0, 'f', 1);
    if (bytes < 1024 * 1024 * 1024) return QString("%1 MB").arg(bytes / (1024.0 * 1024.0), 0, 'f', 2);
    return QString("%1 GB").arg(bytes / (1024.0 * 1024.0 * 1024.0), 0, 'f', 2);
}

void DashboardPage::setClientModel(ClientModel* clientModel)
{
    m_client_model = clientModel;

    if (clientModel) {
        connect(clientModel, &ClientModel::numBlocksChanged,
                this, &DashboardPage::updateNumBlocks);
        connect(clientModel, &ClientModel::numConnectionsChanged,
                this, &DashboardPage::updateNumConnections);
        connect(clientModel, &ClientModel::mempoolSizeChanged,
                this, &DashboardPage::updateMempoolStats);
        connect(clientModel, &ClientModel::bytesChanged,
                this, &DashboardPage::updateBandwidth);
        connect(clientModel, &ClientModel::networkActiveChanged,
                this, &DashboardPage::updateNetworkActive);

        // Initial update
        refreshDashboard();
    }
}

void DashboardPage::refreshDashboard()
{
    if (!m_client_model) return;

    interfaces::Node& node = m_client_model->node();

    // Update peer counts
    int totalPeers = m_client_model->getNumConnections();
    m_total_peers_label->setText(QString::number(totalPeers));
    m_peer_count_label->setText(QString::number(totalPeers));

    // Update mempool
    size_t mempoolSize = node.getMempoolSize();
    size_t mempoolUsage = node.getMempoolDynamicUsage();
    size_t mempoolMax = node.getMempoolMaxUsage();

    m_mempool_tx_count_label->setText(QString::number(mempoolSize));
    m_mempool_usage_label->setText(formatBytes(mempoolUsage));
    m_mempool_max_label->setText(formatBytes(mempoolMax));

    if (mempoolMax > 0) {
        int pct = static_cast<int>((mempoolUsage * 100) / mempoolMax);
        m_mempool_usage_bar->setValue(pct);
    }

    // Update block info
    int numBlocks = m_client_model->getNumBlocks();
    m_block_height_label->setText(QString::number(numBlocks));

    // Update network state
    bool networkActive = node.getNetworkActive();
    m_network_active_label->setText(networkActive ? tr("Active") : tr("Inactive"));
    m_network_active_label->setStyleSheet(
        networkActive ? "color: #00FF00; font-size: 14px; font-weight: bold;"
                      : "color: #FF4500; font-size: 14px; font-weight: bold;");
}

void DashboardPage::updateNumBlocks(int count, const QDateTime& blockDate,
                                     double nVerificationProgress, SyncType /*synctype*/,
                                     SynchronizationState /*sync_state*/)
{
    m_block_height_label->setText(QString::number(count));
    m_last_block_time_label->setText(blockDate.toString("yyyy-MM-dd hh:mm:ss"));

    double pct = nVerificationProgress * 100.0;
    m_sync_progress_label->setText(QString("%1%").arg(pct, 0, 'f', 2));
    m_sync_progress_bar->setValue(static_cast<int>(nVerificationProgress * 10000));
    m_verification_progress_label->setText(QString("%1%").arg(pct, 0, 'f', 2));
}

void DashboardPage::updateNumConnections(int count)
{
    m_peer_count_label->setText(QString::number(count));
    m_total_peers_label->setText(QString::number(count));
}

void DashboardPage::updateMempoolStats(long count, size_t mempoolSizeInBytes,
                                        size_t mempoolMaxSizeInBytes)
{
    m_mempool_tx_count_label->setText(QString::number(count));
    m_mempool_size_label->setText(formatBytes(mempoolSizeInBytes));

    if (mempoolMaxSizeInBytes > 0) {
        int pct = static_cast<int>((mempoolSizeInBytes * 100) / mempoolMaxSizeInBytes);
        m_mempool_usage_bar->setValue(pct);
    }
}

void DashboardPage::updateBandwidth(quint64 totalBytesIn, quint64 totalBytesOut)
{
    m_bandwidth_in_label->setText(formatBytes(totalBytesIn));
    m_bandwidth_out_label->setText(formatBytes(totalBytesOut));
}

void DashboardPage::updateNetworkActive(bool active)
{
    m_network_active_label->setText(active ? tr("Active") : tr("Inactive"));
    m_network_active_label->setStyleSheet(
        active ? "color: #00FF00; font-size: 14px; font-weight: bold;"
               : "color: #FF4500; font-size: 14px; font-weight: bold;");
}
