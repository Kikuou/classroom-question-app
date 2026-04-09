import { NextResponse } from "next/server";
import { db } from "@/db";
import { courses, sessions } from "@/db/schema";
import { eq } from "drizzle-orm";

// 授業コードで入室: 開いているセッションを返す
export async function POST(req: Request) {
  const { code } = await req.json();
  if (!code) {
    return NextResponse.json({ error: "授業コードは必須です" }, { status: 400 });
  }
  const [course] = await db
    .select()
    .from(courses)
    .where(eq(courses.code, code.toUpperCase()));
  if (!course) {
    return NextResponse.json({ error: "授業コードが見つかりません" }, { status: 404 });
  }
  const sessionList = await db
    .select()
    .from(sessions)
    .where(eq(sessions.courseId, course.id))
    .orderBy(sessions.createdAt);
  return NextResponse.json({ course: { id: course.id, name: course.name, code: course.code }, sessions: sessionList });
}
