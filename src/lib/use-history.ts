// useHistory 客户端持久化 Hook
// - 本地 localStorage（离线可用）
// - 服务端同步（登录态，跨设备）
// - 自动去重、容量控制、版本迁移

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { HistoryItem } from './types';
import { withBase } from './base-path';
import {
  MAX_HISTORY_ITEMS,
  dedupeHistory,
  estimateHistoryBytes,
  sanitizeHistory,
  sortHistoryDesc,
  truncateHistory,
} from './history-schema';

const HISTORY_STORAGE_KEY = 'gpt-image-studio:history:v1';
const SYNC_QUEUE_KEY = 'gpt-image-studio:history:pending:v1';
const SYNC_VERSION_KEY = 'gpt-image-studio:history:syncVersion:v1';
const SYNC_DEBOUNCE_MS = 800;

type SyncStatus = 'idle' | 'loading' | 'syncing' | 'error' | 'offline';

interface PendingOp {
  type: 'add' | 'delete' | 'batch-delete' | 'clear' | 'patch';
  item?: HistoryItem;
  taskId?: string;
  taskIds?: string[];
  patch?: Partial<Pick<HistoryItem, 'tags' | 'favorited'>>;
  ts: number;
}

function readLocal(): HistoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return sanitizeHistory(parsed);
  } catch {
    return [];
  }
}

function writeLocal(items: HistoryItem[]) {
  if (typeof window === 'undefined') return;
  try {
    const limited = truncateHistory(items);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(limited));
  } catch (e) {
    console.warn('[history] localStorage write failed', e);
  }
}

function readQueue(): PendingOp[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SYNC_QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PendingOp[];
  } catch {
    return [];
  }
}

function writeQueue(queue: PendingOp[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.warn('[history] sync queue write failed', e);
  }
}

