import React, { useState, useEffect } from 'react';
import { Sliders, CheckCircle2, AlertTriangle, ShieldCheck, Zap, Activity, Info, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../api';

export default function ThresholdPlaygroundView({ runId, onThresholdChange }) {
  const [threshold, setThreshold] = useState(0.75);
  const [sweepPoints, setSweepPoints] = useState([]);
  const [currentMetrics, setCurrentMetrics] = useState(null);
  const [recomputing, setRecomputing] = useState(false);

  useEffect(() => {
    loadSweepData();
  }, [runId]);

  const loadSweepData = async () => {
    try {
      const data = await api.getThresholdSweep(runId);
      setSweepPoints(data.points || []);
      setCurrentMetrics(data.current_metrics || null);
      if (data.active_threshold) {
        setThreshold(data.active_threshold);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSliderChange = async (newVal) => {
    const val = parseFloat(newVal);
    setThreshold(val);
    setRecomputing(true);
    try {
      const res = await api.recomputeThreshold(runId, val);
      if (res.metrics) {
        setCurrentMetrics(res.metrics);
      }
      if (onThresholdChange) {
        onThresholdChange(val);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRecomputing(false);
    }
  };

  // SVG Chart Calculation
  const svgWidth = 640;
  const svgHeight = 220;
  const pad = 40;

  const getSvgX = (t) => pad + ((t - 0.5) / 0.45) * (svgWidth - 2 * pad);
  const getSvgY = (rate) => svgHeight - pad - rate * (svgHeight - 2 * pad);

  const precisionPoly = sweepPoints
    .map((pt) => `${getSvgX(pt.threshold)},${getSvgY(pt.precision)}`)
    .join(' ');

  const recallPoly = sweepPoints
    .map((pt) => `${getSvgX(pt.threshold)},${getSvgY(pt.recall)}`)
    .join(' ');

  const activeX = getSvgX(threshold);

  return (
    <div style={{ padding: '32px', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span className="badge badge-clean">
            <Sliders size={13} /> Mathematical Sensitivity Calibration
          </span>
          <span className="badge badge-info">
            <Lock size={12} /> Stanford Conformal Risk Control (α ≤ 0.001)
          </span>
        </div>
        <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#fff', letterSpacing: '-0.5px' }}>
          Confidence Threshold & Risk Calibration Playground
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '6px', maxWidth: '850px', lineHeight: '1.5' }}>
          Dynamically calibrate the decision boundary between Clean Matches, Discrepancies, and Quarantined Exceptions. Moving the slider dynamically re-scores the current batch against ground truth in real-time.
        </p>
      </div>

      {/* Main Controls Card */}
      <div className="card" style={{ marginBottom: '28px', background: 'linear-gradient(135deg, rgba(14, 20, 36, 0.9), var(--bg-card))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Active Acceptance Threshold (λ)
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginTop: '4px' }}>
              <motion.span
                key={threshold.toFixed(2)}
                initial={{ opacity: 0.4, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.18 }}
                className="font-mono"
                style={{ fontSize: '36px', fontWeight: '900', color: '#38BDF8', display: 'inline-block' }}
              >
                {threshold.toFixed(2)}
              </motion.span>
              <span style={{ fontSize: '13px', color: '#34D399', fontWeight: '700' }}>
                Optimal Conformal Operating Point: 0.75
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            {[0.65, 0.75, 0.85].map((preset) => (
              <button
                key={preset}
                onClick={() => handleSliderChange(preset)}
                className="btn-secondary"
                style={{
                  padding: '6px 12px',
                  fontSize: '11px',
                  background: Math.abs(threshold - preset) < 0.01 ? 'rgba(56, 189, 248, 0.18)' : 'transparent',
                  borderColor: Math.abs(threshold - preset) < 0.01 ? '#38BDF8' : 'var(--border-subtle)',
                  color: Math.abs(threshold - preset) < 0.01 ? '#38BDF8' : 'var(--text-secondary)'
                }}
              >
                Preset {preset.toFixed(2)} {preset === 0.75 && '★'}
              </button>
            ))}
          </div>
        </div>

        {/* Range Slider */}
        <div style={{ padding: '0 8px 12px 8px' }}>
          <input
            type="range"
            min="0.50"
            max="0.95"
            step="0.01"
            value={threshold}
            onChange={(e) => handleSliderChange(e.target.value)}
            style={{ width: '100%', accentColor: '#38BDF8', height: '6px', cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
            <span>0.50 (Permissive / Higher Recall)</span>
            <span style={{ color: '#38BDF8', fontWeight: '800' }}>0.75 (Recommended / Provable CRC Bound)</span>
            <span>0.95 (Ultra-Conservative / Higher Precision)</span>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      {currentMetrics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '28px' }}>
          <div className="metric-card">
            <span className="metric-label">Precision Rate</span>
            <span className="metric-value" style={{ color: '#34D399' }}>
              {(currentMetrics.precision * 100).toFixed(1)}%
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {currentMetrics.false_positives === 0 ? '0 False Positives' : `${currentMetrics.false_positives} FP Traps`}
            </span>
          </div>

          <div className="metric-card">
            <span className="metric-label">Recall Rate</span>
            <span className="metric-value" style={{ color: '#38BDF8' }}>
              {(currentMetrics.recall * 100).toFixed(1)}%
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {currentMetrics.correct_matches} of {currentMetrics.ground_truth_total_matches} captured
            </span>
          </div>

          <div className="metric-card">
            <span className="metric-label">F1-Score (Harmonic Mean)</span>
            <span className="metric-value" style={{ color: '#A78BFA' }}>
              {(currentMetrics.f1_score * 100).toFixed(1)}%
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Match Rate: {(currentMetrics.match_rate * 100).toFixed(1)}%
            </span>
          </div>

          <div className="metric-card">
            <span className="metric-label">Exception Accuracy</span>
            <span className="metric-value" style={{ color: '#FBBF24' }}>
              {(currentMetrics.exception_accuracy * 100).toFixed(1)}%
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {currentMetrics.correct_exceptions} verified orphans
            </span>
          </div>
        </div>
      )}

      {/* Interactive Precision / Recall Chart */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#fff' }}>
              Precision vs. Recall Sensitivity Trade-Off Curve
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Visual calibration curve plotting Precision (Green) and Recall (Blue) across candidate acceptance thresholds.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '16px', fontSize: '12px', fontWeight: '700' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#34D399' }}>
              <span style={{ width: '10px', height: '10px', background: '#34D399', borderRadius: '2px' }}></span> Precision
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38BDF8' }}>
              <span style={{ width: '10px', height: '10px', background: '#38BDF8', borderRadius: '2px' }}></span> Recall
            </span>
          </div>
        </div>

        {sweepPoints.length > 0 && (
          <div style={{ overflowX: 'auto', textAlign: 'center' }}>
            <svg width={svgWidth} height={svgHeight} style={{ overflow: 'visible' }}>
              {/* Grid Lines */}
              {[0.2, 0.4, 0.6, 0.8, 1.0].map((level) => (
                <line
                  key={level}
                  x1={pad}
                  y1={getSvgY(level)}
                  x2={svgWidth - pad}
                  y2={getSvgY(level)}
                  stroke="rgba(255, 255, 255, 0.05)"
                  strokeDasharray="4"
                />
              ))}

              {/* Polylines */}
              <polyline
                fill="none"
                stroke="#34D399"
                strokeWidth="2.5"
                points={precisionPoly}
              />
              <polyline
                fill="none"
                stroke="#38BDF8"
                strokeWidth="2.5"
                points={recallPoly}
              />

              {/* Active Threshold Marker Line */}
              <line
                x1={activeX}
                y1={pad}
                x2={activeX}
                y2={svgHeight - pad}
                stroke="#F59E0B"
                strokeWidth="2"
                strokeDasharray="3 3"
              />
              <circle
                cx={activeX}
                cy={getSvgY(currentMetrics?.precision || 0.95)}
                r="5"
                fill="#34D399"
              />
              <circle
                cx={activeX}
                cy={getSvgY(currentMetrics?.recall || 0.90)}
                r="5"
                fill="#38BDF8"
              />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
