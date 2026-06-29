import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getUploadsDir } from '@/lib/db.js';

export async function POST(request) {
  try {
    const { prompt } = await request.json();
    if (!prompt) {
      return NextResponse.json({ error: 'Thiếu mô tả ảnh (prompt).' }, { status: 400 });
    }

    const uploadsDir = getUploadsDir();
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Generate random seed
    const seed = Math.floor(Math.random() * 1000000);
    const width = 1280;
    const height = 720; // 16:9 ratio suitable for YouTube thumbnails

    // Pollinations AI endpoint for flux model
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&seed=${seed}&model=flux&nologo=true`;

    console.log(`[API Generate Image] Đang tạo ảnh từ prompt: "${prompt}"...`);
    const res = await fetch(imageUrl);
    if (!res.ok) {
      throw new Error(`Lỗi kết nối API tạo ảnh (Status: ${res.status})`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());

    // Lưu ảnh vào thư mục uploads dưới định dạng .jpg
    const filename = `ai_thumb_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.jpg`;
    const outputPath = path.join(uploadsDir, filename);

    fs.writeFileSync(outputPath, buffer);
    console.log(`[API Generate Image] Đã tạo và lưu ảnh thành công: ${filename}`);

    return NextResponse.json({
      success: true,
      filename,
      url: `/api/thumbnail/${filename}`
    });
  } catch (error) {
    console.error('[API Generate Image Error]:', error);
    return NextResponse.json({ error: error.message || 'Lỗi không xác định.' }, { status: 500 });
  }
}
