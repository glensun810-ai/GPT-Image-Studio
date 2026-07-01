/**
 * 应用部署的基础路径
 * 生产环境: /GPT-Image-Studio
 * 本地开发: ''（空字符串）
 *
 * 所有硬编码的前端路径应使用本常量拼接，而非写死字符串。
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

/**
 * 拼接基础路径到给定路径前
 * 示例: withBase('/api/auth/login') => '/GPT-Image-Studio/api/auth/login'
 */
export function withBase(path: string): string {
  if (!path.startsWith('/')) {
    path = '/' + path;
  }
  return BASE_PATH ? `${BASE_PATH}${path}` : path;
}
