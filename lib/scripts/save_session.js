import { chromium } from 'playwright';
import readline from 'readline';
import fs from 'fs';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
  console.log('Đang khởi chạy trình duyệt...');
  const browser = await chromium.launch({
    headless: false, // Phải mở trình duyệt để người dùng đăng nhập
    args: ['--start-maximized']
  });
  
  // Tạo context với viewport bằng null để vừa khít trình duyệt maximized
  const context = await browser.newContext({
    viewport: null
  });
  
  const page = await context.newPage();
  
  console.log('Đang chuyển hướng đến trang đăng nhập TikTok...');
  await page.goto('https://www.tiktok.com/login', { waitUntil: 'domcontentloaded' });
  
  console.log('\n==================================================');
  console.log('HÃY ĐĂNG NHẬP VÀO TÀI KHOẢN TIKTOK CỦA BẠN TRÊN TRÌNH DUYỆT.');
  console.log('Bạn có thể quét mã QR, dùng mật khẩu hoặc mã xác nhận.');
  console.log('Sau khi đăng nhập thành công và thấy giao diện trang chủ TikTok,');
  console.log('hãy quay lại terminal này và nhấn [ENTER] để lưu phiên đăng nhập.');
  console.log('==================================================\n');
  
  await askQuestion('Nhấn [ENTER] sau khi đã đăng nhập thành công...');
  
  console.log('Đang lưu thông tin phiên đăng nhập...');
  // Lưu cookies và localStorage vào file session.json
  await context.storageState({ path: 'session.json' });
  console.log('Phiên đăng nhập đã được lưu thành công vào file session.json!');
  
  await browser.close();
  rl.close();
}

main().catch(err => {
  console.error('Đã xảy ra lỗi:', err);
  rl.close();
  process.exit(1);
});
