"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface CourseItem {
  id: number;
  name: string;
  code: string;
}

export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/courses/public?q=${encodeURIComponent(query)}`);
        if (res.ok) setCourses(await res.json());
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">授業質問アプリ</h1>
          <p className="text-gray-500 text-sm mt-1">授業を選んで参加してください</p>
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="授業名で検索..."
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white mb-4"
          autoFocus
        />

        {loading ? (
          <div className="text-center text-gray-400 py-8 text-sm">読み込み中...</div>
        ) : courses.length === 0 ? (
          <div className="text-center text-gray-400 py-8 text-sm">
            {query ? "該当する授業が見つかりません" : "公開中の授業がありません"}
          </div>
        ) : (
          <ul className="space-y-2">
            {courses.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => router.push(`/courses/${c.id}`)}
                  className="w-full text-left px-4 py-3 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors shadow-sm"
                >
                  <p className="font-medium text-gray-800 text-sm">{c.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5 font-mono">{c.code}</p>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-10 text-center">
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
