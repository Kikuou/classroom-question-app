"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface ActiveDiscussion {
  sessionId: number;
  sessionTitle: string;
  courseId: number;
  courseName: string;
  promptCount: number;
  firstPromptPreview: string;
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
  pendingCount: number;
  answeredCount: number;
}

interface DiscussionsData {
  active: ActiveDiscussion[];
  questionCourses: CourseItem[];
  archived: ArchivedCourse[];
  courses: CourseItem[];
}

type Mode = "questions" | "discussion";

// ─── メインコンポーネント（useSearchParams を使うため Suspense 内） ───

function HomePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode: Mode = (searchParams.get("mode") as Mode) ?? "discussion";

  const [data, setData] = useState<DiscussionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // アーカイブ折りたたみ状態
  const [expandedArchive, setExpandedArchive] = useState<Set<number>>(new Set());

  // タブ切替（URL を replace: ブラウザ履歴を汚さない）
  const setMode = (newMode: Mode) => {
    router.replace(`/?mode=${newMode}`, { scroll: false });
  };

  // データ取得（初回 + 再表示時に共通で使う）
  const loadData = useCallback(async (initial: boolean = false) => {
    if (initial) { setLoading(true); setError(""); }
    try {
      const res = await fetch("/api/discussions", { cache: "no-store" });
      if (!res.ok) {
        if (initial) setError("読み込みに失敗しました");
        return;
      }
      const raw = await res.json();
      // Fix #6: APIレスポンスの形状を実行時に検証（予期しない形状でのクラッシュ防止）
      const d: DiscussionsData = {
        active: Array.isArray(raw?.active) ? raw.active : [],
        questionCourses: Array.isArray(raw?.questionCourses) ? raw.questionCourses : [],
        archived: Array.isArray(raw?.archived) ? raw.archived : [],
        courses: Array.isArray(raw?.courses) ? raw.courses : [],
      };
      setData(d);
      setError(""); // 成功時のみエラーをクリア
      // アーカイブに新しい授業が追加されたときだけ展開状態に追加
      // 既に折りたたんだ授業は維持し、新規分だけ自動展開
      setExpandedArchive((prev) => {
        const next = new Set(prev);
        d.archived.forEach((a) => {
          if (!prev.has(a.courseId)) next.add(a.courseId);
        });
        return next;
      });
    } catch {
      if (initial) setError("通信エラーが発生しました");
    } finally {
      if (initial) setLoading(false);
    }
  }, []);

  // 初回ロード
  useEffect(() => {
    loadData(true);
  }, [loadData]);

  // 30秒ポーリング（ディスカッション再開 / 締切の即時反映）
  useEffect(() => {
    const timer = setInterval(() => loadData(), 30000);
    return () => clearInterval(timer);
  }, [loadData]);

  // タブ復帰・bfcache復元時に最新データを再取得
  // （教員が削除・非公開にした内容を即時反映するため）
  useEffect(() => {
    const handleVisible = () => {
      if (document.visibilityState === "visible") loadData();
    };
    const handlePageshow = (e: PageTransitionEvent) => {
      if (e.persisted) loadData();
    };
    document.addEventListener("visibilitychange", handleVisible);
    window.addEventListener("pageshow", handlePageshow as EventListener);
    return () => {
      document.removeEventListener("visibilitychange", handleVisible);
      window.removeEventListener("pageshow", handlePageshow as EventListener);
    };
  }, [loadData]);

  const toggleArchive = (courseId: number) => {
    setExpandedArchive((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  };

  return (
    <main className="min-h-screen bg-gray-50">
      {/* ヘッダー + セグメントコントロール */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 pt-3 pb-0 flex items-center justify-between">
          <h1 className="font-bold text-gray-800 text-base">授業質問アプリ</h1>
          <a
            href="/teacher/login"
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            教員ログイン
          </a>
        </div>

        {/* iOS セグメントコントロール風タブ */}
        <div className="max-w-lg mx-auto px-4 pt-3 pb-3">
          <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
            <button
              onClick={() => setMode("discussion")}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                mode === "discussion"
                  ? "bg-white text-gray-800 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              💬 ディスカッション
            </button>
            <button
              onClick={() => setMode("questions")}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                mode === "questions"
                  ? "bg-white text-gray-800 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              📝 質問
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-5">
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
        ) : mode === "questions" ? (
          <QuestionsTab data={data!} router={router} />
        ) : (
          <DiscussionTab
            data={data!}
            router={router}
            expandedArchive={expandedArchive}
            toggleArchive={toggleArchive}
          />
        )}
      </div>
    </main>
  );
}

