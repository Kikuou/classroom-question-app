import { NextResponse } from "next/server";
import { db } from "@/db";
import { sessions, courses } from "@/db/schema";
import { eq, and, or, isNull, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate" };

// 学生向け: 特定授業の公開セッション一覧
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const courseId = parseInt(id);

  // 授業が公開されているか確認
  const [course] = await db
    .select()
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.isVisible, true)));
  if (!course) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_CACHE });
  }

  const sessionList = await db
    .select({ id: sessions.id, title: sessions.title, isOpen: sessions.isOpen, sortOrder: sessions.sortOrder })
    .from(sessions)
    .where(
      and(
        eq(sessions.courseId, courseId),
        eq(sessions.isDeleted, false),
        eq(sessions.isVisible, true),
        or(isNull(sessions.publishAt), sql`${sessions.publishAt} <= now()`)
      )
    )
    .orderBy(sessions.sortOrder, sessions.createdAt);

  return NextResponse.json(sessionList, { headers: NO_CACHE });
}
