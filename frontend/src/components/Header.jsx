import React from 'react';
import { Activity, RefreshCw, Sliders, Building2, Search, Download, ShieldCheck, Plus, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Header({ runId, status, summary, onRunNewBatch, isRecomputing, onOpenCommandPalette, onExportReport }) {
  const isRunning = status?.status === "running" || isRecomputing;

  return (
    <header className="top-navbar">
      {/* Left: Active Batch Context Crumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(255, 255, 255, 0.025)',
            border: '1px solid var(--line-subtle)',
            padding: '5px 10px',
            borderRadius: '7px'
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: isRunning ? '#FBBF24' : '#34D399',
              boxShadow: isRunning ? '0 0 6px #FBBF24' : '0 0 6px #34D399'
            }}
          />
          <span className="font-mono" style={{ fontSize: '12.5px', fontWeight: '700', color: '#F1F5F9' }}>
            {runId}
          </span>
          <span style={{ fontSize: '11px', color: isRunning ? '#FBBF24' : 'var(--text-muted)', fontWeight: '500' }}>
            {isRunning ? 'Processing...' : 'Verified & Sealed'}
          </span>
        </div>

        {summary?.current_threshold !== undefined && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--line-subtle)',
              padding: '5px 9px',
              borderRadius: '6px',
              fontSize: '11px',
              color: 'var(--text-muted)'
            }}
            title="Active Conformal Risk Cutoff (λ)"
          >
            <Sliders size={11} color="var(--brand-indigo)" />
            <span>λ cutoff:</span>
            <span className="font-mono" style={{ fontWeight: '700', color: '#818CF8' }}>
              {summary.current_threshold.toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {/* Center: Linear/Raycast-Style Command Palette Bar */}
      <div className="command-palette-btn" onClick={onOpenCommandPalette}>
        <Search size={13} style={{ opacity: 0.5 }} />
        <span style={{ flex: 1, textAlign: 'left', fontSize: '12px', color: 'var(--text-muted)' }}>
          Search transactions, UTRs, or jump to view...
        </span>
        <span className="command-shortcut-key">Ctrl K</span>
      </div>

      {/* Right: Clean Action Cluster */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {onExportReport && (
          <button
            className="btn-secondary"
            onClick={onExportReport}
            style={{ padding: '6px 12px', fontSize: '11.5px', borderRadius: '7px' }}
            title="Download Audit Dossier (.csv / .json)"
          >
            <Download size={13} />
            <span>Dossier Export</span>
          </button>
        )}

        <button
          className="btn-primary"
          onClick={onRunNewBatch}
          disabled={isRunning}
          style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '7px' }}
        >
          <RefreshCw size={12} className={isRunning ? 'animate-spin' : ''} />
          <span>New Batch</span>
        </button>
      </div>
    </header>
  );
}
