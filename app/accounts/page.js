'use client';

import { useState, useEffect } from 'react';

export default function AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Trạng thái cho Form thêm tài khoản
  const [label, setLabel] = useState('');
  const [cookie, setCookie] = useState('');
  const [usernameVal, setUsernameVal] = useState('');
  const [loginType, setLoginType] = useState('local'); // 'local' hoặc 'adspower'
  const [profileId, setProfileId] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [platform, setPlatform] = useState('tiktok'); // 'tiktok' hoặc 'youtube'

  const [avatar, setAvatar] = useState(null);
  const [editAvatar, setEditAvatar] = useState(null);

  // Trạng thái chỉnh sửa tài khoản
  const [editingAccountId, setEditingAccountId] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editProfileId, setEditProfileId] = useState('');
  const [editCookie, setEditCookie] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

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

  const handleAvatarChange = (e, isEdit = false) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, 128, 128);
        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        if (isEdit) {
          setEditAvatar(base64);
        } else {
          setAvatar(base64);
        }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
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
        body: JSON.stringify({ 
          label: label.trim(), 
          type: loginType,
          cookie: loginType === 'local' ? cookie.trim() : '',
          username: usernameVal.trim(),
          profileId: loginType === 'adspower' ? profileId.trim() : '',
          platform: platform,
          avatar: avatar
        })
      });

      const data = await res.json();

      if (res.ok && data.success && data.accountId) {
        const accountId = data.accountId;

        // Polling để kiểm tra tiến trình đăng nhập chạy ngầm mỗi 2 giây
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await fetch(`/api/accounts?id=${accountId}`);
            if (!statusRes.ok) {
              clearInterval(pollInterval);
              setLoginError('Không tìm thấy phiên đăng nhập.');
              setIsLoggingIn(false);
              return;
            }

            const statusData = await statusRes.json();
            if (statusData.status === 'success') {
              clearInterval(pollInterval);
              setLabel('');
              setCookie('');
              setUsernameVal('');
              setProfileId('');
              setAvatar(null);
              setIsLoggingIn(false);
              fetchAccounts(); // Tải lại danh sách kênh
            } else if (statusData.status === 'failed') {
              clearInterval(pollInterval);
              setLoginError(statusData.error || 'Đăng nhập thất bại.');
              setIsLoggingIn(false);
            }
            // Nếu status là 'running', tiếp tục chờ đợi
          } catch (err) {
            clearInterval(pollInterval);
            setLoginError('Lỗi kết nối khi kiểm tra trạng thái.');
            setIsLoggingIn(false);
          }
        }, 2000);
      } else {
        setLoginError(data.error || 'Không thể mở trình duyệt đăng nhập.');
        setIsLoggingIn(false);
      }
    } catch (error) {
      setLoginError('Có lỗi xảy ra trong quá trình mở trình duyệt đăng nhập.');
      setIsLoggingIn(false);
    }
  };

  const handleStartEdit = (acc) => {
    setEditingAccountId(acc.id);
    setEditLabel(acc.label);
    setEditUsername(acc.username);
    setEditProfileId(acc.profileId || '');
    setEditCookie('');
    setEditAvatar(acc.avatar || null);
  };

  const handleEditSubmit = async (e, id) => {
    e.preventDefault();
    if (!editLabel.trim() || !editUsername.trim()) return;

    setIsSavingEdit(true);
    try {
      const res = await fetch(`/api/accounts/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          label: editLabel.trim(),
          username: editUsername.trim(),
          profileId: editProfileId.trim(),
          cookie: editCookie.trim(),
          avatar: editAvatar
        })
      });

      if (res.ok) {
        setEditingAccountId(null);
        fetchAccounts();
      } else {
        const data = await res.json();
        alert(data.error || 'Không thể cập nhật thông tin tài khoản.');
      }
    } catch (err) {
      alert('Đã xảy ra lỗi khi lưu thông tin chỉnh sửa.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteAccount = async (id) => {
    if (!confirm('Bạn có chắc chắn muốn xóa kênh này? Tất cả phiên đăng nhập sẽ bị hủy.')) {
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
          Quản Lý <span className="gradient-text">Kênh Đăng Bài</span>
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Kết nối và lưu thông tin đăng nhập đa tài khoản TikTok & YouTube Shorts qua cơ chế tự động hóa an toàn.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '30px', alignItems: 'start' }}>

        {/* Form liên kết tài khoản mới */}
        <div className="glass-card">
          <h3 style={{ fontSize: '1.25rem', marginBottom: '16px', fontWeight: 700 }}>Thêm Kênh Mới</h3>

          {/* Chọn nền tảng */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <button
              type="button"
              onClick={() => {
                setPlatform('tiktok');
                if (usernameVal === 'youtube_channel') setUsernameVal('');
              }}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '6px',
                border: 'none',
                background: platform === 'tiktok' ? 'linear-gradient(135deg, var(--primary), var(--accent))' : 'transparent',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: '0.2s'
              }}
              disabled={isLoggingIn}
            >
              TikTok
            </button>
            <button
              type="button"
              onClick={() => {
                setPlatform('youtube');
                if (!usernameVal) setUsernameVal('youtube_channel');
              }}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '6px',
                border: 'none',
                background: platform === 'youtube' ? 'linear-gradient(135deg, #ff4757, #ff6b81)' : 'transparent',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: '0.2s'
              }}
              disabled={isLoggingIn}
            >
              YouTube Shorts
            </button>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <button
              type="button"
              onClick={() => setLoginType('local')}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '6px',
                border: 'none',
                background: loginType === 'local' ? 'var(--primary)' : 'transparent',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: '0.2s'
              }}
              disabled={isLoggingIn}
            >
              Trình Duyệt Thường {platform === 'tiktok' && '/ Cookie'}
            </button>
            <button
              type="button"
              onClick={() => setLoginType('adspower')}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '6px',
                border: 'none',
                background: loginType === 'adspower' ? 'var(--primary)' : 'transparent',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: '0.2s'
              }}
              disabled={isLoggingIn}
            >
              Qua AdsPower
            </button>
          </div>

          <form onSubmit={handleAddAccount}>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <div style={{ position: 'relative', width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(255,255,255,0.02)', border: '1.5px dashed rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', flexShrink: 0 }}>
                {avatar ? (
                  <img src={avatar} alt="Avatar Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                    <circle cx="12" cy="13" r="4"></circle>
                  </svg>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label" style={{ marginBottom: '6px' }}>Ảnh đại diện kênh (Tùy chọn)</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => document.getElementById('avatar-input').click()}
                    className="btn btn-secondary"
                    style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                  >
                    Chọn ảnh
                  </button>
                  {avatar && (
                    <button
                      type="button"
                      onClick={() => setAvatar(null)}
                      className="btn btn-danger"
                      style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '6px', background: 'rgba(255,71,87,0.1)', border: '1px solid rgba(255,71,87,0.2)', color: 'var(--danger)' }}
                    >
                      Xóa
                    </button>
                  )}
                </div>
                <input
                  id="avatar-input"
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => handleAvatarChange(e, false)}
                />
              </div>
            </div>

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

            {loginType === 'local' ? (
              <>
                {platform === 'tiktok' && (
                  <div className="form-group" style={{ marginTop: '16px' }}>
                    <label className="form-label">Mã Cookie sessionid_ss (Tùy chọn - Để liên kết trực tiếp)</label>
                    <textarea
                      className="form-control"
                      style={{ height: '70px', fontFamily: 'monospace', fontSize: '0.8rem', resize: 'vertical', background: 'rgba(255,255,255,0.03)', color: '#fff' }}
                      placeholder="Dán giá trị cookie sessionid_ss vào đây..."
                      value={cookie}
                      onChange={(e) => setCookie(e.target.value)}
                      disabled={isLoggingIn}
                    />
                  </div>
                )}

                <div className="form-group" style={{ marginTop: '16px' }}>
                  <label className="form-label">
                    {platform === 'tiktok' ? 'TikTok Username / ID kênh (Bắt buộc nếu dùng Cookie)' : 'Tên Kênh YouTube'}
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder={platform === 'tiktok' ? "Ví dụ: @trungtruong hoặc trungtruong..." : "Ví dụ: Kênh Shorts Giải Trí..."}
                    value={usernameVal}
                    onChange={(e) => setUsernameVal(e.target.value)}
                    disabled={isLoggingIn}
                    required={platform === 'tiktok' ? cookie.trim() !== '' : true}
                  />
                  {platform === 'tiktok' ? (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '6px', lineHeight: '1.3' }}>
                      * Mẹo: Đăng nhập TikTok trên trình duyệt máy bạn -&gt; Nhấn <strong>F12</strong> -&gt; chọn <strong>Application</strong> -&gt; <strong>Cookies</strong> -&gt; tìm <strong>sessionid_ss</strong> -&gt; Copy cột <strong>Value</strong> và dán vào đây để liên kết ngay lập tức (không cần bật trình duyệt).
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '6px', lineHeight: '1.3' }}>
                      * Trình duyệt sẽ mở ra trang YouTube Studio để bạn đăng nhập tài khoản Google của mình bằng tay. Sau khi đăng nhập thành công, hệ thống sẽ tự động đồng bộ và lưu phiên.
                    </span>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="form-group" style={{ marginTop: '16px' }}>
                  <label className="form-label">
                    {platform === 'tiktok' ? 'TikTok Username / ID kênh (@username)' : 'Tên Kênh YouTube'}
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder={platform === 'tiktok' ? "Ví dụ: @trungtruong hoặc trungtruong..." : "Ví dụ: Kênh Shorts Giải Trí..."}
                    value={usernameVal}
                    onChange={(e) => setUsernameVal(e.target.value)}
                    disabled={isLoggingIn}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginTop: '16px' }}>
                  <label className="form-label">AdsPower Profile ID (User ID)</label>
                  <input
                    type="text"
                    className="form-control"
                    style={{ fontFamily: 'monospace' }}
                    placeholder="Ví dụ: j1e2f3g4 hoặc hh12345..."
                    value={profileId}
                    onChange={(e) => setProfileId(e.target.value)}
                    disabled={isLoggingIn}
                    required
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '6px', lineHeight: '1.3' }}>
                    * Hướng dẫn: Mở phần mềm AdsPower -&gt; Copy mã hiển thị tại cột <strong>ID</strong> của profile chứa tài khoản tương ứng dán vào đây.
                  </span>
                </div>
              </>
            )}

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
                <strong style={{ fontSize: '0.9rem', color: 'var(--secondary)' }}>
                  {loginType === 'adspower' ? 'Đang liên kết AdsPower...' : (cookie.trim() ? 'Đang liên kết tài khoản...' : 'Trình duyệt đang khởi chạy...')}
                </strong>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                {loginType === 'adspower'
                  ? 'Hệ thống đang tiến hành liên kết trực tiếp kênh qua mã AdsPower Profile ID của bạn. Việc này diễn ra tức thì...'
                  : (cookie.trim()
                      ? 'Hệ thống đang tiến hành liên kết trực tiếp kênh qua Cookie của bạn. Việc này diễn ra tức thì...'
                      : (platform === 'youtube'
                          ? 'Vui lòng chuyển qua cửa sổ Edge/Chrome vừa xuất hiện, thực hiện đăng nhập vào tài khoản Google/YouTube của bạn. Hệ thống sẽ tự lưu phiên làm việc và đóng cửa sổ khi thành công.'
                          : 'Vui lòng chuyển qua cửa sổ Edge/Chrome vừa xuất hiện, thực hiện đăng nhập vào kênh TikTok của bạn. Hệ thống sẽ tự lưu phiên làm việc và đóng cửa sổ khi thành công.'))}
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
              <p>Chưa có kênh TikTok hoặc YouTube Shorts nào được liên kết.</p>
              <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>Hãy nhập tên nhãn ở khung bên trái và bấm bắt đầu để thêm tài khoản.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {accounts.map((acc) => (
                <div key={acc.id} style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', transition: '0.2s' }}>
                  {editingAccountId === acc.id ? (
                    <form onSubmit={(e) => handleEditSubmit(e, acc.id)}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--secondary)', marginBottom: '4px' }}>Chỉnh Sửa Thông Tin Kênh</h4>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                          <div style={{ position: 'relative', width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', flexShrink: 0 }}>
                            {editAvatar ? (
                              <img src={editAvatar} alt="Edit Avatar Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Không có</span>
                            )}
                          </div>
                          <div style={{ flex: 1 }}>
                            <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Thay đổi ảnh đại diện (Tùy chọn)</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                type="button"
                                onClick={() => document.getElementById(`avatar-edit-input-${acc.id}`).click()}
                                className="btn btn-secondary"
                                style={{ padding: '4px 10px', fontSize: '0.72rem', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                              >
                                Chọn ảnh
                              </button>
                              {editAvatar && (
                                <button
                                  type="button"
                                  onClick={() => setEditAvatar(null)}
                                  className="btn btn-danger"
                                  style={{ padding: '4px 10px', fontSize: '0.72rem', borderRadius: '4px', background: 'rgba(255,71,87,0.1)', border: '1px solid rgba(255,71,87,0.2)', color: 'var(--danger)' }}
                                >
                                  Xóa
                                </button>
                              )}
                            </div>
                            <input
                              id={`avatar-edit-input-${acc.id}`}
                              type="file"
                              accept="image/*"
                              style={{ display: 'none' }}
                              onChange={(e) => handleAvatarChange(e, true)}
                            />
                          </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Tên Nhãn Kênh</label>
                            <input
                              type="text"
                              className="form-control"
                              style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                              value={editLabel}
                              onChange={(e) => setEditLabel(e.target.value)}
                              required
                              disabled={isSavingEdit}
                            />
                          </div>
                          
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>TikTok Username</label>
                            <input
                              type="text"
                              className="form-control"
                              style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                              value={editUsername}
                              onChange={(e) => setEditUsername(e.target.value)}
                              required
                              disabled={isSavingEdit}
                            />
                          </div>
                        </div>

                        {acc.type === 'adspower' ? (
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>AdsPower Profile ID</label>
                            <input
                              type="text"
                              className="form-control"
                              style={{ padding: '8px 12px', fontSize: '0.85rem', fontFamily: 'monospace' }}
                              value={editProfileId}
                              onChange={(e) => setEditProfileId(e.target.value)}
                              required
                              disabled={isSavingEdit}
                            />
                          </div>
                        ) : (
                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Cập nhật Cookie sessionid_ss (Bỏ trống nếu giữ nguyên)</label>
                            <input
                              type="text"
                              className="form-control"
                              style={{ padding: '8px 12px', fontSize: '0.85rem', fontFamily: 'monospace' }}
                              placeholder="Nhập cookie mới nếu muốn cập nhật..."
                              value={editCookie}
                              onChange={(e) => setEditCookie(e.target.value)}
                              disabled={isSavingEdit}
                            />
                          </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '6px 16px', fontSize: '0.8rem' }}
                            onClick={() => setEditingAccountId(null)}
                            disabled={isSavingEdit}
                          >
                            Hủy
                          </button>
                          <button
                            type="submit"
                            className="btn btn-primary"
                            style={{ padding: '6px 16px', fontSize: '0.8rem' }}
                            disabled={isSavingEdit}
                          >
                            {isSavingEdit ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                          </button>
                        </div>
                      </div>
                    </form>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        {acc.avatar ? (
                          <img 
                            src={acc.avatar} 
                            alt={acc.label} 
                            style={{ 
                              width: '48px', 
                              height: '48px', 
                              borderRadius: '50%', 
                              objectFit: 'cover',
                              border: '2px solid rgba(255,255,255,0.08)'
                            }} 
                          />
                        ) : (
                          <div style={{ 
                            width: '48px', 
                            height: '48px', 
                            borderRadius: '50%', 
                            background: acc.platform === 'youtube' 
                              ? 'linear-gradient(135deg, #ff4757, #ff6b81)' 
                              : 'linear-gradient(135deg, var(--primary), var(--accent))', 
                            display: 'flex', 
                            justifyContent: 'center', 
                            alignItems: 'center', 
                            fontSize: '1.25rem', 
                            fontWeight: 800, 
                            color: '#fff' 
                          }}>
                            {acc.label.charAt(0).toUpperCase()}
                          </div>
                        )}

                        <div>
                          <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>{acc.label}</h4>
                          <div style={{ display: 'flex', gap: '12px', marginTop: '4px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            <span>tên: <strong>{acc.platform === 'youtube' ? '' : '@'}{acc.username}</strong></span>
                            <span>•</span>
                            {acc.type === 'adspower' ? (
                              <span style={{ color: 'var(--secondary)' }}>AdsPower ID: <strong>{acc.profileId}</strong></span>
                            ) : (
                              <span>Đã thêm: {new Date(acc.createdAt).toLocaleDateString('vi-VN')}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className="badge" style={{ 
                          background: acc.platform === 'youtube' ? 'rgba(255, 71, 87, 0.15)' : 'rgba(255, 255, 255, 0.05)', 
                          color: acc.platform === 'youtube' ? '#ff4757' : '#fff',
                          border: acc.platform === 'youtube' ? '1px solid rgba(255, 71, 87, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)'
                        }}>
                          {acc.platform === 'youtube' ? 'YouTube' : 'TikTok'}
                        </span>
                        <span className={`badge ${acc.type === 'adspower' ? 'badge-primary' : 'badge-success'}`} style={{ background: acc.type === 'adspower' ? 'rgba(37, 244, 238, 0.15)' : 'var(--success-bg)', color: acc.type === 'adspower' ? 'var(--secondary)' : 'var(--success)' }}>
                          {acc.type === 'adspower' ? 'AdsPower' : 'Mặc định'}
                        </span>
                        <button
                          onClick={() => handleStartEdit(acc)}
                          className="btn btn-secondary"
                          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                        >
                          Sửa
                        </button>
                        <button
                          onClick={() => handleDeleteAccount(acc.id)}
                          className="btn btn-danger"
                          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                        >
                          Xóa
                        </button>
                      </div>
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
