import React, { useState, useEffect } from 'react';
import { Cpu, FileText, ArrowRight, CheckCircle2, Sparkles, Shield, GitBranch, Zap, Layers, Filter } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../api';

export default function AgentsTraceView({ runId, selectedTxnId }) {
  const [txnList, setTxnList] = useState([]);
  const [currentId, setCurrentId] = useState(selectedTxnId || '');
  const [traceData, setTraceData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [agentFilter, setAgentFilter] = useState('ALL');

  useEffect(() => {
    loadTransactions();
  }, [runId]);

  useEffect(() => {
    if (selectedTxnId) {
      setCurrentId(selectedTxnId);
      loadTrace(selectedTxnId);
    }
  }, [selectedTxnId]);

  const loadTransactions = async () => {
    try {
      const data = await api.getTransactions(runId);
      setTxnList(data);
      if (data.length > 0 && !currentId) {
        setCurrentId(data[0].record_id);
        loadTrace(data[0].record_id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadTrace = async (txnId) => {
    setLoading(true);
    try {
      const data = await api.getTrace(runId, txnId);
      setTraceData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTxn = (e) => {
    const id = e.target.value;
    setCurrentId(id);
    loadTrace(id);
  };

  const filteredTrace = traceData?.trace?.filter((step) => {
    if (agentFilter === 'ALL') return true;
    return step.agent_name.toLowerCase().includes(agentFilter.toLowerCase());
  }) || [];

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span className="badge badge-clean">
            <Cpu size={13} /> 4 Autonomous Agents + 4 Math Layers
          </span>
          <span className="badge badge-expected">
            Zero Blackbox Decisions
          </span>
        </div>
        <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#fff', letterSpacing: '-0.5px' }}>
          Multi-Agent Architecture & Decision Trace
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '6px', maxWidth: '850px', lineHeight: '1.5' }}>
          ReconX decouples cognitive policies (4 Autonomous Agents) from high-speed mathematical algorithms (4 Deterministic Layers). Every match, discrepancy explanation, ERP voucher, and dispute claim is fully auditable.
        </p>
      </div>

      {/* Section 1: 4 Autonomous Cognitive Agents */}
      <div className="card" style={{ marginBottom: '24px', background: 'linear-gradient(135deg, rgba(14, 20, 36, 0.9), var(--bg-card))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: '800', color: '#38BDF8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            🤖 4 Autonomous Cognitive Agents (Policy & Action)
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            LLM-Augmented & Autonomous Self-Healing
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          {[
            {
              icon: Cpu, color: '#38BDF8', border: '#0284C7', title: '1. Decision Maker & Planner',
              desc: 'Triage hub. Manages forward/reverse routing, candidate evaluation, tie-breaking for ambiguous cases, and zero-guess enforcement.'
            },
            {
              icon: FileText, color: '#A78BFA', border: '#8B5CF6', title: '2. Narration Parser Agent',
              desc: 'Linguistic reader. Dual-track regex primary + Gemini LLM fallback to extract names, invoice refs, and rail codes from messy text.'
            },
            {
              icon: Sparkles, color: '#818CF8', border: '#6366F1', title: '3. ERP Self-Healing Agent',
              desc: 'Autonomous bookkeeping. Synthesizes balanced double-entry vouchers (∑ Debit ≡ ∑ Credit) into Tally Prime XML & SAP JSON.'
            },
            {
              icon: Shield, color: '#FBBF24', border: '#F59E0B', title: '4. Bank Dispute Recovery Bot',
              desc: 'Autonomous legal recovery. Synthesizes formal ISO 20022 and NPCI chargeback notices with SHA-256 Merkle leaf proofs.'
            }
          ].map((agent, i) => {
            const Icon = agent.icon;
            return (
              <motion.div
                key={agent.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -4, borderColor: agent.border }}
                transition={{ duration: 0.2, delay: i * 0.05 }}
                style={{
                  background: 'var(--bg-input)', border: '1px solid var(--border-subtle)',
                  borderTop: `3px solid ${agent.border}`, padding: '16px', borderRadius: 'var(--radius-md)',
                  cursor: 'default'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Icon size={18} color={agent.color} />
                  <span style={{ fontWeight: '800', fontSize: '13px', color: '#fff' }}>{agent.title}</span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  {agent.desc}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Section 2: 4 Deterministic Mathematical Layers */}
      <div className="card" style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: '800', color: '#34D399', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            ⚡ 4 Deterministic Mathematical Layers & Tools (O(1) / O(V+E) Speed)
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Zero-Hallucination Algorithmic Solvers
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          {[
            {
              icon: GitBranch, color: '#34D399', border: '#10B981', title: '1. Candidate Retrieval & Indexing',
              desc: 'O(1) indexed hash table on verified UTRs and invoice refs. Enforces strict 1-to-1 ledger row claiming.'
            },
            {
              icon: Zap, color: '#06B6D4', border: '#0891B2', title: '2. 3D Tensor & Sinkhorn Transport',
              desc: 'M × N × 5 multi-signal feature tensor with regularized Cuturi Sinkhorn doubly-stochastic assignment in < 5ms.'
            },
            {
              icon: Layers, color: '#F472B6', border: '#DB2777', title: '3. Bipartite Netting & DAG Solver',
              desc: 'Linear O(V+E) graph connected-component decomposition resolving 1:N, N:1, and M:N netting with conservation of money.'
            },
            {
              icon: CheckCircle2, color: '#A3E635', border: '#65A30D', title: '4. Conformal Risk & Merkle Verifier',
              desc: 'Stanford Conformal Risk Control (CRC error bound α ≤ 0.001) + 64-character SHA-256 Merkle tree solvency proof.'
            }
          ].map((layer, i) => {
            const Icon = layer.icon;
            return (
              <div
                key={layer.title}
                style={{
                  background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-subtle)',
                  borderTop: `3px solid ${layer.border}`, padding: '14px', borderRadius: 'var(--radius-md)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <Icon size={16} color={layer.color} />
                  <span style={{ fontWeight: '700', fontSize: '12px', color: '#fff' }}>{layer.title}</span>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  {layer.desc}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Transaction Trace Selector & Filter */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Select Transaction to Inspect Multi-Agent Decision Trace:
            </label>
            <div style={{ marginTop: '6px' }}>
              <select
                className="input-custom font-mono"
                style={{ width: '420px', padding: '8px 12px' }}
                value={currentId}
                onChange={handleSelectTxn}
              >
                {txnList.map((t) => (
                  <option key={t.record_id} value={t.record_id}>
                    {t.record_id} — {t.status} (Score: {(t.confidence_score * 100).toFixed(0)}%)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <Filter size={13} color="var(--text-muted)" />
              {['ALL', 'Planner', 'Narration', 'Discrepancy', 'Conflict'].map((filterKey) => (
                <button
                  key={filterKey}
                  onClick={() => setAgentFilter(filterKey)}
                  className={`btn-secondary ${agentFilter === filterKey ? 'active' : ''}`}
                  style={{
                    padding: '4px 8px', fontSize: '11px',
                    background: agentFilter === filterKey ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
                    borderColor: agentFilter === filterKey ? '#38BDF8' : 'var(--border-subtle)',
                    color: agentFilter === filterKey ? '#38BDF8' : 'var(--text-secondary)'
                  }}
                >
                  {filterKey}
                </button>
              ))}
            </div>

            {traceData && (
              <span className="font-mono" style={{ fontSize: '15px', fontWeight: '800', color: '#60A5FA', marginLeft: '8px' }}>
                Score: {(traceData.confidence_score * 100).toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Trace Timeline */}
      {filteredTrace.length > 0 ? (
        <div style={{ padding: '8px 0' }}>
          {filteredTrace.map((step, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.04 }}
              className="trace-step"
            >
              <div className="step-node">{step.step_num}</div>
              <div className="step-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontWeight: '800', color: '#60A5FA', fontSize: '14px' }}>
                    {step.agent_name} → {step.action}
                  </span>
                  <span className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Step {step.step_num}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'var(--bg-input)', padding: '12px', borderRadius: 'var(--radius-sm)', marginBottom: '10px', fontSize: '12px' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontWeight: '700' }}>INPUT CONTEXT:</span>
                    <div className="font-mono" style={{ color: '#E2E8F0', marginTop: '3px' }}>{step.input_summary}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontWeight: '700' }}>ACTION OUTPUT:</span>
                    <div className="font-mono" style={{ color: '#34D399', marginTop: '3px' }}>{step.output_summary}</div>
                  </div>
                </div>

                {step.reasoning && (
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                    <strong style={{ color: '#94A3B8' }}>Agent Reasoning:</strong> {step.reasoning}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          No trace steps match the selected filter for this transaction.
        </div>
      )}
    </div>
  );
}
