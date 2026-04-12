"use client";

import { useCallback, useEffect, useState } from "react";
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

  const loadData = useCallback(async (initial: boolean = false) => {
    if (initial) setLoading(true);
    setServerError("");

    try {
      // 授業名を公開リストから取得
      const courseRes = await fetch(`/api/courses/public?q=`, { cache: "no-store" });
      if (courseRes.ok) {
        const list: CourseInfo[] = await courseRes.json();
        const found = list.find((c) => c.id === parseInt(courseId));
        if (found) setCourse(found);
      }

      // セッション一覧取得
      const sessRes = await fetch(`/api/courses/${courseId}/sessions`, { cache: "no-store" });
      if (sessRes.status === 404) {
        setNotFound(true);
        return;
      }
      if (!sessRes.ok) {
        setServerError("セッション一覧の取得に失敗しました");
        return;
      }
      const data: SessionItem[] = await sessRes.json();
      setSessions(data);
    } catch {
      setServerError("通信エラーが発生しました");
    } finally {
      if (initial) setLoading(false);
    }
  }, [courseId]);

  // 初回ロード
  useEffect(() => {
    loadData(true);
  }, [loadData]);

  // タブ復帰・bfcache 復元時に最新データを再取得
  useEffect(() => {
    const handleVisible = () => {
      if (document.visibilityState === "visible") loadData();
    };
    const handlePageshow = (e: PageTransitionEvent) => {
      if (e.persisted) loadData();
    };
    document.addEventListener("visibilitychange", handleVisible);
    window.addEventListener("pageshow", handlePageshow as EventListener);
    return () => {
      document.removeEventListener("visibilitychange", handleVisible);
      window.removeEventListener("pageshow", handlePageshow as EventListener);
    };
  }, [loadData]);

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
            onClick={() => loadData(true)}
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
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                    s.isOpen
                      ? "border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-900"
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
