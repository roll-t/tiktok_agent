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
      
      // Chọn lệnh phù hợp theo hệ điều hành
      const openCommand = process.platform === 'win32'
        ? `explorer.exe "${absolutePath}"`
        : process.platform === 'darwin'
          ? `open "${absolutePath}"`
          : `xdg-open "${absolutePath}"`;

      exec(openCommand, (err) => {
        if (err) {
          console.error('[API Settings] Lỗi mở thư mục:', err);
        }
      });
      return NextResponse.json({ success: true, path: absolutePath });
    }
    if (action === 'select-folder') {
      let selectedPath = null;

      if (process.platform === 'win32') {
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

        console.log(`[API Settings] Đang kích hoạt hộp thoại chọn thư mục (Windows)...`);
        selectedPath = await new Promise((resolve) => {
          exec(`powershell -ExecutionPolicy Bypass -File "${psScriptPath}"`, (err, stdout) => {
            if (err) {
              console.error('[API Settings] Lỗi chọn thư mục bằng PowerShell:', err);
              resolve(null);
            } else {
              resolve(stdout.trim());
            }
          });
        });
      } else if (process.platform === 'darwin') {
        console.log(`[API Settings] Đang kích hoạt hộp thoại chọn thư mục (macOS)...`);
        selectedPath = await new Promise((resolve) => {
          // Sử dụng AppleScript để hiển thị hộp thoại chọn thư mục gốc trên macOS
          exec(`osascript -e 'POSIX path of (choose folder with prompt "Chọn thư mục lưu trữ video")'`, (err, stdout) => {
            if (err) {
              console.error('[API Settings] Lỗi chọn thư mục bằng AppleScript:', err);
              resolve(null);
            } else {
              resolve(stdout.trim());
            }
          });
        });
      } else {
        return NextResponse.json({ success: false, error: 'Hệ điều hành hiện tại chưa hỗ trợ chọn thư mục trực tiếp.' });
      }

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
        return NextResponse.json({ error: 'Đường dẫn phải là đường dẫn tuyệt đối (ví dụ: /Users/username/Videos hoặc D:\\Videos)' }, { status: 400 });
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
