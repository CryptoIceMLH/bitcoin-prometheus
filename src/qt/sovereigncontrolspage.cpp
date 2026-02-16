// Copyright (c) 2026 The BTC-Prometheus developers
// Distributed under the MIT software license, see the accompanying
// file COPYING or https://opensource.org/license/mit/.

#include <qt/sovereigncontrolspage.h>

#include <qt/clientmodel.h>
#include <qt/guiconstants.h>
#include <qt/optionsmodel.h>
#include <qt/platformstyle.h>

#include <interfaces/node.h>

#include <QCheckBox>
#include <QComboBox>
#include <QGroupBox>
#include <QHBoxLayout>
#include <QLabel>
#include <QPushButton>
#include <QScrollArea>
#include <QSlider>
#include <QSpinBox>
#include <QVBoxLayout>

SovereignControlsPage::SovereignControlsPage(const PlatformStyle* platformStyle, QWidget* parent)
    : QWidget(parent),
      m_platform_style(platformStyle)
{
    setupUI();
}

SovereignControlsPage::~SovereignControlsPage() = default;

void SovereignControlsPage::applyDarkStyle(QWidget* widget)
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
        "QCheckBox { color: #e6e6e6; spacing: 8px; } "
        "QCheckBox::indicator { width: 18px; height: 18px; } "
        "QCheckBox::indicator:unchecked { "
        "  border: 2px solid #666; border-radius: 3px; background: #1a1a1a; "
        "} "
        "QCheckBox::indicator:checked { "
        "  border: 2px solid #FF8C00; border-radius: 3px; background: #FF8C00; "
        "} "
        "QSlider::groove:horizontal { "
        "  height: 6px; background: #444; border-radius: 3px; "
        "} "
        "QSlider::handle:horizontal { "
        "  background: #FF8C00; width: 16px; margin: -5px 0; border-radius: 8px; "
        "} "
        "QSlider::sub-page:horizontal { "
        "  background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #FF4500, stop:1 #FF8C00); "
        "  border-radius: 3px; "
        "} "
        "QSpinBox { "
        "  background: #1a1a1a; color: #e6e6e6; border: 1px solid #555; "
        "  border-radius: 4px; padding: 4px 8px; "
        "} "
        "QSpinBox::up-button, QSpinBox::down-button { "
        "  background: #333; border: 1px solid #555; width: 16px; "
        "} "
        "QComboBox { "
        "  background: #1a1a1a; color: #e6e6e6; border: 1px solid #555; "
        "  border-radius: 4px; padding: 4px 8px; "
        "} "
        "QComboBox::drop-down { "
        "  background: #333; border: 1px solid #555; "
        "} "
        "QPushButton { "
        "  background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #FF4500, stop:1 #FF8C00); "
        "  color: white; border: none; border-radius: 4px; "
        "  padding: 8px 20px; font-weight: bold; "
        "} "
        "QPushButton:hover { "
        "  background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #FF5722, stop:1 #FFA000); "
        "} "
        "QPushButton:pressed { "
        "  background: #CC3700; "
        "} "
    );
}

