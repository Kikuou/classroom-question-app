import { NextResponse } from "next/server";
import { db } from "@/db";
import { sessions, prompts } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireTeacher } from "@/lib/auth";

// セッション複製（教員のみ）
// body: { targetCourseId?: number }  省略時は同一授業内に複製
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

  const sessionId = parseInt(id);
  const body = await req.json().catch(() => ({}));

  // 元セッションを取得
  const [src] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.isDeleted, false)));

  if (!src) {
    return NextResponse.json({ error: "セッションが見つかりません" }, { status: 404 });
  }

  const targetCourseId: number =
    typeof body.targetCourseId === "number" ? body.targetCourseId : src.courseId;

  // 複製先の最大 sortOrder を取得
  const [maxRow] = await db
    .select({ max: sql<number>`coalesce(max(${sessions.sortOrder}), -1)` })
    .from(sessions)
    .where(and(eq(sessions.courseId, targetCourseId), eq(sessions.isDeleted, false)));

  // 新セッションを挿入（タイトルに「コピー」付与、受付はオープンで開始）
  const [newSession] = await db
    .insert(sessions)
    .values({
      courseId: targetCourseId,
      title: `【コピー】${src.title}`,
      promptDescription: src.promptDescription,
      discussionOpen: true,
      isOpen: true,
      sortOrder: (maxRow?.max ?? -1) + 1,
    })
    .returning();

  // 元セッションの非削除プロンプトを取得（sortOrder 順）
  const srcPrompts = await db
    .select()
    .from(prompts)
    .where(and(eq(prompts.sessionId, sessionId), eq(prompts.isDeleted, false)))
    .orderBy(prompts.sortOrder, prompts.createdAt);

  // プロンプトを新セッションにコピー（学生回答・結果公開フラグはリセット）
  if (srcPrompts.length > 0) {
    await db.insert(prompts).values(
      srcPrompts.map((p) => ({
        sessionId: newSession.id,
        content: p.content,
        sortOrder: p.sortOrder,
        isResultsVisible: false, // 新鮮な状態でスタート
      }))
    );
  }

  return NextResponse.json(
    {
      session: newSession,
      promptCount: srcPrompts.length,
    },
    { status: 201 }
  );
}
