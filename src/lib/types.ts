// 全局共享类型定义

import { z } from 'zod';

export interface HistoryItem {
  taskId: string;
  prompt: string;
  size: string;
  resolution: string;
  imageUrl: string;
  createdAt: number;
  tags: string[];
  favorited: boolean;
  /**
   * 生成失败时的错误信息
   */
  error?: string;
  /**
   * 是否已成功同步到服务器
   * - true：本地与服务器一致
   * - false：本地有未同步的修改
   * - undefined：未登录或未启用同步功能
   */
  synced?: boolean;
  /**
   * 最后更新时间（毫秒时间戳），服务器字段
   */
  updatedAt?: number;
}

export interface Template {
  id: string;
  title: string;
  category: '人物' | '产品' | '场景' | '风格' | '其他';
  content: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface AuthUser {
  username: string;
  displayName?: string;
}

// ───────────────────────── Zod Schemas ─────────────────────────

export const HistoryItemSchema = z.object({
  taskId: z.string().min(1).max(128),
  prompt: z.string().max(8000).default(''),
  size: z.string().max(32).default('1:1'),
  resolution: z.string().max(8).default('1k'),
  imageUrl: z.string().url().or(z.literal('')).default(''),
  createdAt: z.number().int().nonnegative(),
  tags: z.array(z.string().min(1).max(32)).max(32).default([]),
  favorited: z.boolean().default(false),
  error: z.string().max(500).optional(),
  synced: z.boolean().optional(),
});

export const HistoryItemListSchema = z.array(HistoryItemSchema);

export const HistoryPatchSchema = z
  .object({
    favorited: z.boolean().optional(),
    tags: z.array(z.string().min(1).max(32)).max(32).optional(),
    prompt: z.string().max(8000).optional(),
    imageUrl: z.string().url().or(z.literal('')).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: '至少提供一个需要更新的字段',
  });

export const BatchDeleteSchema = z.object({
  taskIds: z.array(z.string().min(1).max(128)).min(1).max(500),
});

/**
 * 服务端存储形态：与客户端 HistoryItem 几乎一致，
 * 唯一差异是增加了 ownerUsername 字段（永远不返回给客户端）
 */
export interface HistoryServerShape extends HistoryItem {
  ownerUsername: string;
  updatedAt: number;
}

// ───────────────────────── Sync Status ─────────────────────────

export type SyncState = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

export interface SyncStatus {
  /** 当前同步状态 */
  state: SyncState;
  /** 待同步的本地项数 */
  pendingCount: number;
  /** 最后一次成功同步的 ISO 时间 */
  lastSyncAt: string | null;
  /** 最近一次错误描述 */
  lastError: string | null;
  /** 最近一次同步耗时（毫秒） */
  lastSyncDurationMs: number | null;
}
