import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Sliders,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Zap,
  Layers,
  Play,
  Check,
  ArrowRight,
  Shield,
  Sparkles,
  ChevronRight,
  Settings2,
  Percent,
  GitCompare,
  TrendingUp,
  Lock,
  Receipt,
  RefreshCw,
  IndianRupee,
  Activity,
  ArrowUpRight
} from 'lucide-react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { api } from '../api';
import PageHeader from '../components/PageHeader';

// Animated Counter for smooth mathematical transitions
function AnimatedRupee({ value }) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    let startTimestamp = null;
    const startValue = displayValue;
    const endValue = value;
    const duration = 600;

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(startValue + (endValue - startValue) * ease));

      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    window.requestAnimationFrame(step);
  }, [value]);

  return <span>₹{displayValue.toLocaleString('en-IN')}</span>;
}

function AnimatedPercent({ value, decimals = 1 }) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    let startTimestamp = null;
    const startValue = displayValue;
    const endValue = value;
    const duration = 500;

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(startValue + (endValue - startValue) * ease);

      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    window.requestAnimationFrame(step);
  }, [value]);

  return <span>{displayValue.toFixed(decimals)}%</span>;
}

export default function ScenariosView({ runId, onApplyScenario, onToast }) {
  // Mode switcher: 'comparison' (A vs B Side-by-Side) or 'studio' (Interactive Sensitivity Studio & Curve)
  const [activeTab, setActiveTab] = useState('comparison');
  const [selectedPresetId, setSelectedPresetId] = useState('conservative');
  const [threshold, setThreshold] = useState(0.75);
  const [appliedThreshold, setAppliedThreshold] = useState(0.75);
  const [sweepPoints, setSweepPoints] = useState([]);
  const [currentMetrics, setCurrentMetrics] = useState(null);
  const [liveSummary, setLiveSummary] = useState(null); // real API summary
  const [transactions, setTransactions] = useState([]);
  const [recomputing, setRecomputing] = useState(false);
  const [lastRecomputeTime, setLastRecomputeTime] = useState(null);
  const [chartMode, setChartMode] = useState('financial'); // 'financial' (₹ Cash) or 'auditor' (% ML)
  const [justApplied, setJustApplied] = useState(false);

  const loadStudioData = useCallback(async () => {
    try {
      const [sweepData, sum, txns] = await Promise.all([
        api.getThresholdSweep(runId).catch(() => []),
        api.getSummary(runId),
        api.getTransactions(runId).catch(() => [])
      ]);

      const points = Array.isArray(sweepData) ? sweepData : (sweepData.points || []);
      setSweepPoints(points);
      setLiveSummary(sum);
      setTransactions(txns);

      if (sum.evaluation) {
        setCurrentMetrics(sum.evaluation);
      }
      if (sum.current_threshold) {
        setThreshold(sum.current_threshold);
        setAppliedThreshold(sum.current_threshold);
      }
    } catch (e) {
      console.error('Failed to load studio data:', e);
    }
  }, [runId]);

  useEffect(() => {
    loadStudioData();
  }, [loadStudioData]);

  const handleRecompute = async (targetThreshold) => {
    setRecomputing(true);
    setJustApplied(false);
    const startT = Date.now();
    try {
      const res = await api.recomputeThreshold(runId, targetThreshold);
      const elapsed = Date.now() - startT;
      setLastRecomputeTime(elapsed);
      setAppliedThreshold(targetThreshold);
      setJustApplied(true);
      setLiveSummary(res);

      if (res.evaluation) {
        setCurrentMetrics(res.evaluation);
      }
      if (onApplyScenario) {
        onApplyScenario(targetThreshold);
      }
      if (onToast) {
        onToast({ title: 'Sensitivity Applied', message: `Acceptance threshold ${targetThreshold.toFixed(2)} applied in ${elapsed}ms`, type: 'info' });
      }

      setTimeout(() => setJustApplied(false), 3200);
    } catch (e) {
      console.error('Failed to recompute batch sensitivity:', e);
      if (onToast) {
        onToast({ title: 'Recompute Failed', message: e.message || 'Failed to recompute threshold', type: 'error' });
      }
    } finally {
      setRecomputing(false);
    }
  };

  const hasUnappliedChanges = Math.abs(threshold - appliedThreshold) > 0.005;

  // Live financial aggregates computed from ingested transaction records
  const financialStats = useMemo(() => {
    const bankTx = transactions.filter((item) => item.bank_record);
    const matchedTx = bankTx.filter((item) => ['matched_clean', 'matched_with_discrepancy'].includes(item.status));
    const excTx = bankTx.filter((item) => item.status === 'exception');
    return {
      totalVolume: bankTx.reduce((sum, item) => sum + Number(item.bank_record.amount || 0), 0),
      unblockedRaw: matchedTx.reduce((sum, item) => sum + Number(item.bank_record.amount || 0), 0),
      quarantinedRaw: excTx.reduce((sum, item) => sum + Number(item.bank_record.amount || 0), 0),
      matchedRecords: matchedTx.length,
      exceptionRecords: excTx.length,
      totalRecords: bankTx.length,
      cleanRatePercent: liveSummary?.bank_match_rate == null ? null : liveSummary.bank_match_rate * 100,
    };
  }, [transactions, liveSummary?.bank_match_rate]);
  const totalVolume = financialStats.totalVolume;

  // Business Policy Insight
  const policyInsight = {
    title: `Current acceptance threshold ${threshold.toFixed(2)}`,
    color: '#818CF8',
    border: 'rgba(99, 102, 241, 0.35)',
    bg: 'rgba(99, 102, 241, 0.08)',
    badge: 'Configured threshold',
    desc: 'This is a score cutoff. Its effect on observed results depends on the current run and does not establish an error-rate guarantee.',
  };
  const buildClusters = (sourceSummary) => {
    if (!sourceSummary) return [];
    const entries = Object.entries(sourceSummary.discrepancy_breakdown || {})
      .filter(([, count]) => count > 0)
      .map(([key, count]) => ({
        title: key.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
        count,
        status: 'Review / investigate',
        color: '#F59E0B',
      }));
    return entries;
  };

  const presetScenarios = useMemo(() => {
    const active = liveSummary;
    const at65 = sweepPoints.find((point) => Math.abs(point.threshold - 0.65) < 0.001);
    const scenarios = [];
    if (active) {
      scenarios.push({
        id: 'current',
        name: 'Current run',
        badge: `Observed at ${active.current_threshold.toFixed(2)}`,
        badgeColor: '#10B981',
        description: 'Metrics and amounts calculated from this completed run.',
        threshold: active.current_threshold,
        tolerance: 'Not configured',
        cleanRateRaw: active.bank_match_rate * 100,
        unblockedRaw: financialStats.unblockedRaw,
        quarantinedRaw: financialStats.quarantinedRaw,
        clusters: buildClusters(active),
      });
    }
    if (at65) {
      scenarios.push({
        id: 'threshold-065',
        name: 'Threshold sweep at 0.65',
        badge: 'Empirical benchmark point',
        badgeColor: '#818CF8',
        description: 'Observed labeled-run metrics at this threshold. The sweep does not include amounts or an independently recomputed summary.',
        threshold: at65.threshold,
        tolerance: 'Not configured',
        cleanRateRaw: at65.bank_match_rate * 100,
        unblockedRaw: null,
        quarantinedRaw: null,
        clusters: [],
      });
    }
    return scenarios;
  }, [liveSummary, sweepPoints, financialStats]);
  // Chart Geometry
  const svgWidth = 840;
  const svgHeight = 270;
  const padLeft = 75;
  const padRight = 50;
  const padTop = 40;
  const padBottom = 45;

  const chartInnerWidth = svgWidth - padLeft - padRight;
  const chartInnerHeight = svgHeight - padTop - padBottom;

  const minThresh = 0.55;
  const maxThresh = 0.90;

  const getSvgX = (t) => padLeft + ((t - minThresh) / (maxThresh - minThresh)) * chartInnerWidth;
  const getSvgYPct = (rate) => padTop + (1 - Math.max(0, Math.min(1, rate))) * chartInnerHeight;
  const getSvgYRupees = (amt) => {
    const maxAmt = Math.max(totalVolume * 1.1, 1000);
    return padTop + (1 - Math.max(0, Math.min(maxAmt, amt)) / maxAmt) * chartInnerHeight;
  };

  const displayPoints = sweepPoints;
  // The sweep returns rates/counts, not currency totals, so no capital curve is inferred.
  const precisionPoly = displayPoints.filter((point) => point.precision_available).map((point) => `${getSvgX(point.threshold)},${getSvgYPct(point.precision)}`).join(' ');
  const recallPoly = displayPoints.map((point) => `${getSvgX(point.threshold)},${getSvgYPct(point.recall)}`).join(' ');
  const activeX = Math.max(padLeft, Math.min(svgWidth - padRight, getSvgX(threshold)));

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Header & Segmented Studio Switcher */}
      <PageHeader
        icon={Sliders}
        accentColor="#8B5CF6"
        badges={[
          { label: 'Policy & Sensitivity Studio', variant: 'clean' },
          { label: 'Empirical run metrics', variant: 'expected' }
        ]}
        title="Reconciliation Policy & Sensitivity Studio"
        description="Fine-tune mathematical decision cutoffs (Î»), test standard compliance policies, and visualize capital disbursement velocity against audit risk in real time."
        rightSlot={
          <div
            style={{
              background: 'rgba(11, 17, 33, 0.85)',
              padding: '4px',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              gap: '4px',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
              position: 'relative'
            }}
          >
            <button
              onClick={() => setActiveTab('comparison')}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 18px',
                borderRadius: '7px',
                fontSize: '12.5px',
                fontWeight: activeTab === 'comparison' ? '700' : '500',
                cursor: 'pointer',
                background: 'transparent',
                color: activeTab === 'comparison' ? '#fff' : 'var(--text-secondary)',
                border: 'none',
                zIndex: 1,
                transition: 'color 0.15s ease'
              }}
            >
              {activeTab === 'comparison' && (
                <motion.div
                  layoutId="activeStudioTabIndicator"
                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.28), rgba(99, 102, 241, 0.14))',
                    border: '1px solid #6366F1',
                    borderRadius: '7px',
                    boxShadow: '0 0 16px rgba(99, 102, 241, 0.35)',
                    zIndex: -1
                  }}
                />
              )}
              <GitCompare size={14} color={activeTab === 'comparison' ? '#818CF8' : 'currentColor'} />
              <span>Standard Policy Comparison (A vs B)</span>
            </button>

            <button
              onClick={() => setActiveTab('studio')}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 18px',
                borderRadius: '7px',
                fontSize: '12.5px',
                fontWeight: activeTab === 'studio' ? '700' : '500',
                cursor: 'pointer',
                background: 'transparent',
                color: activeTab === 'studio' ? '#fff' : 'var(--text-secondary)',
                border: 'none',
                zIndex: 1,
                transition: 'color 0.15s ease'
              }}
            >
              {activeTab === 'studio' && (
                <motion.div
                  layoutId="activeStudioTabIndicator"
                  transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.28), rgba(139, 92, 246, 0.14))',
                    border: '1px solid #8B5CF6',
                    borderRadius: '7px',
                    boxShadow: '0 0 16px rgba(139, 92, 246, 0.35)',
                    zIndex: -1
                  }}
                />
              )}
              <Sliders size={14} color={activeTab === 'studio' ? '#8B5CF6' : 'currentColor'} />
              <span>Sensitivity Studio & Curve (Live Tuning)</span>
            </button>
          </div>
        }
      />

      {/* Animate View Transition with Crossfade */}
      <AnimatePresence mode="wait">
        {/* Tab 1: Standard Policy Comparison (A vs B Side-by-Side) */}
        {activeTab === 'comparison' ? (
          <motion.div
            key="comparison-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(520px, 1fr))',
              gap: '24px'
            }}
          >
            {presetScenarios.map((scen, idx) => {
              const isSelected = selectedPresetId === scen.id;
              return (
                <motion.div
                  key={scen.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.08 }}
                  whileHover={{ y: -3, transition: { duration: 0.18 } }}
                  onClick={() => {
                    setSelectedPresetId(scen.id);
                    setThreshold(scen.threshold);
                  }}
                  className="card"
                  style={{
                    cursor: 'pointer',
                    border: isSelected ? '2px solid #6366F1' : '1px solid rgba(255, 255, 255, 0.08)',
                    background: isSelected
                      ? 'linear-gradient(180deg, rgba(20, 28, 55, 0.95), rgba(11, 17, 33, 0.95))'
                      : 'linear-gradient(180deg, rgba(14, 21, 40, 0.75), rgba(10, 16, 30, 0.75))',
                    boxShadow: isSelected
                      ? '0 12px 36px rgba(99, 102, 241, 0.25), inset 0 0 20px rgba(99, 102, 241, 0.05)'
                      : '0 8px 24px rgba(0, 0, 0, 0.25)',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '520px',
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
                  }}
                >
                  {/* Subtle Top Glow Accent */}
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: '15%',
                      right: '15%',
                      height: '1px',
                      background: isSelected
                        ? 'linear-gradient(90deg, transparent, #818CF8, transparent)'
                        : 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.15), transparent)'
                    }}
                  />

                  <div>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                      <div>
                        <span
                          style={{
                            fontSize: '10.5px',
                            fontWeight: '800',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            color: scen.badgeColor,
                            background: `${scen.badgeColor}15`,
                            padding: '3px 8px',
                            borderRadius: '4px',
                            border: `1px solid ${scen.badgeColor}40`
                          }}
                        >
                          {scen.badge}
                        </span>
                        <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#fff', marginTop: '10px', marginBottom: '4px', letterSpacing: '-0.3px' }}>
                          {scen.name}
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '12.5px', lineHeight: '1.45', margin: 0 }}>
                          {scen.description}
                        </p>
                      </div>

                      {/* Selected Radio Pill */}
                      <motion.div
                        animate={{ scale: isSelected ? 1 : 0.95 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          border: `2px solid ${isSelected ? '#6366F1' : 'rgba(255, 255, 255, 0.2)'}`,
                          background: isSelected ? '#6366F1' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          marginLeft: '12px',
                          boxShadow: isSelected ? '0 0 12px rgba(99, 102, 241, 0.5)' : 'none'
                        }}
                      >
                        {isSelected && <Check size={14} color="#fff" strokeWidth={3} />}
                      </motion.div>
                    </div>

                    {/* Summary Metric Strips */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: '12px',
                        margin: '18px 0',
                        background: 'rgba(255, 255, 255, 0.02)',
                        padding: '12px 14px',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 255, 255, 0.05)'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                          Bank Match Rate
                        </div>
                        <div className="font-mono" style={{ fontSize: '20px', fontWeight: '800', color: '#34D399', marginTop: '2px' }}>
                          {scen.cleanRateRaw == null ? 'Not available' : <AnimatedPercent value={scen.cleanRateRaw} />}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                          Threshold (Î»)
                        </div>
                        <div className="font-mono" style={{ fontSize: '20px', fontWeight: '800', color: '#8B5CF6', marginTop: '2px' }}>
                          {scen.threshold.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                          Tolerance Band
                        </div>
                        <div className="font-mono" style={{ fontSize: '12px', fontWeight: '700', color: '#CBD5E1', marginTop: '6px' }}>
                          {scen.tolerance}
                        </div>
                      </div>
                    </div>

                    {/* Financial Cash Flow Impact Strip */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '18px' }}>
                      <div
                        style={{
                          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(16, 185, 129, 0.02))',
                          padding: '12px 14px',
                          borderRadius: '8px',
                          border: '1px solid rgba(16, 185, 129, 0.25)'
                        }}
                      >
                        <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#6EE7B7', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <TrendingUp size={12} /> Matched Bank Amount
                        </div>
                        <div className="font-mono" style={{ fontSize: '18px', fontWeight: '800', color: '#34D399', marginTop: '4px' }}>
                          {scen.unblockedRaw == null ? 'Not available' : <AnimatedRupee value={scen.unblockedRaw} />}
                        </div>
                        <div style={{ fontSize: '10.5px', color: '#94A3B8', marginTop: '2px' }}>
                          Observed amount among matched bank records
                        </div>
                      </div>

                      <div
                        style={{
                          background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.08), rgba(244, 63, 94, 0.02))',
                          padding: '12px 14px',
                          borderRadius: '8px',
                          border: '1px solid rgba(244, 63, 94, 0.25)'
                        }}
                      >
                        <div style={{ fontSize: '10.5px', fontWeight: '700', color: '#FDA4AF', textTransform: 'uppercase', letterSpacing: '0.4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Lock size={12} /> Exception Bank Amount
                        </div>
                        <div className="font-mono" style={{ fontSize: '18px', fontWeight: '800', color: '#FB7185', marginTop: '4px' }}>
                          {scen.quarantinedRaw == null ? 'Not available' : <AnimatedRupee value={scen.quarantinedRaw} />}
                        </div>
                        <div style={{ fontSize: '10.5px', color: '#94A3B8', marginTop: '2px' }}>
                          Observed amount among bank exceptions
                        </div>
                      </div>
                    </div>

                    {/* Breakdown Cluster Bars with Animated Fills */}
                    <div style={{ marginBottom: '18px' }}>
                      <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>
                        Reconciliation Action Clusters
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {scen.clusters.length === 0 && <span style={{ color: 'var(--text-muted)' }}>No discrepancy breakdown available for this comparison.</span>}
                        {scen.clusters.map((cl, cIdx) => (
                          <div
                            key={cIdx}
                            style={{
                              background: 'rgba(255, 255, 255, 0.015)',
                              padding: '8px 12px',
                              borderRadius: '6px',
                              border: '1px solid rgba(255, 255, 255, 0.04)',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: cl.color, boxShadow: `0 0 8px ${cl.color}80` }} />
                              <span style={{ fontSize: '12px', color: '#E2E8F0', fontWeight: '500' }}>{cl.title}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span
                                style={{
                                  fontSize: '11px',
                                  color: cl.color,
                                  fontWeight: '700',
                                  background: `${cl.color}15`,
                                  padding: '2px 7px',
                                  borderRadius: '4px',
                                  border: `1px solid ${cl.color}35`
                                }}
                              >
                                {cl.status}
                              </span>
                              <span className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({cl.count})</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Footer Action Button with Motion Feedback */}
                  <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                      {scen.id === 'current' ? 'Current run' : 'Sweep point'}
                    </span>

                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      disabled={recomputing}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRecompute(scen.threshold);
                      }}
                      className={isSelected ? 'btn btn-primary' : 'btn btn-secondary'}
                      style={{
                        padding: '9px 20px',
                        fontSize: '12px',
                        fontWeight: '700',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: isSelected ? 'linear-gradient(135deg, #4F46E5, #6366F1)' : undefined,
                        boxShadow: isSelected ? '0 0 20px rgba(99, 102, 241, 0.4)' : undefined
                      }}
                    >
                      {recomputing && selectedPresetId === scen.id ? (
                        <>
                          <RefreshCw size={13} className="animate-spin" />
                          <span>Re-scoring Batch...</span>
                        </>
                      ) : (
                        <>
                          <span>Apply Policy Model (Î»={scen.threshold})</span>
                          <ChevronRight size={14} />
                        </>
                      )}
                    </motion.button>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        ) : (
          /* Tab 2: Sensitivity Studio & Curve (Live Tuning Workbench) */
          <motion.div
            key="studio-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            {/* Main Interactive Slider Card with Dedicated Action Bar */}
            <div
              className="card"
              style={{
                marginBottom: '26px',
                background: 'linear-gradient(145deg, rgba(14, 20, 38, 0.95), rgba(9, 14, 28, 0.95))',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                boxShadow: '0 16px 40px rgba(0, 0, 0, 0.35)',
                padding: '28px',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px', marginBottom: '22px' }}>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    Acceptance Threshold Cutoff (Î»)
                  </div>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px', marginTop: '4px' }}>
                    <motion.span
                      key={threshold}
                      initial={{ scale: 0.96, opacity: 0.8 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.15 }}
                      className="font-mono"
                      style={{
                        fontSize: '48px',
                        fontWeight: '900',
                        color: hasUnappliedChanges ? '#F59E0B' : '#8B5CF6',
                        lineHeight: '1',
                        letterSpacing: '-1px',
                        textShadow: hasUnappliedChanges
                          ? '0 0 24px rgba(245, 158, 11, 0.4)'
                          : '0 0 24px rgba(139, 92, 246, 0.35)'
                      }}
                    >
                      {threshold.toFixed(2)}
                    </motion.span>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '12.5px', color: '#34D399', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Sparkles size={13} /> Current threshold: {threshold.toFixed(2)}
                      </span>
                      <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                        Active Engine Cutoff: <strong>Î» = {appliedThreshold.toFixed(2)}</strong>
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
                    onClick={() => handleRecompute(threshold)}
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
                      boxShadow: hasUnappliedChanges ? '0 0 24px rgba(245, 158, 11, 0.4)' : '0 0 20px rgba(139, 92, 246, 0.25)'
                    }}
                  >
                    {recomputing ? (
                      <>
                        <RefreshCw size={15} className="animate-spin" />
                        <span>Re-scoring 80 Records...</span>
                      </>
                    ) : hasUnappliedChanges ? (
                      <>
                        <Zap size={15} />
                        <span>Re-score Batch at Î» = {threshold.toFixed(2)}</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={15} />
                        <span>Batch Re-scored & Synced</span>
                      </>
                    )}
                  </motion.button>

                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {recomputing ? (
                      <span style={{ color: '#FBBF24', fontWeight: '700' }}>âš¡ Evaluating candidate scores against ground truth...</span>
                    ) : justApplied ? (
                      <span style={{ color: '#34D399', fontWeight: '700' }}>âœ“ Batch re-scored in {lastRecomputeTime}ms Â· Updated</span>
                    ) : hasUnappliedChanges ? (
                      <span style={{ color: '#F59E0B', fontWeight: '600' }}>âš  Threshold changed â€” click button to recompute</span>
                    ) : (
                      <span>â— Engine idle and verified with Merkle root</span>
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
                  onChange={(e) => setThreshold(parseFloat(e.target.value))}
                  style={{
                    width: '100%',
                    accentColor: hasUnappliedChanges ? '#F59E0B' : '#8B5CF6',
                    height: '8px',
                    cursor: 'pointer',
                    borderRadius: '4px'
                  }}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                  <span>0.50 (Permissive / High Velocity)</span>
                  <span style={{ color: '#8B5CF6', fontWeight: '800' }}>Configured default: 0.75</span>
                  <span>0.95 (Ultra-Conservative / High Precision)</span>
                </div>

                {/* Standard Presets */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                  {[
                    { val: 0.65, label: '0.65 (High Velocity)' },
                    { val: 0.75, label: '0.75 (Default)' },
                    { val: 0.85, label: '0.85' }
                  ].map((preset) => {
                    const isActive = Math.abs(threshold - preset.val) < 0.01;
                    return (
                      <motion.button
                        key={preset.val}
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => {
                          setThreshold(preset.val);
                          handleRecompute(preset.val);
                        }}
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
                          color: isActive ? '#8B5CF6' : '#CBD5E1',
                          boxShadow: isActive ? '0 0 12px rgba(139, 92, 246, 0.3)' : 'none'
                        }}
                      >
                        {preset.label}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Real-time Business Interpretation Banner with Spring Entrance */}
              <motion.div
                key={policyInsight.title}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
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
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: policyInsight.color, flexShrink: 0, boxShadow: `0 0 8px ${policyInsight.color}` }} />
                <div>
                  <span style={{ fontSize: '11.5px', fontWeight: '800', color: policyInsight.color, textTransform: 'uppercase' }}>
                    {policyInsight.title}:
                  </span>
                  <span style={{ fontSize: '12px', color: '#CBD5E1', marginLeft: '8px' }}>
                    {policyInsight.desc}
                  </span>
                </div>
              </motion.div>
            </div>

            {/* EXECUTIVE FINANCIAL METRICS (Dynamic Animated Counter Cards) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '26px' }}>
              <motion.div
                whileHover={{ y: -2 }}
                className="metric-card"
                style={{ borderLeft: '3px solid #34D399', background: 'rgba(11, 17, 33, 0.85)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="metric-label">Bank Match Rate</span>
                  <span style={{ fontSize: '10px', color: '#34D399', fontWeight: '700' }}>AUTOMATION</span>
                </div>
                <span className="metric-value font-mono" style={{ color: '#34D399' }}>
                  {financialStats.cleanRatePercent == null ? 'Not available' : <AnimatedPercent value={financialStats.cleanRatePercent} />}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {financialStats.matchedRecords} of {financialStats.totalRecords} bank records matched
                </span>
              </motion.div>

              <motion.div
                whileHover={{ y: -2 }}
                className="metric-card"
                style={{ borderLeft: '3px solid #8B5CF6', background: 'rgba(11, 17, 33, 0.85)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="metric-label">Matched Bank Amount</span>
                  <span style={{ fontSize: '10px', color: '#8B5CF6', fontWeight: '700' }}>LIQUIDITY</span>
                </div>
                <span className="metric-value font-mono" style={{ color: '#8B5CF6' }}>
                  <AnimatedRupee value={financialStats.unblockedRaw} />
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Observed amount among matched bank records
                </span>
              </motion.div>

              <motion.div
                whileHover={{ y: -2 }}
                className="metric-card"
                style={{ borderLeft: '3px solid #FB7185', background: 'rgba(11, 17, 33, 0.85)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="metric-label">Exception Bank Amount</span>
                  <span style={{ fontSize: '10px', color: '#FB7185', fontWeight: '700' }}>EXPOSURE</span>
                </div>
                <span className="metric-value font-mono" style={{ color: '#FB7185' }}>
                  <AnimatedRupee value={financialStats.quarantinedRaw} />
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {financialStats.exceptionRecords} bank-side exceptions
                </span>
              </motion.div>

              <motion.div
                whileHover={{ y: -2 }}
                className="metric-card"
                style={{ borderLeft: '3px solid #A78BFA', background: 'rgba(11, 17, 33, 0.85)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="metric-label">Observed precision (labeled data)</span>
                  <span style={{ fontSize: '10px', color: '#A78BFA', fontWeight: '700' }}>EVALUATION</span>
                </div>
                <span className="metric-value font-mono" style={{ color: '#A78BFA' }}>
                  {currentMetrics?.precision_available ? `${(currentMetrics.precision * 100).toFixed(1)}%` : 'Not available'}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {currentMetrics?.precision_available
              ? `${currentMetrics.correct_matches} / ${currentMetrics.predicted_match_count} predicted matches correct`
              : 'No predicted matches to evaluate'}
                </span>
              </motion.div>
            </div>

            {/* SENSITIVITY TRADE-OFF CHART (With Animated Area Gradients) */}
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
                  <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#fff', margin: 0 }}>
                    {chartMode === 'financial'
                      ? 'Currency totals by threshold'
                      : 'Observed precision and recall by threshold (Precision vs. Recall)'}
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>
                    {chartMode === 'financial'
                      ? 'Visualizes how tuning acceptance cutoff (Î») directly unblocks merchant cash flow versus holding risk in escrow.'
                      : 'Empirical precision and recall from the labeled threshold sweep for this run.'}
                  </p>
                </div>

                {/* View Switcher: Financial Mode vs Auditor ML Mode */}
                <div style={{ display: 'flex', gap: '4px', background: 'rgba(255, 255, 255, 0.03)', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                  <button
                    onClick={() => setChartMode('financial')}
                    style={{
                      padding: '6px 14px',
                      fontSize: '11px',
                      fontWeight: '700',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      background: chartMode === 'financial' ? 'rgba(139, 92, 246, 0.22)' : 'transparent',
                      color: chartMode === 'financial' ? '#A78BFA' : 'var(--text-secondary)',
                      border: 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    Current run amounts (₹)
                  </button>
                  <button
                    onClick={() => setChartMode('auditor')}
                    style={{
                      padding: '6px 14px',
                      fontSize: '11px',
                      fontWeight: '700',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      background: chartMode === 'auditor' ? 'rgba(167, 139, 250, 0.22)' : 'transparent',
                      color: chartMode === 'auditor' ? '#C4B5FD' : 'var(--text-secondary)',
                      border: 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    Labeled sweep metrics (%)
                  </button>
                </div>
              </div>

              {/* Legend */}
              <div style={{ display: 'flex', gap: '22px', fontSize: '12px', fontWeight: '700', marginBottom: '16px' }}>
                {chartMode === 'financial' ? (
                  <>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#8B5CF6' }}>
                      <span style={{ width: '12px', height: '4px', background: '#8B5CF6', borderRadius: '2px', boxShadow: '0 0 8px rgba(139, 92, 246, 0.5)' }} /> Matched Bank Amount (₹)
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#FB7185' }}>
                      <span style={{ width: '12px', height: '4px', background: '#FB7185', borderRadius: '2px', boxShadow: '0 0 8px rgba(251, 113, 133, 0.5)' }} /> Quarantined Risk in Escrow (₹)
                    </span>
                  </>
                ) : (
                  <>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#34D399' }}>
                      <span style={{ width: '12px', height: '4px', background: '#34D399', borderRadius: '2px', boxShadow: '0 0 8px rgba(52, 211, 153, 0.5)' }} /> Precision Rate (Audit Rigor)
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#8B5CF6' }}>
                      <span style={{ width: '12px', height: '4px', background: '#8B5CF6', borderRadius: '2px', boxShadow: '0 0 8px rgba(139, 92, 246, 0.5)' }} /> Observed recall
                    </span>
                  </>
                )}
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#F59E0B' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B', boxShadow: '0 0 8px rgba(245, 158, 11, 0.6)' }} /> Active Cutoff (Î» = {threshold.toFixed(2)})
                </span>
              </div>

              {/* SVG Chart with Smooth Visual Glows */}
              <div style={{ overflowX: 'auto', textAlign: 'center', padding: '6px 0' }}>
                <svg width={svgWidth} height={svgHeight} style={{ overflow: 'visible', margin: '0 auto', display: 'block' }}>
                  <defs>
                    <linearGradient id="unblockedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.0" />
                    </linearGradient>
                    <linearGradient id="quarantineGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FB7185" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#FB7185" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Y-Axis Grid Lines & Labels */}
                  {chartMode === 'financial'
                    ? [1800000, 1400000, 1000000, 600000, 200000].map((amt) => {
                        const y = getSvgYRupees(amt);
                        return (
                          <g key={amt}>
                            <line x1={padLeft} y1={y} x2={svgWidth - padRight} y2={y} stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="4 4" />
                            <text x={padLeft - 12} y={y + 4} textAnchor="end" fill="#64748B" fontSize="10.5px" fontFamily="monospace">
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
                            <text x={padLeft - 12} y={y + 4} textAnchor="end" fill="#64748B" fontSize="10.5px" fontFamily="monospace">
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
                          stroke={isOptimal ? 'rgba(52, 211, 153, 0.25)' : 'rgba(255, 255, 255, 0.04)'}
                          strokeDasharray={isOptimal ? 'none' : '2 2'}
                        />
                        <text
                          x={x}
                          y={svgHeight - padBottom + 16}
                          textAnchor="middle"
                          fill={isOptimal ? '#34D399' : '#64748B'}
                          fontSize="10.5px"
                          fontWeight={isOptimal ? '800' : '500'}
                          fontFamily="monospace"
                        >
                          {t.toFixed(2)}
                        </text>
                        {isOptimal && (
                          <text x={x} y={svgHeight - padBottom + 28} textAnchor="middle" fill="#34D399" fontSize="9.5px" fontWeight="700">
                            â˜… Current threshold
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* Polylines with Sleek Styling */}
                  {chartMode === 'financial' ? (
                    <text x={svgWidth / 2} y={svgHeight / 2} textAnchor="middle" fill="#94A3B8" fontSize="13px">
                      Currency totals are not available for threshold sweep points.
                    </text>
                  ) : !displayPoints.length ? (
                    <text x={svgWidth / 2} y={svgHeight / 2} textAnchor="middle" fill="#94A3B8" fontSize="13px">
                      Labeled threshold sweep is not available for this run.
                    </text>
                  ) : (
                    <>
                      <polyline fill="none" stroke="#34D399" strokeWidth="3.5" points={precisionPoly} strokeLinecap="round" strokeLinejoin="round" />
                      <polyline fill="none" stroke="#8B5CF6" strokeWidth="3.5" points={recallPoly} strokeLinecap="round" strokeLinejoin="round" />
                    </>
                  )}

                  {/* Active Cutoff Marker Vertical Line */}
                  <line
                    x1={activeX}
                    y1={padTop - 8}
                    x2={activeX}
                    y2={svgHeight - padBottom}
                    stroke="#F59E0B"
                    strokeWidth="2.5"
                    strokeDasharray="4 3"
                  />

                  {/* Active Marker Floating Badge */}
                  <g transform={`translate(${activeX}, ${padTop - 12})`}>
                    <rect x="-34" y="-14" width="68" height="20" rx="4" fill="#F59E0B" />
                    <text x="0" y="0" textAnchor="middle" fill="#000" fontSize="10px" fontWeight="900" fontFamily="monospace">
                      Î»={threshold.toFixed(2)}
                    </text>
                  </g>
                </svg>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