// ─── 質問タブ ──────────────────────────────────────────────────

function QuestionsTab({
  data,
  router,
}: {
  data: DiscussionsData;
  router: ReturnType<typeof useRouter>;
}) {
  const hasCourses = data.questionCourses.length > 0;

  return (
    <div className="space-y-6">
      {/* 授業一覧 */}
      <section>
        <SectionHeading>授業一覧</SectionHeading>
        {!hasCourses ? (
          <div className="text-center py-10">
            <p className="text-gray-400 text-sm">まだ授業が公開されていません</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {data.questionCourses.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => router.push(`/courses/${c.id}?tab=questions`)}
                  className={`w-full text-left px-4 py-3 bg-white rounded-lg border border-gray-200 border-l-4 ${courseAccentColor(c.id)} hover:bg-indigo-50 transition-colors shadow-sm`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-800">{c.name}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      {c.pendingCount > 0 && (
                        <span className="text-xs text-amber-600 font-medium">
                          未回答 {c.pendingCount}
                        </span>
                      )}
                      {c.answeredCount > 0 && (
                        <span className="text-xs text-emerald-600">
                          回答済み {c.answeredCount}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-indigo-500 mt-0.5">質問する・過去の質問を見る →</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ─── ディスカッションタブ ───────────────────────────────────────

function DiscussionTab({
  data,
  router,
  expandedArchive,
  toggleArchive,
}: {
  data: DiscussionsData;
  router: ReturnType<typeof useRouter>;
  expandedArchive: Set<number>;
  toggleArchive: (courseId: number) => void;
}) {
  const hasActive = data.active.length > 0;
  const hasArchived = data.archived.length > 0;

  return (
    <div className="space-y-6">
      {/* 実施中ディスカッション */}
      <section>
        <SectionHeading>実施中のディスカッション</SectionHeading>
        {!hasActive ? (
          <div className="text-center py-10">
            <p className="text-gray-400 text-sm">
              現在、進行中のディスカッションはありません
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {data.active.map((d) => (
              <div
                key={d.sessionId}
                className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-indigo-600">
                      {d.courseName}　／　{d.sessionTitle}
                    </p>
                    {d.promptCount > 0 ? (
                      <>
                        <p className="text-xs text-emerald-600 mt-1">
                          🟢 回答受付中（{d.promptCount}問）
                        </p>
                        {d.firstPromptPreview && (
                          <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">
                            「{d.firstPromptPreview}…」
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-amber-500 mt-1">
                        ⏳ 準備中（しばらくお待ちください）
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() =>
                      router.push(`/session/${d.sessionId}`)
                    }
                    className="shrink-0 text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap"
                  >
                    参加する
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* アーカイブ */}
      {hasArchived && (
        <section>
          <SectionHeading>アーカイブ（終了したディスカッション）</SectionHeading>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100">
            {data.archived.map((course) => {
              const expanded = expandedArchive.has(course.courseId);
              return (
                <div key={course.courseId}>
                  {/* 授業見出し */}
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

                  {/* セッション一覧（sortOrder ASC） */}
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
                              router.push(`/session/${s.sessionId}`)
                            }
                            className="text-xs text-indigo-500 hover:text-indigo-700 shrink-0 ml-3 transition-colors"
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

      {/* どちらも0件 */}
      {!hasActive && !hasArchived && (
        <div className="text-center py-10">
          <p className="text-gray-400 text-sm">
            まだディスカッションは行われていません
          </p>
        </div>
      )}
    </div>
  );
}

// ─── 共通コンポーネント ─────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
      {children}
    </h2>
  );
}

// 授業カードの左ボーダーアクセント色（courseId でローテーション）
const COURSE_ACCENT = [
  "border-l-indigo-300",
  "border-l-emerald-300",
  "border-l-amber-300",
  "border-l-rose-300",
  "border-l-violet-300",
];
function courseAccentColor(id: number) {
  return COURSE_ACCENT[id % COURSE_ACCENT.length];
}

// ─── エクスポート（Suspense でラップ: useSearchParams 対応） ─────

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <p className="text-gray-400 text-sm">読み込み中...</p>
        </div>
      }
    >
      <HomePageInner />
    </Suspense>
  );
}
