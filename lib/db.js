import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve('data');
const SESSIONS_DIR = path.join(DATA_DIR, 'sessions');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Đảm bảo các thư mục tồn tại
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const DEFAULT_DB = {
  accounts: [],
  posts: []
};

export function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      writeDb(DEFAULT_DB);
      return DEFAULT_DB;
    }
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Lỗi đọc database:', error);
    return DEFAULT_DB;
  }
}

export function writeDb(data) {
  try {
    // Ghi file tạm thời rồi rename để tránh bị lỗi file nửa chừng
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (error) {
    console.error('Lỗi ghi database:', error);
  }
}

export function getSessionsDir() {
  return SESSIONS_DIR;
}

export function getUploadsDir() {
  return UPLOADS_DIR;
}
