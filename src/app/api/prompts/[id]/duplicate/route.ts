import { NextResponse } from "next/server";
import { db } from "@/db";
import { prompts } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireTeacher } from "@/lib/auth";

// 問題複製（教員のみ・同一セッション内）
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await requireTeacher();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const promptId = parseInt(id);

  // 元プロンプトを取得
  const [src] = await db
    .select()
    .from(prompts)
    .where(and(eq(prompts.id, promptId), eq(prompts.isDeleted, false)));

  if (!src) {
    return NextResponse.json({ error: "問題が見つかりません" }, { status: 404 });
  }

  // 同セッション内の最大 sortOrder を取得
  const [maxRow] = await db
    .select({ max: sql<number>`coalesce(max(${prompts.sortOrder}), -1)` })
    .from(prompts)
    .where(and(eq(prompts.sessionId, src.sessionId), eq(prompts.isDeleted, false)));

  // 末尾に追加（isResultsVisible はリセット）
  const [newPrompt] = await db
    .insert(prompts)
    .values({
      sessionId: src.sessionId,
      content: src.content,
      sortOrder: (maxRow?.max ?? -1) + 1,
      isResultsVisible: false,
    })
    .returning();

  return NextResponse.json(newPrompt, { status: 201 });
}
