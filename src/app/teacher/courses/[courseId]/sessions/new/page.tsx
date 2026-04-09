"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function NewSessionPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() }),
      });
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/teacher/login");
          return;
        }
        const data = await res.json();
        setError(data.error ?? "作成に失敗しました");
        return;
      }
      const session = await res.json();
      router.push(`/teacher/sessions/${session.id}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">授業回を追加</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">授業回のタイトル</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例: 第3回 有機化学基礎"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
                maxLength={100}
                autoFocus
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "作成中..." : "作成して質問受付を開始"}
            </button>
          </form>
        </div>

        <div className="mt-4 text-center">
          <a
            href={`/teacher/courses/${courseId}`}
            className="text-sm text-gray-400 hover:text-gray-600 underline"
          >
            戻る
          </a>
        </div>
      </div>
    </main>
  );
}
