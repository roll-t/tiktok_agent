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
  let browser;
  try {
    console.log('[Login] Đang khởi chạy trình duyệt Microsoft Edge...');
    browser = await chromium.launch({
      headless: false, // Phải mở trình duyệt để người dùng thao tác đăng nhập
      channel: 'msedge', // Sử dụng Microsoft Edge cài đặt trên máy
      ignoreDefaultArgs: ['--enable-automation'],
      args: [
        '--disable-blink-features=AutomationControlled',
        '--start-maximized',
        '--inprivate'
      ]
    });
  } catch (errEdge) {
    try {
      console.log('[Login] Không mở được Edge, đang thử khởi chạy Google Chrome...');
      browser = await chromium.launch({
        headless: false,
        channel: 'chrome', // Sử dụng Google Chrome cài đặt trên máy
        ignoreDefaultArgs: ['--enable-automation'],
        args: [
          '--disable-blink-features=AutomationControlled',
          '--start-maximized',
          '--incognito'
        ]
      });
    } catch (errChrome) {
      console.log('[Login] Không thể mở Chrome/Edge, đang thử dùng Chromium mặc định...');
      browser = await chromium.launch({
        headless: false,
        ignoreDefaultArgs: ['--enable-automation'],
        args: [
          '--disable-blink-features=AutomationControlled',
          '--start-maximized',
          '--incognito'
        ]
      });
    }
  }

  const sessionPath = path.join(getSessionsDir(), `${accountId}.json`);
  const context = await browser.newContext({
    viewport: null,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh'
  });

  // Ẩn navigator.webdriver để Google không phát hiện trình duyệt tự động hóa
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined
    });
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

      try {
        // Kiểm tra xem cookie sessionid, sessionid_ss, sid_tt hoặc sid_guard đã xuất hiện chưa
        const cookies = await context.cookies();
        const sessionCookie = cookies.find(c =>
          c.name === 'sessionid' ||
          c.name === 'sessionid_ss' ||
          c.name === 'sid_tt' ||
          c.name === 'sid_guard'
        );

        if (sessionCookie) {
          console.log(`[Login ${accountId}] Đã phát hiện cookie phiên đăng nhập (${sessionCookie.name})! Đang lấy username...`);
          isLoggedIn = true;

          // Chờ trang tải hoàn tất sau đăng nhập (dùng setTimeout thuần của JS)
          await new Promise(resolve => setTimeout(resolve, 4000));

          if (!page.isClosed()) {
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
          }
          break;
        }
      } catch (errCookies) {
        if (page.isClosed() || errCookies.message.includes('closed')) {
          console.log(`[Login ${accountId}] Trình duyệt đã bị đóng trước khi đăng nhập.`);
          break;
        }
        throw errCookies;
      }

      // Thay thế page.waitForTimeout bằng setTimeout thuần để tránh lỗi khi người dùng đóng trang lúc đang chờ
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (!isLoggedIn) {
      throw new Error('Đăng nhập thất bại hoặc hết hạn thời gian chờ.');
    }

    return { username, status: 'active' };
  } finally {
    try {
      await browser.close();
    } catch (e) { }
  }
}

/**
 * Mở trình duyệt giả lập để người dùng đăng nhập tài khoản YouTube.
 * Đợi người dùng đăng nhập thành công (chuyển hướng vào studio.youtube.com) rồi lưu phiên làm việc.
 * @param {string} accountId - ID của tài khoản tự sinh
 * @returns {Promise<{username: string, status: string}>}
 */
