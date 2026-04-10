import { NextResponse } from "next/server";
import { db } from "@/db";
import { sessions, courses } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireTeacher } from "@/lib/auth";

// セッション詳細（学生も使用）
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sessionId = parseInt(id);
  const [session] = await db
    .select({
      id: sessions.id,
      title: sessions.title,
      isOpen: sessions.isOpen,
      courseId: sessions.courseId,
      courseName: courses.name,
      courseCode: courses.code,
      createdAt: sessions.createdAt,
    })
    .from(sessions)
    .innerJoin(courses, eq(sessions.courseId, courses.id))
    .where(and(eq(sessions.id, sessionId), eq(sessions.isDeleted, false)));
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(session);
}

// セッション更新（公開/締切、タイトル変更）
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
  const updateData: Partial<{ isOpen: boolean; title: string }> = {};
  if (typeof body.isOpen === "boolean") updateData.isOpen = body.isOpen;
  if (typeof body.title === "string" && body.title.trim()) updateData.title = body.title.trim();

  const [session] = await db
    .update(sessions)
    .set(updateData)
    .where(eq(sessions.id, parseInt(id)))
    .returning();
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(session);
}

// セッション論理削除
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
  await db.update(sessions).set({ isDeleted: true }).where(eq(sessions.id, parseInt(id)));
  return NextResponse.json({ ok: true });
}
