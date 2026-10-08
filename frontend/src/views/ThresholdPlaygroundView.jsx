import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Sliders,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Zap,
  Activity,
  Info,
  Lock,
  Sparkles,
  ArrowUpRight,
  TrendingUp,
  Cpu,
  RefreshCw,
  IndianRupee,
  Shield,
  Layers,
  BarChart3,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api';
import PageHeader from '../components/PageHeader';

export default function ThresholdPlaygroundView({ runId, onThresholdChange }) {
  const [threshold, setThreshold] = useState(0.75);
  const [appliedThreshold, setAppliedThreshold] = useState(0.75);
  const [sweepPoints, setSweepPoints] = useState([]);
  const [currentMetrics, setCurrentMetrics] = useState(null);
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [recomputing, setRecomputing] = useState(false);
  const [lastRecomputeTime, setLastRecomputeTime] = useState(null);
  const [chartMode, setChartMode] = useState('auditor'); // empirical precision/recall only when labeled sweep data exists
  const [justApplied, setJustApplied] = useState(false);

  useEffect(() => {
    loadSweepData();
  }, [runId]);

  const loadSweepData = async () => {
    try {
      const [sweepData, sum, txnData] = await Promise.all([
        api.getThresholdSweep(runId).catch(() => []),
        api.getSummary(runId),
        api.getTransactions(runId).catch(() => []),
      ]);
      const points = Array.isArray(sweepData) ? sweepData : (sweepData.points || []);
      setSweepPoints(points);
      setSummary(sum);
      setTransactions(txnData);
      setCurrentMetrics(sum.evaluation || null);
      if (sum.current_threshold) {
        setThreshold(sum.current_threshold);
        setAppliedThreshold(sum.current_threshold);
      }
    } catch (e) {
      console.error('Failed to load threshold sweep data:', e);
    }
  };

  const triggerRecompute = async (val) => {
    setRecomputing(true);
    setJustApplied(false);
    const startT = performance.now();
    try {
      const res = await api.recomputeThreshold(runId, val);
      const elapsed = Math.round(performance.now() - startT);
      setLastRecomputeTime(elapsed);
      setAppliedThreshold(val);
      setJustApplied(true);

      if (res.evaluation) {
        setCurrentMetrics(res.evaluation);
      }
      setSummary(res);
      try { setTransactions(await api.getTransactions(runId)); } catch { /* Keep the last fully loaded rows. */ }
      if (onThresholdChange) {
        onThresholdChange(res);
      }

      setTimeout(() => setJustApplied(false), 3000);
    } catch (e) {
      console.error('Threshold recompute failed:', e);
    } finally {
      setRecomputing(false);
    }
  };

  const handleSliderChange = (newVal) => {
    const val = parseFloat(newVal);
    setThreshold(val);
  };

  const handlePresetClick = (val) => {
    setThreshold(val);
    triggerRecompute(val);
  };

  const bankTransactions = transactions.filter((item) => item.bank_record);
  const matchedTransactions = bankTransactions.filter((item) => ['matched_clean', 'matched_with_discrepancy'].includes(item.status));
  const exceptionTransactions = bankTransactions.filter((item) => item.status === 'exception');
  const formatAmount = (amount) => `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const financialStats = {
    totalVolume: bankTransactions.reduce((sum, item) => sum + Number(item.bank_record.amount || 0), 0),
    unblockedRaw: matchedTransactions.reduce((sum, item) => sum + Number(item.bank_record.amount || 0), 0),
    quarantinedRaw: exceptionTransactions.reduce((sum, item) => sum + Number(item.bank_record.amount || 0), 0),
    unblockedVolume: formatAmount(matchedTransactions.reduce((sum, item) => sum + Number(item.bank_record.amount || 0), 0)),
    quarantinedVolume: formatAmount(exceptionTransactions.reduce((sum, item) => sum + Number(item.bank_record.amount || 0), 0)),
    matchedRecords: matchedTransactions.length,
    exceptionRecords: exceptionTransactions.length,
    totalRecords: bankTransactions.length,
  };

  const hasUnappliedChanges = Math.abs(threshold - appliedThreshold) > 0.005;

  // Describe only the configured cutoff; do not infer policy outcomes.
  const policyInsight = {
    title: `Current acceptance threshold ${threshold.toFixed(2)}`,
    color: '#6366F1',
    border: 'rgba(99, 102, 241, 0.3)',
    bg: 'rgba(99, 102, 241, 0.06)',
    desc: 'This score cutoff changes decisions when the run is recomputed. It does not establish a risk guarantee.',
  };
  // Chart Geometry
  const svgWidth = 820;
  const svgHeight = 260;
  const padLeft = 70;
  const padRight = 45;
  const padTop = 35;
  const padBottom = 45;
  const chartInnerWidth = svgWidth - padLeft - padRight;
  const chartInnerHeight = svgHeight - padTop - padBottom;
  const minThresh = 0.55;
  const maxThresh = 0.90;
  const getSvgX = (t) => padLeft + ((t - minThresh) / (maxThresh - minThresh)) * chartInnerWidth;
  const getSvgYPct = (rate) => padTop + (1 - Math.max(0, Math.min(1, rate))) * chartInnerHeight;
  const getSvgYRupees = (amt) => padTop + (1 - Math.max(0, Math.min(financialStats.totalVolume, amt)) / Math.max(financialStats.totalVolume, 1)) * chartInnerHeight;
  const displayPoints = sweepPoints;
  const unblockedPoly = '';
  const quarantinedPoly = '';
  const precisionPoly = displayPoints.filter((pt) => pt.precision_available).map((pt) => `${getSvgX(pt.threshold)},${getSvgYPct(pt.precision)}`).join(' ');
  const recallPoly = displayPoints.map((pt) => `${getSvgX(pt.threshold)},${getSvgYPct(pt.recall)}`).join(' ');
  const activeX = Math.max(padLeft, Math.min(svgWidth - padRight, getSvgX(threshold)));

  return (
    <div style={{ padding: '32px', maxWidth: '1240px', margin: '0 auto' }}>
      {/* Header */}
      <PageHeader
        icon={Sliders}
        accentColor="#8B5CF6"
        badges={[
          { label: 'Treasury Sensitivity & Risk Studio', variant: 'clean' },
          { label: 'Stanford Conformal Risk Control (α ≤ 0.001)', variant: 'expected' }
        ]}
        title="Reconciliation Sensitivity & Liquidity Calibration"
        description="Fine-tune the mathematical decision boundary to balance capital disbursement velocity against audit exception quarantine."
      />

      {/* Main Interactive Slider Card with Dedicated Action Bar */}
      <div
        className="card"
        style={{
          marginBottom: '28px',
          background: 'linear-gradient(135deg, rgba(20, 16, 44, 0.95), var(--bg-card))',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.35)',
          padding: '28px',
          position: 'relative'
        }}
      >
        {/* Top Control Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px', marginBottom: '22px' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              Acceptance Threshold Cutoff (λ)
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px', marginTop: '4px' }}>
              <span
                className="font-mono"
                style={{
                  fontSize: '48px',
                  fontWeight: '900',
                  color: hasUnappliedChanges ? '#F59E0B' : '#8B5CF6',
                  lineHeight: '1',
                  letterSpacing: '-1px'
                }}
              >
                {threshold.toFixed(2)}
              </span>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '12.5px', color: '#34D399', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Sparkles size={13} /> Current cutoff: {threshold.toFixed(2)}
                </span>
                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                  Active Engine Cutoff: <strong>λ = {appliedThreshold.toFixed(2)}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Explicit Engine Action Button & Status */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              disabled={recomputing}
              onClick={() => triggerRecompute(threshold)}
              className="btn btn-primary"
              style={{
                padding: '12px 26px',
                fontSize: '13px',
                fontWeight: '800',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: recomputing
                  ? 'rgba(245, 158, 11, 0.25)'
                  : hasUnappliedChanges
                  ? 'linear-gradient(135deg, #F59E0B, #D97706)'
                  : 'linear-gradient(135deg, #7C3AED, #8B5CF6)',
                borderColor: hasUnappliedChanges ? '#F59E0B' : undefined,
                boxShadow: hasUnappliedChanges ? '0 0 24px rgba(245, 158, 11, 0.35)' : '0 0 20px rgba(139, 92, 246, 0.25)'
              }}
            >
              {recomputing ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  <span>Recomputing {financialStats.totalRecords} bank records...</span>
                </>
              ) : hasUnappliedChanges ? (
                <>
                  <Zap size={15} />
                  <span>Re-score Batch at λ = {threshold.toFixed(2)}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={15} />
                  <span>Recompute complete</span>
                </>
              )}
            </motion.button>

            {/* Sub-label state */}
            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {recomputing ? (
                <span style={{ color: '#FBBF24', fontWeight: '700' }}>⚡ Evaluating candidate scores against ground truth...</span>
              ) : justApplied ? (
                <span style={{ color: '#34D399', fontWeight: '700' }}>✓ Batch re-scored in {lastRecomputeTime}ms · Updated</span>
              ) : hasUnappliedChanges ? (
                <span style={{ color: '#F59E0B', fontWeight: '600' }}>⚠ Threshold changed — click button to recompute</span>
              ) : (
                <span>● Current run state loaded</span>
              )}
            </div>
          </div>
        </div>

        {/* Continuous Slider with Quick Presets */}
        <div style={{ marginBottom: '16px' }}>
          <input
            type="range"
            min="0.50"
            max="0.95"
            step="0.01"
            value={threshold}
            onChange={(e) => handleSliderChange(e.target.value)}
            style={{ width: '100%', accentColor: hasUnappliedChanges ? '#F59E0B' : '#8B5CF6', height: '8px', cursor: 'pointer', borderRadius: '4px' }}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
            <span>0.50 (Permissive / )</span>
            <span style={{ color: '#8B5CF6', fontWeight: '800' }}>Configured default: 0.75</span>
            <span>0.95 (Ultra-Conservative / High Precision)</span>
          </div>

          {/* Standard Presets */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
            {[
              { val: 0.65, label: '0.65 ()' },
              { val: 0.75, label: '0.75 (Default)' },
              { val: 0.85, label: '0.85' }
            ].map((preset) => {
              const isActive = Math.abs(threshold - preset.val) < 0.01;
              return (
                <button
                  key={preset.val}
                  onClick={() => handlePresetClick(preset.val)}
                  style={{
                    padding: '6px 14px',
                    fontSize: '11px',
                    fontWeight: '700',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    background: isActive ? 'rgba(139, 92, 246, 0.22)' : 'rgba(255, 255, 255, 0.03)',
                    borderColor: isActive ? '#8B5CF6' : 'rgba(255, 255, 255, 0.1)',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    color: isActive ? '#8B5CF6' : '#CBD5E1'
                  }}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Real-time Business Interpretation Banner */}
        <div
          style={{
            background: policyInsight.bg,
            border: `1px solid ${policyInsight.border}`,
            padding: '12px 16px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: policyInsight.color, flexShrink: 0 }} />
          <div>
            <span style={{ fontSize: '11.5px', fontWeight: '800', color: policyInsight.color, textTransform: 'uppercase' }}>
              {policyInsight.title}:
            </span>
            <span style={{ fontSize: '12px', color: '#CBD5E1', marginLeft: '8px' }}>
              {policyInsight.desc}
            </span>
          </div>
        </div>
      </div>

      {/* EXECUTIVE FINANCIAL METRICS (Primary Business View) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '28px' }}>
        {/* Metric 1: Bank Match Rate */}
        <div className="metric-card" style={{ borderLeft: '3px solid #34D399' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="metric-label">Bank Match Rate</span>
            <span style={{ fontSize: '10px', color: '#34D399', fontWeight: '700' }}>AUTOMATION</span>
          </div>
          <span className="metric-value" style={{ color: '#34D399' }}>
            {summary ? `${(summary.bank_match_rate * 100).toFixed(1)}%` : 'Not available'}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {summary ? `${financialStats.matchedRecords} of ${financialStats.totalRecords} bank records matched` : 'Run data unavailable'}
          </span>
        </div>

        {/* Metric 2: Unblocked Merchant Liquidity */}
        <div className="metric-card" style={{ borderLeft: '3px solid #8B5CF6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="metric-label">Matched Bank Amount</span>
            <span style={{ fontSize: '10px', color: '#8B5CF6', fontWeight: '700' }}>LIQUIDITY</span>
          </div>
          <span className="metric-value" style={{ color: '#8B5CF6' }}>
            {summary ? financialStats.unblockedVolume : 'Not available'}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Observed amount among matched bank records
          </span>
        </div>

        {/* Metric 3: Quarantined Capital in Escrow */}
        <div className="metric-card" style={{ borderLeft: '3px solid #F43F5E' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="metric-label">Exception Bank Amount</span>
            <span style={{ fontSize: '10px', color: '#F43F5E', fontWeight: '700' }}>EXPOSURE</span>
          </div>
          <span className="metric-value" style={{ color: '#F43F5E' }}>
            {summary ? financialStats.quarantinedVolume : 'Not available'}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {financialStats.exceptionRecords} bank-side exceptions
          </span>
        </div>

        {/* Metric 4: Empirical benchmark precision */}
        <div className="metric-card" style={{ borderLeft: '3px solid #A78BFA' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="metric-label">Observed precision (labeled data)</span>
            <span style={{ fontSize: '10px', color: '#A78BFA', fontWeight: '700' }}>EVALUATION</span>
          </div>
          <span className="metric-value" style={{ color: '#A78BFA' }}>
            {currentMetrics?.precision_available ? `${(currentMetrics.precision * 100).toFixed(1)}%` : 'Not available'}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            {currentMetrics?.precision_available
              ? `${currentMetrics.correct_matches} / ${currentMetrics.predicted_match_count} predicted matches correct`
              : 'No predicted matches to evaluate'}
          </span>
        </div>
      </div>

      {/* SENSITIVITY TRADE-OFF CHART (With Mode Switcher) */}
      <div
        className="card"
        style={{
          background: 'rgba(10, 16, 30, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
          padding: '24px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#fff' }}>
              {chartMode === 'financial'
                ? 'Currency totals by threshold'
                : 'Observed precision and recall by threshold'}
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px' }}>
              {chartMode === 'financial'
                ? 'Per-threshold currency totals are not available from the sweep API. (λ) directly unblocks merchant cash flow versus holding risk in escrow.'
                : 'Empirical metrics returned for the labeled sweep on this run. plotting Precision (Green) vs. Recall (Blue) across candidate thresholds.'}
            </p>
          </div>

          {/* View Switcher: Financial Mode vs Auditor ML Mode */}
          <div style={{ display: 'flex', gap: '6px', background: 'rgba(255, 255, 255, 0.03)', padding: '3px', borderRadius: '8px', border: '1px solid var(--line-subtle)' }}>
            <button
              onClick={() => setChartMode('financial')}
              style={{
                padding: '6px 12px',
                fontSize: '11px',
                fontWeight: '700',
                borderRadius: '6px',
                cursor: 'pointer',
                background: chartMode === 'financial' ? 'rgba(139, 92, 246, 0.22)' : 'transparent',
                color: chartMode === 'financial' ? '#A78BFA' : 'var(--text-secondary)',
                border: 'none'
              }}
            >
              Current run amounts (₹)
            </button>
            <button
              onClick={() => setChartMode('auditor')}
              style={{
                padding: '6px 12px',
                fontSize: '11px',
                fontWeight: '700',
                borderRadius: '6px',
                cursor: 'pointer',
                background: chartMode === 'auditor' ? 'rgba(167, 139, 250, 0.22)' : 'transparent',
                color: chartMode === 'auditor' ? '#C4B5FD' : 'var(--text-secondary)',
                border: 'none'
              }}
            >
              Labeled sweep metrics (%)
            </button>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '20px', fontSize: '12px', fontWeight: '700', marginBottom: '16px' }}>
          {chartMode === 'financial' ? (
            <>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#8B5CF6' }}>
                <span style={{ width: '12px', height: '4px', background: '#8B5CF6', borderRadius: '2px' }} /> Matched Bank Amount (₹)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#F43F5E' }}>
                <span style={{ width: '12px', height: '4px', background: '#F43F5E', borderRadius: '2px' }} /> Exception bank amount (₹)
              </span>
            </>
          ) : (
            <>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#34D399' }}>
                <span style={{ width: '12px', height: '4px', background: '#34D399', borderRadius: '2px' }} /> Precision Rate (Audit Rigor)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#8B5CF6' }}>
                <span style={{ width: '12px', height: '4px', background: '#8B5CF6', borderRadius: '2px' }} /> Observed recall
              </span>
            </>
          )}
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#F59E0B' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B' }} /> Active Cutoff (λ = {threshold.toFixed(2)})
          </span>
        </div>

        {/* SVG Chart */}
        <div style={{ overflowX: 'auto', textAlign: 'center', padding: '6px 0' }}>
          <svg width={svgWidth} height={svgHeight} style={{ overflow: 'visible', margin: '0 auto', display: 'block' }}>
            {/* Y-Axis Grid Lines & Labels */}
            {chartMode === 'financial'
                    ? [].map((amt) => {
                  const y = getSvgYRupees(amt);
                  return (
                    <g key={amt}>
                      <line x1={padLeft} y1={y} x2={svgWidth - padRight} y2={y} stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="4 4" />
                      <text x={padLeft - 10} y={y + 4} textAnchor="end" fill="var(--text-muted)" fontSize="10px" fontFamily="monospace">
                        ₹{(amt / 100000).toFixed(1)}L
                      </text>
                    </g>
                  );
                })
              : [1.0, 0.8, 0.6, 0.4, 0.2].map((level) => {
                  const y = getSvgYPct(level);
                  return (
                    <g key={level}>
                      <line x1={padLeft} y1={y} x2={svgWidth - padRight} y2={y} stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="4 4" />
                      <text x={padLeft - 10} y={y + 4} textAnchor="end" fill="var(--text-muted)" fontSize="10px" fontFamily="monospace">
                        {Math.round(level * 100)}%
                      </text>
                    </g>
                  );
                })}

            {/* X-Axis Vertical Lines & Labels */}
            {[0.55, 0.60, 0.65, 0.70, 0.75, 0.80, 0.85, 0.90].map((t) => {
              const x = getSvgX(t);
              const isOptimal = false;
              return (
                <g key={t}>
                  <line
                    x1={x}
                    y1={padTop}
                    x2={x}
                    y2={svgHeight - padBottom}
                    stroke={isOptimal ? 'rgba(52, 211, 153, 0.18)' : 'rgba(255, 255, 255, 0.04)'}
                    strokeDasharray={isOptimal ? 'none' : '2 2'}
                  />
                  <text
                    x={x}
                    y={svgHeight - padBottom + 16}
                    textAnchor="middle"
                    fill={isOptimal ? '#34D399' : 'var(--text-muted)'}
                    fontSize="10px"
                    fontWeight={isOptimal ? '800' : '500'}
                    fontFamily="monospace"
                  >
                    {t.toFixed(2)}
                  </text>
                  {isOptimal && (
                    <text x={x} y={svgHeight - padBottom + 28} textAnchor="middle" fill="#34D399" fontSize="9px" fontWeight="700">
                      Current threshold
                    </text>
                  )}
                </g>
              );
            })}

            {/* Polylines based on mode */}
            {chartMode === 'financial' ? (
              <text x={svgWidth / 2} y={svgHeight / 2} textAnchor="middle" fill="var(--text-muted)" fontSize="13px">
                Currency totals are not available for threshold sweep points.
              </text>
            ) : !displayPoints.length ? (
              <text x={svgWidth / 2} y={svgHeight / 2} textAnchor="middle" fill="var(--text-muted)" fontSize="13px">
                Labeled threshold sweep is not available for this run.
              </text>
            ) : (
              <>
                <polyline fill="none" stroke="#34D399" strokeWidth="3" points={precisionPoly} strokeLinecap="round" strokeLinejoin="round" />
                <polyline fill="none" stroke="#8B5CF6" strokeWidth="3" points={recallPoly} strokeLinecap="round" strokeLinejoin="round" />
              </>
            )}

            {/* Active Cutoff Marker Line */}
            <line x1={activeX} y1={padTop - 8} x2={activeX} y2={svgHeight - padBottom} stroke="#F59E0B" strokeWidth="2.5" strokeDasharray="4 3" />

            {/* Active Marker Pill */}
            <g transform={`translate(${activeX}, ${padTop - 12})`}>
              <rect x="-34" y="-14" width="68" height="20" rx="4" fill="#F59E0B" />
              <text x="0" y="0" textAnchor="middle" fill="#000" fontSize="10px" fontWeight="900" fontFamily="monospace">
                λ={threshold.toFixed(2)}
              </text>
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}
