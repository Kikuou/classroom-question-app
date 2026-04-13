import { NextResponse } from "next/server";
import { db } from "@/db";
import { likes, questions } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// いいね追加
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const questionId = parseInt(id);
  const { clientId } = await req.json();
  if (!clientId) {
    return NextResponse.json({ error: "clientIdは必須です" }, { status: 400 });
  }

  // questionのsessionIdを取得
  const [q] = await db
    .select()
    .from(questions)
    .where(eq(questions.id, questionId));
  if (!q) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await db
      .insert(likes)
      .values({ questionId, sessionId: q.sessionId ?? null, clientId })
      .onConflictDoNothing();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// いいね取り消し
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const questionId = parseInt(id);
  const { clientId } = await req.json();
  if (!clientId) {
    return NextResponse.json({ error: "clientIdは必須です" }, { status: 400 });
  }
  await db
    .delete(likes)
    .where(and(eq(likes.questionId, questionId), eq(likes.clientId, clientId)));
  return NextResponse.json({ ok: true });
}
