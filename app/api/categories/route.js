import { NextResponse } from 'next/server';
import { getMongoClientDb } from '@/lib/db.js';

export async function GET() {
  try {
    const db = await getMongoClientDb();
    const categories = await db.collection('categories').find({}).toArray();
    
    // Đồng bộ hóa: Tìm các danh mục thực tế đang có ở accounts
    const accounts = await db.collection('accounts').find({}).toArray();
    const usedCategories = Array.from(new Set(accounts.map(a => a.category).filter(Boolean)))
      .filter(cat => cat !== 'Chưa phân loại');

    // Merge các danh mục tự tạo và danh mục từ accounts để đảm bảo không bị sót
    const dbCategoryNames = new Set(categories.map(c => c.name));
    
    // Tự động thêm những danh mục đang được dùng vào bảng categories nếu chưa tồn tại
    const missingCategories = usedCategories.filter(cat => !dbCategoryNames.has(cat));
    if (missingCategories.length > 0) {
      const docs = missingCategories.map(name => ({
        name,
        createdAt: new Date().toISOString()
      }));
      await db.collection('categories').insertMany(docs);
      
      const updatedCategories = await db.collection('categories').find({}).toArray();
      const cleanCategories = updatedCategories.map(({ _id, ...rest }) => rest);
      return NextResponse.json({ success: true, categories: cleanCategories });
    }

    const cleanCategories = categories.map(({ _id, ...rest }) => rest);
    return NextResponse.json({ success: true, categories: cleanCategories });
  } catch (error) {
    console.error('[API Categories GET Error]:', error);
    return NextResponse.json({ error: error.message || 'Lỗi không xác định.' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { name } = await request.json();
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Tên danh mục không được trống.' }, { status: 400 });
    }
    
    const cleanName = name.trim();
    if (cleanName === 'Chưa phân loại') {
      return NextResponse.json({ error: 'Tên danh mục không hợp lệ.' }, { status: 400 });
    }

    const db = await getMongoClientDb();
    
    // Kiểm tra trùng lặp (không phân biệt hoa thường)
    const existing = await db.collection('categories').findOne({
      name: { $regex: new RegExp(`^${cleanName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') }
    });
    
    if (existing) {
      return NextResponse.json({ error: 'Danh mục này đã tồn tại.' }, { status: 400 });
    }

    const newCategory = {
      name: cleanName,
      createdAt: new Date().toISOString()
    };

    await db.collection('categories').insertOne(newCategory);
    
    return NextResponse.json({ success: true, category: { name: cleanName } });
  } catch (error) {
    console.error('[API Categories POST Error]:', error);
    return NextResponse.json({ error: error.message || 'Lỗi không xác định.' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');
    
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Thiếu tên danh mục cần xóa.' }, { status: 400 });
    }
    
    const cleanName = name.trim();
    const db = await getMongoClientDb();
    
    // Xóa khỏi danh mục
    await db.collection('categories').deleteOne({ name: cleanName });
    
    // Cập nhật các tài khoản có danh mục này về 'Chưa phân loại'
    await db.collection('accounts').updateMany(
      { category: cleanName },
      { $set: { category: 'Chưa phân loại' } }
    );
    
    return NextResponse.json({ success: true, message: 'Đã xóa danh mục thành công.' });
  } catch (error) {
    console.error('[API Categories DELETE Error]:', error);
    return NextResponse.json({ error: error.message || 'Lỗi không xác định.' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { oldName, newName } = await request.json();
    if (!oldName || !oldName.trim() || !newName || !newName.trim()) {
      return NextResponse.json({ error: 'Tên danh mục cũ và mới không được trống.' }, { status: 400 });
    }

    const cleanOld = oldName.trim();
    const cleanNew = newName.trim();

    if (cleanNew === 'Chưa phân loại') {
      return NextResponse.json({ error: 'Tên danh mục mới không hợp lệ.' }, { status: 400 });
    }

    const db = await getMongoClientDb();

    // Kiểm tra xem danh mục mới đã tồn tại chưa
    if (cleanOld.toLowerCase() !== cleanNew.toLowerCase()) {
      const existing = await db.collection('categories').findOne({
        name: { $regex: new RegExp(`^${cleanNew.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') }
      });
      if (existing) {
        return NextResponse.json({ error: 'Danh mục mới này đã tồn tại.' }, { status: 400 });
      }
    }

    // Cập nhật tên danh mục
    await db.collection('categories').updateOne(
      { name: cleanOld },
      { $set: { name: cleanNew } }
    );

    // Cập nhật tất cả tài khoản sử dụng danh mục này
    await db.collection('accounts').updateMany(
      { category: cleanOld },
      { $set: { category: cleanNew } }
    );

    return NextResponse.json({ success: true, message: 'Đã cập nhật danh mục thành công.' });
  } catch (error) {
    console.error('[API Categories PUT Error]:', error);
    return NextResponse.json({ error: error.message || 'Lỗi không xác định.' }, { status: 500 });
  }
}
