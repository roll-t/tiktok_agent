'use client';

import { useState, useEffect } from 'react';

export default function AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Trạng thái cho Form thêm tài khoản
  const [label, setLabel] = useState('');
  const [usernameVal, setUsernameVal] = useState('');
  const [categoryOption, setCategoryOption] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [videoType, setVideoType] = useState('shorts'); // 'shorts' hoặc 'video'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('11172002dZ');
  const [channelUrl, setChannelUrl] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [avatar, setAvatar] = useState(null);
  const [editAvatar, setEditAvatar] = useState(null);

  // Trạng thái chỉnh sửa tài khoản
  const [editingAccountId, setEditingAccountId] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editChannelUrl, setEditChannelUrl] = useState('');
  const [editCategoryOption, setEditCategoryOption] = useState('');
  const [editNewCategoryName, setEditNewCategoryName] = useState('');
  const [editVideoType, setEditVideoType] = useState('shorts');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Trạng thái bộ lọc
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');

  // Trạng thái danh mục hoạt động riêng
  const [categoriesList, setCategoriesList] = useState([]);
  const [newCatInput, setNewCatInput] = useState('');

  // Trạng thái sửa danh mục
  const [editingCategoryName, setEditingCategoryName] = useState(null);
  const [editCategoryNameInput, setEditCategoryNameInput] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  const getLimitTimeLeft = (reachedAt) => {
    if (!reachedAt) return null;
    const diff = new Date(reachedAt).getTime() + (24 * 60 * 60 * 1000) - Date.now();
    if (diff <= 0) return null;
    const hours = Math.ceil(diff / (1000 * 60 * 60));
    return `${hours}h`;
  };

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

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      const data = await res.json();
      if (data.success) {
        setCategoriesList(data.categories || []);
      }
    } catch (err) {
      console.error('Không thể tải danh sách danh mục:', err);
    }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!newCatInput.trim()) return;

    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: newCatInput.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setNewCatInput('');
        fetchCategories();
      } else {
        alert(data.error || 'Lỗi khi tạo danh mục.');
      }
    } catch (err) {
      alert('Đã xảy ra lỗi khi tạo danh mục.');
    }
  };

  const handleDeleteCategory = async (name) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa danh mục "${name}"? Các tài khoản thuộc danh mục này sẽ chuyển về "Chưa phân loại".`)) {
      return;
    }

    try {
      const res = await fetch(`/api/categories?name=${encodeURIComponent(name)}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok) {
        fetchCategories();
        fetchAccounts();
        if (selectedCategoryFilter === name) {
          setSelectedCategoryFilter('all');
        }
      } else {
        alert(data.error || 'Lỗi khi xóa danh mục.');
      }
    } catch (err) {
      alert('Đã xảy ra lỗi khi xóa danh mục.');
    }
  };

  const handleEditCategory = async (oldName) => {
    const newName = editCategoryNameInput.trim();
    if (!newName || newName === oldName) {
      setEditingCategoryName(null);
      return;
    }

    setIsSavingCategory(true);
    try {
      const res = await fetch('/api/categories', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ oldName, newName })
      });
      const data = await res.json();
      if (res.ok) {
        setEditingCategoryName(null);
        fetchCategories();
        fetchAccounts(); // Tải lại danh sách kênh để cập nhật bộ lọc và category của tài khoản
      } else {
        alert(data.error || 'Lỗi khi cập nhật danh mục.');
      }
    } catch (err) {
      alert('Đã xảy ra lỗi khi cập nhật danh mục.');
    } finally {
      setIsSavingCategory(false);
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
    fetchCategories();
  }, []);

  const handleAddAccount = async (e) => {
    e.preventDefault();
    if (!usernameVal.trim()) return;

    setIsLoggingIn(true);
    setLoginError('');

    const finalCategory = categoryOption === '__NEW__' ? (newCategoryName.trim() || 'Chưa phân loại') : (categoryOption || 'Chưa phân loại');

    let processedEmail = email.trim();
    if (processedEmail && !processedEmail.includes('@')) {
      processedEmail += '@gmail.com';
    }

    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          label: usernameVal.trim(),
          type: 'local',
          cookie: '',
          username: usernameVal.trim(),
          email: processedEmail,
          password: password.trim(),
          profileId: '',
          platform: 'youtube',
          videoType: videoType,
          avatar: avatar,
          category: finalCategory,
          channelUrl: channelUrl.trim()
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
              setUsernameVal('');
              setEmail('');
              setPassword('11172002dZ');
              setChannelUrl('');
              setCategoryOption('');
              setNewCategoryName('');
              setAvatar(null);
              setIsLoggingIn(false);
              fetchAccounts(); // Tải lại danh sách kênh
            } else if (statusData.status === 'failed') {
              clearInterval(pollInterval);
              setLoginError(statusData.error || 'Đăng nhập thất bại.');
              setIsLoggingIn(false);
            }
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
    setEditEmail(acc.email || '');
    setEditPassword(acc.password || '');
    setEditChannelUrl(acc.channelUrl || '');
    setEditCategoryOption(acc.category || 'Chưa phân loại');
    setEditNewCategoryName('');
    setEditVideoType(acc.videoType || 'shorts');
    setEditAvatar(acc.avatar || null);
  };

  const handleEditSubmit = async (e, id) => {
    e.preventDefault();
    if (!editUsername.trim()) return;

    setIsSavingEdit(true);
    const finalEditCategory = editCategoryOption === '__NEW__' ? (editNewCategoryName.trim() || 'Chưa phân loại') : (editCategoryOption || 'Chưa phân loại');

    let processedEditEmail = editEmail.trim();
    if (processedEditEmail && !processedEditEmail.includes('@')) {
      processedEditEmail += '@gmail.com';
    }

    try {
      const res = await fetch(`/api/accounts/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          label: editUsername.trim(),
          username: editUsername.trim(),
          email: processedEditEmail,
          password: editPassword.trim(),
          category: finalEditCategory,
          videoType: editVideoType,
          avatar: editAvatar,
          channelUrl: editChannelUrl.trim()
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

  const videoTypeLabel = (vt) => vt === 'shorts' ? 'YouTube Shorts' : 'YouTube Thường';

  const existingCategories = categoriesList.map(c => c.name);

  const filteredAccounts = accounts.filter(acc => {
    if (selectedCategoryFilter === 'all') return true;
    return (acc.category || 'Chưa phân loại') === selectedCategoryFilter;
  });

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '8px' }}>
          Quản Lý <span className="gradient-text">Kênh YouTube</span>
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Kết nối và lưu thông tin đăng nhập các tài khoản YouTube qua cơ chế tự động hóa an toàn.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '30px', alignItems: 'start' }}>

        {/* Cột bên trái: Form thêm kênh & Quản lý danh mục */}
        <div>
          {/* Form liên kết tài khoản mới */}
          <div className="glass-card">
            <h3 style={{ fontSize: '1.25rem', marginBottom: '16px', fontWeight: 700 }}>Thêm Kênh YouTube Mới</h3>

            <form onSubmit={handleAddAccount}>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                <div style={{ position: 'relative', width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)', border: '1.5px dashed rgba(255,255,255,0.15)', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', flexShrink: 0 }}>
                  {avatar ? (
                    <img src={avatar} alt="Avatar Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4, color: '#fff' }}>
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
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

              <div className="form-group" style={{ marginTop: '16px' }}>
                <label className="form-label">Tên Kênh YouTube</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ví dụ: Kênh Giải Trí Tổng Hợp..."
                  value={usernameVal}
                  onChange={(e) => setUsernameVal(e.target.value)}
                  disabled={isLoggingIn}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Tài Khoản Kênh (Email)</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="example@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={(e) => {
                      const val = e.target.value.trim();
                      if (val && !val.includes('@')) {
                        setEmail(val + '@gmail.com');
                      }
                    }}
                    disabled={isLoggingIn}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Mật Khẩu Kênh (Password)</label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="Mật khẩu Google"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoggingIn}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '16px' }}>
                <label className="form-label">Đường Dẫn Kênh YouTube (URL - Tùy chọn)</label>
                <input
                  type="url"
                  className="form-control"
                  placeholder="https://www.youtube.com/@tenkenh"
                  value={channelUrl}
                  onChange={(e) => setChannelUrl(e.target.value)}
                  disabled={isLoggingIn}
                />
              </div>

              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '6px', lineHeight: '1.3' }}>
                * Trình duyệt sẽ mở ra trang YouTube Studio để bạn đăng nhập. Bạn có thể nhập tài khoản/mật khẩu ở trên để hệ thống tự điền giúp bạn khi mở cửa sổ.
              </span>

              <div className="form-group" style={{ marginTop: '16px' }}>
                <label className="form-label">Danh mục kênh</label>
                <select
                  className="form-control"
                  value={categoryOption}
                  onChange={(e) => setCategoryOption(e.target.value)}
                  disabled={isLoggingIn}
                  style={{ background: 'var(--card-bg)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <option value="">-- Chưa phân loại --</option>
                  {existingCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  <option value="__NEW__">+ Tạo danh mục mới...</option>
                </select>

                {categoryOption === '__NEW__' && (
                  <input
                    type="text"
                    className="form-control"
                    style={{ marginTop: '10px' }}
                    placeholder="Nhập tên danh mục mới..."
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    disabled={isLoggingIn}
                    required
                  />
                )}
              </div>

              {/* Loại video mặc định */}
              <div className="form-group" style={{ marginTop: '16px' }}>
                <label className="form-label">Loại video mặc định của kênh</label>
                <div style={{ display: 'flex', gap: '10px', marginTop: '8px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <button
                    type="button"
                    onClick={() => setVideoType('shorts')}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      background: videoType === 'shorts' ? 'var(--primary)' : 'transparent',
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
                  <button
                    type="button"
                    onClick={() => setVideoType('video')}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      background: videoType === 'video' ? 'var(--primary)' : 'transparent',
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      transition: '0.2s'
                    }}
                    disabled={isLoggingIn}
                  >
                    YouTube Thường
                  </button>
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '6px', lineHeight: '1.3' }}>
                  * Có thể thay đổi từng bài đăng riêng lẻ khi tạo bài mới.
                </span>
              </div>

              {loginError && (
                <div style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '16px', padding: '10px', background: 'var(--danger-bg)', borderRadius: '8px', border: '1px solid rgba(255, 71, 87, 0.2)' }}>
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', padding: '14px', marginTop: '8px' }}
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
                    Trình duyệt đang khởi chạy...
                  </strong>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                  Vui lòng chuyển qua cửa sổ Edge/Chrome vừa xuất hiện, thực hiện đăng nhập vào tài khoản Google/YouTube của bạn. Hệ thống sẽ tự lưu phiên làm việc và đóng cửa sổ khi thành công.
                </p>
              </div>
            )}
          </div>

          {/* Quản lý Danh mục */}
          <div className="glass-card" style={{ marginTop: '20px' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '16px', fontWeight: 700 }}>Quản Lý Danh Mục</h3>

            <form onSubmit={handleCreateCategory} style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Nhập tên danh mục mới..."
                value={newCatInput}
                onChange={(e) => setNewCatInput(e.target.value)}
                style={{ flex: 1, padding: '10px 12px', fontSize: '0.85rem' }}
                required
              />
              <button
                type="submit"
                className="btn btn-primary"
                style={{ padding: '10px 16px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
              >
                Thêm
              </button>
            </form>

            {existingCategories.length === 0 ? (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
                Chưa có danh mục tự tạo nào.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
                {existingCategories.map(cat => {
                  const count = accounts.filter(a => (a.category || 'Chưa phân loại') === cat).length;
                  const isEditing = editingCategoryName === cat;

                  return (
                    <div
                      key={cat}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        borderRadius: '8px',
                        fontSize: '0.85rem'
                      }}
                    >
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: '6px', flex: 1, marginRight: '10px' }}>
                          <input
                            type="text"
                            className="form-control"
                            value={editCategoryNameInput}
                            onChange={(e) => setEditCategoryNameInput(e.target.value)}
                            style={{ flex: 1, padding: '4px 8px', fontSize: '0.8rem', height: '28px' }}
                            disabled={isSavingCategory}
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleEditCategory(cat)}
                            className="btn btn-primary"
                            style={{ padding: '2px 8px', fontSize: '0.75rem', height: '28px' }}
                            disabled={isSavingCategory}
                          >
                            Lưu
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingCategoryName(null)}
                            className="btn btn-secondary"
                            style={{ padding: '2px 8px', fontSize: '0.75rem', height: '28px' }}
                            disabled={isSavingCategory}
                          >
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: '#fff', fontWeight: 500 }}>
                          {cat}
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '6px', fontWeight: 'normal' }}>
                            ({count} kênh)
                          </span>
                        </span>
                      )}

                      {!isEditing && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCategoryName(cat);
                              setEditCategoryNameInput(cat);
                            }}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: 'var(--secondary)',
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              padding: '4px 6px',
                              borderRadius: '4px',
                            }}
                          >
                            Sửa
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(cat)}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: 'var(--danger)',
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              padding: '4px 6px',
                              borderRadius: '4px',
                            }}
                          >
                            Xóa
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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
              <p>Chưa có kênh YouTube nào được liên kết.</p>
              <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>Hãy nhập tên nhãn ở khung bên trái và bấm bắt đầu để thêm tài khoản.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Nút lọc danh mục */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px', paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <button
                  type="button"
                  onClick={() => setSelectedCategoryFilter('all')}
                  style={{
                    fontSize: '0.78rem',
                    padding: '6px 12px',
                    borderRadius: '20px',
                    border: 'none',
                    background: selectedCategoryFilter === 'all' ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                    color: '#fff',
                    cursor: 'pointer',
                    fontWeight: 600,
                    transition: '0.2s'
                  }}
                >
                  Tất cả ({accounts.length})
                </button>
                {Array.from(new Set(accounts.map(a => a.category || 'Chưa phân loại'))).map(cat => {
                  const count = accounts.filter(a => (a.category || 'Chưa phân loại') === cat).length;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategoryFilter(cat)}
                      style={{
                        fontSize: '0.78rem',
                        padding: '6px 12px',
                        borderRadius: '20px',
                        border: 'none',
                        background: selectedCategoryFilter === cat ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                        color: '#fff',
                        cursor: 'pointer',
                        fontWeight: 600,
                        transition: '0.2s'
                      }}
                    >
                      {cat} ({count})
                    </button>
                  );
                })}
              </div>

              {filteredAccounts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                  Không tìm thấy tài khoản nào thuộc danh mục này.
                </div>
              ) : (
                filteredAccounts.map((acc) => (
                  <div key={acc.id} style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', transition: '0.2s' }}>
                    {editingAccountId === acc.id ? (
                      <form onSubmit={(e) => handleEditSubmit(e, acc.id)}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--secondary)', marginBottom: '4px' }}>Chỉnh Sửa Thông Tin Kênh</h4>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                            <div style={{ position: 'relative', width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)', border: '1.5px dashed rgba(255,255,255,0.15)', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', flexShrink: 0 }}>
                              {editAvatar ? (
                                <img src={editAvatar} alt="Edit Avatar Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4, color: '#fff' }}>
                                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                  <circle cx="12" cy="7" r="4"></circle>
                                </svg>
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
                              <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Tên Kênh YouTube</label>
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

                            <div className="form-group" style={{ margin: 0 }}>
                              <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Danh mục kênh</label>
                              <select
                                className="form-control"
                                style={{ padding: '8px 12px', fontSize: '0.85rem', background: 'var(--card-bg)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
                                value={editCategoryOption}
                                onChange={(e) => setEditCategoryOption(e.target.value)}
                                disabled={isSavingEdit}
                              >
                                <option value="">-- Chưa phân loại --</option>
                                {existingCategories.map(cat => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                                <option value="__NEW__">+ Tạo danh mục mới...</option>
                              </select>

                              {editCategoryOption === '__NEW__' && (
                                <input
                                  type="text"
                                  className="form-control"
                                  style={{ padding: '8px 12px', fontSize: '0.85rem', marginTop: '8px' }}
                                  placeholder="Tên danh mục..."
                                  value={editNewCategoryName}
                                  onChange={(e) => setEditNewCategoryName(e.target.value)}
                                  disabled={isSavingEdit}
                                  required
                                />
                              )}
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
                            <div className="form-group" style={{ margin: 0 }}>
                              <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Tài Khoản Kênh (Email)</label>
                              <input
                                type="email"
                                className="form-control"
                                style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                                value={editEmail}
                                onChange={(e) => setEditEmail(e.target.value)}
                                onBlur={(e) => {
                                  const val = e.target.value.trim();
                                  if (val && !val.includes('@')) {
                                    setEditEmail(val + '@gmail.com');
                                  }
                                }}
                                disabled={isSavingEdit}
                              />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                              <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Mật Khẩu Kênh (Password)</label>
                              <input
                                type="password"
                                className="form-control"
                                style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                                value={editPassword}
                                onChange={(e) => setEditPassword(e.target.value)}
                                disabled={isSavingEdit}
                              />
                            </div>
                          </div>

                          <div className="form-group" style={{ marginTop: '12px' }}>
                            <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Đường Dẫn Kênh YouTube (URL)</label>
                            <input
                              type="url"
                              className="form-control"
                              style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                              placeholder="https://www.youtube.com/@tenkenh"
                              value={editChannelUrl}
                              onChange={(e) => setEditChannelUrl(e.target.value)}
                              disabled={isSavingEdit}
                            />
                          </div>

                          <div className="form-group" style={{ marginTop: '12px', marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '6px' }}>Loại video mặc định</label>
                            <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '3px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                              <button
                                type="button"
                                onClick={() => setEditVideoType('shorts')}
                                style={{
                                  flex: 1, padding: '6px 10px', borderRadius: '4px', border: 'none',
                                  background: editVideoType === 'shorts' ? 'var(--primary)' : 'transparent',
                                  color: '#fff', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', transition: '0.2s'
                                }}
                                disabled={isSavingEdit}
                              >
                                YouTube Shorts
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditVideoType('video')}
                                style={{
                                  flex: 1, padding: '6px 10px', borderRadius: '4px', border: 'none',
                                  background: editVideoType === 'video' ? 'var(--primary)' : 'transparent',
                                  color: '#fff', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', transition: '0.2s'
                                }}
                                disabled={isSavingEdit}
                              >
                                YouTube Thường
                              </button>
                            </div>
                          </div>

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
                        <a
                          href={acc.channelUrl || `https://www.youtube.com/results?search_query=${encodeURIComponent(acc.username || acc.label)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="channel-item-link"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '16px',
                            textDecoration: 'none',
                            color: 'inherit'
                          }}
                        >
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
                              background: 'linear-gradient(135deg, #ff4757, #ff6b81)',
                              display: 'flex',
                              justifyContent: 'center',
                              alignItems: 'center',
                              fontSize: '1.25rem',
                              fontWeight: 800,
                              color: '#fff'
                            }}>
                              {(acc.username || acc.label || 'Y').charAt(0).toUpperCase()}
                            </div>
                          )}

                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <h4 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', transition: 'color 0.2s', margin: 0 }}>{acc.username || acc.label}</h4>
                              <span style={{
                                fontSize: '0.65rem',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: 'rgba(255,255,255,0.06)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                color: 'var(--text-muted)',
                                fontWeight: 500,
                                whiteSpace: 'nowrap'
                              }}>
                                {acc.category || 'Chưa phân loại'}
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: '12px', marginTop: '4px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                              {acc.email && (
                                <>
                                  <span>email: <strong>{acc.email}</strong></span>
                                  <span>•</span>
                                </>
                              )}
                              <span>Đã thêm: {new Date(acc.createdAt).toLocaleDateString('vi-VN')}</span>
                            </div>
                          </div>
                        </a>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {getLimitTimeLeft(acc.uploadLimitReachedAt) && (
                            <span
                              style={{
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                padding: '4px 10px',
                                borderRadius: '99px',
                                background: 'rgba(255, 71, 87, 0.15)',
                                color: 'var(--danger)',
                                border: '1px solid rgba(255, 71, 87, 0.25)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              title={`Tài khoản bị giới hạn đăng tải hằng ngày. Sẽ mở lại sau ${getLimitTimeLeft(acc.uploadLimitReachedAt)}.`}
                            >
                              ⚠️ Giới hạn ({getLimitTimeLeft(acc.uploadLimitReachedAt)})
                            </span>
                          )}
                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              padding: '4px 10px',
                              borderRadius: '99px',
                              background: (acc.videoType || 'shorts') === 'shorts' ? 'rgba(255, 0, 0, 0.15)' : 'rgba(37, 244, 238, 0.1)',
                              color: (acc.videoType || 'shorts') === 'shorts' ? '#ff4444' : 'var(--secondary)',
                              border: (acc.videoType || 'shorts') === 'shorts' ? '1px solid rgba(255,0,0,0.2)' : '1px solid rgba(37,244,238,0.15)'
                            }}
                          >
                            {videoTypeLabel(acc.videoType || 'shorts')}
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
                ))
              )}
            </div>
          )}
        </div>

      </div>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .channel-item-link {
          transition: opacity 0.2s;
        }
        .channel-item-link:hover {
          opacity: 0.85;
        }
        .channel-item-link:hover h4 {
          text-decoration: underline;
          color: var(--secondary) !important;
        }
      `}</style>
    </div>
  );
}
