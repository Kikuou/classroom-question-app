"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface SessionItem {
  id: number;
  title: string;
  isOpen: boolean;
  createdAt: string;
}

interface CourseInfo {
  id: number;
  name: string;
  code: string;
}

export default function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const router = useRouter();
  const [course, setCourse] = useState<CourseInfo | null>(null);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauth, setUnauth] = useState(false);

  useEffect(() => {
    fetch(`/api/courses/${courseId}`)
      .then((r) => {
        if (r.status === 401) { setUnauth(true); return null; }
        if (!r.ok) return null;
        return r.json();
      })
      .then((data) => {
        if (data) {
          setCourse(data.course);
          setSessions(data.sessions);
        }
        setLoading(false);
      });
  }, [courseId]);

  const handleLogout = async () => {
    await fetch("/api/teacher/logout", { method: "POST" });
    router.push("/teacher/login");
  };

  const toggleSession = async (sessionId: number, isOpen: boolean) => {
    const res = await fetch(`/api/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isOpen: !isOpen }),
    });
    if (res.ok) {
      const updated = await res.json();
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, isOpen: updated.isOpen } : s))
      );
    }
  };

  if (unauth) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-2">ログインが必要です</p>
          <a href="/teacher/login" className="text-blue-500 underline">ログインページへ</a>
        </div>
      </main>
    );
  }

  if (loading) {
    return <main className="min-h-screen flex items-center justify-center"><p className="text-gray-400">読み込み中...</p></main>;
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-3 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400">教員管理</p>
            <h1 className="font-bold text-gray-800">{course?.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded font-mono">
              {course?.code}
            </span>
            <button
              onClick={handleLogout}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              ログアウト
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-700">授業回一覧</h2>
          <a
            href={`/teacher/courses/${courseId}/sessions/new`}
            className="bg-blue-600 text-white text-sm px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors"
          >
            + 授業回を追加
          </a>
        </div>

        {sessions.length === 0 ? (
          <div className="text-center text-gray-400 py-12 text-sm">
            授業回がありません。追加してください。
          </div>
        ) : (
          <div className="space-y-2">
            {[...sessions].reverse().map((s) => (
              <div
                key={s.id}
                className="bg-white rounded-2xl shadow-sm border p-4 flex items-center justify-between gap-3"
              >
                <button
                  onClick={() => router.push(`/teacher/sessions/${s.id}`)}
                  className="flex-1 text-left"
                >
                  <p className="font-medium text-gray-800 text-sm">{s.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(s.createdAt).toLocaleDateString("ja-JP")}
                  </p>
                </button>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full ${
                      s.isOpen
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {s.isOpen ? "受付中" : "締切"}
                  </span>
                  <button
                    onClick={() => toggleSession(s.id, s.isOpen)}
                    className="text-xs px-2 py-1 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
                  >
                    {s.isOpen ? "締め切る" : "再開"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
