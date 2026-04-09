import { NextResponse } from "next/server";
import { db } from "@/db";
import { courses, sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireTeacher } from "@/lib/auth";

// 授業詳細 + セッション一覧
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
  const [course] = await db
    .select()
    .from(courses)
    .where(eq(courses.id, courseId));
  if (!course) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const sessionList = await db
    .select()
    .from(sessions)
    .where(eq(sessions.courseId, courseId))
    .orderBy(sessions.createdAt);
  return NextResponse.json({ course, sessions: sessionList });
}
