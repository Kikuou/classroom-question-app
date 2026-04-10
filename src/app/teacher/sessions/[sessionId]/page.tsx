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

interface PromptItem {
  id: number;
  content: string;
  sortOrder: number;
  isResultsVisible: boolean;
  isDeleted: boolean;
  responseCount: number;
  createdAt: string;
}

interface PromptResponseItem {
  id: number;
  answer: string;
  createdAt: string;
}

interface SessionInfo {
  id: number;
  title: string;
  isOpen: boolean;
  discussionOpen: boolean;
  courseName: string;
  courseId: number;
  promptDescription: string | null;
}

const POLL_INTERVAL = 3000;

export default function TeacherSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState("");
  const [tab, setTab] = useState<"questions" | "prompts">("questions");

  // === 質問タブ state ===
  const [questions, setQuestions] = useState<Question[]>([]);
  const [sort, setSort] = useState<"time" | "likes" | "manual">("time");
  const [replyInputs, setReplyInputs] = useState<Record<number, string>>({});
  const [submittingReply, setSubmittingReply] = useState<number | null>(null);
  const [exportSort, setExportSort] = useState<"time" | "likes">("likes");
  const abortRef = useRef<AbortController | null>(null);
  const dragItem = useRef<number | null>(null);
  const dragOver = useRef<number | null>(null);

  // === ディスカッション問題タブ state ===
  const [promptList, setPromptList] = useState<PromptItem[]>([]);
  const [newPromptContent, setNewPromptContent] = useState("");
  const [editingPromptId, setEditingPromptId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [viewingResponses, setViewingResponses] = useState<number | null>(null);
  const [responses, setResponses] = useState<PromptResponseItem[]>([]);
  const promptDragItem = useRef<number | null>(null);
  const promptDragOver = useRef<number | null>(null);
  // 全問回答一覧
  const [showOverview, setShowOverview] = useState(false);
  const [overviewData, setOverviewData] = useState<(PromptItem & { responses: PromptResponseItem[] })[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(false);
  // 一括切替
  const [bulkUpdating, setBulkUpdating] = useState(false);

  // === 全体説明 state ===
  const [descInput, setDescInput] = useState("");
  const [descEditing, setDescEditing] = useState(false);
  const [descSaving, setDescSaving] = useState(false);

  // === セッション情報取得 ===
  useEffect(() => {
    setSessionLoading(true);
    setSessionError("");
    fetch(`/api/sessions/${sessionId}`)
      .then(async (r) => {
        if (r.status === 401) { router.replace("/teacher/login"); return null; }
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          setSessionError(data.detail ?? data.error ?? "セッション情報の取得に失敗しました");
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (data) {
          setSession(data);
          setDescInput(data.promptDescription ?? "");
        }
      })
      .catch(() => setSessionError("通信エラーが発生しました"))
      .finally(() => setSessionLoading(false));
  }, [sessionId, router]);

  // === 質問取得 ===
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
      // AbortError
    }
  }, [sessionId, sort, router]);

  // === プロンプト取得 ===
  const fetchPrompts = useCallback(async () => {
    const res = await fetch(`/api/sessions/${sessionId}/prompts`);
    if (res.status === 401) {
      router.replace("/teacher/login");
      return;
    }
    if (res.ok) setPromptList(await res.json());
  }, [sessionId, router]);

  // === ポーリング ===
  useEffect(() => {
    if (tab === "questions") {
      fetchQuestions();
      const timer = setInterval(fetchQuestions, POLL_INTERVAL);
      return () => {
        clearInterval(timer);
        abortRef.current?.abort();
      };
    } else {
      fetchPrompts();
      const timer = setInterval(fetchPrompts, POLL_INTERVAL);
      return () => clearInterval(timer);
    }
  }, [tab, fetchQuestions, fetchPrompts]);

  // 質問受付の切替
  const toggleQuestionsOpen = async () => {
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

  // ディスカッション回答受付の切替
  const toggleDiscussionOpen = async () => {
    if (!session) return;
    const res = await fetch(`/api/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ discussionOpen: !session.discussionOpen }),
    });
    if (res.ok) {
      const updated = await res.json();
      setSession((s) => s ? { ...s, discussionOpen: updated.discussionOpen } : s);
    }
  };

  // === 質問操作 ===
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

  // === 全体説明保存 ===
  const saveDescription = async () => {
    setDescSaving(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptDescription: descInput }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSession((s) => s ? { ...s, promptDescription: updated.promptDescription } : s);
        setDescEditing(false);
      }
    } finally {
      setDescSaving(false);
    }
  };

  // === プロンプト操作 ===
  const createPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromptContent.trim()) return;
    const res = await fetch(`/api/sessions/${sessionId}/prompts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: newPromptContent.trim() }),
    });
    if (res.ok) {
      setNewPromptContent("");
      await fetchPrompts();
    }
  };

  const updatePrompt = async (promptId: number) => {
    if (!editContent.trim()) return;
    const res = await fetch(`/api/prompts/${promptId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editContent.trim() }),
    });
    if (res.ok) {
      setEditingPromptId(null);
      setEditContent("");
      await fetchPrompts();
    }
  };

  const deletePrompt = async (promptId: number) => {
    if (!confirm("この問題を削除しますか？")) return;
    const res = await fetch(`/api/prompts/${promptId}`, { method: "DELETE" });
    if (res.ok) setPromptList((prev) => prev.filter((p) => p.id !== promptId));
  };

  const toggleResultsVisible = async (promptId: number, current: boolean) => {
    const res = await fetch(`/api/prompts/${promptId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isResultsVisible: !current }),
    });
    if (res.ok) {
      setPromptList((prev) =>
        prev.map((p) => p.id === promptId ? { ...p, isResultsVisible: !current } : p)
      );
    }
  };

  const viewResponses = async (promptId: number) => {
    if (viewingResponses === promptId) {
      setViewingResponses(null);
      return;
    }
    const res = await fetch(`/api/prompts/${promptId}/responses`);
    if (res.ok) {
      setResponses(await res.json());
      setViewingResponses(promptId);
    }
  };

  // === 一括結果公開/非公開 ===
  const bulkToggleVisibility = async (makeVisible: boolean) => {
    const targets = promptList.filter((p) => !p.isDeleted);
    if (targets.length === 0) return;
    setBulkUpdating(true);
    try {
      await Promise.all(
        targets.map((p) =>
          fetch(`/api/prompts/${p.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isResultsVisible: makeVisible }),
          })
        )
      );
      setPromptList((prev) =>
        prev.map((p) => (p.isDeleted ? p : { ...p, isResultsVisible: makeVisible }))
      );
    } finally {
      setBulkUpdating(false);
    }
  };

  // === 全問回答一覧 ===
  const loadOverview = async () => {
    setOverviewLoading(true);
    const targets = promptList.filter((p) => !p.isDeleted);
    try {
      const results = await Promise.all(
        targets.map(async (p) => {
          const res = await fetch(`/api/prompts/${p.id}/responses`);
          const resps: PromptResponseItem[] = res.ok ? await res.json() : [];
          return { ...p, responses: resps };
        })
      );
      setOverviewData(results);
      setShowOverview(true);
    } finally {
      setOverviewLoading(false);
    }
  };

  const handlePromptDragStart = (index: number) => { promptDragItem.current = index; };
  const handlePromptDragEnter = (index: number) => { promptDragOver.current = index; };
  const handlePromptDragEnd = async () => {
    if (promptDragItem.current === null || promptDragOver.current === null) return;
    if (promptDragItem.current === promptDragOver.current) return;
    const updated = [...promptList];
    const [moved] = updated.splice(promptDragItem.current, 1);
    updated.splice(promptDragOver.current, 0, moved);
    const reordered = updated.map((p, i) => ({ ...p, sortOrder: i }));
    setPromptList(reordered);
    promptDragItem.current = null;
    promptDragOver.current = null;
    await fetch("/api/prompts/sort", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: reordered.map((p) => p.id) }),
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
      {/* 全問回答一覧オーバーレイ */}
      {showOverview && (
        <div className="fixed inset-0 z-50 bg-black/60 flex flex-col">
          <div className="flex-1 overflow-y-auto bg-gray-50">
            <div className="max-w-3xl mx-auto px-4 py-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-800">全問の回答一覧</h2>
                <button
                  onClick={() => setShowOverview(false)}
                  className="text-sm px-4 py-2 bg-gray-800 text-white rounded-xl"
                >
                  閉じる
                </button>
              </div>
              {overviewData.length === 0 ? (
                <p className="text-center text-gray-400 py-12 text-sm">問題がありません</p>
              ) : (
                <div className="space-y-6">
                  {overviewData.map((p, qi) => (
                    <div key={p.id} className="bg-white rounded-2xl shadow-sm border p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs text-gray-400 font-medium mb-1">Q{qi + 1}</p>
                          <p className="text-sm font-medium text-gray-800 leading-relaxed">{p.content}</p>
                        </div>
                        <span className="text-xs text-gray-500 shrink-0 ml-2">{p.responses.length}件</span>
                      </div>
                      <div className="border-t pt-3">
                        {p.responses.length === 0 ? (
                          <p className="text-xs text-gray-400">まだ回答がありません</p>
                        ) : (
                          <div className="space-y-1.5">
                            {p.responses.map((r) => (
                              <div key={r.id} className="bg-purple-50 rounded-xl px-3 py-2 text-sm text-purple-800">
                                {r.answer}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <header className="bg-white border-b sticky top-0 z-10 px-4 py-3">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <button
                onClick={() =>
                  session
                    ? router.push(`/teacher/courses/${session.courseId}`)
                    : router.push("/teacher/dashboard")
                }
                className="text-xs text-gray-400 hover:text-gray-600 mb-0.5 block"
              >
                ← {session ? "授業一覧" : "ダッシュボード"}
              </button>
              <h1 className="font-bold text-gray-800 text-sm">
                {sessionLoading ? "読み込み中..." : sessionError ? "エラー" : (session?.title ?? "")}
              </h1>
            </div>
            <div className="flex flex-col gap-1 items-end shrink-0">
              <button
                onClick={toggleQuestionsOpen}
                disabled={!session}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors disabled:opacity-40 ${
                  session?.isOpen
                    ? "border-red-200 text-red-600 bg-red-50 hover:bg-red-100"
                    : "border-green-200 text-green-600 bg-green-50 hover:bg-green-100"
                }`}
              >
                {session?.isOpen ? "質問受付中 →締切" : "質問締切中 →再開"}
              </button>
              <button
                onClick={toggleDiscussionOpen}
                disabled={!session}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors disabled:opacity-40 ${
                  session?.discussionOpen
                    ? "border-orange-200 text-orange-600 bg-orange-50 hover:bg-orange-100"
                    : "border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100"
                }`}
              >
                {session?.discussionOpen ? "回答受付中 →締切" : "回答締切中 →再開"}
              </button>
            </div>
          </div>

          {/* タブ切替 */}
          <div className="flex gap-1 mt-2">
            <button
              onClick={() => setTab("questions")}
              className={`text-xs px-4 py-1.5 rounded-lg font-medium transition-colors ${
                tab === "questions"
                  ? "bg-gray-800 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              質問管理
            </button>
            <button
              onClick={() => setTab("prompts")}
              className={`text-xs px-4 py-1.5 rounded-lg font-medium transition-colors ${
                tab === "prompts"
                  ? "bg-gray-800 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              ディスカッション問題
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-3">
        {sessionError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            <p className="font-medium">読み込みエラー</p>
            <p className="text-xs mt-1">{sessionError}</p>
            <p className="text-xs mt-1 text-red-500">※ DB側に未適用のカラムがある場合は、Neon SQL Editor で ALTER TABLE を実行してください</p>
          </div>
        )}
        {tab === "questions" ? (
          <>
            {/* 統計バー */}
            <div className="flex items-center gap-3 text-xs">
              <span className="text-gray-500">全 {counts.total} 件</span>
              <span className="text-yellow-600 font-medium">未対応 {counts.pending}</span>
              <span className="text-green-600 font-medium">回答済 {counts.answered}</span>
              {counts.hidden > 0 && (
                <span className="text-gray-400">非表示 {counts.hidden}</span>
              )}
            </div>

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
          </>
        ) : (
          <>
            {/* 一括操作バー */}
            {promptList.filter((p) => !p.isDeleted).length > 0 && (
              <div className="bg-white rounded-xl border p-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-500 font-medium">一括操作:</span>
                <button
                  onClick={() => bulkToggleVisibility(true)}
                  disabled={bulkUpdating}
                  className="text-xs px-3 py-1.5 bg-green-100 text-green-700 rounded-lg border border-green-200 hover:bg-green-200 disabled:opacity-50"
                >
                  全問公開
                </button>
                <button
                  onClick={() => bulkToggleVisibility(false)}
                  disabled={bulkUpdating}
                  className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg border border-gray-200 hover:bg-gray-200 disabled:opacity-50"
                >
                  全問非公開
                </button>
                <button
                  onClick={loadOverview}
                  disabled={overviewLoading}
                  className="text-xs px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg border border-purple-200 hover:bg-purple-200 disabled:opacity-50 ml-auto"
                >
                  {overviewLoading ? "読み込み中..." : "📋 全問の回答を一覧表示"}
                </button>
              </div>
            )}

            {/* 全体説明カード */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-amber-800">全体説明（学生に表示）</h2>
                {!descEditing && (
                  <button
                    onClick={() => {
                      setDescInput(session?.promptDescription ?? "");
                      setDescEditing(true);
                    }}
                    className="text-xs text-amber-600 hover:text-amber-800 underline"
                  >
                    {session?.promptDescription ? "編集" : "+ 追加"}
                  </button>
                )}
              </div>
              {descEditing ? (
                <div className="space-y-2">
                  <textarea
                    value={descInput}
                    onChange={(e) => setDescInput(e.target.value)}
                    placeholder="例: 今日は有機化合物の構造について考えます。各問いに自分の言葉で答えてください。"
                    rows={4}
                    className="w-full border border-amber-300 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                    maxLength={1000}
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setDescEditing(false)}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={saveDescription}
                      disabled={descSaving}
                      className="text-xs px-4 py-1.5 bg-amber-600 text-white rounded-xl hover:bg-amber-700 disabled:opacity-50"
                    >
                      {descSaving ? "保存中..." : "保存"}
                    </button>
                  </div>
                </div>
              ) : session?.promptDescription ? (
                <p className="text-sm text-amber-900 whitespace-pre-wrap leading-relaxed">
                  {session.promptDescription}
                </p>
              ) : (
                <p className="text-xs text-amber-500">未設定（設定すると学生の問題一覧上部に表示されます）</p>
              )}
            </div>

            {/* プロンプト作成フォーム */}
            <form onSubmit={createPrompt} className="bg-white rounded-2xl shadow-sm border p-4">
              <h2 className="font-semibold text-gray-700 mb-3 text-sm">新しい問題を追加</h2>
              <div className="flex gap-2">
                <textarea
                  value={newPromptContent}
                  onChange={(e) => setNewPromptContent(e.target.value)}
                  placeholder="問題文を入力..."
                  rows={2}
                  className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
                  maxLength={500}
                />
                <button
                  type="submit"
                  disabled={!newPromptContent.trim()}
                  className="self-end text-xs px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50"
                >
                  追加
                </button>
              </div>
            </form>

            {promptList.length > 0 && (
              <p className="text-xs text-gray-400">ドラッグ&ドロップで並び替えできます</p>
            )}

            {/* プロンプト一覧 */}
            {promptList.length === 0 ? (
              <div className="text-center text-gray-400 py-12 text-sm">問題がありません</div>
            ) : (
              promptList.map((p, index) => (
                <div
                  key={p.id}
                  draggable
                  onDragStart={() => handlePromptDragStart(index)}
                  onDragEnter={() => handlePromptDragEnter(index)}
                  onDragEnd={handlePromptDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                  className={`bg-white rounded-2xl shadow-sm border p-4 space-y-3 cursor-grab active:cursor-grabbing ${
                    p.isDeleted ? "opacity-40" : ""
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-gray-300 text-lg mt-0.5 shrink-0">⠿</span>
                    {editingPromptId === p.id ? (
                      <div className="flex-1 flex gap-2">
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
                          rows={2}
                          autoFocus
                        />
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => updatePrompt(p.id)}
                            className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                          >
                            保存
                          </button>
                          <button
                            onClick={() => setEditingPromptId(null)}
                            className="text-xs text-gray-400 hover:text-gray-600"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-800 leading-relaxed flex-1">{p.content}</p>
                    )}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-xs text-gray-500">{p.responseCount} 件回答</span>
                      <button
                        onClick={() => toggleResultsVisible(p.id, p.isResultsVisible)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                          p.isResultsVisible
                            ? "border-green-200 text-green-600 bg-green-50 hover:bg-green-100"
                            : "border-gray-200 text-gray-400 bg-gray-50 hover:bg-gray-100"
                        }`}
                      >
                        {p.isResultsVisible ? "結果公開中" : "結果非公開"}
                      </button>
                    </div>
                  </div>

                  {/* 操作ボタン */}
                  <div className="border-t pt-2 flex items-center gap-2">
                    <button
                      onClick={() => viewResponses(p.id)}
                      className="text-xs text-blue-500 hover:text-blue-700"
                    >
                      {viewingResponses === p.id ? "回答を閉じる" : "回答を見る"}
                    </button>
                    <button
                      onClick={() => {
                        setEditingPromptId(p.id);
                        setEditContent(p.content);
                      }}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => deletePrompt(p.id)}
                      className="text-xs text-red-400 hover:text-red-600 ml-auto"
                    >
                      削除
                    </button>
                  </div>

                  {/* 回答一覧 */}
                  {viewingResponses === p.id && (
                    <div className="space-y-1">
                      {responses.length === 0 ? (
                        <p className="text-xs text-gray-400">まだ回答がありません</p>
                      ) : (
                        responses.map((r) => (
                          <div key={r.id} className="bg-purple-50 rounded-xl px-3 py-2 text-xs text-purple-800">
                            {r.answer}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </>
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

      <div className="text-xs text-gray-400">
        {question.authorName ?? "匿名"} · {dt}
      </div>

      <StatusSelector
        questionId={question.id}
        currentStatus={status}
        onStatusChange={setStatus}
      />

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

      <div className="border-t pt-2 flex items-center gap-2">
        {showReply ? (
          <div className="flex gap-2 flex-1">
            <input
              type="text"
              value={replyInput}
              onChange={(e) => onReplyChange(e.target.value)}
              placeholder="返信を入力..."
              className="flex-1 min-w-0 border border-gray-300 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
              onKeyDown={(e) => e.key === "Enter" && !submitting && !e.nativeEvent.isComposing && onReplySubmit()}
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
