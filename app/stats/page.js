'use client';

import { useState, useEffect } from 'react';

// Component hiển thị Avatar kênh đẹp mắt, tự động đổi sang dạng chữ cái đầu gradient nếu ảnh lỗi/trống
function ChannelAvatar({ acc }) {
  const [imgError, setImgError] = useState(false);
  const firstLetter = acc.label ? acc.label.charAt(0).toUpperCase() : 'Y';
  
  const gradients = [
    'linear-gradient(135deg, #FF5E36 0%, #FFAE33 100%)',
    'linear-gradient(135deg, #00F2FE 0%, #4FACFE 100%)',
    'linear-gradient(135deg, #F355DA 0%, #7000FF 100%)',
    'linear-gradient(135deg, #20E2D7 0%, #F9FEA5 100%)',
    'linear-gradient(135deg, #FF4757 0%, #FF6B81 100%)'
  ];
  
  const charCodeSum = acc.label ? acc.label.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) : 0;
  const gradient = gradients[charCodeSum % gradients.length];
  
  if (acc.avatar && acc.avatar !== '/no-avatar.png' && !imgError) {
    return (
      <img
        src={acc.avatar}
        alt=""
        onError={() => setImgError(true)}
        style={{
          width: '38px',
          height: '38px',
          borderRadius: '50%',
          objectFit: 'cover',
          border: '1px solid rgba(255,255,255,0.15)',
          boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
          flexShrink: 0
        }}
      />
    );
  }
  
  return (
    <div style={{
      width: '38px',
      height: '38px',
      borderRadius: '50%',
      background: gradient,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 800,
      fontSize: '1.15rem',
      color: '#fff',
      boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
      textShadow: '0 1px 3px rgba(0,0,0,0.3)',
      border: '1px solid rgba(255,255,255,0.15)',
      flexShrink: 0
    }}>
      {firstLetter}
    </div>
  );
}


