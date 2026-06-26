import { NextResponse } from 'next/server';
import { readDb, writeDb } from '@/lib/db.js';
import { loginAccount, createSessionWithCookie, loginYoutubeAccount } from '@/lib/poster.js';

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

  const db = readDb();
  return NextResponse.json({ accounts: db.accounts });
}

export async function POST(request) {
  try {
    const { label, cookie, username, type, profileId, platform, avatar } = await request.json();
    if (!label) {
      return NextResponse.json({ error: 'Thiếu tên nhãn kênh.' }, { status: 400 });
    }

    const accountId = `acc_${Date.now()}`;
    const cleanPlatform = platform || 'tiktok';

    // Nếu liên kết qua trình duyệt ẩn danh AdsPower
    if (type === 'adspower' && profileId && profileId.trim()) {
      console.log(`[API Accounts] Liên kết kênh qua AdsPower: ${label} (${accountId}), Profile ID: ${profileId}, Platform: ${cleanPlatform}`);

      const cleanUsername = username && username.trim()
        ? (username.trim().startsWith('@') ? username.trim().slice(1) : username.trim())
        : 'adspower_user';

      const db = readDb();
      const newAccount = {
        id: accountId,
        label: label,
        username: cleanUsername,
        type: 'adspower',
        profileId: profileId.trim(),
        platform: cleanPlatform,
        status: 'active',
        avatar: avatar || null,
        createdAt: new Date().toISOString()
      };

      db.accounts.push(newAccount);
      writeDb(db);

      global.loginStatuses = global.loginStatuses || {};
      global.loginStatuses[accountId] = { status: 'success', account: newAccount };

      return NextResponse.json({ success: true, accountId, instant: true });
    }
    
    // Nếu truyền cả Cookie và Username thì tạo tài khoản trực tiếp ngay lập tức (không chạy trình duyệt)
    if (cookie && cookie.trim() && username && username.trim()) {
      console.log(`[API Accounts] Nhận yêu cầu liên kết trực tiếp bằng Cookie cho kênh: ${label} (${accountId}), username: ${username}`);
      
      try {
        // Tạo file session trực tiếp
        createSessionWithCookie(accountId, cookie.trim());

        // Định dạng lại username
        const cleanUsername = username.trim().startsWith('@') ? username.trim().slice(1) : username.trim();

        // Lưu vào DB
        const db = readDb();
        const newAccount = {
          id: accountId,
          label: label,
          username: cleanUsername,
          platform: cleanPlatform,
          status: 'active',
          sessionFile: `${accountId}.json`,
          avatar: avatar || null,
          createdAt: new Date().toISOString()
        };

        db.accounts.push(newAccount);
        writeDb(db);

        // Lưu trạng thái thành công lập tức vào global để client poll nhận kết quả ngay
        global.loginStatuses = global.loginStatuses || {};
        global.loginStatuses[accountId] = { status: 'success', account: newAccount };

        return NextResponse.json({ success: true, accountId, instant: true });
      } catch (err) {
        console.error(`[API Accounts Error] Tạo session trực tiếp thất bại:`, err);
        return NextResponse.json({ error: err.message || 'Lỗi không xác định khi tạo session.' }, { status: 500 });
      }
    }

    // Nếu không truyền đầy đủ, chuyển sang mở trình duyệt Edge/Chrome để đăng nhập ngầm như cũ
    console.log(`[API Accounts] Khởi động tiến trình đăng nhập ngầm cho kênh: ${label} (${accountId}), Nền tảng: ${cleanPlatform}`);

    // Lưu trạng thái đang chạy ngầm vào biến global
    global.loginStatuses = global.loginStatuses || {};
    global.loginStatuses[accountId] = { status: 'running', error: null };

    // Chọn tiến trình xác thực: mở trình duyệt Edge/Chrome để đăng nhập
    const authPromise = cleanPlatform === 'youtube'
      ? loginYoutubeAccount(accountId)
      : loginAccount(accountId);

    authPromise
      .then((result) => {
        const db = readDb();
        const newAccount = {
          id: accountId,
          label: label,
          username: result.username,
          platform: cleanPlatform,
          status: result.status,
          sessionFile: `${accountId}.json`,
          avatar: avatar || null,
          createdAt: new Date().toISOString()
        };

        db.accounts.push(newAccount);
        writeDb(db);

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
