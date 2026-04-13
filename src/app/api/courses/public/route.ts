import { NextResponse } from "next/server";
import { db } from "@/db";
import { courses } from "@/db/schema";
import { eq, ilike, and } from "drizzle-orm";

export const dynamic = "force-dynamic";
const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate" };

// 学生向け: 公開授業一覧（isVisible=true）
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";

  const condition = q.trim()
    ? and(eq(courses.isVisible, true), ilike(courses.name, `%${q.trim()}%`))
    : eq(courses.isVisible, true);

  const result = await db
    .select({ id: courses.id, name: courses.name, code: courses.code, questionsOpen: courses.questionsOpen })
    .from(courses)
    .where(condition)
    .orderBy(courses.name);

  return NextResponse.json(result, { headers: NO_CACHE });
}
