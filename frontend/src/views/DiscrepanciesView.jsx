import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, Percent, RefreshCcw, Layers, Hash, ArrowRight, CheckCircle2, TrendingDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../api';

export default function DiscrepanciesView({ runId, setView, setSelectedTxnId }) {
  const [discrepancies, setDiscrepancies] = useState([]);
  const [discFilter, setDiscFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDiscrepancies();
  }, [runId, discFilter]);

  const loadDiscrepancies = async () => {
    setLoading(true);
    try {
      const data = await api.getDiscrepancies(runId, discFilter);
      setDiscrepancies(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
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

  return (
    <div style={{ padding: '28px', maxWidth: '1360px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span className="badge badge-discrepancy">
            <AlertTriangle size={13} /> Legit Business Variances
          </span>
          <span className="badge badge-expected">
            Not Broken Systems
          </span>
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#fff', letterSpacing: '-0.4px' }}>
          Audited Discrepancy & Root Cause Explorer
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px', maxWidth: '850px', lineHeight: '1.5' }}>
          Real payment records diverge due to legitimate business causes: MDR fee deductions before bank transfer, clearinghouse batch timing cycles, partial merchant refunds, and lump-sum batch netting.
        </p>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {discTypes.map((dt) => {
          const isActive = discFilter === dt.id;
          return (
            <button
              key={dt.id}
              onClick={() => setDiscFilter(dt.id)}
              className={isActive ? 'btn-primary' : 'btn-secondary'}
              style={{
                padding: '6px 14px',
                borderRadius: 'var(--radius-full)',
                fontSize: '12px'
              }}
            >
              {dt.label}
            </button>
          );
        })}
      </div>

      {/* Discrepancy Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '18px' }}>
        {discrepancies.map((dTxn, idx) => {
          const bankAmt = dTxn.bank_record?.amount ?? 0;
          const ledgerAmt = dTxn.matched_ledger_record?.gross_amount ?? 0;

          return (
            <motion.div
              key={dTxn.record_id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.02, duration: 0.18 }}
              className="card"
              style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderTop: '2px solid var(--semantic-warning)' }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span className="font-mono" style={{ fontSize: '14px', fontWeight: '800', color: '#fff' }}>
                    {dTxn.record_id}
                  </span>
                  <span className="badge badge-discrepancy">
                    {(dTxn.confidence_score * 100).toFixed(0)}% Matched
                  </span>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '8px',
                  background: 'var(--bg-input)',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '14px',
                  fontSize: '12px'
                }}>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '10.5px', textTransform: 'uppercase' }}>Bank Nodal Credit</div>
                    <div className="font-mono" style={{ fontWeight: '800', color: 'var(--semantic-success)', fontSize: '15px', marginTop: '2px' }}>
                      ₹{bankAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '10.5px', textTransform: 'uppercase' }}>Ledger Gross Expected</div>
                    <div className="font-mono" style={{ fontWeight: '800', color: 'var(--brand-indigo)', fontSize: '15px', marginTop: '2px' }}>
                      ₹{ledgerAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                  {dTxn.discrepancies.map((disc, dIdx) => (
                    <div
                      key={dIdx}
                      style={{
                        background: 'rgba(246, 183, 60, 0.08)',
                        border: '1px solid rgba(246, 183, 60, 0.25)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '10px 12px',
                        fontSize: '12px',
                        color: 'var(--semantic-warning)'
                      }}
                    >
                      <div style={{ fontWeight: '800', textTransform: 'uppercase', fontSize: '10px', marginBottom: '3px', letterSpacing: '0.5px' }}>
                        {disc.type.replace('_', ' ')}
                      </div>
                      <div style={{ lineHeight: '1.4', color: 'var(--text-secondary)' }}>{disc.description}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ borderTop: '1px solid var(--line-subtle)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Ref: {dTxn.matched_ledger_record ? dTxn.matched_ledger_record.ledger_entry_id : (dTxn.matched_ledger_ids ? `${dTxn.matched_ledger_ids.length} batch entries` : '—')}
                </span>
                <button
                  className="btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '11px' }}
                  onClick={() => {
                    setSelectedTxnId(dTxn.record_id);
                    setView('transactions');
                  }}
                >
                  <span>Evidence Trail</span>
                  <ArrowRight size={12} />
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
