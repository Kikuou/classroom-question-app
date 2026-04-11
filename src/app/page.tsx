"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface ActiveDiscussion {
  sessionId: number;
  sessionTitle: string;
  courseId: number;
  courseName: string;
  promptCount: number;
  firstPromptPreview: string;
}

interface OpenQuestionSession {
  sessionId: number;
  sessionTitle: string;
  courseId: number;
  courseName: string;
  questionCount: number;
  latestQuestionPreview: string | null;
}

interface ArchivedSession {
  sessionId: number;
  sessionTitle: string;
  sortOrder: number;
  promptCount: number;
}

interface ArchivedCourse {
  courseId: number;
  courseName: string;
  sessions: ArchivedSession[];
}

interface CourseItem {
  id: number;
  name: string;
}

interface DiscussionsData {
  active: ActiveDiscussion[];
  openQuestions: OpenQuestionSession[];
  archived: ArchivedCourse[];
  courses: CourseItem[];
}

export default function HomePage() {
  const router = useRouter();
  const [data, setData] = useState<DiscussionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // アーカイブは授業ごとに折りたたみ（デフォルト展開）
  const [expandedArchive, setExpandedArchive] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetch("/api/discussions")
      .then(async (res) => {
        if (!res.ok) { setError("読み込みに失敗しました"); return; }
        const d: DiscussionsData = await res.json();
        setData(d);
        // デフォルトで全授業を展開
        setExpandedArchive(new Set(d.archived.map((a) => a.courseId)));
      })
      .catch(() => setError("通信エラーが発生しました"))
      .finally(() => setLoading(false));
  }, []);

  const toggleArchive = (courseId: number) => {
    setExpandedArchive((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  };

  const hasActive =
    (data?.active.length ?? 0) > 0 || (data?.openQuestions.length ?? 0) > 0;
  const hasArchived = (data?.archived.length ?? 0) > 0;

  return (
    <main className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b px-4 py-3 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <h1 className="font-bold text-gray-800 text-base">授業質問アプリ</h1>
          <a
            href="/teacher/login"
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            教員ログイン
          </a>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-5 space-y-8">
        {loading ? (
          <div className="text-center text-gray-400 py-16 text-sm">読み込み中...</div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-red-500 text-sm">{error}</p>
            <button
              onClick={() => { setLoading(true); setError(""); location.reload(); }}
              className="mt-3 text-xs px-4 py-2 bg-gray-800 text-white rounded-lg"
            >
              再読み込み
            </button>
          </div>
        ) : (
          <>
            {/* ─── セクション1: いま参加できるもの ─── */}
            {hasActive ? (
              <section>
                <SectionHeading>いま参加できるもの</SectionHeading>

                {/* 実施中ディスカッション */}
                {data!.active.length > 0 && (
                  <div className="space-y-2.5 mb-4">
                    <SubHeading>ディスカッション</SubHeading>
                    {data!.active.map((d) => (
                      <div
                        key={d.sessionId}
                        className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-blue-600 font-medium">
                              {d.courseName}　／　{d.sessionTitle}
                            </p>
                            <p className="text-xs text-emerald-600 mt-1">
                              🟢 回答受付中（{d.promptCount}問）
                            </p>
                            {d.firstPromptPreview && (
                              <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">
                                「{d.firstPromptPreview}…」
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() =>
                              router.push(`/session/${d.sessionId}?tab=discussion`)
                            }
                            className="shrink-0 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            参加する
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 質問受付中 */}
                {data!.openQuestions.length > 0 && (
                  <div className="space-y-2.5">
                    <SubHeading>質問受付中</SubHeading>
                    {data!.openQuestions.map((s) => (
                      <div
                        key={s.sessionId}
                        className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-blue-600 font-medium">
                              {s.courseName}　／　{s.sessionTitle}
                            </p>
                            <p className="text-xs text-emerald-600 mt-1">
                              🟢 質問受付中（{s.questionCount}件）
                            </p>
                            {s.latestQuestionPreview && (
                              <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">
                                最新：「{s.latestQuestionPreview}…」
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => router.push(`/session/${s.sessionId}`)}
                            className="shrink-0 text-xs px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                          >
                            質問する
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ) : (
              /* どちらも0件 */
              !hasArchived && (
                <div className="text-center py-16">
                  <p className="text-gray-400 text-sm">
                    現在参加できるセッションはありません
                  </p>
                </div>
              )
            )}

            {/* ─── セクション2: アーカイブ ─── */}
            {hasArchived && (
              <section>
                <SectionHeading>アーカイブ（過去のディスカッション）</SectionHeading>
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100">
                  {data!.archived.map((course) => {
                    const expanded = expandedArchive.has(course.courseId);
                    return (
                      <div key={course.courseId}>
                        {/* 授業見出し（折りたたみトグル） */}
                        <button
                          onClick={() => toggleArchive(course.courseId)}
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                        >
                          <span className="text-sm font-semibold text-gray-800">
                            {course.courseName}
                          </span>
                          <span className="text-gray-400 text-xs ml-2">
                            {expanded ? "▾" : "▸"}
                          </span>
                        </button>

                        {/* セッション一覧（回数順 sortOrder ASC） */}
                        {expanded && (
                          <ul className="border-t divide-y divide-gray-50 bg-gray-50">
                            {course.sessions.map((s) => (
                              <li
                                key={s.sessionId}
                                className="flex items-center justify-between px-5 py-2.5"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-sm text-gray-700 truncate">
                                    {s.sessionTitle}
                                  </span>
                                  <span className="text-xs text-gray-400 shrink-0">
                                    （{s.promptCount}問）
                                  </span>
                                </div>
                                <button
                                  onClick={() =>
                                    router.push(
                                      `/session/${s.sessionId}?tab=discussion`
                                    )
                                  }
                                  className="text-xs text-blue-500 hover:text-blue-700 shrink-0 ml-3 transition-colors"
                                >
                                  見返す →
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ─── セクション3: 授業一覧 ─── */}
            {(data?.courses.length ?? 0) > 0 && (
              <section>
                <SectionHeading>授業一覧</SectionHeading>
                <ul className="space-y-1.5">
                  {data!.courses.map((c) => (
                    <li key={c.id}>
                      <button
                        onClick={() => router.push(`/courses/${c.id}`)}
                        className="w-full text-left px-4 py-2.5 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors shadow-sm"
                      >
                        <p className="text-sm text-gray-700">{c.name}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

// ─── 小コンポーネント ─────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
      {children}
    </h2>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium text-gray-500 mb-1.5">{children}</p>
  );
}
