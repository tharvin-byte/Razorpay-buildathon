import React, { useEffect, useState } from 'react';
import { Copy, Fingerprint } from 'lucide-react';
import { api } from '../api';
import PageHeader from '../components/PageHeader';

export default function AuditTrailView({ runId }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.getSummary(runId)
      .then((data) => active && setSummary(data))
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [runId]);

  const digest = summary?.merkle_root_hash;
  const copyDigest = async () => {
    if (!digest) return;
    await navigator.clipboard.writeText(digest);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div style={{ padding: 28, maxWidth: 1100, margin: '0 auto' }}>
      <PageHeader
        icon={Fingerprint}
        title="Run Digest and Summary"
        description="The digest is computed from this run's result rows. It is not externally anchored and does not prove source completeness or immutable storage."
      />
      {loading ? <div className="card" style={{ padding: 20 }}>Loading run summary…</div> : null}
      {error ? <div className="card" role="alert" style={{ padding: 20 }}>{error}</div> : null}
      {summary && (
        <>
          <section className="card" style={{ padding: 22, marginBottom: 16 }}>
            <h2>SHA-256 result digest</h2>
            <code style={{ display: 'block', overflowWrap: 'anywhere' }}>{digest || 'Not available'}</code>
            <button className="btn btn-secondary" onClick={copyDigest} disabled={!digest} style={{ marginTop: 12 }}>
              <Copy size={14} /> {copied ? 'Copied' : 'Copy digest'}
            </button>
            <p>Run {runId} · {summary.total_bank_records} bank records · {summary.total_ledger_records} ledger records</p>
          </section>
          <section className="card" style={{ padding: 22, marginBottom: 16 }}>
            <h2>Observed run metrics</h2>
            <p>Bank match rate: {(summary.bank_match_rate * 100).toFixed(1)}% ({summary.bank_matched_records} / {summary.total_bank_records} bank records)</p>
            <p>Ledger coverage: {(summary.ledger_coverage_rate * 100).toFixed(1)}% ({summary.matched_ledger_records} / {summary.eligible_ledger_records} eligible ledger records)</p>
            <p>Overall resolution: {(summary.overall_resolution_rate * 100).toFixed(1)}% ({summary.resolved_result_records} / {summary.total_result_records} result records)</p>
          </section>
          <section className="card" style={{ padding: 22 }}>
            <h2>Execution event log</h2>
            <p>This application does not persist an append-only event log. Transaction traces are available only where the engine recorded trace steps.</p>
          </section>
        </>
      )}
    </div>
  );
}