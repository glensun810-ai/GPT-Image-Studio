# CLAUDE.md

> 致 Claude（Code / Code Interpreter / Cursor Cline 内的 Claude）：
> 本文件是 `AGENTS.md` 的**项目专属补充**。两份文件互相引用，请你都读。

## 你的角色

- 这是用户 **sgl810** 的个人项目 `GPT-Image-Studio`（一个 AI 生图 Web 工具）
- 仓库在 GitHub: `glensun810-ai/GPT-Image-Studio`
- 用户希望即便在 coze 沙箱不可用时，也能通过你（Claude）或 Codex 在本地继续开发

## 必读清单

按顺序读，**前 3 个不读完不要动手**：

1. `/workspace/projects/AGENTS.md` —— 项目结构 + 关键文件 + 常见坑
2. `/workspace/projects/CLAUDE.md`（本文件）—— Claude 专属提醒
3. `/workspace/projects/DESIGN.md` —— 视觉/交互规范，**改 UI 前必看**
4. `/workspace/projects/README.md` —— 整体说明
5. （按需）`/workspace/projects/docs/COMMERCIALIZATION.md`、`HISTORY_PERSISTENCE.md`

## 硬规则（违反 = 重新做）

### 🔴 1. 永远不要 Mock apimart.ai 调用
- 真实发起 `fetch('https://api.apimart.ai/v1/...')`，透传用户 API Key
- 失败要返回真实错误，**不要**返回伪造的 `{ data: ... }`
- 离线 / sandbox 不通时，告诉用户去本机跑

### 🔴 2. 不要在 `src/lib/auth.ts` 里放明文密码
- 密码用 `SHA-256(password + salt)` 存
- 加新账号：先用 Node 生成 hash，再写进 `ALLOWED_USERS`
- 生成命令（请用 Node REPL 或临时脚本）：
  ```js
  const crypto = require('crypto');
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256').update('明文密码' + salt).digest('hex');
  console.log(JSON.stringify({ salt, hash }));
  ```

### 🔴 3. 不要在 server 端持久化用户的 apimart API Key
- Key 走浏览器 Header 透传（`x-apimart-key`）
- 本服务不存 Key，不写日志

### 🔴 4. 改 UI 前必读 `DESIGN.md`
- 浅色科技蓝白 / 深色模式 OKLCH
- 紧凑 13px / 默认 15px / 舒适 17px 三档
- 禁止：紫色渐变、纯黑文字、过度装饰

### 🔴 5. Hydration 安全
- `typeof window` / `Date.now()` / `Math.random()` **必须**放进 `useEffect` + `useState`
- `<p>` 里不能套 `<div>` / `<button>`
- 现有 `theme-provider.tsx` 和 `history-sync-indicator.tsx` 是正确范式，照抄

## 项目专属注意事项

### 异步任务模型
apimart 生图是异步的：
- POST `/v1/images/generations` → 立即返回 `task_id`
- GET `/v1/tasks/{task_id}` → 轮询查状态
- 状态：`submitted` / `processing` / `completed` / `failed`
- **首查延迟 12s**，**轮询 4s 间隔**，**180s 超时**

### 历史记录数据流
- **本地**：`use-history.ts` → localStorage（最多 2000 条）
- **服务端**：`history-store.ts` → `.data/{username}.json`（最多 2000 条）
- **同步**：`use-history-sync.ts` → 登录后自动拉取、修改后自动推送
- **冲突**：服务端为权威，按 `taskId` 对齐

### 受保护 vs 公开 API
- **公开**：`/api/auth/login`、`/api/auth/check`、`/api/generate`、`/api/task`
- **受保护**（必须登录）：`/api/auth/logout`、`/api/history/**`
- 加新 API 时，参考 `/api/history/route.ts` 顶部的 `getSession()` 写法

## 常用工具

### 跑测试
```bash
pnpm ts-check          # TypeScript
pnpm lint:build        # ESLint
pnpm dev               # 本地启动
```

### 调 apimart API（用户给的格式）
```bash
curl -X POST https://api.apimart.ai/v1/images/generations \
  -H 'Authorization: Bearer <USER_API_KEY>' \
  -H 'Content-Type: application/json' \
  -d '{"model":"gpt-image-2","prompt":"...","size":"16:9","resolution":"2k"}'
```

### 改完后必须验证
1. `pnpm ts-check` 通过
2. `pnpm lint:build` 通过
3. `pnpm dev` 起来，肉眼检查改的部分
4. 如果改了 API，`curl` 跑一遍

## 沟通风格

- 用户偏好**简洁直接**，先给方案再实现
- 不确定时**先问**（用 AskUserQuestion 或 chat 直接问）
- 中文回复
- 一次性给完整方案，不要"先做 X，再做 Y"的拖延
- 商业化相关 / 涉及"是否值得做"的问题 → 先出方案文档，**等用户确认**再写代码

## 联系用户

- 仓库主：glensun810
- 微信：sgl810
- GitHub: https://github.com/glensun810-ai/GPT-Image-Studio

## 不要做的事

- ❌ 不要引入新的状态管理库（Redux/Zustand 等）—— 现有 `useState` + `useHistorySync` 已够用
- ❌ 不要换 UI 库（已锁定 shadcn/ui + Radix）
- ❌ 不要把 `pnpm dev` 换成 `next dev` 默认行为（自定义 server 保留了端口控制和未来扩展）
- ❌ 不要删除 `AGENTS.md` / `DESIGN.md` / `docs/` 下任何文档
- ❌ 不要在没有用户确认的情况下动 `auth.ts` 的 `ALLOWED_USERS`
- ❌ 不要硬编码端口（用 `process.env.PORT || 5000`）

## 提示词（用户给的复述，便于你理解业务）

> 用户想要一个能调 apimart.ai 的 GPT-Image-2 模型生图的 Web 工具。
> 每个用户用自己的 API Key，生成历史保存到本地/服务端。
> 简洁、克制、专业工具美学（不是消费级花哨）。
> 支持：提示词模板、图片标签、收藏、Markdown 编辑预览、响应式、明暗主题。