export default function StatsPage() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncMessage, setSyncMessage] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  // Tải dữ liệu các kênh và trạng thái đồng bộ
  const fetchData = async () => {
    try {
      const accRes = await fetch('/api/accounts');
      const accData = await accRes.json();
      const loadedAccounts = accData.accounts || [];
      setAccounts(loadedAccounts);

      const syncRes = await fetch('/api/accounts/sync-stats');
      const syncData = await syncRes.json();
      setSyncStatus(syncData.syncStatus);
      
      setLoading(false);
    } catch (err) {
      console.error('Lỗi tải dữ liệu thống kê kênh:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Polling cập nhật tiến trình đồng bộ ngầm cứ mỗi 3 giây nếu tiến trình đang chạy
  useEffect(() => {
    let interval;
    if (syncStatus && syncStatus.active) {
      interval = setInterval(async () => {
        try {
          const syncRes = await fetch('/api/accounts/sync-stats');
          const syncData = await syncRes.json();
          setSyncStatus(syncData.syncStatus);
          
          // Tải lại danh sách tài khoản để hiển thị số liệu mới nhất
          const accRes = await fetch('/api/accounts');
          const accData = await accRes.json();
          setAccounts(accData.accounts || []);
        } catch (err) {
          console.error('Lỗi cập nhật tiến trình đồng bộ:', err);
        }
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [syncStatus]);

  // Bắt đầu đồng bộ
  const handleStartSync = async () => {
    setIsSyncing(true);
    setSyncMessage('');
    try {
      const res = await fetch('/api/accounts/sync-stats', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setSyncMessage(data.message || 'Bắt đầu đồng bộ số liệu ngầm...');
        fetchData();
        setTimeout(() => setSyncMessage(''), 5000);
      } else {
        alert(data.error || 'Lỗi khi đồng bộ.');
      }
    } catch (err) {
      alert('Không thể kết nối máy chủ.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Dừng đồng bộ
  const handleStopSync = async () => {
    if (!confirm('Bạn có chắc chắn muốn dừng quá trình đồng bộ số liệu các kênh?')) return;
    try {
      const res = await fetch('/api/accounts/sync-stats?action=stop', { method: 'POST' });
      if (res.ok) {
        setSyncMessage('Đang yêu cầu dừng đồng bộ...');
        setTimeout(fetchData, 1000);
      } else {
        alert('Không thể dừng đồng bộ.');
      }
    } catch (err) {
      alert('Không thể kết nối máy chủ.');
    }
  };

  // Định dạng số
  const formatNumber = (num) => {
    if (num === undefined || num === null) return '0';
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  // Định dạng ngày giờ cập nhật
  const formatTime = (isoStr) => {
    if (!isoStr) return 'Chưa cập nhật';
    const date = new Date(isoStr);
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + date.toLocaleDateString('vi-VN');
  };

  // Tính toán số liệu tổng quan
  const totalSubscribers = accounts.reduce((sum, acc) => sum + (acc.subscribers || 0), 0);
  const totalViews = accounts.reduce((sum, acc) => sum + (acc.views || 0), 0);
  const totalVideos = accounts.reduce((sum, acc) => sum + (acc.videoCount || 0), 0);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--secondary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
      </div>
    );
  }

  return (
    <div>
      {/* Tiêu đề trang */}
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '8px' }}>
            Thống Kê <span className="gradient-text">Kênh YouTube</span>
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>
            Theo dõi số đăng ký, lượt xem, video và các chủ đề thịnh hành của tất cả các kênh YouTube trong hệ thống.
          </p>
        </div>

        {/* Nút bấm đồng bộ số liệu */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
          {syncStatus && syncStatus.active ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--secondary)', fontWeight: 600, animation: 'pulse 1.5s infinite' }}>
                ⚡ {syncStatus.message}
              </span>
              <button
                onClick={handleStopSync}
                className="btn btn-secondary"
                style={{ background: 'var(--danger)', borderColor: 'var(--danger)', color: '#fff', padding: '8px 16px', fontSize: '0.85rem' }}
              >
                Dừng đồng bộ
              </button>
            </div>
          ) : (
            <button
              onClick={handleStartSync}
              disabled={isSyncing || accounts.length === 0}
              className="btn btn-primary"
              style={{ padding: '10px 20px', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              🔄 Đồng bộ số liệu kênh
            </button>
          )}
          {syncMessage && (
            <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>
              {syncMessage}
            </span>
          )}
        </div>
      </div>

      {/* Khối thống kê tổng quan */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '40px' }}>
        <div className="glass-card" style={{ borderLeft: '4px solid var(--secondary)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>TỔNG SỐ KÊNH</span>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, marginTop: '8px', color: '#fff' }}>
            {accounts.length}
          </div>
        </div>
        <div className="glass-card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>TỔNG SỐ ĐĂNG KÝ</span>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, marginTop: '8px', color: '#fff' }}>
            {formatNumber(totalSubscribers)}
          </div>
        </div>
        <div className="glass-card" style={{ borderLeft: '4px solid var(--success)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>TỔNG LƯỢT XEM KÊNH</span>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, marginTop: '8px', color: '#fff' }}>
            {formatNumber(totalViews)}
          </div>
        </div>
        <div className="glass-card" style={{ borderLeft: '4px solid #ffb300' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>TỔNG SỐ VIDEO</span>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, marginTop: '8px', color: '#fff' }}>
            {formatNumber(totalVideos)}
          </div>
        </div>
      </div>

      {/* Bảng chi tiết từng kênh */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '20px' }}>Chi Tiết Các Kênh</h3>

        {accounts.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>Chưa có tài khoản kênh nào được liên kết.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px' }}>
                  <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>Kênh YouTube</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>Danh Mục</th>
                  <th style={{ textAlign: 'center', padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>Số Đăng Ký</th>
                  <th style={{ textAlign: 'center', padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>Lượt Xem Kênh</th>
                  <th style={{ textAlign: 'center', padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>Số Video</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>Chủ Đề (Top Hashtag)</th>
                  <th style={{ textAlign: 'right', padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>Cập Nhật Cuối</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((acc) => (
                  <tr key={acc.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: '0.2s' }}>
                    
                    {/* Thông tin kênh */}
                    <td style={{ padding: '16px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <ChannelAvatar acc={acc} />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {acc.channelUrl ? (
                            <a
                              href={acc.channelUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: '#fff', fontWeight: 600, fontSize: '0.88rem', textDecoration: 'none', transition: '0.2s' }}
                              onMouseEnter={e => e.currentTarget.style.color = 'var(--secondary)'}
                              onMouseLeave={e => e.currentTarget.style.color = '#fff'}
                            >
                              {acc.label}
                            </a>
                          ) : (
                            <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.88rem' }}>{acc.label}</span>
                          )}
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>@{acc.email.split('@')[0]}</span>
                        </div>
                      </div>
                    </td>

                    {/* Danh mục */}
                    <td style={{ padding: '16px 16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      <span style={{
                        background: 'rgba(0, 242, 254, 0.08)',
                        color: '#00f2fe',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600
                      }}>
                        {acc.category || 'Chưa phân loại'}
                      </span>
                    </td>

                    {/* Số người đăng ký */}
                    <td style={{ padding: '16px 16px', textAlign: 'center', fontWeight: 700, fontSize: '0.9rem', color: '#fff' }}>
                      {formatNumber(acc.subscribers)}
                    </td>

                    {/* Số lượt xem */}
                    <td style={{ padding: '16px 16px', textAlign: 'center', fontSize: '0.9rem', color: '#eee' }}>
                      {formatNumber(acc.views)}
                    </td>

                    {/* Số lượng video */}
                    <td style={{ padding: '16px 16px', textAlign: 'center', fontSize: '0.9rem', color: '#eee' }}>
                      {formatNumber(acc.videoCount)}
                    </td>

                    {/* Top Hashtags */}
                    <td style={{ padding: '16px 16px' }}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {acc.topHashtags && acc.topHashtags.length > 0 ? (
                          acc.topHashtags.map((tag, idx) => (
                            <span
                              key={idx}
                              style={{
                                background: 'rgba(255, 71, 87, 0.08)',
                                color: 'var(--danger)',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '0.72rem',
                                fontWeight: 700
                              }}
                            >
                              {tag}
                            </span>
                          ))
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Chưa đăng clip nào</span>
                        )}
                      </div>
                    </td>

                    {/* Ngày cập nhật cuối */}
                    <td style={{ padding: '16px 16px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {formatTime(acc.statsUpdatedAt)}
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}
