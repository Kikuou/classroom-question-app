import { NextResponse } from "next/server";
import { db } from "@/db";
import { courses } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getTeacherCourseId } from "@/lib/auth";

// 教員: 自分の授業一覧取得
export async function GET() {
  const courseId = await getTeacherCourseId();
  if (!courseId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await db
    .select()
    .from(courses)
    .where(eq(courses.id, courseId));
  return NextResponse.json(result);
}

// 授業作成（誰でも可、パスワード設定）
export async function POST(req: Request) {
  const { name, code, password } = await req.json();
  if (!name || !code || !password) {
    return NextResponse.json({ error: "必須項目が不足しています" }, { status: 400 });
  }
  const hashed = await bcrypt.hash(password, 10);
  try {
    const [course] = await db
      .insert(courses)
      .values({ name, code: code.toUpperCase(), password: hashed })
      .returning();
    return NextResponse.json(course, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // PostgreSQL UNIQUE 制約違反 (error code 23505)
    if (msg.includes("23505") || msg.includes("unique")) {
      return NextResponse.json(
        { error: "授業コードが既に使用されています" },
        { status: 409 }
      );
    }
    // テーブル未作成・DB接続失敗などはそのままメッセージを返す
    console.error("[POST /api/courses]", msg);
    return NextResponse.json(
      { error: `DBエラー: ${msg}` },
      { status: 500 }
    );
  }
}
