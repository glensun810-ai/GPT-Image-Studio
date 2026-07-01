import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

/**
 * GET /api/auth/check
 * 始终返回 200，通过 body 告知调用方是否已登录。
 * 这样设计的好处：
 * 1. 前端 fetch 不会因为 401 误判为 session 失效
 * 2. 上层业务可以随时调用，无需关心鉴权
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({
      success: true,
      authenticated: false,
      data: null,
    });
  }
  return NextResponse.json({
    success: true,
    authenticated: true,
    data: { username: session.username, displayName: session.displayName },
  });
}
