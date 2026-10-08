import React, { useState } from 'react';
import { Play, Database, Sparkles, Cpu } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../api';
import PageHeader from '../components/PageHeader';

export default function UploadRunView({ onRunComplete, onToast }) {
  const [recordCount, setRecordCount] = useState(70);
  const [processing, setProcessing] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [runProgress, setRunProgress] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const pipelineSteps = [
    { title: 'Generate synthetic demo data', icon: Database, color: '#8B5CF6' },
    { title: 'Run backend reconciliation', icon: Cpu, color: '#A78BFA' },
  ];

  const handleRun = async () => {
    setProcessing(true);
    setErrorMessage('');
    setActiveStep(0);
    try {
      setRunProgress('Generating synthetic demo data with seed 42...');
      setActiveStep(1);

      const uploadRes = await api.uploadOrGenerate({
        generateSynthetic: true,
        recordsCount: recordCount,
        seed: 42
      });

      const runId = uploadRes.run_id;
      setActiveStep(2);
      setRunProgress('Running the backend reconciliation pipeline...');

      await api.startRun(runId, 0.75);

      let done = false;
      while (!done) {
        await new Promise((r) => setTimeout(r, 600));
        const st = await api.getStatus(runId);
        if (st.status === 'completed') {
          done = true;
          setActiveStep(2);
          setRunProgress('Reconciliation completed. Loading recorded results...');
          setTimeout(() => {
            onRunComplete(runId);
          }, 500);
        } else if (st.status === 'failed') {
          done = true;
          throw new Error(st.error || 'Reconciliation pipeline failed');
        } else if (st.status === 'running' && st.total > 0) {
          const pct = Math.round(((st.processed || 0) / st.total) * 100);
          setRunProgress(`Executing ${st.current_agent || 'Matching Engine'} (${pct}% - Record ${st.processed}/${st.total})...`);
        }
      }
    } catch (e) {
      console.error(e);
      const msg = e.message || 'Failed to execute reconciliation pipeline';
      setErrorMessage(msg);
      if (onToast) {
        onToast({ title: 'Pipeline Execution Failed', message: msg, type: 'error' });
      }
      setProcessing(false);
    }
  };

  return (
    <div style={{ padding: '32px', maxWidth: '1000px', margin: '0 auto' }}>
      <PageHeader
        icon={Sparkles}
        accentColor="#8B5CF6"
        badges={[
          { label: 'Multi-Source Pipeline', variant: 'clean' },
          { label: 'Bank + Internal Ledger + Gateway Reports', variant: 'expected' }
        ]}
        title="Reconciliation Ingestion & Execution Engine"
        description="Run a seeded synthetic demo through the backend reconciliation pipeline. CSV uploads are disabled until authenticated access is configured."
      />

      {/* Mode 1: 1-Click Synthetic Batch Generation */}
      <div className="card" style={{ marginBottom: '28px', background: 'linear-gradient(135deg, rgba(18, 14, 38, 0.95), var(--bg-card))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ maxWidth: '580px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Sparkles size={16} color="#8B5CF6" />
              <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#fff' }}>
                Instant Realistic Demo Simulation (1-Click Run)
              </h2>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Generates a repeatable synthetic dataset for exercising the reconciliation workflow. This is demo data, not a production financial-data ingestion path.
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
              onClick={handleRun}
              disabled={processing}
            >
              <Play size={14} /> Run Autonomous Engine
            </button>
          </div>
        </div>

        {errorMessage && !processing && (
          <div style={{
            marginTop: '16px',
            padding: '12px 16px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-sm)',
            color: '#F87171',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>Failed: {errorMessage}</span>
          </div>
        )}

        {/* Pipeline Execution Stepper */}
        {processing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border-subtle)' }}
          >
            <div style={{ fontSize: '12px', fontWeight: '800', color: '#A78BFA', marginBottom: '14px' }}>
              {runProgress}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
              {pipelineSteps.map((step, idx) => {
                const Icon = step.icon;
                const isCurrent = activeStep === idx;
                const isDone = activeStep > idx;

                return (
                  <div
                    key={idx}
                    style={{
                      background: isCurrent ? 'rgba(139, 92, 246, 0.2)' : isDone ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-input)',
                      border: `1px solid ${isCurrent ? '#8B5CF6' : isDone ? '#10B981' : 'var(--border-subtle)'}`,
                      borderRadius: 'var(--radius-sm)',
                      padding: '10px 8px',
                      textAlign: 'center',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <Icon size={16} color={isCurrent ? '#A78BFA' : isDone ? '#34D399' : 'var(--text-muted)'} style={{ margin: '0 auto 6px auto' }} />
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

      <div className="card" role="note" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
        CSV upload is unavailable until an authentication provider and authenticated access path are configured.
      </div>
    </div>
  );
}
