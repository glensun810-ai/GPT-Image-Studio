import { NextRequest, NextResponse } from 'next/server';
import { getSession, sessionError } from '@/lib/auth';
import {
  API_BASE_URL,
  API_GENERATE_PATH,
  extractUpstreamError,
  isNetworkError,
  NETWORK_ERROR_MESSAGE,
} from '@/lib/api-config';

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return sessionError();
  }

  try {
    const body = await request.json();
    const apiKey = request.headers.get('x-apimart-key');

    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      return NextResponse.json({
        success: false,
        error: { code: 401, message: '请提供有效的 API Key', type: 'authentication_error' },
      });
    }

    const payload: Record<string, unknown> = {
      model: 'gpt-image-2',
      prompt: body.prompt,
      n: body.n ?? 1,
      size: body.size ?? '1:1',
      resolution: body.resolution ?? '1k',
    };

    if (body.image_urls && Array.isArray(body.image_urls) && body.image_urls.length > 0) {
      payload.image_urls = body.image_urls;
    }

    if (body.official_fallback !== undefined) {
      payload.official_fallback = body.official_fallback;
    }

    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}${API_GENERATE_PATH}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (netErr) {
      // 网络层异常（DNS 失败 / 连接超时 / fetch failed）
      console.error('[generate] network error:', netErr);
      return NextResponse.json({
        success: false,
        error: {
          code: 503,
          message: isNetworkError(netErr) ? NETWORK_ERROR_MESSAGE : '请求上游失败',
          type: 'network_error',
        },
      });
    }

    // 尝试解析 JSON 响应（无论状态码）
    let data: unknown = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const err = extractUpstreamError(data, response.status);
      console.warn('[generate] upstream non-2xx:', response.status, err);
      return NextResponse.json({ success: false, error: err });
    }

    // 部分业务异常会返回 HTTP 200 + body.code !== 200
    if (data && typeof data === 'object') {
      const bodyCode = (data as { code?: number }).code;
      if (typeof bodyCode === 'number' && bodyCode !== 200) {
        const err = extractUpstreamError(data, bodyCode);
        console.warn('[generate] upstream business error:', bodyCode, err);
        return NextResponse.json({ success: false, error: err });
      }
    }

    return NextResponse.json({ success: true, data: (data as { data?: unknown })?.data ?? null });
  } catch (error: unknown) {
    console.error('[generate] server error:', error);
    const message =
      isNetworkError(error)
        ? NETWORK_ERROR_MESSAGE
        : error instanceof Error
          ? error.message
          : '服务器内部错误';
    return NextResponse.json({
      success: false,
      error: { code: 500, message, type: 'server_error' },
    });
  }
}
