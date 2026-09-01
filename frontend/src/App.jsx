import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import CommandPalette from './components/CommandPalette';
import ToastContainer from './components/Toast';
import UploadRunView from './views/UploadRunView';
import DataSourcesView from './views/DataSourcesView';
import NodalFlowView from './views/NodalFlowView';
import TransactionsView from './views/TransactionsView';
import AnalyticsView from './views/AnalyticsView';
import DiscrepanciesView from './views/DiscrepanciesView';
import ExceptionsView from './views/ExceptionsView';
import RulesEngineView from './views/RulesEngineView';
import ThresholdPlaygroundView from './views/ThresholdPlaygroundView';
import ScenariosView from './views/ScenariosView';
import AgentsTraceView from './views/AgentsTraceView';
import AssistantChatView from './views/AssistantChatView';
import ReportView from './views/ReportView';
import AuditTrailView from './views/AuditTrailView';
import ErpVouchersView from './views/ErpVouchersView';
import BankDisputesView from './views/BankDisputesView';
import { api } from './api';

export default function App() {
  const [currentView, setView] = useState('transactions');
  const [runId, setRunId] = useState('demo-run-001');
  const [status, setStatus] = useState(null);
  const [summary, setSummary] = useState(null);
  const [selectedTxnId, setSelectedTxnId] = useState(null);
  const [isRecomputing, setIsRecomputing] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    loadRunData(runId);
    const interval = setInterval(() => {
      if (status?.status === 'running') {
        loadRunData(runId);
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [runId, status?.status]);

  const loadRunData = async (id) => {
    try {
      const s = await api.getStatus(id);
      setStatus(s);
      if (s.status === 'completed' || s.status === 'idle') {
        const sum = await api.getSummary(id);
        setSummary(sum);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const addToast = (toast) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  const dismissToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleRunComplete = (newRunId) => {
    setRunId(newRunId);
    loadRunData(newRunId);
    setView('transactions');
    addToast({ title: 'Reconciliation Complete', message: `Batch ${newRunId} reconciled and attested with SHA-256 Merkle root.` });
  };

  const handleApplyScenario = async (newThreshold) => {
    setIsRecomputing(true);
    try {
      const newSummary = await api.recomputeThreshold(runId, newThreshold);
      setSummary(newSummary);
      addToast({
        title: 'Sensitivity Model Applied',
        message: `Updated acceptance threshold to λ=${newThreshold}. Auto-approval rate: ${((newSummary.auto_approved_count / newSummary.total_bank_records) * 100).toFixed(1)}%`
      });
    } catch (e) {
      console.error(e);
      addToast({ type: 'error', title: 'Scenario Application Failed', message: e.message });
    } finally {
      setIsRecomputing(false);
    }
  };

  const handleNewBatch = async () => {
    try {
      const uploadRes = await api.uploadOrGenerate({ generateSynthetic: true, recordsCount: 80, seed: Date.now() % 1000 });
      const newRunId = uploadRes.run_id;
      setRunId(newRunId);
      await api.startRun(newRunId, 0.75);
      setStatus({ status: 'running', processed_records: 0, total_records: 80 });
      setView('transactions');
      addToast({ title: 'Autonomous Engine Triggered', message: `Initiated deterministic and multi-agent reconciliation for ${newRunId}` });
    } catch (e) {
      console.error(e);
      addToast({ type: 'error', title: 'Batch Run Failed', message: e.message });
    }
  };

  const handleExportReport = async () => {
    try {
      const blob = await api.getStatutoryDossier(runId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ReconX_Statutory_Dossier_${runId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      addToast({ title: 'Dossier Downloaded', message: `Exported statutory audit dossier for ${runId}` });
    } catch (e) {
      console.error(e);
      addToast({ type: 'error', title: 'Export Failed', message: e.message });
    }
  };

  return (
    <div className="app-container">
      <Sidebar currentView={currentView} setView={setView} summary={summary} />

      <div className="main-content">
        <Header
          runId={runId}
          status={status}
          summary={summary}
          onRunNewBatch={handleNewBatch}
          isRecomputing={isRecomputing}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onExportReport={handleExportReport}
        />

        <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
          {currentView === 'upload' && (
            <UploadRunView runId={runId} status={status} summary={summary} onRunComplete={handleRunComplete} setView={setView} />
          )}
          {currentView === 'sources' && (
            <DataSourcesView runId={runId} />
          )}
          {currentView === 'nodal' && (
            <NodalFlowView runId={runId} setView={setView} setSelectedTxnId={setSelectedTxnId} />
          )}
          {(currentView === 'transactions' || currentView === 'confidence') && (
            <TransactionsView
              runId={runId}
              onSelectTxnForTrace={(txnId) => { setSelectedTxnId(txnId); setView('agents'); }}
              onNavigateTab={(tab) => setView(tab)}
              onToast={addToast}
            />
          )}
          {currentView === 'scenarios' && (
            <ScenariosView runId={runId} onApplyScenario={handleApplyScenario} />
          )}
          {currentView === 'analytics' && (
            <AnalyticsView runId={runId} setView={setView} setSelectedTxnId={setSelectedTxnId} />
          )}
          {currentView === 'erp-vouchers' && (
            <ErpVouchersView runId={runId} onToast={addToast} />
          )}
          {currentView === 'bank-disputes' && (
            <BankDisputesView runId={runId} onToast={addToast} />
          )}
          {currentView === 'discrepancies' && (
            <DiscrepanciesView runId={runId} setSelectedTxnId={setSelectedTxnId} setView={setView} />
          )}
          {currentView === 'exceptions' && (
            <ExceptionsView runId={runId} setSelectedTxnId={setSelectedTxnId} setView={setView} />
          )}
          {currentView === 'rules' && (
            <RulesEngineView runId={runId} />
          )}
          {currentView === 'playground' && (
            <ThresholdPlaygroundView runId={runId} summary={summary} onThresholdChange={setSummary} />
          )}
          {currentView === 'agents' && (
            <AgentsTraceView runId={runId} selectedTxnId={selectedTxnId} />
          )}
          {currentView === 'assistant' && (
            <AssistantChatView runId={runId} onNavigateTab={setView} onToast={addToast} />
          )}
          {currentView === 'report' && (
            <ReportView runId={runId} />
          )}
          {currentView === 'compliance' && (
            <AuditTrailView runId={runId} />
          )}
        </div>
      </div>

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        setView={setView}
        currentView={currentView}
        summary={summary}
        runId={runId}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
