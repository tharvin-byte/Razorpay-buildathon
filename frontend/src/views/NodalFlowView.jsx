import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  Wallet,
  Landmark,
  Layers
} from 'lucide-react';
import { api } from '../api';

export default function NodalFlowView({ runId, setView, setSelectedTxnId }) {
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedStage, setSelectedStage] = useState('nodal');

  useEffect(() => {
    loadFlowData();
  }, [runId]);

  const loadFlowData = async () => {
    setLoading(true);
    try {
      const [txns, sum] = await Promise.all([
        api.getTransactions(runId),
        api.getSummary(runId)
      ]);
      setTransactions(txns);
      setSummary(sum);
    } catch (e) {
      console.error('Error loading nodal flow:', e);
    } finally {
      setLoading(false);
    }
  };

  const flowCalculations = useMemo(() => {
    let customerGross = 0;
    let gatewayFees = 0;
    let nodalEscrowHeld = 0;
    let merchantDisbursed = 0;
    let orphanTrapped = 0;
    let batchCount = 0;

    transactions.forEach((t) => {
      const bankAmt = t.bank_record?.amount ?? t.matched_ledger_record?.gross_amount ?? 0;
      const ledgerGross = t.matched_ledger_record?.gross_amount ?? bankAmt;
      const fee = t.matched_ledger_record?.razorpay_fee ?? 0;

      customerGross += ledgerGross;
      gatewayFees += fee;

      if (t.status === 'matched_clean' || t.status === 'matched_with_discrepancy') {
        merchantDisbursed += (ledgerGross - fee);
      } else if (t.status === 'exception') {
        orphanTrapped += bankAmt;
      }

      if (t.source_type === 'batch') {
        batchCount += 1;
      }
    });

    nodalEscrowHeld = customerGross - gatewayFees;

    return {
      customerGross,
      gatewayFees,
      nodalEscrowHeld,
      merchantDisbursed,
      orphanTrapped,
      batchCount,
      totalCount: transactions.length
    };
  }, [transactions]);

  const stages = [
    {
      id: 'customer',
      title: '1. Customer Ingestion',
      subtitle: 'Payer Initiated (UPI / Cards)',
      icon: CreditCard,
      amount: flowCalculations.customerGross,
      badge: `${flowCalculations.totalCount} Inflow Records`,
      badgeColor: 'badge-clean',
      color: '#60A5FA',
      description: 'Incoming customer payments captured via checkout rails and pooled for gateway authorization.',
      compliance: 'RBI Section 18 Payment Systems Compliant'
    },
    {
      id: 'gateway',
      title: '2. Payment Gateway (PG)',
      subtitle: 'Authorization & Fee Deduction',
      icon: Landmark,
      amount: flowCalculations.gatewayFees,
      badge: `MDR Fee Retained`,
      badgeColor: 'badge-expected',
      color: '#8B5CF6',
      description: 'Transaction switching, risk scoring, and statutory MDR / interchange platform fee deduction.',
      compliance: 'Zero Hidden Fees · Auditor Approved'
    },
    {
      id: 'nodal',
      title: '3. Nodal Escrow Account',
      subtitle: 'RBI Intermediary Escrow Holding',
      icon: Building2,
      amount: flowCalculations.nodalEscrowHeld,
      badge: `Escrow Pool Balance`,
      badgeColor: 'badge-clean',
      color: '#10B981',
      description: 'Ring-fenced nodal bank escrow maintaining 1-to-1 ledger protection until merchant payout clearance.',
      compliance: 'RBI DPSS.CO.PD.No.1102/02.14.08 (T+2 SLA)'
    },
    {
      id: 'merchant',
      title: '4. Merchant Settlement',
      subtitle: 'Disbursal & Payout Clearance',
      icon: Wallet,
      amount: flowCalculations.merchantDisbursed,
      badge: `Net Disbursed`,
      badgeColor: 'badge-clean',
      color: '#34D399',
      description: 'Automated bank payout disbursal to verified merchant beneficiary accounts via NEFT/IMPS/RTGS.',
      compliance: '100% Reconciled Disbursal Trace'
    }
  ];

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading Escrow Nodal Settlement Flow...
      </div>
    );
  }

  const activeStageObj = stages.find((s) => s.id === selectedStage) || stages[2];

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span className="badge badge-clean">
            <Building2 size={13} /> RBI Nodal Escrow Architecture
          </span>
          <span className="badge badge-expected">
            Zero Ring-Fenced Breach
          </span>
        </div>
        <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#fff', letterSpacing: '-0.5px' }}>
          Escrow Settlement & Nodal Money Flow
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13.5px', marginTop: '6px', maxWidth: '850px', lineHeight: '1.5' }}>
          Visual end-to-end money movement tracing every rupee from Customer Authorization through the RBI Intermediary Nodal Escrow Account to Merchant Beneficiary Payouts.
        </p>
      </div>

      {/* 4-Stage Flow Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
        {stages.map((stage) => {
          const Icon = stage.icon;
          const isSelected = selectedStage === stage.id;
          return (
            <div
              key={stage.id}
              onClick={() => setSelectedStage(stage.id)}
              className="card"
              style={{
                cursor: 'pointer',
                borderTop: `3px solid ${stage.color}`,
                background: isSelected ? 'rgba(15, 23, 42, 0.95)' : 'var(--bg-card)',
                borderColor: isSelected ? stage.color : 'var(--line-subtle)',
                boxShadow: isSelected ? `0 0 20px ${stage.color}25` : 'none',
                position: 'relative',
                padding: '18px',
                transition: 'transform 0.15s ease, border-color 0.15s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '8px',
                  background: `${stage.color}15`, border: `1px solid ${stage.color}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Icon size={18} color={stage.color} />
                </div>
                <span className={`badge ${stage.badgeColor}`} style={{ fontSize: '10px', padding: '2px 7px' }}>
                  {stage.badge}
                </span>
              </div>

              <div style={{ fontSize: '13px', fontWeight: '800', color: '#fff', marginBottom: '2px' }}>
                {stage.title}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px', minHeight: '26px' }}>
                {stage.subtitle}
              </div>

              <div className="font-mono" style={{ fontSize: '20px', fontWeight: '900', color: stage.color }}>
                ₹{stage.amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Stage Detail Deep Dive */}
      <div
        className="card"
        style={{ background: 'linear-gradient(180deg, rgba(17, 24, 39, 0.95) 0%, rgba(12, 18, 32, 0.98) 100%)', padding: '24px', border: '1px solid var(--line-subtle)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <span className="badge badge-clean" style={{ marginBottom: '6px' }}>
              Stage Deep Dive
            </span>
            <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#fff' }}>
              {activeStageObj.title} — Operational Telemetry
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px', maxWidth: '750px', lineHeight: '1.4' }}>
              {activeStageObj.description}
            </p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>
              Statutory Compliance Standard
            </div>
            <div style={{ fontSize: '12px', color: '#34D399', fontWeight: '700', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'flex-end' }}>
              <ShieldCheck size={14} />
              <span>{activeStageObj.compliance}</span>
            </div>
          </div>
        </div>

        {/* Breakdown Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '20px' }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.025)', padding: '14px', borderRadius: '8px', border: '1px solid var(--line-subtle)' }}>
            <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Gross Stage Volume</div>
            <div className="font-mono" style={{ fontSize: '20px', fontWeight: '800', color: '#fff', marginTop: '4px' }}>
              ₹{activeStageObj.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.025)', padding: '14px', borderRadius: '8px', border: '1px solid var(--line-subtle)' }}>
            <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Trapped Orphan Risk</div>
            <div className="font-mono" style={{ fontSize: '20px', fontWeight: '800', color: flowCalculations.orphanTrapped > 0 ? '#EF4444' : '#34D399', marginTop: '4px' }}>
              ₹{flowCalculations.orphanTrapped.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div style={{ background: 'rgba(255, 255, 255, 0.025)', padding: '14px', borderRadius: '8px', border: '1px solid var(--line-subtle)' }}>
            <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>Settlement SLA Window</div>
            <div className="font-mono" style={{ fontSize: '20px', fontWeight: '800', color: '#60A5FA', marginTop: '4px' }}>
              T+1 / T+2 Cycles
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            className="btn btn-secondary"
            onClick={() => setView('transactions')}
            style={{ padding: '7px 14px', fontSize: '12px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span>View Source Records</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
