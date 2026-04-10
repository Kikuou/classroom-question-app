import { NextResponse } from "next/server";
import { db } from "@/db";
import { prompts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireTeacher } from "@/lib/auth";

// プロンプト編集（教員のみ）
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await requireTeacher();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const updateData: Partial<{ content: string; isResultsVisible: boolean }> = {};

  if (typeof body.content === "string" && body.content.trim()) {
    updateData.content = body.content.trim();
  }
  if (typeof body.isResultsVisible === "boolean") {
    updateData.isResultsVisible = body.isResultsVisible;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "更新データがありません" }, { status: 400 });
  }

  const [prompt] = await db
    .update(prompts)
    .set(updateData)
    .where(eq(prompts.id, parseInt(id)))
    .returning();

  if (!prompt) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(prompt);
}

// プロンプト論理削除（教員のみ）
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

  const [prompt] = await db
    .update(prompts)
    .set({ isDeleted: true })
    .where(eq(prompts.id, parseInt(id)))
    .returning();

  if (!prompt) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
