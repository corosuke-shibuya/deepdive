#!/bin/bash
# Deep Dive - 起動スクリプト (Macでダブルクリックして使えます)

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "=============================="
echo "  🔍 Deep Dive 起動中..."
echo "=============================="

# ポートが使用中なら解放
lsof -ti:8765 | xargs kill -9 2>/dev/null

# サーバー起動
python3 server.py &

sleep 1

# ブラウザで開く
open http://localhost:8765

echo ""
echo "✅ ブラウザが開きます"
echo "   http://localhost:8765"
echo ""
echo "⏹ 停止するにはこのウィンドウを閉じてください"

wait