async function authedFetch(url: string, init?: RequestInit) {
  const res = await fetch(withBase(url), {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  return res;
}

export function useHistory() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // 防止 useEffect 初始化时把 localStorage 覆盖为 []
  const skipNextPersistRef = useRef(true);
  const syncTimerRef = useRef<number | null>(null);
  const queueRef = useRef<PendingOp[]>([]);

  // —— 初始化：从 localStorage 读取 + 检查登录态 —— //
  useEffect(() => {
    const local = readLocal();
    setItems(sortHistoryDesc(local));
    setHydrated(true);
    void checkAuthAndLoad();
  }, []);

  const checkAuthAndLoad = useCallback(async () => {
    try {
      const res = await authedFetch(withBase('/api/auth/check'));
      if (res.ok) {
        const json = await res.json();
        if (json?.authenticated) {
          setIsLoggedIn(true);
          await loadFromServer();
          return;
        }
      }
      setIsLoggedIn(false);
      setSyncStatus('idle');
    } catch (e) {
      console.warn('[history] auth check failed', e);
      setSyncStatus('offline');
    }
  }, []);

  // —— 从服务器加载并合并 —— //
  const loadFromServer = useCallback(async () => {
    setSyncStatus('loading');
    try {
      const res = await authedFetch(withBase('/api/history'));
      if (!res.ok) {
        setSyncStatus('error');
        setSyncError(`服务器返回 ${res.status}`);
        return;
      }
      const json = await res.json();
      const remote: HistoryItem[] = sanitizeHistory(json?.data || []);
      const local = readLocal();
      // 合并：按 taskId 去重，服务器为准，保留本地未同步的
      const merged = sortHistoryDesc(dedupeHistory([...remote, ...local]));
      setItems(merged);
      writeLocal(merged);
      // 清除本地同步游标
      localStorage.removeItem(SYNC_VERSION_KEY);
      // 把任何本地未上传的项加入队列
      const pending = readQueue();
      const pendingAdd = pending.filter((p) => p.type === 'add' && p.item);
      if (pendingAdd.length > 0) {
        queueRef.current = pending;
        void flushQueue();
      } else {
        setSyncStatus('idle');
        setSyncError(null);
      }
    } catch (e) {
      console.warn('[history] load from server failed', e);
      setSyncStatus('offline');
      setSyncError(e instanceof Error ? e.message : '网络异常');
    }
  }, []);

  // —— 持久化副作用（去抖到本地） —— //
  useEffect(() => {
    if (!hydrated) return;
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }
    writeLocal(items);
    scheduleSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, hydrated]);

  // —— 入队 + 异步发送 —— //
  const enqueue = useCallback((op: Omit<PendingOp, 'ts'>) => {
    const queue = queueRef.current;
    queueRef.current = [...queue, { ...op, ts: Date.now() }];
    writeQueue(queueRef.current);
    scheduleSync();
  }, []);

  const scheduleSync = useCallback(() => {
    if (syncTimerRef.current !== null) {
      window.clearTimeout(syncTimerRef.current);
    }
    syncTimerRef.current = window.setTimeout(() => {
      void flushQueue();
    }, SYNC_DEBOUNCE_MS);
  }, []);

  const flushQueue = useCallback(async () => {
    if (!isLoggedIn) {
      setSyncStatus('idle');
      return;
    }
    if (queueRef.current.length === 0) {
      setSyncStatus('idle');
      setSyncError(null);
      return;
    }
    setSyncStatus('syncing');
    setSyncError(null);
    const queue = [...queueRef.current];
    try {
      // 简化策略：每条操作单独 POST。
      // 批量场景再优化
      for (const op of queue) {
        if (op.type === 'add' && op.item) {
          const res = await authedFetch('/api/history', {
            method: 'POST',
            body: JSON.stringify(op.item),
          });
          if (!res.ok) throw new Error(`POST /api/history ${res.status}`);
        } else if (op.type === 'delete' && op.taskId) {
          const res = await authedFetch(`/api/history/${encodeURIComponent(op.taskId)}`, {
            method: 'DELETE',
          });
          if (!res.ok) throw new Error(`DELETE /api/history ${res.status}`);
        } else if (op.type === 'batch-delete' && op.taskIds) {
          const res = await authedFetch('/api/history/batch-delete', {
            method: 'POST',
            body: JSON.stringify({ taskIds: op.taskIds }),
          });
          if (!res.ok) throw new Error(`batch-delete ${res.status}`);
        } else if (op.type === 'clear') {
          const res = await authedFetch('/api/history/clear', {
            method: 'POST',
          });
          if (!res.ok) throw new Error(`clear ${res.status}`);
        } else if (op.type === 'patch' && op.taskId && op.patch) {
          const res = await authedFetch(`/api/history/${encodeURIComponent(op.taskId)}`, {
            method: 'PATCH',
            body: JSON.stringify(op.patch),
          });
          if (!res.ok) throw new Error(`PATCH /api/history ${res.status}`);
        }
      }
      queueRef.current = [];
      writeQueue([]);
      setSyncStatus('idle');
      setSyncError(null);
    } catch (e) {
      console.warn('[history] sync failed', e);
      setSyncStatus('error');
      setSyncError(e instanceof Error ? e.message : '同步失败');
    }
  }, [isLoggedIn]);

  // —— 公共操作 API —— //
  const addItem = useCallback(
    (item: HistoryItem) => {
      setItems((prev) => {
        const next = [item, ...prev.filter((p) => p.taskId !== item.taskId)];
        return sortHistoryDesc(truncateHistory(next));
      });
      enqueue({ type: 'add', item });
    },
    [enqueue],
  );

  const removeItem = useCallback(
    (taskId: string) => {
      setItems((prev) => prev.filter((p) => p.taskId !== taskId));
      enqueue({ type: 'delete', taskId });
    },
    [enqueue],
  );

  const removeItems = useCallback(
    (taskIds: string[]) => {
      if (taskIds.length === 0) return;
      setItems((prev) => prev.filter((p) => !taskIds.includes(p.taskId)));
      enqueue({ type: 'batch-delete', taskIds });
    },
    [enqueue],
  );

  const clearAll = useCallback(() => {
    setItems([]);
    enqueue({ type: 'clear' });
  }, [enqueue]);

  const toggleFavorite = useCallback(
    (taskId: string) => {
      let nextFavorited: boolean | undefined;
      setItems((prev) =>
        prev.map((p) => {
          if (p.taskId === taskId) {
            nextFavorited = !p.favorited;
            return { ...p, favorited: nextFavorited };
          }
          return p;
        }),
      );
      // setItems 回调会同步执行；nextFavorited 一定已赋值
      queueMicrotask(() => {
        if (nextFavorited === undefined) return;
        enqueue({ type: 'patch', taskId, patch: { favorited: nextFavorited } });
      });
    },
    [enqueue],
  );

  const updateTags = useCallback(
    (taskId: string, tags: string[]) => {
      setItems((prev) =>
        prev.map((p) => (p.taskId === taskId ? { ...p, tags } : p)),
      );
      enqueue({ type: 'patch', taskId, patch: { tags } });
    },
    [enqueue],
  );

  // —— 手动触发重试 —— //
  const retrySync = useCallback(() => {
    void checkAuthAndLoad();
  }, [checkAuthAndLoad]);

  // —— 重新登录后从服务器拉取（兜底） —— //
  const reloadFromServer = useCallback(async () => {
    await checkAuthAndLoad();
  }, [checkAuthAndLoad]);

  return {
    items,
    hydrated,
    syncStatus,
    syncError,
    isLoggedIn,
    stats: {
      total: items.length,
      favorited: items.filter((i) => i.favorited).length,
      bytes: estimateHistoryBytes(items),
      cap: MAX_HISTORY_ITEMS,
    },
    addItem,
    removeItem,
    removeItems,
    clearAll,
    toggleFavorite,
    updateTags,
    retrySync,
    reloadFromServer,
  };
}
