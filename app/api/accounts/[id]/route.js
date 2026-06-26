import { NextResponse } from 'next/server';
import { readDb, writeDb, getSessionsDir } from '@/lib/db.js';
import fs from 'fs';
import path from 'path';

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const db = readDb();
    
    // Tìm tài khoản
    const accountIndex = db.accounts.findIndex(a => a.id === id);
    if (accountIndex === -1) {
      return NextResponse.json({ error: 'Không tìm thấy tài khoản.' }, { status: 404 });
    }

    const account = db.accounts[accountIndex];

    // Xóa file session
    if (account.sessionFile) {
      const sessionPath = path.join(getSessionsDir(), account.sessionFile);
      if (fs.existsSync(sessionPath)) {
        try {
          fs.unlinkSync(sessionPath);
        } catch (err) {
          console.error(`Không thể xóa file session ${sessionPath}:`, err);
        }
      }
    }

    // Xóa tài khoản khỏi database
    db.accounts.splice(accountIndex, 1);
    
    // Xóa các bài đăng liên quan hoặc đổi trạng thái?
    // Để cho sạch sẽ, chúng ta sẽ xóa các bài đăng chưa tải lên của kênh này
    db.posts = db.posts.filter(p => !(p.accountId === id && p.status === 'pending'));

    writeDb(db);

    return NextResponse.json({ success: true, message: 'Đã xóa tài khoản thành công.' });
  } catch (error) {
    console.error('[API Accounts DELETE Error] Xóa kênh lỗi:', error);
    return NextResponse.json({ error: error.message || 'Lỗi không xác định.' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const { label, username, profileId, cookie, avatar } = await request.json();
    const db = readDb();
    
    const accountIndex = db.accounts.findIndex(a => a.id === id);
    if (accountIndex === -1) {
      return NextResponse.json({ error: 'Không tìm thấy tài khoản.' }, { status: 404 });
    }

    const account = db.accounts[accountIndex];

    // Cập nhật thông tin
    if (label !== undefined) account.label = label.trim();
    if (username !== undefined) {
      const cleanUsername = username.trim().startsWith('@') ? username.trim().slice(1) : username.trim();
      account.username = cleanUsername;
    }
    if (profileId !== undefined) account.profileId = profileId.trim();
    if (avatar !== undefined) account.avatar = avatar;

    // Cập nhật cookie (nếu có và tài khoản là dạng local/cookie)
    if (cookie !== undefined && cookie.trim()) {
      const { createSessionWithCookie } = await import('@/lib/poster.js');
      createSessionWithCookie(id, cookie.trim());
      account.sessionFile = `${id}.json`;
    }

    writeDb(db);

    return NextResponse.json({ success: true, message: 'Cập nhật tài khoản thành công.', account });
  } catch (error) {
    console.error('[API Accounts PUT Error] Cập nhật kênh lỗi:', error);
    return NextResponse.json({ error: error.message || 'Lỗi không xác định.' }, { status: 500 });
  }
}

