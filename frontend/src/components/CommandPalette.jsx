import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Layers, GitCompare, FileCheck, Scale, Cpu, MessageSquare, FileText, Sliders, AlertTriangle, AlertOctagon, Sparkles, RefreshCw, X, ArrowRight, CornerDownLeft } from 'lucide-react';

export default function CommandPalette({ isOpen, onClose, onNavigate, onRunNewBatch, onExportReport }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  const commandItems = [
    { id: 'transactions', title: 'Evidence Grid', group: 'Navigation', icon: Layers, shortcut: 'G' },
    { id: 'scenarios', title: 'Policy Scenarios & Dual Solver', group: 'Navigation', icon: GitCompare, shortcut: 'S' },
    { id: 'playground', title: 'Threshold Playground (CRC α ≤ 0.001)', group: 'Navigation', icon: Sliders, shortcut: 'P' },
    { id: 'erp-vouchers', title: 'ERP Double-Entry Vouchers (Tally/SAP)', group: 'Autonomous Action', icon: FileCheck, shortcut: 'V' },
    { id: 'bank-disputes', title: 'Bank Disputes & NPCI Claims', group: 'Autonomous Action', icon: Scale, shortcut: 'D' },
    { id: 'agents', title: 'Multi-Agent Trace & Math Layers', group: 'Intelligence', icon: Cpu, shortcut: 'T' },
    { id: 'assistant', title: 'AI Treasury Copilot & Chat', group: 'Intelligence', icon: MessageSquare, shortcut: 'C' },
    { id: 'discrepancies', title: 'Review 11 Discrepancy Variances', group: 'Decision Queue', icon: AlertTriangle, shortcut: 'R' },
    { id: 'exceptions', title: 'Inspect 22 Orphan Exceptions', group: 'Decision Queue', icon: AlertOctagon, shortcut: 'E' },
    { id: 'action-batch', title: 'Run New Synthetic Reconciliation Batch', group: 'Quick Actions', icon: RefreshCw, action: 'batch' },
    { id: 'action-export', title: 'Download Statutory Audit Dossier (JSON/ZIP)', group: 'Quick Actions', icon: FileText, action: 'export' }
  ];

  const filtered = commandItems.filter(item =>
    item.title.toLowerCase().includes(query.toLowerCase()) ||
    item.group.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else onClose(false); // toggle
      }
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          executeItem(filtered[selectedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filtered, selectedIndex]);

  const executeItem = (item) => {
    onClose();
    if (item.action === 'batch' && onRunNewBatch) {
      onRunNewBatch();
    } else if (item.action === 'export' && onExportReport) {
      onExportReport();
    } else if (onNavigate) {
      onNavigate(item.id);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(5, 8, 16, 0.7)',
          backdropFilter: 'blur(8px)',
          zIndex: 200,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          paddingTop: '12vh'
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, y: -10, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.95, y: -10, opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          style={{
            width: '600px',
            maxWidth: '92vw',
            background: 'var(--bg-surface)',
            border: '1px solid var(--line-strong)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-panel)',
            overflow: 'hidden'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search Header */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid var(--line-subtle)', gap: '10px' }}>
            <Search size={18} color="var(--brand-indigo)" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Type a command, search UTR, or navigate..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: '14px',
                outline: 'none',
                fontFamily: 'var(--font-sans)'
              }}
            />
            <button
              onClick={onClose}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Results List */}
          <div style={{ maxHeight: '340px', overflowY: 'auto', padding: '8px' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                No commands matching "{query}"
              </div>
            ) : (
              filtered.map((item, idx) => {
                const Icon = item.icon;
                const isSelected = idx === selectedIndex;
                return (
                  <div
                    key={item.id}
                    onClick={() => executeItem(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      background: isSelected ? 'rgba(115, 120, 255, 0.14)' : 'transparent',
                      color: isSelected ? '#fff' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.12s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '6px',
                        background: isSelected ? 'var(--brand-indigo)' : 'var(--bg-input)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: isSelected ? '#fff' : 'var(--brand-indigo)'
                      }}>
                        <Icon size={15} />
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '600' }}>{item.title}</div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>{item.group}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {item.shortcut && (
                        <span className="command-shortcut-key">{item.shortcut}</span>
                      )}
                      {isSelected && <CornerDownLeft size={14} color="var(--brand-indigo)" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Navigation Hints */}
          <div style={{ padding: '10px 16px', background: 'var(--bg-input)', borderTop: '1px solid var(--line-subtle)', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
            <span>Navigation: <b style={{ color: 'var(--text-secondary)' }}>↑ ↓</b> to move · <b style={{ color: 'var(--text-secondary)' }}>Enter</b> to select</span>
            <span><b style={{ color: 'var(--text-secondary)' }}>ESC</b> to dismiss</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
