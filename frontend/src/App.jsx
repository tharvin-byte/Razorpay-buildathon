import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, Zap, Shield, Sparkles, CheckCircle2, Cpu } from 'lucide-react';
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
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchStep, setBatchStep] = useState(0);
  const [batchRunId, setBatchRunId] = useState('');

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
        message: `Updated acceptance threshold to λ=${newThreshold}. Auto-approval rate: ${((newSummary.match_rate || 0) * 100).toFixed(1)}%`
      });
    } catch (e) {
      console.error(e);
      addToast({ type: 'error', title: 'Scenario Application Failed', message: e.message });
    } finally {
      setIsRecomputing(false);
    }
  };

  const BATCH_STEPS = [
    {
      label: 'Decision Maker & Planner',
      sublabel: 'Triage hub — forward/reverse routing, candidate evaluation & tie-breaking',
      icon: Cpu,
      color: '#6366F1'
    },
    {
      label: 'Narration Parser Agent',
      sublabel: 'Dual-track regex + Gemini LLM — extracting names, invoice refs & rail codes',
      icon: Zap,
      color: '#C084FC'
    },
    {
      label: 'ERP Self-Healing Agent',
      sublabel: 'Synthesizing double-entry vouchers (Σ Debit = Σ Credit) for Tally & SAP',
      icon: Sparkles,
      color: '#10B981'
    },
    {
      label: 'Bank Dispute Recovery Bot',
      sublabel: 'Generating ISO 20022 & NPCI chargeback notices with SHA-256 Merkle leaf proofs',
      icon: Shield,
      color: '#F59E0B'
    },
  ];

  const handleNewBatch = async () => {
    setBatchLoading(true);
    setBatchStep(0);
    try {
      // Agent 1: Decision Maker & Planner — data synthesis
      setBatchStep(1);
      const uploadRes = await api.uploadOrGenerate({ generateSynthetic: true, recordsCount: 80, seed: Date.now() % 1000 });
      const newRunId = uploadRes.run_id;
      setBatchRunId(newRunId);

      // Agent 2: Narration Parser — start engine
      setBatchStep(2);
      await api.startRun(newRunId, 0.75);
      setStatus({ status: 'running', processed: 0, total: 80 });

      // Poll real backend while Decision Maker + Narration Parser run
      let done = false;
      while (!done) {
        await new Promise((r) => setTimeout(r, 700));
        const st = await api.getStatus(newRunId);
        if (st.status === 'completed') {
          done = true;
        } else if (st.status === 'failed') {
          done = true;
          throw new Error(st.error || 'Pipeline execution failed');
        }
      }

      // Agent 3: ERP Self-Healing Agent
      setBatchStep(3);
      await new Promise((r) => setTimeout(r, 600));

      // Agent 4: Bank Dispute Recovery Bot
      setBatchStep(4);
      await new Promise((r) => setTimeout(r, 600));

      setRunId(newRunId);
      await loadRunData(newRunId);
      setView('transactions');
      addToast({ title: 'New Batch Ready', message: `Run ${newRunId} reconciled and sealed with SHA-256 Merkle root.` });
    } catch (e) {
      console.error(e);
      addToast({ type: 'error', title: 'Batch Run Failed', message: e.message });
    } finally {
      setBatchLoading(false);
      setBatchStep(0);
    }
  };

  const handleExportReport = async () => {
    try {
      const blob = await api.downloadStatutoryDossier(runId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rbi_statutory_dossier_${runId}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addToast({ title: 'Dossier Downloaded', message: `Official RBI statutory compliance dossier exported for ${runId}` });
    } catch (e) {
      console.error(e);
      addToast({ type: 'error', title: 'Export Failed', message: e.message });
    }
  };

  const handleNavigateView = (viewName) => {
    setSelectedTxnId(null);
    setView(viewName);
  };

  return (
    <div className="app-container">

      {/* ── Full-Screen Batch Loading Overlay ──────────────────────────── */}
      <AnimatePresence>
        {batchLoading && (
          <motion.div
            key="batch-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              background: 'rgba(6, 10, 22, 0.92)',
              backdropFilter: 'blur(18px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: '0px'
            }}
          >
            {/* Glow ring */}
            <motion.div
              animate={{ scale: [1, 1.08, 1], opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                position: 'absolute',
                width: '340px', height: '340px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)',
                pointerEvents: 'none'
              }}
            />

            {/* Spinning logo ring */}
            <div style={{ position: 'relative', width: '80px', height: '80px', marginBottom: '32px' }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
                style={{
                  position: 'absolute', inset: 0,
                  borderRadius: '50%',
                  border: '3px solid transparent',
                  borderTopColor: '#8B5CF6',
                  borderRightColor: '#C084FC',
                }}
              />
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
                style={{
                  position: 'absolute', inset: '8px',
                  borderRadius: '50%',
                  border: '2px solid transparent',
                  borderTopColor: '#10B981',
                  borderLeftColor: '#F59E0B',
                }}
              />
              <div style={{
                position: 'absolute', inset: '18px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(56,189,248,0.15))',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Cpu size={18} color="#818CF8" />
              </div>
            </div>

            {/* Title */}
            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#fff', letterSpacing: '-0.4px', margin: 0 }}>
                ReconX Engine Running
              </h2>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                Processing new reconciliation batch
              </p>
              {batchRunId && (
                <span style={{
                  fontFamily: 'monospace', fontSize: '11px',
                  color: '#6366F1', background: 'rgba(99,102,241,0.12)',
                  padding: '2px 8px', borderRadius: '4px', display: 'inline-block', marginTop: '6px'
                }}>
                  {batchRunId}
                </span>
              )}
            </div>

            {/* Step Pills */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '28px', width: '420px' }}>
              {BATCH_STEPS.map((step, idx) => {
                const StepIcon = step.icon;
                const isDone = batchStep > idx + 1;
                const isActive = batchStep === idx + 1;
                return (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.07, duration: 0.3 }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '14px',
                      padding: '11px 16px', borderRadius: '10px',
                      background: isDone
                        ? 'rgba(16, 185, 129, 0.08)'
                        : isActive
                          ? 'rgba(99,102,241,0.12)'
                          : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${
                        isDone ? 'rgba(16,185,129,0.25)'
                          : isActive ? `${step.color}55`
                            : 'rgba(255,255,255,0.05)'
                      }`,
                      transition: 'all 0.3s ease'
                    }}
                  >
                    {/* Icon */}
                    <div style={{ flexShrink: 0 }}>
                      {isDone ? (
                        <CheckCircle2 size={17} color="#34D399" />
                      ) : isActive ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                        >
                          <StepIcon size={17} color={step.color} />
                        </motion.div>
                      ) : (
                        <StepIcon size={17} color="rgba(255,255,255,0.18)" />
                      )}
                    </div>

                    {/* Labels */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '13px',
                        fontWeight: isActive ? '700' : isDone ? '600' : '400',
                        color: isDone ? '#34D399' : isActive ? '#fff' : 'rgba(255,255,255,0.28)',
                        transition: 'color 0.3s ease',
                        letterSpacing: isActive ? '-0.2px' : '0'
                      }}>
                        {step.label}
                      </div>
                      <div style={{
                        fontSize: '11px',
                        color: isDone ? 'rgba(52,211,153,0.6)' : isActive ? 'var(--text-secondary)' : 'rgba(255,255,255,0.12)',
                        marginTop: '2px',
                        transition: 'color 0.3s ease'
                      }}>
                        {step.sublabel}
                      </div>
                    </div>

                    {/* Active pulse dot */}
                    {isActive && (
                      <motion.div
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 0.9, repeat: Infinity }}
                        style={{
                          flexShrink: 0,
                          width: '7px', height: '7px', borderRadius: '50%',
                          background: step.color,
                          boxShadow: `0 0 10px ${step.color}`
                        }}
                      />
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Thin animated progress bar at very bottom */}
            <div style={{ width: '420px', height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', marginTop: '28px', overflow: 'hidden' }}>
              <motion.div
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                style={{ width: '40%', height: '100%', background: 'linear-gradient(90deg, transparent, #8B5CF6, #C084FC, transparent)', borderRadius: '2px' }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <Sidebar currentView={currentView} setView={handleNavigateView} summary={summary} />

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

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', position: 'relative' }}>
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
          {(currentView === 'scenarios' || currentView === 'playground') && (
            <ScenariosView runId={runId} summary={summary} onApplyScenario={handleApplyScenario} onToast={addToast} />
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
            <DiscrepanciesView runId={runId} selectedTxnId={selectedTxnId} setSelectedTxnId={setSelectedTxnId} setView={setView} onToast={addToast} onNavigateTab={setView} />
          )}
          {currentView === 'exceptions' && (
            <ExceptionsView runId={runId} selectedTxnId={selectedTxnId} setSelectedTxnId={setSelectedTxnId} setView={setView} onToast={addToast} onNavigateTab={setView} />
          )}
          {currentView === 'rules' && (
            <RulesEngineView runId={runId} />
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
        onNavigate={setView}
        onRunNewBatch={handleNewBatch}
        onExportReport={handleExportReport}
        currentView={currentView}
        summary={summary}
        runId={runId}
      />

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
