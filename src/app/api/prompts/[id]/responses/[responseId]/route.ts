import { NextResponse } from "next/server";
import { db } from "@/db";
import { promptResponses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireTeacher } from "@/lib/auth";

// 個別回答削除（教員のみ・物理削除）
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; responseId: string }> }
) {
  const { responseId } = await params;
  try {
    await requireTeacher();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db
    .delete(promptResponses)
    .where(eq(promptResponses.id, parseInt(responseId)));

  return NextResponse.json({ ok: true });
}
