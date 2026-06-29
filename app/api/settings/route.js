import { NextResponse } from 'next/server';
import { readDb, writeDb, getUploadsDir } from '@/lib/db.js';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';

export async function GET() {
  const db = await readDb();
  return NextResponse.json({ success: true, settings: db.settings });
}

export async function POST(request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'open') {
      const uploadsDir = getUploadsDir();
      const absolutePath = path.resolve(uploadsDir);
      
      // Đảm bảo thư mục tồn tại
      if (!fs.existsSync(absolutePath)) {
        fs.mkdirSync(absolutePath, { recursive: true });
      }

      console.log(`[API Settings] Đang mở thư mục: ${absolutePath}`);
      
      exec(`explorer.exe "${absolutePath}"`, (err) => {
        if (err) {
          console.error('[API Settings] Lỗi mở thư mục:', err);
        }
      });
      return NextResponse.json({ success: true, path: absolutePath });
    }
    if (action === 'select-folder') {
      const psScriptPath = path.join(process.cwd(), 'data', 'select_folder.ps1');
      
      if (!fs.existsSync(psScriptPath)) {
        const scriptContent = `Add-Type -AssemblyName System.Windows.Forms
$f = New-Object System.Windows.Forms.FolderBrowserDialog
$f.Description = "Chọn thư mục lưu trữ video"
$f.ShowNewFolderButton = $true
$result = $f.ShowDialog()
if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
    Write-Output $f.SelectedPath
}`;
        fs.mkdirSync(path.dirname(psScriptPath), { recursive: true });
        fs.writeFileSync(psScriptPath, scriptContent);
      }

      console.log(`[API Settings] Đang kích hoạt hộp thoại chọn thư mục...`);
      
      const selectedPath = await new Promise((resolve) => {
        exec(`powershell -ExecutionPolicy Bypass -File "${psScriptPath}"`, (err, stdout) => {
          if (err) {
            console.error('[API Settings] Lỗi chọn thư mục bằng PowerShell:', err);
            resolve(null);
          } else {
            resolve(stdout.trim());
          }
        });
      });

      if (!selectedPath) {
        return NextResponse.json({ success: false, error: 'Hủy chọn thư mục hoặc có lỗi xảy ra.' });
      }

      return NextResponse.json({ success: true, path: selectedPath });
    }

    // Lưu cấu hình
    const body = await request.json();
    const { customUploadsDir } = body;
    
    let cleanPath = customUploadsDir ? customUploadsDir.trim() : '';
    if (cleanPath) {
      // Kiểm tra xem có phải đường dẫn tuyệt đối không
      if (!path.isAbsolute(cleanPath)) {
        return NextResponse.json({ error: 'Đường dẫn phải là đường dẫn tuyệt đối trên Windows (ví dụ: D:\\Videos)' }, { status: 400 });
      }
      try {
        if (!fs.existsSync(cleanPath)) {
          fs.mkdirSync(cleanPath, { recursive: true });
        }
      } catch (err) {
        return NextResponse.json({ error: `Không thể ghi hoặc tạo thư mục: ${err.message}` }, { status: 400 });
      }
    }

    const db = await readDb();
    db.settings = { customUploadsDir: cleanPath };
    await writeDb(db);

    return NextResponse.json({ success: true, settings: db.settings });
  } catch (error) {
    console.error('[API Settings Error]:', error);
    return NextResponse.json({ error: error.message || 'Lỗi không xác định.' }, { status: 500 });
  }
}
