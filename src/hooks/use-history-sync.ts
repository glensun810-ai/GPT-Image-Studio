'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { HistoryItem, SyncStatus } from '@/lib/types';
import { getHistorySync } from '@/lib/history-sync';

interface UseHistorySyncOptions {
  /** 当前是否已登录 */
  isAuthenticated: boolean;
  /** 本地 history state setter（用于在服务器拉取后更新本地） */
  setLocalHistory: React.Dispatch<React.SetStateAction<HistoryItem[]>>;
  /** 当前本地 history 引用（用于排队推送变更） */
  localHistoryRef: React.MutableRefObject<HistoryItem[]>;
}

/**
 * 历史同步 hook
 *
 * 行为：
 * - 登录后立即从服务器拉取全量历史，合并到本地
 * - 监听 localHistory 变化（通过外部调用 queueChange 入队）
 * - 失败自动重试，可手动 flushNow 强制重试
 */
export function useHistorySync({
  isAuthenticated,
  setLocalHistory,
  localHistoryRef,
}: UseHistorySyncOptions) {
  const [status, setStatus] = useState<SyncStatus>({
    state: 'idle',
    pendingCount: 0,
    lastError: null,
    lastSyncDurationMs: null,
    lastSyncAt: null,
  });
  const lastAuthRef = useRef<boolean>(false);

  // 同步状态订阅
  useEffect(() => {
    const sync = getHistorySync();
    const unsub = sync.subscribe(setStatus);
    return unsub;
  }, []);

  // 登录/登出时切换同步状态
  useEffect(() => {
    const sync = getHistorySync();
    if (isAuthenticated && !lastAuthRef.current) {
      // 刚刚登录：从服务器拉取
      void sync
        .fetchAll()
        .then((serverItems) => {
          const safeItems = Array.isArray(serverItems) ? serverItems : [];
          // 合并策略：服务器数据优先（用户可能在其他设备添加了记录）
          // 保留本地 pendingCount（未同步的本地新增）作为 fallback
          setLocalHistory((prev) => {
            const serverIds = new Set(safeItems.map((i) => i.taskId));
            const localOnly = prev.filter(
              (i) => !serverIds.has(i.taskId) && !i.synced
            );
            // 时间倒序合并
            return [...safeItems, ...localOnly].sort(
              (a, b) => b.createdAt - a.createdAt
            );
          });
        })
        .catch(() => {
          // 拉取失败，本地仍可用
        });
    } else if (!isAuthenticated && lastAuthRef.current) {
      // 刚刚登出：清空队列
      sync.clearQueue();
    }
    lastAuthRef.current = isAuthenticated;
  }, [isAuthenticated, setLocalHistory]);

  /**
   * 通知 sync：某条历史新增/更新
   */
  const queueUpsert = useCallback((item: HistoryItem) => {
    if (!isAuthenticated) return;
    getHistorySync().enqueueUpsert(item);
  }, [isAuthenticated]);

  /**
   * 通知 sync：某条历史已删除
   */
  const queueDelete = useCallback((taskId: string) => {
    if (!isAuthenticated) return;
    getHistorySync().enqueueDelete(taskId);
  }, [isAuthenticated]);

  /**
   * 手动触发重试
   */
  const flushNow = useCallback(() => {
    if (!isAuthenticated) return;
    getHistorySync().flushNow();
  }, [isAuthenticated]);

  /**
   * 批量上传：把当前 localHistory 中所有 synced=false 的项推送到服务器
   */
  const flushAllPending = useCallback(() => {
    if (!isAuthenticated) return;
    const sync = getHistorySync();
    const local = localHistoryRef.current;
    local
      .filter((i) => !i.synced)
      .forEach((i) => sync.enqueueUpsert(i));
  }, [isAuthenticated, localHistoryRef]);

  return {
    status,
    queueUpsert,
    queueDelete,
    flushNow,
    flushAllPending,
  };
}
