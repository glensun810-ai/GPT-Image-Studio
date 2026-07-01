# AGENTS.md

> 这是给 **AI Agent / AI Coding 工具**（Claude、Codex、Cursor、Cline 等）阅读的项目级上下文。
> 它假定你已经读完根目录的 `README.md`，只补充 README 不会覆盖的**具体代码位置、约束、坑**。

---

## 1. 项目一句话定位

自部署的 **AI 生图 Web 工具**：
- 用户在前端填入 [apimart.ai](https://apimart.ai) 的 **GPT-Image-2** API Key
- 浏览器调本服务的 `/api/generate` 提交任务 → 轮询 `/api/task` 拿结果
- 提示词模板、图片标签、收藏、历史记录、登录鉴权都内置

## 2. 关键文件速查（按修改频率排序）

| 改什么 | 去哪里 |
| --- | --- |
| 任何 UI / 交互 | `src/app/page.tsx`（2300+ 行，主战场） |
| 任何样式 / 主题色 / 动效 | `src/app/globals.css`（OKLCH 变量） |
| 任何鉴权 / 登录逻辑 | `src/lib/auth.ts`（密码哈希 + JWT） |
| 任何历史记录 / 标签 / 收藏 | `src/lib/use-history.ts`（localStorage 核心） + `src/lib/history-sync.ts`（同步引擎） |
| 任何服务端数据 | `src/server/history-store.ts`（文件落盘到 `.data/`） |
| 任何 API 路由 | `src/app/api/**/route.ts` |
| 设计规范 | `DESIGN.md` |
| 商业化方案 | `docs/COMMERCIALIZATION.md` |
| 历史持久化方案 | `docs/HISTORY_PERSISTENCE.md` |

## 3. 目录与文件说明

```
src/
├── app/
│   ├── layout.tsx               # 根布局 + ThemeProvider + suppressHydrationWarning
│   ├── page.tsx                 # ⭐ 主页面（所有交互）
│   ├── globals.css              # ⭐ 全局样式（OKLCH + Markdown 预览 + 动画）
│   ├── favicon.ico
│   ├── robots.ts
│   └── api/
│       ├── auth/
│       │   ├── login/route.ts   # POST 登录
│       │   ├── logout/route.ts  # POST 登出
│       │   └── check/route.ts   # GET 检查会话
│       ├── generate/route.ts    # POST 提交生成（带 API Key 透传）
│       ├── task/route.ts        # GET 查询任务状态
│       └── history/
│           ├── route.ts         # GET/POST/PUT/DELETE 整体历史
│           ├── [taskId]/route.ts# PATCH/DELETE 单条
│           └── batch-delete/route.ts
├── components/
│   ├── ui/                      # shadcn/ui（不要手改，需要新组件走 `pnpm dlx shadcn@latest add xxx`）
│   ├── theme-provider.tsx       # 客户端：注入主题 class 防止 FOUC
│   └── history-sync-indicator.tsx # 同步状态小图标
├── hooks/
│   ├── use-mobile.ts
│   └── use-history-sync.ts      # 登录后自动加载、修改后自动上传
├── lib/
│   ├── auth.ts                  # ⭐ 鉴权核心（密码哈希 + JWT）
│   ├── types.ts                 # ⭐ 类型：HistoryItem / HistoryServerShape / SyncStatus
│   ├── history-schema.ts        # Zod 校验 + 容量限制
│   ├── use-history.ts           # localStorage 持久化
│   ├── history-sync.ts          # 同步引擎（重试/退避）
│   └── utils.ts                 # cn() 工具
└── server/
    └── history-store.ts         # 文件落盘（.data/{username}.json）
```

## 4. 编码约定（项目级）

### 4.1 鉴权与会话

- **所有受保护 API** 在路由顶部先 `const session = await getSession(); if (!session) return 401;`
- **不要** 在新代码里手写 cookie 设置，统一走 `auth.ts` 的 `COOKIE_OPTIONS`
- 改密码/新增账号：编辑 `src/lib/auth.ts` 的 `ALLOWED_USERS`，重新生成 SHA-256+盐
- JWT 默认 7 天过期。改 `setExpirationTime` 时同步检查 `COOKIE_OPTIONS.maxAge`

### 4.2 历史记录数据流

**单条数据形状**（`src/lib/types.ts` 的 `HistoryItem`）：

```ts
interface HistoryItem {
  taskId: string;          // apimart 的 task_id
  prompt: string;
  size: string;            // '1:1' | '16:9' | ...
  resolution: string;      // '1k' | '2k' | '4k'
  imageUrl: string;        // 生成成功后的 URL（空字符串表示失败）
  createdAt: number;       // 毫秒时间戳
  tags: string[];          // 用户标签
  favorited: boolean;      // 是否收藏
  error?: string;          // 生成失败时的错误信息
  synced?: boolean;        // 是否已同步到服务器
  updatedAt?: number;      // 最后更新时间（服务器字段）
}
```

**容量**：本地和服务端都是 **最多 500 条**，超出按 `createdAt` 淘汰最旧。
**冲突解决**：服务端为权威，本地用 `taskId` 对齐。

### 4.3 状态机

- 任务状态：`submitted → processing → completed | failed`
- 轮询：`useTaskPolling` hook 内：首查 12s 延迟 → 之后 4s 间隔 → 180s 超时
- 失败不扣费（apimart 文档明确），前端提示用户重试

### 4.4 样式

- **OKLCH** 色板定义在 `globals.css` 的 `:root` / `.dark`
- **Tailwind 4** + `bg-primary` / `text-foreground` 等语义类
- **不要**手写十六进制色值
- 自定义类用 `cn()`（来自 `@/lib/utils`）
- Markdown 预览用 `.markdown-preview` 包

### 4.5 Hydration / SSR 防御

- 任何依赖 `localStorage` / `Date.now()` / `Math.random()` 的渲染逻辑，必须包在 `useEffect` 里、用 `useState` 占位
- 现有 `theme-provider.tsx` 已经是这个模式，新功能照抄
- `layout.tsx` 的 `<body>` 有 `suppressHydrationWarning`（防浏览器扩展注入属性），**不要**移除

## 5. 常见坑（踩过不要重复踩）

1. **`/api/generate` 拿不到 API Key 时返回 400** —— Key 是浏览器 Header 透传的（`x-apimart-key` 或类似），后端不存任何 Key。
2. **Next.js DevTools 浮动按钮** —— 开发模式出现在左下角，用 CSS 选择器 `[data-nextjs-dev-tools-button]` / `[data-nextjs-devtools-panel-overlay]` 在 `globals.css` 隐藏。
3. **JSX 标签嵌套** —— React 19 严格，`<p>` 里不能套 `<div>` / `<button>`。`Markdown` 渲染时尤其注意。
4. **shadcn 组件** —— 装新组件必须用 `pnpm dlx shadcn@latest add button dialog ...` 走到 `src/components/ui/`，**不要**手装或 npm 装。
5. **tsbuildinfo 缓存** —— 大改 `tsconfig` 后 `rm tsconfig.tsbuildinfo` 重建。
6. **JSON body 大小** —— 上传 base64 参考图可能很大，Next 默认 1MB body 限制。改 `next.config.ts` 的 `experimental.serverActions.bodySizeLimit` 或改成 multipart。
7. **登录后立刻同步历史** —— 见 `use-history-sync.ts`：登录事件触发 → pull 远端 → 合并 → push 本地增量。**不要**在 `page.tsx` 里重复实现这个流程。
8. **API Key 错误时不要 fallback 到 mock** —— 见根 CLAUDE.md / 项目约束：必须真实调用。

## 6. 命令速查

```bash
pnpm install           # 装依赖（不要用 npm/yarn）
pnpm dev               # 启动 dev server（5000 端口，HMR）
pnpm build             # 生产构建（next build + tsup 打 server）
pnpm start             # 生产模式
pnpm ts-check          # tsc --noEmit
pnpm lint:build        # eslint --quiet
pnpm validate          # ts-check + lint:build 并行
```

## 7. 改完代码必跑

```bash
pnpm ts-check && pnpm lint:build
```

接口有变更时还要 `pnpm dev` 起来后用 `curl` 跑 `/api/**` 冒烟测试。

## 8. 不想用 coze 也能跑

- 删 `scripts/dev.sh` / `scripts/build.sh` / `scripts/start.sh` 里的 coze 特殊逻辑
- 把 `src/server.ts` 换成 `next dev` 也行（去掉自定义 server）
- `package.json` 的 `preinstall` 是 `only-allow pnpm`，保留

## 9. 关联文档

- `DESIGN.md` —— UI 改之前必看
- `docs/COMMERCIALIZATION.md` —— 商业化思路
- `docs/HISTORY_PERSISTENCE.md` —— 历史数据流
- `CLAUDE.md` —— Claude 专属补充
