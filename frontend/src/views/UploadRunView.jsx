import React, { useState, useRef } from 'react';
import { Upload, Play, Database, CheckCircle2, FileText, Sparkles, Layers, Info, Cpu, Zap, Shield, GitBranch } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api';

function FileUploadCard({ icon: Icon, color, title, description, onFileChange, file }) {
  const inputRef = useRef(null);
  return (
    <div
      className="card"
      onClick={() => inputRef.current?.click()}
      style={{
        borderStyle: 'dashed',
        textAlign: 'center',
        padding: '28px 20px',
        cursor: 'pointer',
        transition: 'border-color 0.2s ease, background 0.2s ease',
        background: file ? `rgba(56, 189, 248, 0.06)` : 'var(--bg-card)',
        borderColor: file ? color : 'var(--border-subtle)'
      }}
    >
      {file ? (
        <>
          <CheckCircle2 size={28} color={color} style={{ margin: '0 auto 10px auto' }} />
          <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#fff', marginBottom: '4px' }}>{title}</h3>
          <p className="font-mono" style={{ fontSize: '11px', color, fontWeight: '700', wordBreak: 'break-all' }}>{file.name}</p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {(file.size / 1024).toFixed(1)} KB · Click to change
          </p>
        </>
      ) : (
        <>
          <Icon size={30} color={color} style={{ margin: '0 auto 10px auto' }} />
          <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#fff', marginBottom: '4px' }}>{title}</h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px', lineHeight: '1.4' }}>{description}</p>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: 'var(--bg-input)', border: `1px solid ${color}40`,
            padding: '6px 14px', borderRadius: 'var(--radius-full)',
            fontSize: '12px', fontWeight: '600', color
          }}>
            <Upload size={12} /> Choose CSV File
          </div>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        style={{ display: 'none' }}
        onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}

export default function UploadRunView({ onRunComplete }) {
  const [bankFile, setBankFile] = useState(null);
  const [ledgerFile, setLedgerFile] = useState(null);
  const [settlementFile, setSettlementFile] = useState(null);
  const [recordCount, setRecordCount] = useState(70);
  const [processing, setProcessing] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [runProgress, setRunProgress] = useState('');

  const pipelineSteps = [
    { title: '1. Multi-Source Ingestion & Fast UTR Indexing', icon: Database, color: '#38BDF8' },
    { title: '2. 3D Multi-Signal Tensor & Sinkhorn Transport', icon: Zap, color: '#06B6D4' },
    { title: '3. Bipartite Graph Partitioning & Netting', icon: Layers, color: '#A78BFA' },
    { title: '4. Stanford Conformal Risk & SHA-256 Merkle Tree', icon: Shield, color: '#10B981' },
    { title: '5. Self-Healing ERP Vouchers & Dispute Drafting', icon: Sparkles, color: '#F59E0B' }
  ];

  const handleRun = async (useSynthetic) => {
    setProcessing(true);
    setActiveStep(0);
    try {
      setRunProgress('Synthesizing realistic multi-source payment batch...');
      setActiveStep(1);

      const uploadRes = await api.uploadOrGenerate({
        bankFile: useSynthetic ? null : bankFile,
        ledgerFile: useSynthetic ? null : ledgerFile,
        settlementFile: useSynthetic ? null : settlementFile,
        generateSynthetic: useSynthetic,
        recordsCount: recordCount,
        seed: Math.floor(Math.random() * 1000)
      });

      const runId = uploadRes.run_id;
      setActiveStep(2);
      setRunProgress('Running 3D Tensor Core & Narration Parsing...');

      await api.startRun(runId, 0.75);

      setActiveStep(3);
      setRunProgress('Executing Graph Solver & Conformal Risk Verification...');

      let done = false;
      while (!done) {
        await new Promise((r) => setTimeout(r, 600));
        const st = await api.getStatus(runId);
        if (st.status === 'completed') {
          done = true;
          setActiveStep(4);
          setRunProgress('Generating ERP Vouchers & Statutory Dossiers...');
          setTimeout(() => {
            onRunComplete(runId);
          }, 500);
        }
      }
    } catch (e) {
      console.error(e);
      alert('Failed to execute reconciliation pipeline: ' + e.message);
      setProcessing(false);
    }
  };

  return (
    <div style={{ padding: '32px', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span className="badge badge-clean">
            <Sparkles size={13} /> Multi-Source Pipeline
          </span>
          <span className="badge badge-expected">
            Bank + Internal Ledger + Gateway Reports
          </span>
        </div>
        <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#fff', letterSpacing: '-0.5px' }}>
          Reconciliation Ingestion & Execution Engine
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '6px', maxWidth: '800px', lineHeight: '1.5' }}>
          Upload actual multi-source CSV files or trigger our high-fidelity synthetic generator replicating real-world Indian payment anomalies (MDR fees, GST splits, timing lags, and orphan deposits).
        </p>
      </div>

      {/* Mode 1: 1-Click Synthetic Batch Generation */}
      <div className="card" style={{ marginBottom: '28px', background: 'linear-gradient(135deg, rgba(14, 20, 36, 0.95), var(--bg-card))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ maxWidth: '580px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Sparkles size={16} color="#38BDF8" />
              <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#fff' }}>
                Instant Realistic Demo Simulation (1-Click Run)
              </h2>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Generates a calibrated multi-source dataset containing exact UTR matches, messy UPI/NEFT narrations, contractual fee deductions, settlement batch delays (T+1/T+2), and intentional duplicate traps.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Batch Size:
              </label>
              <select
                className="input-custom font-mono"
                style={{ marginLeft: '6px', padding: '6px 10px', fontSize: '12px' }}
                value={recordCount}
                onChange={(e) => setRecordCount(Number(e.target.value))}
                disabled={processing}
              >
                <option value={30}>30 records (Quick)</option>
                <option value={70}>70 records (Standard)</option>
                <option value={150}>150 records (Full Benchmark)</option>
              </select>
            </div>

            <button
              className="btn-primary"
              onClick={() => handleRun(true)}
              disabled={processing}
            >
              <Play size={14} /> Run Autonomous Engine
            </button>
          </div>
        </div>

        {/* Pipeline Execution Stepper */}
        {processing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border-subtle)' }}
          >
            <div style={{ fontSize: '12px', fontWeight: '800', color: '#38BDF8', marginBottom: '14px' }}>
              {runProgress}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
              {pipelineSteps.map((step, idx) => {
                const Icon = step.icon;
                const isCurrent = activeStep === idx;
                const isDone = activeStep > idx;

                return (
                  <div
                    key={idx}
                    style={{
                      background: isCurrent ? 'rgba(56, 189, 248, 0.15)' : isDone ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-input)',
                      border: `1px solid ${isCurrent ? '#38BDF8' : isDone ? '#10B981' : 'var(--border-subtle)'}`,
                      borderRadius: 'var(--radius-sm)',
                      padding: '10px 8px',
                      textAlign: 'center',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <Icon size={16} color={isCurrent ? '#38BDF8' : isDone ? '#34D399' : 'var(--text-muted)'} style={{ margin: '0 auto 6px auto' }} />
                    <div style={{ fontSize: '10px', fontWeight: '700', color: isCurrent ? '#fff' : isDone ? '#34D399' : 'var(--text-muted)', lineHeight: '1.2' }}>
                      {step.title}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>

      {/* Mode 2: Custom Multi-Source CSV File Upload */}
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: '800', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '12px' }}>
          Or Ingest Custom Financial CSV Statements:
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <FileUploadCard
          icon={Database}
          color="#38BDF8"
          title="Bank Nodal Account Statement"
          description="CSV containing bank transaction IDs, amounts, value dates, and unstructured narration strings."
          file={bankFile}
          onFileChange={setBankFile}
        />
        <FileUploadCard
          icon={FileText}
          color="#A78BFA"
          title="Internal Merchant ERP Ledger"
          description="CSV containing invoice references, customer counterparty names, gross amounts, and fees."
          file={ledgerFile}
          onFileChange={setLedgerFile}
        />
        <FileUploadCard
          icon={Layers}
          color="#34D399"
          title="Payment Gateway Settlement File (Optional)"
          description="Settlement batch report containing interchange fees, GST splits, and UTR confirmations."
          file={settlementFile}
          onFileChange={setSettlementFile}
        />
      </div>

      {bankFile && ledgerFile && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            className="btn-primary"
            onClick={() => handleRun(false)}
            disabled={processing}
          >
            <Play size={14} /> Reconcile Uploaded CSVs
          </button>
        </div>
      )}
    </div>
  );
}
