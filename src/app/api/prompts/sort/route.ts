import { NextResponse } from "next/server";
import { db } from "@/db";
import { prompts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireTeacher } from "@/lib/auth";

// プロンプト並び替え（教員のみ）
export async function PATCH(req: Request) {
  try {
    await requireTeacher();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderedIds } = await req.json();
  if (!Array.isArray(orderedIds)) {
    return NextResponse.json({ error: "orderedIds is required" }, { status: 400 });
  }

  await Promise.all(
    orderedIds.map((id: number, index: number) =>
      db.update(prompts).set({ sortOrder: index }).where(eq(prompts.id, id))
    )
  );

  return NextResponse.json({ ok: true });
}
