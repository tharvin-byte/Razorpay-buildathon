import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export default function ToastContainer({ toasts, onDismiss }) {
  return (
    <div className="toast-container">
      <AnimatePresence>
        {toasts.map((toast) => {
          const isSuccess = toast.type === 'success' || !toast.type;
          const isWarning = toast.type === 'warning';
          const isError = toast.type === 'error';

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="toast-item"
              style={{
                borderColor: isSuccess ? 'var(--semantic-success)' : isWarning ? 'var(--semantic-warning)' : 'var(--semantic-danger)'
              }}
            >
              <div style={{ flexShrink: 0 }}>
                {isSuccess && <CheckCircle2 size={16} color="var(--semantic-success)" />}
                {isWarning && <AlertTriangle size={16} color="var(--semantic-warning)" />}
                {isError && <AlertCircle size={16} color="var(--semantic-danger)" />}
              </div>

              <div style={{ flex: 1 }}>
                {toast.title && <div style={{ fontWeight: '700', fontSize: '12.5px', color: '#fff' }}>{toast.title}</div>}
                <div style={{ color: 'var(--text-secondary)', fontSize: '11.5px', marginTop: toast.title ? '2px' : 0 }}>
                  {toast.message}
                </div>
              </div>

              <button
                onClick={() => onDismiss(toast.id)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
              >
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
