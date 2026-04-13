import { NextResponse } from "next/server";
import { db } from "@/db";
import { prompts, promptResponses, sessions } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { requireTeacher } from "@/lib/auth";

// このセッションの全回答を削除（教員のみ・物理削除）
// 問題自体は残り、promptResponses のみ削除する
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await requireTeacher();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionId = parseInt(id);

  // セッション存在確認
  const [sess] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.isDeleted, false)));

  if (!sess) {
    return NextResponse.json({ error: "セッションが見つかりません" }, { status: 404 });
  }

  // このセッションの非削除プロンプトIDを取得
  const promptRows = await db
    .select({ id: prompts.id })
    .from(prompts)
    .where(and(eq(prompts.sessionId, sessionId), eq(prompts.isDeleted, false)));

  if (promptRows.length === 0) {
    return NextResponse.json({ ok: true, deleted: 0 });
  }

  const promptIds = promptRows.map((p) => p.id);

  // 全回答を物理削除
  const deleted = await db
    .delete(promptResponses)
    .where(inArray(promptResponses.promptId, promptIds))
    .returning({ id: promptResponses.id });

  return NextResponse.json({ ok: true, deleted: deleted.length });
}
