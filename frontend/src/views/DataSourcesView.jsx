import React, { useState, useEffect } from 'react';
import { Database, FileSpreadsheet, Eye, Info, CheckCircle2, Layers, Download, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api';

export default function DataSourcesView({ runId }) {
  const [sources, setSources] = useState(null);
  const [activeTab, setActiveTab] = useState('bank');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSources();
  }, [runId]);

  const loadSources = async () => {
    setLoading(true);
    try {
      const data = await api.getSources(runId);
      setSources(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading data source schemas and ingested records...
      </div>
    );
  }

  const tabConfig = [
    { id: 'bank', label: 'Bank Statement', count: sources?.bank_statement?.rows, data: sources?.bank_statement, badge: 'HDFC Escrow' },
    { id: 'ledger', label: 'Internal Ledger', count: sources?.internal_ledger?.rows, data: sources?.internal_ledger, badge: 'ERP Sales' },
    { id: 'settle', label: 'Settlement Report', count: sources?.settlement_report?.rows, data: sources?.settlement_report, badge: 'Gateway Netting' }
  ];

  const currentSource = tabConfig.find(t => t.id === activeTab)?.data;

  return (
    <div style={{ padding: '28px', maxWidth: '1360px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge badge-clean">
            <Database size={12} /> Multi-Source Ingestion
          </span>
          <span className="badge badge-info font-mono">
            3 Active Sources Loaded
          </span>
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#fff', letterSpacing: '-0.4px', marginTop: '4px' }}>
          Data Sources & Schema Registry
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
          Inspect ingested multi-source tabular data streams, field data types, and sample banking/ledger records.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        {tabConfig.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={isActive ? 'btn-primary' : 'btn-secondary'}
              style={{
                padding: '10px 18px',
                fontSize: '12.5px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <FileSpreadsheet size={15} />
              <span>{tab.label}</span>
              <span className={`badge ${isActive ? 'badge-expected' : 'badge-clean'}`} style={{ fontSize: '10px', padding: '1px 6px' }}>
                {tab.count || 0} rows
              </span>
            </button>
          );
        })}
      </div>

      {/* Schema Columns Registry Card */}
      <AnimatePresence mode="wait">
        {currentSource && (
          <motion.div
            key={activeTab + '-schema'}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="card"
            style={{ marginBottom: '20px', padding: '18px 22px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                Schema Columns Registry ({currentSource.columns?.length || 0} Fields)
              </div>
              <span className="badge badge-info" style={{ fontSize: '10px' }}>
                Indexed O(1) Lookups
              </span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {currentSource.columns?.map((col, i) => (
                <span
                  key={col}
                  className="font-mono"
                  style={{
                    background: 'var(--bg-input)',
                    border: '1px solid var(--line-subtle)',
                    padding: '5px 12px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: 'var(--brand-indigo)'
                  }}
                >
                  {col}
                </span>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sample Records Table */}
      {currentSource?.sample && (
        <motion.div
          key={activeTab + '-table'}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="card"
          style={{ padding: '0', overflow: 'hidden' }}
        >
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '13px', fontWeight: '800', color: '#fff' }}>
              Sample Records Ingested ({currentSource.sample.length} of {currentSource.rows} Shown)
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Auto-Sanitized & Normalized
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  {currentSource.columns?.map((col) => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {currentSource.sample.map((row, idx) => (
                  <tr key={idx}>
                    {currentSource.columns?.map((col) => {
                      const val = row[col];
                      const isAmount = col.toLowerCase().includes('amount') || col.toLowerCase().includes('fee') || col.toLowerCase().includes('tax');
                      return (
                        <td key={col} className="font-mono" style={{ fontSize: '12px', color: isAmount ? '#fff' : 'var(--text-secondary)' }}>
                          {isAmount && typeof val === 'number'
                            ? `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                            : val !== null && val !== undefined
                            ? String(val)
                            : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
}
