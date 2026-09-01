import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LogOut, Plus, FileText, MapPin, Calendar, Briefcase,
  Trash2, Edit, Eye, FileCode, CheckCircle2, ChevronRight, X, Loader2, Copy, Check,
  Clock, Send, Edit3, ExternalLink, Link as LinkIcon
} from 'lucide-react';
import { callApi } from '../utils/api';
import { getIntroductionHtml, getPictureDisplayHtml } from '../utils/templates';
import CustomModal from '../components/CustomModal';
import logoImg from '../assets/logo.png';

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

export default function DashboardPage({ user, handleLogout, showToast }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  // 快速建立活動表單 State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalState, setCreateModalState] = useState('idle'); // 'idle' | 'creating' | 'created'
  const [newActName, setNewActName] = useState('');
  const [newActStartDate, setNewActStartDate] = useState('');
  const [newActEndDate, setNewActEndDate] = useState('');
  const [newActDept, setNewActDept] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  // 網管部工具箱 State
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [showITModal, setShowITModal] = useState(false);
  const [copiedIntro, setCopiedIntro] = useState(false);
  const [copiedPics, setCopiedPics] = useState(false);
  const [copiedName, setCopiedName] = useState(false);
  const [copiedLocation, setCopiedLocation] = useState(false);
  const [copiedDate, setCopiedDate] = useState(false);
  const [copiedLinkIndex, setCopiedLinkIndex] = useState(null);
  const [copiedAllLinks, setCopiedAllLinks] = useState(false);
  const [closeModalState, setCloseModalState] = useState('idle'); // 'idle' | 'closing' | 'closed'

  // 自訂確認 Modal State
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const navigate = useNavigate();
  const [deptOptions, setDeptOptions] = useState(["會本部", "活動部", "教學部", "國事部", "藥園部", "體器部", "學術部", "公關部", "美宣部", "醫改部", "網管部", "秘書部", "總務部"]);

  // 依角色定義分類 Tabs
  const getTabsConfig = () => {
    if (user.role === 'DeptHead') {
      return [
        {
          key: 'draft',
          label: '編輯中活動',
          icon: Edit3,
          filter: (a) => a.status === 'Draft'
        },
        {
          key: 'submitted',
          label: '已提交活動',
          icon: Send,
          filter: (a) => a.status === 'Submitted' || a.status === 'Closed'
        }
      ];
    }
    if (user.role === 'Leadership') {
      return [
        {
          key: 'leadership_draft',
          label: '編輯中活動',
          icon: Edit3,
          filter: (a) => a.status === 'Draft' && a.department === '會本部'
        },
        {
          key: 'assigned',
          label: '已指派活動',
          icon: Clock,
          filter: (a) => a.status === 'Draft' && a.department !== '會本部'
        },
        {
          key: 'submitted',
          label: '已提交活動',
          icon: Send,
          filter: (a) => a.status === 'Submitted'
        },
        {
          key: 'closed',
          label: '已結案活動',
          icon: CheckCircle2,
          filter: (a) => a.status === 'Closed'
        }
      ];
    }
    // ITDept 網管部
    return [
      {
        key: 'submitted',
        label: '已提交活動',
        icon: Send,
        filter: (a) => a.status === 'Submitted'
      },
      {
        key: 'assigned',
        label: '已指派活動',
        icon: Clock,
        filter: (a) => a.status === 'Draft'
      },
      {
        key: 'closed',
        label: '已結案活動',
        icon: CheckCircle2,
        filter: (a) => a.status === 'Closed'
      }
    ];
  };

  const tabs = getTabsConfig();
  const [activeTab, setActiveTab] = useState(() => {
    if (user.role === 'ITDept') return 'submitted';
    if (user.role === 'Leadership') return 'leadership_draft';
    return 'draft';
  });

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const res = await callApi('getActivities', { role: user.role, department: user.department });
      if (res.status === 'success') {
        setActivities(Array.isArray(res.activities) ? res.activities : []);
        if (res.departments && res.departments.length > 0) {
          setDeptOptions(res.departments);
        }
      } else {
        setActivities([]);
        showToast(res.message || '無法載入活動列表', 'error');
      }
    } catch (err) {
      setActivities([]);
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!newActName || !newActStartDate || !newActDept) {
      showToast('所有欄位皆為必填。', 'error');
      return;
    }

    // 組合日期為 YYYY-MM-DD 或 YYYY-MM-DD ~ YYYY-MM-DD
    const cleanStart = formatToStandardDate(newActStartDate);
    const cleanEnd = formatToStandardDate(newActEndDate);
    const formattedDate = !cleanEnd || cleanStart === cleanEnd
      ? cleanStart
      : `${cleanStart} ~ ${cleanEnd}`;

    setCreateLoading(true);
    setShowCreateModal(false);
    setCreateModalState('creating');

    try {
      const res = await callApi('createActivity', {
        name: newActName,
        date: formattedDate,
        department: newActDept
      });
      if (res.status === 'success') {
        setCreateModalState('created');
        setNewActName('');
        setNewActStartDate('');
        setNewActEndDate('');
        setNewActDept('');
        setTimeout(() => {
          setCreateModalState('idle');
          navigate(`/edit/${res.activityId}`);
        }, 1100);
      } else {
        setCreateModalState('idle');
        setShowCreateModal(true);
        showToast(res.message || '建立失敗', 'error');
      }
    } catch (err) {
      setCreateModalState('idle');
      setShowCreateModal(true);
      showToast(err.message, 'error');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDeleteClick = (id) => {
    setConfirmDeleteId(id);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteId) return;
    setDeleteLoading(true);
    try {
      const res = await callApi('deleteActivity', { id: confirmDeleteId });
      if (res.status === 'success') {
        showToast('活動已刪除，雲端硬碟檔案已同步清理。', 'success');
        fetchActivities();
      } else {
        showToast(res.message || '刪除失敗', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setDeleteLoading(false);
      setConfirmDeleteId(null);
    }
  };

  const handleOpenITTools = (act) => {
    setSelectedActivity(act);
    setCopiedIntro(false);
    setCopiedPics(false);
    setCopiedName(false);
    setCopiedLocation(false);
    setCopiedDate(false);
    setCopiedLinkIndex(null);
    setCopiedAllLinks(false);
    setShowITModal(true);
  };

  const handleCopyText = (text, type) => {
    if (!text) return;
    navigator.clipboard.writeText(text)
      .then(() => {
        if (type === 'name') {
          setCopiedName(true);
          setTimeout(() => setCopiedName(false), 2000);
        } else if (type === 'location') {
          setCopiedLocation(true);
          setTimeout(() => setCopiedLocation(false), 2000);
        } else if (type === 'date') {
          setCopiedDate(true);
          setTimeout(() => setCopiedDate(false), 2000);
        } else if (type === 'allLinks') {
          setCopiedAllLinks(true);
          setTimeout(() => setCopiedAllLinks(false), 2000);
        }
        showToast('已複製到剪貼簿！', 'success');
      })
      .catch(() => showToast('複製失敗', 'error'));
  };

  const handleCopySingleLink = (url, index) => {
    if (!url) return;
    navigator.clipboard.writeText(url)
      .then(() => {
        setCopiedLinkIndex(index);
        setTimeout(() => setCopiedLinkIndex(null), 2000);
        showToast('連結網址已複製！', 'success');
      })
      .catch(() => showToast('複製失敗', 'error'));
  };

  const getSelectedActivityLinks = () => {
    if (!selectedActivity) return [];
    if (selectedActivity.externalLinks && Array.isArray(selectedActivity.externalLinks) && selectedActivity.externalLinks.length > 0) {
      return selectedActivity.externalLinks;
    }
    const links = [];
    if (selectedActivity.albumLink) {
      links.push({ id: 'album', type: '線上相簿', url: selectedActivity.albumLink });
    }
    if (selectedActivity.videoLink) {
      links.push({ id: 'video', type: '回顧影片', url: selectedActivity.videoLink });
    }
    return links;
  };

  const handleCopyIntro = () => {
    if (!selectedActivity) return;
    const template = getIntroductionHtml(selectedActivity.intro);

    navigator.clipboard.writeText(template)
      .then(() => {
        setCopiedIntro(true);
        showToast('簡介 HTML 複製成功！', 'success');
        setTimeout(() => setCopiedIntro(false), 2000);
      })
      .catch(() => showToast('複製失敗', 'error'));
  };

  const handleCopyPictures = () => {
    if (!selectedActivity) return;

    // 輸出包含替換好 photoDatabase 的完整 picture_display.html 範本內容
    const displayTemplate = getPictureDisplayHtml(selectedActivity.recordPhotos);

    navigator.clipboard.writeText(displayTemplate)
      .then(() => {
        setCopiedPics(true);
        showToast('相片輪播完整 HTML 複製成功！', 'success');
        setTimeout(() => setCopiedPics(false), 2000);
      })
      .catch(() => showToast('複製失敗', 'error'));
  };

  const handleCloseActivity = async () => {
    if (!selectedActivity) return;
    setShowITModal(false);
    setCloseModalState('closing');
    try {
      const res = await callApi('updateStatus', { id: selectedActivity.id, status: 'Closed' });
      if (res.status === 'success') {
        setCloseModalState('closed');
        fetchActivities();
        setTimeout(() => {
          setCloseModalState('idle');
          showToast('活動狀態已變更為「Closed (已結案)」！', 'success');
        }, 1300);
      } else {
        setCloseModalState('idle');
        showToast(res.message || '更新失敗', 'error');
      }
    } catch (err) {
      setCloseModalState('idle');
      showToast(err.message, 'error');
    }
  };

  const safeActivities = Array.isArray(activities) ? activities : [];
  const currentTab = (tabs && tabs.length > 0) ? (tabs.find(t => t.key === activeTab) || tabs[0]) : { filter: () => true };
  const filteredActivities = safeActivities.filter(currentTab?.filter || (() => true));

  // 全頁載入中畫面 (顯著轉圈動畫)
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-black">
        <header className="app-header">
          <div className="header-container">
            <div className="header-logo-area">
              <img 
                src={logoImg} 
                alt="CMCollect Logo" 
                style={{ width: '42px', height: '42px', flexShrink: 0, objectFit: 'contain' }} 
              />
              <span className="header-logo-text">CMCollect</span>
              <span className="header-system-tag">活動資料蒐集系統</span>
            </div>
            <div className="user-controls">
              <div className="user-badge">
                <span className="user-dept">{user?.department || '會本部'}</span>
                <span className="user-name">{user?.name || user?.displayName || user?.username || '使用者'}</span>
              </div>
              <button
                onClick={handleLogout}
                className="btn-outline-gold"
                style={{ padding: '8px 18px', fontSize: '13px' }}
                type="button"
              >
                <LogOut size={15} />
                <span>登出</span>
              </button>
            </div>
          </div>
        </header>

        <main className="app-main" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '65vh' }}>
          <div className="glass-card" style={{ maxWidth: '380px', width: '100%', padding: '48px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', borderRadius: '12px', border: '1px solid rgba(212, 175, 55, 0.4)', background: '#141414', boxShadow: '0 20px 50px rgba(0,0,0,0.9)' }}>
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <Loader2 className="animate-spin" style={{ color: 'var(--gold-primary)', width: '48px', height: '48px' }} />
              <div style={{ position: 'absolute', width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(212, 175, 55, 0.15)' }} />
            </div>
            <div>
              <h3 className="serif-title" style={{ fontSize: '18px', fontWeight: '700', color: 'var(--gold-primary)', letterSpacing: '2px', marginBottom: '8px' }}>活動資料同步中</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6' }}>正在從雲端載入活動歸檔資料，請稍候...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-black">
      {/* 頂部導航 */}
      <header className="app-header">
        <div className="header-container">
          <div className="header-logo-area">
            <img 
              src={logoImg} 
              alt="CMCollect Logo" 
              style={{ width: '42px', height: '42px', flexShrink: 0, objectFit: 'contain' }} 
            />
            <span className="header-logo-text">CMCollect</span>
            <span className="header-system-tag">活動資料蒐集系統</span>
          </div>
          <div className="user-controls">
            <div className="user-badge">
              <span className="user-dept">{user?.department || '會本部'}</span>
              <span className="user-name">{user?.name || user?.displayName || user?.username || '使用者'}</span>
            </div>
            <button
              onClick={handleLogout}
              className="btn-outline-gold"
              style={{ padding: '8px 18px', fontSize: '13px' }}
              type="button"
            >
              <LogOut size={15} />
              <span>登出</span>
            </button>
          </div>
        </div>
      </header>

      {/* 主活動列表 */}
      <main className="app-main">
        <div className="dashboard-title-area">
          <div className="dashboard-title-left">
            <h2>活動資料蒐集列表</h2>
            <p>檢視並管理系學會各活動資料蒐集與歸檔進度</p>
          </div>
          <button
            onClick={() => {
              if (user.role === 'DeptHead') {
                setNewActDept(user.department);
              }
              setShowCreateModal(true);
            }}
            className="btn-gold"
            type="button"
            style={{ fontSize: '13px', padding: '10px 20px' }}
          >
            <Plus size={16} />
            快速新增活動
          </button>
        </div>

        {/* 角色專屬分頁標籤列 (Tabs) */}
        <div className="dashboard-tabs">
          {tabs.map(tab => {
            const TabIcon = tab.icon;
            const count = activities.filter(tab.filter).length;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`tab-btn ${isActive ? 'active' : ''}`}
                type="button"
              >
                <TabIcon size={15} />
                <span>{tab.label}</span>
                <span className="tab-badge">{count}</span>
              </button>
            );
          })}
        </div>

        {/* 列表內容 */}
        {filteredActivities.length === 0 ? (
          <div className="glass-card empty-state" style={{ padding: '64px 24px', textAlign: 'center' }}>
            <FileText size={44} style={{ color: 'rgba(212, 175, 55, 0.35)', marginBottom: '12px' }} />
            <p style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)' }}>此分類目前無任何活動紀錄</p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {activeTab === 'draft' || activeTab === 'leadership_draft'
                ? '點擊右上角「快速新增活動」開始建立吧！'
                : '當有符合此狀態的活動時將在此自動呈現。'}
            </p>
          </div>
        ) : (
          <div className="dashboard-grid">
            {filteredActivities.map(act => {
              const actStatus = act?.status || 'Draft';
              return (
                <div key={act.id} className="glass-card activity-card" style={{ position: 'relative' }}>
                  {/* 右上角狀態 badge */}
                  <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
                    <span className={`badge-status ${actStatus.toLowerCase()}`}>
                      {actStatus === 'Draft' ? '草稿' : actStatus === 'Submitted' ? '已提交' : '已結案'}
                    </span>
                  </div>

                  <div className="activity-card-header">
                    <span className="activity-card-dept">{act?.department || ''}</span>
                    <h3 className="activity-card-title">{act?.name || '未命名活動'}</h3>
                  </div>

                  <div className="activity-card-body">
                    <div className="activity-info-item">
                      <Calendar size={14} />
                      <span>{formatToStandardDate(act?.date)}</span>
                    </div>
                    <div className="activity-info-item">
                      <MapPin size={14} />
                      <span>{act?.location || '未填寫地點'}</span>
                    </div>
                    <div className="activity-info-item">
                      <Briefcase size={14} />
                      <span>相片：{act?.recordPhotos ? act.recordPhotos.length : 0} 張</span>
                    </div>
                  </div>

                  {/* 操作按鈕區 */}
                  <div className="activity-card-footer">
                    <div className="activity-actions-left">
                      {user?.role === 'ITDept' && (
                        <button
                          onClick={() => handleOpenITTools(act)}
                          className="btn-gold"
                          style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '4px' }}
                          type="button"
                        >
                          <FileCode size={13} />
                          網管工具
                        </button>
                      )}

                      <button
                        onClick={() => navigate(`/edit/${act.id}`)}
                        className="btn-outline-gold"
                        style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '4px' }}
                        type="button"
                      >
                        {actStatus === 'Draft' || user?.role === 'ITDept' ? (
                          <>
                            <Edit size={13} />
                            <span>編輯資料</span>
                          </>
                        ) : (
                          <>
                            <Eye size={13} />
                            <span>檢視資料</span>
                          </>
                        )}
                      </button>
                    </div>

                    {(((user?.role === 'DeptHead' && act?.department === user?.department) || user?.role === 'Leadership') && actStatus === 'Draft' || user?.role === 'ITDept') && (
                      <button
                        onClick={() => handleDeleteClick(act.id)}
                        style={{ color: '#ff4d4f', border: 'none', background: 'transparent', cursor: 'pointer', padding: '8px', borderRadius: '4px' }}
                        title="刪除活動"
                        type="button"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Modal 1: 快速建立活動 */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-content-wrapper" style={{ maxWidth: '440px' }}>
            <div className="modal-header-area">
              <Plus className="text-gold-primary" style={{ width: '24px', height: '24px' }} />
              <h3 className="serif-title" style={{ fontSize: '18px', fontWeight: '700' }}>快速建立新活動</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{ marginLeft: 'auto', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
                type="button"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-field">
                  <label className="form-field-label">活動名稱</label>
                  <input
                    type="text"
                    placeholder="請輸入活動名稱"
                    className="input-gold"
                    value={newActName}
                    onChange={e => setNewActName(e.target.value)}
                    required
                    disabled={createLoading}
                  />
                </div>
                <div className="form-field">
                  <label className="form-field-label">活動日期</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="date"
                      className="input-gold"
                      max="9999-12-31"
                      value={newActStartDate}
                      onChange={e => {
                        setNewActStartDate(e.target.value);
                        if (!newActEndDate || newActEndDate < e.target.value) {
                          setNewActEndDate(e.target.value);
                        }
                      }}
                      required
                      disabled={createLoading}
                      style={{ flex: 1 }}
                    />
                    <span style={{ color: 'var(--text-muted)' }}>至</span>
                    <input
                      type="date"
                      className="input-gold"
                      max="9999-12-31"
                      value={newActEndDate}
                      onChange={e => setNewActEndDate(e.target.value)}
                      disabled={createLoading}
                      style={{ flex: 1 }}
                      min={newActStartDate}
                    />
                  </div>
                </div>
                <div className="form-field">
                  <label className="form-field-label">指派部門</label>
                  {user.role === 'DeptHead' ? (
                    <input
                      type="text"
                      className="input-gold"
                      style={{ opacity: '0.6', cursor: 'not-allowed' }}
                      value={user.department}
                      readOnly
                    />
                  ) : (
                    <select
                      className="input-gold"
                      value={newActDept}
                      onChange={e => setNewActDept(e.target.value)}
                      required
                      disabled={createLoading}
                    >
                      <option value="">請選擇部門</option>
                      {deptOptions.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="modal-footer-area">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-outline-gold"
                  style={{ padding: '8px 16px', fontSize: '12px' }}
                  disabled={createLoading}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="btn-gold"
                  style={{ padding: '8px 16px', fontSize: '12px' }}
                  disabled={createLoading}
                >
                  {createLoading ? (
                    <>
                      <Loader2 className="animate-spin" style={{ width: '14px', height: '14px' }} />
                      <span>建立中</span>
                    </>
                  ) : (
                    <span>建立活動</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 1.5: 正在建立活動專屬視窗 */}
      {createModalState !== 'idle' && (
        <div className="modal-backdrop" style={{ zIndex: 200 }}>
          <div className="glass-card" style={{ maxWidth: '400px', width: '100%', padding: '36px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', borderRadius: '12px', border: '1px solid rgba(212, 175, 55, 0.4)', background: '#141414', boxShadow: '0 20px 50px rgba(0,0,0,0.9)' }}>
            {createModalState === 'creating' ? (
              <>
                <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <Loader2 className="animate-spin" style={{ color: 'var(--gold-primary)', width: '48px', height: '48px' }} />
                  <div style={{ position: 'absolute', width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(212, 175, 55, 0.15)' }} />
                </div>
                <div>
                  <h3 className="serif-title" style={{ fontSize: '18px', fontWeight: '700', color: 'var(--gold-primary)', letterSpacing: '1px', marginBottom: '8px' }}>正在建立活動</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6' }}>系統正在雲端硬碟建立專屬活動資料夾並初始化資料表，請稍候...</p>
                </div>
              </>
            ) : (
              <>
                <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <CheckCircle2 style={{ color: '#2ecc71', width: '48px', height: '48px' }} />
                </div>
                <div>
                  <h3 className="serif-title" style={{ fontSize: '18px', fontWeight: '700', color: '#2ecc71', letterSpacing: '1px', marginBottom: '8px' }}>活動建立成功！</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6' }}>正在為您導向活動資料編輯頁面...</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal 1.6: 結案處理中專屬視窗 */}
      {closeModalState !== 'idle' && (
        <div className="modal-backdrop" style={{ zIndex: 220 }}>
          <div className="glass-card" style={{ maxWidth: '400px', width: '100%', padding: '36px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', borderRadius: '12px', border: '1px solid rgba(212, 175, 55, 0.4)', background: '#141414', boxShadow: '0 20px 50px rgba(0,0,0,0.9)' }}>
            {closeModalState === 'closing' ? (
              <>
                <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <Loader2 className="animate-spin" style={{ color: 'var(--gold-primary)', width: '48px', height: '48px' }} />
                  <div style={{ position: 'absolute', width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(212, 175, 55, 0.15)' }} />
                </div>
                <div>
                  <h3 className="serif-title" style={{ fontSize: '18px', fontWeight: '700', color: 'var(--gold-primary)', letterSpacing: '1px', marginBottom: '8px' }}>正在標記為結案</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6' }}>正在更新雲端工作表狀態並封存活動發佈紀錄，請稍候...</p>
                </div>
              </>
            ) : (
              <>
                <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <CheckCircle2 style={{ color: '#2ecc71', width: '48px', height: '48px' }} />
                </div>
                <div>
                  <h3 className="serif-title" style={{ fontSize: '18px', fontWeight: '700', color: '#2ecc71', letterSpacing: '1px', marginBottom: '8px' }}>活動已成功結案！</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6' }}>該活動已正式完成系網發佈並歸檔存查。</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal 2: 網管部工具面板 */}
      {showITModal && selectedActivity && (
        <div className="modal-backdrop">
          <div className="modal-content-wrapper" style={{ maxWidth: '640px' }}>
            <div className="modal-header-area">
              <FileCode className="text-gold-primary" style={{ width: '24px', height: '24px' }} />
              <h3 className="serif-title" style={{ fontSize: '18px', fontWeight: '700' }}>網管部專用導出工具</h3>
              <button
                onClick={() => setShowITModal(false)}
                style={{ marginLeft: 'auto', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)' }}
                type="button"
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto', maxHeight: '65vh' }}>
              {/* 活動資訊摘要 */}
              <div style={{ padding: '16px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ fontWeight: '700', color: 'var(--gold-light)', fontSize: '16px' }}>{selectedActivity.name}</h4>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>主辦部門：{selectedActivity.department} | 日期：{formatToStandardDate(selectedActivity.date)}</p>
                </div>
                <span className={`badge-status ${(selectedActivity.status || 'Draft').toLowerCase()}`}>
                  {selectedActivity.status === 'Draft' ? '草稿' : selectedActivity.status === 'Submitted' ? '已提交' : '已結案'}
                </span>
              </div>

              {/* 複製活動基本文字 (名稱、地點、日期) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h5 style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '13px' }}>1. 快速複製活動基本資料 (系網發布欄位)</h5>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                  {/* 名稱 */}
                  <div style={{ padding: '10px 14px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(212,175,55,0.18)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>活動名稱</span>
                      <button
                        type="button"
                        onClick={() => handleCopyText(selectedActivity.name, 'name')}
                        className="btn-outline-gold"
                        style={{ padding: '3px 8px', fontSize: '10px', borderRadius: '4px' }}
                      >
                        {copiedName ? <Check size={11} style={{ color: '#2ecc71' }} /> : <Copy size={11} />}
                        <span>{copiedName ? '已複製' : '複製'}</span>
                      </button>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--gold-light)', wordBreak: 'break-word' }}>
                      {selectedActivity.name}
                    </span>
                  </div>

                  {/* 地點 */}
                  <div style={{ padding: '10px 14px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(212,175,55,0.18)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>活動地點</span>
                      <button
                        type="button"
                        onClick={() => handleCopyText(selectedActivity.location || '', 'location')}
                        className="btn-outline-gold"
                        style={{ padding: '3px 8px', fontSize: '10px', borderRadius: '4px' }}
                        disabled={!selectedActivity.location}
                      >
                        {copiedLocation ? <Check size={11} style={{ color: '#2ecc71' }} /> : <Copy size={11} />}
                        <span>{copiedLocation ? '已複製' : '複製'}</span>
                      </button>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: selectedActivity.location ? '#f0f0f0' : 'var(--text-muted)', wordBreak: 'break-word' }}>
                      {selectedActivity.location || '未填寫地點'}
                    </span>
                  </div>

                  {/* 日期 */}
                  <div style={{ padding: '10px 14px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(212,175,55,0.18)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>活動日期</span>
                      <button
                        type="button"
                        onClick={() => handleCopyText(formatToStandardDate(selectedActivity.date), 'date')}
                        className="btn-outline-gold"
                        style={{ padding: '3px 8px', fontSize: '10px', borderRadius: '4px' }}
                      >
                        {copiedDate ? <Check size={11} style={{ color: '#2ecc71' }} /> : <Copy size={11} />}
                        <span>{copiedDate ? '已複製' : '複製'}</span>
                      </button>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#f0f0f0' }}>
                      {formatToStandardDate(selectedActivity.date) || '未設定'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 複製外部連結 (External Links) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h5 style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '13px' }}>2. 複製外部連結 (External Links)</h5>
                  {getSelectedActivityLinks().length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const allStr = getSelectedActivityLinks().map(l => `${l.type}：${l.url}`).join('\n');
                        handleCopyText(allStr, 'allLinks');
                      }}
                      className="btn-outline-gold"
                      style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '4px' }}
                    >
                      {copiedAllLinks ? <Check size={11} style={{ color: '#2ecc71' }} /> : <Copy size={11} />}
                      <span>{copiedAllLinks ? '已複製全部' : '複製全部連結'}</span>
                    </button>
                  )}
                </div>

                <div style={{ padding: '12px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(212,175,55,0.18)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {getSelectedActivityLinks().length > 0 ? (
                    getSelectedActivityLinks().map((link, idx) => (
                      <div key={link.id || idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', flex: 1 }}>
                          <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 6px', background: 'rgba(212,175,55,0.15)', color: 'var(--gold-light)', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                            {link.type}
                          </span>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: '11px', color: '#a0aec0', textDecoration: 'underline', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            title={link.url}
                          >
                            {link.url}
                          </a>
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            type="button"
                            onClick={() => handleCopySingleLink(link.url, idx)}
                            className="btn-outline-gold"
                            style={{ padding: '3px 8px', fontSize: '10px', borderRadius: '4px', whiteSpace: 'nowrap' }}
                          >
                            {copiedLinkIndex === idx ? <Check size={11} style={{ color: '#2ecc71' }} /> : <Copy size={11} />}
                            <span>{copiedLinkIndex === idx ? '已複製' : '複製網址'}</span>
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
                      此活動尚未填寫任何外部連結
                    </span>
                  )}
                </div>
              </div>

              {/* 複製活動簡介 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h5 style={{ fontWeight: '700', color: 'var(--text-main)' }}>3. 複製活動簡介 HTML (Scroll_bar)</h5>
                  <button
                    onClick={handleCopyIntro}
                    className="btn-outline-gold"
                    style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '4px' }}
                    disabled={!selectedActivity.intro}
                    type="button"
                  >
                    {copiedIntro ? <Check size={12} style={{ color: '#2ecc71' }} /> : <Copy size={12} />}
                    <span>{copiedIntro ? '已複製' : '複製 HTML'}</span>
                  </button>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>將簡介填入並轉換為最新 `Scroll_bar.html` 的外層與段落樣式，用於系網活動簡介滾動框。</p>
                <div style={{ padding: '12px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(212,175,55,0.1)', borderRadius: '4px', fontFamily: 'monospace', fontSize: '11px', color: 'var(--gold-light)', overflowX: 'auto', whiteSpace: 'nowrap' }}>
                  {`&lt;div style="width: 100%; height: 100%; overflow: auto; border: none; ...&gt;`}{selectedActivity.intro || '（無簡介）'}{`&lt;/div&gt;`}
                </div>
              </div>

              {/* 複製紀錄照片 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h5 style={{ fontWeight: '700', color: 'var(--text-main)' }}>4. 複製相片輪播 HTML (picture_display)</h5>
                  <button
                    onClick={handleCopyPictures}
                    className="btn-outline-gold"
                    style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '4px' }}
                    disabled={!selectedActivity.recordPhotos || selectedActivity.recordPhotos.length === 0}
                    type="button"
                  >
                    {copiedPics ? <Check size={12} style={{ color: '#2ecc71' }} /> : <Copy size={12} />}
                    <span>{copiedPics ? '已複製' : '複製輪播 HTML'}</span>
                  </button>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>將 Drive 圖片 ID 轉為 **lh3** CDN 網址，並套入包含結構與 JS 輪播代碼的完整 `picture_display.html` 格式。</p>
                <div style={{ padding: '12px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(212,175,55,0.1)', borderRadius: '4px', fontSize: '11px', maxHeight: '144px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontWeight: '700', color: 'var(--text-muted)' }}>已擷取照片清單：</span>
                  {selectedActivity.recordPhotos && selectedActivity.recordPhotos.length > 0 ? (
                    selectedActivity.recordPhotos.map((p, idx) => (
                      <div key={p.photoId} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace', fontSize: '10px', color: 'var(--text-muted)' }}>
                        <span style={{ color: 'var(--gold-light)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }}>Photo_{idx + 1}: https://lh3.googleusercontent.com/d/{p.fileId}</span>
                        <span>{p.caption} ({p.photographer})</span>
                      </div>
                    ))
                  ) : (
                    <div style={{ color: '#ff4d4f' }}>目前無任何紀錄照片</div>
                  )}
                </div>
              </div>

              {/* 檔案下載與結案 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', paddingTop: '8px' }}>
                <div style={{ padding: '16px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <h5 style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '12px' }}>5. 雲端硬碟媒體下載</h5>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>至 Google Drive 資料夾，可一鍵打包下載所有原圖及主視覺。</p>
                  <a
                    href={`https://drive.google.com/drive/folders/${selectedActivity.folderId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-outline-gold"
                    style={{ textAlign: 'center', padding: '8px', fontSize: '12px' }}
                  >
                    開啟 Google Drive 資料夾
                  </a>
                </div>

                <div style={{ padding: '16px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <h5 style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '12px' }}>6. 發佈完成確認 (結案)</h5>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>網管人員完成系網頁更新後，請點此結案，狀態將變更為「Closed」。</p>
                  <button
                    onClick={handleCloseActivity}
                    className="btn-gold"
                    style={{ padding: '8px', fontSize: '12px' }}
                    disabled={selectedActivity.status === 'Closed'}
                    type="button"
                  >
                    {selectedActivity.status === 'Closed' ? '已結案' : '發佈完成並結案'}
                  </button>
                </div>
              </div>
            </div>

            <div className="modal-footer-area">
              <button
                type="button"
                onClick={() => setShowITModal(false)}
                className="btn-outline-gold"
                style={{ padding: '8px 16px', fontSize: '12px' }}
              >
                關閉視窗
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 統一的自訂確認刪除彈窗 (CustomModal 實作) */}
      <CustomModal
        isOpen={confirmDeleteId !== null}
        onClose={() => !deleteLoading && setConfirmDeleteId(null)}
        title="確認刪除活動？"
        type="warning"
        footer={
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => !deleteLoading && setConfirmDeleteId(null)} className="btn-outline-gold px-4 py-2 text-xs" disabled={deleteLoading} type="button">取消</button>
            <button
              onClick={handleConfirmDelete}
              style={{ background: '#d9363e', color: 'white', fontWeight: '700', padding: '8px 16px', fontSize: '12px', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              disabled={deleteLoading}
              type="button"
            >
              {deleteLoading && <Loader2 className="animate-spin" style={{ width: '12px', height: '12px' }} />}
              {deleteLoading ? '正在刪除...' : '確認刪除'}
            </button>
          </div>
        }
      >
        <div>
          <p style={{ color: 'var(--text-main)', fontSize: '12px' }}>刪除此活動將會同時：</p>
          <ul style={{ listStyleType: 'disc', listStylePosition: 'inside', color: 'var(--text-muted)', fontSize: '12px', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <li>永久移除此筆活動的 Sheets 資料庫紀錄。</li>
            <li><strong style={{ color: '#ff4d4f' }}>刪除</strong> Google Drive 上對應的資料夾及其所有檔案（主視覺與紀錄照片）。</li>
          </ul>
          <p style={{ color: 'var(--text-main)', fontSize: '12px', marginTop: '12px' }}>此動作無法復原，您確定要繼續嗎？</p>
        </div>
      </CustomModal>
    </div>
  );
}
