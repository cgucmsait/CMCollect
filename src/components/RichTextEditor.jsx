import React, { useState, useRef, useEffect } from 'react';
import { 
  Bold, Italic, Underline, Strikethrough, Link as LinkIcon, 
  Unlink, RotateCcw, RotateCw, RemoveFormatting, Code, Eye
} from 'lucide-react';

export default function RichTextEditor({ value, onChange, readOnly = false }) {
  const editorRef = useRef(null);
  const [isSourceMode, setIsSourceMode] = useState(false);
  const [sourceCode, setSourceCode] = useState(value || '');
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const savedSelectionRef = useRef(null);

  // 當外部 value 更新時同步至 editor（避免使用者正在打字時游標跳掉）
  useEffect(() => {
    if (editorRef.current && !isSourceMode) {
      if (editorRef.current.innerHTML !== (value || '')) {
        editorRef.current.innerHTML = value || '';
      }
    }
    setSourceCode(value || '');
  }, [value, isSourceMode]);

  const handleInput = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      setSourceCode(html);
      onChange(html);
    }
  };

  const exec = (command, val = null) => {
    if (readOnly) return;
    document.execCommand(command, false, val);
    handleInput();
  };

  // 保存目前選取範圍以供 Modal 插入連結使用
  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedSelectionRef.current = sel.getRangeAt(0);
    }
  };

  const restoreSelection = () => {
    const sel = window.getSelection();
    if (savedSelectionRef.current && sel) {
      sel.removeAllRanges();
      sel.addRange(savedSelectionRef.current);
    }
  };

  const handleOpenLinkModal = () => {
    if (readOnly) return;
    saveSelection();
    setLinkUrl('');
    setLinkModalOpen(true);
  };

  const handleApplyLink = (e) => {
    if (e) e.preventDefault();
    setLinkModalOpen(false);
    if (!linkUrl) return;
    restoreSelection();
    let url = linkUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    document.execCommand('createLink', false, url);
    handleInput();
  };

  const handleSourceCodeChange = (e) => {
    const newHtml = e.target.value;
    setSourceCode(newHtml);
    onChange(newHtml);
  };

  const toggleMode = () => {
    if (isSourceMode) {
      setIsSourceMode(false);
    } else {
      if (editorRef.current) {
        setSourceCode(editorRef.current.innerHTML);
      }
      setIsSourceMode(true);
    }
  };

  return (
    <div className="rich-editor-wrapper" style={{ border: '1px solid rgba(212, 175, 55, 0.3)', borderRadius: '8px', overflow: 'hidden', background: '#121212', display: 'flex', flexDirection: 'column' }}>
      {/* 頂部工具列 */}
      {!readOnly && (
        <div className="rich-editor-toolbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid rgba(212, 175, 55, 0.15)', flexWrap: 'wrap', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => exec('bold')}
              disabled={isSourceMode}
              className="rich-btn"
              title="粗體 (Ctrl+B)"
            >
              <Bold size={15} />
            </button>
            <button
              type="button"
              onClick={() => exec('italic')}
              disabled={isSourceMode}
              className="rich-btn"
              title="斜體 (Ctrl+I)"
            >
              <Italic size={15} />
            </button>
            <button
              type="button"
              onClick={() => exec('underline')}
              disabled={isSourceMode}
              className="rich-btn"
              title="底線 (Ctrl+U)"
            >
              <Underline size={15} />
            </button>
            <button
              type="button"
              onClick={() => exec('strikeThrough')}
              disabled={isSourceMode}
              className="rich-btn"
              title="刪除線"
            >
              <Strikethrough size={15} />
            </button>

            <div style={{ width: '1px', height: '18px', background: 'rgba(212,175,55,0.2)', margin: '0 4px' }} />

            <button
              type="button"
              onClick={handleOpenLinkModal}
              disabled={isSourceMode}
              className="rich-btn"
              title="插入超連結"
            >
              <LinkIcon size={15} />
            </button>
            <button
              type="button"
              onClick={() => exec('unlink')}
              disabled={isSourceMode}
              className="rich-btn"
              title="移除超連結"
            >
              <Unlink size={15} />
            </button>

            <div style={{ width: '1px', height: '18px', background: 'rgba(212,175,55,0.2)', margin: '0 4px' }} />

            <button
              type="button"
              onClick={() => exec('removeFormat')}
              disabled={isSourceMode}
              className="rich-btn"
              title="清除格式"
            >
              <RemoveFormatting size={15} />
            </button>
            <button
              type="button"
              onClick={() => exec('undo')}
              disabled={isSourceMode}
              className="rich-btn"
              title="復原 (Ctrl+Z)"
            >
              <RotateCcw size={15} />
            </button>
            <button
              type="button"
              onClick={() => exec('redo')}
              disabled={isSourceMode}
              className="rich-btn"
              title="重做 (Ctrl+Y)"
            >
              <RotateCw size={15} />
            </button>
          </div>

          {/* 模式切換鈕 */}
          <button
            type="button"
            onClick={toggleMode}
            className="rich-mode-btn"
            title={isSourceMode ? "切換至可視化編輯模式" : "切換至 HTML 源代碼模式"}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '4px 10px', borderRadius: '4px', border: '1px solid rgba(212, 175, 55, 0.3)', background: isSourceMode ? 'rgba(212, 175, 55, 0.15)' : 'transparent', color: 'var(--gold-light)', cursor: 'pointer' }}
          >
            {isSourceMode ? <Eye size={13} /> : <Code size={13} />}
            <span>{isSourceMode ? '所見即所得模式' : 'HTML 源碼'}</span>
          </button>
        </div>
      )}

      {/* 編輯核心區 */}
      {isSourceMode ? (
        <textarea
          value={sourceCode}
          onChange={handleSourceCodeChange}
          readOnly={readOnly}
          style={{ width: '100%', minHeight: '180px', padding: '16px', background: '#0a0a0a', color: '#68d391', fontFamily: 'Consolas, Monaco, monospace', fontSize: '13px', lineHeight: '1.6', border: 'none', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
          placeholder="請在此輸入或編輯 HTML 源碼..."
        />
      ) : (
        <div
          ref={editorRef}
          contentEditable={!readOnly}
          onInput={handleInput}
          className="rich-editor-content"
          style={{ width: '100%', minHeight: '180px', padding: '18px 20px', color: '#f0f0f0', fontFamily: '"Open Sans", "Noto Sans TC", sans-serif', fontSize: '15px', lineHeight: '1.7', outline: 'none', boxSizing: 'border-box', overflowY: 'auto', maxHeight: '380px' }}
          data-placeholder="請在此輸入活動簡介（可選取文字套用粗體、斜體、底線或超連結）..."
        />
      )}

      {/* 插入連結 Modal */}
      {linkModalOpen && (
        <div className="modal-backdrop" style={{ zIndex: 300 }}>
          <div className="glass-card" style={{ maxWidth: '380px', width: '100%', padding: '24px', background: '#161616', border: '1px solid rgba(212, 175, 55, 0.4)', borderRadius: '8px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--gold-light)', marginBottom: '12px' }}>插入超連結</h4>
            <input
              type="url"
              placeholder="請輸入網址 (https://...)"
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              className="input-gold"
              autoFocus
              style={{ width: '100%', marginBottom: '16px', fontSize: '13px' }}
              onKeyDown={e => { if (e.key === 'Enter') handleApplyLink(e); }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setLinkModalOpen(false)}
                className="btn-outline-gold"
                style={{ padding: '6px 14px', fontSize: '12px' }}
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleApplyLink}
                className="btn-gold"
                style={{ padding: '6px 16px', fontSize: '12px' }}
              >
                確認插入
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
