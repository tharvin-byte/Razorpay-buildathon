import React, { useState } from 'react';
import { Sliders, CheckCircle2, AlertTriangle, ShieldCheck, Zap, Layers, Play, Check, ArrowRight, Shield, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ScenariosView({ runId, onApplyScenario }) {
  const [activeScenario, setActiveScenario] = useState('conservative');

  const scenarios = [
    {
      id: 'conservative',
      name: 'Scenario A: Stanford Conformal Risk Policy (α ≤ 0.001)',
      badge: 'Certified Safe · Default',
      badgeColor: '#10B981',
      description: 'High statistical precision (96.5%). Strict UTR and fee validation. Zero duplicate-claiming allowed.',
      threshold: 0.75,
      tolerance: '±0.00 (Zero Paisa Tolerance)',
      itemsCount: 70,
      breakdown: { clean: 47, disc: 11, exc: 12 },
      cleanRate: '70.7%',
      unblockedVolume: '₹14,85,200',
      quarantinedVolume: '₹2,10,400',
      clusters: [
        { title: 'UPI Instant P2M Settlements', count: 32, status: 'Prioritize (Clean)', score: 98, color: '#10B981' },
        { title: 'Payment Gateway Fee Variances (MDR 1.5%)', count: 11, status: 'Consider (Auto-Voucher)', score: 88, color: '#F59E0B' },
        { title: 'Settlement Batch Timing Lag (T+1/T+2)', count: 8, status: 'Prioritize (Clean)', score: 92, color: '#10B981' },
        { title: 'Unrepresented Bank Credits (Orphans)', count: 7, status: 'Quarantine (Dispute Claim)', score: 35, color: '#F43F5E' },
        { title: 'Same-Amount Duplicate Traps', count: 5, status: 'Quarantine (Double Claim)', score: 28, color: '#F43F5E' },
        { title: 'Many-to-One Batch Payouts', count: 7, status: 'Prioritize (Resolved)', score: 91, color: '#10B981' }
      ]
    },
    {
      id: 'accelerated',
      name: 'Scenario B: Accelerated Auto-Settlement (Permissive)',
      badge: 'High Inflow · Auto-Post',
      badgeColor: '#6366F1',
      description: 'Permissive acceptance threshold (0.65). Automatically posts minor paisa differences to variance accounts.',
      threshold: 0.65,
      tolerance: '±15.00 Auto-Rebalance',
      itemsCount: 70,
      breakdown: { clean: 54, disc: 12, exc: 4 },
      cleanRate: '85.7%',
      unblockedVolume: '₹16,45,600',
      quarantinedVolume: '₹50,000',
      clusters: [
        { title: 'UPI Instant P2M Settlements', count: 32, status: 'Prioritize (Clean)', score: 98, color: '#10B981' },
        { title: 'Payment Gateway Fee Variances (MDR 1.5%)', count: 11, status: 'Auto-Post to ERP', score: 88, color: '#6366F1' },
        { title: 'Settlement Batch Timing Lag (T+1/T+2)', count: 11, status: 'Prioritize (Clean)', score: 92, color: '#10B981' },
        { title: 'Unrepresented Bank Credits (Orphans)', count: 7, status: 'Quarantine (Dispute Claim)', score: 35, color: '#F43F5E' },
        { title: 'Same-Amount Duplicate Traps', count: 5, status: 'Quarantine (Double Claim)', score: 28, color: '#F43F5E' },
        { title: 'Many-to-One Batch Payouts', count: 4, status: 'Prioritize (Resolved)', score: 91, color: '#10B981' }
      ]
    }
  ];

  return (
    <div style={{ padding: '32px', maxWidth: '1280px', margin: '0 auto' }}>
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span className="badge badge-expected">
            <Layers size={13} /> Multi-Policy Scenario Studio
          </span>
          <span className="badge badge-clean">
            Veloquity Dual-Policy Solver
          </span>
        </div>
        <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#fff', letterSpacing: '-0.5px' }}>
          Reconciliation Scenario & Policy Decision Comparison
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '6px', maxWidth: '850px', lineHeight: '1.5' }}>
          Compare conservative statutory risk controls against accelerated auto-resolution policies side-by-side to evaluate capital velocity versus audit safety.
        </p>
      </div>

      {/* Dual Column Scenario Comparison (Veloquity Style) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '24px' }}>
        {scenarios.map((scen) => {
          const isSelected = activeScenario === scen.id;
          return (
            <div
              key={scen.id}
              className="card"
              style={{
                border: isSelected ? '2px solid #6366F1' : '1px solid var(--border-card)',
                background: 'var(--bg-card)',
                position: 'relative'
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                <div>
                  <span
                    style={{
                      fontSize: '11px', fontWeight: '800', textTransform: 'uppercase',
                      color: scen.badgeColor, background: `${scen.badgeColor}18`,
                      padding: '3px 8px', borderRadius: '4px', border: `1px solid ${scen.badgeColor}40`
                    }}
                  >
                    {scen.badge}
                  </span>
                  <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#fff', marginTop: '8px' }}>
                    {scen.name}
                  </h2>
                </div>

                <button
                  className={isSelected ? 'btn-primary' : 'btn-secondary'}
                  onClick={() => {
                    setActiveScenario(scen.id);
                    if (onApplyScenario) onApplyScenario(scen.threshold);
                  }}
                  style={{ padding: '6px 14px', fontSize: '12px' }}
                >
                  {isSelected ? <><Check size={13} /> Active Policy</> : 'Apply Policy'}
                </button>
              </div>

              <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: '1.45', marginBottom: '16px' }}>
                {scen.description}
              </p>

              {/* Policy Badges */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                <span className="tag-pill font-mono">Cutoff: λ ≥ {scen.threshold.toFixed(2)}</span>
                <span className="tag-pill font-mono">{scen.tolerance}</span>
                <span className="tag-pill font-mono">{scen.itemsCount} Total Records</span>
              </div>

              {/* Visual Multi-Segment Distribution Bar */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: '700' }}>
                  <span>🟢 {scen.breakdown.clean} Clean</span>
                  <span>🟡 {scen.breakdown.disc} Variance</span>
                  <span>🔴 {scen.breakdown.exc} Quarantined</span>
                </div>
                <div className="confidence-bar-track" style={{ height: '10px', display: 'flex' }}>
                  <div style={{ width: `${(scen.breakdown.clean / scen.itemsCount) * 100}%`, background: '#10B981' }} />
                  <div style={{ width: `${(scen.breakdown.disc / scen.itemsCount) * 100}%`, background: '#F59E0B' }} />
                  <div style={{ width: `${(scen.breakdown.exc / scen.itemsCount) * 100}%`, background: '#F43F5E' }} />
                </div>
              </div>

              {/* Metrics Summary Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'var(--bg-input)', padding: '12px 14px', borderRadius: 'var(--radius-md)', marginBottom: '20px' }}>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Unblocked Liquidity</div>
                  <div className="font-mono" style={{ fontSize: '16px', fontWeight: '800', color: '#34D399', marginTop: '2px' }}>{scen.unblockedVolume}</div>
                </div>
                <div>
                  <div style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Audit Exposure Hold</div>
                  <div className="font-mono" style={{ fontSize: '16px', fontWeight: '800', color: '#FB7185', marginTop: '2px' }}>{scen.quarantinedVolume}</div>
                </div>
              </div>

              {/* Per-Cluster Decisions Breakdown */}
              <div>
                <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' }}>
                  Cluster Decision Rules Under This Scenario:
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {scen.clusters.map((cl, i) => (
                    <div
                      key={i}
                      style={{
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        padding: '10px 12px',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#fff' }}>{cl.title}</div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>{cl.count} transactions in cluster</div>
                      </div>

                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: '700',
                          color: cl.color,
                          background: `${cl.color}15`,
                          padding: '3px 8px',
                          borderRadius: '4px',
                          border: `1px solid ${cl.color}35`
                        }}
                      >
                        {cl.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
