'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DownloadPage() {
  const router = useRouter();
  const [tiktokUrl, setTiktokUrl] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState('');
  
  // Thông tin video đã tải về thành công
  const [downloadedVideo, setDownloadedVideo] = useState(null);
  
  // Danh sách tài khoản TikTok để liên kết đăng bài
  const [accounts, setAccounts] = useState([]);
  
  // Trạng thái cho Form đăng bài Reup
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [reupCaption, setReupCaption] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleSuccess, setScheduleSuccess] = useState(false);
  
  // Danh sách các video đã tải gần đây từ database
  const [recentDownloads, setRecentDownloads] = useState([]);
  const [historyPage, setHistoryPage] = useState(1);
  const HISTORY_PER_PAGE = 10;

  // Trạng thái modal tùy chọn & xem video
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [showVideoPlayer, setShowVideoPlayer] = useState(false);

  // Hàm tải danh sách video gần đây
  const fetchRecentDownloads = async () => {
    try {
      const res = await fetch('/api/download');
      const data = await res.json();
      if (data.success) {
        setRecentDownloads(data.downloads || []);
      }
    } catch (err) {
      console.error('Lỗi tải lịch sử video:', err);
    }
  };

  useEffect(() => {
    // Tải danh sách kênh để chọn đăng bài
    const fetchAccounts = async () => {
      try {
        const res = await fetch('/api/accounts');
        const data = await res.json();
        setAccounts(data.accounts || []);
        if (data.accounts && data.accounts.length > 0) {
          setSelectedAccountId(data.accounts[0].id);
        }
      } catch (err) {
        console.error('Lỗi tải danh sách kênh:', err);
      }
    };
    fetchAccounts();
    fetchRecentDownloads();
  }, []);

  const isBusy = isDownloading || isScheduling || (downloadedVideo !== null && !scheduleSuccess);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.isAppBusy = isBusy;
    }
    const handleBeforeUnload = (e) => {
      if (isBusy) {
        e.preventDefault();
        e.returnValue = 'Hệ thống đang tải hoặc lên lịch đăng video. Bạn có chắc chắn muốn rời đi?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (typeof window !== 'undefined') {
        window.isAppBusy = false;
      }
    };
  }, [isBusy]);

  const handleDownload = async (e) => {
    e.preventDefault();
    if (!tiktokUrl.trim()) return;

    setIsDownloading(true);
    setError('');
    setDownloadedVideo(null);
    setScheduleSuccess(false);

    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url: tiktokUrl.trim() })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setDownloadedVideo(data);
        setReupCaption(data.caption);
        fetchRecentDownloads(); // Cập nhật lại lịch sử tải từ database
      } else {
        setError(data.error || 'Tải video thất bại. Vui lòng kiểm tra lại đường dẫn.');
      }
    } catch (err) {
      setError('Đã xảy ra lỗi kết nối đến máy chủ.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!downloadedVideo || !selectedAccountId) return;

    setIsScheduling(true);
    setError('');

    const formData = new FormData();
    formData.append('videoFilename', downloadedVideo.videoFilename);
    formData.append('accountId', selectedAccountId);
    formData.append('caption', reupCaption);
    if (scheduledAt) {
      formData.append('scheduledAt', new Date(scheduledAt).toISOString());
    }

    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setScheduleSuccess(true);
        // Chuyển hướng sang trang quản lý bài đăng sau 2 giây
        setTimeout(() => {
          router.push('/posts');
        }, 1500);
      } else {
        setError(data.error || 'Lên lịch bài đăng thất bại.');
      }
    } catch (err) {
      setError('Lỗi kết nối khi tạo bài đăng.');
    } finally {
      setIsScheduling(false);
    }
  };

  const handleClearHistory = async () => {
    if (confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử tải video?')) {
      try {
        const res = await fetch('/api/download', { method: 'DELETE' });
        if (res.ok) {
          setRecentDownloads([]);
        }
      } catch (err) {
        console.error('Lỗi xóa lịch sử:', err);
      }
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '8px' }}>
          Tải Video & <span className="gradient-text">Reup Đa Nền Tảng</span>
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Tải video từ TikTok (không logo), YouTube Shorts, Facebook Reels và đăng hoặc lên lịch trực tiếp lên các kênh YouTube của bạn.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: downloadedVideo ? '1.1fr 0.9fr' : '1fr', gap: '30px', alignItems: 'start', transition: '0.3s' }}>
        
        {/* Khung nhập URL và Tải về */}
        <div className="glass-card">
          <h3 style={{ fontSize: '1.25rem', marginBottom: '16px', fontWeight: 700 }}>Nhập Liên Kết Video</h3>
          
          <form onSubmit={handleDownload}>
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label">Link video (TikTok, YouTube Shorts, Facebook Reels...)</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type="url"
                  className="form-control"
                  placeholder="Dán link TikTok, YouTube Shorts hoặc Facebook Reels..."
                  value={tiktokUrl}
                  onChange={(e) => setTiktokUrl(e.target.value)}
                  disabled={isDownloading || isScheduling}
                  required
                  style={{ paddingRight: '76px' }}
                />
                {/* Icon Paste từ clipboard */}
                <button
                  type="button"
                  title="Dán link từ clipboard"
                  disabled={isDownloading || isScheduling}
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      if (text && text.trim()) {
                        setTiktokUrl(text.trim());
                      }
                    } catch (err) {
                      console.error('Không thể đọc clipboard:', err);
                    }
                  }}
                  style={{
                    position: 'absolute',
                    right: '40px',
                    background: 'none',
                    border: 'none',
                    cursor: isDownloading || isScheduling ? 'not-allowed' : 'pointer',
                    padding: '6px',
                    color: tiktokUrl ? 'var(--secondary)' : 'rgba(255,255,255,0.3)',
                    opacity: isDownloading || isScheduling ? 0.4 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    transition: '0.2s',
                    borderRadius: '4px'
                  }}
                  onMouseEnter={e => { if (!isDownloading && !isScheduling) e.currentTarget.style.color = 'var(--secondary)'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = tiktokUrl ? 'var(--secondary)' : 'rgba(255,255,255,0.3)'; e.currentTarget.style.background = 'none'; }}
                >
                  {/* Clipboard paste icon */}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                    <line x1="9" y1="12" x2="15" y2="12"/>
                    <line x1="9" y1="16" x2="13" y2="16"/>
                  </svg>
                </button>
                {/* Icon Clear - xóa nội dung ô input */}
                <button
                  type="button"
                  title="Xóa nội dung"
                  disabled={isDownloading || isScheduling || !tiktokUrl}
                  onClick={() => setTiktokUrl('')}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    background: 'none',
                    border: 'none',
                    cursor: (!tiktokUrl || isDownloading || isScheduling) ? 'not-allowed' : 'pointer',
                    padding: '6px',
                    color: tiktokUrl ? 'rgba(255,71,87,0.7)' : 'rgba(255,255,255,0.2)',
                    opacity: (!tiktokUrl || isDownloading || isScheduling) ? 0.35 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    transition: '0.2s',
                    borderRadius: '4px'
                  }}
                  onMouseEnter={e => { if (tiktokUrl && !isDownloading && !isScheduling) { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'rgba(255,71,87,0.1)'; } }}
                  onMouseLeave={e => { e.currentTarget.style.color = tiktokUrl ? 'rgba(255,71,87,0.7)' : 'rgba(255,255,255,0.2)'; e.currentTarget.style.background = 'none'; }}
                >
                  {/* X circle icon */}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                </button>
              </div>
            </div>

            {error && (
              <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '16px', padding: '10px', background: 'var(--danger-bg)', borderRadius: '8px', border: '1px solid rgba(255, 71, 87, 0.2)' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '14px', position: 'relative' }}
              disabled={isDownloading || isScheduling}
            >
              {isDownloading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                  <div style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
                  <span>Đang tải video về máy chủ...</span>
                </div>
              ) : 'Tải Video'}
            </button>
          </form>

          {/* Danh sách video đã tải gần đây */}
          {recentDownloads.length > 0 && (() => {
            const totalPages = Math.ceil(recentDownloads.length / HISTORY_PER_PAGE);
            const visibleDownloads = recentDownloads.slice(0, historyPage * HISTORY_PER_PAGE);
            const hasMore = historyPage < totalPages;

            return (
              <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--secondary)' }}>
                    Video Đã Tải Gần Đây ({visibleDownloads.length}/{recentDownloads.length}):
                  </span>
                  <button
                    type="button"
                    onClick={handleClearHistory}
                    style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: '0.75rem', cursor: 'pointer', opacity: 0.7 }}
                  >
                    Xóa lịch sử
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '12px' }}>
                  {visibleDownloads.map((dl, i) => {
                    const isYt = dl.url.includes('youtube.com') || dl.url.includes('youtu.be');
                    const isFb = dl.url.includes('facebook.com') || dl.url.includes('fb.watch') || dl.url.includes('fb.gg');
                    const platformLabel = isYt ? 'Shorts' : (isFb ? 'Reels' : 'TikTok');
                    const platformColor = isYt ? '#ff0000' : (isFb ? '#1877f2' : 'var(--primary)');

                    return (
                      <div
                        key={i}
                        onClick={() => {
                          setSelectedHistoryItem(dl);
                          setShowOptionsModal(true);
                          setShowVideoPlayer(false);
                        }}
                        style={{
                          cursor: 'pointer',
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.05)',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          flexDirection: 'column'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-3px)';
                          e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.3)';
                          e.currentTarget.style.borderColor = 'var(--secondary)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = 'none';
                          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                        }}
                      >
                        {/* Thumbnail container */}
                        <div style={{ position: 'relative', width: '100%', paddingBottom: '133.33%', background: 'rgba(0,0,0,0.2)', overflow: 'hidden' }}>
                          <img
                            src={dl.cover || '/no-cover.png'}
                            alt={dl.caption}
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          {/* Play icon overlay on hover */}
                          <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(0,0,0,0.4)',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            transition: 'opacity 0.2s',
                            opacity: 0
                          }}
                          onMouseEnter={e => e.currentTarget.style.opacity = 1}
                          onMouseLeave={e => e.currentTarget.style.opacity = 0}
                          >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polygon points="5 3 19 12 5 21 5 3" fill="#fff" stroke="#fff"/>
                            </svg>
                          </div>
                        </div>

                        {/* Caption text */}
                        <div style={{ padding: '8px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            color: '#eee',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            lineHeight: '1.2'
                          }}>
                            {dl.caption || 'Video không tiêu đề'}
                          </span>

                          {/* Platform tag */}
                          <span style={{
                            fontSize: '0.62rem',
                            color: platformColor,
                            fontWeight: 800,
                            marginTop: '4px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                          }}>
                            {platformLabel}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Nút Xem thêm */}
                {hasMore && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
                    <button
                      type="button"
                      onClick={() => setHistoryPage(p => p + 1)}
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        color: 'var(--secondary)',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        padding: '8px 20px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(37,244,238,0.08)'; e.currentTarget.style.borderColor = 'var(--secondary)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                    >
                      Xem thêm ({recentDownloads.length - visibleDownloads.length} video còn lại)
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Hiển thị Video sau khi tải xong */}
          {downloadedVideo && (
            <div style={{ marginTop: '24px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '24px' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px', color: 'var(--secondary)' }}>
                ✓ Đã tải thành công video không logo!
              </h4>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <video 
                  src={`/api/videos/${downloadedVideo.videoFilename}`} 
                  controls 
                  width="100%" 
                  style={{ maxHeight: '400px', borderRadius: '12px', background: '#000', border: '1px solid rgba(255,255,255,0.1)' }}
                />
                
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <span>Tên tệp lưu: <code>{downloadedVideo.videoFilename}</code></span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Khung tạo bài đăng Reup (Chỉ hiển thị khi đã tải xong video) */}
        {downloadedVideo && (
          <div className="glass-card" style={{ animation: 'fadeIn 0.3s ease' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '16px', fontWeight: 700 }}>Đăng Video Lên Kênh</h3>
            
            {accounts.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '12px' }}>
                  Bạn chưa liên kết tài khoản YouTube Shorts nào để đăng clip.
                </p>
                <button 
                  onClick={() => router.push('/accounts')}
                  className="btn btn-secondary"
                  style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                >
                  Đến trang quản lý tài khoản
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreatePost}>
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Chọn tài khoản đăng bài</label>
                  <select
                    className="form-control"
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    disabled={isScheduling}
                    style={{ background: 'var(--card-bg)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
                    required
                  >
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.label} ({acc.username}) [{acc.type === 'adspower' ? 'AdsPower' : 'Mặc định'}]
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Caption / Mô tả video (Kèm Hashtag)</label>
                  <textarea
                    className="form-control"
                    style={{ height: '120px', resize: 'vertical' }}
                    placeholder="Nhập caption của bài đăng..."
                    value={reupCaption}
                    onChange={(e) => setReupCaption(e.target.value)}
                    disabled={isScheduling}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label className="form-label">Hẹn giờ đăng (để trống nếu muốn đăng ngay)</label>
                  <input
                    type="datetime-local"
                    className="form-control"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    disabled={isScheduling}
                  />
                </div>

                {scheduleSuccess && (
                  <div style={{ color: 'var(--success)', fontSize: '0.85rem', marginBottom: '16px', padding: '10px', background: 'var(--success-bg)', borderRadius: '8px', border: '1px solid rgba(46, 213, 115, 0.2)' }}>
                    ✓ Đã tạo lịch đăng thành công! Đang chuyển hướng...
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-secondary"
                  style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, var(--secondary), var(--primary))', border: 'none', color: '#fff', fontWeight: 700 }}
                  disabled={isScheduling}
                >
                  {isScheduling ? 'Đang tạo bài đăng...' : (scheduledAt ? 'Lên Lịch Hẹn Giờ Reup' : 'Đăng Ngay Lập Tức')}
                </button>
              </form>
            )}
          </div>
        )}

      </div>

      {/* Modal Tùy chọn cho Video Lịch sử */}
      {selectedHistoryItem && showOptionsModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(8px)',
          animation: 'fadeIn 0.2s ease'
        }}>
          <div className="glass-card" style={{
            width: '90%',
            maxWidth: '460px',
            padding: '24px',
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.08)',
            position: 'relative',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
            background: 'rgba(23, 23, 28, 0.95)'
          }}>
            {/* Nút đóng */}
            <button
              onClick={() => {
                setShowOptionsModal(false);
                setSelectedHistoryItem(null);
                setShowVideoPlayer(false);
              }}
              style={{
                position: 'absolute',
                top: '14px',
                right: '14px',
                background: 'rgba(255,255,255,0.08)',
                border: 'none',
                color: '#fff',
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: '0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
            >
              ✕
            </button>

            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '16px', color: 'var(--secondary)' }}>Tùy Chọn Video</h3>

            {showVideoPlayer ? (
              <div style={{ marginBottom: '20px' }}>
                <video
                  src={`/api/videos/${selectedHistoryItem.videoFilename}`}
                  controls
                  autoPlay
                  style={{ width: '100%', maxHeight: '360px', borderRadius: '12px', background: '#000', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ width: '90px', height: '120px', flexShrink: 0, borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <img
                    src={selectedHistoryItem.cover || '/no-cover.png'}
                    alt="Preview"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <p style={{ 
                    fontSize: '0.88rem', 
                    fontWeight: 600, 
                    color: '#eee', 
                    display: '-webkit-box', 
                    WebkitLineClamp: 3, 
                    WebkitBoxOrient: 'vertical', 
                    overflow: 'hidden', 
                    margin: 0,
                    lineHeight: '1.3'
                  }}>
                    {selectedHistoryItem.caption || 'Video không tiêu đề'}
                  </p>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                    Tên file: <code>{selectedHistoryItem.videoFilename}</code>
                  </span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              {!showVideoPlayer && (
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowVideoPlayer(true)}
                  style={{ padding: '10px 20px', fontSize: '0.85rem' }}
                >
                  Xem Video
                </button>
              )}
              {showVideoPlayer && (
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowVideoPlayer(false)}
                  style={{ padding: '10px 20px', fontSize: '0.85rem' }}
                >
                  Quay Lại
                </button>
              )}
              <button
                className="btn btn-primary"
                onClick={() => {
                  // Chọn lại video này để reup
                  setDownloadedVideo({
                    videoFilename: selectedHistoryItem.videoFilename,
                    caption: selectedHistoryItem.caption,
                    cover: selectedHistoryItem.cover
                  });
                  setReupCaption(selectedHistoryItem.caption || '');
                  
                  // Đóng modal
                  setShowOptionsModal(false);
                  setSelectedHistoryItem(null);
                  setShowVideoPlayer(false);
                  
                  // Cuộn xuống Form đăng bài
                  setTimeout(() => {
                    window.scrollTo({ top: 300, behavior: 'smooth' });
                  }, 100);
                }}
                style={{ padding: '10px 20px', fontSize: '0.85rem', background: 'linear-gradient(135deg, var(--secondary), var(--primary))', border: 'none', color: '#fff' }}
              >
                Đăng Lại Video Này
              </button>
            </div>
          </div>
        </div>
      )}
      
      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
