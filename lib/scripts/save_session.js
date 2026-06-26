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
  let browser;
  try {
    console.log('Đang thử khởi chạy Microsoft Edge...');
    browser = await chromium.launch({
      headless: false,
      channel: 'msedge',
      ignoreDefaultArgs: ['--enable-automation'],
      args: [
        '--disable-blink-features=AutomationControlled',
        '--start-maximized'
      ]
    });
  } catch (errEdge) {
    try {
      console.log('Không mở được Edge, đang thử khởi chạy Google Chrome...');
      browser = await chromium.launch({
        headless: false,
        channel: 'chrome',
        ignoreDefaultArgs: ['--enable-automation'],
        args: [
          '--disable-blink-features=AutomationControlled',
          '--start-maximized'
        ]
      });
    } catch (errChrome) {
      console.log('Không khởi chạy được Google Chrome/Edge, sử dụng trình duyệt mặc định...');
      browser = await chromium.launch({
        headless: false,
        ignoreDefaultArgs: ['--enable-automation'],
        args: [
          '--disable-blink-features=AutomationControlled',
          '--start-maximized'
        ]
      });
    }
  }
  
  // Tạo context với viewport bằng null để vừa khít trình duyệt maximized
  const context = await browser.newContext({
    viewport: null,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh'
  });

  // Ẩn navigator.webdriver để tránh bị phát hiện tự động hóa
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined
    });
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
