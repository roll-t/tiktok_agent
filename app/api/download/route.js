import { NextResponse } from 'next/server';
import { getUploadsDir, getMongoClientDb } from '@/lib/db.js';
import { downloadWithYtdlp, cleanUploadsFolder } from '@/lib/downloader.js';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const db = await getMongoClientDb();
    const downloads = await db.collection('downloads')
      .find({})
      .sort({ createdAt: -1 })
      .limit(100) // Quét nhiều hơn để hỗ trợ phân trang video
      .toArray();

    const validDownloads = [];
    for (const dl of downloads) {
      const folder = dl.savePath || getUploadsDir();
      const filePath = path.join(folder, dl.videoFilename);
      
      if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
        validDownloads.push({
          url: dl.url,
          videoFilename: dl.videoFilename,
          caption: dl.caption,
          cover: dl.cover,
          savePath: folder,
          createdAt: dl.createdAt
        });
      } else {
        // Tự động xóa cache / lịch sử trong DB nếu clip không còn tồn tại trên ổ đĩa
        try {
          await db.collection('downloads').deleteOne({ _id: dl._id });
        } catch (e) {
          console.error('[API Download GET] Lỗi xóa cache download:', e);
        }
      }
    }

    return NextResponse.json({ success: true, downloads: validDownloads });
  } catch (error) {
    console.error('[API Download GET Error]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { url } = await request.json();
    if (!url) {
      return NextResponse.json({ error: 'Thiếu đường dẫn (URL) video.' }, { status: 400 });
    }

    const cleanUrl = url.trim();
    console.log(`[API Download] Nhận yêu cầu tải video từ URL: ${cleanUrl}`);

    // Dọn dẹp trước để giải phóng bộ nhớ dưới 1GB trước khi tải thêm video mới
    try {
      cleanUploadsFolder();
    } catch (cleanErr) {
      console.error('[API Download] Dọn dẹp trước khi tải lỗi:', cleanErr);
    }

    // Kiểm tra xem liên kết này đã tồn tại và file video vẫn nằm trong thư mục uploads hay chưa
    const db = await getMongoClientDb();
    const existingDownload = await db.collection('downloads').findOne({ url: cleanUrl });
    if (existingDownload) {
      const filePath = path.join(getUploadsDir(), existingDownload.videoFilename);
      if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
        console.log(`[API Download] Video đã tải trước đó. Tái sử dụng file: ${existingDownload.videoFilename}`);
        return NextResponse.json({
          success: true,
          videoFilename: existingDownload.videoFilename,
          caption: existingDownload.caption,
          cover: existingDownload.cover,
          reused: true
        });
      }
    }

    const isTiktok = /tiktok\.com/i.test(cleanUrl);
    let videoFilename = '';
    let caption = '';
    let cover = '';

    if (isTiktok) {
      try {
        console.log(`[API Download] Phát hiện link TikTok, thử dùng TikWM...`);
        const tikwmApiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(cleanUrl)}`;
        const res = await fetch(tikwmApiUrl);
        const result = await res.json();

        if (result.code === 0 && result.data && result.data.play) {
          const videoData = result.data;
          const downloadUrl = videoData.play;
          caption = videoData.title || '';
          cover = videoData.cover || '';

          // Tải video về máy chủ
          const videoRes = await fetch(downloadUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
              'Referer': 'https://www.tiktok.com/'
            }
          });

          if (videoRes.ok) {
            const arrayBuffer = await videoRes.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            videoFilename = `reup_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.mp4`;
            const videoFilePath = path.join(getUploadsDir(), videoFilename);

            fs.writeFileSync(videoFilePath, buffer);
            console.log(`[API Download] Đã tải TikTok qua TikWM thành công: ${videoFilePath}`);
          }
        }
      } catch (tikwmErr) {
        console.error(`[API Download] Lỗi TikWM, chuyển sang yt-dlp:`, tikwmErr);
      }
    }

    // Nếu không phải TikTok hoặc TikWM thất bại, dùng yt-dlp làm dự phòng
    if (!videoFilename) {
      console.log(`[API Download] Bắt đầu tải bằng yt-dlp cho URL: ${cleanUrl}`);
      const downloadResult = await downloadWithYtdlp(cleanUrl);
      videoFilename = downloadResult.videoFilename;
      caption = downloadResult.caption;
      cover = downloadResult.cover;
    }

    // Lưu / Cập nhật lịch sử tải vào MongoDB
    await db.collection('downloads').updateOne(
      { url: cleanUrl },
      {
        $set: {
          videoFilename,
          caption,
          cover,
          savePath: getUploadsDir(),
          createdAt: new Date()
        }
      },
      { upsert: true }
    );

    // Chạy dọn dẹp sau khi lưu
    try {
      cleanUploadsFolder();
    } catch (cleanErr) {
      console.error('[API Download] Dọn dẹp sau khi tải lỗi:', cleanErr);
    }

    return NextResponse.json({
      success: true,
      videoFilename,
      caption,
      cover
    });

  } catch (error) {
    console.error('[API Download Error] Lỗi tải video:', error);
    return NextResponse.json({ error: error.message || 'Lỗi hệ thống khi tải video.' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const db = await getMongoClientDb();
    await db.collection('downloads').deleteMany({});
    return NextResponse.json({ success: true, message: 'Đã xóa toàn bộ lịch sử tải video.' });
  } catch (error) {
    console.error('[API Download DELETE Error]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
