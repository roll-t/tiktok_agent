import { NextResponse } from 'next/server';
import { readDb, writeDb } from '@/lib/db.js';
import { getVideoStats } from '@/lib/downloader.js';

export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const db = await readDb();

    const action = searchParams.get('action');
    if (action === 'stop') {
      global.statsSyncStopRequested = true;
      global.syncStatus = null;
      return NextResponse.json({ success: true, message: 'Đã yêu cầu dừng đồng bộ tương tác.' });
    }

    if (id) {
      // Đồng bộ cho 1 bài viết cụ thể
      const post = db.posts.find(p => p.id === id);
      if (!post) {
        return NextResponse.json({ error: 'Không tìm thấy bài viết.' }, { status: 404 });
      }
      if (!post.videoUrl) {
        return NextResponse.json({ error: 'Bài viết chưa có link video thành công.' }, { status: 400 });
      }

      try {
        const stats = await getVideoStats(post.videoUrl);
        post.views = stats.views;
        post.likes = stats.likes;
        post.comments = stats.comments;
        post.statsUpdatedAt = new Date().toISOString();

        await writeDb(db);
        return NextResponse.json({ success: true, post });
      } catch (err) {
        return NextResponse.json({ error: `Lỗi đồng bộ: ${err.message}` }, { status: 500 });
      }
    } else {
      // Đồng bộ cho tất cả các bài viết thành công
      const successPosts = db.posts.filter(p => p.status === 'success' && p.videoUrl);
      if (successPosts.length === 0) {
        return NextResponse.json({ success: true, message: 'Không có bài đăng thành công nào cần đồng bộ.' });
      }

      // Khởi tạo trạng thái đồng bộ
      global.statsSyncStopRequested = false;
      global.syncStatus = {
        active: true,
        total: successPosts.length,
        current: 0,
        startedAt: new Date().toISOString()
      };

      // Khởi chạy tiến trình ngầm để không block request
      (async () => {
        console.log(`[Stats Sync Background] Bắt đầu đồng bộ tương tác cho ${successPosts.length} bài viết...`);
        let currentCount = 0;

        for (const post of successPosts) {
          if (global.statsSyncStopRequested) {
            console.log('[Stats Sync Background] Nhận được yêu cầu DỪNG từ người dùng. Đang thoát...');
            break;
          }

          try {
            const currentDb = await readDb();
            currentCount++;
            
            // Cập nhật số lượng hiện tại vào biến toàn cục
            if (global.syncStatus) {
              global.syncStatus.current = currentCount;
            }

            const activePost = currentDb.posts.find(p => p.id === post.id);
            if (activePost && activePost.videoUrl) {
              const stats = await getVideoStats(activePost.videoUrl);
              activePost.views = stats.views;
              activePost.likes = stats.likes;
              activePost.comments = stats.comments;
              activePost.statsUpdatedAt = new Date().toISOString();
              await writeDb(currentDb);
            }
            console.log(`[Stats Sync Background] (${currentCount}/${successPosts.length}) Đã cập nhật tương tác cho bài ${post.id}`);
            
            // Giãn cách một chút tránh spam request
            await new Promise(r => setTimeout(r, 1000));
          } catch (e) {
            console.error(`[Stats Sync Background Error] Bài viết ${post.id}:`, e.message);
          }
        }

        // Reset trạng thái sau khi hoàn tất hoặc dừng
        global.syncStatus = null;
        global.statsSyncStopRequested = false;
        console.log('[Stats Sync Background] Kết thúc tiến trình đồng bộ dữ liệu tương tác ngầm.');
      })().catch(err => {
        console.error('[Stats Sync Background Global Error]:', err);
      });

      return NextResponse.json({ success: true, message: 'Đã bắt đầu đồng bộ tương tác ngầm.' });
    }
  } catch (error) {
    console.error('[API Sync Stats Error]:', error);
    return NextResponse.json({ error: error.message || 'Lỗi không xác định.' }, { status: 500 });
  }
}
