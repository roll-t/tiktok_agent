import { NextResponse } from 'next/server';
import { readDb, writeDb } from '@/lib/db.js';
import { loginYoutubeAccount } from '@/lib/poster.js';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  // Nếu truyền id, trả về trạng thái của phiên đăng nhập chạy ngầm
  if (id) {
    global.loginStatuses = global.loginStatuses || {};
    const statusInfo = global.loginStatuses[id];
    if (!statusInfo) {
      return NextResponse.json({ error: 'Không tìm thấy trạng thái phiên đăng nhập.' }, { status: 404 });
    }
    return NextResponse.json(statusInfo);
  }

  const db = await readDb();
  return NextResponse.json({ accounts: db.accounts });
}

export async function POST(request) {
  try {
    const { label, username, videoType, avatar } = await request.json();
    if (!label) {
      return NextResponse.json({ error: 'Thiếu tên nhãn kênh.' }, { status: 400 });
    }

    const accountId = `acc_${Date.now()}`;
    const cleanVideoType = videoType || 'shorts';

    // Lưu trạng thái đang chạy ngầm vào biến global
    global.loginStatuses = global.loginStatuses || {};
    global.loginStatuses[accountId] = { status: 'running', error: null };

    // Mở trình duyệt YouTube để đăng nhập
    loginYoutubeAccount(accountId)
      .then(async (result) => {
        const db = await readDb();
        const newAccount = {
          id: accountId,
          label: label,
          username: result.username,
          platform: 'youtube',
          videoType: cleanVideoType,
          status: result.status,
          sessionFile: `${accountId}.json`,
          avatar: avatar || null,
          createdAt: new Date().toISOString()
        };

        db.accounts.push(newAccount);
        await writeDb(db);

        global.loginStatuses[accountId] = { status: 'success', account: newAccount };
        console.log(`[API Accounts] Lưu kênh thành công: ${result.username} (${accountId})`);
      })
      .catch((error) => {
        global.loginStatuses[accountId] = { 
          status: 'failed', 
          error: error.message || 'Lỗi không xác định khi đăng nhập.' 
        };
        console.error(`[API Accounts Error] Đăng nhập kênh ${accountId} thất bại:`, error);
      });

    // Trả về ngay lập tức để Client bắt đầu poll trạng thái
    return NextResponse.json({ success: true, accountId });
  } catch (error) {
    console.error('[API Accounts Error] Đăng ký kênh lỗi:', error);
    return NextResponse.json({ error: error.message || 'Lỗi không xác định khi đăng nhập.' }, { status: 500 });
  }
}
