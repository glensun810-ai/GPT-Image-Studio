/**
 * API 基础配置
 *
 * 集中管理 apimart / apib.ai 的 endpoint 和错误处理，避免散落硬编码。
 * 2026-06 域名迁移：apimart.ai → apib.ai。
 */

export const API_BASE_URL = 'https://api.apib.ai';

/** 提交图像生成的 endpoint */
export const API_GENERATE_PATH = '/v1/images/generations';

/** 异步任务查询 endpoint（GET 形式，taskId 拼到路径） */
export function buildTaskQueryUrl(taskId: string): string {
  return `${API_BASE_URL}/v1/tasks/${encodeURIComponent(taskId)}`;
}

/**
 * 识别是否是网络层错误
 * - fetch failed / DNS / connect refused / timeout
 */
const NETWORK_ERROR_PATTERNS = [
  /fetch failed/i,
  /ENOTFOUND/,
  /ENETUNREACH/,
  /ECONNREFUSED/,
  /ETIMEDOUT/,
  /EAI_AGAIN/,
  /EHOSTUNREACH/,
  /ECONNRESET/,
  /Network request failed/i,
];

const NETWORK_ERROR_TYPE_HINTS = [
  'network_error',
  'fetch_error',
  'connection_error',
];

export function isNetworkError(err: unknown): boolean {
  if (!err) return false;
  // Node.js fetch error
  if (err instanceof Error) {
    const message = err.message || '';
    if (NETWORK_ERROR_PATTERNS.some((re) => re.test(message))) return true;
    // Check cause
    const cause = (err as { cause?: { code?: string } }).cause;
    if (cause?.code && NETWORK_ERROR_PATTERNS.some((re) => re.test(cause.code!))) {
      return true;
    }
  }
  // Plain object
  if (typeof err === 'object') {
    const obj = err as { type?: string; code?: string; message?: string };
    if (obj.type && NETWORK_ERROR_TYPE_HINTS.includes(obj.type)) return true;
    if (obj.code && NETWORK_ERROR_PATTERNS.some((re) => re.test(obj.code!))) {
      return true;
    }
  }
  return false;
}

/** 网络错误的中文提示 */
export const NETWORK_ERROR_MESSAGE =
  '服务器无法连接到 apib.ai（沙箱网络受限或域名 DNS 失败）。请检查：\n1. 预览域名是否允许出站 HTTPS\n2. 浏览器开发者工具 Network 面板查看 /api/generate 是否真正返回 5xx';

export type ApiErrorPayload = {
  code?: number | string;
  message: string;
  type?: string;
};

/** 统一从 apib.ai 响应中提取错误对象 */
export function extractUpstreamError(
  body: unknown,
  fallbackStatus: number,
): ApiErrorPayload {
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    const errObj = (b.error && typeof b.error === 'object' ? b.error : b) as Record<
      string,
      unknown
    >;
    return {
      code:
        typeof errObj.code === 'number' || typeof errObj.code === 'string'
          ? (errObj.code as number | string)
          : fallbackStatus,
      message:
        typeof errObj.message === 'string'
          ? errObj.message
          : `请求失败 (HTTP ${fallbackStatus})`,
      type: typeof errObj.type === 'string' ? errObj.type : 'upstream_error',
    };
  }
  return {
    code: fallbackStatus,
    message: `请求失败 (HTTP ${fallbackStatus})`,
    type: 'upstream_error',
  };
}
