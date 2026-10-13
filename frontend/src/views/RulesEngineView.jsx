import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Zap
} from 'lucide-react';
import { motion, LayoutGroup } from 'framer-motion';
import { api } from '../api';
import PageHeader from '../components/PageHeader';

const DEFAULT_RULES = [
  {
    id: 'RULE-POL-001',
    name: 'Automatic Paisa Rounding Tolerance (₹1.00)',
    category: 'STATUTORY TOLERANCE',
    description: 'Auto-absorbs fractional GST paisa rounding variances up to ₹1.00 directly into the Rounding Variance ledger (Account 4090).',
    active: true,
    impact: '₹1.00 / txn limit',
  },
  {
    id: 'RULE-POL-002',
    name: 'Clearinghouse T+2 Window Auto-Acceptance',
    category: 'TIMING CYCLE',
    description: 'Allows bank settlement receipts with 1-2 day clearinghouse cycle lag when payment gateway order reference matches.',
    active: true,
    impact: 'T+2 window allowed',
  },
  {
    id: 'RULE-POL-003',
    name: 'High-Value Anomaly Quarantine (>₹50,000)',
    category: 'FRAUD GUARD',
    description: 'Quarantines un-attributed credits or ledger variances exceeding ₹50,000 for mandatory senior controller dual-approval.',
    active: true,
    impact: 'Dual-approval required',
  },
  {
    id: 'RULE-POL-004',
    name: 'Case-Insensitive Reference Normalization',
    category: 'INGESTION HYGIENE',
    description: 'Automatically canonicalizes uppercase and lowercase invoice reference casing variations during candidate scoring.',
    active: true,
    impact: 'Case folding applied',
  },
  {
    id: 'RULE-POL-005',
    name: 'Automated Sales Refund Clawback Offset',
    category: 'REVERSAL POLICY',
    description: 'Matches partial customer refund clawbacks against gross invoice amounts without flagging operational discrepancy.',
    active: false,
    impact: 'Sales Refunds A/C 5020',
  },
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

  return (
    <LayoutGroup id="rules-engine-group">
      <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto' }}>
        <PageHeader
          icon={Zap}
          accentColor="#8B5CF6"
          badges={[
            { label: 'Policy configuration', variant: 'clean' },
            { label: `${activeRulesCount} Active`, variant: 'expected' },
          ]}
          title="Policy Rules & Guardrails"
          description="Declarative business policy guardrails governing automated reconciliation, clearinghouse cycles, and statutory rounding tolerances."
        />

        {/* 4-Column KPI Grid */}
        <div className="kpi-grid" style={{ marginBottom: '24px' }}>
          <div className="kpi-card">
            <div className="kpi-label">Configured Policies</div>
            <div className="kpi-value font-mono" style={{ color: '#A78BFA' }}>
              {activeRulesCount} of {rules.length} Active
            </div>
            <div className="kpi-subtext">Active policy rules in engine</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">Rounding Tolerance</div>
            <div className="kpi-value font-mono" style={{ color: '#34D399' }}>
              ₹1.00 / txn
            </div>
            <div className="kpi-subtext">Statutory paisa auto-absorption ceiling</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">Settlement Window</div>
            <div className="kpi-value font-mono" style={{ color: '#FBBF24' }}>
              T+0 to T+2
            </div>
            <div className="kpi-subtext">Standard clearinghouse cycle allowance</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">Policy Guardrail</div>
            <div className="kpi-value" style={{ color: '#34D399', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={16} />
              <span>Enforced</span>
            </div>
            <div className="kpi-subtext">Statutory audit constraints active</div>
          </div>
        </div>

        {/* Rules List Container */}
        <div className="card" style={{ padding: '0', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
          <div style={{ padding: '14px 18px', background: 'rgba(255, 255, 255, 0.015)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '12px', fontWeight: '800', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Configured Rules
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {activeRulesCount} of {rules.length} policies active
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
                        {rule.impact}
                      </div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                        {rule.active ? 'Policy active' : 'Policy disabled'}
                      </div>
                    </div>

                    {/* Animated Sliding Toggle Switch */}
                    <button
                      onClick={() => toggleRule(rule.id)}
                      style={{
                        width: '46px',
                        height: '24px',
                        borderRadius: '12px',
                        background: rule.active ? '#8B5CF6' : 'rgba(255, 255, 255, 0.1)',
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
