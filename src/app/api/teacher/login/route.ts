import { NextResponse } from "next/server";
import { createTeacherToken } from "@/lib/auth";

export async function POST(req: Request) {
  const { password } = await req.json();
  if (!password) {
    return NextResponse.json({ error: "パスワードを入力してください" }, { status: 400 });
  }
  const correct = process.env.TEACHER_PASSWORD ?? "admin";
  if (password !== correct) {
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
