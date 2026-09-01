import React, { useState } from 'react';
import {
  UploadCloud,
  Database,
  Layers,
  Sparkles,
  AlertTriangle,
  AlertOctagon,
  Sliders,
  Cpu,
  MessageSquare,
  FileText,
  ShieldCheck,
  BarChart3,
  Zap,
  Building2,
  FileCheck,
  Scale,
  GitCompare,
  LayoutGrid,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';

export default function Sidebar({ currentView, setView, summary }) {
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [isSidebarCompact, setIsSidebarCompact] = useState(false);

  const toggleGroup = (groupId) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  const exceptionCount = (summary?.exception_bank_count || 0) + (summary?.exception_ledger_count || 0);
  const discrepancyCount = summary?.matched_discrepancy_count || 0;

  const groups = [
    {
      title: "Core Evidence & Flow",
      id: "evidence",
      items: [
        { id: "upload", label: "Upload & Ingest Datasets", icon: UploadCloud },
        { id: "transactions", label: "Evidence Grid", icon: LayoutGrid },
        { id: "nodal", label: "Escrow Nodal Flow", icon: Building2 },
        { id: "sources", label: "Data Sources & Ingestion", icon: Database }
      ]
    },
    {
      title: "Decision & Risk Intelligence",
      id: "decisions",
      items: [
        { id: "analytics", label: "Executive Analytics", icon: BarChart3 },
        { id: "scenarios", label: "Policy Scenarios", icon: GitCompare },
        {
          id: "discrepancies",
          label: "Discrepancy Queue",
          icon: AlertTriangle,
          count: discrepancyCount > 0 ? discrepancyCount : null,
          countType: "warning"
        },
        {
          id: "exceptions",
          label: "Quarantined Exceptions",
          icon: AlertOctagon,
          count: exceptionCount > 0 ? exceptionCount : null,
          countType: "danger"
        },
        { id: "playground", label: "Threshold Playground", icon: Sliders }
      ]
    },
    {
      title: "Autonomous Action",
      id: "actions",
      items: [
        { id: "erp-vouchers", label: "ERP Vouchers", icon: FileCheck },
        { id: "bank-disputes", label: "Bank Disputes", icon: Scale },
        { id: "rules", label: "Auto-Resolution Rules", icon: Zap }
      ]
    },
    {
      title: "AI & Audit Compliance",
      id: "compliance",
      items: [
        { id: "assistant", label: "AI Treasury Copilot", icon: MessageSquare },
        { id: "agents", label: "Multi-Agent Trace", icon: Cpu },
        { id: "compliance", label: "Audit & Cryptography", icon: ShieldCheck },
        { id: "report", label: "Statutory Dossier Export", icon: FileText }
      ]
    }
  ];

  return (
    <LayoutGroup id="sidebar-layout-group">
      <aside
        className="sidebar"
        style={{
          width: isSidebarCompact ? '68px' : '260px',
          minWidth: isSidebarCompact ? '68px' : '260px',
          transition: 'width 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex',
          flexDirection: 'column',
          userSelect: 'none',
          height: '100vh',
          boxSizing: 'border-box',
          background: 'var(--bg-sidebar)',
          borderRight: '1px solid var(--line-subtle)',
          overflow: 'hidden'
        }}
      >
        {/* Brand Header */}
        <div
          className="sidebar-header"
          style={{
            padding: isSidebarCompact ? '12px 10px' : '16px 18px',
            height: '56px',
            boxSizing: 'border-box',
            borderBottom: '1px solid var(--line-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isSidebarCompact ? 'center' : 'space-between',
            width: '100%'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <motion.div
              className="brand-badge"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsSidebarCompact(!isSidebarCompact)}
              style={{ cursor: 'pointer' }}
              title={isSidebarCompact ? "Click to expand sidebar" : "Click to collapse sidebar"}
            >
              RX
            </motion.div>
            {!isSidebarCompact && (
              <div>
                <div className="brand-title">ReconX</div>
                <div className="brand-sub">Autonomous Financial Intelligence</div>
              </div>
            )}
          </div>

          {/* Toggle Button */}
          <button
            onClick={() => setIsSidebarCompact(!isSidebarCompact)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.color = '#fff';
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.color = 'var(--text-muted)';
              e.currentTarget.style.background = 'transparent';
            }}
            title={isSidebarCompact ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isSidebarCompact ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        {/* Navigation Sections */}
        <div
          className="sidebar-nav"
          style={{
            padding: isSidebarCompact ? '12px 0' : '14px 12px',
            gap: isSidebarCompact ? '8px' : '14px',
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: isSidebarCompact ? 'center' : 'stretch'
          }}
        >
          {groups.map((g, gIdx) => {
            const isCollapsed = collapsedGroups[g.id] && !isSidebarCompact;

            return (
              <div
                key={g.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3px',
                  width: isSidebarCompact ? '100%' : 'auto',
                  alignItems: isSidebarCompact ? 'center' : 'stretch'
                }}
              >
                {/* Group Header */}
                {!isSidebarCompact ? (
                  <div
                    onClick={() => toggleGroup(g.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 8px 5px 6px',
                      cursor: 'pointer',
                      borderRadius: '6px',
                      marginBottom: '2px'
                    }}
                    className="nav-group-header-interactive"
                  >
                    <span className="nav-group-title">{g.title}</span>
                    <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                      {isCollapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
                    </span>
                  </div>
                ) : (
                  gIdx > 0 && (
                    <div
                      style={{
                        width: '24px',
                        height: '1px',
                        background: 'rgba(255, 255, 255, 0.06)',
                        margin: '4px auto 6px auto'
                      }}
                    />
                  )
                )}

                {/* Group Items with Sliding Active Glider */}
                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.div
                      initial={isSidebarCompact ? { opacity: 1 } : { opacity: 0, height: 0 }}
                      animate={isSidebarCompact ? { opacity: 1 } : { opacity: 1, height: 'auto' }}
                      exit={isSidebarCompact ? { opacity: 1 } : { opacity: 0, height: 0 }}
                      transition={{ duration: 0.16, ease: 'easeOut' }}
                      style={{
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: isSidebarCompact ? '4px' : '2px',
                        alignItems: isSidebarCompact ? 'center' : 'stretch',
                        width: '100%'
                      }}
                    >
                      {g.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = currentView === item.id;

                        if (isSidebarCompact) {
                          /* Compact Centered Icon Pill with Glider */
                          return (
                            <div
                              key={item.id}
                              onClick={() => setView(item.id)}
                              title={item.count ? `${item.label} (${item.count} items)` : item.label}
                              style={{
                                width: '40px',
                                height: '40px',
                                margin: '0 auto',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '9px',
                                cursor: 'pointer',
                                position: 'relative',
                                color: isActive ? '#C7D2FE' : 'var(--text-muted)',
                                transition: 'color 0.15s ease'
                              }}
                            >
                              {isActive && (
                                <motion.div
                                  layoutId="compactSidebarActiveGlider"
                                  transition={{ type: 'spring', stiffness: 500, damping: 36 }}
                                  style={{
                                    position: 'absolute',
                                    inset: 0,
                                    background: 'rgba(115, 120, 255, 0.18)',
                                    border: '1px solid rgba(115, 120, 255, 0.38)',
                                    borderRadius: '9px',
                                    boxShadow: '0 0 12px rgba(115, 120, 255, 0.15)',
                                    zIndex: 0
                                  }}
                                />
                              )}

                              <Icon size={17} style={{ flexShrink: 0, position: 'relative', zIndex: 1 }} />

                              {/* Alert Dot */}
                              {item.count && (
                                <span
                                  style={{
                                    position: 'absolute',
                                    top: '6px',
                                    right: '6px',
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    background: item.countType === 'danger' ? '#F87171' : '#FBBF24',
                                    boxShadow: `0 0 6px ${item.countType === 'danger' ? '#F87171' : '#FBBF24'}`,
                                    zIndex: 2
                                  }}
                                />
                              )}
                            </div>
                          );
                        }

                        /* Expanded Full-Width Row with Smooth Sliding Capsule */
                        return (
                          <div
                            key={item.id}
                            className="nav-item"
                            onClick={() => setView(item.id)}
                            style={{
                              position: 'relative',
                              padding: '7px 10px',
                              justifyContent: 'space-between',
                              minHeight: '34px',
                              borderRadius: '7px',
                              cursor: 'pointer',
                              border: 'none',
                              background: 'transparent'
                            }}
                          >
                            {isActive && (
                              <motion.div
                                layoutId="expandedSidebarActiveGlider"
                                transition={{ type: 'spring', stiffness: 500, damping: 36 }}
                                style={{
                                  position: 'absolute',
                                  inset: 0,
                                  background: 'linear-gradient(90deg, rgba(115, 120, 255, 0.18) 0%, rgba(155, 123, 255, 0.06) 100%)',
                                  border: '1px solid rgba(115, 120, 255, 0.38)',
                                  borderRadius: '7px',
                                  boxShadow: '0 0 14px rgba(115, 120, 255, 0.12)',
                                  zIndex: 0
                                }}
                              />
                            )}

                            <div
                              className="nav-item-left"
                              style={{
                                gap: '10px',
                                minWidth: 0,
                                flex: 1,
                                position: 'relative',
                                zIndex: 1
                              }}
                            >
                              <Icon
                                size={15}
                                style={{
                                  flexShrink: 0,
                                  color: isActive ? '#C7D2FE' : 'var(--text-muted)'
                                }}
                              />
                              <span
                                style={{
                                  fontSize: '12px',
                                  fontWeight: isActive ? '700' : '500',
                                  color: isActive ? '#fff' : 'var(--text-secondary)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}
                              >
                                {item.label}
                              </span>
                            </div>

                            {/* Minimalist, subtle count indicator */}
                            {item.count && (
                              <span
                                style={{
                                  position: 'relative',
                                  zIndex: 1,
                                  fontSize: '10px',
                                  fontFamily: 'var(--font-mono)',
                                  fontWeight: '700',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  background:
                                    item.countType === 'danger'
                                      ? 'rgba(239, 68, 68, 0.14)'
                                      : 'rgba(245, 158, 11, 0.14)',
                                  color:
                                    item.countType === 'danger'
                                      ? '#F87171'
                                      : '#FBBF24',
                                  border:
                                    item.countType === 'danger'
                                      ? '1px solid rgba(239, 68, 68, 0.25)'
                                      : '1px solid rgba(245, 158, 11, 0.25)',
                                  lineHeight: '1.3',
                                  flexShrink: 0
                                }}
                              >
                                {item.count}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Footer Attestation */}
        <div
          style={{
            padding: isSidebarCompact ? '12px 8px' : '12px 16px',
            borderTop: '1px solid var(--line-subtle)',
            fontSize: '10.5px',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isSidebarCompact ? 'center' : 'flex-start',
            gap: '7px',
            background: 'rgba(12, 18, 32, 0.4)',
            flexShrink: 0
          }}
          title="Stanford CRC α ≤ 0.001 Certified"
        >
          <ShieldCheck size={14} color="var(--semantic-success)" style={{ flexShrink: 0 }} />
          {!isSidebarCompact && (
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Stanford CRC α ≤ 0.001 Certified
            </span>
          )}
        </div>
      </aside>
    </LayoutGroup>
  );
}
