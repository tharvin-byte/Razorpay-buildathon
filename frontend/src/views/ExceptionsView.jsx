import React, { useState, useEffect } from 'react';
import {
  AlertOctagon,
  ShieldAlert,
  ArrowRight,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { api } from '../api';

export default function ExceptionsView({ runId, setView, setSelectedTxnId }) {
  const [exceptions, setExceptions] = useState([]);
  const [sideFilter, setSideFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExceptions();
  }, [runId, sideFilter]);

  const loadExceptions = async () => {
    setLoading(true);
    try {
      const data = await api.getExceptions(runId, sideFilter);
      setExceptions(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setExceptions([]);
    } finally {
      setLoading(false);
    }
  };

  const ledgerOrphans = exceptions.filter(e => e.exception_side === 'ledger' || e.source_type === 'ledger');
  const bankOrphans = exceptions.filter(e => e.exception_side === 'bank' || e.source_type === 'bank');

  const filterTabs = [
    { id: '', label: 'All Exceptions', count: exceptions.length },
    { id: 'ledger', label: 'Critical Ledger Orphans', count: ledgerOrphans.length },
    { id: 'bank', label: 'Bank Orphans (Unidentified)', count: bankOrphans.length }
  ];

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1440px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span className="badge badge-exception" style={{ fontSize: '11px' }}>
            <ShieldAlert size={13} /> Zero Guessing Policy
          </span>
          <span className="badge badge-clean">
            <ShieldCheck size={13} /> 100% Audit Traceable
          </span>
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#fff', letterSpacing: '-0.4px' }}>
          Honest Exception & Orphan Registry
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', marginTop: '4px', maxWidth: '850px', lineHeight: '1.5' }}>
          In financial accounting, forcing a guess is a regulatory violation. ReconX isolates unresolved records into two auditable buckets: <strong>Ledger Orphans</strong> (unsettled receivables) and <strong>Bank Orphans</strong> (unidentified credits).
        </p>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'inline-flex', gap: '4px', marginBottom: '24px', background: 'rgba(255, 255, 255, 0.025)', padding: '3px', borderRadius: '8px', border: '1px solid var(--line-subtle)' }}>
        {filterTabs.map((tab) => {
          const isActive = sideFilter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSideFilter(tab.id)}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: isActive ? '700' : '500',
                border: 'none',
                cursor: 'pointer',
                background: isActive ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                color: isActive ? '#fff' : 'var(--text-muted)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
            >
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
      ) : exceptions.length === 0 ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <CheckCircle2 size={32} color="#10B981" style={{ margin: '0 auto 10px auto' }} />
          <h3 style={{ color: '#fff', fontSize: '16px', fontWeight: '700' }}>All Exceptions Addressed</h3>
          <p style={{ fontSize: '12px', marginTop: '4px' }}>Zero pending quarantined orphan records.</p>
        </div>
      ) : (
        /* Exception Cards Grid */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '18px' }}>
          {exceptions.map((exc) => {
            const isLedgerOrphan = exc.exception_side === 'ledger' || exc.source_type === 'ledger';
            const amt = exc.bank_record?.amount ?? exc.matched_ledger_record?.gross_amount ?? 0;

            return (
              <div
                key={exc.record_id}
                className="card"
                style={{
                  borderColor: isLedgerOrphan ? 'rgba(251, 90, 116, 0.45)' : 'var(--line-subtle)',
                  background: isLedgerOrphan ? 'linear-gradient(135deg, rgba(251, 90, 116, 0.06), var(--bg-card))' : 'var(--bg-card)',
                  borderTop: isLedgerOrphan ? '3px solid var(--semantic-danger)' : '3px solid var(--line-strong)',
                  padding: '18px'
                }}
              >
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

                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '10.5px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Reasoning & Evidence Gap:
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.45' }}>
                    {exc.explanation}
                  </p>
                </div>

                <div style={{ borderTop: '1px solid var(--line-subtle)', paddingTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '5px 10px', fontSize: '11px', borderRadius: '5px', display: 'flex', alignItems: 'center', gap: '5px' }}
                    onClick={() => {
                      setSelectedTxnId(exc.record_id);
                      setView('transactions');
                    }}
                  >
                    <span>Inspect Audit File</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
