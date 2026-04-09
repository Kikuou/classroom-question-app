import { NextResponse } from "next/server";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { requireTeacher } from "@/lib/auth";

export async function POST(req: Request) {
  let courseId: number;
  try {
    courseId = await requireTeacher();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { title } = await req.json();
  if (!title) {
    return NextResponse.json({ error: "タイトルは必須です" }, { status: 400 });
  }
  const [session] = await db
    .insert(sessions)
    .values({ courseId, title })
    .returning();
  return NextResponse.json(session, { status: 201 });
}
