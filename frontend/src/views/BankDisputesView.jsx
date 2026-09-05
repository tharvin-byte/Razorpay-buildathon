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
  AlertTriangle,
  FileCheck2,
  X,
  Eye,
  ChevronDown,
  ChevronRight,
  User,
  Calendar,
  IndianRupee,
  Info
} from 'lucide-react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { api } from '../api';
import PageHeader from '../components/PageHeader';

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
      if (progress < 1) window.requestAnimationFrame(step);
    };

    window.requestAnimationFrame(step);
  }, [value]);

  return (
    <span>
      ₹{displayValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  );
}

// Converts a raw NPCI code like "NPCI_UP_104_UNREPRESENTED_CREDIT"
// into a plain-English one-liner that anyone can understand
function humanizeNpciCode(code = '', claimType = '') {
  if (!code) return claimType || 'Unknown dispute type';
  const c = code.toUpperCase();
  if (c.includes('SETTLEMENT_TIMEOUT') || c.includes('MISSING') || claimType.includes('Missing'))
    return 'Customer order completed, but bank settlement payout never arrived (T+2 elapsed)';
  if (c.includes('UNREPRESENTED_CREDIT') || c.includes('ORPHAN') || claimType.includes('Orphan'))
    return 'Bank credited funds that have no matching merchant order or invoice';
  if (c.includes('FEE_OVERCHARGE') || c.includes('MDR') || claimType.includes('Fee'))
    return 'Bank/gateway deducted higher fees than the contractual MDR rate';
  if (c.includes('DUPLICATE') || claimType.includes('Duplicate'))
    return 'Same transaction appears to have been processed or debited twice';
  if (c.includes('TIMING') || c.includes('LAG'))
    return 'Settlement received outside the agreed clearinghouse SLA window';
  if (c.includes('AMOUNT_MISMATCH'))
    return 'Amount received from bank differs from the invoiced order amount';
  return claimType || code.replace(/_/g, ' ').replace(/\bNPCI\b/, '').trim();
}

// Short 3-4 word label for the card badge
function claimBadgeLabel(code = '', claimType = '') {
  const c = code.toUpperCase();
  if (c.includes('SETTLEMENT_TIMEOUT') || c.includes('MISSING') || claimType.includes('Missing')) return 'Missing Payout';
  if (c.includes('UNREPRESENTED_CREDIT') || c.includes('ORPHAN') || claimType.includes('Orphan')) return 'Unclaimed Credit';
  if (c.includes('FEE') || c.includes('MDR') || claimType.includes('Fee')) return 'Fee Overcharge';
  if (c.includes('DUPLICATE') || claimType.includes('Duplicate')) return 'Duplicate Debit';
  if (c.includes('TIMING')) return 'Late Settlement';
  if (c.includes('AMOUNT_MISMATCH')) return 'Amount Gap';
  return 'Dispute';
}

function claimBadgeColor(code = '', claimType = '') {
  const c = (code + ' ' + claimType).toUpperCase();
  if (c.includes('SETTLEMENT_TIMEOUT') || c.includes('MISSING'))
    return { bg: 'rgba(139,92,246,0.14)', border: 'rgba(139,92,246,0.4)', text: '#A78BFA' };
  if (c.includes('FEE') || c.includes('MDR'))
    return { bg: 'rgba(167,139,250,0.15)', border: 'rgba(167,139,250,0.4)', text: '#C084FC' };
  if (c.includes('DUPLICATE'))
    return { bg: 'rgba(239,68,68,0.14)', border: 'rgba(239,68,68,0.38)', text: '#F87171' };
  return { bg: 'rgba(245,158,11,0.14)', border: 'rgba(245,158,11,0.38)', text: '#F59E0B' };
}

