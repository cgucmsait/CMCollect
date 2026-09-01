import React, { useEffect } from 'react';
import { X, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

export default function Toast({ message, type = 'info', onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="toast-container">
      <div className={`toast-notification ${type}`}>
        <div className="toast-icon">
          {type === 'success' ? (
            <CheckCircle2 size={16} style={{ color: '#2ecc71' }} />
          ) : type === 'error' ? (
            <XCircle size={16} style={{ color: '#e74c3c' }} />
          ) : (
            <AlertTriangle size={16} style={{ color: '#f1c40f' }} />
          )}
        </div>
        <span className="toast-message">{message}</span>
        <button onClick={onClose} className="toast-close-btn" type="button" aria-label="Close">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
