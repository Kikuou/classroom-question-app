import { NextResponse } from "next/server";
import { db } from "@/db";
import { questions, likes, replies, sessions, courses } from "@/db/schema";
import { eq, and, ne, or, sql, desc, asc, inArray, isNull } from "drizzle-orm";
import { isTeacher } from "@/lib/auth";

export const dynamic = "force-dynamic";
const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate" };

// 学生向け授業質問一覧
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const courseId = parseInt(id);
  const url = new URL(req.url);
  const sort = url.searchParams.get("sort") ?? "time";
  const clientId = url.searchParams.get("clientId") ?? "";

  const teacher = await isTeacher();

  // 授業が公開されているか確認
  const [course] = await db
    .select({ id: courses.id, isVisible: courses.isVisible, questionsOpen: courses.questionsOpen })
    .from(courses)
    .where(eq(courses.id, courseId));

  if (!course || !course.isVisible) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: NO_CACHE });
  }

  // 1. 新形式: questions.courseId = courseId
  // 2. 旧形式: questions.sessionId → sessions.courseId = courseId (LEFT JOIN)
  // 両方をUNION的に取得するため、LEFT JOINを利用

  const baseCondition = teacher
    ? and(
        eq(questions.isDeleted, false),
        or(
          eq(questions.courseId, courseId),
          eq(sessions.courseId, courseId)
        )
      )
    : and(
        eq(questions.isDeleted, false),
        ne(questions.status, "hidden"),
        or(
          eq(questions.courseId, courseId),
          eq(sessions.courseId, courseId)
        )
      );

  const rows = await db
    .select({
      id: questions.id,
      content: questions.content,
      authorName: questions.authorName,
      status: questions.status,
      sortOrder: questions.sortOrder,
      createdAt: questions.createdAt,
      sessionTitle: sessions.title,
      likeCount: sql<number>`cast(count(distinct ${likes.id}) as int)`,
    })
    .from(questions)
    .leftJoin(sessions, eq(sessions.id, questions.sessionId))
    .leftJoin(likes, eq(likes.questionId, questions.id))
    .where(baseCondition)
    .groupBy(questions.id, sessions.title)
    .orderBy(
      sort === "likes"
        ? sql`count(distinct ${likes.id}) desc, ${questions.createdAt} asc`
        : sql`${questions.createdAt} asc`
    );

  if (rows.length === 0) {
    return NextResponse.json([], { headers: NO_CACHE });
  }

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
  const clientOwnedSet = new Set<number>();
  if (clientId) {
    const [clientLikes, clientOwned] = await Promise.all([
      db
        .select({ questionId: likes.questionId })
        .from(likes)
        .where(and(inArray(likes.questionId, questionIds), eq(likes.clientId, clientId))),
      db
        .select({ id: questions.id })
        .from(questions)
        .where(and(inArray(questions.id, questionIds), eq(questions.clientId, clientId))),
    ]);
    clientLikes.forEach((l) => clientLikedSet.add(l.questionId));
    clientOwned.forEach((q) => clientOwnedSet.add(q.id));
  }

  return NextResponse.json(
    rows.map((q) => ({
      ...q,
      likedByClient: clientLikedSet.has(q.id),
      isOwner: clientOwnedSet.has(q.id),
      replies: replyMap[q.id] ?? [],
    })),
    { headers: NO_CACHE }
  );
}

// 授業への質問投稿
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const courseId = parseInt(id);

  // 授業が公開されているか確認
  const [course] = await db
    .select({ id: courses.id, isVisible: courses.isVisible, questionsOpen: courses.questionsOpen })
    .from(courses)
    .where(eq(courses.id, courseId));

  if (!course || !course.isVisible) {
    return NextResponse.json({ error: "授業が見つかりません" }, { status: 404, headers: NO_CACHE });
  }

  if (!course.questionsOpen) {
    return NextResponse.json({ error: "質問受付は終了しました" }, { status: 403, headers: NO_CACHE });
  }

  const { content, authorName, clientId } = await req.json();
  if (!content?.trim() || !clientId) {
    return NextResponse.json({ error: "質問内容とclientIdは必須です" }, { status: 400, headers: NO_CACHE });
  }

  const [question] = await db
    .insert(questions)
    .values({
      courseId,
      sessionId: null,
      content: content.trim(),
      authorName: authorName?.trim() || null,
      clientId,
    })
    .returning();

  return NextResponse.json(question, { status: 201, headers: NO_CACHE });
}
