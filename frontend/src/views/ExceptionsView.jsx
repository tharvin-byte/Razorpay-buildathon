import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertOctagon,
  ShieldAlert,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Layers,
  AlertTriangle,
  ExternalLink,
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

export default function ExceptionsView({ runId, setView, selectedTxnId, setSelectedTxnId, onToast, onNavigateTab }) {
  const [allExceptions, setAllExceptions] = useState([]);
  const [sideFilter, setSideFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedTxn, setSelectedTxn] = useState(null);

  useEffect(() => {
    loadExceptions();
  }, [runId]);

  useEffect(() => {
    if (selectedTxnId && allExceptions.length > 0) {
      const match = allExceptions.find(e => e.record_id === selectedTxnId);
      if (match) {
        setSelectedTxn(match);
        if (setSelectedTxnId) setSelectedTxnId(null);
      }
    }
  }, [selectedTxnId, allExceptions]);

  const loadExceptions = async () => {
    setLoading(true);
    try {
      // Fetch all exceptions for this run to keep tab counts accurate and persistent
      const data = await api.getExceptions(runId, '');
      setAllExceptions(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setAllExceptions([]);
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

  // Static total tab counts computed from all exceptions
  const ledgerOrphans = useMemo(() => 
    allExceptions.filter(e => e.exception_side === 'ledger' || e.source_type === 'ledger'),
    [allExceptions]
  );
  
  const bankOrphans = useMemo(() => 
    allExceptions.filter(e => e.exception_side === 'bank' || e.source_type === 'bank'),
    [allExceptions]
  );

  const totalQuarantinedCapital = useMemo(() => 
    allExceptions.reduce((acc, e) => {
      const amt = e.bank_record?.amount ?? e.matched_ledger_record?.gross_amount ?? 0;
      return acc + amt;
    }, 0),
    [allExceptions]
  );

  // Filtered list based on active tab
  const filteredExceptions = useMemo(() => {
    if (sideFilter === 'ledger') return ledgerOrphans;
    if (sideFilter === 'bank') return bankOrphans;
    return allExceptions;
  }, [sideFilter, allExceptions, ledgerOrphans, bankOrphans]);

  const filterTabs = [
    { id: '', label: 'All Exceptions', count: allExceptions.length },
    { id: 'ledger', label: 'Critical Ledger Orphans', count: ledgerOrphans.length },
    { id: 'bank', label: 'Bank Orphans (Unidentified)', count: bankOrphans.length }
  ];

  return (
    <LayoutGroup id="exceptions-layout-group">
      <div style={{ padding: '28px 32px', maxWidth: '1440px', margin: '0 auto' }}>
        <PageHeader
          icon={ShieldAlert}
          accentColor="#F87171"
          badges={[
            { label: 'Zero Guessing Policy', variant: 'discrepancy' },
            { label: '100% Audit Traceable', variant: 'clean' },
          ]}
          title="Honest Exception & Orphan Registry"
          description={<>In financial accounting, forcing a guess is a regulatory violation. ReconX isolates unresolved records into two auditable buckets: <strong>Ledger Orphans</strong> (unsettled receivables) and <strong>Bank Orphans</strong> (unidentified credits).</>}
        />

        {/* KPI Cards Grid with Live Odometers */}
        <div className="kpi-grid" style={{ marginBottom: '24px' }}>
          <div className="kpi-card">
            <div className="kpi-label">Quarantined Risk Capital</div>
            <div className="kpi-value font-mono" style={{ color: '#F87171' }}>
              <AnimatedNumber value={totalQuarantinedCapital} />
            </div>
            <div className="kpi-subtext">Isolated from statutory ledger balance</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">Critical Ledger Orphans</div>
            <div className="kpi-value font-mono" style={{ color: '#FCA5A5' }}>
              {ledgerOrphans.length} Unsettled
            </div>
            <div className="kpi-subtext">Receivables without matching bank credits</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">Unrepresented Bank Credits</div>
            <div className="kpi-value font-mono" style={{ color: '#FBBF24' }}>
              {bankOrphans.length} Deposits
            </div>
            <div className="kpi-subtext">Bank credits without matching orders</div>
          </div>

          <div className="kpi-card">
            <div className="kpi-label">Statutory Compliance Status</div>
            <div className="kpi-value" style={{ color: '#34D399', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={16} />
              <span>100% Quarantine Verified</span>
            </div>
            <div className="kpi-subtext">Zero forced reconciliation guesses</div>
          </div>
        </div>

        {/* Sliding Pill Filter Tabs */}
        <div style={{ display: 'inline-flex', gap: '3px', marginBottom: '24px', background: 'rgba(255, 255, 255, 0.025)', padding: '3px', borderRadius: '8px', border: '1px solid var(--line-subtle)', position: 'relative' }}>
          {filterTabs.map((tab) => {
            const isActive = sideFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSideFilter(tab.id)}
                style={{
                  position: 'relative',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: isActive ? '700' : '500',
                  border: 'none',
                  cursor: 'pointer',
                  background: 'transparent',
                  color: isActive ? '#fff' : 'var(--text-muted)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  zIndex: 1,
                  transition: 'color 0.15s ease'
                }}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeExceptionTabIndicator"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(239, 68, 68, 0.25)',
                      border: '1px solid rgba(239, 68, 68, 0.5)',
                      borderRadius: '6px',
                      zIndex: -1
                    }}
                  />
                )}
                <span>{tab.label}</span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10.5px',
                    opacity: isActive ? 1 : 0.6,
                    color: isActive ? '#F87171' : 'inherit'
                  }}
                >
                  ({tab.count})
                </span>
              </button>
            );
          })}
        </div>

        {/* Loading & Empty states */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
            Scanning exception registry...
          </div>
        ) : filteredExceptions.length === 0 ? (
          <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <CheckCircle2 size={32} color="#10B981" style={{ margin: '0 auto 10px auto' }} />
            <h3 style={{ color: '#fff', fontSize: '16px', fontWeight: '700' }}>No Exceptions in This Filter</h3>
            <p style={{ fontSize: '12px', marginTop: '4px' }}>Zero pending quarantined orphan records in this view.</p>
          </div>
        ) : (
          /* Exception Cards Grid with In-Place Modal Popup Inspection */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '18px' }}>
            {filteredExceptions.map((exc) => {
              const isLedgerOrphan = exc.exception_side === 'ledger' || exc.source_type === 'ledger';
              const amt = exc.bank_record?.amount ?? exc.matched_ledger_record?.gross_amount ?? 0;
              const isSelected = selectedTxn?.record_id === exc.record_id;

              return (
                <motion.div
                  key={exc.record_id}
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
                    borderColor: isSelected ? '#EF4444' : isLedgerOrphan ? 'rgba(251, 90, 116, 0.45)' : 'var(--line-subtle)',
                    background: isSelected ? 'rgba(239, 68, 68, 0.12)' : isLedgerOrphan ? 'linear-gradient(135deg, rgba(251, 90, 116, 0.06), var(--bg-card))' : 'var(--bg-card)',
                    borderTop: isLedgerOrphan ? '3px solid var(--semantic-danger)' : '3px solid var(--line-strong)',
                    boxShadow: isSelected ? '0 0 24px rgba(239, 68, 68, 0.3)' : 'none',
                    padding: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
                  }}
                  onClick={() => setSelectedTxn(exc)}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div>
                        <span className="font-mono" style={{ fontSize: '14px', fontWeight: '800', color: isLedgerOrphan ? '#FCA5A5' : '#fff' }}>
                          {exc.record_id}
                        </span>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {isLedgerOrphan ? 'Internal Ledger Reverse Sweep' : 'Bank Statement Direct Deposit'}
                        </div>
                      </div>
                      <span className="badge badge-exception" style={{ fontSize: '9.5px', padding: '2px 7px' }}>
                        {isLedgerOrphan ? 'Ledger Orphan' : 'Bank Orphan'}
                      </span>
                    </div>

                    <div style={{
                      background: 'rgba(255, 255, 255, 0.025)',
                      border: '1px solid var(--line-subtle)',
                      padding: '14px',
                      borderRadius: '8px',
                      marginBottom: '14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>
                          {isLedgerOrphan ? 'UNSETTLED RECEIVABLE (MONEY EXPECTED)' : 'UNREPRESENTED BANK DEPOSIT'}
                        </div>
                        <div className="font-mono" style={{ fontSize: '20px', fontWeight: '900', color: 'var(--semantic-danger)', marginTop: '2px' }}>
                          ₹{amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>AUDIT IMPACT</div>
                        <div className="badge badge-exception" style={{ fontSize: '10px', marginTop: '4px' }}>
                          {isLedgerOrphan ? 'Direct Loss Risk' : 'AML Review'}
                        </div>
                      </div>
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
                        lineHeight: '1.5',
                        marginBottom: '14px'
                      }}
                    >
                      <div style={{ fontWeight: '700', color: isLedgerOrphan ? '#FCA5A5' : '#F87171', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: isLedgerOrphan ? '#FCA5A5' : '#F87171', flexShrink: 0 }} />
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {exc.explanation?.split('\n\n')?.[0]?.replace(/^DIAGNOSIS:\s*|^WHAT IS.*:\s*|^•\s*/g, '') || (isLedgerOrphan ? 'Unsettled Ledger Order' : 'Unidentified Bank Credit')}
                        </span>
                      </div>
                      <div style={{ color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {exc.explanation?.split('\n\n')?.[1]?.replace(/^ROOT CAUSE:\s*|^WHY.*:\s*|^•\s*/g, '') || exc.exception_reason || 'Quarantined in Suspense Account under Zero Guessing Policy.'}
                      </div>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--line-subtle)', paddingTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
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

        {/* Centered Modal Popup Window (Direct in Exceptions page) */}
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
