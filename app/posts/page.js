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
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [thumbnailPreview, setThumbnailPreview] = useState(null);
  const [videoType, setVideoType] = useState('shorts'); // 'shorts' hoặc 'video'
  const [aiThumbnailFilename, setAiThumbnailFilename] = useState(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [showAiGenInput, setShowAiGenInput] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [formError, setFormError] = useState('');
  const [activeTab, setActiveTab] = useState('queue'); // 'queue' hoặc 'history'
  const [filterAccountId, setFilterAccountId] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortByTime, setSortByTime] = useState('newest'); // 'newest' hoặc 'oldest'
  const [toasts, setToasts] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fileInputRef = useRef(null);
  const thumbnailInputRef = useRef(null);
  const postsRef = useRef([]);

  const addToast = (title, message, type = 'success') => {
    const id = Date.now() + Math.random().toString(36).substr(2, 5);
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 6000);
  };

  const showSystemNotification = (title, body) => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/favicon.ico'
      });
    }
    console.log(`[Notification] ${title}: ${body}`);
  };

  const fetchData = async () => {
    try {
      const accRes = await fetch('/api/accounts');
      const accData = await accRes.json();
      setAccounts(accData.accounts || []);

      const postRes = await fetch('/api/posts');
      const postData = await postRes.json();
      const newPosts = postData.posts || [];

      // So sánh trạng thái để thông báo hoàn tất đăng bài dùng postsRef để tránh side effect chạy 2 lần trong StrictMode
      const prevPosts = postsRef.current;
      if (prevPosts.length > 0) {
        const prevMap = new Map(prevPosts.map(p => [p.id, p.status]));

        newPosts.forEach(post => {
          const prevStatus = prevMap.get(post.id);
          if (prevStatus === 'processing' && (post.status === 'success' || post.status === 'failed')) {
            const typeLabel = post.videoType === 'video' ? 'YouTube Thường' : 'YouTube Shorts';
            const channelInfo = `${post.accountLabel} (${post.accountUsername})`;

            if (post.status === 'success') {
              addToast(
                `Đăng thành công [${typeLabel}]`,
                `Kênh ${channelInfo} đã xuất bản thành công bài đăng ${post.id}.`,
                'success'
              );
              showSystemNotification(
                `Đăng thành công [${typeLabel}]`,
                `Bài đăng ${post.id} trên kênh ${channelInfo} đã được xuất bản thành công!`
              );
            } else {
              addToast(
                `Đăng thất bại [${typeLabel}]`,
                `Lỗi: ${post.error || 'Lỗi không xác định.'} (${post.id})`,
                'danger'
              );
              showSystemNotification(
                `Lỗi đăng bài [${typeLabel}]`,
                `Bài đăng ${post.id} trên kênh ${channelInfo} thất bại: ${post.error || 'Lỗi không xác định.'}`
              );
            }
          }
        });
      }

      setPosts(newPosts);
      postsRef.current = newPosts;

      setLoading(false);
    } catch (error) {
      console.error('Lỗi tải danh sách bài đăng:', error);
    }
  };

  useEffect(() => {
    fetchData();
    // Yêu cầu quyền thông báo hệ thống nếu chưa cho phép
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
    // Tự động reload mỗi 5 giây để xem tiến trình đăng bài ngầm
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, filterAccountId, filterStatus]);

  // Khi chọn tài khoản -> lấy videoType mặc định của kênh đó
  useEffect(() => {
    if (selectedAccountId) {
      const acc = accounts.find(a => a.id === selectedAccountId);
      if (acc && acc.videoType) {
        setVideoType(acc.videoType);
      }
    }
  }, [selectedAccountId, accounts]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.isAppBusy = isSubmitting;
    }
    const handleBeforeUnload = (e) => {
      if (isSubmitting) {
        e.preventDefault();
        e.returnValue = 'Hệ thống đang tải video lên máy chủ. Bạn có chắc chắn muốn rời đi?';
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
  }, [isSubmitting]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setVideoFile(e.target.files[0]);
    }
  };

  const handleThumbnailChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setThumbnailFile(file);
      setAiThumbnailFilename(null); // Xóa ảnh AI nếu chọn ảnh thủ công
      // Tạo preview
      const reader = new FileReader();
      reader.onload = (ev) => setThumbnailPreview(ev.target.result);
      reader.readAsDataURL(file);
    }
  };

  const removeThumbnail = () => {
    setThumbnailFile(null);
    setThumbnailPreview(null);
    setAiThumbnailFilename(null); // Xóa ảnh AI
    if (thumbnailInputRef.current) thumbnailInputRef.current.value = '';
  };

  const handleGenerateAiImage = async () => {
    if (!aiPrompt.trim()) return;
    setIsGeneratingImage(true);
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt.trim() })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAiThumbnailFilename(data.filename);
        setThumbnailPreview(data.url);
        setThumbnailFile(null); // Xóa ảnh upload thủ công
      } else {
        alert(data.error || 'Lỗi khi tạo ảnh AI.');
      }
    } catch (err) {
      alert('Không thể kết nối máy chủ tạo ảnh.');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!selectedAccountId) {
      setFormError('Vui lòng chọn tài khoản để đăng bài.');
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
    formData.append('videoType', videoType);
    if (thumbnailFile) {
      formData.append('thumbnail', thumbnailFile);
    }
    if (aiThumbnailFilename) {
      formData.append('thumbnailFilename', aiThumbnailFilename);
    }
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
      setThumbnailFile(null);
      setThumbnailPreview(null);
      setAiThumbnailFilename(null);
      setAiPrompt('');
      setShowAiGenInput(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (thumbnailInputRef.current) thumbnailInputRef.current.value = '';

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

  const handleDeletePost = async (postId) => {
    if (!confirm('Bạn có chắc chắn muốn xóa bài viết này? Tệp video đi kèm cũng sẽ bị xóa nếu không dùng ở bài viết khác.')) {
      return;
    }

    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchData();
      } else {
        const data = await res.json();
        alert(data.error || 'Không thể xóa bài viết.');
      }
    } catch (error) {
      alert('Lỗi kết nối khi xóa bài viết.');
    }
  };

  const tabPosts = posts.filter(post =>
    activeTab === 'queue'
      ? (post.status === 'pending' || post.status === 'processing')
      : (post.status === 'success' || post.status === 'failed')
  );

  const filteredPosts = tabPosts
    .filter(post => {
      const matchesAccount = filterAccountId === 'all' || post.accountId === filterAccountId;
      const matchesStatus = filterStatus === 'all' || post.status === filterStatus;
      return matchesAccount && matchesStatus;
    })
    .sort((a, b) => {
      const timeA = new Date(a.postedAt || a.scheduledAt || a.createdAt);
      const timeB = new Date(b.postedAt || b.scheduledAt || b.createdAt);
      return sortByTime === 'newest' ? timeB - timeA : timeA - timeB;
    });

  const totalItems = filteredPosts.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedPosts = filteredPosts.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '8px' }}>
          Đăng Clip & <span className="gradient-text">Hẹn Giờ Lên Lịch</span>
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Thiết lập nội dung, chọn kênh đăng và hẹn giờ đăng tải video tự động lên YouTube.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '30px', alignItems: 'start' }}>

        {/* Form Đăng Bài / Lên Lịch */}
        <div className="glass-card" style={{ position: 'sticky', top: '40px' }}>
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
                <option value="">-- Chọn kênh đăng bài --</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    [{acc.category || 'Chưa phân loại'}] {acc.label} ({acc.username})
                  </option>
                ))}
              </select>
            </div>

            {/* Loại video */}
            <div className="form-group">
              <label className="form-label">Loại video</label>
              <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <button
                  type="button"
                  onClick={() => setVideoType('shorts')}
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: '6px', border: 'none',
                    background: videoType === 'shorts' ? 'var(--primary)' : 'transparent',
                    color: '#fff', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', transition: '0.2s'
                  }}
                  disabled={isSubmitting}
                >
                  YouTube Shorts
                </button>
                <button
                  type="button"
                  onClick={() => setVideoType('video')}
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: '6px', border: 'none',
                    background: videoType === 'video' ? 'var(--primary)' : 'transparent',
                    color: '#fff', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', transition: '0.2s'
                  }}
                  disabled={isSubmitting}
                >
                  YouTube Thường
                </button>
              </div>
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

            {/* Thumbnail (ảnh thu nhỏ) */}
            <div className="form-group">
              <label className="form-label">
                Ảnh Thu Nhỏ / Thumbnail
                {videoType === 'shorts' && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '6px', fontWeight: 400 }}>
                    (Không bắt buộc với Shorts)
                  </span>
                )}
              </label>

              {thumbnailPreview ? (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img
                    src={thumbnailPreview}
                    alt="Thumbnail Preview"
                    style={{
                      width: '100%',
                      maxHeight: '120px',
                      objectFit: 'cover',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      display: 'block'
                    }}
                  />
                  <button
                    type="button"
                    onClick={removeThumbnail}
                    style={{
                      position: 'absolute', top: '6px', right: '6px',
                      background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%',
                      width: '24px', height: '24px', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: '14px'
                    }}
                    disabled={isSubmitting}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => !isSubmitting && thumbnailInputRef.current?.click()}
                  style={{
                    border: '2px dashed rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    background: 'rgba(255,255,255,0.02)',
                    transition: '0.2s'
                  }}
                >
                  {/* Camera icon */}
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.45 }}>
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                    <circle cx="12" cy="13" r="4"></circle>
                  </svg>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Nhấn để chọn ảnh thumbnail
                  </span>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                ref={thumbnailInputRef}
                onChange={handleThumbnailChange}
                disabled={isSubmitting}
              />

              {/* AI Image Generator Section */}
              <div style={{ marginTop: '12px' }}>
                {!showAiGenInput ? (
                  <button
                    type="button"
                    onClick={() => setShowAiGenInput(true)}
                    style={{
                      background: 'linear-gradient(135deg, #7000FF 0%, #F355DA 100%)',
                      border: 'none',
                      borderRadius: '6px',
                      color: '#fff',
                      padding: '6px 12px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 4px 10px rgba(112,0,255,0.3)',
                      transition: '0.2s'
                    }}
                    disabled={isSubmitting}
                  >
                    ✨ Tạo Ảnh Thu Nhỏ Bằng AI
                  </button>
                ) : (
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                      Mô tả hình ảnh (English hoặc Tiếng Việt):
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Ví dụ: A delicious bowl of beef noodles, anime style, 4k..."
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      style={{ padding: '8px 12px', fontSize: '0.82rem', marginBottom: '8px', background: 'var(--card-bg)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
                      disabled={isGeneratingImage}
                    />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={handleGenerateAiImage}
                        className="btn btn-primary"
                        style={{ padding: '6px 14px', fontSize: '0.8rem', background: 'var(--secondary)' }}
                        disabled={isGeneratingImage || !aiPrompt.trim()}
                      >
                        {isGeneratingImage ? 'Đang tạo ảnh...' : 'Bắt đầu Tạo'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowAiGenInput(false)}
                        className="btn btn-secondary"
                        style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                        disabled={isGeneratingImage}
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                )}
              </div>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '20px' }}>
            <div style={{ display: 'flex' }}>
              <button
                onClick={() => {
                  setActiveTab('queue');
                  setFilterStatus('all');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: activeTab === 'queue' ? 'var(--secondary)' : 'var(--text-muted)',
                  padding: '10px 20px',
                  fontSize: '1rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  borderBottom: activeTab === 'queue' ? '2.5px solid var(--secondary)' : 'none',
                  transition: '0.2s',
                  outline: 'none'
                }}
              >
                Hàng Đợi / Hẹn Giờ ({posts.filter(p => p.status === 'pending' || p.status === 'processing').length})
              </button>
              <button
                onClick={() => {
                  setActiveTab('history');
                  setFilterStatus('all');
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: activeTab === 'history' ? 'var(--secondary)' : 'var(--text-muted)',
                  padding: '10px 20px',
                  fontSize: '1rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  borderBottom: activeTab === 'history' ? '2.5px solid var(--secondary)' : 'none',
                  transition: '0.2s',
                  outline: 'none'
                }}
              >
                Lịch Sử Đăng ({posts.filter(p => p.status === 'success' || p.status === 'failed').length})
              </button>
            </div>

            {/* Điều khiển phân trang hàng đầu (Góc trên cùng bên phải) */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '8px' }}>
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

          {/* Bộ lọc bài viết */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', marginBottom: '20px', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Kênh đăng:</span>
              <select
                value={filterAccountId}
                onChange={(e) => setFilterAccountId(e.target.value)}
                style={{ background: 'var(--card-bg)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '6px', fontSize: '0.85rem', outline: 'none' }}
              >
                <option value="all">Tất cả kênh</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    [{acc.category || 'Chưa phân loại'}] {acc.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Trạng thái:</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{ background: 'var(--card-bg)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '6px', fontSize: '0.85rem', outline: 'none' }}
              >
                <option value="all">Tất cả</option>
                {activeTab === 'queue' ? (
                  <>
                    <option value="pending">Đang hẹn giờ</option>
                    <option value="processing">Đang đăng tải</option>
                  </>
                ) : (
                  <>
                    <option value="success">Thành công</option>
                    <option value="failed">Lỗi (Thất bại)</option>
                  </>
                )}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Sắp xếp:</span>
              <select
                value={sortByTime}
                onChange={(e) => setSortByTime(e.target.value)}
                style={{ background: 'var(--card-bg)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 12px', borderRadius: '6px', fontSize: '0.85rem', outline: 'none' }}
              >
                <option value="newest">Mới nhất</option>
                <option value="oldest">Cũ nhất</option>
              </select>
            </div>

            {(filterAccountId !== 'all' || filterStatus !== 'all' || sortByTime !== 'newest') && (
              <button
                onClick={() => {
                  setFilterAccountId('all');
                  setFilterStatus('all');
                  setSortByTime('newest');
                }}
                style={{ background: 'none', border: 'none', color: 'var(--secondary)', fontSize: '0.85rem', cursor: 'pointer', marginLeft: 'auto', padding: '4px 8px', textDecoration: 'underline' }}
              >
                Xóa bộ lọc
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Đang tải danh sách...</div>
          ) : tabPosts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '12px', opacity: 0.5 }}>
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              <p>Chưa có bài đăng nào trong mục này.</p>
            </div>
          ) : filteredPosts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '12px', opacity: 0.5 }}>
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <p>Không tìm thấy bài viết nào khớp với bộ lọc hiện tại.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {paginatedPosts.map((post) => (
                <div key={post.id} style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

                  {/* Top Bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>{post.id}</span>
                      <span>•</span>
                      <strong style={{ fontSize: '0.9rem', color: '#fff' }}>{post.accountLabel}</strong>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>({post.accountUsername})</span>
                      {/* Badge loại video */}
                      <span style={{
                        fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '99px',
                        background: (post.videoType || 'shorts') === 'shorts' ? 'rgba(255,0,0,0.15)' : 'rgba(37,244,238,0.1)',
                        color: (post.videoType || 'shorts') === 'shorts' ? '#ff4444' : 'var(--secondary)',
                        border: (post.videoType || 'shorts') === 'shorts' ? '1px solid rgba(255,0,0,0.2)' : '1px solid rgba(37,244,238,0.15)'
                      }}>
                        {(post.videoType || 'shorts') === 'shorts' ? 'Shorts' : 'Video'}
                      </span>
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
                    {/* Thumbnail preview nếu có */}
                    {post.thumbnailFilename && (
                      <img
                        src={`/api/thumbnail/${post.thumbnailFilename}`}
                        alt="thumbnail"
                        style={{ width: '72px', height: '48px', objectFit: 'cover', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    )}
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
                      {/* Nút xem video sau khi đăng thành công */}
                      {post.status === 'success' && post.videoUrl && (
                        <a
                          href={post.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            padding: '6px 12px',
                            fontSize: '0.75rem',
                            borderRadius: '6px',
                            background: 'rgba(255, 0, 0, 0.15)',
                            color: '#ff4444',
                            border: '1px solid rgba(255,0,0,0.25)',
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontWeight: 600,
                            transition: '0.2s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,0,0,0.25)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,0,0,0.15)'}
                        >
                          {/* YouTube icon */}
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                          </svg>
                          Xem video
                        </a>
                      )}
                      {/* Fallback: Không có URL trực tiếp → tìm kiếm trên YouTube Studio */}
                      {post.status === 'success' && !post.videoUrl && (
                        <a
                          href="https://studio.youtube.com/channel/UC/videos"
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            padding: '6px 12px',
                            fontSize: '0.75rem',
                            borderRadius: '6px',
                            background: 'rgba(255,255,255,0.06)',
                            color: 'var(--text-muted)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            transition: '0.2s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                            <polyline points="15 3 21 3 21 9"/>
                            <line x1="10" y1="14" x2="21" y2="3"/>
                          </svg>
                          YouTube Studio
                        </a>
                      )}
                      {(post.status === 'pending' || post.status === 'failed') && (
                        <button
                          onClick={() => handleRunNow(post.id)}
                          className="btn btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '6px' }}
                        >
                          {post.status === 'failed' ? 'Đăng lại' : 'Đăng Ngay'}
                        </button>
                      )}
                      {post.status !== 'processing' && (
                        <button
                          onClick={() => handleDeletePost(post.id)}
                          className="btn btn-danger"
                          style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '6px', background: 'rgba(255, 71, 87, 0.15)', color: 'var(--danger)', border: '1px solid rgba(255, 71, 87, 0.2)' }}
                        >
                          Xóa
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
                      Trình duyệt Playwright đang đăng nhập và tải video lên. Vui lòng không tắt Server.
                    </div>
                  )}

                </div>
              ))}
            </div>
          )}

          {/* Điều khiển phân trang */}
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

      </div>

      {/* Container hiển thị thông báo Toast góc dưới phải */}
      <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '350px' }}>
        {toasts.map(toast => (
          <div
            key={toast.id}
            style={{
              padding: '14px 18px',
              background: toast.type === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)',
              border: toast.type === 'success' ? '1px solid rgba(46, 213, 115, 0.3)' : '1px solid rgba(255, 71, 87, 0.3)',
              borderRadius: '10px',
              color: '#fff',
              boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              animation: 'slideIn 0.3s ease-out',
              position: 'relative'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '0.9rem', color: toast.type === 'success' ? 'var(--success)' : 'var(--danger)' }}>{toast.title}</strong>
              <button
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '1.25rem', padding: '0 4px', lineHeight: 1 }}
              >
                ×
              </button>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.9)', margin: 0, lineHeight: 1.4 }}>{toast.message}</p>
          </div>
        ))}
      </div>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
