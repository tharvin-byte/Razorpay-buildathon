import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Layers,
  GitCompare,
  FileCheck,
  Scale,
  Cpu,
  MessageSquare,
  FileText,
  Sliders,
  AlertTriangle,
  AlertOctagon,
  Sparkles,
  RefreshCw,
  X,
  ArrowRight,
  CornerDownLeft,
  Database,
  Building2,
  BarChart3,
  ShieldCheck,
  Upload
} from 'lucide-react';

export default function CommandPalette({
  isOpen,
  onClose,
  onNavigate,
  setView,
  onRunNewBatch,
  onExportReport,
  currentView,
  summary,
  runId
}) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  const navigateFn = setView || onNavigate;

  const commandItems = [
    { id: 'transactions', title: 'Evidence Grid & Uncertainty Matrix', group: 'Navigation', icon: Layers, shortcut: 'G' },
    { id: 'nodal', title: 'Escrow Settlement & Nodal Flow', group: 'Navigation', icon: Building2, shortcut: 'N' },
    { id: 'scenarios', title: 'Policy & Sensitivity Studio (CRC α ≤ 0.001)', group: 'Navigation', icon: Sliders, shortcut: 'S' },
    { id: 'erp-vouchers', title: 'ERP Double-Entry Vouchers (Tally/SAP)', group: 'Autonomous Action', icon: FileCheck, shortcut: 'V' },
    { id: 'bank-disputes', title: 'Bank Disputes & NPCI Claims', group: 'Autonomous Action', icon: Scale, shortcut: 'D' },
    { id: 'rules', title: 'Auto-Resolution Policy Engine', group: 'Autonomous Action', icon: Sparkles, shortcut: 'R' },
    { id: 'discrepancies', title: 'Review Discrepancy Variances', group: 'Decision Queue', icon: AlertTriangle, shortcut: 'Q' },
    { id: 'exceptions', title: 'Inspect Quarantined Orphan Exceptions', group: 'Decision Queue', icon: AlertOctagon, shortcut: 'E' },
    { id: 'agents', title: 'Multi-Agent Trace & Math Layers', group: 'Intelligence', icon: Cpu, shortcut: 'T' },
    { id: 'assistant', title: 'AI Treasury Copilot & Chat', group: 'Intelligence', icon: MessageSquare, shortcut: 'C' },
    { id: 'analytics', title: 'Executive Operations & Telemetry', group: 'Intelligence', icon: BarChart3, shortcut: 'A' },
    { id: 'sources', title: 'Data Sources & Schema Registry', group: 'System', icon: Database, shortcut: 'O' },
    { id: 'compliance', title: 'Audit Trail & Merkle Compliance Seal', group: 'System', icon: ShieldCheck, shortcut: 'M' },
    { id: 'upload', title: 'Upload & Ingest New Batch', group: 'System', icon: Upload, shortcut: 'U' },
    { id: 'report', title: 'Statutory Audit Dossier Export', group: 'System', icon: FileText, shortcut: 'F' },
    { id: 'action-batch', title: 'Run New Synthetic Reconciliation Batch', group: 'Quick Actions', icon: RefreshCw, action: 'batch' },
    { id: 'action-export', title: 'Download Statutory Audit Dossier (PDF)', group: 'Quick Actions', icon: FileText, action: 'export' }
  ];

  const filtered = commandItems.filter(item =>
    item.title.toLowerCase().includes(query.toLowerCase()) ||
    item.group.toLowerCase().includes(query.toLowerCase()) ||
    item.id.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const executeItem = (item) => {
    onClose();
    if (item.action === 'batch') {
      if (onRunNewBatch) onRunNewBatch();
    } else if (item.action === 'export') {
      if (onExportReport) onExportReport();
    } else {
      if (navigateFn) {
        navigateFn(item.id);
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
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
          background: 'rgba(5, 8, 16, 0.75)',
          backdropFilter: 'blur(10px)',
          zIndex: 9999,
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
            width: '640px',
            maxWidth: '92vw',
            background: 'linear-gradient(180deg, #111C33 0%, #0B1324 100%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '14px',
            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 30px rgba(99, 102, 241, 0.15)',
            overflow: 'hidden'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search Header */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', gap: '12px' }}>
            <Search size={18} color="#A78BFA" />
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
                fontFamily: 'var(--font-sans)',
                fontWeight: '500'
              }}
            />
            <button
              onClick={onClose}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
            >
              <X size={16} />
            </button>
          </div>

          {/* Results List */}
          <div style={{ maxHeight: '360px', overflowY: 'auto', padding: '8px' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
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
                      borderRadius: '8px',
                      background: isSelected ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                      border: `1px solid ${isSelected ? 'rgba(139, 92, 246, 0.45)' : 'transparent'}`,
                      color: isSelected ? '#fff' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                      marginBottom: '2px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '30px', height: '30px', borderRadius: '6px',
                        background: isSelected ? '#7C3AED' : 'rgba(255, 255, 255, 0.04)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: isSelected ? '#fff' : '#A78BFA'
                      }}>
                        <Icon size={16} />
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: isSelected ? '700' : '600' }}>{item.title}</div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>{item.group}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {item.shortcut && (
                        <span style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '10px',
                          color: 'var(--text-muted)',
                          background: 'rgba(255, 255, 255, 0.06)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '4px',
                          padding: '2px 6px'
                        }}>
                          {item.shortcut}
                        </span>
                      )}
                      {isSelected && <CornerDownLeft size={14} color="#818CF8" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Navigation Hints */}
          <div style={{ padding: '10px 18px', background: 'rgba(5, 8, 16, 0.6)', borderTop: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
            <span>Navigation: <b style={{ color: '#fff' }}>↑ ↓</b> to move · <b style={{ color: '#fff' }}>Enter</b> to select</span>
            <span><b style={{ color: '#fff' }}>ESC</b> to dismiss</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