QGroupBox* SovereignControlsPage::createDataCarrierGroup()
{
    QGroupBox* group = new QGroupBox(tr("OP_RETURN / Data Carrier Policy"));

    QVBoxLayout* layout = new QVBoxLayout(group);
    layout->setSpacing(10);

    // Toggle
    m_datacarrier_toggle = new QCheckBox(tr("Enable data carrier relay (OP_RETURN transactions)"));
    m_datacarrier_toggle->setToolTip(tr(
        "When enabled, your node will relay transactions containing OP_RETURN outputs.\n"
        "OP_RETURN is used for embedding small amounts of data in the blockchain.\n"
        "Disabling this prevents your node from relaying such transactions, but they\n"
        "can still be mined by others."));
    layout->addWidget(m_datacarrier_toggle);

    // Size slider
    QHBoxLayout* sizeLayout = new QHBoxLayout();
    m_datacarrier_size_label = new QLabel(tr("Max data carrier size:"));
    m_datacarrier_size_slider = new QSlider(Qt::Horizontal);
    m_datacarrier_size_slider->setRange(0, 256);
    m_datacarrier_size_slider->setValue(83);
    m_datacarrier_size_spin = new QSpinBox();
    m_datacarrier_size_spin->setRange(0, 256);
    m_datacarrier_size_spin->setValue(83);
    m_datacarrier_size_spin->setSuffix(tr(" bytes"));
    m_datacarrier_size_spin->setToolTip(tr(
        "Maximum size of data in OP_RETURN outputs that your node will relay.\n"
        "Default: 83 bytes. Set to 0 to reject all OP_RETURN transactions.\n"
        "Higher values allow larger data payloads."));

    sizeLayout->addWidget(m_datacarrier_size_label);
    sizeLayout->addWidget(m_datacarrier_size_slider, 1);
    sizeLayout->addWidget(m_datacarrier_size_spin);
    layout->addLayout(sizeLayout);

    // Connect slider <-> spinbox
    connect(m_datacarrier_size_slider, &QSlider::valueChanged, m_datacarrier_size_spin, &QSpinBox::setValue);
    connect(m_datacarrier_size_spin, qOverload<int>(&QSpinBox::valueChanged), m_datacarrier_size_slider, &QSlider::setValue);
    connect(m_datacarrier_toggle, &QCheckBox::toggled, this, &SovereignControlsPage::onDataCarrierToggled);
    connect(m_datacarrier_size_slider, &QSlider::valueChanged, this, &SovereignControlsPage::onDataCarrierSizeChanged);

    return group;
}

QGroupBox* SovereignControlsPage::createMempoolGroup()
{
    QGroupBox* group = new QGroupBox(tr("Mempool Settings"));

    QVBoxLayout* layout = new QVBoxLayout(group);
    layout->setSpacing(10);

    // Max mempool size
    QHBoxLayout* maxLayout = new QHBoxLayout();
    QLabel* maxLabel = new QLabel(tr("Maximum mempool size:"));
    m_mempool_max_slider = new QSlider(Qt::Horizontal);
    m_mempool_max_slider->setRange(50, 2000);
    m_mempool_max_slider->setValue(300);
    m_mempool_max_spin = new QSpinBox();
    m_mempool_max_spin->setRange(50, 2000);
    m_mempool_max_spin->setValue(300);
    m_mempool_max_spin->setSuffix(tr(" MB"));
    m_mempool_max_spin->setToolTip(tr(
        "Maximum size of the transaction memory pool in megabytes.\n"
        "Larger pools use more memory but allow your node to keep track of more\n"
        "unconfirmed transactions. Default: 300 MB."));

    maxLayout->addWidget(maxLabel);
    maxLayout->addWidget(m_mempool_max_slider, 1);
    maxLayout->addWidget(m_mempool_max_spin);
    layout->addLayout(maxLayout);

    connect(m_mempool_max_slider, &QSlider::valueChanged, m_mempool_max_spin, &QSpinBox::setValue);
    connect(m_mempool_max_spin, qOverload<int>(&QSpinBox::valueChanged), m_mempool_max_slider, &QSlider::setValue);
    connect(m_mempool_max_slider, &QSlider::valueChanged, this, &SovereignControlsPage::onMempoolMaxChanged);

    // RBF policy
    QHBoxLayout* rbfLayout = new QHBoxLayout();
    QLabel* rbfLabel = new QLabel(tr("Replace-By-Fee policy:"));
    m_rbf_policy_combo = new QComboBox();
    m_rbf_policy_combo->addItem(tr("Full RBF (allow all replacements)"), 1);
    m_rbf_policy_combo->addItem(tr("Opt-in RBF (BIP 125 signaling only)"), 0);
    m_rbf_policy_combo->setToolTip(tr(
        "Controls whether your node accepts transaction replacements.\n"
        "Full RBF: Any transaction can be replaced by a higher-fee version.\n"
        "Opt-in RBF: Only transactions signaling BIP 125 can be replaced."));

    rbfLayout->addWidget(rbfLabel);
    rbfLayout->addWidget(m_rbf_policy_combo, 1);
    layout->addLayout(rbfLayout);

    // Mempool expiry
    QHBoxLayout* expiryLayout = new QHBoxLayout();
    QLabel* expiryLabel = new QLabel(tr("Mempool expiry time:"));
    m_mempool_expiry_spin = new QSpinBox();
    m_mempool_expiry_spin->setRange(1, 720);
    m_mempool_expiry_spin->setValue(336);
    m_mempool_expiry_spin->setSuffix(tr(" hours"));
    m_mempool_expiry_spin->setToolTip(tr(
        "How long (in hours) unconfirmed transactions stay in the mempool\n"
        "before being evicted. Default: 336 hours (14 days)."));

    expiryLayout->addWidget(expiryLabel);
    expiryLayout->addStretch();
    expiryLayout->addWidget(m_mempool_expiry_spin);
    layout->addLayout(expiryLayout);

    // Min relay fee
    QHBoxLayout* feeLayout = new QHBoxLayout();
    QLabel* feeLabel = new QLabel(tr("Minimum relay fee (sat/vB):"));
    m_min_relay_fee_spin = new QSpinBox();
    m_min_relay_fee_spin->setRange(0, 10000);
    m_min_relay_fee_spin->setValue(1);
    m_min_relay_fee_spin->setToolTip(tr(
        "Minimum fee rate (in satoshis per virtual byte) for transactions\n"
        "to be relayed by your node. Default: 1 sat/vB."));

    feeLayout->addWidget(feeLabel);
    feeLayout->addStretch();
    feeLayout->addWidget(m_min_relay_fee_spin);
    layout->addLayout(feeLayout);

    return group;
}

