"use client";

import { useCallback, useEffect, useState } from "react";
import { SESSION_LOST_EVENT } from "@/lib/auth-events";
import {
  getSessionToken,
  setSessionToken as persistSessionToken,
} from "@/lib/authed-fetch";
import { withBase } from "@/lib/base-path";

export interface AuthUser {
  username: string;
  displayName: string;
}

const SESSION_CHECK_INTERVAL = 5 * 60 * 1000; // 5 分钟

/**
 * useAuth — 集中管理登录态
 *
 * 行为：
 * 1. 挂载时调 /api/auth/check 恢复 session（同时带 cookie + Authorization header）
 * 2. 定时（5 分钟）复查 session，防止 cookie 在边缘场景下被静默丢失
 * 3. 监听 authedFetch 派发的 SESSION_LOST_EVENT，主动登出
 * 4. 提供 login/logout/forceLogout
 */
export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // 通用带 token 的 check 请求
  const checkSession = useCallback(async (): Promise<AuthUser | null> => {
    try {
      const headers: Record<string, string> = {};
      const token = getSessionToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(withBase("/api/auth/check"), {
        credentials: "include",
        headers,
        cache: "no-store",
      });
      if (res.status === 401) return null;
      if (!res.ok) return null;
      const data = await res.json();
      if (data?.success && data.authenticated && data.data) {
        return data.data as AuthUser;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  // 初始化：恢复 session
  useEffect(() => {
    let cancelled = false;
    checkSession()
      .then((u) => {
        if (cancelled) return;
        if (u) setUser(u);
      })
      .finally(() => {
        if (!cancelled) setAuthChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [checkSession]);

  // 定时心跳：复查 session
  useEffect(() => {
    if (!user) return;
    const id = setInterval(async () => {
      const u = await checkSession();
      if (!u) {
        // 心跳发现 session 失效
        window.dispatchEvent(new CustomEvent(SESSION_LOST_EVENT));
      }
    }, SESSION_CHECK_INTERVAL);
    return () => clearInterval(id);
  }, [user, checkSession]);

  // 监听 SESSION_LOST 事件：自动登出
  useEffect(() => {
    const handler = () => {
      setUser(null);
    };
    window.addEventListener(SESSION_LOST_EVENT, handler);
    return () => window.removeEventListener(SESSION_LOST_EVENT, handler);
  }, []);

  const login = useCallback((u: AuthUser, token?: string | null) => {
    // 持久化 token 到 localStorage（如果 login 响应体里给了）
    if (token !== undefined) {
      persistSessionToken(token);
    }
    setUser(u);
  }, []);
  const logout = useCallback(() => {
    persistSessionToken(null);
    setUser(null);
  }, []);

  return { user, authChecked, login, logout };
}
