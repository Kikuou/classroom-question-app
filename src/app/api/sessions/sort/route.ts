import { NextResponse } from "next/server";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireTeacher } from "@/lib/auth";

export async function PATCH(req: Request) {
  try {
    await requireTeacher();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderedIds } = await req.json();
  if (!Array.isArray(orderedIds)) {
    return NextResponse.json({ error: "orderedIds は配列で指定してください" }, { status: 400 });
  }

  await Promise.all(
    orderedIds.map((sessionId: number, index: number) =>
      db.update(sessions).set({ sortOrder: index }).where(eq(sessions.id, sessionId))
    )
  );

  return NextResponse.json({ ok: true });
}
