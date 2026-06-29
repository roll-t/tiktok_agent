'use client';

import { useState, useEffect } from 'react';

export default function ImageGenPage() {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('16:9'); // '16:9', '9:16', '1:1'
  const [style, setStyle] = useState('default');
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [generatedImage, setGeneratedImage] = useState(null);
  const [historyImages, setHistoryImages] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Load history generated images
  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/generate-image/history');
      const data = await res.json();
      if (res.ok && data.success) {
        setHistoryImages(data.images || []);
      }
    } catch (err) {
      console.error('Không thể tải lịch sử ảnh AI:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleGenerateImage = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setGeneratedImage(null);

    // Xử lý prompt đính kèm style
    let finalPrompt = prompt.trim();
    if (style === 'photo') {
      finalPrompt += ', photo, realistic, highly detailed, 4k resolution';
    } else if (style === 'anime') {
      finalPrompt += ', anime style, colorful, detailed, digital art illustration';
    } else if (style === '3d') {
      finalPrompt += ', 3d digital art, octane render style, detailed 3d model';
    } else if (style === 'cyberpunk') {
      finalPrompt += ', cyberpunk neon style, futuristic city, highly detailed, glow';
    } else if (style === 'cartoon') {
      finalPrompt += ', cartoon vector style, illustration, clean paths, vibrant';
    }

    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: finalPrompt })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setGeneratedImage({
          url: data.url,
          filename: data.filename,
          prompt: prompt.trim(),
          style,
          aspectRatio
        });
        // Tải lại lịch sử
        fetchHistory();
      } else {
        alert(data.error || 'Lỗi xảy ra trong quá trình sinh ảnh.');
      }
    } catch (err) {
      alert('Không thể kết nối máy chủ tạo ảnh.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Định dạng kích thước file
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div>
      {/* Tiêu đề trang */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '8px' }}>
          Tạo Ảnh <span className="gradient-text">Bằng Trí Tuệ Nhân Tạo (AI)</span>
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Sinh ảnh tự động chất lượng cao phù hợp cho ảnh thu nhỏ YouTube Thumbnail hoặc ảnh bìa Video Short của bạn.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', alignItems: 'start', marginBottom: '40px' }}>
        
        {/* Cột 1: Cấu hình và tạo ảnh */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '20px' }}>🎨 Cấu Hình Tạo Ảnh</h3>
          
          <form onSubmit={handleGenerateImage} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Prompt input */}
            <div className="form-group">
              <label className="form-label" style={{ marginBottom: '8px' }}>Mô tả hình ảnh (Prompt)</label>
              <textarea
                className="form-control"
                style={{ height: '100px', resize: 'vertical', fontSize: '0.88rem' }}
                placeholder="Ví dụ: Một bát mì Ramen nóng hổi, phong cách anime, màu sắc rực rỡ, chi tiết..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                required
                disabled={isGenerating}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '6px' }}>
                * Hỗ trợ tốt nhất bằng Tiếng Anh hoặc Tiếng Việt mô tả chi tiết màu sắc, chủ đề, bối cảnh.
              </span>
            </div>

            {/* Tùy chọn cấu hình */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              
              {/* Tỷ lệ khung hình */}
              <div className="form-group">
                <label className="form-label" style={{ marginBottom: '8px' }}>Tỷ lệ khung hình</label>
                <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <button
                    type="button"
                    onClick={() => setAspectRatio('16:9')}
                    className={`btn ${aspectRatio === '16:9' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, padding: '8px 4px', fontSize: '0.75rem', border: 'none', background: aspectRatio === '16:9' ? 'var(--primary)' : 'transparent', color: '#fff' }}
                    disabled={isGenerating}
                  >
                    16:9 (YouTube)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAspectRatio('9:16')}
                    className={`btn ${aspectRatio === '9:16' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, padding: '8px 4px', fontSize: '0.75rem', border: 'none', background: aspectRatio === '9:16' ? 'var(--primary)' : 'transparent', color: '#fff' }}
                    disabled={isGenerating}
                  >
                    9:16 (Shorts)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAspectRatio('1:1')}
                    className={`btn ${aspectRatio === '1:1' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, padding: '8px 4px', fontSize: '0.75rem', border: 'none', background: aspectRatio === '1:1' ? 'var(--primary)' : 'transparent', color: '#fff' }}
                    disabled={isGenerating}
                  >
                    1:1 (Square)
                  </button>
                </div>
              </div>

              {/* Phong cách hình ảnh */}
              <div className="form-group">
                <label className="form-label" style={{ marginBottom: '8px' }}>Phong cách (Style)</label>
                <select
                  className="form-control"
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  disabled={isGenerating}
                  style={{ background: 'var(--card-bg)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 12px', fontSize: '0.85rem' }}
                >
                  <option value="default">Mặc định (Default)</option>
                  <option value="photo">Chân thực (Realistic Photo)</option>
                  <option value="anime">Hoạt hình (Anime / Manga)</option>
                  <option value="3d">Nghệ thuật 3D (3D Digital Art)</option>
                  <option value="cyberpunk">Khoa học viễn tưởng (Cyberpunk)</option>
                  <option value="cartoon">Hoạt họa (Cartoon Illustration)</option>
                </select>
              </div>

            </div>

            {/* Nút Tạo ảnh */}
            <button
              type="submit"
              disabled={isGenerating || !prompt.trim()}
              className="btn btn-primary"
              style={{
                background: 'linear-gradient(135deg, #7000FF 0%, #F355DA 100%)',
                border: 'none',
                padding: '12px',
                fontSize: '0.9rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginTop: '10px',
                boxShadow: '0 6px 15px rgba(112,0,255,0.4)',
                cursor: 'pointer'
              }}
            >
              {isGenerating ? (
                <>
                  <div style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
                  Đang vẽ ảnh bằng AI...
                </>
              ) : (
                '✨ Bắt Đầu Tạo Ảnh AI'
              )}
            </button>

          </form>
        </div>

        {/* Cột 2: Khung hiển thị kết quả */}
        <div className="glass-card" style={{ padding: '24px', minHeight: '380px', display: 'flex', flexDirection: 'column', justifySelf: 'stretch' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '20px' }}>🖼️ Kết Quả</h3>
          
          {isGenerating && (
            <div style={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '45px', height: '45px', border: '3px solid rgba(255,255,255,0.06)', borderTopColor: 'var(--secondary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Họa sĩ AI đang phác họa hình ảnh của bạn...</span>
            </div>
          )}

          {!isGenerating && !generatedImage && (
            <div style={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'center', alignItems: 'center', border: '2px dashed rgba(255,255,255,0.05)', borderRadius: '12px', padding: '40px', opacity: 0.6 }}>
              <span style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🪄</span>
              <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                Ảnh sinh bởi AI sẽ hiển thị tại đây.<br />Nhập mô tả ở khung bên trái rồi bấm tạo để bắt đầu.
              </span>
            </div>
          )}

          {!isGenerating && generatedImage && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', display: 'flex', justifyContent: 'center' }}>
                <img
                  src={generatedImage.url}
                  alt="AI Generated"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '300px',
                    objectFit: 'contain',
                    display: 'block'
                  }}
                />
              </div>

              {/* Thông số chi tiết */}
              <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.82rem' }}>
                  <div><strong style={{ color: 'var(--text-muted)' }}>Mô tả:</strong> <span style={{ color: '#eee' }}>"{generatedImage.prompt}"</span></div>
                  <div style={{ display: 'flex', gap: '20px', marginTop: '4px' }}>
                    <div><strong style={{ color: 'var(--text-muted)' }}>Tỷ lệ:</strong> <span style={{ color: 'var(--secondary)' }}>{generatedImage.aspectRatio}</span></div>
                    <div><strong style={{ color: 'var(--text-muted)' }}>Kiểu:</strong> <span style={{ color: 'var(--success)' }}>{generatedImage.style}</span></div>
                  </div>
                </div>
              </div>

              {/* Tải về */}
              <a
                href={generatedImage.url}
                download={generatedImage.filename}
                className="btn btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  textDecoration: 'none',
                  padding: '10px 16px',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  background: 'var(--success)'
                }}
              >
                📥 Tải Ảnh Về Máy
              </a>
            </div>
          )}
        </div>

      </div>

      {/* Lịch sử ảnh đã tạo */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '20px' }}>⏳ Thư Viện Ảnh Đã Tạo (Lịch Sử)</h3>

        {loadingHistory ? (
          <div style={{ display: 'flex', padding: '30px', justifyContent: 'center' }}>
            <div style={{ width: '24px', height: '24px', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--secondary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          </div>
        ) : historyImages.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>
            Bạn chưa tạo hình ảnh nào.
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
            {historyImages.map((img) => (
              <div
                key={img.filename}
                className="glass-card"
                style={{
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  border: '1px solid rgba(255,255,255,0.06)',
                  background: 'rgba(255,255,255,0.02)',
                  transition: '0.2s'
                }}
              >
                {/* Image block */}
                <div style={{ height: '120px', borderRadius: '6px', overflow: 'hidden', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  <img
                    src={img.url}
                    alt="History item"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>

                {/* Info and download */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem' }}>
                  <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={img.filename}>
                    {img.filename}
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>Dung lượng: {formatBytes(img.size)}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{new Date(img.createdAt).toLocaleDateString('vi-VN')}</span>
                </div>

                <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                  <a
                    href={img.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary"
                    style={{ flex: 1, padding: '6px 4px', fontSize: '0.72rem', textDecoration: 'none', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    🔍 Xem
                  </a>
                  <a
                    href={img.url}
                    download={img.filename}
                    className="btn btn-primary"
                    style={{ flex: 1, padding: '6px 4px', fontSize: '0.72rem', textDecoration: 'none', textAlign: 'center', background: 'var(--success)' }}
                  >
                    📥 Tải
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
