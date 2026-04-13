import { NextResponse } from "next/server";
import { db } from "@/db";
import { courses, sessions, questions } from "@/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { requireTeacher } from "@/lib/auth";

// 教員: 授業一覧（未対応質問数 + セッション一覧付き）
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

  const courseIds = courseList.map((c) => c.id);

  // 未対応質問数（授業別）— courseId で直接集計（sessionId=null の質問も含む）
  const pendingRows = await db
    .select({
      courseId: questions.courseId,
      pendingCount: sql<number>`cast(count(${questions.id}) as int)`,
    })
    .from(questions)
    .where(
      and(
        eq(questions.status, "pending"),
        eq(questions.isDeleted, false),
        inArray(questions.courseId, courseIds)
      )
    )
    .groupBy(questions.courseId);

  const pendingMap: Record<number, number> = {};
  pendingRows.forEach((p) => { if (p.courseId != null) pendingMap[p.courseId] = p.pendingCount; });

  // セッション一覧（全授業まとめて取得）
  const sessionRows = await db
    .select({
      id: sessions.id,
      courseId: sessions.courseId,
      title: sessions.title,
      isOpen: sessions.isOpen,
      discussionOpen: sessions.discussionOpen,
      sortOrder: sessions.sortOrder,
      createdAt: sessions.createdAt,
    })
    .from(sessions)
    .where(and(eq(sessions.isDeleted, false), inArray(sessions.courseId, courseIds)))
    .orderBy(sessions.sortOrder, sessions.createdAt);

  const sessionMap: Record<number, typeof sessionRows> = {};
  sessionRows.forEach((s) => {
    if (!sessionMap[s.courseId]) sessionMap[s.courseId] = [];
    sessionMap[s.courseId].push(s);
  });

  return NextResponse.json(
    courseList.map((c) => ({
      ...c,
      pendingCount: pendingMap[c.id] ?? 0,
      sessions: sessionMap[c.id] ?? [],
    }))
  );
}

// 授業作成（授業名のみ）
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

  const code = Math.random().toString(36).slice(2, 8).toUpperCase();

  try {
    const [course] = await db
      .insert(courses)
      .values({ name: name.trim(), code, password: "-" })
      .returning();
    return NextResponse.json({ ...course, pendingCount: 0, sessions: [] }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[POST /api/courses]", msg);
    return NextResponse.json({ error: `DBエラー: ${msg}` }, { status: 500 });
  }
}
