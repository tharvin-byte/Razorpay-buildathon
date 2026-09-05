import React from 'react';
import { motion } from 'framer-motion';

/**
 * PageHeader — Premium reusable header for every view.
 *
 * Props:
 *   icon        — Lucide icon component (e.g. ShieldCheck)
 *   accentColor — Hex color for gradient accent bar & icon tint (default '#8B5CF6')
 *   badges      — Array of { label: string, variant?: 'clean' | 'expected' | 'discrepancy' | 'danger' }
 *   title       — Page title string
 *   description — Page subtitle/description string
 *   rightSlot   — Optional JSX to render on the right side (buttons, badges, etc.)
 */
export default function PageHeader({
  icon: Icon,
  accentColor = '#8B5CF6',
  badges = [],
  title,
  description,
  rightSlot
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      style={{
        marginBottom: '24px',
        borderRadius: '12px',
        background: `linear-gradient(135deg, ${accentColor}0D 0%, rgba(16, 12, 34, 0.6) 60%, rgba(16, 12, 34, 0.0) 100%)`,
        border: `1px solid ${accentColor}22`,
        padding: '20px 24px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Accent gradient bar at top */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '3px',
        background: `linear-gradient(90deg, ${accentColor}, ${accentColor}60, transparent)`,
        borderRadius: '12px 12px 0 0',
      }} />

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '16px',
        flexWrap: 'wrap',
      }}>
        {/* Left side: icon + text */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
          {/* Icon container */}
          {Icon && (
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: `${accentColor}14`,
              border: `1px solid ${accentColor}25`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              marginTop: '2px',
            }}>
              <Icon size={20} color={accentColor} strokeWidth={2} />
            </div>
          )}

          <div style={{ minWidth: 0 }}>
            {/* Badges row */}
            {badges.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                {badges.map((b, i) => (
                  <span
                    key={i}
                    className={`badge badge-${b.variant || 'expected'}`}
                    style={{ fontSize: '10.5px' }}
                  >
                    {b.label}
                  </span>
                ))}
              </div>
            )}

            {/* Title */}
            <h1 style={{
              fontSize: '22px',
              fontWeight: '800',
              color: '#fff',
              letterSpacing: '-0.4px',
              margin: 0,
              lineHeight: '1.3',
            }}>
              {title}
            </h1>

            {/* Description */}
            {description && (
              <p style={{
                color: 'var(--text-secondary)',
                fontSize: '13px',
                marginTop: '6px',
                maxWidth: '780px',
                lineHeight: '1.55',
                margin: '6px 0 0 0',
              }}>
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Right slot */}
        {rightSlot && (
          <div style={{ flexShrink: 0 }}>
            {rightSlot}
          </div>
        )}
      </div>
    </motion.div>
  );
}
