import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { Resolver } from 'dns/promises';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tiktok_agent';

async function resolveMongodbUri(uri) {
  if (!uri || !uri.startsWith('mongodb+srv://')) {
    return uri;
  }
  try {
    const match = uri.match(/^mongodb\+srv:\/\/([^:]+):([^@]+)@([^/?]+)(?:\/([^?]*))?(?:\?(.*))?$/);
    if (!match) return uri;
    const [, username, password, hostname, database = '', options = ''] = match;
    const resolver = new Resolver();
    resolver.setServers(['8.8.8.8', '8.8.4.4']);
    const addresses = await resolver.resolveSrv('_mongodb._tcp.' + hostname);
    if (!addresses || addresses.length === 0) return uri;
    const hosts = addresses.map(addr => `${addr.name}:${addr.port}`).join(',');
    const optParams = new URLSearchParams(options);
    if (!optParams.has('ssl')) optParams.set('ssl', 'true');
    if (!optParams.has('authSource')) optParams.set('authSource', 'admin');
    return `mongodb://${username}:${password}@${hosts}/${database}?${optParams.toString()}`;
  } catch (error) {
    console.error('[DNS SRV Resolve Error] Failed to resolve SRV record, falling back to original URI:', error);
    return uri;
  }
}

let clientPromise;

async function getClientPromise() {
  const uri = await resolveMongodbUri(MONGODB_URI);
  const client = new MongoClient(uri);
  return client.connect();
}

if (process.env.NODE_ENV === 'development') {
  if (!global._mongoClientPromise) {
    global._mongoClientPromise = getClientPromise();
  }
  clientPromise = global._mongoClientPromise;
} else {
  clientPromise = getClientPromise();
}

export async function getMongoClientDb() {
  const clientConnected = await clientPromise;
  return clientConnected.db();
}

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

// Di chuyển dữ liệu cũ từ db.json sang MongoDB nếu tồn tại
async function checkAndMigrate() {
  if (fs.existsSync(DB_FILE)) {
    try {
      console.log('[Migration] Phát hiện db.json cũ, đang di chuyển dữ liệu sang MongoDB...');
      const fileData = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(fileData);
      
      const db = await getMongoClientDb();
      
      // Kiểm tra xem trên MongoDB đã có dữ liệu chưa để tránh ghi đè
      const remoteAccountsCount = await db.collection('accounts').countDocuments();
      const remotePostsCount = await db.collection('posts').countDocuments();
      
      if (remoteAccountsCount > 0 || remotePostsCount > 0) {
        console.log('[Migration] MongoDB đã có dữ liệu trên cloud. Bỏ qua di chuyển dữ liệu từ db.json để tránh ghi đè dữ liệu mới.');
        fs.renameSync(DB_FILE, `${DB_FILE}.bak`);
        return;
      }
      
      if (parsed.accounts && parsed.accounts.length > 0) {
        await db.collection('accounts').deleteMany({});
        await db.collection('accounts').insertMany(parsed.accounts);
        console.log(`[Migration] Đã chuyển ${parsed.accounts.length} tài khoản sang MongoDB.`);
      }
      
      if (parsed.posts && parsed.posts.length > 0) {
        await db.collection('posts').deleteMany({});
        await db.collection('posts').insertMany(parsed.posts);
        console.log(`[Migration] Đã chuyển ${parsed.posts.length} bài đăng sang MongoDB.`);
      }
      
      // Rename file cũ tránh migrate lại lần sau
      fs.renameSync(DB_FILE, `${DB_FILE}.bak`);
      console.log('[Migration] Di chuyển dữ liệu sang MongoDB thành công và đã đổi tên db.json thành db.json.bak!');
    } catch (e) {
      console.error('[Migration Error] Lỗi di chuyển dữ liệu sang MongoDB:', e);
    }
  }
}

let dbQueue = Promise.resolve();
async function enqueue(op) {
  const next = dbQueue.then(op);
  dbQueue = next.catch(() => {});
  return next;
}

export function readDb() {
  return enqueue(async () => {
    try {
      await checkAndMigrate();
      const db = await getMongoClientDb();
      
      const accounts = await db.collection('accounts').find({}).toArray();
      const posts = await db.collection('posts').find({}).toArray();
      
      let settings = await db.collection('settings').findOne({});
      if (settings && settings.customUploadsDir) {
        global.customUploadsDir = settings.customUploadsDir;
      } else {
        global.customUploadsDir = '';
      }
      
      // Loại bỏ trường _id để tương thích với cấu trúc JSON cũ của ứng dụng
      const cleanAccounts = accounts.map(({ _id, ...rest }) => rest);
      const cleanPosts = posts.map(({ _id, ...rest }) => rest);
      
      return {
        accounts: cleanAccounts,
        posts: cleanPosts,
        settings: {
          customUploadsDir: global.customUploadsDir || ''
        }
      };
    } catch (error) {
      console.error('Lỗi đọc database MongoDB:', error);
      return { ...DEFAULT_DB, settings: { customUploadsDir: '' } };
    }
  });
}

export function writeDb(data) {
  return enqueue(async () => {
    try {
      const db = await getMongoClientDb();
      
      // Lưu accounts
      await db.collection('accounts').deleteMany({});
      if (data.accounts && data.accounts.length > 0) {
        const cleanAccounts = data.accounts.map(({ _id, ...rest }) => rest);
        await db.collection('accounts').insertMany(cleanAccounts);
      }
      
      // Lưu posts
      await db.collection('posts').deleteMany({});
      if (data.posts && data.posts.length > 0) {
        const cleanPosts = data.posts.map(({ _id, ...rest }) => rest);
        await db.collection('posts').insertMany(cleanPosts);
      }

      // Lưu settings
      if (data.settings) {
        await db.collection('settings').updateOne(
          {},
          { $set: { customUploadsDir: data.settings.customUploadsDir || '' } },
          { upsert: true }
        );
        global.customUploadsDir = data.settings.customUploadsDir || '';
      }
    } catch (error) {
      console.error('Lỗi ghi database MongoDB:', error);
    }
  });
}

export function getSessionsDir() {
  return SESSIONS_DIR;
}

export function getUploadsDir() {
  if (global.customUploadsDir) {
    try {
      if (!fs.existsSync(global.customUploadsDir)) {
        fs.mkdirSync(global.customUploadsDir, { recursive: true });
      }
      return global.customUploadsDir;
    } catch (e) {
      console.error('[db] Không thể tạo thư mục lưu trữ tùy chỉnh:', e);
    }
  }
  return UPLOADS_DIR;
}
