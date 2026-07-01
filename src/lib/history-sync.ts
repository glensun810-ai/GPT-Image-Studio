/**
 * 客户端历史同步服务
 *
 * 负责本地 localStorage 与服务器之间的数据同步：
 * - 登录后自动从服务器拉取最新历史
 * - 本地变更后尝试推送到服务器
 * - 失败时进入重试队列
 * - 离线模式下仅写本地
 */

import type { HistoryItem, SyncStatus } from '@/lib/types';
import { withBase } from '@/lib/base-path';

interface SyncTask {
  type: 'upsert' | 'delete';
  taskId: string;
  payload?: HistoryItem;
  attempts: number;
  lastError?: string;
}

const SYNC_QUEUE_KEY = 'gpt-image-studio:sync-queue:v1';
const LAST_SYNC_KEY = 'gpt-image-studio:last-sync:v1';
const MAX_RETRY = 3;
const RETRY_DELAYS = [3000, 10000, 30000]; // 3s, 10s, 30s

type Listener = (status: SyncStatus) => void;

class HistorySync {
  private status: SyncStatus = {
    state: 'idle',
    pendingCount: 0,
    lastSyncAt: localStorage.getItem(LAST_SYNC_KEY),
    lastError: null,
    lastSyncDurationMs: null,
  };
  private listeners = new Set<Listener>();
  private queue: SyncTask[] = [];
  private processing = false;
  private processingTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.loadQueue();
  }

  /**
   * 订阅状态变化
   */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 拉取服务器全量历史
   */
  async fetchAll(): Promise<HistoryItem[]> {
    try {
      const res = await fetch(withBase('/api/history'), {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      });
      if (!res.ok) {
        if (res.status === 401) {
          // 未登录，标记为空
          this.updateStatus({ state: 'offline', lastSyncAt: this.status.lastSyncAt });
          return [];
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const json = await res.json();
      const items: HistoryItem[] = json.data || [];
      this.updateStatus({
        state: 'synced',
        lastSyncAt: new Date().toISOString(),
      });
      localStorage.setItem(LAST_SYNC_KEY, this.status.lastSyncAt || '');
      return items;
    } catch (e) {
      this.updateStatus({
        state: 'error',
        lastError: e instanceof Error ? e.message : String(e),
        lastSyncAt: this.status.lastSyncAt,
      });
      throw e;
    }
  }

  /**
   * 入队：推送 upsert
   */
  enqueueUpsert(item: HistoryItem): void {
    this.removeExistingTask(item.taskId, 'upsert');
    this.removeExistingTask(item.taskId, 'delete');
    this.queue.push({ type: 'upsert', taskId: item.taskId, payload: item, attempts: 0 });
    this.persistQueue();
    this.scheduleProcess();
  }

  /**
   * 入队：推送 delete
   */
  enqueueDelete(taskId: string): void {
    this.removeExistingTask(taskId, 'upsert');
    this.removeExistingTask(taskId, 'delete');
    this.queue.push({ type: 'delete', taskId, attempts: 0 });
    this.persistQueue();
    this.scheduleProcess();
  }

  /**
   * 清空队列（登录登出切换时使用）
   */
  clearQueue(): void {
    this.queue = [];
    this.persistQueue();
    this.updateStatus({ state: 'idle', pendingCount: 0 });
  }

  /**
   * 立即尝试处理队列（用户主动触发）
   */
  flushNow(): void {
    if (this.processingTimer) {
      clearTimeout(this.processingTimer);
      this.processingTimer = null;
    }
    void this.processQueue();
  }

  private removeExistingTask(taskId: string, type: 'upsert' | 'delete'): void {
    this.queue = this.queue.filter((t) => !(t.taskId === taskId && t.type === type));
  }

  private scheduleProcess(): void {
    if (this.processing) return;
    if (this.processingTimer) return;
    this.processingTimer = setTimeout(() => {
      this.processingTimer = null;
      void this.processQueue();
    }, 500);
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    if (this.queue.length === 0) {
      this.updateStatus({
        state: this.status.state === 'syncing' ? 'synced' : this.status.state,
        pendingCount: 0,
      });
      return;
    }
    this.processing = true;
    this.updateStatus({ state: 'syncing', pendingCount: this.queue.length });

    const task = this.queue[0];
    try {
      if (task.type === 'upsert' && task.payload) {
        await this.upsertToServer(task.payload);
      } else if (task.type === 'delete') {
        await this.deleteFromServer(task.taskId);
      }
      // 成功：从队列移除
      this.queue.shift();
      this.persistQueue();
      this.processing = false;
      // 继续处理下一个
      void this.processQueue();
    } catch (e) {
      task.attempts += 1;
      task.lastError = e instanceof Error ? e.message : String(e);
      this.persistQueue();
      if (task.attempts >= MAX_RETRY) {
        // 超出重试次数：丢弃任务，避免无限循环
        this.queue.shift();
        this.persistQueue();
        this.processing = false;
        this.updateStatus({
          state: 'error',
          lastError: `同步失败（已重试 ${MAX_RETRY} 次）: ${task.lastError}`,
          pendingCount: this.queue.length,
        });
        // 继续处理下一个
        if (this.queue.length > 0) {
          this.processing = false;
          this.scheduleProcess();
        }
        return;
      }
      this.processing = false;
      this.updateStatus({
        state: 'error',
        lastError: `同步失败：${task.lastError}（${task.attempts}/${MAX_RETRY}）`,
        pendingCount: this.queue.length,
      });
      // 退避后重试
      const delay = RETRY_DELAYS[task.attempts - 1] || 30000;
      this.processingTimer = setTimeout(() => {
        this.processingTimer = null;
        void this.processQueue();
      }, delay);
    }
  }

  private async upsertToServer(item: HistoryItem): Promise<void> {
    const res = await fetch(withBase('/api/history'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(item),
    });
    if (!res.ok) {
      if (res.status === 401) {
        // 未登录，标记为离线并丢弃
        this.clearQueue();
        this.updateStatus({ state: 'offline' });
        throw new Error('未登录');
      }
      throw new Error(`HTTP ${res.status}`);
    }
  }

  private async deleteFromServer(taskId: string): Promise<void> {
    const res = await fetch(withBase(`/api/history/${encodeURIComponent(taskId)}`), {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) {
      if (res.status === 404) return; // 已经不存在
      if (res.status === 401) {
        this.clearQueue();
        this.updateStatus({ state: 'offline' });
        throw new Error('未登录');
      }
      throw new Error(`HTTP ${res.status}`);
    }
  }

  private loadQueue(): void {
    try {
      const raw = localStorage.getItem(SYNC_QUEUE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.queue = Array.isArray(parsed) ? parsed : [];
      }
    } catch {
      this.queue = [];
    }
    this.updateStatus({ pendingCount: this.queue.length });
  }

  private persistQueue(): void {
    try {
      localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(this.queue));
    } catch {
      // ignore quota errors
    }
    this.updateStatus({ pendingCount: this.queue.length });
  }

  private updateStatus(partial: Partial<SyncStatus>): void {
    this.status = { ...this.status, ...partial };
    this.listeners.forEach((l) => l(this.status));
  }
}

// 单例
let instance: HistorySync | null = null;

export function getHistorySync(): HistorySync {
  if (typeof window === 'undefined') {
    // SSR 场景下提供一个空实现
    return {
      subscribe: () => () => {},
      fetchAll: async () => [],
      enqueueUpsert: () => {},
      enqueueDelete: () => {},
      clearQueue: () => {},
      flushNow: () => {},
    } as unknown as HistorySync;
  }
  if (!instance) {
    instance = new HistorySync();
  }
  return instance;
}