export default function BankDisputesView({ runId, onToast }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [showTechDetails, setShowTechDetails] = useState(false);

  useEffect(() => {
    if (!runId) return;
    setLoading(true);
    api.getDisputes(runId)
      .then((res) => { setData(res); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [runId]);

  // Reset tech details when modal closes
  useEffect(() => {
    if (!selectedClaim) setShowTechDetails(false);
  }, [selectedClaim]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && selectedClaim) setSelectedClaim(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClaim]);

  const handleCopyLetter = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    if (onToast) onToast({ title: 'Dispute Notice Copied', message: `Notice for claim ${id} copied to clipboard.` });
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleDownloadNotice = (claim) => {
    const blob = new Blob([claim.formal_letter_text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bank_dispute_notice_${claim.claim_id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    if (onToast) onToast({ title: 'Notice Downloaded', message: `Exported dispute letter for ${claim.claim_id}` });
  };

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{
          width: '36px', height: '36px', border: '3px solid rgba(245, 158, 11, 0.2)',
          borderTopColor: '#F59E0B', borderRadius: '50%', margin: '0 auto 16px',
          animation: 'spin 1s linear infinite'
        }} />
        <p style={{ fontWeight: '600' }}>Loading bank dispute claims...</p>
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
    if (filterType === 'orphan') return c.claim_type?.includes('Orphan') || c.npci_reason_code?.includes('UNREPRESENTED');
    if (filterType === 'missing') return c.claim_type?.includes('Missing') || c.npci_reason_code?.includes('SETTLEMENT');
    if (filterType === 'fee') return c.claim_type?.includes('Fee') || c.claim_type?.includes('MDR') || c.claim_type?.includes('Duplicate') || c.npci_reason_code?.includes('FEE') || c.npci_reason_code?.includes('MDR') || c.npci_reason_code?.includes('DUP');
    return true;
  });

  const filterTabs = [
    { id: 'all', label: 'All Claims', count: claims.length },
    { id: 'orphan', label: 'Unclaimed Credits', count: claims.filter(c => c.npci_reason_code?.includes('UNREPRESENTED') || c.claim_type?.includes('Orphan')).length },
    { id: 'missing', label: 'Missing Payouts', count: claims.filter(c => c.npci_reason_code?.includes('SETTLEMENT') || c.claim_type?.includes('Missing')).length },
    { id: 'fee', label: 'Fee Overcharges & Duplicates', count: claims.filter(c => c.npci_reason_code?.includes('MDR') || c.npci_reason_code?.includes('DUP') || c.claim_type?.includes('Fee') || c.claim_type?.includes('Duplicate')).length }
  ];

  return (
    <LayoutGroup id="bank-disputes-group">
      <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto' }}>

        <PageHeader
          icon={Scale}
          accentColor="#F59E0B"
          badges={[
            { label: 'Bank Dispute Recovery Bot', variant: 'discrepancy' },
            { label: 'NPCI & ISO 20022 Chargeback Standards', variant: 'expected' },
          ]}
          title="Bank Disputes & Claims"
          description="These are bank transactions that arrived in your account but couldn't be matched to any merchant order or settlement record. Each claim below is a pre-drafted legal notice you can send directly to your bank to recover the money."
          rightSlot={
            <span className="badge badge-clean" style={{ fontSize: '11px', padding: '6px 12px' }}>
              <Lock size={12} /> Cryptographic Proofs Attached
            </span>
          }
        />

        {/* KPI Cards */}
        <motion.div
          initial="hidden" animate="show"
          variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.07 } } }}
          className="kpi-grid"
          style={{ marginBottom: '24px' }}
        >
          <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} whileHover={{ y: -2 }} className="kpi-card">
            <div className="kpi-label">Money to Recover</div>
            <div className="kpi-value font-mono" style={{ color: '#F59E0B' }}>
              <AnimatedNumber value={data.total_recoverable_capital || 0} />
            </div>
            <div className="kpi-subtext">Total across all unmatched deposits &amp; fee overcharges</div>
          </motion.div>

          <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} whileHover={{ y: -2 }} className="kpi-card">
            <div className="kpi-label">Dispute Notices Ready</div>
            <div className="kpi-value font-mono" style={{ color: '#fff' }}>
              {data.total_claims || claims.length}
            </div>
            <div className="kpi-subtext">Pre-drafted letters ready to send to your bank</div>
          </motion.div>

          <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} whileHover={{ y: -2 }} className="kpi-card">
            <div className="kpi-label">MAX STATUTORY SLA</div>
            <div className="kpi-value" style={{ color: '#A78BFA' }}>2 Working Days</div>
            <div className="kpi-subtext">NPCI mandated resolution window</div>
          </motion.div>

          <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} whileHover={{ y: -2 }} className="kpi-card">
            <div className="kpi-label">Evidence Attached</div>
            <div className="kpi-value" style={{ color: '#34D399', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>100%</span>
              <span className="badge badge-clean" style={{ fontSize: '9.5px', padding: '1px 6px' }}>Verified</span>
            </div>
            <div className="kpi-subtext">Every claim has proof your bank can't dispute</div>
          </motion.div>
        </motion.div>

        {/* Claims List */}
        <div className="card" style={{ padding: '0', overflow: 'hidden', border: '1px solid var(--border-subtle)', marginBottom: '24px' }}>

          {/* Filter bar */}
          <div style={{ padding: '14px 18px', background: 'rgba(255,255,255,0.015)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'inline-flex', gap: '2px', background: 'rgba(255,255,255,0.03)', padding: '2px', borderRadius: '7px', border: '1px solid var(--border-subtle)', position: 'relative' }}>
              {filterTabs.map((t) => {
                const isActive = filterType === t.id;
                return (
                  <button key={t.id} onClick={() => setFilterType(t.id)} style={{ position: 'relative', padding: '6px 14px', borderRadius: '5px', fontSize: '11.5px', fontWeight: isActive ? '700' : '500', border: 'none', cursor: 'pointer', background: 'transparent', color: isActive ? '#fff' : 'var(--text-muted)', zIndex: 1, transition: 'color 0.15s ease' }}>
                    {isActive && (
                      <motion.div layoutId="activeDisputeTabIndicator" transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                        style={{ position: 'absolute', inset: 0, background: 'rgba(245,158,11,0.25)', border: '1px solid rgba(245,158,11,0.5)', borderRadius: '5px', zIndex: -1 }} />
                    )}
                    <span>{t.label} ({t.count})</span>
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
              <span style={{ color: '#fff', fontWeight: '700' }}>{filteredClaims.length}</span> claims ready to file
            </div>
          </div>

          {/* Claim Cards Grid */}
          <div style={{ padding: '18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '14px' }}>
            {filteredClaims.map((c) => {
              const badgeColors = claimBadgeColor(c.npci_reason_code);
              const plainReason = humanizeNpciCode(c.npci_reason_code, c.claim_type);
              const badge = claimBadgeLabel(c.npci_reason_code, c.claim_type);
              // Extract merchant/counterparty from formal letter if available
              const merchantName = c.counterparty_name || c.merchant_name || null;

              return (
                <motion.div
                  key={c.claim_id}
                  onClick={() => setSelectedClaim(c)}
                  whileHover={{ y: -3, scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="card"
                  style={{ padding: '18px', cursor: 'pointer', borderColor: 'var(--border-subtle)', background: 'var(--bg-card)', position: 'relative', display: 'flex', flexDirection: 'column', gap: '12px', minHeight: '170px', transition: 'all 0.18s ease' }}
                  onMouseOver={(e) => { e.currentTarget.style.borderColor = 'rgba(245,158,11,0.4)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.35), 0 0 16px rgba(245,158,11,0.08)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  {/* Top row: badge + amount */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '10.5px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.4px', color: badgeColors.text, background: badgeColors.bg, border: `1px solid ${badgeColors.border}`, padding: '3px 8px', borderRadius: '5px' }}>
                      {badge}
                    </span>
                    <span className="font-mono" style={{ fontSize: '18px', fontWeight: '800', color: '#F59E0B' }}>
                      ₹{c.disputed_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {/* Plain-English reason — the most important line */}
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#F1F5F9', lineHeight: '1.4', marginBottom: '4px' }}>
                      {plainReason}
                    </div>
                    {merchantName && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                        <User size={11} />
                        <span>{merchantName}</span>
                      </div>
                    )}
                  </div>

                  {/* Bottom row: bank name + inspect */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '11px', marginTop: 'auto' }}>
                    <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Building2 size={11} />
                      {c.bank_name}
                    </span>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '3px 10px', fontSize: '11px', borderRadius: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      onClick={(e) => { e.stopPropagation(); setSelectedClaim(c); }}
                    >
                      <Eye size={11} />
                      <span>View &amp; Send</span>
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Modal */}
        <AnimatePresence>
          {selectedClaim && (() => {
            const plainReason = humanizeNpciCode(selectedClaim.npci_reason_code, selectedClaim.claim_type);
            const badge = claimBadgeLabel(selectedClaim.npci_reason_code, selectedClaim.claim_type);
            const badgeColors = claimBadgeColor(selectedClaim.npci_reason_code);
            const merchantName = selectedClaim.counterparty_name || selectedClaim.merchant_name || null;

            return (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
                onClick={() => setSelectedClaim(null)}
                style={{ position: 'fixed', inset: 0, background: 'rgba(4,7,14,0.82)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
              >
                <motion.div
                  initial={{ scale: 0.94, opacity: 0, y: 12 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.94, opacity: 0, y: 12 }}
                  transition={{ type: 'spring', damping: 28, stiffness: 400 }}
                  onClick={(e) => e.stopPropagation()}
                  className="card"
                  style={{ width: '100%', maxWidth: '820px', maxHeight: '90vh', overflowY: 'auto', background: '#0D1322', border: '1px solid rgba(245,158,11,0.35)', boxShadow: '0 24px 60px rgba(0,0,0,0.6), 0 0 30px rgba(245,158,11,0.12)', borderRadius: 'var(--radius-xl)', padding: '24px' }}
                >
                  {/* Modal Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '16px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '20px' }}>
                    <div>
                      <span style={{ fontSize: '10.5px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.4px', color: badgeColors.text, background: badgeColors.bg, border: `1px solid ${badgeColors.border}`, padding: '3px 8px', borderRadius: '5px', display: 'inline-block', marginBottom: '8px' }}>
                        {badge}
                      </span>
                      {/* Plain English headline */}
                      <h2 style={{ fontSize: '19px', fontWeight: '800', color: '#fff', margin: '0 0 4px', lineHeight: '1.3' }}>
                        {plainReason}
                      </h2>
                      {merchantName && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                          <User size={12} /> {merchantName}
                          <span style={{ color: 'var(--text-muted)', margin: '0 2px' }}>·</span>
                          <Building2 size={12} /> {selectedClaim.bank_name}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setSelectedClaim(null)}
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', borderRadius: '7px', padding: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                      onMouseOver={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                      onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                      title="Close (Esc)"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Key facts — 3 readable tiles */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
                    <div style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 'var(--radius-md)', padding: '12px 14px' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', marginBottom: '4px' }}>Amount in Dispute</div>
                      <div className="font-mono" style={{ fontSize: '20px', fontWeight: '800', color: '#F59E0B' }}>
                        ₹{selectedClaim.disputed_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '12px 14px' }}>
                      <div className="kpi-label" style={{ marginBottom: '4px' }}>NPCI STATUTORY DEADLINE</div>
                      <div style={{ fontSize: '15px', fontWeight: '700', color: '#A78BFA' }}>Within 2 Working Days</div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>NPCI Harmonization Mandate</div>
                    </div>

                    <div style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 'var(--radius-md)', padding: '12px 14px' }}>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', marginBottom: '4px' }}>Your UTR Reference</div>
                      <div className="font-mono" style={{ fontSize: '12px', fontWeight: '700', color: '#34D399', wordBreak: 'break-all' }}>
                        {selectedClaim.utr_number}
                      </div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>Quote this in all correspondence</div>
                    </div>
                  </div>

                  {/* What should I do? — A simple instruction */}
                  <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: '20px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <Info size={16} color="#8B5CF6" style={{ flexShrink: 0, marginTop: '1px' }} />
                    <div>
                      <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#fff', marginBottom: '4px' }}>What should I do with this?</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                        Copy or download the notice below and send it to your bank's nodal officer by email or registered post. Include the UTR number (<span className="font-mono" style={{ color: '#34D399' }}>{selectedClaim.utr_number}</span>) in the subject line. The bank is legally required to respond within 2 working days under NPCI guidelines.
                      </div>
                    </div>
                  </div>

                  {/* The notice text */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Ready-to-Send Dispute Notice
                    </div>
                    <pre
                      className="font-mono"
                      style={{ background: '#0B0F19', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '16px', fontSize: '11px', color: 'var(--text-primary)', lineHeight: '1.6', maxHeight: '240px', overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}
                    >
                      {selectedClaim.formal_letter_text}
                    </pre>
                  </div>

                  {/* Technical Details — collapsed by default */}
                  <div style={{ marginBottom: '20px' }}>
                    <button
                      onClick={() => setShowTechDetails(v => !v)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0', color: 'var(--text-muted)', fontSize: '11.5px', fontWeight: '600' }}
                    >
                      {showTechDetails ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      Technical Details (NPCI code &amp; cryptographic proof)
                    </button>

                    <AnimatePresence>
                      {showTechDetails && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          style={{ overflow: 'hidden' }}
                        >
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', paddingTop: '10px' }}>
                            <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', marginBottom: '4px' }}>NPCI Reason Code</div>
                              <div className="font-mono" style={{ fontSize: '10.5px', color: '#DDD6FE', wordBreak: 'break-all' }}>
                                {selectedClaim.npci_reason_code}
                              </div>
                            </div>
                            <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', marginBottom: '4px' }}>SHA-256 Merkle Proof Hash</div>
                              <div className="font-mono" style={{ fontSize: '10px', color: '#34D399', wordBreak: 'break-all' }}>
                                {selectedClaim.merkle_proof_hash}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Action Footer */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
                    <motion.button
                      whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                      className="btn btn-secondary"
                      style={{ padding: '8px 16px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                      onClick={() => handleCopyLetter(selectedClaim.formal_letter_text, selectedClaim.claim_id)}
                    >
                      {copiedId === selectedClaim.claim_id ? <Check size={13} color="#34D399" /> : <Copy size={13} />}
                      <span>{copiedId === selectedClaim.claim_id ? 'Copied!' : 'Copy Notice'}</span>
                    </motion.button>

                    <motion.button
                      whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                      className="btn btn-primary"
                      style={{ padding: '8px 18px', fontSize: '12px', background: 'linear-gradient(135deg, #F59E0B, #D97706)', border: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
                      onClick={() => handleDownloadNotice(selectedClaim)}
                    >
                      <Download size={13} />
                      <span>Download &amp; Send</span>
                    </motion.button>
                  </div>
                </motion.div>
              </motion.div>
            );
          })()}
        </AnimatePresence>
      </div>
    </LayoutGroup>
  );
}
