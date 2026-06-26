import { NextResponse } from 'next/server';
import { readDb, writeDb, getUploadsDir } from '@/lib/db.js';
import { runUploadInBackground } from '@/lib/poster.js';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const db = readDb();
  
  // Trình tự kiểm tra tự động chạy ngầm các bài đăng đến giờ
  const now = new Date();
  const readyPost = db.posts.find(p => p.status === 'pending' && new Date(p.scheduledAt) <= now);
  
  if (readyPost) {
    console.log(`[Queue Scheduler] Phát hiện bài đăng ${readyPost.id} đến giờ đăng. Kích hoạt chạy ngầm...`);
    // Chuyển trạng thái sang processing luôn để tránh bị gọi trùng lặp
    readyPost.status = 'processing';
    writeDb(db);
    
    // Gọi tác vụ upload ngầm không chặn luồng chính
    runUploadInBackground(readyPost.id).catch(err => {
      console.error('[Queue Scheduler Error] Lỗi khi đăng bài ngầm:', err);
    });
  }

  // Sắp xếp bài đăng mới nhất lên đầu
  const sortedPosts = [...db.posts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  return NextResponse.json({ posts: sortedPosts });
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const videoFile = formData.get('video');
    const caption = formData.get('caption') || '';
    const accountId = formData.get('accountId');
    const scheduledAt = formData.get('scheduledAt');

    if (!videoFile || !accountId) {
      return NextResponse.json({ error: 'Thiếu file video hoặc tài khoản đăng.' }, { status: 400 });
    }

    const db = readDb();
    const account = db.accounts.find(a => a.id === accountId);
    if (!account) {
      return NextResponse.json({ error: 'Tài khoản chọn không hợp lệ.' }, { status: 400 });
    }

    // Đọc buffer của video và lưu vào data/uploads
    const bytes = await videoFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    const ext = path.extname(videoFile.name) || '.mp4';
    const videoFilename = `${Date.now()}_${Math.random().toString(36).substr(2, 5)}${ext}`;
    const videoFilePath = path.join(getUploadsDir(), videoFilename);
    
    fs.writeFileSync(videoFilePath, buffer);
    console.log(`[API Posts] Đã lưu video thành công tại: ${videoFilePath}`);

    const postId = `post_${Date.now()}`;
    const newPost = {
      id: postId,
      accountId: accountId,
      accountLabel: account.label,
      accountUsername: account.username,
      videoFilename: videoFilename,
      caption: caption,
      status: 'pending', // pending, processing, success, failed
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : new Date().toISOString(),
      postedAt: null,
      error: null,
      createdAt: new Date().toISOString()
    };

    db.posts.push(newPost);
    writeDb(db);

    // Nếu thời gian đăng là ngay bây giờ hoặc đã qua, chạy upload luôn
    const isImmediate = new Date(newPost.scheduledAt) <= new Date();
    if (isImmediate) {
      console.log(`[API Posts] Đăng ngay lập tức cho bài viết ${postId}. Chạy ngầm...`);
      newPost.status = 'processing';
      writeDb(db);

      runUploadInBackground(postId).catch(err => {
        console.error('[API Posts Immediate Error] Lỗi đăng bài ngay:', err);
      });
    }

    return NextResponse.json({ success: true, post: newPost });
  } catch (error) {
    console.error('[API Posts POST Error] Lỗi đăng bài:', error);
    return NextResponse.json({ error: error.message || 'Lỗi không xác định.' }, { status: 500 });
  }
}
