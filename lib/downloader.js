import fs from 'fs';
import path from 'path';
import https from 'https';
import { exec } from 'child_process';
import { getUploadsDir } from './db.js';

const YTDLP_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
const DATA_DIR = path.resolve('data');
const YTDLP_PATH = path.join(DATA_DIR, 'yt-dlp-bin.exe');

// Helper to download yt-dlp.exe synchronously/asynchronously
function downloadYtdlp(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 302 || response.statusCode === 301) {
        downloadYtdlp(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Tải yt-dlp thất bại: Status Code ${response.statusCode}`));
        return;
      }

      // Ensure data directory exists
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      const file = fs.createWriteStream(dest);
      response.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          // Give the OS 1 second to release the file handle and finalize it
          setTimeout(resolve, 1000);
        });
      });
      file.on('error', (err) => {
        fs.unlink(dest, () => reject(err));
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Ensure yt-dlp is available
export async function ensureYtdlp() {
  if (!fs.existsSync(YTDLP_PATH)) {
    console.log('[Downloader] Đang tải xuống yt-dlp-bin.exe...');
    await downloadYtdlp(YTDLP_URL, YTDLP_PATH);
    console.log('[Downloader] Tải xuống yt-dlp-bin.exe hoàn tất!');
  }
}

// Run exec command wrapped in Promise with retry mechanism for Windows file locks
function runExec(command, retries = 3, delay = 1500) {
  return new Promise((resolve, reject) => {
    const attempt = (remaining) => {
      exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
        if (error) {
          const isFileLocked = error.message.includes('cannot access the file') || 
                               error.message.includes('being used by another process') ||
                               error.message.includes('EBUSY');
          
          if (isFileLocked && remaining > 0) {
            console.log(`[Downloader] File bị khóa (antivirus/Windows Defender đang quét), thử lại sau ${delay}ms... (Còn ${remaining} lần thử)`);
            setTimeout(() => attempt(remaining - 1), delay);
          } else {
            reject(new Error(stderr || error.message));
          }
        } else {
          resolve(stdout);
        }
      });
    };
    attempt(retries);
  });
}

/**
 * Downloads any video (YouTube Shorts, FB Reels, etc.) using yt-dlp
 * @param {string} url - Direct video link
 * @returns {Promise<{videoFilename: string, caption: string, cover: string}>}
 */
export async function downloadWithYtdlp(url) {
  // Dọn dẹp trước để giải phóng bộ nhớ dưới 1GB trước khi bắt đầu tải
  try {
    cleanUploadsFolder();
  } catch (cleanErr) {
    console.error('[Downloader] Dọn dẹp trước khi tải lỗi:', cleanErr);
  }

  await ensureYtdlp();

  console.log(`[Downloader] Đang lấy thông tin video từ: ${url}`);
  
  // 1. Get Video Metadata
  // We use node as the JS runtime since we are running inside a Node.js env
  const metadataStdout = await runExec(`"${YTDLP_PATH}" --js-runtimes node -j "${url}"`);
  const info = JSON.parse(metadataStdout);

  const caption = info.title || '';
  const cover = info.thumbnail || '';

  // 2. Download Video
  const videoFilename = `reup_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.mp4`;
  const outputPath = path.join(getUploadsDir(), videoFilename);

  console.log(`[Downloader] Đang tải video về: ${outputPath}`);

  // Download the best progressive MP4 format (to ensure native browser playback without requiring ffmpeg)
  const downloadCmd = `"${YTDLP_PATH}" --js-runtimes node -f "best[ext=mp4][protocol^=http]/best[protocol^=http]" -o "${outputPath}" "${url}"`;
  await runExec(downloadCmd);

  if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
    throw new Error('Tải video thất bại hoặc file tải về bị rỗng.');
  }

  console.log(`[Downloader] Tải video thành công! Kích thước: ${fs.statSync(outputPath).size} bytes`);

  // Dọn dẹp thư mục uploads nếu vượt giới hạn 1GB
  try {
    cleanUploadsFolder();
  } catch (cleanErr) {
    console.error('[Downloader] Dọn dẹp lỗi:', cleanErr);
  }

  return {
    videoFilename,
    caption,
    cover
  };
}

export function cleanUploadsFolder() {
  try {
    const uploadsDir = getUploadsDir();
    if (!fs.existsSync(uploadsDir)) return;

    const files = fs.readdirSync(uploadsDir);
    const fileDetails = files.map(file => {
      const filePath = path.join(uploadsDir, file);
      try {
        const stats = fs.statSync(filePath);
        return {
          name: file,
          path: filePath,
          size: stats.size,
          mtime: stats.mtimeMs
        };
      } catch (e) {
        return null;
      }
    }).filter(Boolean);

    // Tính tổng kích thước
    let totalSize = fileDetails.reduce((sum, f) => sum + f.size, 0);
    const LIMIT = 1024 * 1024 * 1024; // 1 GB in bytes

    if (totalSize > LIMIT) {
      console.log(`[Cleaner] Tổng dung lượng thư mục uploads: ${(totalSize / (1024 * 1024)).toFixed(2)} MB. Vượt giới hạn 1GB. Đang dọn dẹp...`);
      
      // Sắp xếp theo thời gian sửa đổi (cũ nhất lên đầu)
      fileDetails.sort((a, b) => a.mtime - b.mtime);

      for (const file of fileDetails) {
        try {
          fs.unlinkSync(file.path);
          totalSize -= file.size;
          console.log(`[Cleaner] Đã xóa file cũ để giải phóng bộ nhớ: ${file.name}`);
        } catch (err) {
          console.error(`[Cleaner] Không thể xóa file ${file.name}:`, err);
        }

        if (totalSize <= LIMIT) {
          console.log(`[Cleaner] Đã dọn dẹp xong. Dung lượng hiện tại: ${(totalSize / (1024 * 1024)).toFixed(2)} MB`);
          break;
        }
      }
    }
  } catch (error) {
    console.error('[Cleaner Error] Lỗi dọn dẹp thư mục uploads:', error);
  }
}

/**
 * Lấy thông tin tương tác (views, likes, comments) của video bằng yt-dlp
 * @param {string} url - Link video (YouTube/TikTok)
 * @returns {Promise<{views: number, likes: number, comments: number}>}
 */
export async function getVideoStats(url) {
  await ensureYtdlp();
  try {
    const stdout = await runExec(`"${YTDLP_PATH}" --js-runtimes node -j "${url}"`);
    const info = JSON.parse(stdout);
    return {
      views: info.view_count || 0,
      likes: info.like_count || 0,
      comments: info.comment_count || 0
    };
  } catch (err) {
    console.error(`[Stats] Lỗi khi lấy tương tác từ yt-dlp cho ${url}:`, err.message);
    throw err;
  }
}
