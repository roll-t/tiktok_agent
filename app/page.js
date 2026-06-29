'use client';

import { useState, useEffect } from 'react';

const getFriendlyError = (err) => {
  if (!err) return '';
  if (err.includes('Daily upload limit') || err.includes('giới hạn')) {
    return 'Kênh đạt giới hạn tải lên của YouTube';
  }
  if (err.includes('Timeout') || err.includes('locator') || err.includes('intercepts') || err.includes('waiting for')) {
    return 'Lỗi phản hồi trình duyệt (Timeout)';
  }
  if (err.includes('session') || err.includes('đăng nhập') || err.includes('login')) {
    return 'Lỗi phiên đăng nhập (Session)';
  }
  return err.length > 50 ? err.slice(0, 47) + '...' : err;
};

export default function Dashboard() {
  const [stats, setStats] = useState({
    channelsCount: 0,
    totalPosts: 0,
    pendingCount: 0,
    processingCount: 0,
    successCount: 0,
    failedCount: 0
  });
  const [posts, setPosts] = useState([]);
  const [sortBy, setSortBy] = useState('newest');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [syncStatus, setSyncStatus] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Hàm tải dữ liệu
  const fetchData = async () => {
    try {
      // Tải danh sách kênh
      const accRes = await fetch('/api/accounts');
      const accData = await accRes.json();
      const accounts = accData.accounts || [];

      // Tải danh sách bài đăng (API này cũng tự động trigger đăng bài đến lịch hẹn)
      const postRes = await fetch('/api/posts');
      const postData = await postRes.json();
      const posts = postData.posts || [];

      // Tính toán thống kê
      const pending = posts.filter(p => p.status === 'pending').length;
      const processing = posts.filter(p => p.status === 'processing').length;
      const success = posts.filter(p => p.status === 'success').length;
      const failed = posts.filter(p => p.status === 'failed').length;

      setStats({
        channelsCount: accounts.length,
        totalPosts: posts.length,
        pendingCount: pending,
        processingCount: processing,
        successCount: success,
        failedCount: failed
      });

      setPosts(posts);
      setSyncStatus(postData.syncStatus || null);
      setLoading(false);
    } catch (error) {
      console.error('Lỗi tải dữ liệu dashboard:', error);
    }
  };

  const handleSyncStats = async () => {
    setIsSyncing(true);
    setSyncMessage('');
    try {
      const res = await fetch('/api/posts/sync-stats', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setSyncMessage(data.message || 'Bắt đầu đồng bộ tương tác ngầm...');
        fetchData();
        setTimeout(() => setSyncMessage(''), 5000);
      } else {
        alert(data.error || 'Lỗi khi đồng bộ tương tác.');
      }
    } catch (err) {
      console.error(err);
      alert('Lỗi kết nối máy chủ.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleStopSync = async () => {
    if (!confirm('Bạn có chắc chắn muốn dừng quá trình đồng bộ tương tác đang chạy?')) return;
    try {
      const res = await fetch('/api/posts/sync-stats?action=stop', { method: 'POST' });
      if (res.ok) {
        setSyncMessage('Đang yêu cầu dừng đồng bộ...');
        setTimeout(fetchData, 1000);
      } else {
        alert('Không thể dừng đồng bộ.');
      }
    } catch (err) {
      console.error(err);
      alert('Lỗi kết nối máy chủ.');
    }
  };

  const handleSyncSinglePost = async (postId) => {
    try {
      const res = await fetch(`/api/posts/sync-stats?id=${postId}`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setPosts(prev => prev.map(p => p.id === postId ? data.post : p));
      } else {
        alert(data.error || 'Lỗi khi đồng bộ.');
      }
    } catch (err) {
      alert('Không thể kết nối đến máy chủ.');
    }
  };

  // Tự động cập nhật sau mỗi 5 giây để cập nhật trạng thái upload ngầm
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const sortedPosts = [...posts]
    .filter(p => p.status !== 'failed')
    .sort((a, b) => {
    if (sortBy === 'views') {
      return (b.views || 0) - (a.views || 0);
    }
    if (sortBy === 'likes') {
      return (b.likes || 0) - (a.likes || 0);
    }
    if (sortBy === 'comments') {
      return (b.comments || 0) - (a.comments || 0);
    }
    const timeA = new Date(a.postedAt || a.scheduledAt || a.createdAt);
    const timeB = new Date(b.postedAt || b.scheduledAt || b.createdAt);
    return timeB - timeA;
  });

  const itemsPerPage = 10;
  const totalItems = sortedPosts.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedPosts = sortedPosts.slice(startIndex, startIndex + itemsPerPage);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid rgba(254, 44, 85, 0.2)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Đang tải dữ liệu dashboard...</span>
        </div>
        <style jsx>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '8px' }}>
          Hệ Thống <span className="gradient-text">AutoPoster YouTube Shorts</span>
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Chào mừng trở lại. Xem trạng thái hoạt động của các kênh YouTube Shorts và tiến trình đăng bài tại đây.
        </p>
      </div>

      {/* Grid thống kê */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '40px' }}>
        <div className="glass-card" style={{ borderLeft: '4px solid var(--secondary)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, uppercase: 'true' }}>KÊNH ĐÃ LIÊN KẾT</span>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, marginTop: '8px', color: '#fff' }}>
            {stats.channelsCount}
          </div>
        </div>

        <div className="glass-card" style={{ borderLeft: '4px solid var(--warning)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, uppercase: 'true' }}>ĐANG HẸN GIỜ (PENDING)</span>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, marginTop: '8px', color: '#fff' }}>
            {stats.pendingCount}
          </div>
        </div>

        <div className="glass-card" style={{ borderLeft: '4px solid var(--accent)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, uppercase: 'true' }}>ĐANG ĐĂNG (PROCESSING)</span>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, marginTop: '8px', color: '#fff' }}>
            {stats.processingCount}
          </div>
        </div>

        <div className="glass-card" style={{ borderLeft: '4px solid #10B981' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, uppercase: 'true' }}>ĐĂNG THÀNH CÔNG</span>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, marginTop: '8px', color: '#10B981' }}>
            {stats.successCount}
          </div>
        </div>

        <div className="glass-card" style={{ borderLeft: '4px solid var(--danger)' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, uppercase: 'true' }}>THẤT BẠI</span>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, marginTop: '8px', color: 'var(--danger)' }}>
            {stats.failedCount}
          </div>
        </div>
      </div>

      {/* Lịch sử hoạt động gần đây */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Lịch Sử Đăng Bài Gần Đây ({totalItems})</h3>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            {syncMessage && (
              <span style={{ fontSize: '0.78rem', color: 'var(--secondary)', background: 'rgba(37,244,238,0.08)', padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(37,244,238,0.15)' }}>
                {syncMessage}
              </span>
            )}
            
            {syncStatus && syncStatus.active ? (
              <>
                <button
                  disabled
                  className="btn btn-secondary"
                  style={{ padding: '8px 16px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'not-allowed', opacity: 0.8 }}
                >
                  <div style={{ width: '12px', height: '12px', border: '1.5px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
                  Đang đồng bộ ({syncStatus.current}/{syncStatus.total})
                </button>
                <button
                  onClick={handleStopSync}
                  className="btn"
                  style={{
                    padding: '8px 16px',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'rgba(255, 71, 87, 0.15)',
                    border: '1px solid rgba(255, 71, 87, 0.3)',
                    color: '#ff4757',
                    cursor: 'pointer',
                    borderRadius: '6px',
                    fontWeight: 600,
                    transition: '0.2s'
                  }}
                >
                  ⏹️ Dừng đồng bộ
                </button>
              </>
            ) : (
              <button
                onClick={handleSyncStats}
                disabled={isSyncing}
                className="btn btn-secondary"
                style={{ padding: '8px 16px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
              >
                {isSyncing ? (
                  <>
                    <div style={{ width: '12px', height: '12px', border: '1.5px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
                    Đang đồng bộ...
                  </>
                ) : (
                  '🔄 Đồng bộ tương tác'
                )}
              </button>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Sắp xếp:</span>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setCurrentPage(1); // Reset page về 1
                }}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.1)',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                <option value="newest">📅 Mới nhất</option>
                <option value="views">👁️ Xem nhiều nhất</option>
                <option value="likes">❤️ Thích nhiều nhất</option>
                <option value="comments">💬 Bình luận nhiều nhất</option>
              </select>
            </div>

            {/* Điều khiển phân trang hàng đầu (Góc trên cùng bên phải) */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '6px', opacity: currentPage === 1 ? 0.4 : 1 }}
                >
                  ◀
                </button>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Trang {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '6px', opacity: currentPage === totalPages ? 0.4 : 1 }}
                >
                  ▶
                </button>
              </div>
            )}
          </div>
        </div>

        {posts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '12px', opacity: 0.5 }}>
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="9" y1="9" x2="15" y2="9"></line>
              <line x1="9" y1="13" x2="15" y2="13"></line>
              <line x1="9" y1="17" x2="11" y2="17"></line>
            </svg>
            <p>Chưa có lịch sử đăng bài nào được lưu.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px 16px', fontSize: '0.85rem' }}>Mã bài đăng</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.85rem' }}>Kênh</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.85rem' }}>Caption</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.85rem' }}>Lịch hẹn / Đăng lúc</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.85rem' }}>Tương Tác</th>
                  <th style={{ padding: '12px 16px', fontSize: '0.85rem' }}>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPosts.map((post) => (
                  <tr key={post.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '16px', fontWeight: 600, fontSize: '0.9rem' }}>{post.id}</td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="badge" style={{
                            background: post.platform === 'youtube' ? 'rgba(255, 71, 87, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                            color: post.platform === 'youtube' ? '#ff4757' : '#fff',
                            border: post.platform === 'youtube' ? '1px solid rgba(255, 71, 87, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
                            padding: '1px 4px',
                            fontSize: '0.65rem'
                          }}>
                            {post.platform === 'youtube' ? 'YT' : 'TT'}
                          </span>
                          <span style={{ fontWeight: 600 }}>{post.accountLabel}</span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{post.platform === 'youtube' ? '' : '@'}{post.accountUsername}</span>
                      </div>
                    </td>
                    <td style={{ padding: '16px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.9rem' }}>
                      {post.caption}
                    </td>
                    <td style={{ padding: '16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {post.status === 'success'
                        ? new Date(post.postedAt).toLocaleString('vi-VN')
                        : new Date(post.scheduledAt).toLocaleString('vi-VN')}
                    </td>
                    <td style={{ padding: '16px' }}>
                      {post.status === 'success' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.8rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#ccc' }} title="Lượt xem">
                              👁️ <strong>{post.views !== undefined ? post.views.toLocaleString() : '0'}</strong>
                            </span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#ff7675' }} title="Lượt thích">
                              ❤️ <strong>{post.likes !== undefined ? post.likes.toLocaleString() : '0'}</strong>
                            </span>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#74b9ff' }} title="Lượt bình luận">
                              💬 <strong>{post.comments !== undefined ? post.comments.toLocaleString() : '0'}</strong>
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSyncSinglePost(post.id)}
                            style={{
                              alignSelf: 'flex-start',
                              background: 'none',
                              border: 'none',
                              color: 'var(--secondary)',
                              fontSize: '0.7rem',
                              cursor: 'pointer',
                              padding: 0,
                              textDecoration: 'underline',
                              opacity: 0.8
                            }}
                          >
                            Đồng bộ
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                        <span className={`badge badge-${post.status}`}>
                          {post.status === 'pending' && 'Hẹn giờ'}
                          {post.status === 'processing' && 'Đang tải lên...'}
                          {post.status === 'success' && 'Thành công'}
                          {post.status === 'failed' && 'Lỗi'}
                        </span>
                        {post.status === 'failed' && post.error && (
                          <span 
                            style={{ 
                              fontSize: '0.72rem', 
                              color: 'var(--danger)', 
                              maxWidth: '220px', 
                              wordBreak: 'break-word', 
                              display: 'inline-block',
                              marginTop: '2px',
                              lineHeight: '1.2',
                              cursor: 'help'
                            }} 
                            title={post.error}
                          >
                            {getFriendlyError(post.error)}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Điều khiển phân trang hàng dưới */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '6px', opacity: currentPage === 1 ? 0.4 : 1 }}
                >
                  ◀ Trước
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.8rem',
                      borderRadius: '6px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: currentPage === page ? 'linear-gradient(135deg, var(--secondary), var(--primary))' : 'rgba(255,255,255,0.02)',
                      color: '#fff',
                      fontWeight: currentPage === page ? 'bold' : 'normal',
                      cursor: 'pointer',
                      transition: '0.2s'
                    }}
                  >
                    {page}
                  </button>
                ))}

                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '6px', opacity: currentPage === totalPages ? 0.4 : 1 }}
                >
                  Sau ▶
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
