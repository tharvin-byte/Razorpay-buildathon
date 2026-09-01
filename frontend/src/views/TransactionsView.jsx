import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  ChevronRight,
  LayoutGrid,
  List,
  Layers,
  ArrowUpDown,
  SlidersHorizontal,
  Sparkles,
  Eye,
  ArrowUp
} from 'lucide-react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { api } from '../api';
import TransactionInspectorDrawer from '../components/TransactionInspectorDrawer';

export default function TransactionsView({ runId, onSelectTxnForTrace, onNavigateTab, onToast }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
  const [showScrollTop, setShowScrollTop] = useState(false);
  const progressBarRef = useRef(null);
  const containerRef = useRef(null);

  // Hardware-accelerated smooth scroll tracker
  useEffect(() => {
    const scrollParent = containerRef.current?.closest('[style*="overflow"]') || window;
    let ticking = false;

    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const target = scrollParent === window ? document.documentElement : scrollParent;
          const scrollTop = target.scrollTop || window.scrollY || 0;
          const scrollHeight = (target.scrollHeight || document.documentElement.scrollHeight) - (target.clientHeight || window.innerHeight);

          if (progressBarRef.current && scrollHeight > 0) {
            const pct = Math.min(100, Math.max(0, (scrollTop / scrollHeight) * 100));
            progressBarRef.current.style.width = `${pct}%`;
          }

          setShowScrollTop(scrollTop > 240);
          ticking = false;
        });
        ticking = true;
      }
    };

    if (scrollParent && scrollParent !== window) {
      scrollParent.addEventListener('scroll', onScroll, { passive: true });
    }
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      if (scrollParent && scrollParent !== window) {
        scrollParent.removeEventListener('scroll', onScroll);
      }
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  const scrollToTop = () => {
    const scrollParent = containerRef.current?.closest('[style*="overflow"]');
    if (scrollParent && scrollParent.scrollTo) {
      scrollParent.scrollTo({ top: 0, behavior: 'smooth' });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    if (!runId) return;
    setLoading(true);
    const fetchFn = api.getTransactions || api.getResults;
    fetchFn.call(api, runId)
      .then((data) => {
        setTransactions(Array.isArray(data) ? data : (data?.transactions || []));
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setTransactions([]);
        setLoading(false);
      });
  }, [runId]);

  const filtered = transactions.filter((t) => {
    if (filterStatus === 'CLEAN' && t.status !== 'matched_clean') return false;
    if (filterStatus === 'DISCREPANCY' && t.status !== 'matched_with_discrepancy') return false;
    if (filterStatus === 'EXCEPTION' && t.status !== 'exception') return false;

    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const idMatch = t.record_id?.toLowerCase().includes(q);
    const narrMatch = (t.bank_record?.narration || t.ledger_record?.narration || '').toLowerCase().includes(q);
    const partyMatch = (t.bank_record?.counterparty_name || t.ledger_record?.counterparty_name || '').toLowerCase().includes(q);
    const utrMatch = (t.bank_record?.utr_number || t.ledger_record?.utr_number || '').toLowerCase().includes(q);
    const invMatch = (t.matched_ledger_record?.invoice_ref || t.ledger_record?.invoice_ref || '').toLowerCase().includes(q);
    return idMatch || narrMatch || partyMatch || utrMatch || invMatch;
  });

  const getAmount = (t) => t.bank_record?.amount ?? t.ledger_record?.amount ?? 0;
  const getCounterparty = (t) => t.bank_record?.counterparty_name || t.ledger_record?.counterparty_name || '';
  const getNarration = (t) => t.bank_record?.narration || t.ledger_record?.narration || '';
  const getDate = (t) => t.bank_record?.transaction_date || t.ledger_record?.entry_date || '';
  const getUTR = (t) => t.bank_record?.utr_number || t.ledger_record?.utr_number || '';

  const handleAction = (actionType, txn) => {
    if (actionType === 'trace' && onSelectTxnForTrace) {
      onSelectTxnForTrace(txn.record_id);
    } else if (actionType === 'erp-voucher' && onNavigateTab) {
      onNavigateTab('erp-vouchers');
    } else if (actionType === 'dispute' && onNavigateTab) {
      onNavigateTab('bank-disputes');
    }
  };

  const filterTabs = [
    { key: 'ALL', label: 'All Records', count: transactions.length },
    { key: 'CLEAN', label: 'Clean Matches', count: transactions.filter((t) => t.status === 'matched_clean').length },
    { key: 'DISCREPANCY', label: 'Discrepancies', count: transactions.filter((t) => t.status === 'matched_with_discrepancy').length },
    { key: 'EXCEPTION', label: 'Exceptions', count: transactions.filter((t) => t.status === 'exception').length }
  ];

  return (
    <LayoutGroup id="evidence-grid-group">
      {/* Top Floating Scroll Progress Indicator */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: 'rgba(255, 255, 255, 0.04)',
          zIndex: 99,
          margin: '-24px -32px 24px -32px',
          overflow: 'hidden'
        }}
      >
        <div
          ref={progressBarRef}
          style={{
            height: '100%',
            width: '0%',
            background: 'linear-gradient(90deg, #6366F1, #38BDF8, #34D399)',
            boxShadow: '0 0 10px rgba(99, 102, 241, 0.7)',
            transition: 'width 0.08s ease-out'
          }}
        />
      </div>

      <div ref={containerRef} style={{ padding: '0 32px 32px 32px', maxWidth: '1440px', margin: '0 auto', position: 'relative' }}>
        {/* Header & Controls Toolbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="badge badge-clean">
                <CheckCircle2 size={12} /> Evidence Grid
              </span>
              <span className="badge badge-expected">
                {filtered.length} of {transactions.length} Records
              </span>
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#fff', letterSpacing: '-0.3px', marginTop: '4px', margin: 0 }}>
              Multi-Source Evidence Studio & Uncertainty Matrix
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px', maxWidth: '850px', lineHeight: '1.4' }}>
              Real-time multi-ledger transaction matching stream with mathematical confidence decomposition and single-click dispute synthesis.
            </p>
          </div>

          {/* View Toggle & Search */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: '280px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search UTR, Invoice, Name..."
                className="input-custom"
                style={{ width: '100%', paddingLeft: '32px', fontSize: '12px' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Sliding Grid/Table Toggle */}
            <div style={{ display: 'inline-flex', background: 'var(--bg-input)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '2px', position: 'relative' }}>
              <button
                onClick={() => setViewMode('grid')}
                style={{
                  position: 'relative',
                  background: 'transparent',
                  border: 'none',
                  color: viewMode === 'grid' ? '#fff' : 'var(--text-muted)',
                  padding: '6px 12px',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '11px',
                  fontWeight: '700',
                  zIndex: 1,
                  transition: 'color 0.15s ease'
                }}
              >
                {viewMode === 'grid' && (
                  <motion.div
                    layoutId="activeViewModeIndicator"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(99, 102, 241, 0.28)',
                      border: '1px solid rgba(99, 102, 241, 0.5)',
                      borderRadius: '5px',
                      zIndex: -1
                    }}
                  />
                )}
                <LayoutGrid size={13} /> <span>Grid</span>
              </button>

              <button
                onClick={() => setViewMode('table')}
                style={{
                  position: 'relative',
                  background: 'transparent',
                  border: 'none',
                  color: viewMode === 'table' ? '#fff' : 'var(--text-muted)',
                  padding: '6px 12px',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  fontSize: '11px',
                  fontWeight: '700',
                  zIndex: 1,
                  transition: 'color 0.15s ease'
                }}
              >
                {viewMode === 'table' && (
                  <motion.div
                    layoutId="activeViewModeIndicator"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(99, 102, 241, 0.28)',
                      border: '1px solid rgba(99, 102, 241, 0.5)',
                      borderRadius: '5px',
                      zIndex: -1
                    }}
                  />
                )}
                <List size={13} /> <span>Table</span>
              </button>
            </div>
          </div>
        </div>

        {/* Sliding Pill Filter Tabs */}
        <div style={{ display: 'inline-flex', gap: '3px', marginBottom: '20px', background: 'rgba(255, 255, 255, 0.025)', padding: '3px', borderRadius: '8px', border: '1px solid var(--line-subtle)', position: 'relative' }}>
          {filterTabs.map((tab) => {
            const isActive = filterStatus === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setFilterStatus(tab.key)}
                style={{
                  position: 'relative',
                  padding: '6px 14px',
                  fontSize: '11.5px',
                  fontWeight: isActive ? '700' : '500',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  background: 'transparent',
                  color: isActive ? '#fff' : 'var(--text-secondary)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  zIndex: 1,
                  transition: 'color 0.15s ease'
                }}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeEvidenceTabIndicator"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(99, 102, 241, 0.28)',
                      border: '1px solid rgba(99, 102, 241, 0.5)',
                      borderRadius: '6px',
                      zIndex: -1
                    }}
                  />
                )}
                <span>{tab.label}</span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    opacity: isActive ? 1 : 0.6,
                    color: isActive ? '#A5B4FC' : 'inherit'
                  }}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Loading & Empty states */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
            Loading transactions...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
            No transactions match your search filter.
          </div>
        ) : viewMode === 'grid' ? (
          /* Scroll-Triggered whileInView Cards Grid */
          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}
          >
            {filtered.map((t, idx) => {
              const scorePct = Math.round((t.confidence_score || 0) * 100);
              const isClean = t.status === 'matched_clean';
              const isDisc = t.status === 'matched_with_discrepancy';
              const isSelected = selectedTxn?.record_id === t.record_id;
              const amt = getAmount(t);
              const counterparty = getCounterparty(t) || t.record_id;
              const narration = getNarration(t);
              const utr = getUTR(t);

              return (
                <motion.div
                  key={t.record_id}
                  initial={{ opacity: 0, y: 32, scale: 0.97 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true, margin: '-30px' }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  whileHover={{ y: -5, scale: 1.015 }}
                  whileTap={{ scale: 0.985 }}
                  onClick={() => setSelectedTxn(t)}
                  className="card"
                  style={{
                    cursor: 'pointer',
                    padding: '18px',
                    background: isSelected ? 'var(--bg-elevated)' : undefined,
                    borderColor: isSelected ? '#6366F1' : 'rgba(255, 255, 255, 0.04)',
                    boxShadow: isSelected ? '0 0 20px rgba(99, 102, 241, 0.25)' : undefined,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '210px',
                    transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
                  }}
                >
                  <div>
                    {/* Top Row: Title + Status Badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div style={{ maxWidth: '240px' }}>
                        <div style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {counterparty}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {String(getDate(t)).slice(0, 10)} · {t.source_type?.toUpperCase()}
                        </div>
                      </div>

                      <span className={`badge ${isClean ? 'badge-clean' : isDisc ? 'badge-discrepancy' : 'badge-exception'}`} style={{ fontSize: '9.5px', padding: '2px 7px' }}>
                        {isClean ? 'Analyzed' : isDisc ? 'Variance' : 'Exception'}
                      </span>
                    </div>

                    {/* Amount and Narrative Quote */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '10px 0 6px 0' }}>
                      <span className="font-mono" style={{ fontSize: '16.5px', fontWeight: '800', color: 'var(--text-primary)' }}>
                        ₹{amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                      {t.matched_ledger_record?.invoice_ref && (
                        <span className="tag-pill font-mono" style={{ fontSize: '9.5px' }}>
                          {t.matched_ledger_record.invoice_ref}
                        </span>
                      )}
                    </div>

                    <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: '1.4', marginBottom: '12px', minHeight: '32px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {t.explanation || t.exception_reason || narration || 'Reconciled successfully.'}
                    </p>
                  </div>

                  <div>
                    {/* Confidence Bar */}
                    <div style={{ background: 'var(--bg-input)', padding: '8px 10px', borderRadius: 'var(--radius-sm)', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        <span>Confidence Score</span>
                        <span className="font-mono" style={{ color: isClean ? '#34D399' : isDisc ? '#FBBF24' : '#FB7185' }}>
                          {scorePct}%
                        </span>
                      </div>
                      <div className="confidence-bar-track" style={{ height: '5px', overflow: 'hidden', borderRadius: '3px' }}>
                        <motion.div
                          className="confidence-bar-fill"
                          initial={{ width: 0 }}
                          whileInView={{ width: `${scorePct}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                          style={{
                            height: '100%',
                            background: isClean ? 'linear-gradient(90deg, #6366F1, #10B981)' : isDisc ? 'linear-gradient(90deg, #6366F1, #F59E0B)' : 'linear-gradient(90deg, #6366F1, #F43F5E)'
                          }}
                        />
                      </div>
                    </div>

                    {/* Tag Pills */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {utr && <span className="tag-pill font-mono" style={{ fontSize: '10px' }}>UTR</span>}
                        {t.discrepancies?.length > 0 && <span className="tag-pill font-mono" style={{ fontSize: '10px', color: '#FBBF24' }}>{t.discrepancies[0].type}</span>}
                      </div>

                      <span style={{ fontSize: '10.5px', color: '#818CF8', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        Inspect <ChevronRight size={12} />
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          /* Dense Table View with In-View Slide-ins */
          <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Record ID / Date</th>
                  <th>Amount</th>
                  <th>Counterparty / Narration</th>
                  <th>Matched Target</th>
                  <th>Confidence</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const scorePct = Math.round((t.confidence_score || 0) * 100);
                  const isClean = t.status === 'matched_clean';
                  const isDisc = t.status === 'matched_with_discrepancy';
                  const isSelected = selectedTxn?.record_id === t.record_id;
                  const amt = getAmount(t);
                  const counterparty = getCounterparty(t) || t.record_id;
                  const narration = getNarration(t);

                  return (
                    <motion.tr
                      key={t.record_id}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.22 }}
                      onClick={() => setSelectedTxn(t)}
                      style={{
                        cursor: 'pointer',
                        background: isSelected ? 'rgba(99, 102, 241, 0.12)' : undefined
                      }}
                    >
                      <td>
                        <div className="font-mono" style={{ fontWeight: '700', color: '#fff' }}>{t.record_id}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{String(getDate(t)).slice(0, 10)}</div>
                      </td>
                      <td className="font-mono font-bold" style={{ color: '#fff' }}>
                        ₹{amt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td>
                        <div style={{ fontWeight: '600' }}>{counterparty}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {narration}
                        </div>
                      </td>
                      <td>
                        {t.matched_ledger_record ? (
                          <div>
                            <span className="font-mono text-cyan" style={{ fontSize: '12px', fontWeight: '700' }}>
                              {t.matched_ledger_record.ledger_id}
                            </span>
                            {t.matched_ledger_record.invoice_ref && (
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                Inv: {t.matched_ledger_record.invoice_ref}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Unmatched (Orphan)</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '60px', height: '4px', background: 'var(--bg-input)', borderRadius: '2px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${scorePct}%`,
                                height: '100%',
                                background: isClean ? '#10B981' : isDisc ? '#F59E0B' : '#EF4444'
                              }}
                            />
                          </div>
                          <span className="font-mono" style={{ fontSize: '11px', fontWeight: '700' }}>{scorePct}%</span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${isClean ? 'badge-clean' : isDisc ? 'badge-discrepancy' : 'badge-exception'}`} style={{ fontSize: '10px' }}>
                          {isClean ? 'Clean' : isDisc ? 'Discrepancy' : 'Exception'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                          onClick={(e) => { e.stopPropagation(); setSelectedTxn(t); }}
                        >
                          Inspect
                        </button>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Floating Scroll to Top Quick Spring Button */}
        <AnimatePresence>
          {showScrollTop && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
              whileHover={{ scale: 1.1, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={scrollToTop}
              style={{
                position: 'fixed',
                bottom: '28px',
                right: '28px',
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #6366F1, #4F46E5)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                boxShadow: '0 8px 24px rgba(99, 102, 241, 0.4), 0 0 12px rgba(99, 102, 241, 0.2)',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 900
              }}
              title="Scroll to top"
            >
              <ArrowUp size={18} />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Centered Transaction Inspector Modal */}
        <TransactionInspectorDrawer
          transaction={selectedTxn}
          txn={selectedTxn}
          onClose={() => setSelectedTxn(null)}
          onAction={handleAction}
          onActionClick={handleAction}
          onToast={onToast}
        />
      </div>
    </LayoutGroup>
  );
}
