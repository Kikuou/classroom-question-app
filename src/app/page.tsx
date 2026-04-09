"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SessionItem = { id: number; title: string; isOpen: boolean };
type CourseInfo = { name: string; code: string };

export default function HomePage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [course, setCourse] = useState<CourseInfo | null>(null);
  const [sessionList, setSessionList] = useState<SessionItem[]>([]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError("");
    setCourse(null);
    try {
      const res = await fetch("/api/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "エラーが発生しました");
        return;
      }
      const data = await res.json();
      setCourse(data.course);
      setSessionList(data.sessions);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">授業質問アプリ</h1>
          <p className="text-gray-500 text-sm mt-1">授業コードを入力して参加してください</p>
        </div>

        <form onSubmit={handleJoin} className="space-y-3">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="授業コード（例: CS101）"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-lg text-center font-mono uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-400"
            maxLength={20}
            autoFocus
          />
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold text-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "検索中..." : "入室する"}
          </button>
        </form>

        {course && (
          <div className="mt-6">
            <p className="text-center font-semibold text-gray-700 mb-3">
              📚 {course.name}
            </p>
            {sessionList.length === 0 ? (
              <p className="text-center text-gray-500 text-sm">開催中のセッションがありません</p>
            ) : (
              <ul className="space-y-2">
                {sessionList.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => router.push(`/session/${s.id}`)}
                      disabled={!s.isOpen}
                      className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                        s.isOpen
                          ? "border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-800"
                          : "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
                      }`}
                    >
                      <span className="font-medium">{s.title}</span>
                      {!s.isOpen && (
                        <span className="ml-2 text-xs text-gray-400">（締切済）</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="mt-8 text-center">
          <a
            href="/teacher/login"
            className="text-sm text-gray-400 hover:text-gray-600 underline"
          >
            教員用ログイン
          </a>
        </div>
      </div>
    </main>
  );
}