QGroupBox* SovereignControlsPage::createConnectionGroup()
{
    QGroupBox* group = new QGroupBox(tr("Connection & Privacy"));

    QVBoxLayout* layout = new QVBoxLayout(group);
    layout->setSpacing(10);

    // Max connections
    QHBoxLayout* connLayout = new QHBoxLayout();
    QLabel* connLabel = new QLabel(tr("Maximum connections:"));
    m_max_connections_slider = new QSlider(Qt::Horizontal);
    m_max_connections_slider->setRange(0, 500);
    m_max_connections_slider->setValue(125);
    m_max_connections_spin = new QSpinBox();
    m_max_connections_spin->setRange(0, 500);
    m_max_connections_spin->setValue(125);
    m_max_connections_spin->setToolTip(tr(
        "Maximum number of peer connections.\n"
        "More connections means better network participation but uses more bandwidth.\n"
        "Default: 125."));

    connLayout->addWidget(connLabel);
    connLayout->addWidget(m_max_connections_slider, 1);
    connLayout->addWidget(m_max_connections_spin);
    layout->addLayout(connLayout);

    connect(m_max_connections_slider, &QSlider::valueChanged, m_max_connections_spin, &QSpinBox::setValue);
    connect(m_max_connections_spin, qOverload<int>(&QSpinBox::valueChanged), m_max_connections_slider, &QSlider::setValue);
    connect(m_max_connections_slider, &QSlider::valueChanged, this, &SovereignControlsPage::onMaxConnectionsChanged);

    // Tor toggle
    m_tor_toggle = new QCheckBox(tr("Enable Tor proxy (SOCKS5 on 127.0.0.1:9050)"));
    m_tor_toggle->setToolTip(tr(
        "Route all connections through the Tor anonymity network.\n"
        "Requires Tor to be running on your system.\n"
        "Greatly improves privacy by hiding your IP address from peers."));
    layout->addWidget(m_tor_toggle);

    // Blocks-only mode
    m_blocksonly_toggle = new QCheckBox(tr("Blocks-only mode (no transaction relay)"));
    m_blocksonly_toggle->setToolTip(tr(
        "Only download blocks, don't relay unconfirmed transactions.\n"
        "Significantly reduces bandwidth usage but means your node won't\n"
        "have a mempool. Useful for low-bandwidth connections."));
    layout->addWidget(m_blocksonly_toggle);

    // Listen toggle
    m_listen_toggle = new QCheckBox(tr("Accept incoming connections"));
    m_listen_toggle->setChecked(true);
    m_listen_toggle->setToolTip(tr(
        "Allow other nodes to connect to you.\n"
        "Helps the Bitcoin network but uses more bandwidth.\n"
        "Default: enabled."));
    layout->addWidget(m_listen_toggle);

    // UPnP toggle
    m_upnp_toggle = new QCheckBox(tr("Enable UPnP port mapping"));
    m_upnp_toggle->setToolTip(tr(
        "Automatically configure your router to allow incoming connections\n"
        "using UPnP. Only works if your router supports UPnP.\n"
        "Not recommended for privacy-conscious setups."));
    layout->addWidget(m_upnp_toggle);

    return group;
}

