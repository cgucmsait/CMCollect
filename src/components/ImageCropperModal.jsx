import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Check, Move } from 'lucide-react';

export default function ImageCropperModal({ isOpen, imageSrc, onCancel, onCropComplete }) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imgElement, setImgElement] = useState(null);
  const [imgNaturalSize, setImgNaturalSize] = useState({ width: 0, height: 0 });

  const containerSize = 360; // 預覽視窗大小 (1:1 正方形)
  const previewRef = useRef(null);

  // 載入圖片並初始化置中比例
  useEffect(() => {
    if (!imageSrc || !isOpen) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImgElement(img);
      setImgNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });

      // 計算基礎比例使圖片短邊剛好填滿 360x360
      const minDimension = Math.min(img.naturalWidth, img.naturalHeight);
      const initialScale = containerSize / minDimension;
      setScale(initialScale);
      
      // 置中
      const initialX = (containerSize - img.naturalWidth * initialScale) / 2;
      const initialY = (containerSize - img.naturalHeight * initialScale) / 2;
      setOffset({ x: initialX, y: initialY });
    };
    img.src = imageSrc;
  }, [imageSrc, isOpen]);

  // 滑鼠拖曳開始
  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - offset.x,
      y: e.clientY - offset.y
    });
  };

  // 滑鼠拖曳移動
  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  // 滑鼠放開
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 滾輪縮放
  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    updateZoom(scale * zoomFactor);
  };

  const updateZoom = (newScale) => {
    const minDimension = Math.min(imgNaturalSize.width, imgNaturalSize.height);
    if (!minDimension) return;
    const baseMinScale = containerSize / minDimension;
    const clampedScale = Math.max(baseMinScale * 0.8, Math.min(baseMinScale * 4, newScale));

    // 縮放時以中央為基準調整 offset
    const scaleRatio = clampedScale / scale;
    const centerX = containerSize / 2;
    const centerY = containerSize / 2;
    const newX = centerX - (centerX - offset.x) * scaleRatio;
    const newY = centerY - (centerY - offset.y) * scaleRatio;

    setScale(clampedScale);
    setOffset({ x: newX, y: newY });
  };

  // 一鍵重設為居中
  const handleReset = () => {
    if (!imgNaturalSize.width || !imgNaturalSize.height) return;
    const minDimension = Math.min(imgNaturalSize.width, imgNaturalSize.height);
    const initialScale = containerSize / minDimension;
    setScale(initialScale);
    setOffset({
      x: (containerSize - imgNaturalSize.width * initialScale) / 2,
      y: (containerSize - imgNaturalSize.height * initialScale) / 2
    });
  };

  // 確定裁切並輸出 1:1 Canvas
  const handleConfirmCrop = () => {
    if (!imgElement) return;

    const outputSize = 1000; // 輸出 1000x1000 高清正方形
    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext('2d');

    // 計算 canvas 上的繪製位置與縮放
    const ratio = outputSize / containerSize;
    const drawX = offset.x * ratio;
    const drawY = offset.y * ratio;
    const drawW = imgNaturalSize.width * scale * ratio;
    const drawH = imgNaturalSize.height * scale * ratio;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, outputSize, outputSize);
    ctx.drawImage(imgElement, drawX, drawY, drawW, drawH);

    const croppedBase64 = canvas.toDataURL('image/jpeg', 0.92);
    onCropComplete(croppedBase64);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" style={{ zIndex: 200 }}>
      <div 
        className="modal-content-wrapper" 
        style={{ maxWidth: '480px', width: '100%', background: '#121212', border: '1px solid rgba(212, 175, 55, 0.4)' }}
      >
        {/* Header */}
        <div className="modal-header-area" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 className="serif-title" style={{ fontSize: '16px', fontWeight: '700', color: 'var(--gold-primary)', margin: 0 }}>
              裁切 1:1 活動主視覺
            </h3>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              此圖片非 1:1 比例，請拖曳移動或縮放以確認方形取景區域
            </p>
          </div>
          <button 
            onClick={onCancel} 
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
            type="button"
          >
            <X size={20} />
          </button>
        </div>

        {/* 裁切視窗主體 */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          {/* 1:1 視窗容器 */}
          <div 
            ref={previewRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            style={{
              width: `${containerSize}px`,
              height: `${containerSize}px`,
              position: 'relative',
              overflow: 'hidden',
              borderRadius: '8px',
              border: '2px solid var(--gold-primary)',
              boxShadow: '0 0 20px rgba(0, 0, 0, 0.8), 0 0 15px rgba(212, 175, 55, 0.2)',
              cursor: isDragging ? 'grabbing' : 'grab',
              background: '#0a0a0a',
              userSelect: 'none'
            }}
          >
            {imgElement && (
              <img 
                src={imageSrc} 
                alt="Crop preview" 
                draggable={false}
                style={{
                  position: 'absolute',
                  left: `${offset.x}px`,
                  top: `${offset.y}px`,
                  width: `${imgNaturalSize.width * scale}px`,
                  height: `${imgNaturalSize.height * scale}px`,
                  maxWidth: 'none',
                  pointerEvents: 'none'
                }}
              />
            )}

            {/* 輔助九宮格線 */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ position: 'absolute', top: '33.33%', left: 0, right: 0, height: '1px', background: 'rgba(255,255,255,0.15)' }} />
              <div style={{ position: 'absolute', top: '66.66%', left: 0, right: 0, height: '1px', background: 'rgba(255,255,255,0.15)' }} />
              <div style={{ position: 'absolute', left: '33.33%', top: 0, bottom: 0, width: '1px', background: 'rgba(255,255,255,0.15)' }} />
              <div style={{ position: 'absolute', left: '66.66%', top: 0, bottom: 0, width: '1px', background: 'rgba(255,255,255,0.15)' }} />
            </div>

            {/* 提示拖曳圖示標籤 */}
            <div style={{ position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '10px', pointerEvents: 'none' }}>
              <Move size={12} />
              <span>拖曳以調整位置</span>
            </div>
          </div>

          {/* 控制面板：縮放滑桿與重設 */}
          <div style={{ width: `${containerSize}px`, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <ZoomOut size={16} style={{ color: 'var(--text-muted)' }} />
            <input 
              type="range"
              min="0.8"
              max="3"
              step="0.01"
              value={scale / (containerSize / Math.min(imgNaturalSize.width || 1, imgNaturalSize.height || 1))}
              onChange={(e) => {
                const base = containerSize / Math.min(imgNaturalSize.width || 1, imgNaturalSize.height || 1);
                updateZoom(base * parseFloat(e.target.value));
              }}
              style={{ flex: 1, accentColor: 'var(--gold-primary)', cursor: 'pointer' }}
            />
            <ZoomIn size={16} style={{ color: 'var(--text-muted)' }} />
            <button 
              onClick={handleReset} 
              className="btn-outline-gold" 
              style={{ padding: '6px 10px', fontSize: '11px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}
              type="button"
              title="重設為預設居中"
            >
              <RotateCcw size={12} />
              重設
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer-area">
          <button 
            onClick={onCancel} 
            className="btn-outline-gold" 
            style={{ padding: '8px 16px', fontSize: '12px' }} 
            type="button"
          >
            取消
          </button>
          <button 
            onClick={handleConfirmCrop} 
            className="btn-gold" 
            style={{ padding: '8px 18px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }} 
            type="button"
          >
            <Check size={14} />
            確認裁切 (1:1)
          </button>
        </div>
      </div>
    </div>
  );
}
