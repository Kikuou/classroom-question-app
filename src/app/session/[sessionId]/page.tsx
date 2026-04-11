"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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

interface PromptItem {
  id: number;
  content: string;
  isResultsVisible: boolean;
  responseCount: number;
  myAnswer: string | null;
}

interface PromptResponseItem {
  id: number;
  answer: string;
}

interface OverviewItem extends PromptItem {
  responses: PromptResponseItem[];
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

const POLL_INTERVAL = 5000;

export default function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const searchParams = useSearchParams();
  const isPreview = searchParams.get("preview") === "true";
  // ?tab=discussion でディスカッションタブを自動選択
  const tabParam = searchParams.get("tab");
  const router = useRouter();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [tab, setTab] = useState<"questions" | "prompts">(
    tabParam === "discussion" ? "prompts" : "questions"
  );
  const [notFound, setNotFound] = useState(false);
  const [serverError, setServerError] = useState("");

  // === 質問タブ state ===
  const [questions, setQuestions] = useState<Question[]>([]);
  const [sort, setSort] = useState<"time" | "likes">("time");
  const [content, setContent] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [anonymous, setAnonymous] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  // === ディスカッション問題タブ state ===
  const [promptList, setPromptList] = useState<PromptItem[]>([]);
  const [answerInputs, setAnswerInputs] = useState<Record<number, string>>({});
  const [submittingPromptId, setSubmittingPromptId] = useState<number | null>(null);
  const [viewingResults, setViewingResults] = useState<number | null>(null);
  const [resultResponses, setResultResponses] = useState<PromptResponseItem[]>([]);
  // 全問回答一覧
  const [showOverview, setShowOverview] = useState(false);
  const [overviewData, setOverviewData] = useState<OverviewItem[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(false);

  // === IME対応: ユーザーが手入力中のPromptIDを追跡 ===
  // ユーザーが自分で入力した入力欄は、ポーリングで上書きしない
  const userEditedRef = useRef<Set<number>>(new Set());
  // 現在IME変換中かどうか（どの入力欄でも1つしか変換中にならない）
  const isComposingRef = useRef(false);

  // === セッション情報取得 ===
  useEffect(() => {
    fetch(`/api/sessions/${sessionId}`)
      .then(async (r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        if (!r.ok) {
          const data = await r.json().catch(() => ({}));
          setServerError(data.error ?? "読み込みエラーが発生しました。しばらく待ってから再読み込みしてください。");
          return null;
        }
        return r.json();
      })
      .then((data) => data && setSession(data))
      .catch(() => setServerError("通信エラーが発生しました"));
  }, [sessionId]);

  // === 質問取得 ===
  const fetchQuestions = useCallback(async () => {
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
      // AbortError
    }
  }, [sessionId, sort]);

  // === プロンプト取得 ===
  const fetchPrompts = useCallback(async () => {
    const clientId = getClientId();
    const res = await fetch(
      `/api/sessions/${sessionId}/prompts?clientId=${clientId}`
    );
    if (res.ok) {
      const data: PromptItem[] = await res.json();
      setPromptList(data);
      // ユーザーが手入力していない入力欄のみ、myAnswerで初期化
      setAnswerInputs((prev) => {
        const next = { ...prev };
        data.forEach((p) => {
          if (p.myAnswer && !userEditedRef.current.has(p.id)) {
            next[p.id] = p.myAnswer;
          }
        });
        return next;
      });
    }
  }, [sessionId]);

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

  // === 質問投稿 ===
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

