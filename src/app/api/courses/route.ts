import { NextResponse } from "next/server";
import { db } from "@/db";
import { courses, sessions, questions } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireTeacher } from "@/lib/auth";

// 教員: 授業一覧（未対応質問数付き）
export async function GET() {
  try {
    await requireTeacher();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const courseList = await db
    .select()
    .from(courses)
    .orderBy(courses.createdAt);

  if (courseList.length === 0) return NextResponse.json([]);

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

// 授業作成（授業名のみ。コード・パスワードは自動生成）
export async function POST(req: Request) {
  try {
    await requireTeacher();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "授業名は必須です" }, { status: 400 });
  }

  // コードは衝突しないようランダム生成（内部管理用）
  const code = Math.random().toString(36).slice(2, 8).toUpperCase();

  try {
    const [course] = await db
      .insert(courses)
      .values({ name: name.trim(), code, password: "-" })
      .returning();
    return NextResponse.json(course, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[POST /api/courses]", msg);
    return NextResponse.json({ error: `DBエラー: ${msg}` }, { status: 500 });
  }
}
