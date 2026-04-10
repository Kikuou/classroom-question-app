import { NextResponse } from "next/server";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { isTeacher, createTeacherToken } from "@/lib/auth";

const KEY = "teacher_password";

// パスワード設定済みかチェック
export async function GET() {
  const [row] = await db.select().from(settings).where(eq(settings.key, KEY));
  return NextResponse.json({ configured: !!row });
}

// 初回パスワード設定（未設定時のみ）
export async function POST(req: Request) {
  const [existing] = await db.select().from(settings).where(eq(settings.key, KEY));
  if (existing) {
    return NextResponse.json({ error: "既にパスワードが設定されています" }, { status: 409 });
  }
  const { password } = await req.json();
  if (!password || password.length < 4) {
    return NextResponse.json({ error: "4文字以上のパスワードを入力してください" }, { status: 400 });
  }
  const hashed = await bcrypt.hash(password, 10);
  await db.insert(settings).values({ key: KEY, value: hashed });

  // 設定後は自動ログイン
  const token = await createTeacherToken();
  const res = NextResponse.json({ ok: true }, { status: 201 });
  res.cookies.set("teacher_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
    path: "/",
  });
  return res;
}

// パスワード変更（要ログイン）
export async function PATCH(req: Request) {
  if (!(await isTeacher())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { password } = await req.json();
  if (!password || password.length < 4) {
    return NextResponse.json({ error: "4文字以上のパスワードを入力してください" }, { status: 400 });
  }
  const hashed = await bcrypt.hash(password, 10);
  await db
    .insert(settings)
    .values({ key: KEY, value: hashed })
    .onConflictDoUpdate({ target: settings.key, set: { value: hashed } });
  return NextResponse.json({ ok: true });
}
