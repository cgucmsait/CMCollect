import React, { useEffect } from 'react';
import { X, AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react';

export default function CustomModal({ isOpen, onClose, title, type = 'info', children, footer }) {
  // 當 Modal 開啟時，防止背景滾動
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;
  
  const getIcon = () => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="text-yellow-500 w-8 h-8 flex-shrink-0" style={{ width: '28px', height: '28px', color: '#f1c40f' }} />;
      case 'error':
        return <X className="text-red-500 w-8 h-8 border border-red-500 rounded-full p-1 flex-shrink-0" style={{ width: '28px', height: '28px', color: '#e74c3c' }} />;
      case 'success':
        return <CheckCircle2 className="text-green-500 w-8 h-8 flex-shrink-0" style={{ width: '28px', height: '28px', color: '#2ecc71' }} />;
      default:
        return <HelpCircle className="text-amber-500 w-8 h-8 flex-shrink-0" style={{ width: '28px', height: '28px', color: 'var(--gold-primary)' }} />;
    }
  };

  return (
    <div className="modal-backdrop">
      {/* 點擊背景關閉 (僅在無自訂 footer 的一般 info modal 適用，避免誤點關閉 confirm modal) */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 }} onClick={type === 'info' || type === 'success' || type === 'error' ? onClose : undefined} />
      
      <div className="modal-content-wrapper" style={{ maxWidth: '512px', zIndex: 10 }}>
        {/* Header */}
        <div className="modal-header-area" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {getIcon()}
            <h3 className="serif-title" style={{ fontSize: '18px', fontWeight: '700', color: 'var(--gold-primary)', margin: 0 }}>{title}</h3>
          </div>
          <button 
            onClick={onClose} 
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: '4px' }} 
            type="button"
          >
            <X size={20} />
          </button>
        </div>
        {/* Content */}
        <div className="modal-body-area">
          {children}
        </div>
        {/* Footer */}
        <div className="modal-footer-area">
          {footer || (
            <button onClick={onClose} className="btn-gold" style={{ padding: '8px 16px', fontSize: '12px' }} type="button">
              確定
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
