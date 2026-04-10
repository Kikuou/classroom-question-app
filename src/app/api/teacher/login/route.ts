import { NextResponse } from "next/server";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { createTeacherToken } from "@/lib/auth";

export async function POST(req: Request) {
  const { password } = await req.json();
  if (!password) {
    return NextResponse.json({ error: "パスワードを入力してください" }, { status: 400 });
  }
  const [row] = await db.select().from(settings).where(eq(settings.key, "teacher_password"));
  if (!row) {
    return NextResponse.json({ error: "setup_required" }, { status: 403 });
  }
  const ok = await bcrypt.compare(password, row.value);
  if (!ok) {
    return NextResponse.json({ error: "パスワードが違います" }, { status: 401 });
  }
  const token = await createTeacherToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set("teacher_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
    path: "/",
  });
  return res;
}
