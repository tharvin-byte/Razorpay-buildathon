import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  Zap,
  Clock,
  Layers,
  ArrowUpRight,
  Filter,
  DollarSign,
  PieChart,
  Percent,
  CheckCircle2,
  Cpu,
  Sparkles,
  ChevronRight,
  Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api';
import TransactionInspectorDrawer from '../components/TransactionInspectorDrawer';
import PageHeader from '../components/PageHeader';

function AnimatedNumber({ value, prefix = '₹', decimals = 2 }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTimestamp = null;
    const startValue = displayValue;
    const endValue = value;
    const duration = 750;

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
      {prefix}{displayValue.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
    </span>
  );
}

export default function AnalyticsView({ runId, setView, setSelectedTxnId }) {
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTxn, setSelectedTxn] = useState(null);

  useEffect(() => {
    loadAnalyticsData();
  }, [runId]);

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      const [txns, sum] = await Promise.all([
        api.getTransactions(runId),
        api.getSummary(runId)
      ]);
      setTransactions(txns);
      setSummary(sum);
    } catch (e) {
      console.error('Error loading analytics:', e);
    } finally {
      setLoading(false);
    }
  };

  const metrics = useMemo(() => {
    let totalInflow = 0;
    let cleanVolume = 0;
    let varianceVolume = 0;
    let exceptionVolume = 0;

    transactions.forEach((t) => {
      const amt = t.bank_record?.amount || t.matched_ledger_record?.gross_amount || 0;
      totalInflow += amt;
      if (t.status === 'matched_clean') cleanVolume += amt;
      else if (t.status === 'matched_with_discrepancy') varianceVolume += amt;
      else exceptionVolume += amt;
    });

    return { totalInflow, cleanVolume, varianceVolume, exceptionVolume };
  }, [transactions]);

  const exceptionsList = useMemo(() => {
    return transactions
      .filter((t) => t.status === 'exception')
      .sort((a, b) => {
        const amtA = a.bank_record?.amount || a.matched_ledger_record?.gross_amount || 0;
        const amtB = b.bank_record?.amount || b.matched_ledger_record?.gross_amount || 0;
        return amtB - amtA;
      });
  }, [transactions]);

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1440px', margin: '0 auto' }}>
      <PageHeader
        icon={TrendingUp}
        accentColor="#8B5CF6"
        badges={[
          { label: 'Autonomous Control Center', variant: 'clean' },
          { label: `Batch: ${runId}`, variant: 'expected' },
        ]}
        title="Executive Financial Operations & Telemetry Overview"
        description="Live mathematical reconciliation telemetry, autonomous agent throughput, and risk exposure monitoring."
      />

      {/* Top 4 Headline Metric Cards */}
      <div className="kpi-grid" style={{ marginBottom: '24px' }}>
        <div className="kpi-card spotlight-card">
          <div className="kpi-label">Gross Batch Volume</div>
          <div className="kpi-value font-mono" style={{ color: '#A78BFA' }}>
            <AnimatedNumber value={metrics.totalInflow} />
          </div>
          <div className="kpi-subtext">{transactions.length} Total Records Processed</div>
        </div>

        <div className="kpi-card spotlight-card">
          <div className="kpi-label">CLEAN MATCH RATE</div>
          <div className="kpi-value font-mono" style={{ color: '#34D399' }}>
            <AnimatedNumber value={(summary?.match_rate || 0.75) * 100} prefix="" decimals={1} />%
          </div>
          <div className="kpi-subtext">Deterministic & Verified Matches</div>
        </div>

        <div className="kpi-card spotlight-card">
          <div className="kpi-label">ANALYZED VARIANCE GAPS</div>
          <div className="kpi-value font-mono" style={{ color: '#FBBF24' }}>
            <AnimatedNumber value={metrics.varianceVolume} />
          </div>
          <div className="kpi-subtext">MDR Fee, Timing & Rounding Deltas</div>
        </div>

        <div className="kpi-card spotlight-card">
          <div className="kpi-label">QUARANTINED EXCEPTIONS</div>
          <div className="kpi-value font-mono" style={{ color: '#F87171' }}>
            <AnimatedNumber value={metrics.exceptionVolume} />
          </div>
          <div className="kpi-subtext">Isolated Unmatched Capital</div>
        </div>
      </div>

      {/* Breakdown Visualizer Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
        {/* Left: Volume Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="card spotlight-card"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
            e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
          }}
          style={{ padding: '20px' }}
        >
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <PieChart size={16} color="#8B5CF6" />
            <span>Capital Distribution Matrix</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Clean Matched Capital</span>
                <span className="font-mono" style={{ color: '#34D399', fontWeight: '700' }}>₹{metrics.cleanVolume.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${metrics.totalInflow > 0 ? (metrics.cleanVolume / metrics.totalInflow) * 100 : 0}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  style={{ height: '100%', background: '#34D399' }}
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Variance & Fee Discrepancy Capital</span>
                <span className="font-mono" style={{ color: '#FBBF24', fontWeight: '700' }}>₹{metrics.varianceVolume.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${metrics.totalInflow > 0 ? (metrics.varianceVolume / metrics.totalInflow) * 100 : 0}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                  style={{ height: '100%', background: '#FBBF24' }}
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Quarantined Orphan Risk</span>
                <span className="font-mono" style={{ color: '#F87171', fontWeight: '700' }}>₹{metrics.exceptionVolume.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${metrics.totalInflow > 0 ? (metrics.exceptionVolume / metrics.totalInflow) * 100 : 0}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                  style={{ height: '100%', background: '#F87171' }}
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Right: Key Quarantined Exceptions Stream */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card spotlight-card"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            e.currentTarget.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
            e.currentTarget.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
          }}
          style={{ padding: '20px' }}
        >
          <div style={{ fontSize: '13px', fontWeight: '800', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={16} color="#F87171" />
              <span>Critical Exceptions Watchlist</span>
            </div>
            <button
              onClick={() => setView('exceptions')}
              className="btn btn-secondary"
              style={{ padding: '3px 8px', fontSize: '11px' }}
            >
              View All ({transactions.filter(t => t.status === 'exception').length})
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              maxHeight: '260px',
              overflowY: 'auto',
              paddingRight: '4px'
            }}
          >
            {exceptionsList.map((exc) => {
              const amt = exc.bank_record?.amount || exc.matched_ledger_record?.gross_amount || 0;
              const isBankOrphan = exc.exception_side === 'bank' || !exc.matched_ledger_record;
              const dateStr = exc.bank_record?.date || exc.matched_ledger_record?.order_date || '';
              return (
                <motion.div
                  key={exc.record_id}
                  whileHover={{ x: 4, background: 'rgba(248, 113, 113, 0.08)' }}
                  onClick={() => {
                    setSelectedTxn(exc);
                    if (setSelectedTxnId) setSelectedTxnId(exc.record_id);
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--line-subtle)',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#F87171' }} />
                    <div>
                      <div className="font-mono" style={{ fontSize: '12px', fontWeight: '700', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {exc.record_id}
                        {dateStr && <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'normal' }}>• {dateStr}</span>}
                      </div>
                      <div style={{ fontSize: '10.5px', color: isBankOrphan ? '#A78BFA' : '#C4B5FD', marginTop: '1px', fontWeight: '600' }}>
                        {isBankOrphan ? 'Bank Orphan (Unclaimed Inflow)' : 'Ledger Orphan (Missing Payout)'}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="font-mono" style={{ fontSize: '13px', fontWeight: '800', color: '#F87171' }}>
                      ₹{amt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <span style={{ fontSize: '9.5px', color: 'var(--text-muted)' }}>Inspect Evidence →</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* Centered Transaction Inspector Modal */}
      <AnimatePresence>
        {selectedTxn && (
          <TransactionInspectorDrawer
            txn={selectedTxn}
            onClose={() => setSelectedTxn(null)}
            onAction={(actionType, txn) => {
              if (actionType === 'trace' && setSelectedTxnId && setView) {
                setSelectedTxnId(txn.record_id);
                setView('agents');
              } else if (actionType === 'erp-voucher' && setView) {
                setView('erp-vouchers');
              } else if (actionType === 'dispute' && setView) {
                setView('bank-disputes');
              }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
