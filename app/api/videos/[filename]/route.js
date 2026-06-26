import { NextResponse } from 'next/server';
import { getUploadsDir } from '@/lib/db.js';
import fs from 'fs';
import path from 'path';

export async function GET(request, { params }) {
  try {
    const { filename } = await params;
    const filePath = path.join(getUploadsDir(), filename);

    if (!fs.existsSync(filePath)) {
      return new NextResponse('Không tìm thấy tệp video.', { status: 404 });
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
