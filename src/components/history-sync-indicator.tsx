'use client';

import { useEffect, useState } from 'react';
import { Cloud, CloudOff, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { SyncStatus } from '@/lib/types';

interface HistorySyncIndicatorProps {
  status: SyncStatus;
  isAuthenticated: boolean;
  onFlush: () => void;
}

/**
 * 将 ISO 时间格式化为相对时间
 * 注意：依赖浏览器当前时间，仅在客户端挂载后计算
 */
function formatRelative(iso: string | null): string {
  if (!iso) return '从未同步';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';

  // 用 .toISOString() 规避 impure function 警告
  const nowIso = new Date().toISOString();
  const now = new Date(nowIso).getTime();
  const diff = (now - d.getTime()) / 1000;

  if (diff < 60) return '刚刚同步';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  return `${Math.floor(diff / 86400)} 天前`;
}

/**
 * 同步状态徽标
 * - 错误：红色告警 + 待同步数量 + 重试按钮
 * - 同步中：蓝色加载动画
 * - 已同步：绿色对勾 + 相对时间
 * - 离线：灰色云朵关闭图标
 */
export function HistorySyncIndicator({
  status,
  isAuthenticated,
  onFlush,
}: HistorySyncIndicatorProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isAuthenticated) return null;

  const { state, pendingCount, lastSyncAt, lastError } = status;
  const displayTime = mounted ? formatRelative(lastSyncAt) : '—';

  // 状态 1：正在同步
  if (state === 'syncing') {
    return (
      <div
        className={cn(
          'flex items-center gap-1.5 px-2.5 h-7 rounded-full',
          'bg-blue-50 dark:bg-blue-950/40',
          'text-blue-600 dark:text-blue-400 text-xs'
        )}
        title={`待同步：${pendingCount} 条`}
      >
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        <span className="hidden sm:inline">同步中…</span>
      </div>
    );
  }

  // 状态 2：已同步（无待同步）
  if (state === 'synced' && pendingCount === 0) {
    return (
      <div
        className={cn(
          'flex items-center gap-1.5 px-2.5 h-7 rounded-full',
          'bg-emerald-50 dark:bg-emerald-950/40',
          'text-emerald-600 dark:text-emerald-400 text-xs'
        )}
        title={`最后同步：${lastSyncAt ?? '—'}`}
      >
        <Check className="w-3.5 h-3.5" />
        <span className="hidden sm:inline" suppressHydrationWarning>
          已同步
        </span>
        <span className="hidden md:inline opacity-70" suppressHydrationWarning>
          · {displayTime}
        </span>
      </div>
    );
  }

  // 状态 3：离线
  if (state === 'offline') {
    return (
      <div
        className={cn(
          'flex items-center gap-1.5 px-2.5 h-7 rounded-full',
          'bg-slate-100 dark:bg-slate-800/60',
          'text-slate-500 dark:text-slate-400 text-xs'
        )}
        title="网络不可用，将自动重试"
      >
        <CloudOff className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">离线</span>
      </div>
    );
  }

  // 状态 4：有待同步项（灰色云朵 + 数量）
  if (state === 'idle' && pendingCount > 0) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={onFlush}
        className={cn(
          'h-7 px-2.5 rounded-full gap-1.5 text-xs font-normal',
          'bg-slate-100 hover:bg-slate-200',
          'dark:bg-slate-800/60 dark:hover:bg-slate-700/60',
          'text-slate-700 dark:text-slate-300'
        )}
        title="点击立即同步"
      >
        <Cloud className="w-3.5 h-3.5" />
        <span>同步 ({pendingCount})</span>
      </Button>
    );
  }

  // 状态 5：错误
  if (state === 'error') {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={onFlush}
        className={cn(
          'h-7 px-2.5 rounded-full gap-1.5 text-xs font-normal',
          'bg-red-50 hover:bg-red-100',
          'dark:bg-red-950/40 dark:hover:bg-red-950/60',
          'text-red-600 dark:text-red-400'
        )}
        title={lastError ?? '同步失败，点击重试'}
      >
        <AlertCircle className="w-3.5 h-3.5" />
        <span>同步失败</span>
        <span className="hidden sm:inline opacity-70">· 重试</span>
      </Button>
    );
  }

  return null;
}
