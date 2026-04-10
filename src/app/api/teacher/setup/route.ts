import { NextResponse } from "next/server";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { isTeacher, createTeacherToken } from "@/lib/auth";

const KEY = "teacher_password";

// パスワード設定済みかチェック（DBエラー時は未設定扱い）
export async function GET() {
  try {
    const [row] = await db.select().from(settings).where(eq(settings.key, KEY));
    return NextResponse.json({ configured: !!row });
  } catch {
    // settingsテーブル未作成など → 未設定扱い
    return NextResponse.json({ configured: false });
  }
}

// 初回パスワード設定（未設定時のみ）
export async function POST(req: Request) {
  const { password } = await req.json();
  if (!password || password.length < 4) {
    return NextResponse.json({ error: "4文字以上のパスワードを入力してください" }, { status: 400 });
  }

  try {
    const [existing] = await db.select().from(settings).where(eq(settings.key, KEY));
    if (existing) {
      return NextResponse.json({ error: "既にパスワードが設定されています" }, { status: 409 });
    }
    const hashed = await bcrypt.hash(password, 10);
    await db.insert(settings).values({ key: KEY, value: hashed });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // settingsテーブルが存在しない
    if (msg.includes("settings") || msg.includes("relation") || msg.includes("does not exist")) {
      return NextResponse.json(
        { error: "DBテーブルが未作成です。Neon SQL Editorで初期SQLを実行してください。" },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: `DBエラー: ${msg}` }, { status: 500 });
  }

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
