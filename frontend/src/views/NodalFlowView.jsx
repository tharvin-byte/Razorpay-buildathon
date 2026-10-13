import React, { useEffect, useMemo, useState } from 'react';
import { Building2 } from 'lucide-react';
import { api } from '../api';
import PageHeader from '../components/PageHeader';

const formatAmount = (value) => `₹${Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function NodalFlowView({ runId }) {
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([api.getSummary(runId), api.getTransactions(runId)])
      .then(([nextSummary, nextTransactions]) => {
        if (!active) return;
        setSummary(nextSummary);
        setTransactions(Array.isArray(nextTransactions) ? nextTransactions : []);
      })
      .catch((cause) => {
        console.error('Failed to load run overview:', cause);
        if (active) setError('Run data is unavailable. Reload the view to try again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [runId]);

  const bankAmounts = useMemo(() => {
    const bankRows = transactions.filter((item) => item.bank_record);
    const matched = bankRows.filter((item) => ['matched_clean', 'matched_with_discrepancy'].includes(item.status));
    const exceptions = bankRows.filter((item) => item.status === 'exception');
    return {
      observed: bankRows.reduce((total, item) => total + Number(item.bank_record.amount || 0), 0),
      matched: matched.reduce((total, item) => total + Number(item.bank_record.amount || 0), 0),
      exceptions: exceptions.reduce((total, item) => total + Number(item.bank_record.amount || 0), 0),
    };
  }, [transactions]);

  const metrics = summary ? [
    { label: 'Bank records matched', value: `${summary.bank_matched_records} / ${summary.total_bank_records}`, detail: 'Matched bank records / total bank records' },
    { label: 'Bank match rate', value: `${(summary.bank_match_rate * 100).toFixed(1)}%`, detail: 'Denominator: total bank records' },
    { label: 'Ledger coverage', value: `${summary.matched_ledger_records} / ${summary.eligible_ledger_records}`, detail: 'Matched / eligible ledger records' },
    { label: 'Overall result resolution', value: `${summary.resolved_result_records} / ${summary.total_result_records}`, detail: 'Resolved / total result records' },
  ] : [];

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1440px', margin: '0 auto' }}>
      <PageHeader
        icon={Building2}
        accentColor="#10B981"
        badges={[{ label: 'Computed from run records', variant: 'clean' }]}
        title="Run Reconciliation Overview"
        description="Shows recorded bank amounts and reconciliation counts for the selected run. Account flow, tax treatment, settlement timing, and regulatory status are not inferred."
      />

      {loading && <div role="status" style={{ padding: '24px', color: 'var(--text-muted)' }}>Loading run data…</div>}
      {error && <div role="alert" className="card" style={{ color: 'var(--semantic-danger)' }}>{error}</div>}
      {!loading && !error && summary && (
        <>
          <div className="kpi-grid" style={{ marginBottom: '20px' }}>
            {metrics.map((metric) => (
              <div className="kpi-card" key={metric.label}>
                <div className="kpi-label">{metric.label}</div>
                <div className="kpi-value font-mono">{metric.value}</div>
                <div className="kpi-subtext">{metric.detail}</div>
              </div>
            ))}
          </div>

          <section className="card" aria-labelledby="bank-amounts-heading">
            <h2 id="bank-amounts-heading" style={{ marginTop: 0, fontSize: '15px' }}>Recorded bank amounts</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Amounts sum bank records in this run; they do not represent escrow balances or payout instructions.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
              <div className="metric-card"><span className="metric-label">Observed bank amount</span><span className="metric-value font-mono">{formatAmount(bankAmounts.observed)}</span></div>
              <div className="metric-card"><span className="metric-label">Matched bank amount</span><span className="metric-value font-mono">{formatAmount(bankAmounts.matched)}</span></div>
              <div className="metric-card"><span className="metric-label">Bank exception amount</span><span className="metric-value font-mono">{formatAmount(bankAmounts.exceptions)}</span></div>
            </div>
          </section>

          <section className="card" aria-labelledby="discrepancy-counts-heading" style={{ marginTop: '16px' }}>
            <h2 id="discrepancy-counts-heading" style={{ marginTop: 0, fontSize: '15px' }}>Recorded discrepancy counts</h2>
            {Object.keys(summary.discrepancy_breakdown || {}).length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No discrepancy counts are available.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                {Object.entries(summary.discrepancy_breakdown).map(([kind, count]) => (
                  <div className="metric-card" key={kind}>
                    <span className="metric-label">{kind.replaceAll('_', ' ')}</span>
                    <span className="metric-value font-mono">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}