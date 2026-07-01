/**
 * authedFetch — 受保护 API 的统一调用器
 *
 * 解决三个问题：
 * 1. 强制带 cookie（credentials: 'include'），避免边缘场景下浏览器不发 cookie
 * 2. 同时通过 `Authorization: Bearer <token>` header 携带本地 token
 *    —— 当 cookie 莫名其妙丢失时，server 仍能鉴权通过
 * 3. 自动拦截「session 失效」并通知前端切回登录页
 *    —— 只对 server 明确标记 `error.session === true` 的 401 才触发，
 *       apimart 自身的 401（key 错、余额不足等）不会触发
 *
 * 用法：
 *   const res = await authedFetch('/api/generate', { method: 'POST', body: ... });
 *   if (!res.ok) { ... }   // 业务层自行处理（包括 apimart 401）
 */
import { SESSION_LOST_EVENT } from "@/lib/auth-events";
import { withBase } from "@/lib/base-path";

const TOKEN_STORAGE_KEY = "gpt_studio_session_token";

type ErrorBody = {
  success?: boolean;
  error?: {
    code?: number;
    message?: string;
    type?: string;
    /** 由 server 明确标记「这是 session 失效」，前端才会踢回登录页 */
    session?: boolean;
  };
};

function readToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setSessionToken(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

export function getSessionToken(): string | null {
  return readToken();
}

export async function authedFetch(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers || {});
  const token = readToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Convert relative URL to include base path
  const resolvedInput = typeof input === 'string' && input.startsWith('/') ? withBase(input) : input;
  const res = await fetch(resolvedInput, {
    ...init,
    headers,
    credentials: "include",
  });

  // 只有 server 明确标记 session 失效的 401，才通知前端
  if (res.status === 401) {
    let body: ErrorBody | null = null;
    try {
      body = (await res.clone().json()) as ErrorBody;
    } catch {
      body = null;
    }
    const isSessionLoss = body?.error?.session === true;
    if (isSessionLoss && typeof window !== "undefined") {
      // 清理本地 token，避免污染后续请求
      setSessionToken(null);
      window.dispatchEvent(new CustomEvent(SESSION_LOST_EVENT));
    }
  }

  return res;
}
