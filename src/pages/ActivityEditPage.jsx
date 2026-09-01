import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Calendar, MapPin, Briefcase, Trash2, Upload, Edit, Eye,
  Link as LinkIcon, Video, Loader2, Plus, AlertTriangle, CheckCircle2, Check, Crop
} from 'lucide-react';
import { callApi } from '../utils/api';
import CustomModal from '../components/CustomModal';
import ImageCropperModal from '../components/ImageCropperModal';
import RichTextEditor from '../components/RichTextEditor';

function formatToStandardDate(val) {
  if (!val) return '';
  let str = val.toString().trim();
  if (str.includes('~')) {
    const parts = str.split('~').map(p => formatToStandardDate(p.trim()));
    return parts[0] === parts[1] || !parts[1] ? parts[0] : `${parts[0]} ~ ${parts[1]}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  str = str.replace(/[./]/g, '-');
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(str)) {
    const parts = str.split('-');
    return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
  }
  return str;
}

// 產生穩定之 Google Drive 圖片預覽網址 (首選 thumbnail，相容性最高)
function getDriveImageUrl(fileId, size = 1000) {
  if (!fileId) return '';
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`;
}

// 圖片破圖自動降級機制
function handleDriveImageError(e, fileId) {
  if (!fileId) return;
  const currentSrc = e.target.src || '';
  if (currentSrc.includes('thumbnail')) {
    e.target.src = `https://lh3.googleusercontent.com/d/${fileId}`;
  } else if (currentSrc.includes('lh3.googleusercontent.com')) {
    e.target.src = `https://drive.google.com/uc?export=view&id=${fileId}`;
  }
}

export default function ActivityEditPage({ user, showToast }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [saveModalState, setSaveModalState] = useState('idle'); // 'idle' | 'saving' | 'saved'
  const [submitModalState, setSubmitModalState] = useState('idle'); // 'idle' | 'submitting' | 'submitted'
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [tempRawImage, setTempRawImage] = useState(null);
  const [tempFilename, setTempFilename] = useState('');
  const [activity, setActivity] = useState(null);

  // 表單資料
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [location, setLocation] = useState('');
  const [intro, setIntro] = useState('');
  const [albumLink, setAlbumLink] = useState('');
  const [videoLink, setVideoLink] = useState('');
  const [availableLinkTypes, setAvailableLinkTypes] = useState([
    '線上相簿', '回顧影片', '其他'
  ]);
  const [externalLinks, setExternalLinks] = useState([]);

  // 圖片資料
  const [mainVisual, setMainVisual] = useState(null);
  const [recordPhotos, setRecordPhotos] = useState([]);

  // 唯讀模式
  const [isReadOnly, setIsReadOnly] = useState(false);

  // 統一自訂 Modal 狀態
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [modalAlert, setModalAlert] = useState(null); // { title, type, content }

  const fileInputRef = useRef(null);
  const photosInputRef = useRef(null);

  const fetchActivityDetails = async (showLoadingScreen = true) => {
    if (showLoadingScreen) setLoading(true);
    try {
      const res = await callApi('getActivities', { role: user.role, department: user.department });
      if (res.status === 'success') {
        const act = res.activities.find(a => a.id === id);
        if (!act) {
          showAlert('存取錯誤', 'error', '找不到該活動，或您沒有權限存取。');
          navigate('/dashboard');
          return;
        }

        setActivity(act);
        setName(act.name || '');
        if (act.date) {
          const formatted = formatToStandardDate(act.date);
          if (formatted.includes('~')) {
            const parts = formatted.split('~').map(d => d.trim());
            setStartDate(parts[0] || '');
            setEndDate(parts[1] || '');
          } else {
            setStartDate(formatted);
            setEndDate(formatted);
          }
        } else {
          setStartDate('');
          setEndDate('');
        }
        setLocation(act.location || '');
        setIntro(act.intro || '');
        if (res.linkTypes && Array.isArray(res.linkTypes) && res.linkTypes.length > 0) {
          setAvailableLinkTypes(res.linkTypes);
        }

        if (act.externalLinks && Array.isArray(act.externalLinks) && act.externalLinks.length > 0) {
          setExternalLinks(act.externalLinks);
        } else {
          const defaultLinks = [];
          if (act.albumLink) defaultLinks.push({ id: 'link_album', type: '線上相簿', title: '線上相簿', url: act.albumLink });
          if (act.videoLink) defaultLinks.push({ id: 'link_video', type: '回顧影片', title: '回顧影片', url: act.videoLink });
          setExternalLinks(defaultLinks);
        }

        if (act.mainVisualId) {
          setMainVisual({
            fileId: act.mainVisualId,
            rawFileId: act.mainVisualRawId || '',
            isDeleted: false
          });
        } else {
          setMainVisual(null);
        }

        const photos = (act.recordPhotos || []).map(p => ({
          photoId: p.photoId,
          fileId: p.fileId,
          caption: p.caption || '',
          photographer: p.photographer || '',
          isDeleted: false
        }));
        setRecordPhotos(photos);

        if (act.status !== 'Draft' && user.role !== 'ITDept') {
          setIsReadOnly(true);
        }
      } else {
        showAlert('載入錯誤', 'error', res.message || '無法載入活動詳情。');
      }
    } catch (err) {
      showAlert('網路錯誤', 'error', err.message);
    } finally {
      if (showLoadingScreen) setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivityDetails();
  }, [id]);

  const showAlert = (title, type, content) => {
    setModalAlert({ title, type, content });
  };

  const toBase64 = file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });

  const handleMainVisualChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const base64 = await toBase64(file);
      const img = new Image();
      img.onload = () => {
        const ratio = img.naturalWidth / img.naturalHeight;
        if (ratio >= 0.98 && ratio <= 1.02) {
          // 已經接近 1:1 正方形
          setMainVisual(prev => ({
            fileId: prev?.fileId || '',
            rawFileId: prev?.rawFileId || '',
            base64: base64,
            rawBase64: base64,
            filename: file.name,
            isDeleted: false
          }));
          showToast('已成功設定 1:1 主視覺圖片！', 'success');
        } else {
          // 非 1:1，開啟裁切 Modal
          setTempRawImage(base64);
          setTempFilename(file.name);
          setCropModalOpen(true);
        }
      };
      img.src = base64;
    } catch (err) {
      showAlert('圖片錯誤', 'error', '主視覺圖片檔案讀取失敗。');
    } finally {
      e.target.value = '';
    }
  };

  const handleCropComplete = (croppedBase64) => {
    setMainVisual(prev => ({
      fileId: prev?.fileId || '',
      rawFileId: prev?.rawFileId || '',
      base64: croppedBase64,
      rawBase64: tempRawImage,
      filename: tempFilename,
      isDeleted: false
    }));
    setCropModalOpen(false);
    setTempRawImage(null);
    showToast('主視覺 1:1 正方形裁切完成！', 'success');
  };

  const handleOpenRecrop = () => {
    if (!mainVisual) return;
    const src = mainVisual.rawBase64 || (mainVisual.rawFileId ? `https://lh3.googleusercontent.com/d/${mainVisual.rawFileId}` : mainVisual.base64);
    if (!src) return;
    setTempRawImage(src);
    setTempFilename(mainVisual.filename || 'main_visual.jpg');
    setCropModalOpen(true);
  };

  const handleMainVisualDelete = () => {
    if (isReadOnly) return;
    setMainVisual(prev => prev ? { ...prev, isDeleted: true } : null);
  };

  const handleRecordPhotosChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const activePhotosCount = recordPhotos.filter(p => !p.isDeleted).length;
    if (activePhotosCount + files.length > 10) {
      showAlert('上傳限制', 'warning', '紀錄相片總數不能超過 10 張！');
      return;
    }

    const newPhotos = [];
    for (let file of files) {
      try {
        const base64 = await toBase64(file);
        newPhotos.push({
          photoId: null,
          fileId: null,
          base64,
          filename: file.name,
          caption: '',
          photographer: '',
          isDeleted: false
        });
      } catch (err) {
        showAlert('讀取失敗', 'error', `相片 ${file.name} 讀取失敗。`);
      }
    }

    setRecordPhotos(prev => [...prev, ...newPhotos]);
    e.target.value = '';
  };

  const handleRecordPhotoMetaChange = (index, field, value) => {
    if (isReadOnly) return;
    setRecordPhotos(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleRecordPhotoDelete = (index) => {
    if (isReadOnly) return;
    setRecordPhotos(prev => {
      const updated = [...prev];
      if (updated[index].fileId || updated[index].photoId) {
        updated[index].isDeleted = true;
      } else {
        updated.splice(index, 1);
      }
      return updated;
    });
  };

  // 外部連結動態管理
  const handleAddExternalLink = () => {
    if (isReadOnly) return;
    const defaultType = availableLinkTypes[0] || '其他連結';
    setExternalLinks(prev => [
      ...prev,
      {
        id: 'link_' + Date.now(),
        type: defaultType,
        url: ''
      }
    ]);
  };

  const handleUpdateExternalLink = (index, field, value) => {
    if (isReadOnly) return;
    setExternalLinks(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleRemoveExternalLink = (index) => {
    if (isReadOnly) return;
    setExternalLinks(prev => prev.filter((_, i) => i !== index));
  };

  const hasName = Boolean(name && name.trim().length > 0);
  const hasDate = Boolean(startDate);
  const hasLocation = Boolean(location && location.trim().length > 0);
  const hasIntro = Boolean(intro && intro.trim().length > 0);
  const hasMainVisual = Boolean(mainVisual && !mainVisual.isDeleted);
  const activePhotos = recordPhotos.filter(p => !p.isDeleted);
  const isValidPhotoCount = activePhotos.length >= 3 && activePhotos.length <= 10;

  const isPhotosValid = activePhotos.every(p =>
    p.caption.trim().length > 0 &&
    p.caption.trim().length < 10 &&
    p.photographer.trim().length > 0
  );

  const completedConditionsCount = [
    hasName,
    hasDate,
    hasLocation,
    hasIntro,
    hasMainVisual,
    isValidPhotoCount,
    isPhotosValid
  ].filter(Boolean).length;

  const canSubmit = hasName && hasDate && hasLocation && hasIntro && hasMainVisual && isValidPhotoCount && isPhotosValid && !isReadOnly;

  const handleSave = async (e, customStatus = null) => {
    if (e) e.preventDefault();

    if (!name || !startDate) {
      showAlert('必填欄位缺失', 'warning', '活動名稱與活動日期為必填項目，請填寫後再行儲存。');
      return;
    }

    const nextStatus = customStatus || activity.status;
    if (nextStatus === 'Submitted') {
      if (!location || !location.trim()) {
        showAlert('活動地點缺失', 'warning', '提交活動前，請確認已填寫「活動地點」！');
        return;
      }
      if (!intro || !intro.trim()) {
        showAlert('活動簡介缺失', 'warning', '提交活動前，請確認已填寫「活動簡介」！');
        return;
      }
      if (!mainVisual || mainVisual.isDeleted) {
        showAlert('主視覺缺失', 'warning', '提交活動前，請確認已上傳活動主視覺（Main Visual）圖片！');
        return;
      }
      if (!isValidPhotoCount) {
        showAlert('相片數量不符', 'warning', `提交活動必須上傳 3 ~ 10 張紀錄相片。（目前僅 ${activePhotos.length} 張）`);
        return;
      }
      if (!isPhotosValid) {
        showAlert('照片資訊不完整', 'warning', '提交活動前，請確認所有紀錄照片都填寫了圖說（限制 9 字內）與攝影者，且不得為空！');
        return;
      }
    }

    if (customStatus === 'Submitted') {
      setSubmitLoading(true);
      setShowSubmitConfirm(false);
      setSubmitModalState('submitting');
    } else {
      setSaveLoading(true);
      setSaveModalState('saving');
    }

    const cleanStart = formatToStandardDate(startDate);
    const cleanEnd = formatToStandardDate(endDate);
    const formattedDate = !cleanEnd || cleanStart === cleanEnd
      ? cleanStart
      : `${cleanStart} ~ ${cleanEnd}`;

    try {
      const filteredLinks = externalLinks.filter(l => l.url && l.url.trim() !== '');
      const albumItem = filteredLinks.find(l => l.type === '線上相簿');
      const videoItem = filteredLinks.find(l => l.type === '回顧影片');

      const payload = {
        id,
        name,
        date: formattedDate,
        location,
        intro,
        albumLink: albumItem ? albumItem.url : '',
        videoLink: videoItem ? videoItem.url : '',
        externalLinks: filteredLinks,
        status: nextStatus,
        mainVisual: mainVisual && (mainVisual.base64 || mainVisual.isDeleted) ? {
          base64: mainVisual.isDeleted ? "" : mainVisual.base64,
          rawBase64: mainVisual.isDeleted ? "" : (mainVisual.rawBase64 || mainVisual.base64),
          filename: mainVisual.filename || "",
          isDeleted: mainVisual.isDeleted
        } : null,
        recordPhotos: recordPhotos.map(p => ({
          photoId: p.photoId,
          caption: p.caption,
          photographer: p.photographer,
          base64: p.base64 || "",
          filename: p.filename || "",
          isDeleted: p.isDeleted
        }))
      };

      const res = await callApi('updateActivity', payload);
      if (res.status === 'success') {
        if (customStatus === 'Submitted') {
          setSubmitModalState('submitted');
          setTimeout(() => {
            setSubmitModalState('idle');
            navigate('/dashboard');
          }, 1500);
        } else {
          setSaveModalState('saved');
          await fetchActivityDetails(false);
          setTimeout(() => {
            setSaveModalState('idle');
            showToast('草稿暫存成功！', 'success');
          }, 1200);
        }
      } else {
        setSaveModalState('idle');
        setSubmitModalState('idle');
        showAlert('操作失敗', 'error', res.message || '伺服器端發生錯誤，請稍後再試。');
      }
    } catch (err) {
      setSaveModalState('idle');
      setSubmitModalState('idle');
      showAlert('網路錯誤', 'error', err.message);
    } finally {
      setSaveLoading(false);
      setSubmitLoading(false);
      setShowSubmitConfirm(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: '#000', padding: '20px', boxSizing: 'border-box' }}>
        <div className="glass-card" style={{ maxWidth: '360px', width: '100%', padding: '40px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Loader2 className="animate-spin" style={{ color: 'var(--gold-primary)', width: '40px', height: '40px' }} />
            <div style={{ position: 'absolute', width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(212, 175, 55, 0.1)' }} />
          </div>
          <div>
            <h3 className="serif-title" style={{ fontSize: '18px', fontWeight: '700', color: 'var(--gold-primary)', letterSpacing: '2px', marginBottom: '8px' }}>CMCollect</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>正在載入活動詳情與照片檔案，請稍候...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-black">
      {/* 頂部導航 */}
      <header className="app-header">
        <div className="header-container">
          <div className="header-logo-area" style={{ gap: '20px' }}>
            <button
              onClick={() => navigate('/dashboard')}
              className="btn-outline-gold"
              style={{ padding: '8px 18px', fontSize: '13px', borderRadius: '6px' }}
              type="button"
            >
              &larr; 返回活動列表
            </button>
            <span className="serif-title font-bold tracking-wider" style={{ color: 'var(--gold-primary)', fontSize: '22px' }}>
              {isReadOnly ? '檢視活動資料' : '編輯活動資料'}
            </span>
          </div>
          <div className="user-controls">
            {activity.status === 'Draft' && !isReadOnly && (
              <button
                onClick={(e) => handleSave(e)}
                className="btn-outline-gold"
                style={{ padding: '8px 16px', fontSize: '12px' }}
                disabled={saveLoading || submitLoading}
                type="button"
              >
                {saveLoading && <Loader2 className="animate-spin" style={{ width: '12px', height: '12px', marginRight: '6px', display: 'inline-block' }} />}
                儲存草稿
              </button>
            )}
            {!isReadOnly && (
              <button
                onClick={() => setShowSubmitConfirm(true)}
                className="btn-gold"
                style={{ padding: '8px 16px', fontSize: '12px' }}
                disabled={!canSubmit || saveLoading || submitLoading}
                type="button"
              >
                {submitLoading && <Loader2 className="animate-spin" style={{ width: '12px', height: '12px', marginRight: '6px', display: 'inline-block' }} />}
                提交活動 (Submit)
              </button>
            )}
            {isReadOnly && (
              <span className="badge-status" style={{ background: 'rgba(212,175,55,0.08)', color: 'var(--gold-primary)', border: '1px solid rgba(212,175,55,0.25)', fontSize: '12px', padding: '6px 12px' }}>
                唯讀檢視模式
              </span>
            )}
          </div>
        </div>
      </header>

      {/* 編輯主區 */}
      <main className="app-main">
        {/* 外層統一限寬容器，保證進度條與四個編輯區塊完全一樣寬 */}
        <div style={{ maxWidth: '960px', margin: '0 auto', width: '100%' }}>
          {/* 頂部送出檢查進度條 (吸頂 Sticky 圓圈進度條 - 升級磨砂景深遮罩) */}
          {!isReadOnly && (
            <div className="stepper-sticky-wrapper">
              <div className="stepper-container">
                <div className="stepper-header">
                  <span className="stepper-title">
                    <CheckCircle2 size={16} style={{ color: canSubmit ? '#2ecc71' : 'var(--gold-primary)' }} />
                    活動送出檢查進度
                  </span>
                  <span className="stepper-progress-text">
                    已完成 <strong>{completedConditionsCount}</strong> / 7 項條件
                    {canSubmit && <span style={{ color: '#2ecc71', marginLeft: '8px' }}>（已達成送出標準！）</span>}
                  </span>
                </div>

                <div className="stepper-track">
                  {/* Step 1: 活動名稱 */}
                  <div className={`step-item ${hasName ? 'completed' : ''}`}>
                    <div className="step-circle">
                      {hasName ? <Check size={15} /> : <span>1</span>}
                    </div>
                    <span className="step-label">活動名稱</span>
                    <span className="step-subtext">{hasName ? '已填寫' : '未填寫'}</span>
                  </div>

                  <div className={`step-connector ${hasName && hasDate ? 'completed' : ''}`} />

                  {/* Step 2: 活動日期 */}
                  <div className={`step-item ${hasDate ? 'completed' : ''}`}>
                    <div className="step-circle">
                      {hasDate ? <Check size={15} /> : <span>2</span>}
                    </div>
                    <span className="step-label">活動日期</span>
                    <span className="step-subtext">{hasDate ? '已填寫' : '未填寫'}</span>
                  </div>

                  <div className={`step-connector ${hasDate && hasLocation ? 'completed' : ''}`} />

                  {/* Step 3: 活動地點 */}
                  <div className={`step-item ${hasLocation ? 'completed' : ''}`}>
                    <div className="step-circle">
                      {hasLocation ? <Check size={15} /> : <span>3</span>}
                    </div>
                    <span className="step-label">活動地點</span>
                    <span className="step-subtext">{hasLocation ? '已填寫' : '未填寫'}</span>
                  </div>

                  <div className={`step-connector ${hasLocation && hasIntro ? 'completed' : ''}`} />

                  {/* Step 4: 活動簡介 */}
                  <div className={`step-item ${hasIntro ? 'completed' : ''}`}>
                    <div className="step-circle">
                      {hasIntro ? <Check size={15} /> : <span>4</span>}
                    </div>
                    <span className="step-label">活動簡介</span>
                    <span className="step-subtext">{hasIntro ? '已填寫' : '未填寫'}</span>
                  </div>

                  <div className={`step-connector ${hasIntro && hasMainVisual ? 'completed' : ''}`} />

                  {/* Step 5: 主視覺圖片 */}
                  <div className={`step-item ${hasMainVisual ? 'completed' : ''}`}>
                    <div className="step-circle">
                      {hasMainVisual ? <Check size={15} /> : <span>5</span>}
                    </div>
                    <span className="step-label">主視覺圖片</span>
                    <span className="step-subtext">{hasMainVisual ? '已上傳' : '未上傳'}</span>
                  </div>

                  <div className={`step-connector ${hasMainVisual && isValidPhotoCount ? 'completed' : ''}`} />

                  {/* Step 6: 紀錄相片 (3~10張) */}
                  <div className={`step-item ${isValidPhotoCount ? 'completed' : ''}`}>
                    <div className="step-circle">
                      {isValidPhotoCount ? <Check size={15} /> : <span>6</span>}
                    </div>
                    <span className="step-label">紀錄相片</span>
                    <span className="step-subtext">{activePhotos.length} / 10 張</span>
                  </div>

                  <div className={`step-connector ${isValidPhotoCount && isPhotosValid ? 'completed' : ''}`} />

                  {/* Step 7: 相片資訊完整 */}
                  <div className={`step-item ${isPhotosValid ? 'completed' : ''}`}>
                    <div className="step-circle">
                      {isPhotosValid ? <Check size={15} /> : <span>7</span>}
                    </div>
                    <span className="step-label">相片說明與攝影</span>
                    <span className="step-subtext">{isPhotosValid ? '已齊全' : '未齊全'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="edit-layout">
            {/* 唯讀檢視提示卡片 (含網管部處理標記與日期) */}
            {isReadOnly && (
              <div className="glass-card" style={{ padding: '18px 24px', border: '1px solid rgba(212, 175, 55, 0.35)', background: 'rgba(212, 175, 55, 0.04)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={18} style={{ color: 'var(--gold-primary)' }} />
                    <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--gold-light)' }}>
                      唯讀檢視模式
                    </span>
                  </div>

                  <div>
                    {activity.status === 'Closed' ? (
                      <span className="badge-status closed" style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px' }}>
                        <CheckCircle2 size={14} />
                        <span>網管部已完成發佈</span>
                        <span style={{ opacity: 0.85, fontSize: '11px', marginLeft: '2px' }}>
                          （處理日期：{formatToStandardDate(activity.updatedAt)}）
                        </span>
                      </span>
                    ) : (
                      <span className="badge-status submitted" style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px' }}>
                        <Loader2 size={13} className="animate-spin" />
                        <span>網管部審核處理中（尚未發布至系網）</span>
                      </span>
                    )}
                  </div>
                </div>

                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.6' }}>
                  ※ 此活動已提交存檔，部長與會本部為唯讀模式。<strong>如後續需要修改活動內容或抽換圖片，請洽網管部人員。</strong>
                </p>
              </div>
            )}

            {/* 1. 活動基本資料 */}
            <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 className="serif-title" style={{ fontSize: '16px', fontWeight: '700', paddingBottom: '8px', borderBottom: '1px solid rgba(212, 175, 55, 0.1)' }}>活動基本資料</h3>

              <div className="form-grid-2">
                <div className="form-field">
                  <label className="form-field-label">活動名稱</label>
                  <input
                    type="text"
                    className="input-gold"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    readOnly={isReadOnly}
                  />
                </div>
                <div className="form-field">
                  <label className="form-field-label">活動日期</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="date"
                      className="input-gold"
                      max="9999-12-31"
                      value={startDate}
                      onChange={e => {
                        setStartDate(e.target.value);
                        if (!endDate || endDate < e.target.value) {
                          setEndDate(e.target.value);
                        }
                      }}
                      readOnly={isReadOnly}
                      style={{ flex: 1 }}
                    />
                    <span style={{ color: 'var(--text-muted)' }}>至</span>
                    <input
                      type="date"
                      className="input-gold"
                      max="9999-12-31"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      readOnly={isReadOnly}
                      style={{ flex: 1 }}
                      min={startDate}
                    />
                  </div>
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-field">
                  <label className="form-field-label">主辦部門</label>
                  <input
                    type="text"
                    className="input-gold"
                    style={{ opacity: '0.6', cursor: 'not-allowed' }}
                    value={activity.department}
                    readOnly
                  />
                </div>
                <div className="form-field">
                  <label className="form-field-label">活動地點</label>
                  <input
                    type="text"
                    placeholder="請輸入活動地點"
                    className="input-gold"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    readOnly={isReadOnly}
                  />
                </div>
              </div>

              <div className="form-field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-field-label">活動簡介</label>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>支援粗體、斜體、底線、刪除線與超連結</span>
                </div>
                <RichTextEditor
                  value={intro}
                  onChange={setIntro}
                  readOnly={isReadOnly}
                />
              </div>
            </div>

            {/* 2. 活動主視覺 (Main Visual - 1:1 正方形) */}
            <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px solid rgba(212, 175, 55, 0.1)' }}>
                <div>
                  <h3 className="serif-title" style={{ fontSize: '16px', fontWeight: '700' }}>活動主視覺</h3>
                  <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>※ 若上傳非 1:1 圖片將自動開啟移動與縮放裁切工具</p>
                </div>
                {mainVisual && !mainVisual.isDeleted && !isReadOnly && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={handleOpenRecrop}
                      className="btn-outline-gold"
                      style={{ padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      type="button"
                      title="調整裁切位置或放大縮小"
                    >
                      <Crop size={12} />
                      調整位置
                    </button>
                    <button
                      onClick={() => fileInputRef.current.click()}
                      className="btn-outline-gold"
                      style={{ padding: '4px 10px', fontSize: '11px' }}
                      type="button"
                    >
                      更換主視覺
                    </button>
                  </div>
                )}
              </div>

              <div style={{ position: 'relative' }}>
                {mainVisual && !mainVisual.isDeleted ? (
                  <div className="visual-preview-container">
                    <img
                      src={mainVisual.base64 || getDriveImageUrl(mainVisual.fileId)}
                      alt="Main Visual 1:1"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      referrerPolicy="no-referrer"
                      crossOrigin="anonymous"
                      onError={(e) => handleDriveImageError(e, mainVisual.fileId)}
                    />

                    {!isReadOnly && (
                      <button
                        onClick={handleMainVisualDelete}
                        style={{ position: 'absolute', top: '10px', right: '10px', padding: '6px', background: 'rgba(0,0,0,0.65)', border: 'none', borderRadius: '50%', color: '#ff4d4f', cursor: 'pointer', zIndex: 10 }}
                        type="button"
                        title="移除主視覺"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ) : (
                  <div
                    onClick={() => !isReadOnly && fileInputRef.current.click()}
                    className="visual-placeholder"
                  >
                    <Upload size={36} style={{ color: 'var(--gold-primary)', opacity: 0.7 }} />
                    <p style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-main)' }}>點擊上傳主視覺圖片</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>以 1:1 正方形為主<br />（非方形將自動開啟移動與放大裁切器）</p>
                  </div>
                )}

                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  accept="image/*"
                  onChange={handleMainVisualChange}
                />
              </div>
            </div>

            {/* 3. 紀錄照片上傳區 (單張由上到下，照片在左，說明在上攝影者在下) */}
            <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px solid rgba(212, 175, 55, 0.1)' }}>
                <div>
                  <h3 className="serif-title" style={{ fontSize: '16px', fontWeight: '700' }}>活動紀錄照片 ({activePhotos.length} / 10)</h3>
                  <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>※ 提交活動必須上傳 3 至 10 張相片</p>
                </div>
                <input
                  type="file"
                  ref={photosInputRef}
                  style={{ display: 'none' }}
                  accept="image/*"
                  multiple
                  onChange={handleRecordPhotosChange}
                />
              </div>

              {/* 相片列表 */}
              {activePhotos.length === 0 ? (
                <div
                  onClick={() => !isReadOnly && photosInputRef.current.click()}
                  className="photo-add-row-btn"
                  style={{ minHeight: '120px', flexDirection: 'column' }}
                >
                  <Upload size={32} style={{ color: 'var(--gold-primary)', opacity: 0.6, marginBottom: '4px' }} />
                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-main)' }}>點擊上傳紀錄照片</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>支援批次選取（需上傳 3 ~ 10 張）</span>
                </div>
              ) : (
                <div className="photo-list-vertical">
                  {recordPhotos.map((photo, index) => {
                    if (photo.isDeleted) return null;
                    return (
                      <div key={photo.photoId || index} className="photo-row-card">
                        {/* 左側照片預覽 */}
                        <div className="photo-row-left">
                          <div className="photo-row-thumb">
                            <img
                              src={photo.base64 || getDriveImageUrl(photo.fileId)}
                              alt="Record"
                              className="photo-preview-image"
                              referrerPolicy="no-referrer"
                              crossOrigin="anonymous"
                              onError={(e) => handleDriveImageError(e, photo.fileId)}
                            />
                            {!isReadOnly && (
                              <button
                                onClick={() => handleRecordPhotoDelete(index)}
                                className="photo-delete-btn"
                                type="button"
                                title="刪除照片"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* 右側文字與攝影者 */}
                        <div className="photo-row-right">
                          <div className="form-field">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <label className="form-field-label">照片圖說 (限9字內)</label>
                              <span style={{ fontSize: '10px', fontWeight: '600', color: photo.caption.trim().length >= 10 ? '#ff4d4f' : 'var(--text-muted)' }}>
                                {photo.caption.trim().length} / 9 字
                              </span>
                            </div>
                            <input
                              type="text"
                              placeholder="例：大會開幕合影"
                              className="input-gold"
                              style={{ fontSize: '13px', padding: '10px 12px', borderColor: (photo.caption.trim().length >= 10 || photo.caption.trim().length === 0) ? '#ff4d4f' : '' }}
                              maxLength={9}
                              value={photo.caption}
                              onChange={e => handleRecordPhotoMetaChange(index, 'caption', e.target.value)}
                              readOnly={isReadOnly}
                            />
                          </div>

                          <div className="form-field">
                            <label className="form-field-label">攝影者</label>
                            <input
                              type="text"
                              placeholder="例：活動部 王小明"
                              className="input-gold"
                              style={{ fontSize: '13px', padding: '10px 12px', borderColor: photo.photographer.trim().length === 0 ? '#ff4d4f' : '' }}
                              value={photo.photographer}
                              onChange={e => handleRecordPhotoMetaChange(index, 'photographer', e.target.value)}
                              readOnly={isReadOnly}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* 增加照片按鈕卡片 (未達上限 10 張時顯示) */}
                  {activePhotos.length < 10 && !isReadOnly && (
                    <div
                      onClick={() => photosInputRef.current.click()}
                      className="photo-add-row-btn"
                    >
                      <Plus size={20} style={{ color: 'var(--gold-primary)' }} />
                      <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-main)' }}>＋ 新增活動照片</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>（目前 {activePhotos.length} / 10 張，支援多選批次上傳）</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 4. 活動外部連結 (選填，上下排列動態清單) */}
            <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px solid rgba(212, 175, 55, 0.1)' }}>
                <div>
                  <h3 className="serif-title" style={{ fontSize: '16px', fontWeight: '700' }}>活動外部連結 (選填)</h3>
                  <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>※ 可自訂新增線上相簿、回顧影片或活動資料等連結</p>
                </div>
              </div>

              {externalLinks.length === 0 ? (
                <div
                  onClick={handleAddExternalLink}
                  className="link-add-btn"
                  style={{ padding: '24px', cursor: isReadOnly ? 'default' : 'pointer' }}
                >
                  <Plus size={18} style={{ color: 'var(--gold-primary)' }} />
                  <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-main)' }}>尚未新增任何外部連結，點擊新增</span>
                </div>
              ) : (
                <div className="external-links-list">
                  {externalLinks.map((link, idx) => (
                    <div key={link.id || idx} className="external-link-row">
                      {/* 連結類型選單 */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '150px' }}>
                        <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600' }}>連結類型</label>
                        <select
                          className="link-type-select"
                          style={{ width: '100%' }}
                          value={link.type}
                          onChange={e => handleUpdateExternalLink(idx, 'type', e.target.value)}
                          disabled={isReadOnly}
                        >
                          {availableLinkTypes.map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      </div>

                      {/* 連結網址 URL */}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600' }}>連結網址 (URL)</label>
                        <div className="link-url-input-wrap">
                          <LinkIcon size={14} style={{ position: 'absolute', left: '12px', color: 'var(--gold-primary)', opacity: 0.6 }} />
                          <input
                            type="url"
                            placeholder="https://..."
                            className="input-gold"
                            style={{ paddingLeft: '34px', fontSize: '12px', paddingRight: '12px' }}
                            value={link.url}
                            onChange={e => handleUpdateExternalLink(idx, 'url', e.target.value)}
                            readOnly={isReadOnly}
                          />
                        </div>
                      </div>

                      {/* 刪除按鈕 */}
                      {!isReadOnly && (
                        <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%', paddingTop: '18px' }}>
                          <button
                            onClick={() => handleRemoveExternalLink(idx)}
                            className="link-delete-btn"
                            type="button"
                            title="刪除此連結"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* 增加更多連結按鈕 */}
                  {!isReadOnly && (
                    <div
                      onClick={handleAddExternalLink}
                      className="link-add-btn"
                    >
                      <Plus size={16} style={{ color: 'var(--gold-primary)' }} />
                      <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-main)' }}>＋ 新增外部連結項目</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 唯讀狀態提示 */}
            {isReadOnly && (
              <div className="read-only-alert">
                <strong>唯讀狀態：</strong>此活動已提交 (Submitted) 或已結案 (Closed)。只有網管部或會本部有權限編輯內容。
              </div>
            )}
          </div>
        </div>

        {/* 正在提交活動資料視窗 (置中毛玻璃 Modal) */}
        {submitModalState !== 'idle' && (
          <div className="modal-backdrop" style={{ zIndex: 200 }}>
            <div className="glass-card" style={{ maxWidth: '400px', width: '100%', padding: '36px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', borderRadius: '12px', border: '1px solid rgba(212, 175, 55, 0.4)', background: '#141414', boxShadow: '0 20px 50px rgba(0,0,0,0.9)' }}>
              {submitModalState === 'submitting' ? (
                <>
                  <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <Loader2 className="animate-spin" style={{ color: 'var(--gold-primary)', width: '48px', height: '48px' }} />
                    <div style={{ position: 'absolute', width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(212, 175, 55, 0.15)' }} />
                  </div>
                  <div>
                    <h3 className="serif-title" style={{ fontSize: '18px', fontWeight: '700', color: 'var(--gold-primary)', letterSpacing: '1px', marginBottom: '8px' }}>正在提交活動資料</h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6' }}>系統正在上傳所有圖片至雲端儲存庫，並發送 Email 通知網管部審核，請稍候...</p>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <CheckCircle2 style={{ color: '#2ecc71', width: '48px', height: '48px' }} />
                  </div>
                  <div>
                    <h3 className="serif-title" style={{ fontSize: '18px', fontWeight: '700', color: '#2ecc71', letterSpacing: '1px', marginBottom: '8px' }}>活動提交成功！</h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6' }}>資料已安全保存並通知網管部進行發佈審核，正在導回活動列表...</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>

      {/* 暫存中 / 暫存成功專屬 Modal */}
      {saveModalState !== 'idle' && (
        <div className="modal-backdrop">
          <div className="glass-card" style={{ maxWidth: '380px', width: '100%', padding: '36px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', borderRadius: '12px', border: '1px solid rgba(212, 175, 55, 0.3)', background: '#141414' }}>
            {saveModalState === 'saving' ? (
              <>
                <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <Loader2 className="animate-spin" style={{ color: 'var(--gold-primary)', width: '44px', height: '44px' }} />
                  <div style={{ position: 'absolute', width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(212, 175, 55, 0.1)' }} />
                </div>
                <div>
                  <h3 className="serif-title" style={{ fontSize: '18px', fontWeight: '700', color: 'var(--gold-primary)', letterSpacing: '1px', marginBottom: '8px' }}>正在暫存活動資料</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6' }}>系統正在將填寫內容同步至雲端資料庫，請稍候...</p>
                </div>
              </>
            ) : (
              <>
                <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <CheckCircle2 style={{ color: '#2ecc71', width: '44px', height: '44px' }} />
                </div>
                <div>
                  <h3 className="serif-title" style={{ fontSize: '18px', fontWeight: '700', color: '#2ecc71', letterSpacing: '1px', marginBottom: '8px' }}>暫存成功</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6' }}>資料已安全保存，正在導回活動編輯頁面...</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* 1:1 主視覺裁切 Modal */}
      <ImageCropperModal
        isOpen={cropModalOpen}
        imageSrc={tempRawImage}
        onCancel={() => {
          setCropModalOpen(false);
          setTempRawImage(null);
        }}
        onCropComplete={handleCropComplete}
      />

      {/* 統一的自訂確認提交彈窗 (CustomModal 實作) */}
      <CustomModal
        isOpen={showSubmitConfirm}
        onClose={() => setShowSubmitConfirm(false)}
        title="確認提交活動資料？"
        type="info"
        footer={
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => setShowSubmitConfirm(false)} className="btn-outline-gold px-4 py-2 text-xs" type="button">取消</button>
            <button onClick={(e) => handleSave(e, 'Submitted')} className="btn-gold px-4 py-2 text-xs" type="button">確認提交</button>
          </div>
        }
      >
        <div>
          <p className="text-xs text-text-main leading-relaxed font-sans">
            活動提交後，狀態將會變更為 <strong className="text-gold-primary">已提交 (Submitted)</strong>。<br />
            系統將自動發送 Email 通知網管部幹部進行網頁發佈審核。
          </p>
          <p className="text-xs text-text-muted mt-2 font-sans">
            注意：一般部長帳號在提交後將變更為「唯讀」，無法再修改內容。
          </p>
        </div>
      </CustomModal>

      {/* 統一的自訂警告/錯誤/提醒彈窗 */}
      {modalAlert && (
        <CustomModal
          isOpen={true}
          onClose={() => setModalAlert(null)}
          title={modalAlert.title}
          type={modalAlert.type}
        >
          <p className="text-xs font-sans text-text-main leading-relaxed">{modalAlert.content}</p>
        </CustomModal>
      )}
    </div>
  );
}
