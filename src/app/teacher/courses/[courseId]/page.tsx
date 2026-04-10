"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";

interface SessionItem {
  id: number;
  title: string;
  isOpen: boolean;
  sortOrder: number;
  createdAt: string;
}

interface CourseInfo {
  id: number;
  name: string;
  code: string;
  isVisible: boolean;
}

export default function TeacherCoursePage() {
  const { courseId } = useParams<{ courseId: string }>();
  const router = useRouter();
  const [course, setCourse] = useState<CourseInfo | null>(null);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const dragItem = useRef<number | null>(null);
  const dragOver = useRef<number | null>(null);

  const fetchData = async () => {
    setFetchError("");
    try {
      const res = await fetch(`/api/courses/${courseId}`);
      if (res.status === 401) {
        router.replace("/teacher/login");
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setCourse(data.course);
        setSessions(data.sessions);
      } else {
        const data = await res.json().catch(() => ({}));
        setFetchError(data.error ?? "データの取得に失敗しました");
      }
    } catch {
      setFetchError("通信エラーが発生しました。ページを再読み込みしてください。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [courseId]);

  const createSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim(), courseId: parseInt(courseId) }),
      });
      if (res.status === 401) {
        router.replace("/teacher/login");
        return;
      }
      if (res.ok) {
        setNewTitle("");
        setShowForm(false);
        await fetchData();
      } else {
        const data = await res.json().catch(() => ({}));
        setCreateError(data.error ?? "セッション作成に失敗しました");
      }
    } catch {
      setCreateError("通信エラーが発生しました");
    } finally {
      setCreating(false);
    }
  };

  const deleteSession = async (sessionId: number) => {
    if (!confirm("このセッションを削除しますか？\n（質問データは保持されます）")) return;
    const res = await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
    if (res.ok) setSessions((prev) => prev.filter((s) => s.id !== sessionId));
  };

  const handleDragStart = (index: number) => { dragItem.current = index; };
  const handleDragEnter = (index: number) => { dragOver.current = index; };
  const handleDragEnd = async () => {
    if (dragItem.current === null || dragOver.current === null) return;
    if (dragItem.current === dragOver.current) return;
    const updated = [...sessions];
    const [moved] = updated.splice(dragItem.current, 1);
    updated.splice(dragOver.current, 0, moved);
    const reordered = updated.map((s, i) => ({ ...s, sortOrder: i }));
    setSessions(reordered);
    dragItem.current = null;
    dragOver.current = null;
    await fetch("/api/sessions/sort", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: reordered.map((s) => s.id) }),
    });
  };

  const toggleVisible = async () => {
    if (!course) return;
    const res = await fetch(`/api/courses/${courseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isVisible: !course.isVisible }),
    });
    if (res.ok) setCourse((c) => c ? { ...c, isVisible: !c.isVisible } : c);
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10 px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-start justify-between gap-2">
            <div>
              <button
                onClick={() => router.push("/teacher/dashboard")}
                className="text-xs text-gray-400 hover:text-gray-600 mb-0.5 block"
              >
                ← ダッシュボード
              </button>
              <h1 className="font-bold text-gray-800 text-sm">
                {loading ? "読み込み中..." : (course?.name ?? "授業が見つかりません")}
              </h1>
            </div>
            {course && (
              <button
                onClick={toggleVisible}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  course.isVisible
                    ? "border-green-200 text-green-600 bg-green-50 hover:bg-green-100"
                    : "border-gray-200 text-gray-400 bg-gray-50 hover:bg-gray-100"
                }`}
              >
                {course.isVisible ? "公開中" : "非公開"}
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {loading ? (
          <div className="text-center text-gray-400 py-12 text-sm">読み込み中...</div>
        ) : fetchError ? (
          <div className="text-center py-12 space-y-3">
            <p className="text-red-500 text-sm">{fetchError}</p>
            <button
              onClick={fetchData}
              className="text-xs px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900"
            >
              再試行
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-600">セッション一覧</h2>
              <button
                onClick={() => { setShowForm((v) => !v); setCreateError(""); }}
                className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                + 新規セッション
              </button>
            </div>

            {showForm && (
              <form onSubmit={createSession} className="bg-white rounded-xl border p-3 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="セッションタイトル（例: 第1回 有機化学入門）"
                    className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    autoFocus
                    maxLength={100}
                  />
                  <button
                    type="submit"
                    disabled={creating || !newTitle.trim()}
                    className="text-xs px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {creating ? "作成中..." : "作成"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowForm(false); setCreateError(""); }}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    閉じる
                  </button>
                </div>
                {createError && (
                  <p className="text-xs text-red-500">{createError}</p>
                )}
              </form>
            )}

            {sessions.length === 0 ? (
              <div className="text-center text-gray-400 py-12 text-sm">
                セッションがありません
              </div>
            ) : (
              <p className="text-xs text-gray-400">ドラッグ&ドロップで並び替えできます</p>
            )}

            <ul className="space-y-2">
              {sessions.map((s, index) => (
                <li
                  key={s.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragEnter={() => handleDragEnter(index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                  className="bg-white rounded-xl border shadow-sm p-3 flex items-center gap-3 cursor-grab active:cursor-grabbing select-none"
                >
                  <span className="text-gray-300 text-lg">⠿</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{s.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {s.isOpen ? "受付中" : "締切済"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => router.push(`/teacher/sessions/${s.id}`)}
                      className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    >
                      管理
                    </button>
                    <button
                      onClick={() => deleteSession(s.id)}
                      className="text-xs text-red-400 hover:text-red-600 px-1"
                    >
                      削除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}
