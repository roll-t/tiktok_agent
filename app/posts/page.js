'use client';

import { useState, useEffect, useRef } from 'react';

export default function PostsPage() {
  const [accounts, setAccounts] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Trạng thái cho Form upload
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [caption, setCaption] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [videoFile, setVideoFile] = useState(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [formError, setFormError] = useState('');
  
  const fileInputRef = useRef(null);

  const fetchData = async () => {
    try {
      const accRes = await fetch('/api/accounts');
      const accData = await accRes.json();
      setAccounts(accData.accounts || []);

      const postRes = await fetch('/api/posts');
      const postData = await postRes.json();
      setPosts(postData.posts || []);
      
      setLoading(false);
    } catch (error) {
      console.error('Lỗi tải danh sách bài đăng:', error);
    }
  };

  useEffect(() => {
    fetchData();
    // Tự động reload mỗi 5 giây để xem tiến trình đăng bài ngầm
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setVideoFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!selectedAccountId) {
      setFormError('Vui lòng chọn tài khoản TikTok để đăng bài.');
      return;
    }
    if (!videoFile) {
      setFormError('Vui lòng chọn tệp video (.mp4).');
      return;
    }

    setIsSubmitting(true);
    setUploadPercent(0);

    const formData = new FormData();
    formData.append('video', videoFile);
    formData.append('accountId', selectedAccountId);
    formData.append('caption', caption);
    if (scheduledAt) {
      formData.append('scheduledAt', new Date(scheduledAt).toISOString());
    }

    try {
      // Dùng XMLHttpRequest để theo dõi tiến trình upload file lên server
      const xhr = new XMLHttpRequest();
      
      const uploadPromise = new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            setUploadPercent(percent);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            reject(new Error(xhr.responseText || 'Gửi video thất bại.'));
          }
        });

        xhr.addEventListener('error', () => reject(new Error('Lỗi kết nối mạng.')));
        
        xhr.open('POST', '/api/posts');
        xhr.send(formData);
      });

      await uploadPromise;
      
      // Reset form
      setCaption('');
      setScheduledAt('');
      setVideoFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      fetchData();
    } catch (error) {
      console.error(error);
      setFormError(error.message || 'Đã xảy ra lỗi khi tạo bài viết.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRunNow = async (postId) => {
    try {
      const res = await fetch('/api/posts/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ postId })
      });
      if (res.ok) {
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || 'Không thể đăng ngay lúc này.');
      }
    } catch (error) {
      alert('Lỗi kích hoạt đăng bài.');
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '8px' }}>
          Đăng Clip & <span className="gradient-text">Hẹn Giờ Lên Lịch</span>
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Thiết lập nội dung, chọn kênh đăng và hẹn giờ đăng tải video tự động lên TikTok.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '30px', alignItems: 'start' }}>
        
        {/* Form Đăng Bài / Lên Lịch */}
        <div className="glass-card">
          <h3 style={{ fontSize: '1.25rem', marginBottom: '16px', fontWeight: 700 }}>Tạo Bài Đăng Mới</h3>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Chọn tài khoản đăng</label>
              <select
                className="form-control"
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                disabled={isSubmitting}
                required
              >
                <option value="">-- Chọn kênh TikTok --</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.label} (@{acc.username})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Chọn File Video (.mp4)</label>
              <input
                type="file"
                className="form-control"
                accept="video/mp4,video/quicktime"
                onChange={handleFileChange}
                disabled={isSubmitting}
                ref={fileInputRef}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Caption & Hashtags</label>
              <textarea
                className="form-control"
                rows="4"
                placeholder="Nhập nội dung mô tả video và hashtag (ví dụ: Video đăng tự động #automation #mmo)..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                disabled={isSubmitting}
                style={{ resize: 'none', fontFamily: 'inherit' }}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Hẹn giờ đăng (để trống nếu muốn ĐĂNG NGAY)</label>
              <input
                type="datetime-local"
                className="form-control"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            {formError && (
              <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '16px', padding: '10px', background: 'var(--danger-bg)', borderRadius: '8px', border: '1px solid rgba(255, 71, 87, 0.2)' }}>
                {formError}
              </div>
            )}

            {isSubmitting && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  <span>Đang tải video lên máy chủ...</span>
                  <span>{uploadPercent}%</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${uploadPercent}%`, height: '100%', background: 'linear-gradient(90deg, var(--secondary), var(--primary))', transition: 'width 0.1s ease' }}></div>
                </div>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '14px' }}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Đang Xử Lý...' : (scheduledAt ? 'Lên Lịch Hẹn Giờ' : 'Đăng Ngay Bây Giờ')}
            </button>
          </form>
        </div>

        {/* Danh Sách Bài Đăng & Hàng Đợi */}
        <div className="glass-card">
          <h3 style={{ fontSize: '1.25rem', marginBottom: '20px', fontWeight: 700 }}>Danh Sách Bài Đăng</h3>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Đang tải danh sách...</div>
          ) : posts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '12px', opacity: 0.5 }}>
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              <p>Chưa có bài đăng nào được tạo.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {posts.map((post) => (
                <div key={post.id} style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  
                  {/* Top Bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>{post.id}</span>
                      <span>•</span>
                      <strong style={{ fontSize: '0.9rem', color: '#fff' }}>{post.accountLabel}</strong>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>(@{post.accountUsername})</span>
                    </div>

                    <span className={`badge badge-${post.status}`}>
                      {post.status === 'pending' && 'Đang hẹn giờ'}
                      {post.status === 'processing' && 'Đang đăng tải...'}
                      {post.status === 'success' && 'Thành công'}
                      {post.status === 'failed' && 'Lỗi'}
                    </span>
                  </div>

                  {/* Caption & Video Info */}
                  <div style={{ display: 'flex', gap: '16px', background: 'rgba(0,0,0,0.1)', padding: '10px', borderRadius: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: 1.4, whiteSpace: 'pre-line' }}>{post.caption}</p>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
                        Tệp video: {post.videoFilename}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Bar: Action buttons and status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <div>
                      {post.status === 'success' ? (
                        <span>Đã đăng lúc: <strong>{new Date(post.postedAt).toLocaleString('vi-VN')}</strong></span>
                      ) : (
                        <span>Lịch đăng: <strong>{new Date(post.scheduledAt).toLocaleString('vi-VN')}</strong></span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      {(post.status === 'pending' || post.status === 'failed') && (
                        <button
                          onClick={() => handleRunNow(post.id)}
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '6px' }}
                        >
                          Đăng Ngay
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Error display */}
                  {post.status === 'failed' && post.error && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--danger)', background: 'var(--danger-bg)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(255, 71, 87, 0.15)' }}>
                      <strong>Lỗi:</strong> {post.error}
                    </div>
                  )}
                  
                  {/* Processing display status details */}
                  {post.status === 'processing' && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '12px', height: '12px', border: '1.5px solid rgba(37, 244, 238, 0.2)', borderTopColor: 'var(--secondary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                      Trình duyệt Playwright đang đăng nhập và tải video lên TikTok. Vui lòng không tắt Server.
                    </div>
                  )}

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
