import { NextResponse } from "next/server";
import { db } from "@/db";
import { questions, replies, likes, sessions } from "@/db/schema";
import { eq, sql, and, ne, inArray } from "drizzle-orm";
import { getTeacherCourseId } from "@/lib/auth";

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

  // 教員は全件、学生はhidden以外
  const isTeacher = !!(await getTeacherCourseId());
  const showAll = all && isTeacher;

  const rows = await db
    .select({
      id: questions.id,
      content: questions.content,
      authorName: questions.authorName,
      status: questions.status,
      createdAt: questions.createdAt,
      likeCount: sql<number>`cast(count(distinct ${likes.id}) as int)`,
    })
    .from(questions)
    .leftJoin(likes, eq(likes.questionId, questions.id))
    .where(
      showAll
        ? eq(questions.sessionId, sessionId)
        : and(eq(questions.sessionId, sessionId), ne(questions.status, "hidden"))
    )
    .groupBy(questions.id)
    .orderBy(
      sort === "likes"
        ? sql`count(distinct ${likes.id}) desc, ${questions.createdAt} asc`
        : sql`${questions.createdAt} asc`
    );

  if (rows.length === 0) return NextResponse.json([]);

  const questionIds = rows.map((r) => r.id);

  // 返信を一括取得（inArray で安全に）
  const replyRows = await db
    .select()
    .from(replies)
    .where(inArray(replies.questionId, questionIds))
    .orderBy(replies.createdAt);

  const replyMap = replyRows.reduce<Record<number, typeof replyRows>>((acc, r) => {
    (acc[r.questionId] ??= []).push(r);
    return acc;
  }, {});

  // このクライアントがいいねした質問IDセットを一括取得
  const clientLikedSet = new Set<number>();
  if (clientId) {
    const clientLikes = await db
      .select({ questionId: likes.questionId })
      .from(likes)
      .where(and(eq(likes.sessionId, sessionId), eq(likes.clientId, clientId)));
    clientLikes.forEach((l) => clientLikedSet.add(l.questionId));
  }

  const result = rows.map((q) => ({
    ...q,
    likedByClient: clientLikedSet.has(q.id),
    replies: replyMap[q.id] ?? [],
  }));

  return NextResponse.json(result);
}

// 質問投稿
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sessionId = parseInt(id);

  // セッションが開いているか確認
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId));
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
