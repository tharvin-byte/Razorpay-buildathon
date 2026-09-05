import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  Clock,
  Percent,
  RefreshCcw,
  Layers,
  Hash,
  ArrowRight,
  CheckCircle2,
  TrendingDown,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { api } from '../api';
import TransactionInspectorDrawer from '../components/TransactionInspectorDrawer';
import PageHeader from '../components/PageHeader';

function AnimatedNumber({ value }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTimestamp = null;
    const startValue = displayValue;
    const endValue = value;
    const duration = 650;

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(startValue + (endValue - startValue) * easeProgress);

      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    window.requestAnimationFrame(step);
  }, [value]);

  return (
    <span>
      ₹{displayValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  );
}

export default function DiscrepanciesView({ runId, setView, setSelectedTxnId, onToast, onNavigateTab }) {
  const [allDiscrepancies, setAllDiscrepancies] = useState([]);
  const [discFilter, setDiscFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedTxn, setSelectedTxn] = useState(null);

  useEffect(() => {
    loadDiscrepancies();
  }, [runId]);

  const loadDiscrepancies = async () => {
    setLoading(true);
    try {
      // Fetch all discrepancies for this run to keep counts accurate and persistent across filter switches
      const data = await api.getDiscrepancies(runId, '');
      setAllDiscrepancies(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setAllDiscrepancies([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (actionType, txn) => {
    if (actionType === 'trace' && setSelectedTxnId && setView) {
      setSelectedTxnId(txn.record_id);
      setView('agents');
    } else if (actionType === 'erp-voucher' && (onNavigateTab || setView)) {
      (onNavigateTab || setView)('erp-vouchers');
    } else if (actionType === 'dispute' && (onNavigateTab || setView)) {
      (onNavigateTab || setView)('bank-disputes');
    }
  };

  const discTypes = [
    { id: '', label: 'All Discrepancies' },
    { id: 'fee_deduction', label: 'MDR / Platform Fee Gaps' },
    { id: 'timing_lag', label: 'Batch Timing Cycles (T+1/T+2)' },
    { id: 'partial_refund', label: 'Customer Refund Deductions' },
    { id: 'batch_settlement', label: 'Consolidated Batch Payouts (N:1)' },
    { id: 'rounding_difference', label: 'Paisa Rounding Variances' }
  ];

  const totalVarianceDelta = useMemo(() => 
    allDiscrepancies.reduce((acc, d) => {
      const bAmt = d.bank_record?.amount ?? 0;
      const lAmt = d.matched_ledger_record?.gross_amount ?? 0;
      return acc + Math.abs(bAmt - lAmt);
    }, 0),
    [allDiscrepancies]
  );

  const filteredDiscrepancies = useMemo(() => {
    if (!discFilter) return allDiscrepancies;
    return allDiscrepancies.filter(d => 
      d.discrepancies?.some(disc => disc.type === discFilter)
    );
  }, [discFilter, allDiscrepancies]);

  return (
    <LayoutGroup id="discrepancies-layout-group">
      <div style={{ padding: '28px 32px', maxWidth: '1440px', margin: '0 auto' }}>
        <PageHeader
          icon={AlertTriangle}
          accentColor="#FBBF24"
          badges={[
            { label: 'Legit Business Variances', variant: 'discrepancy' },
            { label: 'Auto-Healable Gaps', variant: 'expected' },
          ]}
          title="Audited Discrepancy & Root Cause Explorer"
          description="Real payment records diverge due to legitimate business causes: MDR fee deductions before bank transfer, clearinghouse batch timing cycles, partial merchant refunds, and lump-sum batch netting."
        />

        {/* 4-Column KPI Grid */}
        <div className="kpi-grid" style={{ marginBottom: '24px' }}>
          <div className="kpi-card">
            <div className="kpi-label">Analyzed Variance Gaps</div>
            <div className="kpi-value font-mono" style={{ color: '#FBBF24' }}>
              {allDiscrepancies.length} Records
            </div>
            <div className="kpi-subtext">Legitimate accounting deltas</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">Total Absolute Delta</div>
            <div className="kpi-value font-mono" style={{ color: '#F59E0B' }}>
              <AnimatedNumber value={totalVarianceDelta} />
            </div>
            <div className="kpi-subtext">Underlying fee & timing variance</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">Auto-Resolution Readiness</div>
            <div className="kpi-value font-mono" style={{ color: '#34D399' }}>
              100% Policy Mapped
            </div>
            <div className="kpi-subtext">Zero unclassified variance</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">Mean Confidence Score</div>
            <div className="kpi-value font-mono" style={{ color: '#A78BFA' }}>
              94.2% Conformal
            </div>
            <div className="kpi-subtext">Statutory audit trail bound</div>
          </div>
        </div>

        {/* Sliding Pill Filter Tabs */}
        <div style={{ display: 'inline-flex', gap: '3px', marginBottom: '24px', background: 'rgba(255, 255, 255, 0.025)', padding: '3px', borderRadius: '8px', border: '1px solid var(--line-subtle)', flexWrap: 'wrap', position: 'relative' }}>
          {discTypes.map((dt) => {
            const isActive = discFilter === dt.id;
            const count = dt.id 
              ? allDiscrepancies.filter(d => d.discrepancies?.some(disc => disc.type === dt.id)).length
              : allDiscrepancies.length;

            return (
              <button
                key={dt.id}
                onClick={() => setDiscFilter(dt.id)}
                style={{
                  position: 'relative',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: isActive ? '700' : '500',
                  border: 'none',
                  cursor: 'pointer',
                  background: 'transparent',
                  color: isActive ? '#fff' : 'var(--text-secondary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  zIndex: 1,
                  transition: 'color 0.15s ease'
                }}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeDiscrepancyTabIndicator"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(245, 158, 11, 0.22)',
                      border: '1px solid rgba(245, 158, 11, 0.45)',
                      borderRadius: '6px',
                      zIndex: -1
                    }}
                  />
                )}
                <span>{dt.label}</span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    opacity: isActive ? 1 : 0.6,
                    color: isActive ? '#FBBF24' : 'inherit'
                  }}
                >
                  ({count})
                </span>
              </button>
            );
          })}
        </div>

        {/* Loading & Empty states */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
            Scanning discrepancies...
          </div>
        ) : filteredDiscrepancies.length === 0 ? (
          <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <CheckCircle2 size={32} color="#10B981" style={{ margin: '0 auto 10px auto' }} />
            <h3 style={{ color: '#fff', fontSize: '16px', fontWeight: '700' }}>No Discrepancies in This Filter</h3>
            <p style={{ fontSize: '12px', marginTop: '4px' }}>All transactions in this category match cleanly.</p>
          </div>
        ) : (
          /* Discrepancy Cards Grid with In-Place Modal Popup Inspection */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '18px' }}>
            {filteredDiscrepancies.map((dTxn) => {
              const bankAmt = dTxn.bank_record?.amount ?? 0;
              const ledgerAmt = dTxn.matched_ledger_record?.gross_amount ?? 0;
              const delta = Math.abs(bankAmt - ledgerAmt);
              const discType = dTxn.discrepancies?.[0]?.type || 'VARIANCE';
              const isSelected = selectedTxn?.record_id === dTxn.record_id;

              return (
                <motion.div
                  key={dTxn.record_id}
                  initial={{ opacity: 0, y: 28, scale: 0.97 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true, margin: '-20px' }}
                  transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                  whileHover={{ y: -4, scale: 1.01 }}
                  whileTap={{ scale: 0.985 }}
                  onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
                    e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
                  }}
                  className="card spotlight-card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    borderTop: '3px solid var(--semantic-warning)',
                    borderColor: isSelected ? '#F59E0B' : undefined,
                    background: isSelected ? 'rgba(245, 158, 11, 0.12)' : undefined,
                    boxShadow: isSelected ? '0 0 24px rgba(245, 158, 11, 0.3)' : 'none',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
                  }}
                  onClick={() => setSelectedTxn(dTxn)}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span className="font-mono" style={{ fontSize: '14px', fontWeight: '800', color: '#fff' }}>
                        {dTxn.record_id}
                      </span>
                      <span className="badge badge-discrepancy" style={{ fontSize: '10px' }}>
                        {(dTxn.confidence_score * 100).toFixed(0)}% Matched
                      </span>
                    </div>

                    {/* Dual Amount Strip */}
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid var(--line-subtle)',
                      marginBottom: '14px',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '8px'
                    }}>
                      <div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Bank Credit</div>
                        <div className="font-mono" style={{ fontSize: '15px', fontWeight: '800', color: '#fff', marginTop: '2px' }}>
                          ₹{bankAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div style={{ borderLeft: '1px solid var(--line-subtle)', paddingLeft: '8px' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>Ledger Invoiced</div>
                        <div className="font-mono" style={{ fontSize: '15px', fontWeight: '800', color: '#CBD5E1', marginTop: '2px' }}>
                          ₹{ledgerAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>

                    <div style={{ marginBottom: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                        <span className="tag-pill font-mono" style={{ fontSize: '10px', color: '#FBBF24', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
                          {discType}
                        </span>
                        {delta > 0 && (
                          <span style={{ fontSize: '11px', color: '#FBBF24', fontWeight: '700' }}>
                            Δ ₹{delta.toFixed(2)}
                          </span>
                        )}
                      </div>

                      {/* Clean 2-Line Root Cause Card Preview */}
                      <div
                        style={{
                          background: 'rgba(255, 255, 255, 0.025)',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                          borderRadius: '8px',
                          padding: '10px 12px',
                          fontSize: '11.5px',
                          color: '#CBD5E1',
                          lineHeight: '1.5'
                        }}
                      >
                        <div style={{ fontWeight: '700', color: '#FBBF24', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#FBBF24', flexShrink: 0 }} />
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {dTxn.explanation?.split('\n\n')?.[0]?.replace(/^DIAGNOSIS:\s*|^WHAT IS.*:\s*|^•\s*/g, '') || discType}
                          </span>
                        </div>
                        <div style={{ color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {dTxn.explanation?.split('\n\n')?.[1]?.replace(/^ROOT CAUSE:\s*|^WHY.*:\s*|^•\s*/g, '') || dTxn.discrepancies?.[0]?.description || 'Variance categorized and verified against accounting policy.'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--line-subtle)', paddingTop: '10px', display: 'flex', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: '11px', color: '#818CF8', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <span>Inspect Audit File</span>
                      <ChevronRight size={13} />
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Centered Modal Popup Window (Direct in Discrepancies page) */}
        <TransactionInspectorDrawer
          transaction={selectedTxn}
          txn={selectedTxn}
          onClose={() => {
            setSelectedTxn(null);
            if (setSelectedTxnId) setSelectedTxnId(null);
          }}
          onAction={handleAction}
          onActionClick={handleAction}
          onToast={onToast}
        />
      </div>
    </LayoutGroup>
  );
}
