#!/bin/bash
set -e

echo "🚀 GPT Image Studio 部署脚本"
echo "============================="

echo ""
echo "1️⃣ 本地构建..."
NEXT_DISABLE_TURBOPACK=1 pnpm build

echo ""
echo "2️⃣ 上传到服务器..."
rsync -avz \
  --exclude node_modules \
  --exclude '.data' \
  --exclude '.git' \
  --exclude 'logs' \
  ./ root@120.76.156.83:/www/wwwroot/jhw-ai.com/GPT-Image-Studio/

echo ""
echo "3️⃣ 重启服务器..."
ssh root@120.76.156.83 "cd /www/wwwroot/jhw-ai.com/GPT-Image-Studio && pm2 restart gpt-image-studio"

echo ""
echo "✅ 部署完成！"
echo "访问: https://www.jhw-ai.com/GPT-Image-Studio/"