export async function loginYoutubeAccount(accountId) {
  let browser;
  try {
    console.log('[Login YouTube] Đang khởi chạy trình duyệt Microsoft Edge...');
    browser = await chromium.launch({
      headless: false,
      channel: 'msedge',
      ignoreDefaultArgs: ['--enable-automation'],
      args: [
        '--disable-blink-features=AutomationControlled',
        '--start-maximized',
        '--inprivate'
      ]
    });
  } catch (errEdge) {
    try {
      console.log('[Login YouTube] Không mở được Edge, đang thử khởi chạy Google Chrome...');
      browser = await chromium.launch({
        headless: false,
        channel: 'chrome',
        ignoreDefaultArgs: ['--enable-automation'],
        args: [
          '--disable-blink-features=AutomationControlled',
          '--start-maximized',
          '--incognito'
        ]
      });
    } catch (errChrome) {
      console.log('[Login YouTube] Không thể mở Chrome/Edge, đang thử dùng Chromium mặc định...');
      browser = await chromium.launch({
        headless: false,
        ignoreDefaultArgs: ['--enable-automation'],
        args: [
          '--disable-blink-features=AutomationControlled',
          '--start-maximized',
          '--incognito'
        ]
      });
    }
  }

  const sessionPath = path.join(getSessionsDir(), `${accountId}.json`);
  const context = await browser.newContext({
    viewport: null,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh'
  });

  // Ẩn navigator.webdriver để Google không chặn
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined
    });
  });

  const page = await context.newPage();
  console.log(`[Login YouTube ${accountId}] Đang chuyển hướng đến YouTube Studio...`);
  await page.goto('https://studio.youtube.com', { waitUntil: 'domcontentloaded' });

  let username = 'youtube_channel';
  let isLoggedIn = false;

  // Chờ tối đa 5 phút để đăng nhập thành công
  const timeoutMs = 300000;
  const startTime = Date.now();

  try {
    while (Date.now() - startTime < timeoutMs) {
      if (page.isClosed()) {
        console.log(`[Login YouTube ${accountId}] Trình duyệt đã bị đóng trước khi đăng nhập.`);
        break;
      }

      try {
        const url = page.url();
        // Nếu đã chuyển hướng vào studio.youtube.com và không ở trang đăng nhập của Google
        if (url.includes('studio.youtube.com') && !url.includes('accounts.google.com') && !url.includes('signin')) {
          console.log(`[Login YouTube ${accountId}] Đã phát hiện đăng nhập thành công! Đang lấy tên kênh...`);
          isLoggedIn = true;

          // Chờ trang tải hoàn tất
          await new Promise(resolve => setTimeout(resolve, 5000));

          if (!page.isClosed()) {
            try {
              // Tìm tên kênh hiển thị trên YouTube Studio
              const channelTitleLoc = page.locator('#channel-title, .channel-title, ytcp-sidebar-header #channel-title').first();
              const text = await channelTitleLoc.innerText({ timeout: 5000 });
              if (text && text.trim()) {
                username = text.trim();
              }
            } catch (err) {
              console.log(`[Login YouTube ${accountId}] Không lấy được tên kênh, sử dụng tên mặc định:`, err.message);
            }

            // Lưu thông tin phiên đăng nhập
            await context.storageState({ path: sessionPath });
            console.log(`[Login YouTube ${accountId}] Đã lưu session vào: ${sessionPath}`);
          }
          break;
        }
      } catch (errLoop) {
        if (page.isClosed() || errLoop.message.includes('closed')) {
          console.log(`[Login YouTube ${accountId}] Trình duyệt đã bị đóng.`);
          break;
        }
        throw errLoop;
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (!isLoggedIn) {
      throw new Error('Đăng nhập YouTube thất bại hoặc hết hạn thời gian chờ.');
    }

    return { username, status: 'active' };
  } finally {
    try {
      await browser.close();
    } catch (e) { }
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
    ignoreDefaultArgs: ['--enable-automation'],
    args: [
      '--disable-blink-features=AutomationControlled',
      '--start-maximized',
      '--incognito'
    ]
  });

  const context = await browser.newContext({
    storageState: sessionPath,
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh'
  });

  // Ẩn navigator.webdriver
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined
    });
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

    const platform = account.platform || 'tiktok';

    if (platform === 'youtube') {
      if (account.type === 'adspower') {
        await uploadVideoYoutubeAdsPower(post, account.profileId);
      } else {
        await uploadVideoYoutube(post, `${account.id}.json`);
      }
    } else {
      if (account.type === 'adspower') {
        await uploadVideoAdsPower(post, account.profileId);
      } else {
        await uploadVideo(post, `${account.id}.json`);
      }
    }

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

/**
 * Tạo trực tiếp file session từ Cookie mà không mở trình duyệt
 * @param {string} accountId 
 * @param {string} cookieValue 
 */
