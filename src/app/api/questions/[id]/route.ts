import { NextResponse } from "next/server";
import { db } from "@/db";
import { questions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { isTeacher, requireTeacher } from "@/lib/auth";

// ステータス変更（教員のみ）
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await requireTeacher();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { status } = await req.json();
  const validStatuses = ["pending", "answered", "later", "hidden"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "無効なステータスです" }, { status: 400 });
  }
  const [q] = await db
    .update(questions)
    .set({ status })
    .where(eq(questions.id, parseInt(id)))
    .returning();
  return NextResponse.json(q);
}

// 質問論理削除（教員 or 学生本人かつpending）
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const questionId = parseInt(id);

  const teacher = await isTeacher();

  if (teacher) {
    // 教員: 無条件で論理削除
    await db.update(questions).set({ isDeleted: true }).where(eq(questions.id, questionId));
    return NextResponse.json({ ok: true });
  }

  // 学生: clientId + status=pending の場合のみ
  const url = new URL(req.url);
  const clientId = url.searchParams.get("clientId") ?? "";
  if (!clientId) {
    return NextResponse.json({ error: "clientIdが必要です" }, { status: 400 });
  }

  const [q] = await db
    .select({ id: questions.id, clientId: questions.clientId, status: questions.status })
    .from(questions)
    .where(and(eq(questions.id, questionId), eq(questions.isDeleted, false)));

  if (!q) {
    return NextResponse.json({ error: "質問が見つかりません" }, { status: 404 });
  }
  if (q.clientId !== clientId) {
    return NextResponse.json({ error: "この質問を取り消す権限がありません" }, { status: 403 });
  }
  if (q.status !== "pending") {
    return NextResponse.json({ error: "回答済みの質問は取り消せません" }, { status: 403 });
  }

  await db.update(questions).set({ isDeleted: true }).where(eq(questions.id, questionId));
  return NextResponse.json({ ok: true });
}
