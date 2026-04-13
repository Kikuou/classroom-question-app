import { NextResponse } from "next/server";
import { db } from "@/db";
import { prompts, promptResponses, sessions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { isTeacher } from "@/lib/auth";

// 回答一覧（教員: 常に取得可、学生: is_results_visible=true のときのみ）
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const promptId = parseInt(id);
  const teacher = await isTeacher();

  if (!teacher) {
    const [prompt] = await db
      .select({ isResultsVisible: prompts.isResultsVisible })
      .from(prompts)
      .where(and(eq(prompts.id, promptId), eq(prompts.isDeleted, false)));

    if (!prompt) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!prompt.isResultsVisible) {
      return NextResponse.json({ error: "結果はまだ公開されていません" }, { status: 403 });
    }
  }

  const responses = await db
    .select({
      id: promptResponses.id,
      answer: promptResponses.answer,
      createdAt: promptResponses.createdAt,
    })
    .from(promptResponses)
    .where(eq(promptResponses.promptId, promptId))
    .orderBy(promptResponses.createdAt);

  return NextResponse.json(responses);
}

// 回答投稿（upsert: 1人1回答、上書き可）
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const promptId = parseInt(id);
  const { answer, clientId } = await req.json();

  if (!answer?.trim()) {
    return NextResponse.json({ error: "回答は必須です" }, { status: 400 });
  }
  if (!clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  // プロンプトが存在し、削除されていないことを確認
  const [prompt] = await db
    .select({ id: prompts.id, sessionId: prompts.sessionId })
    .from(prompts)
    .where(and(eq(prompts.id, promptId), eq(prompts.isDeleted, false)));

  if (!prompt) {
    return NextResponse.json({ error: "問題が見つかりません" }, { status: 404 });
  }

  // セッションの discussionOpen を確認（締切後は学生の回答を拒否）
  const teacher = await isTeacher();
  if (!teacher) {
    const [sess] = await db
      .select({ discussionOpen: sessions.discussionOpen })
      .from(sessions)
      .where(eq(sessions.id, prompt.sessionId));

    if (sess && !sess.discussionOpen) {
      return NextResponse.json({ error: "回答受付は終了しました" }, { status: 403 });
    }
  }

  // upsert: UNIQUE(prompt_id, client_id) で衝突時は上書き
  const [response] = await db
    .insert(promptResponses)
    .values({
      promptId,
      clientId,
      answer: answer.trim(),
    })
    .onConflictDoUpdate({
      target: [promptResponses.promptId, promptResponses.clientId],
      set: { answer: answer.trim() },
    })
    .returning();

  return NextResponse.json(response, { status: 201 });
}
