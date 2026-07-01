import { NextRequest, NextResponse } from 'next/server';
import { getSession, sessionError } from '@/lib/auth';
import {
  buildTaskQueryUrl,
  extractUpstreamError,
  isNetworkError,
  NETWORK_ERROR_MESSAGE,
} from '@/lib/api-config';

export async function GET(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return sessionError();
  }

  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('task_id');
    const apiKey = request.headers.get('x-apimart-key');

    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      return NextResponse.json({
        success: false,
        error: { code: 401, message: '请提供有效的 API Key', type: 'authentication_error' },
      });
    }

    if (!taskId || typeof taskId !== 'string' || taskId.trim() === '') {
      return NextResponse.json({
        success: false,
        error: { code: 400, message: '请提供 task_id', type: 'invalid_request_error' },
      });
    }

    let response: Response;
    try {
      response = await fetch(buildTaskQueryUrl(taskId.trim()), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (netErr) {
      console.error('[task.GET] network error:', netErr);
      return NextResponse.json({
        success: false,
        error: {
          code: 503,
          message: isNetworkError(netErr) ? NETWORK_ERROR_MESSAGE : '请求上游失败',
          type: 'network_error',
        },
      });
    }

    let data: unknown = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const err = extractUpstreamError(data, response.status);
      console.warn('[task.GET] upstream non-2xx:', response.status, err);
      return NextResponse.json({ success: false, error: err });
    }

    if (data && typeof data === 'object') {
      const bodyCode = (data as { code?: number }).code;
      if (typeof bodyCode === 'number' && bodyCode !== 200) {
        const err = extractUpstreamError(data, bodyCode);
        console.warn('[task.GET] upstream business error:', bodyCode, err);
        return NextResponse.json({ success: false, error: err });
      }
    }

    return NextResponse.json({
      success: true,
      data: (data as { data?: unknown })?.data ?? null,
    });
  } catch (error: unknown) {
    console.error('[task.GET] server error:', error);
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
