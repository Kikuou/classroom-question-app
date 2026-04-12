import { NextResponse } from "next/server";
import { db } from "@/db";
import { courses, sessions, prompts, questions } from "@/db/schema";
import { eq, and, inArray, sql, asc, desc, ne } from "drizzle-orm";

// Next.js のルートキャッシュを完全無効化（削除・非公開の即時反映のため必須）
export const dynamic = "force-dynamic";

const NO_CACHE = { "Cache-Control": "no-store, no-cache, must-revalidate" };

// 学生用: トップページ向けに実施中・質問受付中・アーカイブを一括返却
export async function GET(_req: Request) {
  try {
    // 1. 公開中の授業
    const visibleCourses = await db
      .select({ id: courses.id, name: courses.name })
      .from(courses)
      .where(eq(courses.isVisible, true))
      .orderBy(asc(courses.createdAt));

    if (visibleCourses.length === 0) {
      return NextResponse.json({ active: [], openQuestions: [], archived: [], courses: [] }, { headers: NO_CACHE });
    }

    const courseIds = visibleCourses.map((c) => c.id);
    const courseMap = new Map(visibleCourses.map((c) => [c.id, c.name]));

    // 2. 非削除セッション（全件、sortOrder ASC → createdAt ASC の順）
    //    isDeleted を SELECT に含め、JS レベルでも二重フィルタする
    const rawSessions = await db
      .select({
        id: sessions.id,
        courseId: sessions.courseId,
        title: sessions.title,
        isOpen: sessions.isOpen,
        discussionOpen: sessions.discussionOpen,
        sortOrder: sessions.sortOrder,
        isDeleted: sessions.isDeleted,
        createdAt: sessions.createdAt,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.isDeleted, false),
          ne(sessions.isDeleted, true),          // 二重フィルタ（念のため）
          inArray(sessions.courseId, courseIds)
        )
      )
      .orderBy(asc(sessions.sortOrder), asc(sessions.createdAt));

    // JS レベルでも削除済みを除外（DBフィルタの結果を検証しつつ保護）
    const allSessions = rawSessions.filter((s) => s.isDeleted === false);

    // デバッグログ: DB と JS フィルタの差を記録
    if (rawSessions.length !== allSessions.length) {
      console.warn(
        `[discussions] DB filter missed ${rawSessions.length - allSessions.length} deleted sessions!`,
        rawSessions.filter((s) => s.isDeleted !== false).map((s) => s.id)
      );
    }

    if (allSessions.length === 0) {
      return NextResponse.json({
        active: [],
        openQuestions: [],
        archived: [],
        courses: visibleCourses,
      }, { headers: NO_CACHE });
    }

    const sessionIds = allSessions.map((s) => s.id);

    // 3. 非削除プロンプト（sortOrder ASC）
    const allPrompts = await db
      .select({
        id: prompts.id,
        sessionId: prompts.sessionId,
        content: prompts.content,
        isResultsVisible: prompts.isResultsVisible,
        sortOrder: prompts.sortOrder,
      })
      .from(prompts)
      .where(and(eq(prompts.isDeleted, false), inArray(prompts.sessionId, sessionIds)))
      .orderBy(asc(prompts.sortOrder));

    // セッション別にグループ化
    const promptsBySession = new Map<number, typeof allPrompts>();
    allPrompts.forEach((p) => {
      if (!promptsBySession.has(p.sessionId)) promptsBySession.set(p.sessionId, []);
      promptsBySession.get(p.sessionId)!.push(p);
    });

    // 4. 質問受付中セッションの質問数・最新質問プレビュー
    const openSessionIds = allSessions.filter((s) => s.isOpen).map((s) => s.id);

    const questionCountMap = new Map<number, number>();
    const latestQuestionMap = new Map<number, string>();

    if (openSessionIds.length > 0) {
      // 質問数（セッション別）
      const qCounts = await db
        .select({
          sessionId: questions.sessionId,
          count: sql<number>`cast(count(*) as int)`,
        })
        .from(questions)
        .where(
          and(eq(questions.isDeleted, false), inArray(questions.sessionId, openSessionIds))
        )
        .groupBy(questions.sessionId);

      qCounts.forEach((q) => questionCountMap.set(q.sessionId, q.count));

      // 最新質問プレビュー（createdAt DESC で取得し、セッションごとに先頭のみ使用）
      const latestQs = await db
        .select({ sessionId: questions.sessionId, content: questions.content })
        .from(questions)
        .where(
          and(eq(questions.isDeleted, false), inArray(questions.sessionId, openSessionIds))
        )
        .orderBy(desc(questions.createdAt));

      latestQs.forEach((q) => {
        if (!latestQuestionMap.has(q.sessionId)) {
          latestQuestionMap.set(q.sessionId, q.content.slice(0, 50));
        }
      });
    }

    // ── 実施中ディスカッション
    //    discussionOpen=true かつ 非削除プロンプトが1件以上あるセッション
    const active = allSessions
      .filter((s) => s.discussionOpen)
      .flatMap((s) => {
        const sPrompts = promptsBySession.get(s.id) ?? [];
        if (sPrompts.length === 0) return [];
        return [
          {
            sessionId: s.id,
            sessionTitle: s.title,
            courseId: s.courseId,
            courseName: courseMap.get(s.courseId) ?? "",
            promptCount: sPrompts.length,
            firstPromptPreview: sPrompts[0].content.slice(0, 60),
          },
        ];
      });

    // ── 質問受付中
    //    isOpen=true のセッション（授業名・セッション名・質問数・最新質問冒頭）
    const openQuestions = allSessions
      .filter((s) => s.isOpen)
      .map((s) => ({
        sessionId: s.id,
        sessionTitle: s.title,
        courseId: s.courseId,
        courseName: courseMap.get(s.courseId) ?? "",
        questionCount: questionCountMap.get(s.id) ?? 0,
        latestQuestionPreview: latestQuestionMap.get(s.id) ?? null,
      }));

    // ── アーカイブ
    //    discussionOpen=false かつ isResultsVisible=true のプロンプトが1件以上あるセッション
    //    授業ごとにグループ化（sortOrder ASC 順は allSessions 取得時に保証済み）
    type ArchiveCourse = {
      courseId: number;
      courseName: string;
      sessions: Array<{
        sessionId: number;
        sessionTitle: string;
        sortOrder: number;
        promptCount: number;
      }>;
    };
    const archivedMap = new Map<number, ArchiveCourse>();

    allSessions
      .filter((s) => !s.discussionOpen)
      .forEach((s) => {
        const sPrompts = promptsBySession.get(s.id) ?? [];
        const visibleCount = sPrompts.filter((p) => p.isResultsVisible).length;
        if (visibleCount === 0) return;

        if (!archivedMap.has(s.courseId)) {
          archivedMap.set(s.courseId, {
            courseId: s.courseId,
            courseName: courseMap.get(s.courseId) ?? "",
            sessions: [],
          });
        }
        archivedMap.get(s.courseId)!.sessions.push({
          sessionId: s.id,
          sessionTitle: s.title,
          sortOrder: s.sortOrder,
          promptCount: visibleCount,
        });
      });

    const archived = Array.from(archivedMap.values());

    // 「授業一覧」セクション用:
    // 非削除セッションが1件以上ある授業のみ表示する
    const courseIdsWithSessions = new Set(allSessions.map((s) => s.courseId));
    const filteredCourses = visibleCourses.filter((c) =>
      courseIdsWithSessions.has(c.id)
    );

    return NextResponse.json({
      active,
      openQuestions,
      archived,
      courses: filteredCourses,
    }, { headers: NO_CACHE });
  } catch (e) {
    console.error("[GET /api/discussions]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: NO_CACHE });
  }
}
