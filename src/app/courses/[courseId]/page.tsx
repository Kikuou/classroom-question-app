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
  code: string;
}

export default function CourseSessionsPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const router = useRouter();
  const [course, setCourse] = useState<CourseInfo | null>(null);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    // 公開授業情報取得（/api/courses/public から名前を引く）
    fetch(`/api/courses/public?q=`)
      .then((r) => r.ok ? r.json() : [])
      .then((list: CourseInfo[]) => {
        const found = list.find((c) => c.id === parseInt(courseId));
        if (found) setCourse(found);
      });

    // セッション一覧は /api/sessions/[id] の courseId フィルタが無いため
    // 各セッションの courseId を確認する別APIが必要。
    // ここでは簡易的に /api/courses/[id]/sessions を使う（学生向け公開エンドポイント）
    fetch(`/api/courses/${courseId}/sessions`)
      .then((r) => {
        if (!r.ok) { setNotFound(true); return null; }
        return r.json();
      })
      .then((data) => data && setSessions(data));
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
            <h1 className="font-bold text-gray-800 text-sm">{course?.name ?? "読み込み中..."}</h1>
            <p className="text-xs text-gray-400 font-mono">{course?.code}</p>
          </div>
        </div>
      </header>

      <div className="max-w-xl mx-auto px-4 py-4">
        <h2 className="text-sm font-semibold text-gray-600 mb-3">セッション一覧</h2>
        {sessions.length === 0 ? (
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
