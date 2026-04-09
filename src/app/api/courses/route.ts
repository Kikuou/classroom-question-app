import { NextResponse } from "next/server";
import { db } from "@/db";
import { courses, sessions, questions } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { requireTeacher } from "@/lib/auth";

// 教員: 自分の授業一覧（未対応質問数付き）
export async function GET() {
  let teacherId: number;
  try {
    teacherId = await requireTeacher();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const courseList = await db
    .select()
    .from(courses)
    .where(eq(courses.teacherId, teacherId))
    .orderBy(courses.createdAt);

  if (courseList.length === 0) return NextResponse.json([]);

  // 各授業の未対応質問数を取得
  const pendingRows = await db
    .select({
      courseId: sessions.courseId,
      pendingCount: sql<number>`cast(count(${questions.id}) as int)`,
    })
    .from(sessions)
    .innerJoin(
      questions,
      and(
        eq(questions.sessionId, sessions.id),
        eq(questions.status, "pending"),
        eq(questions.isDeleted, false)
      )
    )
    .where(eq(sessions.isDeleted, false))
    .groupBy(sessions.courseId);

  const pendingMap: Record<number, number> = {};
  pendingRows.forEach((p) => { pendingMap[p.courseId] = p.pendingCount; });

  return NextResponse.json(
    courseList.map((c) => ({ ...c, pendingCount: pendingMap[c.id] ?? 0 }))
  );
}

// 授業作成（要ログイン）
export async function POST(req: Request) {
  let teacherId: number;
  try {
    teacherId = await requireTeacher();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, code, password } = await req.json();
  if (!name?.trim() || !code?.trim() || !password) {
    return NextResponse.json({ error: "必須項目が不足しています" }, { status: 400 });
  }
  const hashed = await bcrypt.hash(password, 10);
  try {
    const [course] = await db
      .insert(courses)
      .values({ name: name.trim(), code: code.trim().toUpperCase(), password: hashed, teacherId })
      .returning();
    return NextResponse.json(course, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("23505") || msg.includes("unique")) {
      return NextResponse.json({ error: "授業コードが既に使用されています" }, { status: 409 });
    }
    console.error("[POST /api/courses]", msg);
    return NextResponse.json({ error: `DBエラー: ${msg}` }, { status: 500 });
  }
}
