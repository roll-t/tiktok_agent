import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { readDb, writeDb, getSessionsDir, getUploadsDir } from './db.js';

/**
 * Mở trình duyệt giả lập để người dùng đăng nhập tài khoản TikTok.
 * Đợi người dùng đăng nhập thành công (phát hiện cookie sessionid) rồi lưu phiên làm việc.
 * @param {string} accountId - ID của tài khoản tự sinh
 * @returns {Promise<{username: string, status: string}>}
 */
export async function loginAccount(accountId) {
  const browser = await chromium.launch({
    headless: false, // Phải mở trình duyệt để người dùng thao tác đăng nhập
    args: ['--start-maximized']
  });

  const sessionPath = path.join(getSessionsDir(), `${accountId}.json`);
  const context = await browser.newContext({
    viewport: null,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh'
  });

  const page = await context.newPage();
  console.log(`[Login ${accountId}] Đang chuyển hướng đến trang đăng nhập TikTok...`);
  await page.goto('https://www.tiktok.com/login', { waitUntil: 'domcontentloaded' });

  let username = 'tiktok_user';
  let isLoggedIn = false;

  // Chờ tối đa 5 phút để đăng nhập thành công
  const timeoutMs = 300000;
  const startTime = Date.now();

  try {
    while (Date.now() - startTime < timeoutMs) {
      if (page.isClosed()) {
        console.log(`[Login ${accountId}] Trình duyệt đã bị đóng trước khi đăng nhập.`);
        break;
      }

      // Kiểm tra xem cookie sessionid đã xuất hiện chưa
      const cookies = await context.cookies();
      const sessionCookie = cookies.find(c => c.name === 'sessionid');

      if (sessionCookie) {
        console.log(`[Login ${accountId}] Đã phát hiện cookie sessionid! Đang lấy username...`);
        isLoggedIn = true;

        // Chờ trang tải hoàn tất sau đăng nhập
        await page.waitForTimeout(4000);

        // Tìm username từ đường dẫn link profile dạng /@username
        try {
          const profileLink = page.locator('a[href*="/@"]').first();
          const href = await profileLink.getAttribute('href');
          if (href) {
            const match = href.match(/@([a-zA-Z0-9_\.-]+)/);
            if (match) {
              username = match[1];
            }
          }
        } catch (err) {
          console.log(`[Login ${accountId}] Không lấy được username từ link profile, sử dụng mặc định.`);
        }

        // Lưu thông tin phiên đăng nhập
        await context.storageState({ path: sessionPath });
        console.log(`[Login ${accountId}] Đã lưu session vào: ${sessionPath}`);
        break;
      }

      await page.waitForTimeout(2000); // Check mỗi 2 giây
    }

    if (!isLoggedIn) {
      throw new Error('Đăng nhập thất bại hoặc hết hạn thời gian chờ.');
    }

    return { username, status: 'active' };
  } finally {
    try {
      await browser.close();
    } catch (e) {}
  }
}

/**
 * Đăng video lên TikTok sử dụng session đã lưu.
 * @param {object} post - Đối tượng post từ DB
 * @param {string} sessionFile - Tên file session (ví dụ: acc_1.json)
 */
