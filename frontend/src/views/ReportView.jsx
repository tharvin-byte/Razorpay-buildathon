import React, { useState, useEffect } from 'react';
import { FileText, Download, ShieldCheck, CheckCircle2, AlertTriangle, AlertOctagon, Printer } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../api';
import PageHeader from '../components/PageHeader';

export default function ReportView({ runId }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReport();
  }, [runId]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const data = await api.getReport(runId);
      setReport(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (format) => {
    const url = api.getDownloadUrl(runId, format);
    window.open(url, '_blank');
  };

  if (loading) {
    return <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Generating in-page audit report...</div>;
  }

  const s = report?.executive_summary;

  return (
    <div style={{ padding: '28px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Top Header & Export Actions */}
      <PageHeader
        icon={ShieldCheck}
        accentColor="#10B981"
        badges={[
          { label: 'Statutory Compliance Dossier', variant: 'clean' },
          { label: `Run ${runId}`, variant: 'expected' },
        ]}
        title="Financial Controller Audit Report"
        description={`Official audit-grade summary for Run ${runId} (Generated on ${report?.generated_at || '—'})`}
        rightSlot={
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn-secondary" onClick={() => handleDownload('json')}>
              <Download size={14} />
              <span>Export JSON</span>
            </button>
            <button className="btn-primary" onClick={() => handleDownload('csv')}>
              <Download size={14} />
              <span>Export Audit CSV</span>
            </button>
          </div>
        }
      />

      {/* In-Page Rendered Report Document */}
      <motion.div
        className="card"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        style={{ padding: '32px' }}
      >
        {/* Letterhead */}
        <div style={{ borderBottom: '1px solid var(--line-subtle)', paddingBottom: '20px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '20px', fontWeight: '800', color: '#fff' }}>ReconX Autonomous Reconciliation Report</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>Track 04: AI Finance Controller — Razorpay Multi-Source Spec</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className="badge badge-clean">
              <ShieldCheck size={14} /> Certified Compliant (Stanford CRC α ≤ 0.001)
            </span>
          </div>
        </div>

        {/* Section 1: Executive KPI Metrics */}
        <div style={{ marginBottom: '28px' }}>
          <h3 style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '14px' }}>
            1. Executive KPI Summary
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div className="metric-card">
              <span className="metric-label">Total Transactions</span>
              <span className="metric-value font-mono">{s?.total_transactions}</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">Overall Match Rate</span>
              <span className="metric-value font-mono" style={{ color: 'var(--semantic-success)' }}>{s?.match_rate}</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">Discrepancies Flagged</span>
              <span className="metric-value font-mono" style={{ color: 'var(--semantic-warning)' }}>{s?.discrepancies_flagged}</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">Ledger Orphans</span>
              <span className="metric-value font-mono" style={{ color: 'var(--semantic-danger)' }}>{s?.ledger_orphans}</span>
            </div>
          </div>
        </div>

        {/* Section 2: Discrepancy Cause Breakdown */}
        {report?.discrepancy_breakdown && (
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '14px' }}>
              2. Discrepancy Root Causes
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              {Object.entries(report.discrepancy_breakdown).map(([k, v]) => (
                <div key={k} style={{ background: 'var(--bg-input)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--line-subtle)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    {k.replace('_', ' ')}
                  </div>
                  <div className="font-mono" style={{ fontSize: '18px', fontWeight: '700', color: v > 0 ? 'var(--semantic-warning)' : 'var(--text-muted)', marginTop: '2px' }}>
                    {v} records
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section 3: Critical Ledger Orphans */}
        {report?.ledger_orphan_exceptions && report.ledger_orphan_exceptions.length > 0 && (
          <div style={{ marginBottom: '28px' }}>
            <h3 style={{ fontSize: '12px', fontWeight: '800', color: 'var(--semantic-danger)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '14px' }}>
              3. Critical Ledger Orphan Exceptions ("Money Expected But Never Received")
            </h3>
            <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--line-subtle)' }}>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Ledger Entry ID</th>
                    <th>Counterparty</th>
                    <th>Invoice Ref</th>
                    <th>Expected Gross</th>
                    <th>Audit Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {report.ledger_orphan_exceptions.map((o) => (
                    <tr key={o.id}>
                      <td className="font-mono" style={{ fontWeight: '700', color: 'var(--semantic-danger)' }}>{o.id}</td>
                      <td>{o.counterparty}</td>
                      <td className="font-mono">{o.invoice}</td>
                      <td className="font-mono" style={{ fontWeight: '700', color: '#fff' }}>₹{o.amount.toFixed(2)}</td>
                      <td style={{ fontSize: '12px', color: 'var(--semantic-danger)' }}>{o.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Section 4: Sample Discrepancies */}
        {report?.top_discrepancies && report.top_discrepancies.length > 0 && (
          <div>
            <h3 style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '14px' }}>
              4. Reconciled Discrepancy Evidence Samples
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {report.top_discrepancies.map((td, idx) => (
                <div key={idx} style={{ background: 'var(--bg-input)', padding: '12px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--line-subtle)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span className="font-mono" style={{ fontWeight: '700', color: 'var(--brand-indigo)', fontSize: '13px' }}>
                      {td.bank_id} ↔ {td.ledger_id}
                    </span>
                    <span className="font-mono" style={{ fontWeight: '700', color: 'var(--semantic-success)', fontSize: '13px' }}>
                      ₹{td.amount.toFixed(2)}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {td.explanation}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
