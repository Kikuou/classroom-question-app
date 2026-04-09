import { NextResponse } from "next/server";
import { db } from "@/db";
import { courses } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { createTeacherToken } from "@/lib/auth";

export async function POST(req: Request) {
  const { code, password } = await req.json();
  if (!code || !password) {
    return NextResponse.json({ error: "必須項目が不足しています" }, { status: 400 });
  }
  const [course] = await db
    .select()
    .from(courses)
    .where(eq(courses.code, code.toUpperCase()));
  if (!course) {
    return NextResponse.json({ error: "授業コードまたはパスワードが違います" }, { status: 401 });
  }
  const ok = await bcrypt.compare(password, course.password);
  if (!ok) {
    return NextResponse.json({ error: "授業コードまたはパスワードが違います" }, { status: 401 });
  }
  const token = await createTeacherToken(course.id);
  const res = NextResponse.json({ courseId: course.id, courseName: course.name });
  res.cookies.set("teacher_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
    path: "/",
  });
  return res;
}
