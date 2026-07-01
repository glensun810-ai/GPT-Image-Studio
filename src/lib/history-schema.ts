// 历史记录数据校验与存储工具（客户端 / 服务端共用）

import type { HistoryItem } from './types';

// —— Schema 校验 —— //
export const MAX_HISTORY_ITEMS = 500;
export const MAX_PROMPT_LENGTH = 2000;
export const MAX_TAG_LENGTH = 16;
export const MAX_TAGS = 12;

function isNonEmptyString(v: unknown, max = 1024): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= max;
}

export function isValidHistoryItem(v: unknown): v is HistoryItem {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  if (!isNonEmptyString(o.taskId, 128)) return false;
  if (!isNonEmptyString(o.prompt, MAX_PROMPT_LENGTH)) return false;
  if (!isNonEmptyString(o.size, 32)) return false;
  if (!isNonEmptyString(o.resolution, 16)) return false;
  if (typeof o.imageUrl !== 'string' || o.imageUrl.length > 2048) return false;
  if (typeof o.createdAt !== 'number' || !Number.isFinite(o.createdAt)) return false;
  if (!Array.isArray(o.tags)) return false;
  if (o.tags.length > MAX_TAGS) return false;
  if (!o.tags.every((t) => isNonEmptyString(t, MAX_TAG_LENGTH))) return false;
  if (typeof o.favorited !== 'boolean') return false;
  if (o.error !== undefined && (typeof o.error !== 'string' || o.error.length > 500)) return false;
  return true;
}

export function sanitizeHistory(items: unknown): HistoryItem[] {
  if (!Array.isArray(items)) return [];
  const result: HistoryItem[] = [];
  for (const item of items) {
    if (isValidHistoryItem(item)) {
      result.push({
        taskId: item.taskId,
        prompt: item.prompt,
        size: item.size,
        resolution: item.resolution,
        imageUrl: item.imageUrl,
        createdAt: item.createdAt,
        tags: item.tags,
        favorited: item.favorited,
        error: item.error,
      });
    }
  }
  return result;
}

export function dedupeHistory(items: HistoryItem[]): HistoryItem[] {
  const map = new Map<string, HistoryItem>();
  for (const item of items) {
    map.set(item.taskId, item); // 后写入覆盖前写入
  }
  return Array.from(map.values());
}

export function sortHistoryDesc(items: HistoryItem[]): HistoryItem[] {
  return [...items].sort((a, b) => b.createdAt - a.createdAt);
}

export function truncateHistory(items: HistoryItem[]): HistoryItem[] {
  return items.slice(0, MAX_HISTORY_ITEMS);
}

export function estimateHistoryBytes(items: HistoryItem[]): number {
  return items.reduce((sum, item) => sum + JSON.stringify(item).length, 0);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
