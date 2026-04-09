import { NextResponse } from "next/server";
import { db } from "@/db";
import { sessions, courses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireTeacher } from "@/lib/auth";

// セッション詳細（学生も使用：入室コード確認）
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
    .where(eq(sessions.id, sessionId));
  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(session);
}

// セッションの公開/締切切替
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
  const { isOpen } = await req.json();
  const [session] = await db
    .update(sessions)
    .set({ isOpen })
    .where(eq(sessions.id, parseInt(id)))
    .returning();
  return NextResponse.json(session);
}
