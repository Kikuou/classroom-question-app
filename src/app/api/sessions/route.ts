import { NextResponse } from "next/server";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { requireTeacher } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    await requireTeacher();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { title, courseId } = await req.json();
  if (!title?.trim() || !courseId) {
    return NextResponse.json({ error: "タイトルとcourseIdは必須です" }, { status: 400 });
  }
  const [session] = await db
    .insert(sessions)
    .values({
      courseId,
      title: title.trim(),
      isVisible: false,
      discussionOpen: true,   // 明示: DBデフォルト任せにしない
      isOpen: true,
    })
    .returning();
  return NextResponse.json(session, { status: 201 });
}
