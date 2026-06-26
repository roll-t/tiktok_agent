import { NextResponse } from 'next/server';
import { getUploadsDir } from '@/lib/db.js';
import fs from 'fs';
import path from 'path';

export async function GET(request, { params }) {
  const { filename } = await params;
  
  if (!filename || filename.includes('..') || filename.includes('/')) {
    return NextResponse.json({ error: 'Tên file không hợp lệ.' }, { status: 400 });
  }

  const filePath = path.join(getUploadsDir(), filename);
  
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'Không tìm thấy file.' }, { status: 404 });
  }

  const fileBuffer = fs.readFileSync(filePath);
  const ext = path.extname(filename).toLowerCase();
  
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif'
  };
  
  const contentType = mimeTypes[ext] || 'image/jpeg';
  
  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400'
    }
  });
}
