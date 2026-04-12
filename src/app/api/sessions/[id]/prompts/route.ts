import { NextResponse } from "next/server";
import { db } from "@/db";
import { prompts, promptResponses, sessions } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireTeacher, isTeacher } from "@/lib/auth";

// プロンプト一覧（教員: 全件、学生: is_deleted=false のみ）
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sessionId = parseInt(id);
  const teacher = await isTeacher();
  const url = new URL(req.url);
  const clientId = url.searchParams.get("clientId");

  // 削除済みセッションは空配列を返す（防御的チェック）
  const [sessionRow] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.isDeleted, false)));
  if (!sessionRow) return NextResponse.json([]);

  const conditions = teacher
    ? [eq(prompts.sessionId, sessionId)]
    : [eq(prompts.sessionId, sessionId), eq(prompts.isDeleted, false)];

  const promptList = await db
    .select()
    .from(prompts)
    .where(and(...conditions))
    .orderBy(prompts.sortOrder, prompts.createdAt);

  // 回答数を取得
  const responseCounts = await db
    .select({
      promptId: promptResponses.promptId,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(promptResponses)
    .where(
      sql`${promptResponses.promptId} IN (${
        promptList.length > 0
          ? sql.join(promptList.map((p) => sql`${p.id}`), sql`, `)
          : sql`NULL`
      })`
    )
    .groupBy(promptResponses.promptId);

  const countMap: Record<number, number> = {};
  responseCounts.forEach((r) => { countMap[r.promptId] = r.count; });

  // 学生の場合: 自分の回答を付与
  let myAnswers: Record<number, string> = {};
  if (!teacher && clientId && promptList.length > 0) {
    const myResponses = await db
      .select({ promptId: promptResponses.promptId, answer: promptResponses.answer })
      .from(promptResponses)
      .where(
        and(
          eq(promptResponses.clientId, clientId),
          sql`${promptResponses.promptId} IN (${sql.join(
            promptList.map((p) => sql`${p.id}`),
            sql`, `
          )})`
        )
      );
    myResponses.forEach((r) => { myAnswers[r.promptId] = r.answer; });
  }

  return NextResponse.json(
    promptList.map((p) => ({
      ...p,
      responseCount: countMap[p.id] ?? 0,
      myAnswer: myAnswers[p.id] ?? null,
    }))
  );
}

// プロンプト作成（教員のみ）
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await requireTeacher();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { content } = await req.json();
  if (!content?.trim()) {
    return NextResponse.json({ error: "問題文は必須です" }, { status: 400 });
  }

  const sessionId = parseInt(id);

  // sortOrder: 現在の最大値 + 1
  const [maxRow] = await db
    .select({ max: sql<number>`coalesce(max(${prompts.sortOrder}), -1)` })
    .from(prompts)
    .where(eq(prompts.sessionId, sessionId));

  const [prompt] = await db
    .insert(prompts)
    .values({
      sessionId,
      content: content.trim(),
      sortOrder: (maxRow?.max ?? -1) + 1,
    })
    .returning();

  return NextResponse.json(prompt, { status: 201 });
}
