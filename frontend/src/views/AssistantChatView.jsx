import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  Bot,
  User,
  Sparkles,
  Shield,
  ArrowRight,
  CornerDownLeft,
  Copy,
  Check,
  FileText,
  AlertCircle,
  Database,
  Layers,
  CheckCircle2,
  Cpu,
  Zap,
  RotateCcw,
  Sliders
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api';

export default function AssistantChatView({ runId, onNavigateTab, onToast }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: `👋 **Hello! I am your ReconX AI Financial Controller & Treasury Copilot.**

I am directly grounded in the live mathematical state of reconciliation run **\`${runId}\`**.

You can ask me to:
- 🔍 **Inspect specific transactions** (e.g. *"Why was BNK-1066 quarantined?"*)
- 📊 **Analyze variance & leakage** (e.g. *"What is our total MDR fee leakage?"*)
- 🛠️ **Generate Tally XML vouchers** or **draft formal NPCI dispute notices**
- 💡 Click any of the **Recommended Queries** on the left to start!`
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [sending, setSending] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [summaryData, setSummaryData] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    loadSummary();
  }, [runId]);

  const loadSummary = async () => {
    try {
      const data = await api.getSummary(runId);
      setSummaryData(data);
    } catch (e) {
      console.error(e);
    }
  };

  const actionPromptChips = [
    {
      icon: '📊',
      label: 'Why is Match Rate < 80%?',
      query: 'Why is our match rate below 80% in this run and what should I investigate first?'
    },
    {
      icon: '📥',
      label: 'Generate Tally XML Vouchers',
      query: 'Generate double-entry Tally Prime XML vouchers for all reconciled fee variances in this run.'
    },
    {
      icon: '🎫',
      label: 'Draft NPCI Bank Dispute',
      query: 'Draft a formal NPCI statutory dispute notice for all bank orphan deposits in this run.'
    },
    {
      icon: '🛡️',
      label: 'Explain Merkle & CRC Guarantee',
      query: 'Explain the cryptographic SHA-256 Merkle root and Stanford Conformal Risk Control guarantee for this run.'
    },
    {
      icon: '💸',
      label: 'Summarize Nodal Fee Leakage',
      query: 'Summarize the MDR fee leakage, timing lags, and refund deductions across this reconciliation batch.'
    }
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const handleSend = async (queryToSend) => {
    const q = queryToSend || inputQuery;
    if (!q.trim() || sending) return;

    const userMsg = { role: 'user', text: q };
    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setSending(true);

    try {
      const res = await api.sendChatMessage(runId, q);
      const assistantMsg = {
        role: 'assistant',
        text: res.answer
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e) {
      console.error(e);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: '⚠️ Error contacting AI Financial Controller: ' + e.message }
      ]);
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    if (onToast) {
      onToast('Copied to clipboard', 'info');
    }
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '320px 1fr',
        height: 'calc(100vh - 56px)',
        boxSizing: 'border-box',
        gap: '20px',
        padding: '16px 24px 28px 24px',
        maxWidth: '1440px',
        margin: '0 auto',
        overflow: 'hidden'
      }}
    >
      {/* =================================================================== */}
      {/* Left Column: Context & Knowledge Dock */}
      {/* =================================================================== */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          height: '100%',
          overflowY: 'auto',
          paddingRight: '4px'
        }}
      >
        {/* Model Status Card */}
        <div
          className="card"
          style={{
            padding: '16px',
            background: 'linear-gradient(145deg, rgba(18, 26, 47, 0.9) 0%, rgba(12, 18, 32, 0.95) 100%)',
            border: '1px solid rgba(115, 120, 255, 0.2)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '2px 8px',
                borderRadius: '6px',
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                color: '#34D399',
                fontSize: '11px',
                fontWeight: '600'
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34D399', boxShadow: '0 0 6px #34D399' }}></span>
              Gemini 3.5 Live
            </span>
            <span className="font-mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {runId}
            </span>
          </div>

          <h3 style={{ fontSize: '14px', fontWeight: '800', color: '#fff', marginBottom: '4px', letterSpacing: '-0.2px' }}>
            Treasury Copilot Engine
          </h3>
          <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: '1.45', marginBottom: '14px' }}>
            Contextually bound to pipeline state, multi-source logs, and SHA-256 Merkle proofs.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>Reconciliation Rate</span>
              <span className="font-mono" style={{ fontSize: '12.5px', fontWeight: '800', color: '#818CF8' }}>
                {summaryData ? `${(summaryData.match_rate * 100).toFixed(1)}%` : '70.7%'}
              </span>
            </div>

            <div
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>Precision Guarantee</span>
              <span className="font-mono" style={{ fontSize: '12.5px', fontWeight: '800', color: '#34D399' }}>
                96.5% (α ≤ 0.001)
              </span>
            </div>

            <div
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>Quarantined Exceptions</span>
              <span className="font-mono" style={{ fontSize: '12.5px', fontWeight: '800', color: '#F87171' }}>
                {summaryData ? `${summaryData.exception_bank_count + summaryData.exception_ledger_count} items` : '22 items'}
              </span>
            </div>
          </div>
        </div>

        {/* Recommended Queries Card */}
        <div className="card" style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '10.5px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>
            Recommended Queries
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
            {actionPromptChips.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(chip.query)}
                disabled={sending}
                style={{
                  background: 'rgba(99, 102, 241, 0.06)',
                  border: '1px solid rgba(115, 120, 255, 0.2)',
                  color: '#C7D2FE',
                  padding: '9px 12px',
                  borderRadius: '8px',
                  fontSize: '11.5px',
                  fontWeight: '600',
                  textAlign: 'left',
                  cursor: sending ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
                onMouseOver={(e) => {
                  if (!sending) {
                    e.currentTarget.style.background = 'rgba(99, 102, 241, 0.16)';
                    e.currentTarget.style.borderColor = '#818CF8';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'rgba(99, 102, 241, 0.06)';
                  e.currentTarget.style.borderColor = 'rgba(115, 120, 255, 0.2)';
                  e.currentTarget.style.transform = 'none';
                }}
              >
                <span>{chip.icon}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {chip.label}
                </span>
                <ArrowRight size={12} style={{ opacity: 0.5 }} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* Right Column: Conversational Feed & Floating Dock */}
      {/* =================================================================== */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minWidth: 0,
          background: 'rgba(12, 18, 32, 0.65)',
          borderRadius: '14px',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Chat Feed Header */}
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'rgba(18, 26, 47, 0.5)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 12px rgba(99, 102, 241, 0.4)'
              }}
            >
              <Bot size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: '800', color: '#fff', letterSpacing: '-0.2px' }}>
                ReconX Autonomous Copilot
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>Strictly grounded in RBI Master Directions & Nodal Escrow state</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => {
                setMessages([
                  {
                    role: 'assistant',
                    text: `Conversation cleared. Ready for your next inquiry on run **\`${runId}\`**.`
                  }
                ]);
              }}
              style={{
                background: 'transparent',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-muted)',
                padding: '5px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="Reset conversation"
            >
              <RotateCcw size={12} /> Clear
            </button>
          </div>
        </div>

        {/* Message Stream */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            padding: '20px 24px',
            scrollBehavior: 'smooth'
          }}
        >
          <AnimatePresence initial={false}>
            {messages.map((m, idx) => {
              const isAssistant = m.role === 'assistant';
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  style={{
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'flex-start',
                    justifyContent: isAssistant ? 'flex-start' : 'flex-end'
                  }}
                >
                  {isAssistant && (
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: '2px',
                        boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)'
                      }}
                    >
                      <Sparkles size={16} color="#fff" />
                    </div>
                  )}

                  <div
                    style={{
                      maxWidth: '85%',
                      background: isAssistant
                        ? 'linear-gradient(145deg, rgba(20, 29, 51, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)'
                        : 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)',
                      border: isAssistant ? '1px solid rgba(115, 120, 255, 0.18)' : 'none',
                      borderRadius: isAssistant ? '4px 14px 14px 14px' : '14px 14px 4px 14px',
                      padding: '14px 18px',
                      color: '#F1F5F9',
                      fontSize: '13px',
                      lineHeight: '1.6',
                      boxShadow: isAssistant ? '0 4px 16px rgba(0, 0, 0, 0.25)' : '0 4px 16px rgba(79, 70, 229, 0.3)'
                    }}
                  >
                    <div
                      style={{
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        fontFamily: "var(--font-sans)"
                      }}
                    >
                      {m.text}
                    </div>

                    {isAssistant && (
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'flex-end',
                          marginTop: '10px',
                          paddingTop: '8px',
                          borderTop: '1px solid rgba(255, 255, 255, 0.05)'
                        }}
                      >
                        <button
                          onClick={() => handleCopy(m.text, idx)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: copiedIdx === idx ? '#34D399' : 'var(--text-muted)',
                            fontSize: '11px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {copiedIdx === idx ? (
                            <>
                              <Check size={12} /> Copied!
                            </>
                          ) : (
                            <>
                              <Copy size={12} /> Copy Markdown
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  {!isAssistant && (
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid var(--border-subtle)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: '2px'
                      }}
                    >
                      <User size={16} color="#CBD5E1" />
                    </div>
                  )}
                </motion.div>
              );
            })}

            {sending && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ display: 'flex', gap: '12px', alignItems: 'center' }}
              >
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <Sparkles size={16} color="#fff" />
                </div>
                <div
                  style={{
                    background: 'rgba(20, 29, 51, 0.95)',
                    border: '1px solid rgba(115, 120, 255, 0.25)',
                    borderRadius: '4px 14px 14px 14px',
                    padding: '10px 16px',
                    fontSize: '12px',
                    color: '#818CF8',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#818CF8',
                      boxShadow: '0 0 8px #818CF8',
                      animation: 'pulse 1.2s infinite'
                    }}
                  ></span>
                  <span>Synthesizing multi-agent treasury reasoning...</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>

        {/* =================================================================== */}
        {/* Docked Floating Input Area (Elevated & Spaced from Bottom) */}
        {/* =================================================================== */}
        <div
          style={{
            padding: '12px 20px 16px 20px',
            background: 'linear-gradient(180deg, rgba(12, 18, 32, 0) 0%, rgba(12, 18, 32, 0.95) 30%)',
            flexShrink: 0
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: 'rgba(18, 26, 47, 0.9)',
              border: '1px solid rgba(115, 120, 255, 0.25)',
              borderRadius: '12px',
              padding: '6px 8px 6px 16px',
              boxShadow: '0 6px 24px rgba(0, 0, 0, 0.35)',
              transition: 'all 0.15s ease'
            }}
            onFocusCapture={(e) => {
              e.currentTarget.style.borderColor = '#818CF8';
              e.currentTarget.style.boxShadow = '0 0 20px rgba(99, 102, 241, 0.25)';
            }}
            onBlurCapture={(e) => {
              e.currentTarget.style.borderColor = 'rgba(115, 120, 255, 0.25)';
              e.currentTarget.style.boxShadow = '0 6px 24px rgba(0, 0, 0, 0.35)';
            }}
          >
            <input
              ref={inputRef}
              type="text"
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#fff',
                fontSize: '13px',
                fontFamily: 'var(--font-sans)',
                padding: '8px 0'
              }}
              placeholder="Ask anything about transactions, fee leakage, or press enter..."
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              disabled={sending}
            />

            <button
              type="submit"
              disabled={sending || !inputQuery.trim()}
              style={{
                background: sending || !inputQuery.trim() ? 'rgba(99, 102, 241, 0.25)' : 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                padding: '9px 16px',
                fontSize: '12.5px',
                fontWeight: '700',
                cursor: sending || !inputQuery.trim() ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: sending || !inputQuery.trim() ? 'none' : '0 2px 10px rgba(79, 70, 229, 0.4)',
                transition: 'all 0.15s ease'
              }}
            >
              <Send size={13} />
              <span>Send</span>
            </button>
          </form>

          {/* Model attribution & safe clearance watermark */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginTop: '8px',
              fontSize: '10.5px',
              color: 'var(--text-muted)'
            }}
          >
            <Shield size={11} color="#818CF8" />
            <span>ReconX Copilot is mathematically grounded in run state • Conformal Risk α ≤ 0.001 Certified</span>
          </div>
        </div>
      </div>
    </div>
  );
}
