import { NextResponse } from 'next/server';
import { readDb, writeDb } from '@/lib/db.js';
import { runUploadInBackground } from '@/lib/poster.js';

export async function POST(request) {
  try {
    const { postId } = await request.json();
    if (!postId) {
      return NextResponse.json({ error: 'Thiếu postId.' }, { status: 400 });
    }

    const db = readDb();
    const post = db.posts.find(p => p.id === postId);
    if (!post) {
      return NextResponse.json({ error: 'Không tìm thấy bài viết.' }, { status: 404 });
    }

    // Đánh dấu sang processing và ghi lại db
    post.status = 'processing';
    post.error = null;
    writeDb(db);

    console.log(`[API Posts Run] Đang kích hoạt chạy thủ công ngay lập tức cho bài viết: ${postId}`);
    runUploadInBackground(postId).catch(err => {
      console.error('[API Posts Run Error] Lỗi chạy ngầm bài viết:', err);
    });

    return NextResponse.json({ success: true, message: 'Đã bắt đầu tiến trình đăng bài ngầm.' });
  } catch (error) {
    console.error('[API Posts Run POST Error] Lỗi kích hoạt bài viết:', error);
    return NextResponse.json({ error: error.message || 'Lỗi không xác định.' }, { status: 500 });
  }
}
