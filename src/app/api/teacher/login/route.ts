import { NextResponse } from "next/server";
import { db } from "@/db";
import { teachers } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { createTeacherToken } from "@/lib/auth";

export async function POST(req: Request) {
  const { name, password } = await req.json();
  if (!name?.trim() || !password) {
    return NextResponse.json({ error: "必須項目が不足しています" }, { status: 400 });
  }
  const [teacher] = await db
    .select()
    .from(teachers)
    .where(eq(teachers.name, name.trim()));
  if (!teacher) {
    return NextResponse.json({ error: "名前またはパスワードが違います" }, { status: 401 });
  }
  const ok = await bcrypt.compare(password, teacher.password);
  if (!ok) {
    return NextResponse.json({ error: "名前またはパスワードが違います" }, { status: 401 });
  }
  const token = await createTeacherToken(teacher.id);
  const res = NextResponse.json({ teacherId: teacher.id, name: teacher.name });
  res.cookies.set("teacher_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
    path: "/",
  });
  return res;
}
