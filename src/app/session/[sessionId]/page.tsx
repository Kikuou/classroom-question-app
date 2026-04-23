"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getClientId } from "@/lib/client-id";

interface PromptItem {
  id: number;
  content: string;
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
  const router = useRouter();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [serverError, setServerError] = useState("");

  // === ディスカッション問題タブ state ===
  const [promptList, setPromptList] = useState<PromptItem[]>([]);
  const [answerInputs, setAnswerInputs] = useState<Record<number, string>>({});
  const [submittingPromptId, setSubmittingPromptId] = useState<number | null>(null);
  const [submitErrors, setSubmitErrors] = useState<Record<number, string>>({});
  // このセッション中に送信成功したプロンプトIDを記録（APIのmyAnswerが遅延しても即反映）
  const [answeredPromptIds, setAnsweredPromptIds] = useState<Set<number>>(new Set());
  const [viewingResults, setViewingResults] = useState<number | null>(null);
  const [resultResponses, setResultResponses] = useState<PromptResponseItem[]>([]);
  // 全問回答一覧
  const [showOverview, setShowOverview] = useState(false);
  const [overviewData, setOverviewData] = useState<OverviewItem[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(false);

  // === トースト通知 ===
  const [toast, setToast] = useState("");
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  // === IME対応: ユーザーが手入力中のPromptIDを追跡 ===
  const userEditedRef = useRef<Set<number>>(new Set());
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

  // === プロンプト取得 ===
  const fetchPrompts = useCallback(async () => {
    const clientId = getClientId();
    const res = await fetch(
      `/api/sessions/${sessionId}/prompts?clientId=${clientId}`
    );
    if (res.ok) {
      const data: PromptItem[] = await res.json();
      setPromptList(data);
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

  // === ポーリング（ディスカッションのみ） ===
  useEffect(() => {
    fetchPrompts();
    const timer = setInterval(fetchPrompts, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [fetchPrompts]);

  // === ディスカッション回答送信 ===
  const submitAnswer = async (promptId: number) => {
    if (isComposingRef.current) return;
    const answer = answerInputs[promptId]?.trim();
    if (!answer) return;
    setSubmittingPromptId(promptId);
    setSubmitErrors((prev) => ({ ...prev, [promptId]: "" }));
    const clientId = getClientId();
    try {
      const res = await fetch(`/api/prompts/${promptId}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer, clientId }),
      });
      if (res.ok) {
        userEditedRef.current.delete(promptId);
        setAnsweredPromptIds((prev) => { const next = new Set(prev); next.add(promptId); return next; });
        showToast("✓ 回答を保存しました");
        await fetchPrompts();
      } else {
        const data = await res.json().catch(() => ({}));
        setSubmitErrors((prev) => ({
          ...prev,
          [promptId]: data.error ?? "送信に失敗しました",
        }));
      }
    } catch {
      setSubmitErrors((prev) => ({
        ...prev,
        [promptId]: "通信エラーが発生しました",
      }));
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

  // === 全問回答一覧（締切後のみ呼ばれる） ===
  const loadOverview = async () => {
    setOverviewLoading(true);
    try {
      const results = await Promise.all(
        promptList.map(async (p) => {
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
            className="mt-4 text-sm px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900"
          >
            再読み込み
          </button>
          <a href="/" className="text-indigo-500 underline mt-3 block text-sm">トップに戻る</a>
        </div>
      </main>
    );
  }

  if (notFound) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">セッションが見つかりません</p>
          <p className="text-gray-400 text-xs mt-1">このセッションは削除されたか非公開になっています</p>
          {/* window.location.href でトップページを強制再読み込み
              → Next.js Router Cache をバイパスし、必ず最新データを取得 */}
          <button
            onClick={() => { window.location.href = "/"; }}
            className="text-indigo-500 underline mt-3 block text-sm mx-auto"
          >
            ← トップに戻る
          </button>
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
                  className="text-sm px-4 py-2 bg-gray-800 text-white rounded-lg"
                >
                  閉じる
                </button>
              </div>
              {overviewData.length === 0 ? (
                <p className="text-center text-gray-400 py-12 text-sm">まだ回答はありません</p>
              ) : (
                <div className="space-y-6">
                  {overviewData.map((p, qi) => (
                    <div key={p.id} className="bg-white rounded-lg shadow-sm border p-4 space-y-3">
                      <p className="text-xs text-gray-400 font-medium">Q{qi + 1}</p>
                      <p className="text-sm font-medium text-gray-800 leading-relaxed">{p.content}</p>
                      <div className="border-t pt-3">
                        {p.responses.length === 0 ? (
                          <p className="text-xs text-gray-400">まだ回答がありません</p>
                        ) : (
                          <div className="space-y-1.5">
                            {p.responses.map((r) => (
                              <div key={r.id} className="bg-indigo-50 rounded-lg px-3 py-2 text-sm text-indigo-800">
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
          👁 プレビューモード — 教員による表示確認用です。回答の送信は無効化されています。
        </div>
      )}

      <header className="bg-white border-b sticky top-0 z-10 px-4 py-3">
        <div className="max-w-2xl mx-auto">
          {/* 戻るボタン */}
          {!isPreview && (
            <button
              onClick={() =>
                session?.courseId
                  ? router.push(`/courses/${session.courseId}?tab=sessions`)
                  : router.push("/")
              }
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mb-1.5 -ml-1 px-1 py-0.5"
            >
              ← {session?.courseName ?? "授業"}に戻る
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
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${
                session?.discussionOpen
                  ? "bg-orange-100 text-orange-700"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              回答 {session?.discussionOpen ? "受付中" : "締切済"}
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* 全体説明 */}
        {session?.promptDescription && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <p className="text-xs font-semibold text-amber-700 mb-1">説明</p>
            <p className="text-sm text-amber-900 whitespace-pre-wrap leading-relaxed">
              {session.promptDescription}
            </p>
          </div>
        )}

        {/* 締切後: 学習促進メッセージ＋全問回答一覧ボタン */}
        {!session?.discussionOpen && promptList.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 text-center">
              回答受付が終了しました。みんなの考えと自分の回答を比べてみましょう。
            </p>
            <button
              onClick={loadOverview}
              disabled={overviewLoading}
              className="w-full py-2.5 rounded-lg border border-indigo-300 bg-indigo-50 text-indigo-700 text-sm font-medium hover:bg-indigo-100 disabled:opacity-50 transition-colors"
            >
              {overviewLoading ? "読み込み中..." : "📋 全問の回答をまとめて見る"}
            </button>
          </div>
        )}

        {/* ディスカッション問題一覧 */}
        {promptList.length === 0 ? (
          <div className="text-center text-gray-400 py-12 text-sm">
            まだ問題が追加されていません
          </div>
        ) : (
          promptList.map((p, qi) => (
            <div key={p.id} className="bg-white rounded-lg shadow-sm border p-4 space-y-3">
              <p className="text-xs text-gray-400 font-medium">Q{qi + 1}</p>
              <p className="text-sm text-gray-800 leading-relaxed font-medium">{p.content}</p>

              {/* 回答フォーム */}
              {(() => {
                const canAnswer = !isPreview && (session?.discussionOpen ?? false);
                // APIのmyAnswerとローカル送信履歴の両方を参照（遅延・失敗時も即反映）
                const isAnswered = !!p.myAnswer || answeredPromptIds.has(p.id);
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
                      className={`w-full border rounded-lg px-4 py-3 text-sm resize-none focus:outline-none transition-colors ${
                        canAnswer
                          ? "border-gray-300 focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 bg-white"
                          : "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
                      }`}
                      maxLength={500}
                    />
                    {canAnswer ? (
                      <div className="space-y-1.5">
                        {/* 回答済みのヒント（受付中のみ表示） */}
                        {isAnswered && (
                          <div className="flex items-center gap-1.5 text-xs">
                            <span className="text-green-600 font-medium">✓ 回答済み</span>
                            <span className="text-gray-400">— 再送信すると上書きされます</span>
                          </div>
                        )}
                        {/* 送信エラー表示 */}
                        {submitErrors[p.id] && (
                          <p className="text-xs text-red-500">{submitErrors[p.id]}</p>
                        )}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-gray-400">
                            {answerInputs[p.id]?.length ?? 0} / 500
                          </span>
                          <button
                            onClick={() => submitAnswer(p.id)}
                            disabled={
                              submittingPromptId === p.id ||
                              !(answerInputs[p.id]?.trim())
                            }
                            className="text-sm px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
                          >
                            {submittingPromptId === p.id
                              ? "送信中..."
                              : isAnswered
                              ? "回答を更新"
                              : "回答する"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-center py-1">
                        {isPreview ? (
                          <span className="text-gray-400">
                            プレビューモード — 回答送信は無効化されています
                          </span>
                        ) : isAnswered ? (
                          <span className="text-green-600 font-medium">✓ 回答済み（締切済み）</span>
                        ) : (
                          <span className="text-gray-400">回答受付は終了しました</span>
                        )}
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* 結果表示（締切後のみ） */}
              {!session?.discussionOpen ? (
                <div className="border-t pt-2">
                  <button
                    onClick={() => viewResults(p.id)}
                    className="text-xs text-indigo-500 hover:text-indigo-700"
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
                            className="bg-indigo-50 rounded-lg px-3 py-2 text-sm text-indigo-800"
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
                  回答受付中は他者の回答は表示されません
                </p>
              )}
            </div>
          ))
        )}

        {/* 下部余白 */}
        <div className="h-6" />
      </div>

      {/* トースト通知 */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 bg-gray-800/90 text-white text-sm rounded-full shadow-lg pointer-events-none whitespace-nowrap">
          {toast}
        </div>
      )}
    </main>
  );
}
