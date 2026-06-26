'use client';

import { useState, useEffect } from 'react';

export default function Dashboard() {
  const [stats, setStats] = useState({
    channelsCount: 0,
    totalPosts: 0,
    pendingCount: 0,
    processingCount: 0,
    successCount: 0,
    failedCount: 0
  });
  const [recentPosts, setRecentPosts] = useState([]);
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

      // Sắp xếp bài đăng theo thời gian mới nhất
      const sortedPosts = [...posts].sort((a, b) => {
        const timeA = new Date(a.postedAt || a.scheduledAt || a.createdAt);
        const timeB = new Date(b.postedAt || b.scheduledAt || b.createdAt);
        return timeB - timeA;
      });
      setRecentPosts(sortedPosts);
      setLoading(false);
    } catch (error) {
      console.error('Lỗi tải dữ liệu dashboard:', error);
    }
  };

  // Tự động cập nhật sau mỗi 5 giây để cập nhật trạng thái upload ngầm
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const itemsPerPage = 10;
  const totalItems = recentPosts.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedPosts = recentPosts.slice(startIndex, startIndex + itemsPerPage);

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Lịch Sử Đăng Bài Gần Đây ({totalItems})</h3>

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

        {recentPosts.length === 0 ? (
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
                      <span className={`badge badge-${post.status}`}>
                        {post.status === 'pending' && 'Hẹn giờ'}
                        {post.status === 'processing' && 'Đang tải lên...'}
                        {post.status === 'success' && 'Thành công'}
                        {post.status === 'failed' && 'Lỗi'}
                      </span>
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
