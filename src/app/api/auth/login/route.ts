import { NextRequest, NextResponse } from "next/server";
import { authenticate, createSession, COOKIE_OPTIONS } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: "请输入用户名和密码" },
        { status: 400 }
      );
    }

    const user = authenticate(username, password);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "用户名或密码错误，请联系微信 sgl810 获取账号" },
        { status: 401 }
      );
    }

    const token = await createSession(user);

    const response = NextResponse.json({
      success: true,
      data: { username: user.username, displayName: user.displayName, token },
    });

    response.cookies.set(COOKIE_OPTIONS.name, token, {
      httpOnly: COOKIE_OPTIONS.httpOnly,
      secure: COOKIE_OPTIONS.secure,
      sameSite: COOKIE_OPTIONS.sameSite,
      path: COOKIE_OPTIONS.path,
      maxAge: COOKIE_OPTIONS.maxAge,
    });

    return response;
  } catch {
    return NextResponse.json(
      { success: false, error: "登录失败，请重试" },
      { status: 500 }
    );
  }
}
