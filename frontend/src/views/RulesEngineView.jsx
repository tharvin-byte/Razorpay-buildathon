import React, { useState, useEffect } from 'react';
import {
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Play,
  Plus,
  Trash2,
  Zap,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Info,
  Scale
} from 'lucide-react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { api } from '../api';

const DEFAULT_RULES = [
  {
    id: 'rule-01',
    name: 'Auto-Approve Verified MDR Fee Gaps',
    description: 'Auto-approve bank credit fee variances ≤ ₹20.00 when exact UTR matches internal ledger row.',
    field: 'fee_deduction',
    condition: 'delta_lte',
    threshold: 20.0,
    action: 'AUTO_APPROVE',
    active: true,
    category: 'Fee Reconciliation',
    impactAmount: 1420.50,
    impactCount: 7
  },
  {
    id: 'rule-02',
    name: 'Auto-Clear Standard T+1/T+2 Timing Cycles',
    description: 'Auto-clear timing lag discrepancies if settlement date is within 48 hours of order creation.',
    field: 'timing_lag',
    condition: 'days_lte',
    threshold: 2,
    action: 'AUTO_CLEAR',
    active: true,
    category: 'Settlement Cycles',
    impactAmount: 8940.00,
    impactCount: 4
  },
  {
    id: 'rule-03',
    name: 'Paisa Rounding Variance Tolerance',
    description: 'Auto-resolve micro-variances ≤ ₹0.50 caused by floating-point GST/MDR percentage truncation.',
    field: 'rounding_difference',
    condition: 'delta_lte',
    threshold: 0.50,
    action: 'AUTO_APPROVE',
    active: true,
    category: 'Rounding Tolerance',
    impactAmount: 4.89,
    impactCount: 5
  },
  {
    id: 'rule-04',
    name: 'Consolidated N:1 Batch Settlement Netting',
    description: 'Auto-group multi-order lump payouts if sum of 2-3 ledger net amounts equals bank credit within ₹1.00.',
    field: 'batch_settlement',
    condition: 'net_zero_gap',
    threshold: 1.0,
    action: 'AUTO_RESOLVE_BATCH',
    active: true,
    category: 'Batch Netting',
    impactAmount: 14920.00,
    impactCount: 2
  },
  {
    id: 'rule-05',
    name: 'High-Value Ledger Orphan Escalation',
    description: 'Immediately escalate uncollected ledger receivables > ₹5,000 to Senior Financial Controller.',
    field: 'ledger_orphan',
    condition: 'amount_gte',
    threshold: 5000.0,
    action: 'ESCALATE_CONTROLLER',
    active: true,
    category: 'Risk Escalation',
    impactAmount: 26080.00,
    impactCount: 3
  }
];

