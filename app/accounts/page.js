'use client';

import { useState, useEffect } from 'react';

export default function AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Trạng thái cho Form thêm tài khoản
  const [label, setLabel] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');

  const fetchAccounts = async () => {
    try {
      const res = await fetch('/api/accounts');
      const data = await res.json();
      setAccounts(data.accounts || []);
      setLoading(false);
    } catch (error) {
      console.error('Lỗi tải danh sách kênh:', error);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleAddAccount = async (e) => {
    e.preventDefault();
    if (!label.trim()) return;

    setIsLoggingIn(true);
    setLoginError('');

    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ label: label.trim() })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setLabel('');
        fetchAccounts(); // Tải lại danh sách
      } else {
        setLoginError(data.error || 'Đăng nhập không thành công hoặc trình duyệt bị đóng.');
      }
    } catch (error) {
      setLoginError('Có lỗi xảy ra trong quá trình mở trình duyệt đăng nhập.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleDeleteAccount = async (id) => {
    if (!confirm('Bạn có chắc chắn muốn xóa kênh TikTok này? Tất cả phiên đăng nhập sẽ bị hủy.')) {
      return;
    }

    try {
      const res = await fetch(`/api/accounts/${id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        fetchAccounts();
      } else {
        const data = await res.json();
        alert(data.error || 'Không thể xóa kênh.');
      }
    } catch (error) {
      alert('Đã xảy ra lỗi khi xóa kênh.');
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '8px' }}>
          Quản Lý <span className="gradient-text">Kênh TikTok</span>
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Kết nối và lưu thông tin đăng nhập đa tài khoản TikTok qua cơ chế tự động hóa an toàn.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '30px', alignItems: 'start' }}>
        
        {/* Form liên kết tài khoản mới */}
        <div className="glass-card">
          <h3 style={{ fontSize: '1.25rem', marginBottom: '16px', fontWeight: 700 }}>Thêm Kênh Mới</h3>
          
          <form onSubmit={handleAddAccount}>
            <div className="form-group">
              <label className="form-label">Tên Nhãn Kênh (Ví dụ: Kênh Reup Đồ Gia Dụng)</label>
              <input
                type="text"
                className="form-control"
                placeholder="Nhập tên gợi nhớ..."
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                disabled={isLoggingIn}
                required
              />
            </div>

            {loginError && (
              <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '16px', padding: '10px', background: 'var(--danger-bg)', borderRadius: '8px', border: '1px solid rgba(255, 71, 87, 0.2)' }}>
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '14px' }}
              disabled={isLoggingIn}
            >
              {isLoggingIn ? 'Đang chạy trình duyệt...' : 'Bắt Đầu Đăng Nhập'}
            </button>
          </form>

          {isLoggingIn && (
            <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(37, 244, 238, 0.08)', borderRadius: '10px', border: '1px solid rgba(37, 244, 238, 0.15)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '20px', height: '20px', border: '2.5px solid rgba(37, 244, 238, 0.2)', borderTopColor: 'var(--secondary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                <strong style={{ fontSize: '0.9rem', color: 'var(--secondary)' }}>Trình duyệt đã mở!</strong>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                Vui lòng chuyển qua cửa sổ Chrome vừa xuất hiện, thực hiện đăng nhập vào kênh TikTok của bạn. Hệ thống sẽ tự lưu phiên làm việc và đóng cửa sổ khi thành công.
              </p>
            </div>
          )}
        </div>

        {/* Danh sách các tài khoản */}
        <div className="glass-card">
          <h3 style={{ fontSize: '1.25rem', marginBottom: '20px', fontWeight: 700 }}>Danh Sách Kênh Đã Liên Kết ({accounts.length})</h3>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Đang tải danh sách kênh...</div>
          ) : accounts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '12px', opacity: 0.5 }}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
              </svg>
              <p>Chưa có kênh TikTok nào được liên kết.</p>
              <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>Hãy nhập tên nhãn ở khung bên trái và bấm bắt đầu để thêm tài khoản.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {accounts.map((acc) => (
                <div key={acc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', transition: '0.2s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), var(--accent))', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '1.25rem', fontWeight: 800, color: '#fff' }}>
                      {acc.label.charAt(0).toUpperCase()}
                    </div>
                    
                    <div>
                      <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>{acc.label}</h4>
                      <div style={{ display: 'flex', gap: '12px', marginTop: '4px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <span>username: <strong>@{acc.username}</strong></span>
                        <span>•</span>
                        <span>Đã thêm: {new Date(acc.createdAt).toLocaleDateString('vi-VN')}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span className="badge badge-success" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
                      Hoạt động
                    </span>
                    <button
                      onClick={() => handleDeleteAccount(acc.id)}
                      className="btn btn-danger"
                      style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                    >
                      Xóa Kênh
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
      
      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
