"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getClientId } from "@/lib/client-id";
import { StatusBadge } from "@/components/StatusBadge";
import { LikeButton } from "@/components/LikeButton";

interface Reply {
  id: number;
  content: string;
  createdAt: string;
}

interface QuestionItem {
  id: number;
  content: string;
  authorName: string | null;
  status: string;
  likeCount: number;
  likedByClient: boolean;
  createdAt: string;
  sessionTitle: string | null;
  replies: Reply[];
}

interface SessionItem {
  id: number;
  title: string;
  isOpen: boolean;
  sortOrder: number;
}

interface CourseInfo {
  id: number;
  name: string;
}

const POLL_INTERVAL = 5000;

// ─── メインコンポーネント（useSearchParams を使うため Suspense 内） ───

function CoursePageInner() {
  const { courseId } = useParams<{ courseId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [tab, setTab] = useState<"questions" | "sessions">(
    tabParam === "sessions" ? "sessions" : "questions"
  );

  const [course, setCourse] = useState<CourseInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [serverError, setServerError] = useState("");

  // === 質問タブ state ===
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [sort, setSort] = useState<"time" | "likes">("time");
  const [content, setContent] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [anonymous, setAnonymous] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  // === セッションタブ state ===
  const [sessions, setSessions] = useState<SessionItem[]>([]);

  // タブ切替: URL に保持
  const switchTab = (newTab: "questions" | "sessions") => {
    setTab(newTab);
    router.replace(`/courses/${courseId}?tab=${newTab}`, { scroll: false });
  };

  // 授業名取得
  useEffect(() => {
    fetch(`/api/courses/public?q=`, { cache: "no-store" })
      .then((r) => r.ok ? r.json() : [])
      .then((list: CourseInfo[]) => {
        const found = list.find((c) => c.id === parseInt(courseId));
        if (found) setCourse(found);
        else setNotFound(true);
      })
      .catch(() => setServerError("授業情報の取得に失敗しました"));
  }, [courseId]);

  // 質問取得
  const fetchQuestions = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const clientId = getClientId();
    try {
      const res = await fetch(
        `/api/courses/${courseId}/questions?sort=${sort}&clientId=${clientId}`,
        { signal: abortRef.current.signal, cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        setQuestions(Array.isArray(data) ? data : []);
        setLoading(false);
      } else if (res.status === 404) {
        setNotFound(true);
        setLoading(false);
      } else {
        setServerError("質問の取得に失敗しました");
        setLoading(false);
      }
    } catch {
      // AbortError
    }
  }, [courseId, sort]);

  // セッション取得
  const fetchSessions = useCallback(async () => {
    const res = await fetch(`/api/courses/${courseId}/sessions`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setSessions(Array.isArray(data) ? data : []);
      setLoading(false);
    } else if (res.status === 404) {
      setNotFound(true);
      setLoading(false);
    } else {
      setServerError("セッション一覧の取得に失敗しました");
      setLoading(false);
    }
  }, [courseId]);

  // 初回ロードとタブ切替時のデータ取得
  useEffect(() => {
    setLoading(true);
    if (tab === "questions") {
      fetchQuestions();
      const timer = setInterval(fetchQuestions, POLL_INTERVAL);
      return () => {
        clearInterval(timer);
        abortRef.current?.abort();
      };
    } else {
      fetchSessions();
    }
  }, [tab, fetchQuestions, fetchSessions]);

  // visibilitychange + pageshow でデータ再取得
  useEffect(() => {
    const handleVisible = () => {
      if (document.visibilityState === "visible") {
        if (tab === "questions") fetchQuestions();
        else fetchSessions();
      }
    };
    const handlePageshow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        if (tab === "questions") fetchQuestions();
        else fetchSessions();
      }
    };
    document.addEventListener("visibilitychange", handleVisible);
    window.addEventListener("pageshow", handlePageshow as EventListener);
    return () => {
      document.removeEventListener("visibilitychange", handleVisible);
      window.removeEventListener("pageshow", handlePageshow as EventListener);
    };
  }, [tab, fetchQuestions, fetchSessions]);

  // 質問投稿
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    setSubmitError("");
    const clientId = getClientId();
    try {
      const res = await fetch(`/api/courses/${courseId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          authorName: anonymous ? null : authorName.trim() || null,
          clientId,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSubmitError(data.error ?? "投稿に失敗しました");
        return;
      }
      setContent("");
      await fetchQuestions();
    } finally {
      setSubmitting(false);
    }
  };

  if (notFound) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">授業が見つかりません</p>
          <a href="/" className="text-indigo-500 underline mt-2 block">トップに戻る</a>
        </div>
      </main>
    );
  }

  if (serverError) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-500">{serverError}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 text-sm px-4 py-2 bg-gray-800 text-white rounded-lg"
          >
            再読み込み
          </button>
          <a href="/" className="text-indigo-500 underline mt-3 block text-sm">トップに戻る</a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 pt-3 pb-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/")}
              className="text-xs text-gray-400 hover:text-gray-600 py-1 pr-2"
            >
              ←
            </button>
            <h1 className="font-bold text-gray-800 text-sm truncate">
              {course?.name ?? "読み込み中..."}
            </h1>
          </div>

          {/* タブ */}
          <div className="flex gap-6 border-b border-gray-200 mt-2">
            <button
              onClick={() => switchTab("questions")}
              className={`text-sm pb-2 font-medium border-b-2 transition-colors ${
                tab === "questions"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              質問
            </button>
            <button
              onClick={() => switchTab("sessions")}
              className={`text-sm pb-2 font-medium border-b-2 transition-colors ${
                tab === "sessions"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              ディスカッション
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {loading ? (
          <div className="text-center text-gray-400 py-16 text-sm">読み込み中...</div>
        ) : tab === "questions" ? (
          <>
            {/* 質問投稿フォーム */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <h2 className="font-semibold text-gray-700 mb-3 text-sm">質問を投稿する</h2>
              <form onSubmit={handleSubmit} className="space-y-3">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="質問を入力してください..."
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                  maxLength={500}
                />
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={anonymous}
                      onChange={(e) => setAnonymous(e.target.checked)}
                      className="rounded"
                    />
                    匿名で投稿
                  </label>
                  {!anonymous && (
                    <input
                      type="text"
                      value={authorName}
                      onChange={(e) => setAuthorName(e.target.value)}
                      placeholder="名前（任意）"
                      className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                      maxLength={50}
                    />
                  )}
                </div>
                {submitError && <p className="text-red-500 text-xs">{submitError}</p>}
                <button
                  type="submit"
                  disabled={submitting || !content.trim()}
                  className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {submitting ? "投稿中..." : "質問を送信"}
                </button>
              </form>
            </div>

            {/* ソート切替 */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">{questions.length} 件の質問</span>
              <div className="flex gap-1">
                {(["time", "likes"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSort(s)}
                    className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                      sort === s
                        ? "bg-indigo-600 text-white"
                        : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {s === "time" ? "新着順" : "いいね順"}
                  </button>
                ))}
              </div>
            </div>

            {/* 質問一覧 */}
            {questions.length === 0 ? (
              <div className="text-center text-gray-400 py-12 text-sm">
                まだ質問がありません
              </div>
            ) : (
              <div className="space-y-3">
                {questions.map((q) => (
                  <QuestionCard key={q.id} question={q} />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {/* セッション一覧（ディスカッション用） */}
            {sessions.length === 0 ? (
              <div className="text-center text-gray-400 py-12 text-sm">
                ディスカッションのセッションがありません
              </div>
            ) : (
              <ul className="space-y-2">
                {sessions.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => router.push(`/session/${s.id}`)}
                      className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50 transition-colors shadow-sm"
                    >
                      <span className="font-medium text-sm text-gray-800">{s.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <div className="h-6" />
      </div>
    </main>
  );
}

function QuestionCard({ question }: { question: QuestionItem }) {
  const [showReplies, setShowReplies] = useState(true);
  const dt = new Date(question.createdAt).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="bg-white rounded-lg shadow-sm border p-4 space-y-2">
      {/* セッション由来タグ */}
      {question.sessionTitle && (
        <span className="inline-block text-xs bg-gray-100 text-gray-500 rounded px-2 py-0.5">
          {question.sessionTitle}
        </span>
      )}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-gray-800 leading-relaxed flex-1">{question.content}</p>
        <StatusBadge status={question.status} />
      </div>
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>{question.authorName ?? "匿名"} · {dt}</span>
        <LikeButton
          questionId={question.id}
          likeCount={question.likeCount}
          likedByClient={question.likedByClient}
        />
      </div>
      {question.replies.length > 0 && (
        <div className="mt-2 border-t pt-2">
          <button
            onClick={() => setShowReplies((v) => !v)}
            className="text-xs text-indigo-500 mb-1"
          >
            {showReplies ? "返信を隠す" : `返信を見る (${question.replies.length})`}
          </button>
          {showReplies &&
            question.replies.map((r) => (
              <div key={r.id} className="bg-indigo-50 rounded-lg px-3 py-2 text-xs text-indigo-800 mt-1">
                <span className="font-medium text-indigo-600 mr-1">教員:</span>
                {r.content}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

export default function CourseSessionsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <p className="text-gray-400 text-sm">読み込み中...</p>
        </div>
      }
    >
      <CoursePageInner />
    </Suspense>
  );
}
