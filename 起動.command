#!/bin/bash
cd "$(dirname "$0")"

# .env.local が未設定の場合に警告
if grep -q "postgresql://user:password" .env.local 2>/dev/null; then
  echo "⚠️  .env.local の DATABASE_URL がサンプルのままです。"
  echo "   Neon の接続文字列に書き換えてから起動してください。"
  echo ""
  read -p "このまま続ける場合は Enter を押してください..."
fi

echo "依存パッケージを確認中..."
npm install --silent 2>/dev/null

# LAN IPアドレスを表示
LAN_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "不明")
echo "=================================================="
echo "  ローカル  : http://localhost:3000/"
echo "  LAN端末   : http://${LAN_IP}:3000/"
echo "  (スマホ・別PCからはLANのURLでアクセス)"
echo "=================================================="
echo ""
echo "終了するには Ctrl+C を押してください"
echo ""

sleep 1
open "http://localhost:3000"
npm run dev
