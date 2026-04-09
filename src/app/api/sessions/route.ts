import { NextResponse } from "next/server";
import { db } from "@/db";
import { sessions, courses } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireTeacher } from "@/lib/auth";

export async function POST(req: Request) {
  let teacherId: number;
  try {
    teacherId = await requireTeacher();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { title, courseId } = await req.json();
  if (!title?.trim() || !courseId) {
    return NextResponse.json({ error: "タイトルとcourseIdは必須です" }, { status: 400 });
  }
  // 自分の授業か確認
  const [course] = await db
    .select()
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.teacherId, teacherId)));
  if (!course) {
    return NextResponse.json({ error: "授業が見つかりません" }, { status: 404 });
  }
  const [session] = await db
    .insert(sessions)
    .values({ courseId, title: title.trim() })
    .returning();
  return NextResponse.json(session, { status: 201 });
}
