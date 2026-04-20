"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";

interface SessionItem {
  id: number;
  title: string;
  discussionOpen: boolean;
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

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10 px-4 py-3">
        <div className="max-w-2xl mx-auto">
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
            <h2 className="text-sm font-semibold text-gray-600">セッションの並び替え</h2>

            {sessions.length === 0 ? (
              <div className="text-center text-gray-400 py-12 text-sm">
                セッションがありません
              </div>
            ) : (
              <p className="text-xs text-gray-400">ドラッグ&ドロップで順番を変更できます</p>
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
                      回答{s.discussionOpen ? "受付中" : "締切"}
                    </p>
                  </div>
                  <button
                    onClick={() => router.push(`/teacher/sessions/${s.id}`)}
                    className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 shrink-0"
                  >
                    管理
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}