export function createSessionWithCookie(accountId, cookieValue) {
  const sessionPath = path.join(getSessionsDir(), `${accountId}.json`);

  // Tạo cấu trúc storageState chứa cookie sessionid_ss và sessionid
  const sessionData = {
    cookies: [
      {
        name: 'sessionid_ss',
        value: cookieValue,
        domain: '.tiktok.com',
        path: '/',
        expires: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60, // 1 năm
        httpOnly: true,
        secure: true,
        sameSite: 'Lax'
      },
      {
        name: 'sessionid',
        value: cookieValue,
        domain: '.tiktok.com',
        path: '/',
        expires: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60, // 1 năm
        httpOnly: true,
        secure: true,
        sameSite: 'Lax'
      }
    ],
    origins: []
  };

  fs.writeFileSync(sessionPath, JSON.stringify(sessionData, null, 2), 'utf8');
  console.log(`[Cookie Session] Đã tạo file session trực tiếp cho ${accountId}`);
}

/**
 * Đăng video lên TikTok sử dụng profile AdsPower.
 * @param {object} post - Đối tượng post từ DB
 * @param {string} profileId - ID profile AdsPower
 */
export async function uploadVideoAdsPower(post, profileId) {
  const absoluteVideoPath = path.join(getUploadsDir(), post.videoFilename);
  if (!fs.existsSync(absoluteVideoPath)) {
    throw new Error(`Không tìm thấy file video: ${absoluteVideoPath}`);
  }

  console.log(`[AdsPower Upload Post ${post.id}] Đang yêu cầu khởi chạy profile ${profileId}...`);

  let wsEndpoint = '';
  const hosts = ['127.0.0.1', 'localhost', 'local.adspower.net', 'local.adspower.com'];
  const ports = [50325, 50324];
  let apiSuccess = false;
  let apiErrorMsg = '';

  for (const port of ports) {
    for (const host of hosts) {
      try {
        const response = await fetch(`http://${host}:${port}/api/v1/browser/start?user_id=${profileId}`);
        const result = await response.json();
        if (result.code === 0 && result.data && result.data.ws && result.data.ws.puppeteer) {
          wsEndpoint = result.data.ws.puppeteer;
          apiSuccess = true;
          break;
        } else if (result && (result.msg || result.code !== undefined)) {
          apiErrorMsg = result.msg || `Lỗi AdsPower API (code: ${result.code})`;
          break; // Đã kết nối thành công và có phản hồi lỗi rõ ràng, dừng tìm kiếm.
        }
      } catch (err) {
        // Thử cấu hình tiếp theo nếu lỗi kết nối
      }
    }
    if (apiSuccess || apiErrorMsg) break;
  }

  if (!apiSuccess || !wsEndpoint) {
    if (apiErrorMsg) {
      throw new Error(`AdsPower API trả về lỗi: "${apiErrorMsg}". Vui lòng kiểm tra lại Profile ID trong trang quản lý tài khoản.`);
    }
    throw new Error(`Không thể kết nối đến AdsPower local API. Hãy đảm bảo AdsPower đã mở và bật API (mặc định cổng 50325).`);
  }

  console.log(`[AdsPower Upload Post ${post.id}] Đã mở profile. Đang kết nối Playwright qua CDP...`);
  const browser = await chromium.connectOverCDP(wsEndpoint);

  try {
    const context = browser.contexts()[0];

    // Luôn tạo một trang (tab) mới sạch sẽ để tránh các tab khởi động mặc định của AdsPower bị tự động đóng gây lỗi
    const page = await context.newPage();

    // Đóng các tab cũ khác (như trang kiểm tra IP của AdsPower) để tránh phân tâm và giải phóng tài nguyên
    const existingPages = context.pages();
    for (const p of existingPages) {
      if (p !== page) {
        try {
          await p.close();
        } catch (e) { }
      }
    }

    // Thiết lập viewport kích thước desktop để tránh bị nhận diện nhầm là mobile
    try {
      await page.setViewportSize({ width: 1280, height: 800 });
    } catch (e) {
      console.log(`[AdsPower] Không thể set viewport: ${e.message}`);
    }

    console.log(`[AdsPower Upload Post ${post.id}] Đang truy cập trang tải lên TikTok Studio...`);
    await page.goto('https://www.tiktok.com/tiktokstudio/upload', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    await page.waitForTimeout(3000);

    const currentUrl = page.url();
    if (currentUrl.includes('onelink.me') || currentUrl.includes('tiktokstudio.onelink.me')) {
      throw new Error(`Trình duyệt đang bật chế độ giả lập điện thoại (Mobile Emulation), khiến TikTok chuyển hướng sang trang tải App Store. Vui lòng tắt chế độ điện thoại trên trình duyệt (nhấn Ctrl+Shift+M hoặc click vào biểu tượng điện thoại màu xanh dương trên thanh công cụ F12) rồi thử lại.`);
    }

    if (currentUrl.includes('/login')) {
      throw new Error(`Tài khoản TikTok trong Profile AdsPower ${profileId} chưa đăng nhập hoặc đã hết hạn session. Vui lòng mở profile này để đăng nhập trước.`);
    }

    let targetFrame = page;
    let fileInput = page.locator('input[type="file"]');

    try {
      await fileInput.waitFor({ state: 'attached', timeout: 15000 });
    } catch (e) {
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

    console.log(`[AdsPower Upload Post ${post.id}] Đang tải file video...`);
    await fileInput.setInputFiles(absoluteVideoPath);

    console.log(`[AdsPower Upload Post ${post.id}] Đang chờ ô nhập Caption...`);
    const captionInput = targetFrame.locator('div[contenteditable="true"], [role="textbox"], .public-DraftEditor-editor').first();
    await captionInput.waitFor({ state: 'visible', timeout: 30000 });

    console.log(`[AdsPower Upload Post ${post.id}] Điền caption: ${post.caption}`);
    await captionInput.focus();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(500);
    await page.keyboard.type(post.caption);
    await page.waitForTimeout(2000);

    const postButton = targetFrame.locator('button:has-text("Post"), button:has-text("Đăng"), button:has-text("Publish")').first();
    await postButton.waitFor({ state: 'visible', timeout: 30000 });

    console.log(`[AdsPower Upload Post ${post.id}] Chờ video tải lên hoàn tất...`);
    let isBtnDisabled = true;
    const startTime = Date.now();
    const uploadTimeout = 300000;

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

    console.log(`[AdsPower Upload Post ${post.id}] Tiến hành nhấn nút ĐĂNG...`);
    await postButton.click();
    await page.waitForTimeout(15000);

    const resultScreenshotDir = path.join(getSessionsDir(), '../screenshots');
    if (!fs.existsSync(resultScreenshotDir)) {
      fs.mkdirSync(resultScreenshotDir, { recursive: true });
    }
    const screenshotPath = path.join(resultScreenshotDir, `${post.id}_success.png`);
    await page.screenshot({ path: screenshotPath });
    console.log(`[AdsPower Upload Post ${post.id}] Hoàn tất đăng bài! Đã lưu screenshot.`);

  } finally {
    try {
      await browser.close();
    } catch (e) { }
    // Gọi API để tắt và đóng profile ẩn danh
    let stopped = false;
    const hosts = ['127.0.0.1', 'localhost', 'local.adspower.net', 'local.adspower.com'];
    const ports = [50325, 50324];
    for (const port of ports) {
      for (const host of hosts) {
        try {
          await fetch(`http://${host}:${port}/api/v1/browser/stop?user_id=${profileId}`);
          stopped = true;
          break;
        } catch (err) { }
      }
      if (stopped) break;
    }
  }
}

/**
 * Tự động hóa quá trình tải lên video lên YouTube Shorts.
 * @param {Page} page - Playwright Page object
 * @param {object} post - Đối tượng post từ DB
 */
async function automateYoutubeUpload(page, post) {
  const absoluteVideoPath = path.join(getUploadsDir(), post.videoFilename);
  if (!fs.existsSync(absoluteVideoPath)) {
    throw new Error(`Không tìm thấy file video: ${absoluteVideoPath}`);
  }

  console.log(`[YouTube Upload ${post.id}] Đang truy cập YouTube Upload...`);
  await page.goto('https://youtube.com/upload', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  await page.waitForTimeout(4000);

  const currentUrl = page.url();
  if (currentUrl.includes('accounts.google.com') || currentUrl.includes('signin') || currentUrl.includes('/login')) {
    throw new Error('Tài khoản Google/YouTube chưa đăng nhập hoặc hết hạn phiên. Vui lòng đăng nhập lại.');
  }

  console.log(`[YouTube Upload ${post.id}] Đang tìm ô tải file video...`);
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: 'attached', timeout: 30000 });
  await fileInput.setInputFiles(absoluteVideoPath);

  console.log(`[YouTube Upload ${post.id}] Đã tải file video lên. Chờ tải giao diện nhập chi tiết...`);
  const titleInput = page.locator('#title-textarea #textbox, ytcp-social-suggestions-textbox div[contenteditable="true"]').first();
  await titleInput.waitFor({ state: 'visible', timeout: 60000 });

  // Điền tiêu đề (YouTube giới hạn tối đa 100 kí tự)
  const cleanTitle = post.caption.length > 100 ? post.caption.slice(0, 97) + '...' : post.caption;
  console.log(`[YouTube Upload ${post.id}] Điền tiêu đề: ${cleanTitle}`);
  await titleInput.focus();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(500);
  await page.keyboard.type(cleanTitle);
  await page.waitForTimeout(1000);

  // Chọn "Không dành cho trẻ em"
  console.log(`[YouTube Upload ${post.id}] Chọn 'Không dành cho trẻ em'...`);
  const notMadeForKidsRadio = page.locator('ytcp-radio-button[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"], [name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]').first();
  await notMadeForKidsRadio.scrollIntoViewIfNeeded();
  await notMadeForKidsRadio.click();
  await page.waitForTimeout(1000);

  const nextBtn = page.locator('#next-button');

  // Bước 1 -> Bước 2: Video elements
  console.log(`[YouTube Upload ${post.id}] Chuyển tiếp sang Video Elements...`);
  await nextBtn.click();
  await page.waitForTimeout(2000);

  // Bước 2 -> Bước 3: Checks
  console.log(`[YouTube Upload ${post.id}] Chuyển tiếp sang Checks...`);
  await nextBtn.click();
  await page.waitForTimeout(2000);

  // Bước 3 -> Bước 4: Visibility
  console.log(`[YouTube Upload ${post.id}] Chuyển tiếp sang Visibility...`);
  await nextBtn.click();
  await page.waitForTimeout(2000);

  // Chọn chế độ Công khai (Public)
  console.log(`[YouTube Upload ${post.id}] Chọn chế độ Công khai (Public)...`);
  const publicRadio = page.locator('ytcp-radio-button[name="PUBLIC"], [name="PUBLIC"]').first();
  await publicRadio.scrollIntoViewIfNeeded();
  await publicRadio.click();
  await page.waitForTimeout(1000);

  // Nhấn nút Hoàn thành / Xuất bản
  console.log(`[YouTube Upload ${post.id}] Nhấn nút xuất bản (Done)...`);
  const doneBtn = page.locator('#done-button, [name="done-button"]').first();
  await doneBtn.waitFor({ state: 'visible', timeout: 15000 });
  await doneBtn.click();

  console.log(`[YouTube Upload ${post.id}] Chờ xác nhận xuất bản hoàn tất...`);
  await page.waitForTimeout(15000);

  const resultScreenshotDir = path.join(getSessionsDir(), '../screenshots');
  if (!fs.existsSync(resultScreenshotDir)) {
    fs.mkdirSync(resultScreenshotDir, { recursive: true });
  }
  const screenshotPath = path.join(resultScreenshotDir, `${post.id}_youtube_success.png`);
  await page.screenshot({ path: screenshotPath });
  console.log(`[YouTube Upload ${post.id}] Hoàn tất đăng tải lên YouTube Shorts! Đã lưu screenshot.`);
}

/**
 * Đăng video lên YouTube Shorts sử dụng session đã lưu.
 * @param {object} post - Đối tượng post từ DB
 * @param {string} sessionFile - Tên file session (ví dụ: acc_1.json)
 */
export async function uploadVideoYoutube(post, sessionFile) {
  const sessionPath = path.join(getSessionsDir(), sessionFile);
  if (!fs.existsSync(sessionPath)) {
    throw new Error(`Không tìm thấy file session đăng nhập: ${sessionPath}`);
  }

  let browser;
  try {
    console.log(`[YouTube Upload ${post.id}] Khởi chạy trình duyệt cục bộ với session...`);
    browser = await chromium.launch({
      headless: false,
      channel: 'msedge',
      ignoreDefaultArgs: ['--enable-automation'],
      args: [
        '--disable-blink-features=AutomationControlled',
        '--start-maximized',
        '--inprivate'
      ]
    });
  } catch (errEdge) {
    try {
      browser = await chromium.launch({
        headless: false,
        channel: 'chrome',
        ignoreDefaultArgs: ['--enable-automation'],
        args: [
          '--disable-blink-features=AutomationControlled',
          '--start-maximized',
          '--incognito'
        ]
      });
    } catch (errChrome) {
      browser = await chromium.launch({
        headless: false,
        ignoreDefaultArgs: ['--enable-automation'],
        args: [
          '--disable-blink-features=AutomationControlled',
          '--start-maximized',
          '--incognito'
        ]
      });
    }
  }

  try {
    const context = await browser.newContext({
      storageState: sessionPath,
      viewport: null,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      locale: 'vi-VN',
      timezoneId: 'Asia/Ho_Chi_Minh'
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined
      });
    });

    const page = await context.newPage();
    await automateYoutubeUpload(page, post);
  } finally {
    try {
      await browser.close();
    } catch (e) { }
  }
}

