import { NextResponse } from "next/server";
import { db } from "@/db";
import { courses, sessions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireTeacher } from "@/lib/auth";

// 授業詳細 + セッション一覧（未削除）
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await requireTeacher();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const courseId = parseInt(id);
  const [course] = await db.select().from(courses).where(eq(courses.id, courseId));
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const sessionList = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.courseId, courseId), eq(sessions.isDeleted, false)))
    .orderBy(sessions.sortOrder, sessions.createdAt);
  return NextResponse.json({ course, sessions: sessionList });
}

// 授業更新（isVisible変更）
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
  const body = await req.json();
  const updateData: Partial<{ isVisible: boolean }> = {};
  if (typeof body.isVisible === "boolean") updateData.isVisible = body.isVisible;

  const [course] = await db
    .update(courses)
    .set(updateData)
    .where(eq(courses.id, parseInt(id)))
    .returning();
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(course);
}