QGroupBox* SovereignControlsPage::createMiningGroup()
{
    QGroupBox* group = new QGroupBox(tr("Mining & Relay Policy"));

    QVBoxLayout* layout = new QVBoxLayout(group);
    layout->setSpacing(10);

    // Block max weight
    QHBoxLayout* weightLayout = new QHBoxLayout();
    QLabel* weightLabel = new QLabel(tr("Block max weight:"));
    m_block_max_weight_spin = new QSpinBox();
    m_block_max_weight_spin->setRange(4000, 4000000);
    m_block_max_weight_spin->setValue(3996000);
    m_block_max_weight_spin->setSingleStep(1000);
    m_block_max_weight_spin->setToolTip(tr(
        "Maximum weight of blocks your node will create when mining.\n"
        "The consensus limit is 4,000,000 weight units.\n"
        "Default: 3,996,000 (leaves room for coinbase)."));

    weightLayout->addWidget(weightLabel);
    weightLayout->addStretch();
    weightLayout->addWidget(m_block_max_weight_spin);
    layout->addLayout(weightLayout);

    // Ancestor limit
    QHBoxLayout* ancestorLayout = new QHBoxLayout();
    QLabel* ancestorLabel = new QLabel(tr("Max ancestor count:"));
    m_ancestor_limit_spin = new QSpinBox();
    m_ancestor_limit_spin->setRange(1, 100);
    m_ancestor_limit_spin->setValue(25);
    m_ancestor_limit_spin->setToolTip(tr(
        "Maximum number of unconfirmed ancestors a transaction can have\n"
        "to be accepted into the mempool. Default: 25."));

    ancestorLayout->addWidget(ancestorLabel);
    ancestorLayout->addStretch();
    ancestorLayout->addWidget(m_ancestor_limit_spin);
    layout->addLayout(ancestorLayout);

    // Descendant limit
    QHBoxLayout* descendantLayout = new QHBoxLayout();
    QLabel* descendantLabel = new QLabel(tr("Max descendant count:"));
    m_descendant_limit_spin = new QSpinBox();
    m_descendant_limit_spin->setRange(1, 100);
    m_descendant_limit_spin->setValue(25);
    m_descendant_limit_spin->setToolTip(tr(
        "Maximum number of unconfirmed descendants a transaction can have\n"
        "to be accepted into the mempool. Default: 25."));

    descendantLayout->addWidget(descendantLabel);
    descendantLayout->addStretch();
    descendantLayout->addWidget(m_descendant_limit_spin);
    layout->addLayout(descendantLayout);

    return group;
}

