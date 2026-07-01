import { NextRequest, NextResponse } from "next/server";
import { COOKIE_OPTIONS, getSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json(
      { success: false, error: "未登录" },
      { status: 401 }
    );
  }

  const response = NextResponse.json({ success: true });

  response.cookies.set(COOKIE_OPTIONS.name, "", {
    httpOnly: COOKIE_OPTIONS.httpOnly,
    secure: COOKIE_OPTIONS.secure,
    sameSite: COOKIE_OPTIONS.sameSite,
    path: COOKIE_OPTIONS.path,
    maxAge: 0,
  });

  return response;
}
