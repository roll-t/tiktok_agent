import { NextResponse } from 'next/server';
import { readDb, writeDb, getUploadsDir } from '@/lib/db.js';
import fs from 'fs';
import path from 'path';

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const db = await readDb();
    
    const postIndex = db.posts.findIndex(p => p.id === id);
    if (postIndex === -1) {
      return NextResponse.json({ error: 'Không tìm thấy bài viết.' }, { status: 404 });
    }

    const post = db.posts[postIndex];

    // Xóa bài viết khỏi db
    db.posts.splice(postIndex, 1);

    // Kiểm tra xem file video có được dùng bởi bài viết khác không. 
    // Nếu không thì xóa file video đi để giải phóng dung lượng.
    const isVideoUsedElsewhere = db.posts.some(p => p.videoFilename === post.videoFilename);
    if (!isVideoUsedElsewhere && post.videoFilename) {
      const videoPath = path.join(getUploadsDir(), post.videoFilename);
      if (fs.existsSync(videoPath)) {
        try {
          fs.unlinkSync(videoPath);
          console.log(`[API Posts DELETE] Đã xóa file video thừa: ${videoPath}`);
        } catch (err) {
          console.error(`Không thể xóa file video ${videoPath}:`, err);
        }
      }
    }

    await writeDb(db);

    return NextResponse.json({ success: true, message: 'Đã xóa bài đăng thành công.' });
  } catch (error) {
    console.error('[API Posts DELETE Error] Xóa bài đăng lỗi:', error);
    return NextResponse.json({ error: error.message || 'Lỗi không xác định.' }, { status: 500 });
  }
}
