import { NextResponse } from "next/server";
import { db } from "@/db";
import { prompts, promptResponses, sessions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { isTeacher, requireTeacher } from "@/lib/auth";
import { isRateLimited } from "@/lib/rate-limit";

// 回答一覧（教員: 常に取得可、学生: discussionOpen=false のときのみ）
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const promptId = parseInt(id);
  const teacher = await isTeacher();

  if (!teacher) {
    // プロンプトの存在確認 + 所属セッションの discussionOpen を取得
    const [row] = await db
      .select({ discussionOpen: sessions.discussionOpen })
      .from(prompts)
      .innerJoin(sessions, eq(sessions.id, prompts.sessionId))
      .where(and(eq(prompts.id, promptId), eq(prompts.isDeleted, false)));

    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (row.discussionOpen) {
      // 受付中は他者回答を閲覧不可
      return NextResponse.json({ error: "回答受付中は他者の回答を閲覧できません" }, { status: 403 });
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
  if (answer.trim().length > 1000) {
    return NextResponse.json({ error: "回答は1000文字以内で入力してください" }, { status: 400 });
  }
  // レートリミット: 1分間に10件まで（upsertなので多めに許容）
  if (isRateLimited(`response:${clientId}`, 10, 60_000)) {
    return NextResponse.json({ error: "送信が多すぎます。しばらく待ってから再試行してください" }, { status: 429 });
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

// この問題の全回答を削除（教員のみ・物理削除）
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

  const { count } = await db
    .delete(promptResponses)
    .where(eq(promptResponses.promptId, parseInt(id)))
    .returning({ count: promptResponses.id })
    .then((rows) => ({ count: rows.length }));

  return NextResponse.json({ ok: true, deleted: count });
}
