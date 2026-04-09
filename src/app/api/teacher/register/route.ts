import { NextResponse } from "next/server";
import { db } from "@/db";
import { teachers } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { createTeacherToken } from "@/lib/auth";

export async function POST(req: Request) {
  const { name, password } = await req.json();
  if (!name?.trim() || !password) {
    return NextResponse.json({ error: "名前とパスワードは必須です" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "パスワードは6文字以上にしてください" }, { status: 400 });
  }

  // 同名チェック
  const existing = await db.select().from(teachers).where(eq(teachers.name, name.trim()));
  if (existing.length > 0) {
    return NextResponse.json({ error: "その名前は既に使用されています" }, { status: 409 });
  }

  const hashed = await bcrypt.hash(password, 10);
  const [teacher] = await db
    .insert(teachers)
    .values({ name: name.trim(), password: hashed })
    .returning();

  const token = await createTeacherToken(teacher.id);
  const res = NextResponse.json({ teacherId: teacher.id, name: teacher.name }, { status: 201 });
  res.cookies.set("teacher_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
    path: "/",
  });
  return res;
}
