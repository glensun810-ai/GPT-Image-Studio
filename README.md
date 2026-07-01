# GPT Image Studio 🎨

> AI 图像生成工作室 — 基于 GPT-Image-2 模型的自托管 Web 工具

从 Coze 平台独立迁移而来，部署于 [jhw-ai.com/GPT-Image-Studio](https://jhw-ai.com/GPT-Image-Studio)。

---

## ✨ 功能

- **AI 生图**: 调用 GPT-Image-2 模型，输 prompt 即可生成
- **多尺寸**: 16 种比例（1:1、16:9、4:3 等）+ 3 档分辨率（1K~4K）
- **图片参考**: 可提供参考图作为生成输入
- **提示词模板**: 内置电商、人像、赛博朋克、水墨等预设模板
- **历史管理**: localStorage 离线 + 服务端同步，支持收藏/标签/筛选
- **明暗主题**: 浅色科技蓝白 / 深色模式，三档界面尺寸
- **完全响应式**: 桌面 + 移动端适配

## 🚀 快速开始

```bash
# 安装依赖
pnpm install

# 开发模式
pnpm dev          # http://localhost:5000

# 生产构建
pnpm build
NODE_ENV=production pnpm start    # http://localhost:5000
```

## 🏗️ 目录结构

```
GPT-Image-Studio/
├── src/              # 源代码 (Next.js App Router)
│   ├── app/          # 页面 + API 路由
│   ├── components/   # UI 组件 (shadcn/ui)
│   ├── hooks/        # React Hooks
│   ├── lib/          # 工具库
│   └── server/       # 服务端逻辑
├── public/           # 静态资源
├── scripts/          # 构建/启动脚本
├── deployment/       # Nginx + PM2 配置
│   ├── nginx.conf
│   └── pm2.config.cjs
└── docs/             # 方案文档
    ├── ARCHITECTURE.md
    ├── COZE_MIGRATION.md
    └── DEPLOYMENT.md
```

## 🏛️ 架构

```
浏览器 ──► Next.js Server ──► apib.ai (GPT-Image-2)
  │              │
  │              └── .data/{user}.json (历史记录)
  │
  └── localStorage (离线缓存 + API Key)
```

用户 API Key **不上传服务器**，仅通过浏览器 Header 透传。

## 🔧 技术栈

Next.js 16 / TypeScript / shadcn-ui / Radix / Tailwind CSS 4 / JWT / Zod / pnpm

## 📖 文档

| 文档 | 说明 |
|------|------|
| `docs/ARCHITECTURE.md` | 架构设计与数据流 |
| `docs/COZE_MIGRATION.md` | 从 Coze 平台迁移方案 |
| `docs/DEPLOYMENT.md` | 生产部署到阿里云指南 |
| `AGENTS.md` | AI 助手编码指引 |
| `DESIGN.md` | 视觉规范 |

## 🙋 联系

- 微信: sgl810
- 网站: [jhw-ai.com](https://jhw-ai.com)
