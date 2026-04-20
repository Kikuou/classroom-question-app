import { NextResponse } from "next/server";
import { db } from "@/db";
import { questions, replies, likes, sessions } from "@/db/schema";
import { eq, sql, and, ne, inArray } from "drizzle-orm";
import { isTeacher } from "@/lib/auth";
import { isRateLimited } from "@/lib/rate-limit";

// 質問一覧（いいね数・返信含む）
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sessionId = parseInt(id);
  const url = new URL(req.url);
  const all = url.searchParams.get("all") === "true";
  const sort = url.searchParams.get("sort") ?? "time";
  const clientId = url.searchParams.get("clientId") ?? "";

  const teacher = await isTeacher();
  const showAll = all && teacher;

  // 削除済みセッションは空配列を返す（防御的チェック）
  const [sessionRow] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.isDeleted, false)));
  if (!sessionRow) return NextResponse.json([]);

  const rows = await db
    .select({
      id: questions.id,
      content: questions.content,
      authorName: questions.authorName,
      status: questions.status,
      sortOrder: questions.sortOrder,
      createdAt: questions.createdAt,
      likeCount: sql<number>`cast(count(distinct ${likes.id}) as int)`,
    })
    .from(questions)
    .leftJoin(likes, eq(likes.questionId, questions.id))
    .where(
      showAll
        ? and(eq(questions.sessionId, sessionId), eq(questions.isDeleted, false))
        : and(
            eq(questions.sessionId, sessionId),
            eq(questions.isDeleted, false),
            ne(questions.status, "hidden")
          )
    )
    .groupBy(questions.id)
    .orderBy(
      sort === "likes"
        ? sql`count(distinct ${likes.id}) desc, ${questions.createdAt} asc`
        : sort === "manual"
        ? sql`${questions.sortOrder} asc, ${questions.createdAt} asc`
        : sql`${questions.createdAt} asc`
    );

  if (rows.length === 0) return NextResponse.json([]);

  const questionIds = rows.map((r) => r.id);

  const replyRows = await db
    .select()
    .from(replies)
    .where(inArray(replies.questionId, questionIds))
    .orderBy(replies.createdAt);

  const replyMap = replyRows.reduce<Record<number, typeof replyRows>>((acc, r) => {
    (acc[r.questionId] ??= []).push(r);
    return acc;
  }, {});

  const clientLikedSet = new Set<number>();
  if (clientId) {
    const clientLikes = await db
      .select({ questionId: likes.questionId })
      .from(likes)
      .where(and(inArray(likes.questionId, questionIds), eq(likes.clientId, clientId)));
    clientLikes.forEach((l) => clientLikedSet.add(l.questionId));
  }

  return NextResponse.json(
    rows.map((q) => ({
      ...q,
      likedByClient: clientLikedSet.has(q.id),
      replies: replyMap[q.id] ?? [],
    }))
  );
}

// 質問投稿
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sessionId = parseInt(id);

  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.isDeleted, false)));
  if (!session) {
    return NextResponse.json({ error: "セッションが見つかりません" }, { status: 404 });
  }
  if (!session.isOpen) {
    return NextResponse.json({ error: "このセッションは締め切られています" }, { status: 403 });
  }

  const { content, authorName, clientId } = await req.json();
  if (!content?.trim() || !clientId) {
    return NextResponse.json({ error: "質問内容とclientIdは必須です" }, { status: 400 });
  }
  if (content.trim().length > 500) {
    return NextResponse.json({ error: "質問は500文字以内で入力してください" }, { status: 400 });
  }
  if (authorName && authorName.trim().length > 50) {
    return NextResponse.json({ error: "名前は50文字以内で入力してください" }, { status: 400 });
  }
  // レートリミット: 1分間に5件まで
  if (isRateLimited(`question:${clientId}`, 5, 60_000)) {
    return NextResponse.json({ error: "送信が多すぎます。しばらく待ってから再試行してください" }, { status: 429 });
  }

  const [question] = await db
    .insert(questions)
    .values({
      sessionId,
      content: content.trim(),
      authorName: authorName?.trim() || null,
      clientId,
    })
    .returning();
  return NextResponse.json(question, { status: 201 });
}
