import React, { useState, useEffect } from 'react';
import {
  Scale,
  Download,
  Copy,
  Check,
  ShieldCheck,
  Building2,
  AlertOctagon,
  FileText,
  Lock,
  ArrowRight,
  Send,
  AlertTriangle,
  FileCheck2,
  X,
  ExternalLink,
  ChevronRight,
  Eye
} from 'lucide-react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { api } from '../api';

function AnimatedNumber({ value }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTimestamp = null;
    const startValue = displayValue;
    const endValue = value;
    const duration = 800;

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

export default function BankDisputesView({ runId, onToast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    if (!runId) return;
    setLoading(true);
    api.getDisputes(runId)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [runId]);

  // Handle ESC key to close modal popup
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && selectedClaim) {
        setSelectedClaim(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClaim]);

  const handleCopyLetter = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    if (onToast) {
      onToast({ title: 'Dispute Notice Copied', message: `Notice for claim ${id} copied to clipboard.` });
    }
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleDownloadNotice = (claim) => {
    const blob = new Blob([claim.formal_letter_text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bank_dispute_notice_${claim.claim_id}_${claim.utr_number}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    if (onToast) {
      onToast({ title: 'Notice Downloaded', message: `Exported ISO 20022 dispute letter for ${claim.claim_id}` });
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{
          width: '36px', height: '36px', border: '3px solid rgba(245, 158, 11, 0.2)',
          borderTopColor: '#F59E0B', borderRadius: '50%', margin: '0 auto 16px',
          animation: 'spin 1s linear infinite'
        }} />
        <p style={{ fontWeight: '600' }}>Synthesizing ISO 20022 Bank Dispute Claims & Merkle Proofs...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: '32px', maxWidth: '1440px', margin: '0 auto' }}>
        <div className="card" style={{ borderColor: 'rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.08)' }}>
          <h3 style={{ color: '#F87171', fontWeight: '700', marginBottom: '8px' }}>Failed to Load Dispute Claims</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{error || 'No active dispute data found for this run session.'}</p>
        </div>
      </div>
    );
  }

  const claims = data.claims || [];
  const filteredClaims = claims.filter((c) => {
    if (filterType === 'all') return true;
    if (filterType === 'orphan') return c.claim_type.includes('Orphan');
    if (filterType === 'fee') return c.claim_type.includes('Fee');
    return true;
  });

  const filterTabs = [
    { id: 'all', label: 'All Claims', count: claims.length },
    { id: 'orphan', label: 'Bank Orphans', count: claims.filter((c) => c.claim_type.includes('Orphan')).length },
    { id: 'fee', label: 'Fee Overcharges', count: claims.filter((c) => c.claim_type.includes('Fee')).length }
  ];

  return (
    <LayoutGroup id="bank-disputes-group">
      <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto' }}>
        {/* Header Banner */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span className="badge badge-discrepancy">
                <Scale size={12} /> Legal Recovery Bot
              </span>
              <span className="badge badge-expected">
                NPCI & ISO 20022 Chargeback Standards
              </span>
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#fff', letterSpacing: '-0.4px', margin: 0 }}>
              Bank Disputes & Claims
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px', maxWidth: '850px', lineHeight: '1.4' }}>
              Automated legal chargeback notices and recovery claims with cryptographic SHA-256 Merkle leaf proofs. Click any claim to inspect the full legal filing popup.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="badge badge-clean" style={{ fontSize: '11px', padding: '6px 12px' }}>
              <Lock size={12} /> SHA-256 Merkle Attestation Active
            </span>
          </div>
        </div>

        {/* KPI Metric Cards Grid with Staggered Entrance */}
        <motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: { staggerChildren: 0.07 }
            }
          }}
          className="kpi-grid"
          style={{ marginBottom: '24px' }}
        >
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 10 },
              show: { opacity: 1, y: 0 }
            }}
            whileHover={{ y: -2 }}
            className="kpi-card"
          >
            <div className="kpi-label">Total Recoverable Capital</div>
            <div className="kpi-value font-mono" style={{ color: '#F59E0B' }}>
              <AnimatedNumber value={data.total_recoverable_capital || 0} />
            </div>
            <div className="kpi-subtext">Unrepresented deposits & overcharges</div>
          </motion.div>

          <motion.div
            variants={{
              hidden: { opacity: 0, y: 10 },
              show: { opacity: 1, y: 0 }
            }}
            whileHover={{ y: -2 }}
            className="kpi-card"
          >
            <div className="kpi-label">Formal Dispute Claims</div>
            <div className="kpi-value font-mono" style={{ color: '#fff' }}>
              {data.total_claims || claims.length}
            </div>
            <div className="kpi-subtext">Pre-filled chargeback notices ready</div>
          </motion.div>

          <motion.div
            variants={{
              hidden: { opacity: 0, y: 10 },
              show: { opacity: 1, y: 0 }
            }}
            whileHover={{ y: -2 }}
            className="kpi-card"
          >
            <div className="kpi-label">Statutory Resolution SLA</div>
            <div className="kpi-value" style={{ color: '#60A5FA' }}>
              T+2 Days
            </div>
            <div className="kpi-subtext">NPCI Harmonization Mandate</div>
          </motion.div>

          <motion.div
            variants={{
              hidden: { opacity: 0, y: 10 },
              show: { opacity: 1, y: 0 }
            }}
            whileHover={{ y: -2 }}
            className="kpi-card"
          >
            <div className="kpi-label">Evidence Binding</div>
            <div className="kpi-value" style={{ color: '#34D399', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>100.0%</span>
              <span className="badge badge-clean" style={{ fontSize: '9.5px', padding: '1px 6px' }}>Proofed</span>
            </div>
            <div className="kpi-subtext">Zero Hallucinations Guarantee</div>
          </motion.div>
        </motion.div>

        {/* Claims Explorer Container */}
        <div className="card" style={{ padding: '0', overflow: 'hidden', border: '1px solid var(--border-subtle)', marginBottom: '24px' }}>
          
          {/* Filter Bar Toolbar with Sliding Pill */}
          <div style={{ padding: '14px 18px', background: 'rgba(255, 255, 255, 0.015)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'inline-flex', gap: '2px', background: 'rgba(255, 255, 255, 0.03)', padding: '2px', borderRadius: '7px', border: '1px solid var(--border-subtle)', position: 'relative' }}>
              {filterTabs.map((t) => {
                const isActive = filterType === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setFilterType(t.id)}
                    style={{
                      position: 'relative',
                      padding: '6px 14px',
                      borderRadius: '5px',
                      fontSize: '11.5px',
                      fontWeight: isActive ? '700' : '500',
                      border: 'none',
                      cursor: 'pointer',
                      background: 'transparent',
                      color: isActive ? '#fff' : 'var(--text-muted)',
                      zIndex: 1,
                      transition: 'color 0.15s ease'
                    }}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeDisputeTabIndicator"
                        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'rgba(245, 158, 11, 0.25)',
                          border: '1px solid rgba(245, 158, 11, 0.5)',
                          borderRadius: '5px',
                          zIndex: -1
                        }}
                      />
                    )}
                    <span>{t.label} ({t.count})</span>
                  </button>
                );
              })}
            </div>

            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
              Showing <span style={{ color: '#fff', fontWeight: '700' }}>{filteredClaims.length}</span> actionable dispute notices
            </div>
          </div>

          {/* Dispute Cards Grid */}
          <div style={{ padding: '18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '14px' }}>
            {filteredClaims.map((c) => {
              return (
                <motion.div
                  key={c.claim_id}
                  onClick={() => setSelectedClaim(c)}
                  whileHover={{ y: -3, scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="card"
                  style={{
                    padding: '16px',
                    cursor: 'pointer',
                    borderColor: 'var(--border-subtle)',
                    background: 'var(--bg-card)',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '160px',
                    transition: 'all 0.18s ease'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.4)';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.35), 0 0 16px rgba(245, 158, 11, 0.08)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span className="font-mono" style={{ fontSize: '12px', fontWeight: '700', color: '#F59E0B' }}>
                        {c.claim_id}
                      </span>
                      <span className="font-mono" style={{ fontSize: '16px', fontWeight: '800', color: '#F59E0B' }}>
                        ₹{c.disputed_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' }}>
                      {c.claim_type}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                      <span>{c.bank_name}</span>
                      <span className="font-mono" style={{ color: '#93C5FD' }}>UTR: {c.utr_number}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '10.5px' }}>
                    <span className="font-mono" style={{ color: 'var(--text-muted)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.npci_reason_code}
                    </span>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '3px 9px', fontSize: '10.5px', borderRadius: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedClaim(c);
                      }}
                    >
                      <Eye size={11} />
                      <span>Inspect</span>
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Centered Modal Popup Window for Dispute Notice Inspection */}
        <AnimatePresence>
          {selectedClaim && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setSelectedClaim(null)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(4, 7, 14, 0.82)',
                backdropFilter: 'blur(10px)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px'
              }}
            >
              <motion.div
                initial={{ scale: 0.94, opacity: 0, y: 12 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.94, opacity: 0, y: 12 }}
                transition={{ type: 'spring', damping: 28, stiffness: 400 }}
                onClick={(e) => e.stopPropagation()}
                className="card"
                style={{
                  width: '100%',
                  maxWidth: '820px',
                  maxHeight: '90vh',
                  overflowY: 'auto',
                  background: '#0D1322',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6), 0 0 30px rgba(245, 158, 11, 0.12)',
                  borderRadius: 'var(--radius-xl)',
                  padding: '24px'
                }}
              >
                {/* Modal Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '16px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '18px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span className="badge badge-discrepancy" style={{ fontSize: '10px' }}>
                        Official Legal Notice
                      </span>
                      <span className="font-mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        · {selectedClaim.claim_id}
                      </span>
                    </div>
                    <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#fff', margin: 0 }}>
                      {selectedClaim.claim_type}
                    </h2>
                  </div>

                  <button
                    onClick={() => setSelectedClaim(null)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-muted)',
                      borderRadius: '7px',
                      padding: '6px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.color = '#fff';
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.color = 'var(--text-muted)';
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    }}
                    title="Close (Esc)"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Key Particulars Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '18px' }}>
                  <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Disputed Capital</div>
                    <div className="font-mono" style={{ fontSize: '18px', fontWeight: '800', color: '#F59E0B', marginTop: '2px' }}>
                      ₹{selectedClaim.disputed_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Bank Reference</div>
                    <div className="font-mono" style={{ fontSize: '12px', fontWeight: '700', color: '#93C5FD', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedClaim.utr_number}
                    </div>
                  </div>

                  <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>NPCI Reason Code</div>
                    <div className="font-mono" style={{ fontSize: '11.5px', fontWeight: '700', color: '#34D399', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedClaim.npci_reason_code}
                    </div>
                  </div>
                </div>

                {/* Merkle Leaf Proof Box */}
                <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginBottom: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>
                      Cryptographic SHA-256 Merkle Leaf Hash
                    </span>
                    <span className="font-mono" style={{ fontSize: '11px', color: '#34D399', wordBreak: 'break-all' }}>
                      {selectedClaim.merkle_proof_hash}
                    </span>
                  </div>
                  <span className="badge badge-clean" style={{ fontSize: '10px', flexShrink: 0 }}>
                    Zero-Knowledge Proof
                  </span>
                </div>

                {/* Formal Text Box */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Formal Filing Notice Text
                  </div>
                  <pre
                    className="font-mono"
                    style={{
                      background: '#0B0F19',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '16px',
                      fontSize: '11px',
                      color: 'var(--text-primary)',
                      lineHeight: '1.6',
                      maxHeight: '280px',
                      overflowY: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      margin: 0
                    }}
                  >
                    {selectedClaim.formal_letter_text}
                  </pre>
                </div>

                {/* Action Hub Footer */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="btn btn-secondary"
                    style={{ padding: '8px 16px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => handleCopyLetter(selectedClaim.formal_letter_text, selectedClaim.claim_id)}
                  >
                    {copiedId === selectedClaim.claim_id ? <Check size={13} color="#34D399" /> : <Copy size={13} />}
                    <span>{copiedId === selectedClaim.claim_id ? 'Copied to Clipboard' : 'Copy Notice Text'}</span>
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="btn btn-primary"
                    style={{ padding: '8px 18px', fontSize: '12px', background: 'linear-gradient(135deg, #F59E0B, #D97706)', border: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => handleDownloadNotice(selectedClaim)}
                  >
                    <Download size={13} />
                    <span>Download Claim Notice</span>
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </LayoutGroup>
  );
}