  // === ディスカッション回答送信 ===
  const submitAnswer = async (promptId: number) => {
    // IME変換中は送信しない
    if (isComposingRef.current) return;
    const answer = answerInputs[promptId]?.trim();
    if (!answer) return;
    setSubmittingPromptId(promptId);
    const clientId = getClientId();
    try {
      const res = await fetch(`/api/prompts/${promptId}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer, clientId }),
      });
      if (res.ok) {
        // 送信成功 → ユーザー編集フラグをクリア（次のポーリングで最新値を反映）
        userEditedRef.current.delete(promptId);
        await fetchPrompts();
      }
    } finally {
      setSubmittingPromptId(null);
    }
  };

  // === 1問の結果表示 ===
  const viewResults = async (promptId: number) => {
    if (viewingResults === promptId) {
      setViewingResults(null);
      return;
    }
    const res = await fetch(`/api/prompts/${promptId}/responses`);
    if (res.ok) {
      setResultResponses(await res.json());
      setViewingResults(promptId);
    }
  };

  // === 全問回答一覧 ===
  const loadOverview = async () => {
    setOverviewLoading(true);
    const visiblePrompts = promptList.filter((p) => p.isResultsVisible);
    try {
      const results = await Promise.all(
        visiblePrompts.map(async (p) => {
          const res = await fetch(`/api/prompts/${p.id}/responses`);
          const responses: PromptResponseItem[] = res.ok ? await res.json() : [];
          return { ...p, responses };
        })
      );
      setOverviewData(results);
      setShowOverview(true);
    } finally {
      setOverviewLoading(false);
    }
  };

  if (serverError) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-red-500 font-medium">読み込みエラー</p>
          <p className="text-gray-500 text-sm mt-2">{serverError}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 text-sm px-4 py-2 bg-gray-800 text-white rounded-xl hover:bg-gray-900"
          >
            再読み込み
          </button>
          <a href="/" className="text-blue-500 underline mt-3 block text-sm">トップに戻る</a>
        </div>
      </main>
    );
  }

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
      {/* 全問回答一覧オーバーレイ */}
      {showOverview && (
        <div className="fixed inset-0 z-50 bg-black/60 flex flex-col">
          <div className="flex-1 overflow-y-auto bg-gray-50">
            <div className="max-w-2xl mx-auto px-4 py-4">
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
                <p className="text-center text-gray-400 py-12 text-sm">公開中の回答がありません</p>
              ) : (
                <div className="space-y-6">
                  {overviewData.map((p, qi) => (
                    <div key={p.id} className="bg-white rounded-2xl shadow-sm border p-4 space-y-3">
                      <p className="text-xs text-gray-400 font-medium">Q{qi + 1}</p>
                      <p className="text-sm font-medium text-gray-800 leading-relaxed">{p.content}</p>
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

      {/* プレビューモードバナー */}
      {isPreview && (
        <div className="sticky top-0 z-20 bg-amber-400 text-amber-900 text-xs font-medium text-center py-1.5 px-4">
          👁 プレビューモード — 教員による表示確認用です。質問・回答の送信は無効化されています。
        </div>
      )}

      <header className="bg-white border-b sticky top-0 z-10 px-4 py-3">
        <div className="max-w-2xl mx-auto">
          {/* ← 戻るボタン（スマホでも押しやすい位置） */}
          {!isPreview && (
            <button
              onClick={() =>
                session?.courseId
                  ? router.push(`/courses/${session.courseId}`)
                  : router.push("/")
              }
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-1.5 -ml-1 px-1 py-0.5"
            >
              ← {session?.courseName ?? "授業一覧"}に戻る
            </button>
          )}
          {isPreview && (
            <p className="text-xs text-amber-700 font-medium mb-1.5">
              ← 学生からの見え方（プレビュー）
            </p>
          )}

          <div className="flex items-start justify-between gap-2">
            <h1 className="font-bold text-gray-800 text-sm leading-tight flex-1">
              {session?.title ?? "読み込み中..."}
            </h1>
            <div className="flex flex-col gap-1 items-end shrink-0">
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  session?.isOpen
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                質問 {session?.isOpen ? "受付中" : "締切済"}
              </span>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  session?.discussionOpen
                    ? "bg-orange-100 text-orange-700"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                回答 {session?.discussionOpen ? "受付中" : "締切済"}
              </span>
            </div>
          </div>

          {/* タブ切替 */}
          <div className="flex gap-1 mt-2">
            <button
              onClick={() => setTab("questions")}
              className={`text-xs px-4 py-1.5 rounded-lg font-medium transition-colors ${
                tab === "questions"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              質問
            </button>
            <button
              onClick={() => setTab("prompts")}
              className={`text-xs px-4 py-1.5 rounded-lg font-medium transition-colors ${
                tab === "prompts"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              ディスカッション
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {tab === "questions" ? (
          <>
            {/* 質問投稿フォーム or 締切 or プレビュー */}
            {isPreview ? (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-xs text-amber-700 text-center">
                プレビューモード — 質問フォームは表示されません（送信不可）
              </div>
            ) : session?.isOpen ? (
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
            ) : session !== null ? (
              <div className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-500 text-center">
                この回の質問受付は終了しました。<br />
                <span className="text-xs text-gray-400">投稿済みの質問と教員の返信は引き続き閲覧できます。</span>
              </div>
            ) : null}

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
          </>
        ) : (
          <>
            {/* 全体説明（設定されている場合のみ表示） */}
            {session?.promptDescription && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                <p className="text-xs font-semibold text-amber-700 mb-1">説明</p>
                <p className="text-sm text-amber-900 whitespace-pre-wrap leading-relaxed">
                  {session.promptDescription}
                </p>
              </div>
            )}

            {/* 全問回答一覧ボタン */}
            {promptList.some((p) => p.isResultsVisible) && (
              <button
                onClick={loadOverview}
                disabled={overviewLoading}
                className="w-full py-2.5 rounded-xl border border-purple-300 bg-purple-50 text-purple-700 text-sm font-medium hover:bg-purple-100 disabled:opacity-50 transition-colors"
              >
                {overviewLoading ? "読み込み中..." : "📋 全問の回答をまとめて見る"}
              </button>
            )}

            {/* ディスカッション問題一覧 */}
            {promptList.length === 0 ? (
              <div className="text-center text-gray-400 py-12 text-sm">
                まだ問題がありません
              </div>
            ) : (
              promptList.map((p, qi) => (
                <div key={p.id} className="bg-white rounded-2xl shadow-sm border p-4 space-y-3">
                  <p className="text-xs text-gray-400 font-medium">Q{qi + 1}</p>
                  <p className="text-sm text-gray-800 leading-relaxed font-medium">{p.content}</p>

                  {/* 回答フォーム（受付中のみ入力可。プレビュー時は常に無効） */}
                  {(() => {
                    const canAnswer = !isPreview && (session?.discussionOpen ?? false);
                    return (
                      <div className="space-y-2">
                        <textarea
                          value={answerInputs[p.id] ?? ""}
                          onCompositionStart={() => { isComposingRef.current = true; }}
                          onCompositionEnd={(e) => {
                            isComposingRef.current = false;
                            if (!canAnswer) return;
                            userEditedRef.current.add(p.id);
                            setAnswerInputs((prev) => ({
                              ...prev,
                              [p.id]: (e.target as HTMLTextAreaElement).value,
                            }));
                          }}
                          onChange={(e) => {
                            if (!canAnswer) return;
                            userEditedRef.current.add(p.id);
                            setAnswerInputs((prev) => ({ ...prev, [p.id]: e.target.value }));
                          }}
                          placeholder={
                            isPreview
                              ? "（プレビューモード — 回答不可）"
                              : session?.discussionOpen
                              ? "あなたの回答を入力..."
                              : "回答受付は終了しました"
                          }
                          rows={3}
                          disabled={!canAnswer}
                          className={`w-full border rounded-xl px-3 py-2 text-sm resize-none focus:outline-none transition-colors ${
                            canAnswer
                              ? "border-gray-300 focus:ring-2 focus:ring-purple-400 bg-white"
                              : "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
                          }`}
                          maxLength={500}
                        />
                        {canAnswer ? (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-gray-400">
                              {answerInputs[p.id]?.length ?? 0} / 500
                            </span>
                            <div className="flex items-center gap-2">
                              {p.myAnswer && (
                                <span className="text-xs text-green-600">回答済み</span>
                              )}
                              <button
                                onClick={() => submitAnswer(p.id)}
                                disabled={
                                  submittingPromptId === p.id ||
                                  !(answerInputs[p.id]?.trim())
                                }
                                className="text-sm px-5 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 font-medium"
                              >
                                {submittingPromptId === p.id
                                  ? "送信中..."
                                  : p.myAnswer
                                  ? "回答を更新"
                                  : "回答する"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500 text-center py-1">
                            {isPreview
                              ? "プレビューモード — 回答送信は無効化されています"
                              : "回答受付は終了しました。みんなの回答は引き続き閲覧できます。"}
                          </p>
                        )}
                      </div>
                    );
                  })()}

                  {/* 結果表示 */}
                  {p.isResultsVisible ? (
                    <div className="border-t pt-2">
                      <button
                        onClick={() => viewResults(p.id)}
                        className="text-xs text-purple-500 hover:text-purple-700"
                      >
                        {viewingResults === p.id
                          ? "結果を閉じる"
                          : `みんなの回答を見る (${p.responseCount}件)`}
                      </button>
                      {viewingResults === p.id && (
                        <div className="mt-2 space-y-1.5">
                          {resultResponses.length === 0 ? (
                            <p className="text-xs text-gray-400">まだ回答がありません</p>
                          ) : (
                            resultResponses.map((r) => (
                              <div
                                key={r.id}
                                className="bg-purple-50 rounded-xl px-3 py-2 text-sm text-purple-800"
                              >
                                {r.answer}
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 border-t pt-2">
                      結果は教員が公開するまで見られません
                    </p>
                  )}
                </div>
              ))
            )}
          </>
        )}

        {/* 下部に余白（スマホでスクロールしやすく） */}
        <div className="h-6" />
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
