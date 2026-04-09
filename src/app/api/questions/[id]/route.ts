import { NextResponse } from "next/server";
import { db } from "@/db";
import { questions, sessions, courses } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireTeacher } from "@/lib/auth";

// ステータス変更（教員のみ）
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await requireTeacher();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { status } = await req.json();
  const validStatuses = ["pending", "answered", "later", "hidden"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "無効なステータスです" }, { status: 400 });
  }
  const [q] = await db
    .update(questions)
    .set({ status })
    .where(eq(questions.id, parseInt(id)))
    .returning();
  return NextResponse.json(q);
}

// 質問論理削除（教員のみ）
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const questionId = parseInt(id);
  let teacherId: number;
  try {
    teacherId = await requireTeacher();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 自分の授業の質問か確認
  const [existing] = await db
    .select({ id: questions.id })
    .from(questions)
    .innerJoin(sessions, eq(questions.sessionId, sessions.id))
    .innerJoin(courses, eq(sessions.courseId, courses.id))
    .where(and(eq(questions.id, questionId), eq(courses.teacherId, teacherId)));
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.update(questions).set({ isDeleted: true }).where(eq(questions.id, questionId));
  return NextResponse.json({ ok: true });
}
