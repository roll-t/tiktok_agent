import { NextResponse } from 'next/server';
import { getUploadsDir, getMongoClientDb } from '@/lib/db.js';
import fs from 'fs';
import path from 'path';

export async function GET(request, { params }) {
  try {
    const { filename } = await params;
    const db = await getMongoClientDb();
    
    // Tìm thông tin lưu trữ của file trong DB
    const downloadRecord = await db.collection('downloads').findOne({ videoFilename: filename });
    
    let folder = getUploadsDir();
    if (downloadRecord && downloadRecord.savePath) {
      folder = downloadRecord.savePath;
    }
    
    let filePath = path.join(folder, filename);

    // Nếu không tìm thấy, thử tìm ở thư mục mặc định ban đầu
    if (!fs.existsSync(filePath)) {
      const defaultFolder = path.resolve('data/uploads');
      const fallbackPath = path.join(defaultFolder, filename);
      if (fs.existsSync(fallbackPath)) {
        filePath = fallbackPath;
      } else {
        return new NextResponse('Không tìm thấy tệp video.', { status: 404 });
      }
    }

    const fileBuffer = fs.readFileSync(filePath);
    
    // Trả về file video dưới dạng stream/buffer với Content-Type phù hợp
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': fileBuffer.length.toString(),
        'Accept-Ranges': 'bytes'
      }
    });
  } catch (error) {
    console.error('[API Videos GET Error] Lỗi truyền file:', error);
    return new NextResponse('Lỗi máy chủ nội bộ.', { status: 500 });
  }
}
