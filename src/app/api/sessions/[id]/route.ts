import { NextResponse } from "next/server";
import { db } from "@/db";
import { sessions, courses } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireTeacher } from "@/lib/auth";

export const dynamic = "force-dynamic";
const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate" };

// セッション詳細（学生も使用）
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sessionId = parseInt(id);
  try {
    const [session] = await db
      .select({
        id: sessions.id,
        title: sessions.title,
        isOpen: sessions.isOpen,
        discussionOpen: sessions.discussionOpen,
        courseId: sessions.courseId,
        courseName: courses.name,
        courseCode: courses.code,
        promptDescription: sessions.promptDescription,
        createdAt: sessions.createdAt,
      })
      .from(sessions)
      .innerJoin(courses, eq(sessions.courseId, courses.id))
      .where(and(eq(sessions.id, sessionId), eq(sessions.isDeleted, false)));
    if (!session) return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_CACHE });
    return NextResponse.json(session, { headers: NO_CACHE });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[GET /api/sessions/id]", msg);
    return NextResponse.json({ error: "DBエラーが発生しました", detail: msg }, { status: 500 });
  }
}

// セッション更新（質問受付 / ディスカッション受付 / タイトル / 全体説明）
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
  const updateData: Partial<{
    isOpen: boolean;
    discussionOpen: boolean;
    title: string;
    promptDescription: string | null;
  }> = {};

  if (typeof body.isOpen === "boolean") updateData.isOpen = body.isOpen;
  if (typeof body.discussionOpen === "boolean") updateData.discussionOpen = body.discussionOpen;
  if (typeof body.title === "string" && body.title.trim()) updateData.title = body.title.trim();
  if ("promptDescription" in body) {
    updateData.promptDescription =
      typeof body.promptDescription === "string" && body.promptDescription.trim()
        ? body.promptDescription.trim()
        : null;
  }

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
