import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Shield, Loader2, Eye, EyeOff } from 'lucide-react';
import { callApi } from '../utils/api';
import logoImg from '../assets/logo.png';

export default function LoginPage({ setUser, showToast }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const user = sessionStorage.getItem('cmc_user');
    if (user) {
      navigate('/dashboard');
      return;
    }
    // 載入記住的帳密
    const savedUser = localStorage.getItem('cmc_remembered_user');
    const savedPass = localStorage.getItem('cmc_remembered_pass');
    if (savedUser && savedPass) {
      setUsername(savedUser);
      setPassword(savedPass);
      setRememberMe(true);
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      showToast('請填寫帳號與密碼', 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await callApi('login', { username, password });
      if (res.status === 'success') {
        sessionStorage.setItem('cmc_user', JSON.stringify(res.user));
        setUser(res.user);

        // 處理記住帳密
        if (rememberMe) {
          localStorage.setItem('cmc_remembered_user', username);
          localStorage.setItem('cmc_remembered_pass', password);
        } else {
          localStorage.removeItem('cmc_remembered_user');
          localStorage.removeItem('cmc_remembered_pass');
        }

        showToast(`歡迎回來，${res.user.name}！`, 'success');
        navigate('/dashboard');
      } else {
        showToast(res.message || '登入失敗，請檢查帳號或密碼。', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-wrapper">
      <div className="glass-card login-card">
        {/* 精緻金色流光背景裝飾 */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-gold-primary to-transparent" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'linear-gradient(90deg, transparent, var(--gold-primary), transparent)' }} />

        <div className="text-center">
          <img 
            src={logoImg} 
            alt="CMCollect Logo" 
            onError={(e) => {
              if (!e.target.dataset.tried) {
                e.target.dataset.tried = 'true';
                e.target.src = `${import.meta.env.BASE_URL}logo.png`;
              }
            }}
            style={{ width: '76px', height: '76px', margin: '0 auto 14px auto', display: 'block', objectFit: 'contain' }} 
          />
          <h1 className="text-3xl font-bold serif-title mb-2">CMCollect</h1>
          <p className="text-xs text-text-muted uppercase tracking-widest" style={{ letterSpacing: '1px' }}>系學會活動資料蒐集與管理系統</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-form-group">
            <label>帳號</label>
            <div className="input-with-icon-wrapper">
              <span className="input-icon-left">
                <User size={18} />
              </span>
              <input
                type="text"
                placeholder="請輸入學號"
                className="input-gold input-gold-with-icon"
                value={username}
                onChange={e => setUsername(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="login-form-group">
            <label>密碼</label>
            <div className="input-with-icon-wrapper" style={{ position: 'relative' }}>
              <span className="input-icon-left">
                <Shield size={18} />
              </span>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="請輸入密碼"
                className="input-gold input-gold-with-icon"
                style={{ paddingRight: '40px' }}
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  top: '50%',
                  right: '12px',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: 0
                }}
                disabled={loading}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* 記住帳密 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '12px', marginBottom: '8px' }}>
            <input
              type="checkbox"
              id="rememberMe"
              checked={rememberMe}
              onChange={e => setRememberMe(e.target.checked)}
              style={{
                width: '14px',
                height: '14px',
                accentColor: 'var(--gold-primary)',
                cursor: 'pointer'
              }}
            />
            <label htmlFor="rememberMe" style={{ fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none' }}>
              記住帳號密碼
            </label>
          </div>

          <button
            type="submit"
            className="btn-gold btn-full mt-4"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin w-4 h-4" />
                登入中...
              </>
            ) : (
              '登入系統'
            )}
          </button>
        </form>

        <div className="text-center mt-6">
          <p style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.35)', letterSpacing: '0.5px' }}>
            本系統僅供長庚大學中醫系系學會內部管理使用
          </p>
        </div>
      </div>
    </div>
  );
}
