import React, { useEffect, useState } from 'react';
import { FileText, AlertTriangle } from 'lucide-react';
import { api } from '../api';
import PageHeader from '../components/PageHeader';

export default function BankDisputesView({ runId }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api.getSummary(runId)
      .then((value) => { if (active) setSummary(value); })
      .catch((cause) => {
        console.error('Failed to load dispute review status:', cause);
        if (active) setError('Run data is unavailable.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [runId]);

  const exceptionCount = summary
    ? summary.exception_bank_count + summary.exception_ledger_count
    : null;

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1100px', margin: '0 auto' }}>
      <PageHeader
        icon={FileText}
        accentColor="#F59E0B"
        badges={[{ label: 'Dispute drafting unavailable', variant: 'expected' }]}
        title="Dispute Review"
        description="The available source data does not establish contractual or regulatory filing rules. ReconX does not generate legal notices, recovery claims, or response deadlines."
      />
      {loading && <div role="status" className="card">Loading run review status…</div>}
      {error && <div role="alert" className="card">{error}</div>}
      {!loading && !error && summary && (
        <section className="card" aria-live="polite">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={18} color="#F59E0B" />
            <h2 style={{ margin: 0, fontSize: '15px' }}>Records available for investigation: {exceptionCount}</h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 0 }}>
            These counts reflect unmatched reconciliation records. They do not establish that funds are recoverable or that a bank or network has breached an obligation. Review the underlying records and applicable procedures before taking action.
          </p>
        </section>
      )}
    </div>
  );
}