export async function uploadVideo(post, sessionFile) {
  const sessionPath = path.join(getSessionsDir(), sessionFile);
  const absoluteVideoPath = path.join(getUploadsDir(), post.videoFilename);

  if (!fs.existsSync(sessionPath)) {
    throw new Error(`Không tìm thấy file session đăng nhập: ${sessionPath}`);
  }
  if (!fs.existsSync(absoluteVideoPath)) {
    throw new Error(`Không tìm thấy file video: ${absoluteVideoPath}`);
  }

  console.log(`[Upload Post ${post.id}] Khởi chạy trình duyệt đăng video...`);
  const browser = await chromium.launch({
    headless: true, // Chạy ngầm khi sản xuất
    args: ['--start-maximized']
  });

  const context = await browser.newContext({
    storageState: sessionPath,
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh'
  });

  const page = await context.newPage();

  try {
    console.log(`[Upload Post ${post.id}] Đang truy cập trang tải lên...`);
    await page.goto('https://www.tiktok.com/tiktokstudio/upload', { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    });

    await page.waitForTimeout(3000);
    if (page.url().includes('/login')) {
      throw new Error('Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại tài khoản này.');
    }

    // Tìm input tải lên
    let targetFrame = page;
    let fileInput = page.locator('input[type="file"]');
    
    try {
      await fileInput.waitFor({ state: 'attached', timeout: 15000 });
    } catch (e) {
      // Tìm trong iframe
      const frames = page.frames();
      for (const frame of frames) {
        const frameInput = frame.locator('input[type="file"]');
        if (await frameInput.count() > 0) {
          fileInput = frameInput;
          targetFrame = frame;
          break;
        }
      }
    }

    if (await fileInput.count() === 0) {
      throw new Error('Không tìm thấy ô tải lên video.');
    }

    console.log(`[Upload Post ${post.id}] Đang tải file video...`);
    await fileInput.setInputFiles(absoluteVideoPath);

    console.log(`[Upload Post ${post.id}] Đang chờ ô nhập Caption...`);
    const captionInput = targetFrame.locator('div[contenteditable="true"], [role="textbox"], .public-DraftEditor-editor').first();
    await captionInput.waitFor({ state: 'visible', timeout: 30000 });

    console.log(`[Upload Post ${post.id}] Điền caption: ${post.caption}`);
    await captionInput.focus();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(500);
    await page.keyboard.type(post.caption);
    await page.waitForTimeout(2000);

    const postButton = targetFrame.locator('button:has-text("Post"), button:has-text("Đăng"), button:has-text("Publish")').first();
    await postButton.waitFor({ state: 'visible', timeout: 30000 });

    console.log(`[Upload Post ${post.id}] Chờ video tải lên hoàn tất...`);
    let isBtnDisabled = true;
    const startTime = Date.now();
    const uploadTimeout = 300000; // 5 phút

    while (isBtnDisabled) {
      if (Date.now() - startTime > uploadTimeout) {
        throw new Error('Tải video lên quá lâu hoặc nút Đăng không hoạt động.');
      }

      const disabledAttr = await postButton.getAttribute('disabled');
      const classAttr = await postButton.getAttribute('class') || '';

      if (disabledAttr === null && !classAttr.includes('disabled') && !classAttr.includes('deactive')) {
        isBtnDisabled = false;
      } else {
        await page.waitForTimeout(3000);
      }
    }

    console.log(`[Upload Post ${post.id}] Tiến hành nhấn nút ĐĂNG...`);
    await postButton.click();
    await page.waitForTimeout(15000);

    // Chụp ảnh màn hình lưu lịch sử thành công
    const resultScreenshotDir = path.join(getSessionsDir(), '../screenshots');
    if (!fs.existsSync(resultScreenshotDir)) {
      fs.mkdirSync(resultScreenshotDir, { recursive: true });
    }
    const screenshotPath = path.join(resultScreenshotDir, `${post.id}_success.png`);
    await page.screenshot({ path: screenshotPath });
    console.log(`[Upload Post ${post.id}] Hoàn tất đăng bài! Đã lưu screenshot.`);

  } finally {
    await browser.close();
  }
}

/**
 * Hàm khởi chạy ngầm việc tải lên và cập nhật trạng thái trong database
 */
export async function runUploadInBackground(postId) {
  const db = readDb();
  const post = db.posts.find(p => p.id === postId);
  if (!post) return;

  const account = db.accounts.find(a => a.id === post.accountId);
  if (!account) {
    post.status = 'failed';
    post.error = 'Không tìm thấy tài khoản để đăng bài.';
    writeDb(db);
    return;
  }

  try {
    post.status = 'processing';
    post.error = null;
    writeDb(db);

    await uploadVideo(post, `${account.id}.json`);

    // Reload db để tránh ghi đè các thay đổi khác xảy ra song song
    const currentDb = readDb();
    const activePost = currentDb.posts.find(p => p.id === postId);
    if (activePost) {
      activePost.status = 'success';
      activePost.postedAt = new Date().toISOString();
      activePost.error = null;
      writeDb(currentDb);
    }
  } catch (error) {
    console.error(`[Background Upload Error] Post ${postId}:`, error);
    const currentDb = readDb();
    const activePost = currentDb.posts.find(p => p.id === postId);
    if (activePost) {
      activePost.status = 'failed';
      activePost.error = error.message || 'Lỗi không xác định.';
      writeDb(currentDb);
    }
  }
}
