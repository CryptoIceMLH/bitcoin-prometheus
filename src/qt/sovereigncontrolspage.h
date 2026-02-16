// Copyright (c) 2026 The BTC-Prometheus developers
// Distributed under the MIT software license, see the accompanying
// file COPYING or https://opensource.org/license/mit/.

#ifndef BITCOIN_QT_SOVEREIGNCONTROLSPAGE_H
#define BITCOIN_QT_SOVEREIGNCONTROLSPAGE_H

#include <QWidget>

class ClientModel;
class OptionsModel;
class PlatformStyle;

QT_BEGIN_NAMESPACE
class QCheckBox;
class QGroupBox;
class QLabel;
class QPushButton;
class QSlider;
class QSpinBox;
class QComboBox;
QT_END_NAMESPACE

class SovereignControlsPage : public QWidget
{
    Q_OBJECT

public:
    explicit SovereignControlsPage(const PlatformStyle* platformStyle, QWidget* parent = nullptr);
    ~SovereignControlsPage();

    void setClientModel(ClientModel* clientModel);
    void setOptionsModel(OptionsModel* optionsModel);

private:
    void setupUI();
    QGroupBox* createDataCarrierGroup();
    QGroupBox* createMempoolGroup();
    QGroupBox* createConnectionGroup();
    QGroupBox* createMiningGroup();
    void loadCurrentSettings();
    void applyDarkStyle(QWidget* widget);

    ClientModel* m_client_model{nullptr};
    OptionsModel* m_options_model{nullptr};
    const PlatformStyle* m_platform_style;

    // Data Carrier / OP_RETURN controls
    QCheckBox* m_datacarrier_toggle{nullptr};
    QSlider* m_datacarrier_size_slider{nullptr};
    QSpinBox* m_datacarrier_size_spin{nullptr};
    QLabel* m_datacarrier_size_label{nullptr};

    // Mempool controls
    QSlider* m_mempool_max_slider{nullptr};
    QSpinBox* m_mempool_max_spin{nullptr};
    QSpinBox* m_min_relay_fee_spin{nullptr};
    QComboBox* m_rbf_policy_combo{nullptr};
    QSpinBox* m_mempool_expiry_spin{nullptr};

    // Connection & Privacy controls
    QSlider* m_max_connections_slider{nullptr};
    QSpinBox* m_max_connections_spin{nullptr};
    QCheckBox* m_tor_toggle{nullptr};
    QCheckBox* m_blocksonly_toggle{nullptr};
    QCheckBox* m_listen_toggle{nullptr};
    QCheckBox* m_upnp_toggle{nullptr};

    // Mining / Relay Policy controls
    QSpinBox* m_block_max_weight_spin{nullptr};
    QSpinBox* m_ancestor_limit_spin{nullptr};
    QSpinBox* m_descendant_limit_spin{nullptr};

private Q_SLOTS:
    void onDataCarrierToggled(bool checked);
    void onDataCarrierSizeChanged(int value);
    void onMempoolMaxChanged(int value);
    void onMaxConnectionsChanged(int value);
    void onResetDefaults();

Q_SIGNALS:
    void message(const QString& title, const QString& message, unsigned int style);
};

#endif // BITCOIN_QT_SOVEREIGNCONTROLSPAGE_H
