import React, { useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ActivityEditPage from './pages/ActivityEditPage';
import Toast from './components/Toast';

const getStoredUser = () => {
  const user = sessionStorage.getItem('cmc_user');
  return user ? JSON.parse(user) : null;
};

export default function App() {
  const [user, setUser] = useState(getStoredUser());
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
  };

  const handleLogout = () => {
    sessionStorage.removeItem('cmc_user');
    setUser(null);
    showToast('已成功登出系統', 'success');
  };

  return (
    <HashRouter>
      <div className="min-h-screen bg-[#0a0a0a]">
        <Routes>
          <Route 
            path="/login" 
            element={<LoginPage setUser={setUser} showToast={showToast} />} 
          />
          <Route 
            path="/dashboard" 
            element={
              user ? (
                <DashboardPage user={user} handleLogout={handleLogout} showToast={showToast} />
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
          <Route 
            path="/edit/:id" 
            element={
              user ? (
                <ActivityEditPage user={user} showToast={showToast} />
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
          <Route 
            path="*" 
            element={<Navigate to={user ? "/dashboard" : "/login"} replace />} 
          />
        </Routes>

        {/* 全域 Toast 輕量通知 */}
        {toast && (
          <Toast 
            message={toast.message} 
            type={toast.type} 
            onClose={() => setToast(null)} 
          />
        )}
      </div>
    </HashRouter>
  );
}
