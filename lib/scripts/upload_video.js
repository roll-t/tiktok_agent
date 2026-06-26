import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

// Phân tích tham số dòng lệnh
const args = process.argv.slice(2);
let videoPath = null;
let caption = null;
let headless = false;

for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--video=')) {
    videoPath = args[i].split('=')[1];
  } else if (args[i] === '--video' && args[i + 1]) {
    videoPath = args[i + 1];
    i++;
  } else if (args[i].startsWith('--caption=')) {
    caption = args[i].split('=')[1];
  } else if (args[i] === '--caption' && args[i + 1]) {
    caption = args[i + 1];
    i++;
  } else if (args[i] === '--headless') {
    headless = true;
  }
}

// Kiểm tra tham số đầu vào
if (!videoPath) {
  console.error('Lỗi: Thiếu tham số video. Sử dụng: --video="đường_dẫn_video.mp4" [--caption="tiêu đề"] [--headless]');
  process.exit(1);
}

// Kiểm tra sự tồn tại của file video
const absoluteVideoPath = path.resolve(videoPath);
if (!fs.existsSync(absoluteVideoPath)) {
  console.error(`Lỗi: Không tìm thấy file video tại đường dẫn: ${absoluteVideoPath}`);
  process.exit(1);
}

// Mặc định caption bằng tên file video nếu không truyền vào
if (!caption) {
  caption = path.basename(absoluteVideoPath, path.extname(absoluteVideoPath));
}

// Kiểm tra file session
const sessionPath = 'session.json';
if (!fs.existsSync(sessionPath)) {
  console.error('Lỗi: Chưa có file session.json. Hãy chạy "node save_session.js" trước để đăng nhập và lưu session.');
  process.exit(1);
}

async function run() {
  console.log('Đang khởi chạy trình duyệt...');
  const browser = await chromium.launch({
    headless: headless,
    args: ['--start-maximized']
  });

  console.log('Đang khôi phục phiên đăng nhập từ session.json...');
  const context = await browser.newContext({
    storageState: sessionPath,
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh'
  });

  const page = await context.newPage();

  try {
    console.log('Đang truy cập trang tải lên video của TikTok Studio...');
    await page.goto('https://www.tiktok.com/tiktokstudio/upload', { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });

    // Chờ 3 giây để trang tải và kiểm tra xem có bị chuyển hướng về trang login không
    await page.waitForTimeout(3000);
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      console.error('Lỗi: Phiên đăng nhập (session.json) đã hết hạn. Vui lòng chạy "node save_session.js" để đăng nhập lại.');
      await browser.close();
      process.exit(1);
    }

    console.log('Đang tìm kiếm ô tải lên video (input[type="file"])...');
    
    // Tìm input file trên trang chính hoặc trong các iframe
    let targetFrame = page;
    let fileInput = page.locator('input[type="file"]');
    
    try {
      await fileInput.waitFor({ state: 'attached', timeout: 15000 });
    } catch (e) {
      // Thử tìm trong các iframe nếu không thấy ở trang chính
      const frames = page.frames();
      for (const frame of frames) {
        const frameInput = frame.locator('input[type="file"]');
        if (await frameInput.count() > 0) {
          fileInput = frameInput;
          targetFrame = frame;
          console.log(`Tìm thấy ô tải lên trong iframe: ${frame.url()}`);
          break;
        }
      }
    }

    if (await fileInput.count() === 0) {
      throw new Error('Không tìm thấy ô tải lên video (input[type="file"]) trên trang.');
    }

    console.log(`Đang tải file video lên: ${absoluteVideoPath}...`);
    await fileInput.setInputFiles(absoluteVideoPath);

    console.log('Đang chờ ô nhập Caption xuất hiện...');
    // TikTok sử dụng contenteditable div cho caption editor
    const captionInput = targetFrame.locator('div[contenteditable="true"], [role="textbox"], .public-DraftEditor-editor').first();
    await captionInput.waitFor({ state: 'visible', timeout: 30000 });

    console.log('Đang nhập caption và hashtag...');
    await captionInput.focus();
    
    // Xóa tiêu đề tự động lấy theo tên file của TikTok
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(500);
    
    // Gõ caption mới
    await page.keyboard.type(caption);
    await page.waitForTimeout(2000); // Chờ state React cập nhật

    console.log('Đang tìm kiếm nút Đăng (Post/Publish)...');
    const postButton = targetFrame.locator('button:has-text("Post"), button:has-text("Đăng"), button:has-text("Publish")').first();
    await postButton.waitFor({ state: 'visible', timeout: 30000 });

    console.log('Đang chờ quá trình tải lên video hoàn tất...');
    let isBtnDisabled = true;
    const startTime = Date.now();
    const uploadTimeout = 300000; // 5 phút (300 giây)

    while (isBtnDisabled) {
      if (Date.now() - startTime > uploadTimeout) {
        throw new Error('Hết thời gian chờ: Tải video lên quá lâu hoặc nút Đăng không hoạt động.');
      }

      const disabledAttr = await postButton.getAttribute('disabled');
      const classAttr = await postButton.getAttribute('class') || '';

      if (disabledAttr === null && !classAttr.includes('disabled') && !classAttr.includes('deactive')) {
        isBtnDisabled = false;
      } else {
        // Cố gắng hiển thị phần trăm nếu tìm thấy
        try {
          const progressLocator = targetFrame.locator('span:has-text("%"), div:has-text("%")').first();
          if (await progressLocator.isVisible()) {
            const text = await progressLocator.innerText();
            console.log(`Tiến trình: ${text.trim()}`);
          }
        } catch (err) {}
        await page.waitForTimeout(3000);
      }
    }

    console.log('Video đã tải lên 100%. Đang tiến hành click nút ĐĂNG...');
    await postButton.click();

    console.log('Đã click nút Đăng. Đang chờ xác nhận hoàn thành (15 giây)...');
    await page.waitForTimeout(15000);

    // Chụp ảnh màn hình kết quả để lưu log
    const resultScreenshot = 'upload_result.png';
    await page.screenshot({ path: resultScreenshot });
    console.log(`Đã chụp màn hình kết quả tại: ${path.resolve(resultScreenshot)}`);

    console.log('Hoàn thành quá trình đăng video lên TikTok!');

  } catch (error) {
    console.error('Đã xảy ra lỗi trong quá trình tự động đăng bài:', error);
    // Chụp ảnh màn hình lỗi để debug
    try {
      const errorScreenshot = 'error_screenshot.png';
      await page.screenshot({ path: errorScreenshot });
      console.log(`Đã chụp màn hình lỗi tại: ${path.resolve(errorScreenshot)}`);
    } catch (e) {
      console.error('Không thể chụp ảnh màn hình lỗi:', e);
    }
  } finally {
    await browser.close();
  }
}

run();
