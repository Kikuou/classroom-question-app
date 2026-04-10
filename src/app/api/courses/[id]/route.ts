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

// 授業更新（名前 / isVisible）
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
  const updateData: Partial<{ name: string; isVisible: boolean }> = {};
  if (typeof body.isVisible === "boolean") updateData.isVisible = body.isVisible;
  if (typeof body.name === "string" && body.name.trim()) updateData.name = body.name.trim();

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "更新データがありません" }, { status: 400 });
  }

  const [course] = await db
    .update(courses)
    .set(updateData)
    .where(eq(courses.id, parseInt(id)))
    .returning();
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(course);
}

// 授業削除（セッション・質問もカスケード削除）
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await requireTeacher();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await db.delete(courses).where(eq(courses.id, parseInt(id)));
  return NextResponse.json({ ok: true });
}
