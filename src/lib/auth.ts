import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import crypto from "crypto";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "gpt-image-studio-secret-key-2024"
);

const COOKIE_NAME = "gpt_session";

// Allowed users - passwords stored as salted SHA-256 hashes
// NEVER store plaintext passwords
const ALLOWED_USERS: Array<{
  username: string;
  passwordHash: string;
  passwordSalt: string;
  displayName: string;
}> = [
  {
    username: "sgl810",
    // SHA-256(password + salt) — original password removed from code
    passwordHash:
      "e158f6a0493ea5a7846c6d10decaaa83b7aff11b7de988cff6d98574bb5f5b64",
    passwordSalt: "f8815597855eae6010b7d034c9dde1dd",
    displayName: "sgl810",
  },
];

export interface SessionPayload {
  username: string;
  displayName: string;
}

function verifyPassword(password: string, hash: string, salt: string): boolean {
  const computedHash = crypto
    .createHash("sha256")
    .update(password + salt)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(computedHash, "hex"),
    Buffer.from(hash, "hex")
  );
}

export async function createSession(payload: SessionPayload): Promise<string> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
  return token;
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return {
      username: payload.username as string,
      displayName: payload.displayName as string,
    };
  } catch {
    return null;
  }
}

export async function getSession(req?: Request): Promise<SessionPayload | null> {
  // 1. 先尝试从 cookie 读（浏览器自动带上）
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(COOKIE_NAME)?.value;
  if (cookieToken) {
    const session = await verifySession(cookieToken);
    if (session) return session;
  }
  // 2. cookie 失效时回退到 Authorization: Bearer（前端 localStorage）
  if (req) {
    const auth = req.headers.get("authorization") || req.headers.get("Authorization");
    if (auth && auth.toLowerCase().startsWith("bearer ")) {
      const bearerToken = auth.slice(7).trim();
      if (bearerToken) {
        return verifySession(bearerToken);
      }
    }
  }
  return null;
}

export function authenticate(username: string, password: string): SessionPayload | null {
  const user = ALLOWED_USERS.find((u) => u.username === username);
  if (!user) return null;
  if (!verifyPassword(password, user.passwordHash, user.passwordSalt)) return null;
  return { username: user.username, displayName: user.displayName };
}

export const COOKIE_OPTIONS = {
  name: COOKIE_NAME,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7, // 7 days
};

/**
 * 返回一个标准的 401 响应，明确标记这是"session 失效"错误。
 * 前端会基于 `error.session === true` 判定是否要触发自动登出。
 * 不要在"apib.ai key 错误"等其他 401 上使用本函数。
 */
export function sessionError(message: string = "请先登录") {
  return NextResponse.json(
    {
      success: false,
      error: { code: 401, message, type: "auth_error", session: true },
    },
    { status: 401 }
  );
}
