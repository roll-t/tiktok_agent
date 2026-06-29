import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { readDb, writeDb, getSessionsDir, getUploadsDir } from './db.js';

// Cấu hình vị trí và kích thước trình duyệt dạng grid để người dùng theo dõi và đăng nhập nhiều tab cùng lúc
global.browserLaunchCount = global.browserLaunchCount || 0;
function getGridBrowserArgs(extraArgs = []) {
  const index = global.browserLaunchCount++;
  const colIndex = index % 4; // 4 cột cho xếp gọn hơn
  const rowIndex = Math.floor((index % 8) / 4); // 2 hàng
  const width = 640;
  const height = 520;
  const x = 30 + colIndex * 200; // Khoảng cách trượt ngang so le
  const y = 30 + rowIndex * 150; // Khoảng cách trượt dọc so le
  return [
    '--disable-blink-features=AutomationControlled',
    `--window-size=${width},${height}`,
    `--window-position=${x},${y}`,
    '--force-device-scale-factor=0.65', // Thu nhỏ 65% để trang web vừa vặn trong màn hình nhỏ
    ...extraArgs
  ];
}

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
      args: getGridBrowserArgs(['--inprivate'])
    });
  } catch (errEdge) {
    try {
      console.log('[Login] Không mở được Edge, đang thử khởi chạy Google Chrome...');
      browser = await chromium.launch({
        headless: false,
        channel: 'chrome', // Sử dụng Google Chrome cài đặt trên máy
        ignoreDefaultArgs: ['--enable-automation'],
        args: getGridBrowserArgs(['--incognito'])
      });
    } catch (errChrome) {
      console.log('[Login] Không thể mở Chrome/Edge, đang thử dùng Chromium mặc định...');
      browser = await chromium.launch({
        headless: false,
        ignoreDefaultArgs: ['--enable-automation'],
        args: getGridBrowserArgs(['--incognito'])
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
export async function loginYoutubeAccount(accountId, email = '', password = '') {
  let browser;
  try {
    console.log('[Login YouTube] Đang khởi chạy trình duyệt Microsoft Edge...');
    browser = await chromium.launch({
      headless: false,
      channel: 'msedge',
      ignoreDefaultArgs: ['--enable-automation'],
      args: getGridBrowserArgs(['--inprivate'])
    });
  } catch (errEdge) {
    try {
      console.log('[Login YouTube] Không mở được Edge, đang thử khởi chạy Google Chrome...');
      browser = await chromium.launch({
        headless: false,
        channel: 'chrome',
        ignoreDefaultArgs: ['--enable-automation'],
        args: getGridBrowserArgs(['--incognito'])
      });
    } catch (errChrome) {
      console.log('[Login YouTube] Không thể mở Chrome/Edge, đang thử dùng Chromium mặc định...');
      browser = await chromium.launch({
        headless: false,
        ignoreDefaultArgs: ['--enable-automation'],
        args: getGridBrowserArgs(['--incognito'])
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
  let channelUrl = '';
  let isLoggedIn = false;

  // Chờ tối đa 5 phút để đăng nhập thành công
  const timeoutMs = 300000;
  const startTime = Date.now();

  let filledEmail = false;
  let filledPassword = false;

  try {
    while (Date.now() - startTime < timeoutMs) {
      if (page.isClosed()) {
        console.log(`[Login YouTube ${accountId}] Trình duyệt đã bị đóng trước khi đăng nhập.`);
        break;
      }

      try {
        const url = page.url();

        // Tự động điền email và mật khẩu nếu được cung cấp
        if (url.includes('accounts.google.com')) {
          if (email && !filledEmail) {
            try {
              const emailInput = await page.$('input[type="email"]');
              if (emailInput && await emailInput.isVisible()) {
                console.log(`[Login YouTube ${accountId}] Phát hiện ô nhập Email Google. Tự động điền email...`);
                await emailInput.fill(email);
                filledEmail = true;

                // Tự động click Next sau khi điền email
                const nextBtn = await page.$('#identifierNext');
                if (nextBtn) {
                  await nextBtn.click();
                }
              }
            } catch (e) {
              console.log(`[Login YouTube ${accountId}] Không điền được email tự động: ${e.message}`);
            }
          }

          if (password && !filledPassword) {
            try {
              const passwordInput = await page.$('input[type="password"]');
              if (passwordInput && await passwordInput.isVisible()) {
                console.log(`[Login YouTube ${accountId}] Phát hiện ô nhập Mật khẩu Google. Tự động điền mật khẩu...`);
                await passwordInput.fill(password);
                filledPassword = true;

                // Tự động click Next sau khi điền mật khẩu
                const nextBtn = await page.$('#passwordNext');
                if (nextBtn) {
                  await nextBtn.click();
                }
              }
            } catch (e) {
              console.log(`[Login YouTube ${accountId}] Không điền được mật khẩu tự động: ${e.message}`);
            }
          }
        }

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

            try {
              // Tìm link kênh công khai
              const channelLinkLoc = page.locator('a[href*="youtube.com/channel/"], a[href*="youtube.com/@"]').first();
              const href = await channelLinkLoc.getAttribute('href');
              if (href) {
                channelUrl = href;
              }
            } catch (errUrl) {
              console.log(`[Login YouTube ${accountId}] Không lấy được link kênh:`, errUrl.message);
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

    return { username, status: 'active', channelUrl };
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
    console.log(`[Upload Post ${post.id}] Không tìm thấy file session đăng nhập TikTok. Tự động kích hoạt trình duyệt để bạn đăng nhập...`);
    try {
      await loginAccount(post.accountId);
    } catch (loginErr) {
      throw new Error(`Đăng nhập TikTok thất bại: ${loginErr.message}`);
    }

    if (!fs.existsSync(sessionPath)) {
      throw new Error(`Không tìm thấy file session đăng nhập TikTok sau khi đăng nhập thủ công.`);
    }
    console.log(`[Upload Post ${post.id}] Đăng nhập TikTok thành công! Tiếp tục tiến trình đăng video...`);
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
  const db = await readDb();
  const post = db.posts.find(p => p.id === postId);
  if (!post) return;

  const account = db.accounts.find(a => a.id === post.accountId);
  if (!account) {
    post.status = 'failed';
    post.error = 'Không tìm thấy tài khoản để đăng bài.';
    await writeDb(db);
    return;
  }

  // Kiểm tra xem tài khoản có đang bị giới hạn đăng tải hằng ngày của YouTube không
  if (account.uploadLimitReachedAt) {
    const reachedTime = new Date(account.uploadLimitReachedAt).getTime();
    const diffMs = Date.now() - reachedTime;
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours < 24) {
      const hoursLeft = Math.ceil(24 - diffHours);
      post.status = 'failed';
      post.error = `Kênh này đang bị giới hạn tải lên hằng ngày từ YouTube. Vui lòng đợi thêm ${hoursLeft} giờ để tiếp tục đăng.`;
      await writeDb(db);
      console.log(`[Background Upload Skipped] Post ${postId} bị hủy đăng vì kênh ${post.accountId} đang bị giới hạn đăng tải.`);
      return;
    }
  }

  try {
    post.status = 'processing';
    post.error = null;
    await writeDb(db);

    let videoUrl = '';
    if (account.videoType === 'tiktok') {
      if (account.type === 'adspower') {
        videoUrl = await uploadVideoAdsPower(post, account.profileId);
      } else {
        videoUrl = await uploadVideo(post, `${account.id}.json`);
      }
    } else {
      // Mặc định hoặc YouTube Shorts
      if (account.type === 'adspower') {
        videoUrl = await uploadVideoYoutubeAdsPower(post, account.profileId);
      } else {
        videoUrl = await uploadVideoYoutube(post, `${account.id}.json`);
      }
    }

    // Reload db để tránh ghi đè các thay đổi khác xảy ra song song
    const currentDb = await readDb();
    const activePost = currentDb.posts.find(p => p.id === postId);
    if (activePost) {
      activePost.status = 'success';
      activePost.postedAt = new Date().toISOString();
      activePost.error = null;
      if (videoUrl) activePost.videoUrl = videoUrl;
      await writeDb(currentDb);
    }
  } catch (error) {
    console.error(`[Background Upload Error] Post ${postId}:`, error);
    const currentDb = await readDb();
    const activePost = currentDb.posts.find(p => p.id === postId);
    if (activePost) {
      activePost.status = 'failed';
      activePost.error = error.message || 'Lỗi không xác định.';
      await writeDb(currentDb);
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
/**
 * Upload YouTube Shorts: chạy qua url /upload và đánh dấu là Shorts ngắn.
 * Shorts không cần đặt thumbnail thủ công vì YouTube tự xử lý.
 */
async function automateYoutubeUpload(page, post) {
  try {
    return await automateYoutubeUploadInner(page, post);
  } catch (err) {
    // Nếu xảy ra bất kỳ lỗi nào, kiểm tra xem có phải do dính Daily Limit hay không
    try {
      const limitReached = await page.evaluate(() => {
        function getDeepText(node) {
          if (!node) return "";
          if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || "";
          let text = "";
          if (node.shadowRoot) {
            for (const child of node.shadowRoot.childNodes) {
              text += getDeepText(child) + " ";
            }
          }
          if (node.childNodes) {
            for (const child of node.childNodes) {
              text += getDeepText(child) + " ";
            }
          }
          return text;
        }
        const allText = getDeepText(document.body);
        const terms = [
          'Daily upload limit reached',
          'Daily upload limit',
          'Upload more videos daily',
          'giới hạn số lượng tải lên',
          'giới hạn tải lên'
        ];
        return terms.some(term => allText.toLowerCase().includes(term.toLowerCase()));
      });

      if (limitReached) {
        const db = await readDb();
        const acc = db.accounts.find(a => a.id === post.accountId);
        if (acc) {
          acc.uploadLimitReachedAt = new Date().toISOString();
          await writeDb(db);
          console.log(`[YouTube Upload ${post.id}] Lỗi xảy ra do dính Daily Limit. Đã khóa tài khoản.`);
        }
        throw new Error('Tài khoản đã đạt giới hạn đăng tải trong ngày của YouTube (Daily upload limit reached). Vui lòng xác minh kênh bằng số điện thoại hoặc đợi 24 giờ để tiếp tục đăng bài.');
      }
    } catch (checkErr) {
      console.error('Lỗi khi kiểm tra Daily Limit phụ:', checkErr.message);
      if (checkErr.message.includes('Daily upload limit')) {
        throw checkErr;
      }
    }
    throw err;
  }
}

async function automateYoutubeUploadInner(page, post) {
  const absoluteVideoPath = path.join(getUploadsDir(), post.videoFilename);
  if (!fs.existsSync(absoluteVideoPath)) {
    throw new Error(`Không tìm thấy file video: ${absoluteVideoPath}`);
  }

  const isShorts = (post.videoType || 'shorts') === 'shorts';
  console.log(`[YouTube Upload ${post.id}] Loại: ${isShorts ? 'Shorts' : 'Video thường'}. Đang truy cập YouTube Upload...`);

  await page.goto('https://youtube.com/upload', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  await page.waitForTimeout(4000);

  let currentUrl = page.url();
  if (currentUrl.includes('accounts.google.com') || currentUrl.includes('signin') || currentUrl.includes('/login')) {
    console.log(`[YouTube Upload ${post.id}] Phiên đăng nhập hết hạn hoặc chưa đăng nhập. Đang đợi người dùng đăng nhập thủ công trên trình duyệt...`);
    
    // Chờ tối đa 5 phút để đăng nhập thành công
    const timeoutMs = 300000;
    const startTime = Date.now();
    let isLoggedIn = false;

    while (Date.now() - startTime < timeoutMs) {
      if (page.isClosed()) {
        break;
      }
      
      const url = page.url();
      if (url.includes('studio.youtube.com') && !url.includes('accounts.google.com') && !url.includes('signin')) {
        isLoggedIn = true;
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (!isLoggedIn) {
      throw new Error('Tài khoản Google/YouTube chưa đăng nhập hoặc hết hạn phiên. Vui lòng đăng nhập lại.');
    }

    // Lưu lại session mới để không cần đăng nhập lại lần sau
    try {
      const sessionPath = path.join(getSessionsDir(), `${post.accountId}.json`);
      await page.context().storageState({ path: sessionPath });
      console.log(`[YouTube Upload ${post.id}] Đã cập nhật và lưu session mới vào: ${sessionPath}`);
    } catch (errSave) {
      console.error(`[YouTube Upload ${post.id}] Không lưu được session mới:`, errSave.message);
    }

    console.log(`[YouTube Upload ${post.id}] Đăng nhập thành công! Đang chuyển hướng lại trang tải video...`);
    await page.goto('https://youtube.com/upload', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    await page.waitForTimeout(4000);
  }

  console.log(`[YouTube Upload ${post.id}] Đang tìm ô tải file video...`);
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.waitFor({ state: 'attached', timeout: 30000 });
  await fileInput.setInputFiles(absoluteVideoPath);

  console.log(`[YouTube Upload ${post.id}] Đã tải file video lên. Chờ 8 giây để kiểm tra giới hạn đăng tải...`);
  await page.waitForTimeout(8000);

  // Quét chữ toàn trang xuyên qua Shadow DOM đệ quy
  const limitReached = await page.evaluate(() => {
    function getDeepText(node) {
      if (!node) return "";
      if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || "";
      let text = "";
      if (node.shadowRoot) {
        for (const child of node.shadowRoot.childNodes) {
          text += getDeepText(child) + " ";
        }
      }
      if (node.childNodes) {
        for (const child of node.childNodes) {
          text += getDeepText(child) + " ";
        }
      }
      return text;
    }
    const allText = getDeepText(document.body);
    const terms = [
      'Daily upload limit reached',
      'Daily upload limit',
      'Upload more videos daily',
      'giới hạn số lượng tải lên',
      'giới hạn tải lên'
    ];
    return terms.some(term => allText.toLowerCase().includes(term.toLowerCase()));
  });

  if (limitReached) {
    // Cập nhật trạng thái giới hạn tải lên cho tài khoản trong DB
    try {
      const db = await readDb();
      const acc = db.accounts.find(a => a.id === post.accountId);
      if (acc) {
        acc.uploadLimitReachedAt = new Date().toISOString();
        await writeDb(db);
        console.log(`[YouTube Upload ${post.id}] Đã ghi nhận tài khoản ${post.accountId} đạt giới hạn upload.`);
      }
    } catch (dbErr) {
      console.error('Lỗi khi ghi nhận giới hạn tài khoản:', dbErr);
    }
    throw new Error('Tài khoản đã đạt giới hạn đăng tải trong ngày của YouTube (Daily upload limit reached). Vui lòng xác minh kênh bằng số điện thoại hoặc đợi 24 giờ để tiếp tục đăng bài.');
  }

  console.log(`[YouTube Upload ${post.id}] Không phát hiện giới hạn tải lên, đang đợi giao diện nhập chi tiết...`);
  const titleInput = page.locator('#title-textarea #textbox, ytcp-social-suggestions-textbox div[contenteditable="true"]').first();
  await titleInput.waitFor({ state: 'visible', timeout: 45000 });

  // Điền tiêu đề (YouTube giới hạn tối đa 100 kí tự)
  const cleanTitle = post.caption.length > 100 ? post.caption.slice(0, 97) + '...' : post.caption;
  console.log(`[YouTube Upload ${post.id}] Điền tiêu đề: ${cleanTitle}`);

  // Xóa sạch text tự điền của YouTube (tên file) - hỗ trợ cả macOS (Cmd+A) và Windows (Ctrl+A)
  // Bước 1: Triple-click để chọn toàn bộ text
  await titleInput.click({ clickCount: 3 });
  await page.waitForTimeout(400);

  // Bước 2: Cmd+A (macOS) để chọn tất cả
  await page.keyboard.press('Meta+A');
  await page.waitForTimeout(200);
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(300);

  // Bước 3: Ctrl+A (Windows/Linux) phòng ngừa
  await titleInput.click({ clickCount: 3 });
  await page.waitForTimeout(300);
  await page.keyboard.press('Control+A');
  await page.waitForTimeout(200);
  await page.keyboard.press('Delete');
  await page.waitForTimeout(300);

  // Bước 4: Dùng End + Shift+Home để select rồi xóa - phương án dự phòng cuối
  await titleInput.click();
  await page.keyboard.press('End');
  await page.waitForTimeout(100);
  await page.keyboard.down('Shift');
  await page.keyboard.press('Home');
  await page.keyboard.up('Shift');
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(400);

  // Gõ caption mới, delay từng ký tự để tránh lỗi racing với framework YouTube
  await titleInput.click();
  await page.waitForTimeout(300);
  await page.keyboard.type(cleanTitle, { delay: 50 });
  await page.waitForTimeout(1000);


  // Chọn "Không dành cho trẻ em"
  console.log(`[YouTube Upload ${post.id}] Chọn 'Không dành cho trẻ em'...`);
  const notMadeForKidsRadio = page.locator('ytcp-radio-button[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"], [name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]').first();
  await notMadeForKidsRadio.scrollIntoViewIfNeeded();
  await notMadeForKidsRadio.click();
  await page.waitForTimeout(1000);

  // Đặt thumbnail cho video thường (không làm với Shorts)
  if (!isShorts && post.thumbnailFilename) {
    const absoluteThumbPath = path.join(getUploadsDir(), post.thumbnailFilename);
    if (fs.existsSync(absoluteThumbPath)) {
      console.log(`[YouTube Upload ${post.id}] Đặt thumbnail: ${post.thumbnailFilename}`);
      try {
        // Nhấn vào nút Upload thumbnail
        const uploadThumbBtn = page.locator('ytcp-thumbnails-compact-editor-uploader, #thumbnails-editor button').first();
        await uploadThumbBtn.scrollIntoViewIfNeeded();
        await uploadThumbBtn.click();
        await page.waitForTimeout(1000);
        // Tìm input file ẩn của thumbnail
        const thumbInput = page.locator('input[type="file"][accept*="image"]').last();
        await thumbInput.setInputFiles(absoluteThumbPath);
        await page.waitForTimeout(2000);
        console.log(`[YouTube Upload ${post.id}] Đã đặt thumbnail thành công.`);
      } catch (thumbErr) {
        console.log(`[YouTube Upload ${post.id}] Không đặt được thumbnail (tiếp tục): ${thumbErr.message}`);
      }
    }
  }

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
  await page.waitForTimeout(8000);

  // Lấy URL video từ dialog thành công của YouTube Studio
  let videoUrl = null;
  try {
    // YouTube Studio hiển thị link video dạng youtu.be/xxx trong dialog sau khi publish
    const linkLocators = [
      page.locator('a[href*="youtu.be"]').first(),
      page.locator('a[href*="youtube.com/shorts"]').first(),
      page.locator('a[href*="youtube.com/watch"]').first(),
      page.locator('ytcp-video-share-dialog a, ytcp-post-publish-panel a').first(),
    ];

    for (const loc of linkLocators) {
      try {
        const href = await loc.getAttribute('href', { timeout: 3000 });
        if (href && (href.includes('youtu.be') || href.includes('youtube.com'))) {
          videoUrl = href.startsWith('http') ? href : `https:${href}`;
          console.log(`[YouTube Upload ${post.id}] Đã lấy được URL video: ${videoUrl}`);
          break;
        }
      } catch (_) { }
    }

    // Fallback: tìm tất cả anchor tags trên trang
    if (!videoUrl) {
      const allLinks = await page.locator('a').all();
      for (const link of allLinks) {
        try {
          const href = await link.getAttribute('href', { timeout: 1000 });
          if (href && (href.includes('youtu.be/') || href.includes('/shorts/') || href.includes('watch?v='))) {
            videoUrl = href.startsWith('http') ? href : `https://youtube.com${href}`;
            console.log(`[YouTube Upload ${post.id}] Đã tìm thấy URL video (fallback): ${videoUrl}`);
            break;
          }
        } catch (_) { }
      }
    }
  } catch (urlErr) {
    console.log(`[YouTube Upload ${post.id}] Không lấy được URL video (tiếp tục): ${urlErr.message}`);
  }

  await page.waitForTimeout(5000);

  const resultScreenshotDir = path.join(getSessionsDir(), '../screenshots');
  if (!fs.existsSync(resultScreenshotDir)) {
    fs.mkdirSync(resultScreenshotDir, { recursive: true });
  }
  const screenshotPath = path.join(resultScreenshotDir, `${post.id}_youtube_success.png`);
  await page.screenshot({ path: screenshotPath });
  console.log(`[YouTube Upload ${post.id}] Hoàn tất! Đã lưu screenshot.`);

  return videoUrl;
}

/**
 * Đăng video lên YouTube Shorts sử dụng session đã lưu.
 * @param {object} post - Đối tượng post từ DB
 * @param {string} sessionFile - Tên file session (ví dụ: acc_1.json)
 */
export async function uploadVideoYoutube(post, sessionFile) {
  const sessionPath = path.join(getSessionsDir(), sessionFile);
  if (!fs.existsSync(sessionPath)) {
    console.log(`[YouTube Upload ${post.id}] Không tìm thấy file session đăng nhập cục bộ. Tự động kích hoạt trình duyệt để bạn đăng nhập...`);
    try {
      const db = await readDb();
      const account = db.accounts.find(a => a.id === post.accountId);
      const email = account ? (account.email || '') : '';
      const password = account ? (account.password || '') : '';

      // Gọi hàm đăng nhập và chờ người dùng đăng nhập thành công
      await loginYoutubeAccount(post.accountId, email, password);
    } catch (loginErr) {
      throw new Error(`Đăng nhập thất bại: ${loginErr.message}`);
    }

    // Kiểm tra lại xem file đã có chưa sau khi đăng nhập xong
    if (!fs.existsSync(sessionPath)) {
      throw new Error(`Không tìm thấy file session đăng nhập sau khi đăng nhập thủ công.`);
    }
    console.log(`[YouTube Upload ${post.id}] Đăng nhập thành công! Tiếp tục tiến trình đăng video...`);
  }

  let browser;
  try {
    console.log(`[YouTube Upload ${post.id}] Khởi chạy trình duyệt cục bộ với session...`);
    browser = await chromium.launch({
      headless: false,
      channel: 'msedge',
      ignoreDefaultArgs: ['--enable-automation'],
      args: getGridBrowserArgs(['--inprivate'])
    });
  } catch (errEdge) {
    try {
      browser = await chromium.launch({
        headless: false,
        channel: 'chrome',
        ignoreDefaultArgs: ['--enable-automation'],
        args: getGridBrowserArgs(['--incognito'])
      });
    } catch (errChrome) {
      browser = await chromium.launch({
        headless: false,
        ignoreDefaultArgs: ['--enable-automation'],
        args: getGridBrowserArgs(['--incognito'])
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
    const videoUrl = await automateYoutubeUpload(page, post);
    return videoUrl;
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

/**
 * Đồng bộ ảnh đại diện từ hệ thống lên YouTube Studio
 * @param {string} accountId 
 * @param {string} base64Image 
 */
export async function syncYoutubeAvatar(accountId, base64Image) {
  const matches = base64Image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    console.log(`[Avatar Sync] Ảnh đại diện không phải dạng base64 hợp lệ.`);
    return;
  }

  const imageBuffer = Buffer.from(matches[2], 'base64');
  const tempDir = path.join(getSessionsDir(), '../temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  const tempImagePath = path.join(tempDir, `avatar_${accountId}.jpg`);
  fs.writeFileSync(tempImagePath, imageBuffer);
  console.log(`[Avatar Sync] Đã lưu tệp ảnh tạm tại: ${tempImagePath}`);

  let browser;
  let account;
  try {
    const db = await readDb();
    account = db.accounts.find(a => a.id === accountId);
    if (!account) {
      console.log(`[Avatar Sync] Không tìm thấy tài khoản trong DB.`);
      return;
    }

    let isAdsPower = account.type === 'adspower';
    let context;

    if (isAdsPower) {
      const profileId = account.profileId;
      console.log(`[Avatar Sync AdsPower] Đang khởi chạy profile ${profileId}...`);
      let wsEndpoint = '';
      const hosts = ['127.0.0.1', 'localhost', 'local.adspower.net', 'local.adspower.com'];
      const ports = [50325, 50324];
      let apiSuccess = false;

      for (const port of ports) {
        for (const host of hosts) {
          try {
            const response = await fetch(`http://${host}:${port}/api/v1/browser/start?user_id=${profileId}`);
            const result = await response.json();
            if (result.code === 0 && result.data && result.data.ws && result.data.ws.puppeteer) {
              wsEndpoint = result.data.ws.puppeteer;
              apiSuccess = true;
              break;
            }
          } catch (err) { }
        }
        if (apiSuccess) break;
      }

      if (!apiSuccess || !wsEndpoint) {
        console.log(`[Avatar Sync] Không kết nối được AdsPower Local API.`);
        return;
      }

      browser = await chromium.connectOverCDP(wsEndpoint);
      context = browser.contexts()[0];
    } else {
      const sessionPath = path.join(getSessionsDir(), `${accountId}.json`);
      if (!fs.existsSync(sessionPath)) {
        console.log(`[Avatar Sync] Không tìm thấy file session đăng nhập cục bộ cho ${accountId}`);
        return;
      }

      console.log(`[Avatar Sync] Khởi chạy trình duyệt cục bộ...`);
      browser = await chromium.launch({
        headless: true,
        channel: 'msedge',
        ignoreDefaultArgs: ['--enable-automation'],
        args: [
          '--disable-blink-features=AutomationControlled',
          '--start-maximized',
          '--inprivate'
        ]
      });
      context = await browser.newContext({ storageState: sessionPath });
    }

    const page = await context.newPage();
    console.log(`[Avatar Sync] Đang mở trang Tùy chỉnh thương hiệu YouTube...`);
    await page.goto('https://studio.youtube.com/channel/editing/branding', { waitUntil: 'domcontentloaded', timeout: 60000 });

    if (page.url().includes('accounts.google.com')) {
      console.log(`[Avatar Sync] Không thể đồng bộ: Phiên đăng nhập Google đã hết hạn.`);
      return;
    }

    console.log(`[Avatar Sync] Tìm nút thay đổi/tải lên ảnh...`);

    // Tìm nút tải lên/thay đổi ảnh đầu tiên trên trang (ảnh hồ sơ)
    const uploadBtn = page.locator('ytcp-button:has-text("TẢI LÊN"), ytcp-button:has-text("THAY ĐỔI"), ytcp-button:has-text("UPLOAD"), ytcp-button:has-text("CHANGE"), #upload-button').first();
    await uploadBtn.waitFor({ state: 'visible', timeout: 30000 });

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 15000 }),
      uploadBtn.click()
    ]);

    await fileChooser.setFiles(tempImagePath);
    console.log(`[Avatar Sync] Đã đẩy tệp ảnh lên.`);

    // Chờ nút "XONG" / "DONE" trong Dialog Crop ảnh
    const doneBtn = page.locator('ytcp-button:has-text("XONG"), ytcp-button:has-text("DONE"), #done-button').first();
    await doneBtn.waitFor({ state: 'visible', timeout: 15000 });
    await doneBtn.click();
    console.log(`[Avatar Sync] Đã hoàn tất cắt ảnh.`);

    // Chờ nút "XUẤT BẢN" / "PUBLISH" ở góc trên bên phải
    const publishBtn = page.locator('ytcp-button:has-text("XUẤT BẢN"), ytcp-button:has-text("PUBLISH"), #publish-button').first();
    await publishBtn.waitFor({ state: 'visible', timeout: 15000 });
    await publishBtn.click();
    console.log(`[Avatar Sync] Đang xuất bản thay đổi lên YouTube...`);

    await page.waitForTimeout(5000);
    console.log(`[Avatar Sync] Đã lưu thành công ảnh đại diện lên YouTube!`);
  } catch (error) {
    console.error(`[Avatar Sync Error]:`, error);
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (e) { }
    }

    // Dừng profile AdsPower nếu cần
    if (account && account.type === 'adspower') {
      const profileId = account.profileId;
      const hosts = ['127.0.0.1', 'localhost', 'local.adspower.net', 'local.adspower.com'];
      const ports = [50325, 50324];
      let stopped = false;
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

    try {
      fs.unlinkSync(tempImagePath);
    } catch (e) { }
  }
}