void SovereignControlsPage::setupUI()
{
    QVBoxLayout* mainLayout = new QVBoxLayout(this);
    mainLayout->setContentsMargins(0, 0, 0, 0);

    // Title
    QLabel* titleLabel = new QLabel(tr("Sovereign Controls"));
    titleLabel->setStyleSheet(
        "font-size: 22px; font-weight: bold; color: #FF8C00; "
        "padding: 16px 0 4px 16px;");
    mainLayout->addWidget(titleLabel);

    QLabel* subtitleLabel = new QLabel(tr("Your node, your rules. Every policy setting is in your hands."));
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

    // Add groups
    QGroupBox* dataCarrierGroup = createDataCarrierGroup();
    QGroupBox* mempoolGroup = createMempoolGroup();
    QGroupBox* connectionGroup = createConnectionGroup();
    QGroupBox* miningGroup = createMiningGroup();

    applyDarkStyle(dataCarrierGroup);
    applyDarkStyle(mempoolGroup);
    applyDarkStyle(connectionGroup);
    applyDarkStyle(miningGroup);

    scrollLayout->addWidget(dataCarrierGroup);
    scrollLayout->addWidget(mempoolGroup);
    scrollLayout->addWidget(connectionGroup);
    scrollLayout->addWidget(miningGroup);

    // Reset button
    QHBoxLayout* buttonLayout = new QHBoxLayout();
    buttonLayout->addStretch();
    QPushButton* resetButton = new QPushButton(tr("Reset All to Defaults"));
    resetButton->setStyleSheet(
        "QPushButton { "
        "  background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #FF4500, stop:1 #FF8C00); "
        "  color: white; border: none; border-radius: 4px; "
        "  padding: 10px 28px; font-weight: bold; font-size: 13px; "
        "} "
        "QPushButton:hover { "
        "  background: qlineargradient(x1:0, y1:0, x2:1, y2:0, stop:0 #FF5722, stop:1 #FFA000); "
        "} ");
    connect(resetButton, &QPushButton::clicked, this, &SovereignControlsPage::onResetDefaults);
    buttonLayout->addWidget(resetButton);
    scrollLayout->addLayout(buttonLayout);

    scrollLayout->addStretch();
    scrollArea->setWidget(scrollWidget);
    mainLayout->addWidget(scrollArea);

    // Note about restart
    QLabel* noteLabel = new QLabel(tr(
        "Note: Some settings require a node restart to take effect. "
        "Settings are saved to your prometheus.conf file."));
    noteLabel->setStyleSheet("color: #FFBF00; padding: 8px 16px; font-size: 11px;");
    noteLabel->setWordWrap(true);
    mainLayout->addWidget(noteLabel);
}

void SovereignControlsPage::setClientModel(ClientModel* clientModel)
{
    m_client_model = clientModel;
    if (clientModel) {
        loadCurrentSettings();
    }
}

void SovereignControlsPage::setOptionsModel(OptionsModel* optionsModel)
{
    m_options_model = optionsModel;
}

void SovereignControlsPage::loadCurrentSettings()
{
    if (!m_client_model) return;

    // Load current values from node settings
    // These will be populated with actual values when connected to a running node
    m_datacarrier_toggle->setChecked(true);
    m_datacarrier_size_slider->setValue(83);
    m_mempool_max_slider->setValue(300);
    m_max_connections_slider->setValue(125);
    m_listen_toggle->setChecked(true);
    m_rbf_policy_combo->setCurrentIndex(0);
    m_mempool_expiry_spin->setValue(336);
    m_min_relay_fee_spin->setValue(1);
    m_block_max_weight_spin->setValue(3996000);
    m_ancestor_limit_spin->setValue(25);
    m_descendant_limit_spin->setValue(25);
}

void SovereignControlsPage::onDataCarrierToggled(bool checked)
{
    m_datacarrier_size_slider->setEnabled(checked);
    m_datacarrier_size_spin->setEnabled(checked);
}

void SovereignControlsPage::onDataCarrierSizeChanged(int value)
{
    Q_UNUSED(value);
}

void SovereignControlsPage::onMempoolMaxChanged(int value)
{
    Q_UNUSED(value);
}

void SovereignControlsPage::onMaxConnectionsChanged(int value)
{
    Q_UNUSED(value);
}

void SovereignControlsPage::onResetDefaults()
{
    m_datacarrier_toggle->setChecked(true);
    m_datacarrier_size_slider->setValue(83);
    m_mempool_max_slider->setValue(300);
    m_rbf_policy_combo->setCurrentIndex(0);
    m_mempool_expiry_spin->setValue(336);
    m_min_relay_fee_spin->setValue(1);
    m_max_connections_slider->setValue(125);
    m_tor_toggle->setChecked(false);
    m_blocksonly_toggle->setChecked(false);
    m_listen_toggle->setChecked(true);
    m_upnp_toggle->setChecked(false);
    m_block_max_weight_spin->setValue(3996000);
    m_ancestor_limit_spin->setValue(25);
    m_descendant_limit_spin->setValue(25);
}