/**
 * Đăng video lên YouTube Shorts sử dụng profile AdsPower.
 * @param {object} post - Đối tượng post từ DB
 * @param {string} profileId - ID profile AdsPower
 */
export async function uploadVideoYoutubeAdsPower(post, profileId) {
  console.log(`[AdsPower YouTube Upload Post ${post.id}] Đang yêu cầu khởi chạy profile ${profileId}...`);

  let wsEndpoint = '';
  const hosts = ['127.0.0.1', 'localhost', 'local.adspower.net', 'local.adspower.com'];
  const ports = [50325, 50324];
  let apiSuccess = false;
  let apiErrorMsg = '';

  for (const port of ports) {
    for (const host of hosts) {
      try {
        const response = await fetch(`http://${host}:${port}/api/v1/browser/start?user_id=${profileId}`);
        const result = await response.json();
        if (result.code === 0 && result.data && result.data.ws && result.data.ws.puppeteer) {
          wsEndpoint = result.data.ws.puppeteer;
          apiSuccess = true;
          break;
        } else if (result && (result.msg || result.code !== undefined)) {
          apiErrorMsg = result.msg || `Lỗi AdsPower API (code: ${result.code})`;
          break;
        }
      } catch (err) {
        // Thử cấu hình tiếp
      }
    }
    if (apiSuccess || apiErrorMsg) break;
  }

  if (!apiSuccess || !wsEndpoint) {
    if (apiErrorMsg) {
      throw new Error(`AdsPower API trả về lỗi: "${apiErrorMsg}". Vui lòng kiểm tra lại Profile ID trong trang quản lý tài khoản.`);
    }
    throw new Error(`Không thể kết nối đến AdsPower local API. Hãy đảm bảo AdsPower đã mở và bật API (mặc định cổng 50325).`);
  }

  console.log(`[AdsPower YouTube Upload Post ${post.id}] Đã mở profile. Đang kết nối Playwright qua CDP...`);
  const browser = await chromium.connectOverCDP(wsEndpoint);

  try {
    const context = browser.contexts()[0];

    // Tạo tab mới sạch sẽ
    const page = await context.newPage();

    // Đóng các tab khác
    const existingPages = context.pages();
    for (const p of existingPages) {
      if (p !== page) {
        try {
          await p.close();
        } catch (e) { }
      }
    }

    // Set viewport
    try {
      await page.setViewportSize({ width: 1280, height: 800 });
    } catch (e) {
      console.log(`[AdsPower] Không thể set viewport: ${e.message}`);
    }

    await automateYoutubeUpload(page, post);
  } finally {
    try {
      await browser.close();
    } catch (e) { }

    // Dừng profile
    let stopped = false;
    const hosts = ['127.0.0.1', 'localhost', 'local.adspower.net', 'local.adspower.com'];
    const ports = [50325, 50324];
    for (const port of ports) {
      for (const host of hosts) {
        try {
          await fetch(`http://${host}:${port}/api/v1/browser/stop?user_id=${profileId}`);
          stopped = true;
          break;
        } catch (err) { }
      }
      if (stopped) break;
    }
  }
}
