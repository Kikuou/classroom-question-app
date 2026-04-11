"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface SessionItem {
  id: number;
  title: string;
  isOpen: boolean;
}

interface CourseInfo {
  id: number;
  name: string;
}

export default function CourseSessionsPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const router = useRouter();
  const [course, setCourse] = useState<CourseInfo | null>(null);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [serverError, setServerError] = useState("");

  useEffect(() => {
    // 授業名を公開リストから取得
    fetch(`/api/courses/public?q=`)
      .then((r) => r.ok ? r.json() : [])
      .then((list: CourseInfo[]) => {
        const found = list.find((c) => c.id === parseInt(courseId));
        if (found) setCourse(found);
      })
      .catch(() => {});

    // セッション一覧取得
    fetch(`/api/courses/${courseId}/sessions`)
      .then(async (r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        if (!r.ok) {
          setServerError("セッション一覧の取得に失敗しました");
          return null;
        }
        return r.json();
      })
      .then((data) => data && setSessions(data))
      .catch(() => setServerError("通信エラーが発生しました"))
      .finally(() => setLoading(false));
  }, [courseId]);

  if (notFound) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">授業が見つかりません</p>
          <a href="/" className="text-blue-500 underline mt-2 block">トップに戻る</a>
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
            className="mt-3 text-sm px-4 py-2 bg-gray-800 text-white rounded-xl"
          >
            再読み込み
          </button>
          <a href="/" className="text-blue-500 underline mt-3 block text-sm">トップに戻る</a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10 px-4 py-3">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            ←
          </button>
          <div>
            <h1 className="font-bold text-gray-800 text-sm">
              {loading ? "読み込み中..." : (course?.name ?? "授業")}
            </h1>
          </div>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 py-4">
        <h2 className="text-sm font-semibold text-gray-600 mb-3">セッション一覧</h2>
        {loading ? (
          <div className="text-center text-gray-400 py-12 text-sm">読み込み中...</div>
        ) : sessions.length === 0 ? (
          <div className="text-center text-gray-400 py-12 text-sm">
            開催中のセッションがありません
          </div>
        ) : (
          <ul className="space-y-2">
            {sessions.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => s.isOpen && router.push(`/session/${s.id}`)}
                  disabled={!s.isOpen}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                    s.isOpen
                      ? "border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-800"
                      : "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  <span className="font-medium text-sm">{s.title}</span>
                  <span
                    className={`ml-2 text-xs font-medium ${
                      s.isOpen ? "text-green-600" : "text-gray-400"
                    }`}
                  >
                    {s.isOpen ? "受付中" : "締切済"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
