import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getUploadsDir } from '@/lib/db.js';

export async function GET() {
  try {
    const uploadsDir = getUploadsDir();
    if (!fs.existsSync(uploadsDir)) {
      return NextResponse.json({ success: true, images: [] });
    }

    const files = fs.readdirSync(uploadsDir);
    
    // Lọc các file bắt đầu bằng 'ai_thumb_' hoặc 'ai_' và có đuôi ảnh hợp lệ
    const imageFiles = files
      .filter(file => file.startsWith('ai_') && (file.endsWith('.jpg') || file.endsWith('.png') || file.endsWith('.jpeg')))
      .map(file => {
        const filePath = path.join(uploadsDir, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          url: `/api/thumbnail/${file}`,
          createdAt: stats.mtime.toISOString(),
          size: stats.size
        };
      })
      // Sắp xếp ảnh mới tạo lên đầu
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return NextResponse.json({ success: true, images: imageFiles });
  } catch (error) {
    console.error('[API Image Gen History Error]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
