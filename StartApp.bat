@echo off
title AutoPoster Server - Khong tat cua so nay
cd /d "%~dp0"

echo ===================================================
echo      He Thong AutoPoster YouTube Shorts
echo ===================================================
echo.

:: Kiem tra xem cong 3000 da co server chay chua
netstat -ano | find "LISTENING" | find ":3000" >nul
if %ERRORLEVEL% equ 0 (
    echo Server dang chay san. Dang mo giao dien...
    start chrome --app="http://localhost:3000"
    exit
)

echo Dang khoi dong Server. Vui long doi vai giay...
echo De tat hoan toan phan mem, hay DONG CUA SO NAY lai.
echo.

:: Hen gio 5 giay roi tu dong mo trinh duyet duoi dang App
start /B cmd /c "timeout /t 6 /nobreak >nul && start chrome --app=http://localhost:3000"

:: Chay server Next.js
npm run dev
