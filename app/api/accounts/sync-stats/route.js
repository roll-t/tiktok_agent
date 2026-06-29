import { NextResponse } from 'next/server';
import { readDb, writeDb } from '@/lib/db.js';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';

import https from 'https';

// Helper tải HTML từ URL (hỗ trợ redirect tự động)
function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 10000
    };
    https.get(url, options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (!redirectUrl.startsWith('http')) {
          redirectUrl = new URL(redirectUrl, url).href;
        }
        return fetchHtml(redirectUrl).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP Status ${res.statusCode}`));
      }
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', err => reject(err));
  });
}

// Helper phân tích các chuỗi text như "19 videos" thành số nguyên
function parseCountText(text) {
  if (!text) return 0;
  const clean = text.toLowerCase().replace(/,/g, '');
  const match = clean.match(/(\d+(?:\.\d+)?)/);
  if (!match) return 0;
  let num = parseFloat(match[1]);
  if (clean.includes('million') || clean.includes(' tr ') || clean.includes('tr') || clean.includes('m')) {
    if (clean.includes('million') || clean.includes('tr') || /\b\d+(\.\d+)?m\b/.test(clean) || clean.endsWith('m')) {
      num = num * 1000000;
    }
  }
  if (clean.includes('thousand') || clean.includes(' n ') || clean.includes('n') || clean.includes('k')) {
    if (clean.includes('thousand') || clean.includes('n') || /\b\d+(\.\d+)?k\b/.test(clean) || clean.endsWith('k')) {
      num = num * 1000;
    }
  }
  if (clean.includes('billion') || clean.includes('tỷ')) {
    num = num * 1000000000;
  }
  return Math.round(num);
}

// Phương pháp quét nhanh bằng cách phân tích cú pháp HTML trang About
async function fetchChannelStatsHtml(url) {
  if (!url) return { subscribers: 0, views: 0, videoCount: 0 };
  let cleanUrl = url.trim();
  if (cleanUrl.endsWith('/')) {
    cleanUrl = cleanUrl.slice(0, -1);
  }
  const aboutUrl = cleanUrl + '/about';
  
  const html = await fetchHtml(aboutUrl);
  const subMatch = html.match(/"subscriberCountText"\s*:\s*"([^"]+)"/);
  const viewMatch = html.match(/"viewCountText"\s*:\s*"([^"]+)"/);
  const videoMatch = html.match(/"videoCountText"\s*:\s*"([^"]+)"/);
  
  return {
    subscribers: subMatch ? parseCountText(subMatch[1]) : 0,
    views: viewMatch ? parseCountText(viewMatch[1]) : 0,
    videoCount: videoMatch ? parseCountText(videoMatch[1]) : 0
  };
}

// Helper chạy lệnh yt-dlp lấy thông tin kênh
async function fetchChannelStatsYtdlp(ytdlpPath, url) {
  return new Promise((resolve) => {
    if (!url) {
      return resolve({ subscribers: 0, views: 0, videoCount: 0 });
    }
    const command = `"${ytdlpPath}" --flat-playlist --playlist-items 0 --dump-single-json "${url}"`;
    exec(command, { maxBuffer: 1024 * 1024 * 5 }, (err, stdout, stderr) => {
      if (err) {
        console.error(`[Sync Channel Stats] Lỗi lấy số liệu cho kênh ${url}:`, stderr || err.message);
        return resolve({ subscribers: 0, views: 0, videoCount: 0 });
      }
      try {
        const data = JSON.parse(stdout.trim());
        resolve({
          subscribers: data.channel_follower_count || 0,
          views: data.view_count || 0,
          videoCount: data.playlist_count || 0
        });
      } catch (e) {
        console.error(`[Sync Channel Stats] Lỗi phân tích JSON cho kênh ${url}:`, e.message);
        resolve({ subscribers: 0, views: 0, videoCount: 0 });
      }
    });
  });
}

// Helper trích xuất hashtag chủ đề hay dùng từ bài đăng thành công
function computeTopHashtags(posts, accountId) {
  const accountPosts = posts.filter(p => p.accountId === accountId && p.status === 'success');
  const hashtagCounts = {};
  
  accountPosts.forEach(post => {
    const caption = post.caption || '';
    const matches = caption.match(/#[\p{L}\p{N}_]+/gu);
    if (matches) {
      matches.forEach(tag => {
        const cleanTag = tag.trim();
        hashtagCounts[cleanTag] = (hashtagCounts[cleanTag] || 0) + 1;
      });
    }
  });

  return Object.entries(hashtagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(entry => entry[0]);
}

// Chạy tiến trình đồng bộ ngầm
async function runBackgroundSync() {
  try {
    const db = await readDb();
    const accounts = db.accounts || [];
    const posts = db.posts || [];
    const ytdlpPath = path.join(process.cwd(), 'data', 'yt-dlp-bin.exe');

    for (let i = 0; i < accounts.length; i++) {
      if (global.channelSyncStopRequested) {
        console.log('[Sync Channel Stats] Tiến trình đồng bộ bị người dùng dừng lại.');
        break;
      }

      const acc = accounts[i];
      global.channelSyncStatus = {
        active: true,
        total: accounts.length,
        current: i + 1,
        message: `Đang quét kênh ${i + 1}/${accounts.length}: ${acc.label || acc.username}`
      };

      console.log(`[Sync Channel Stats] (${i + 1}/${accounts.length}) Bắt đầu quét: ${acc.label} (${acc.channelUrl})`);

      // Quét thông tin ưu tiên từ HTML trước, lỗi thì fallback sang yt-dlp
      let stats = { subscribers: 0, views: 0, videoCount: 0 };
      try {
        stats = await fetchChannelStatsHtml(acc.channelUrl);
      } catch (htmlErr) {
        console.warn(`[Sync Channel Stats] Quét HTML thất bại cho ${acc.label}, thử dùng yt-dlp:`, htmlErr.message);
        stats = await fetchChannelStatsYtdlp(ytdlpPath, acc.channelUrl);
      }
      
      // Tính toán hashtag
      const topTags = computeTopHashtags(posts, acc.id);

      // Cập nhật lại đối tượng tài khoản
      acc.subscribers = stats.subscribers;
      acc.views = stats.views;
      acc.videoCount = stats.videoCount;
      acc.topHashtags = topTags;
      acc.statsUpdatedAt = new Date().toISOString();

      // Lưu lại database
      await writeDb(db);
    }
  } catch (err) {
    console.error('[Sync Channel Stats] Lỗi tiến trình đồng bộ ngầm:', err);
  } finally {
    global.channelSyncStatus = null;
    console.log('[Sync Channel Stats] Tiến trình đồng bộ kết thúc.');
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    syncStatus: global.channelSyncStatus || null
  });
}

export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'stop') {
      global.channelSyncStopRequested = true;
      if (global.channelSyncStatus) {
        global.channelSyncStatus.message = 'Đang dừng đồng bộ...';
      }
      return NextResponse.json({ success: true, message: 'Đã gửi yêu cầu dừng đồng bộ.' });
    }

    // Nếu đang chạy rồi thì không khởi chạy lại
    if (global.channelSyncStatus && global.channelSyncStatus.active) {
      return NextResponse.json({ error: 'Tiến trình đồng bộ kênh đang chạy rồi.' }, { status: 400 });
    }

    const db = await readDb();
    if (!db.accounts || db.accounts.length === 0) {
      return NextResponse.json({ error: 'Không có tài khoản kênh nào để đồng bộ.' }, { status: 400 });
    }

    // Khởi chạy tiến trình chạy ngầm
    global.channelSyncStopRequested = false;
    global.channelSyncStatus = {
      active: true,
      total: db.accounts.length,
      current: 0,
      message: 'Đang bắt đầu đồng bộ số liệu các kênh...'
    };

    // Chạy bất đồng bộ
    runBackgroundSync();

    return NextResponse.json({ success: true, message: 'Bắt đầu đồng bộ số liệu kênh ngầm...' });
  } catch (error) {
    console.error('[Sync Channel Stats Error]:', error);
    return NextResponse.json({ error: error.message || 'Lỗi máy chủ.' }, { status: 500 });
  }
}
