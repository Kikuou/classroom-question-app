"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import { StatusSelector } from "@/components/StatusSelector";

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
  sortOrder: number;
  createdAt: string;
  replies: Reply[];
}

interface SessionInfo {
  id: number;
  title: string;
  isOpen: boolean;
  courseName: string;
  courseId: number;
}

const POLL_INTERVAL = 3000;

export default function TeacherSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [sort, setSort] = useState<"time" | "likes" | "manual">("time");
  const [replyInputs, setReplyInputs] = useState<Record<number, string>>({});
  const [submittingReply, setSubmittingReply] = useState<number | null>(null);
  const [exportSort, setExportSort] = useState<"time" | "likes">("likes");
  const abortRef = useRef<AbortController | null>(null);
  const dragItem = useRef<number | null>(null);
  const dragOver = useRef<number | null>(null);

  const fetchQuestions = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    try {
      const res = await fetch(
        `/api/sessions/${sessionId}/questions?all=true&sort=${sort}`,
        { signal: abortRef.current.signal }
      );
      if (res.status === 401) {
        router.replace("/teacher/login");
        return;
      }
      if (res.ok) setQuestions(await res.json());
    } catch {
      // AbortError は無視
    }
  }, [sessionId, sort, router]);

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}`)
      .then((r) => r.ok ? r.json() : null)
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

  const toggleOpen = async () => {
    if (!session) return;
    const res = await fetch(`/api/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isOpen: !session.isOpen }),
    });
    if (res.ok) {
      const updated = await res.json();
      setSession((s) => s ? { ...s, isOpen: updated.isOpen } : s);
    }
  };

  const submitReply = async (questionId: number) => {
    const content = replyInputs[questionId]?.trim();
    if (!content) return;
    setSubmittingReply(questionId);
    try {
      const res = await fetch(`/api/questions/${questionId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        setReplyInputs((prev) => ({ ...prev, [questionId]: "" }));
        await fetchQuestions();
      }
    } finally {
      setSubmittingReply(null);
    }
  };

  const deleteQuestion = async (questionId: number) => {
    if (!confirm("この質問を削除しますか？（データは保持されます）")) return;
    const res = await fetch(`/api/questions/${questionId}`, { method: "DELETE" });
    if (res.ok) setQuestions((prev) => prev.filter((q) => q.id !== questionId));
  };

  // ドラッグ&ドロップ（manualモード時）
  const handleDragStart = (index: number) => { dragItem.current = index; };
  const handleDragEnter = (index: number) => { dragOver.current = index; };
  const handleDragEnd = async () => {
    if (dragItem.current === null || dragOver.current === null) return;
    if (dragItem.current === dragOver.current) return;

    const updated = [...questions];
    const [moved] = updated.splice(dragItem.current, 1);
    updated.splice(dragOver.current, 0, moved);
    const reordered = updated.map((q, i) => ({ ...q, sortOrder: i }));
    setQuestions(reordered);
    dragItem.current = null;
    dragOver.current = null;

    await fetch("/api/questions/sort", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: reordered.map((q) => q.id) }),
    });
  };

  const counts = {
    total: questions.length,
    pending: questions.filter((q) => q.status === "pending").length,
    answered: questions.filter((q) => q.status === "answered").length,
    hidden: questions.filter((q) => q.status === "hidden").length,
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10 px-4 py-3">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <button
                onClick={() => session && router.push(`/teacher/courses/${session.courseId}`)}
                className="text-xs text-gray-400 hover:text-gray-600 mb-0.5 block"
              >
                ← 授業一覧
              </button>
              <h1 className="font-bold text-gray-800 text-sm">{session?.title ?? "読み込み中..."}</h1>
            </div>
            <button
              onClick={toggleOpen}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                session?.isOpen
                  ? "border-red-200 text-red-600 bg-red-50 hover:bg-red-100"
                  : "border-green-200 text-green-600 bg-green-50 hover:bg-green-100"
              }`}
            >
              {session?.isOpen ? "締め切る" : "再開する"}
            </button>
          </div>
          {/* 統計バー */}
          <div className="flex items-center gap-3 text-xs">
            <span className="text-gray-500">全 {counts.total} 件</span>
            <span className="text-yellow-600 font-medium">未対応 {counts.pending}</span>
            <span className="text-green-600 font-medium">回答済 {counts.answered}</span>
            {counts.hidden > 0 && (
              <span className="text-gray-400">非表示 {counts.hidden}</span>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-3">
        {/* ツールバー */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex gap-1">
            {(["time", "likes", "manual"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                  sort === s
                    ? "bg-gray-800 text-white"
                    : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                }`}
              >
                {s === "time" ? "新着順" : s === "likes" ? "いいね順" : "手動並替"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={exportSort}
              onChange={(e) => setExportSort(e.target.value as "time" | "likes")}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600"
            >
              <option value="likes">いいね順でCSV</option>
              <option value="time">時系列でCSV</option>
            </select>
            <a
              href={`/api/sessions/${sessionId}/export?sort=${exportSort}`}
              className="text-xs px-3 py-1.5 border border-gray-200 bg-white rounded-lg hover:bg-gray-50 text-gray-600"
            >
              CSV出力
            </a>
          </div>
        </div>

        {sort === "manual" && questions.length > 0 && (
          <p className="text-xs text-gray-400">ドラッグ&ドロップで並び替えできます</p>
        )}

        {questions.length === 0 ? (
          <div className="text-center text-gray-400 py-12 text-sm">質問がありません</div>
        ) : (
          questions.map((q, index) => (
            <TeacherQuestionCard
              key={q.id}
              question={q}
              replyInput={replyInputs[q.id] ?? ""}
              onReplyChange={(v) => setReplyInputs((prev) => ({ ...prev, [q.id]: v }))}
              onReplySubmit={() => submitReply(q.id)}
              onDelete={() => deleteQuestion(q.id)}
              submitting={submittingReply === q.id}
              draggable={sort === "manual"}
              onDragStart={() => handleDragStart(index)}
              onDragEnter={() => handleDragEnter(index)}
              onDragEnd={handleDragEnd}
            />
          ))
        )}
      </div>
    </main>
  );
}

function TeacherQuestionCard({
  question,
  replyInput,
  onReplyChange,
  onReplySubmit,
  onDelete,
  submitting,
  draggable,
  onDragStart,
  onDragEnter,
  onDragEnd,
}: {
  question: Question;
  replyInput: string;
  onReplyChange: (v: string) => void;
  onReplySubmit: () => void;
  onDelete: () => void;
  submitting: boolean;
  draggable: boolean;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDragEnd: () => void;
}) {
  const [status, setStatus] = useState(question.status);
  useEffect(() => {
    setStatus(question.status);
  }, [question.status]);

  const [showReply, setShowReply] = useState(false);
  const dt = new Date(question.createdAt).toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const hasReply = question.replies.length > 0;

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()}
      className={`bg-white rounded-2xl shadow-sm border p-4 space-y-3 transition-opacity ${
        status === "hidden" ? "opacity-40" : ""
      } ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      {/* 質問本文 + いいね・ステータス */}
      <div className="flex items-start gap-2">
        {draggable && <span className="text-gray-300 text-lg mt-0.5 shrink-0">⠿</span>}
        <p className="text-sm text-gray-800 leading-relaxed flex-1">{question.content}</p>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-sm text-gray-500 font-medium">♥ {question.likeCount}</span>
          <StatusBadge status={status} />
          {hasReply && (
            <span className="text-xs text-blue-500 font-medium">返信済</span>
          )}
        </div>
      </div>

      {/* メタ情報 */}
      <div className="text-xs text-gray-400">
        {question.authorName ?? "匿名"} · {dt}
      </div>

      {/* ステータス切替 */}
      <StatusSelector
        questionId={question.id}
        currentStatus={status}
        onStatusChange={setStatus}
      />

      {/* 返信一覧 */}
      {hasReply && (
        <div className="space-y-1">
          {question.replies.map((r) => (
            <div key={r.id} className="bg-blue-50 rounded-xl px-3 py-2 text-xs text-blue-800">
              <span className="font-medium text-blue-600 mr-1">返信:</span>
              {r.content}
            </div>
          ))}
        </div>
      )}

      {/* 返信入力 + 削除ボタン */}
      <div className="border-t pt-2 flex items-center gap-2">
        {showReply ? (
          <div className="flex gap-2 flex-1">
            <input
              type="text"
              value={replyInput}
              onChange={(e) => onReplyChange(e.target.value)}
              placeholder="返信を入力..."
              className="flex-1 min-w-0 border border-gray-300 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
              onKeyDown={(e) => e.key === "Enter" && !submitting && onReplySubmit()}
              autoFocus
            />
            <button
              onClick={onReplySubmit}
              disabled={submitting || !replyInput.trim()}
              className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "送信中" : "送信"}
            </button>
            <button
              onClick={() => setShowReply(false)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              閉じる
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowReply(true)}
            className="text-xs text-blue-500 hover:text-blue-700 flex-1"
          >
            {hasReply ? "+ 追加返信" : "+ 返信する"}
          </button>
        )}
        <button
          onClick={onDelete}
          className="text-xs text-red-400 hover:text-red-600 ml-auto"
        >
          削除
        </button>
      </div>
    </div>
  );
}
