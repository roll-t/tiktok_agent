import { NextResponse } from 'next/server';
import { getUploadsDir } from '@/lib/db.js';
import fs from 'fs';
import path from 'path';

export async function POST(request) {
  try {
    const { url } = await request.json();
    if (!url) {
      return NextResponse.json({ error: 'Thiếu đường dẫn (URL) video TikTok.' }, { status: 400 });
    }

    console.log(`[API Download] Nhận yêu cầu tải video từ URL: ${url}`);

    // Gọi API miễn phí của TikWM để lấy thông tin video không logo
    const tikwmApiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
    const res = await fetch(tikwmApiUrl);
    const result = await res.json();

    if (result.code !== 0 || !result.data) {
      return NextResponse.json({ error: result.msg || 'Không thể lấy thông tin video từ TikWM. Vui lòng kiểm tra lại URL.' }, { status: 400 });
    }

    const videoData = result.data;
    const downloadUrl = videoData.play; // Đây là đường dẫn video không có logo (watermark)
    const caption = videoData.title || '';
    const cover = videoData.cover || '';

    if (!downloadUrl) {
      return NextResponse.json({ error: 'Không tìm thấy liên kết tải video không logo.' }, { status: 400 });
    }

    console.log(`[API Download] Tìm thấy liên kết tải video không logo: ${downloadUrl}`);

    // Tải video về máy chủ
    const videoRes = await fetch(downloadUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://www.tiktok.com/'
      }
    });

    if (!videoRes.ok) {
      throw new Error(`Tải video từ TikTok CDN thất bại: Status ${videoRes.status}`);
    }

    const arrayBuffer = await videoRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Lưu tệp video vào thư mục data/uploads
    const videoFilename = `reup_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.mp4`;
    const videoFilePath = path.join(getUploadsDir(), videoFilename);
    
    fs.writeFileSync(videoFilePath, buffer);
    console.log(`[API Download] Đã tải và lưu thành công video tại: ${videoFilePath}`);

    return NextResponse.json({
      success: true,
      videoFilename,
      caption,
      cover
    });

  } catch (error) {
    console.error('[API Download Error] Lỗi tải video không logo:', error);
    return NextResponse.json({ error: error.message || 'Lỗi hệ thống khi tải video.' }, { status: 500 });
  }
}
