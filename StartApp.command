#!/bin/bash
cd "$(dirname "$0")"

echo "==================================================="
echo "     He Thong AutoPoster YouTube Shorts (macOS)"
echo "==================================================="
echo ""

# Kiem tra xem cong 3000 da co server chay chua
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
    echo "Server dang chay san. Dang mo giao dien..."
    open -a "Google Chrome" "http://localhost:3000" --args --app="http://localhost:3000" || open "http://localhost:3000"
    exit 0
fi

echo "Dang khoi dong Server. Vui long doi vai giay..."
echo "De tat hoan toan phan mem, hay DONG CUA SO NAY lai."
echo ""

# Hen gio 6 giay roi tu dong mo Chrome duoi dang App (neu khong co Chrome thi mo trinh duyet mac dinh)
(sleep 6 && (open -a "Google Chrome" "http://localhost:3000" --args --app="http://localhost:3000" || open "http://localhost:3000")) &

# Chay server Next.js
npm run dev
