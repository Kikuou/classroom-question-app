"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { getClientId } from "@/lib/client-id";
import { StatusBadge } from "@/components/StatusBadge";
import { LikeButton } from "@/components/LikeButton";

interface Reply {
  id: number;
  content: string;
  createdAt: string;
}

interface Question {
  id: number;
  content: string;
  authorName: string | null;
  status: string;
  likeCount: number;
  likedByClient: boolean;
  createdAt: string;
  replies: Reply[];
}

interface SessionInfo {
  id: number;
  title: string;
  isOpen: boolean;
  courseName: string;
}

const POLL_INTERVAL = 5000;

export default function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [sort, setSort] = useState<"time" | "likes">("time");
  const [content, setContent] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [anonymous, setAnonymous] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchQuestions = useCallback(async () => {
    // 進行中のフェッチをキャンセル
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const clientId = getClientId();
    try {
      const res = await fetch(
        `/api/sessions/${sessionId}/questions?sort=${sort}&clientId=${clientId}`,
        { signal: abortRef.current.signal }
      );
      if (res.ok) setQuestions(await res.json());
    } catch {
      // AbortError は無視
    }
  }, [sessionId, sort]);

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}`)
      .then((r) => {
        if (!r.ok) { setNotFound(true); return null; }
        return r.json();
      })
      .then((data) => data && setSession(data));
  }, [sessionId]);

  useEffect(() => {
    fetchQuestions();
    const timer = setInterval(fetchQuestions, POLL_INTERVAL);
    return () => {
      clearInterval(timer);
      abortRef.current?.abort();
    };
  }, [fetchQuestions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    setError("");
    const clientId = getClientId();
    try {
      const res = await fetch(`/api/sessions/${sessionId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          authorName: anonymous ? null : authorName.trim() || null,
          clientId,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "投稿に失敗しました");
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
          <p className="text-gray-500">セッションが見つかりません</p>
          <a href="/" className="text-blue-500 underline mt-2 block">トップに戻る</a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">{session?.courseName}</p>
            <h1 className="font-bold text-gray-800 text-sm leading-tight">
              {session?.title ?? "読み込み中..."}
            </h1>
          </div>
          <span
            className={`text-xs font-medium px-2 py-1 rounded-full ${
              session?.isOpen
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {session?.isOpen ? "受付中" : "締切"}
          </span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* 質問投稿フォーム */}
        {session?.isOpen && (
          <div className="bg-white rounded-2xl shadow-sm border p-4">
            <h2 className="font-semibold text-gray-700 mb-3 text-sm">質問を投稿する</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="質問を入力してください..."
                rows={3}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
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
                    className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    maxLength={50}
                  />
                )}
              </div>
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <button
                type="submit"
                disabled={submitting || !content.trim()}
                className="w-full bg-blue-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? "投稿中..." : "質問を送信"}
              </button>
            </form>
          </div>
        )}

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
                    ? "bg-blue-600 text-white"
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
      </div>
    </main>
  );
}

function QuestionCard({ question }: { question: Question }) {
  const [showReplies, setShowReplies] = useState(true);
  const dt = new Date(question.createdAt).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="bg-white rounded-2xl shadow-sm border p-4 space-y-2">
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
            className="text-xs text-blue-500 mb-1"
          >
            {showReplies ? "返信を隠す" : `返信を見る (${question.replies.length})`}
          </button>
          {showReplies &&
            question.replies.map((r) => (
              <div key={r.id} className="bg-blue-50 rounded-xl px-3 py-2 text-xs text-blue-800 mt-1">
                <span className="font-medium text-blue-600 mr-1">教員:</span>
                {r.content}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