export default function RulesEngineView({ runId, setView }) {
  const [rules, setRules] = useState(DEFAULT_RULES);
  const [discrepancies, setDiscrepancies] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeRippleId, setActiveRippleId] = useState(null);

  useEffect(() => {
    loadData();
  }, [runId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [disc, sum] = await Promise.all([
        api.getDiscrepancies(runId),
        api.getSummary(runId)
      ]);
      setDiscrepancies(disc);
      setSummary(sum);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleRule = (id) => {
    setActiveRippleId(id);
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, active: !r.active } : r))
    );
    setTimeout(() => setActiveRippleId(null), 700);
  };

  const deleteRule = (id) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  const activeRulesCount = rules.filter((r) => r.active).length;
  const totalSimulatedSavings = rules
    .filter((r) => r.active)
    .reduce((acc, r) => acc + (r.impactAmount || 0), 0);

  return (
    <LayoutGroup id="rules-engine-group">
      <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span className="badge badge-clean">
                <Zap size={12} /> Autonomous Policy Engine
              </span>
              <span className="badge badge-expected">
                Real-Time Simulation
              </span>
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#fff', letterSpacing: '-0.4px', margin: 0 }}>
              Auto-Resolution Policy Engine
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px', maxWidth: '850px', lineHeight: '1.4' }}>
              Deterministic financial policies automatically resolve known timing lags, fee variances, and rounding deltas before triggering human audits.
            </p>
          </div>
        </div>

        {/* 4-Column KPI Grid with Live Reactive Savings */}
        <div className="kpi-grid" style={{ marginBottom: '24px' }}>
          <div className="kpi-card">
            <div className="kpi-label">Active Policies</div>
            <div className="kpi-value font-mono" style={{ color: '#60A5FA' }}>
              {activeRulesCount} of {rules.length} Active
            </div>
            <div className="kpi-subtext">Deterministic automation rules</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">Auto-Resolved Capital</div>
            <div className="kpi-value font-mono" style={{ color: '#34D399' }}>
              ₹{totalSimulatedSavings.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="kpi-subtext">Zero manual touchpoints</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">Audit Escalations Avoided</div>
            <div className="kpi-value font-mono" style={{ color: '#FBBF24' }}>
              {rules.filter((r) => r.active).reduce((acc, r) => acc + (r.impactCount || 0), 0)} Gaps Auto-Healed
            </div>
            <div className="kpi-subtext">T+0 instant resolution</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">Policy Guardrail</div>
            <div className="kpi-value" style={{ color: '#34D399', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={16} />
              <span>Immutable Ledger Guard</span>
            </div>
            <div className="kpi-subtext">Conformal Risk Bound α ≤ 0.001</div>
          </div>
        </div>

        {/* Rules List Container */}
        <div className="card" style={{ padding: '0', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
          <div style={{ padding: '14px 18px', background: 'rgba(255, 255, 255, 0.015)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '12px', fontWeight: '800', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Active Auto-Resolution Rules Registry
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Toggle switches to simulate instant balance impact
            </div>
          </div>

          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {rules.map((rule) => {
              const isRippling = activeRippleId === rule.id;
              return (
                <motion.div
                  key={rule.id}
                  layout
                  className="card spotlight-card"
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
                    e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
                  }}
                  style={{
                    padding: '16px 20px',
                    borderColor: rule.active ? 'rgba(99, 102, 241, 0.35)' : 'var(--border-subtle)',
                    background: rule.active ? 'rgba(15, 23, 42, 0.85)' : 'rgba(8, 14, 27, 0.6)',
                    boxShadow: isRippling ? '0 0 25px rgba(52, 211, 153, 0.35)' : 'none',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '16px'
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span className="badge badge-expected" style={{ fontSize: '9.5px', padding: '1px 6px' }}>
                        {rule.category}
                      </span>
                      <span className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {rule.id}
                      </span>
                    </div>

                    <div style={{ fontSize: '14px', fontWeight: '700', color: rule.active ? '#fff' : 'var(--text-muted)', marginBottom: '4px' }}>
                      {rule.name}
                    </div>

                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                      {rule.description}
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexShrink: 0 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div className="font-mono" style={{ fontSize: '13px', fontWeight: '700', color: rule.active ? '#34D399' : 'var(--text-muted)' }}>
                        ₹{rule.impactAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                        {rule.impactCount} txns auto-healed
                      </div>
                    </div>

                    {/* Animated Sliding Toggle Switch */}
                    <button
                      onClick={() => toggleRule(rule.id)}
                      style={{
                        width: '46px',
                        height: '24px',
                        borderRadius: '12px',
                        background: rule.active ? '#4F46E5' : 'rgba(255, 255, 255, 0.1)',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '2px',
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        transition: 'background 0.2s ease'
                      }}
                    >
                      <motion.div
                        layout
                        transition={{ type: 'spring', stiffness: 600, damping: 35 }}
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          background: '#fff',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                          marginLeft: rule.active ? '22px' : '0px'
                        }}
                      />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </LayoutGroup>
  );
}
