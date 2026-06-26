import { NextResponse } from 'next/server';
import { readDb, writeDb } from '@/lib/db.js';
import { loginAccount } from '@/lib/poster.js';

export async function GET() {
  const db = readDb();
  return NextResponse.json({ accounts: db.accounts });
}

export async function POST(request) {
  try {
    const { label } = await request.json();
    if (!label) {
      return NextResponse.json({ error: 'Thiếu tên nhãn kênh.' }, { status: 400 });
    }

    const accountId = `acc_${Date.now()}`;
    console.log(`[API Accounts] Bắt đầu kích hoạt luồng đăng nhập cho kênh: ${label} (${accountId})`);

    // Thực hiện mở trình duyệt để người dùng đăng nhập.
    // Hàm này sẽ tự động block cho đến khi người dùng đăng nhập thành công hoặc đóng trình duyệt.
    const result = await loginAccount(accountId);

    const db = readDb();
    const newAccount = {
      id: accountId,
      label: label,
      username: result.username,
      status: result.status,
      sessionFile: `${accountId}.json`,
      createdAt: new Date().toISOString()
    };

    db.accounts.push(newAccount);
    writeDb(db);

    return NextResponse.json({ success: true, account: newAccount });
  } catch (error) {
    console.error('[API Accounts Error] Đăng ký kênh lỗi:', error);
    return NextResponse.json({ error: error.message || 'Lỗi không xác định khi đăng nhập.' }, { status: 500 });
  }
}
