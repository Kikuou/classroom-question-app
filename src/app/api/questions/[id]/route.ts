import { NextResponse } from "next/server";
import { db } from "@/db";
import { questions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireTeacher } from "@/lib/auth";

// ステータス変更（教員のみ）
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
  const { status } = await req.json();
  const validStatuses = ["pending", "answered", "later", "hidden"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "無効なステータスです" }, { status: 400 });
  }
  const [q] = await db
    .update(questions)
    .set({ status })
    .where(eq(questions.id, parseInt(id)))
    .returning();
  return NextResponse.json(q);
}
