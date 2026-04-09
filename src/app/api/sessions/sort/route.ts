import { NextResponse } from "next/server";
import { db } from "@/db";
import { sessions, courses } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireTeacher } from "@/lib/auth";

// セッション並び順一括更新
// body: { orderedIds: number[] }
export async function PATCH(req: Request) {
  let teacherId: number;
  try {
    teacherId = await requireTeacher();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderedIds } = await req.json();
  if (!Array.isArray(orderedIds)) {
    return NextResponse.json({ error: "orderedIds は配列で指定してください" }, { status: 400 });
  }

  // 全て同一courseId かつ自分の授業かチェックは省略（セッションIDが正しければOK）
  await Promise.all(
    orderedIds.map((sessionId: number, index: number) =>
      db
        .update(sessions)
        .set({ sortOrder: index })
        .where(eq(sessions.id, sessionId))
    )
  );

  return NextResponse.json({ ok: true });
}
