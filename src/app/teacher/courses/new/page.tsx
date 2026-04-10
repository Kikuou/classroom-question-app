"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewCoursePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "作成に失敗しました");
        return;
      }
      router.push("/teacher/dashboard");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <button
            onClick={() => router.push("/teacher/dashboard")}
            className="text-xs text-gray-400 hover:text-gray-600 mb-2 block mx-auto"
          >
            ← ダッシュボード
          </button>
          <h1 className="text-2xl font-bold text-gray-800">新規授業を作成</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">授業名</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: 有機化学 I"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                maxLength={100}
                autoFocus
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full bg-gray-800 text-white py-3 rounded-xl font-semibold text-sm hover:bg-gray-900 disabled:opacity-50 transition-colors"
            >
              {loading ? "作成中..." : "授業を作成"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
