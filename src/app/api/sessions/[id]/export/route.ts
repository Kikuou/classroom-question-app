import { NextResponse } from "next/server";
import { db } from "@/db";
import { questions, replies, likes } from "@/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { requireTeacher } from "@/lib/auth";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await requireTeacher();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sessionId = parseInt(id);
  const url = new URL(req.url);
  const sort = url.searchParams.get("sort") ?? "time";

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
    .where(and(eq(questions.sessionId, sessionId), eq(questions.isDeleted, false)))
    .groupBy(questions.id)
    .orderBy(
      sort === "likes"
        ? sql`count(distinct ${likes.id}) desc, ${questions.createdAt} asc`
        : sql`${questions.createdAt} asc`
    );

  const questionIds = rows.map((r) => r.id);
  const replyRows =
    questionIds.length > 0
      ? await db
          .select()
          .from(replies)
          .where(inArray(replies.questionId, questionIds))
          .orderBy(replies.createdAt)
      : [];

  const replyMap = replyRows.reduce<Record<number, string[]>>((acc, r) => {
    if (!acc[r.questionId]) acc[r.questionId] = [];
    acc[r.questionId].push(r.content);
    return acc;
  }, {});

  const statusLabels: Record<string, string> = {
    pending: "未対応",
    answered: "回答済",
    later: "後で扱う",
    hidden: "非表示",
  };

  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;

  const header = ["質問", "投稿時刻", "投稿者", "ステータス", "いいね数", "返信"].join(",");
  const body = rows
    .map((q) => {
      const dt = new Date(q.createdAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
      const replyText = (replyMap[q.id] ?? []).join(" / ");
      return [
        escape(q.content),
        escape(dt),
        escape(q.authorName ?? "匿名"),
        escape(statusLabels[q.status] ?? q.status),
        q.likeCount.toString(),
        escape(replyText),
      ].join(",");
    })
    .join("\n");

  const csv = "\uFEFF" + header + "\n" + body;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="session-${sessionId}.csv"`,
    },
  });
}
