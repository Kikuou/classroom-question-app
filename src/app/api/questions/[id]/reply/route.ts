import { NextResponse } from "next/server";
import { db } from "@/db";
import { replies } from "@/db/schema";
import { requireTeacher } from "@/lib/auth";

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
    return NextResponse.json({ error: "返信内容は必須です" }, { status: 400 });
  }
  const [reply] = await db
    .insert(replies)
    .values({ questionId: parseInt(id), content: content.trim() })
    .returning();
  return NextResponse.json(reply, { status: 201 });
}
