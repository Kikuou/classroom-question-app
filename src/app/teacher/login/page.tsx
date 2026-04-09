"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TeacherLoginPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !password) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/teacher/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), password }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "ログインに失敗しました");
        return;
      }
      const data = await res.json();
      router.push(`/teacher/courses/${data.courseId}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">教員ログイン</h1>
          <p className="text-gray-500 text-sm mt-1">授業コードとパスワードを入力してください</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-6 space-y-4">
          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">授業コード</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="CS101"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 font-mono uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-400"
                maxLength={20}
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">パスワード</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="授業作成時のパスワード"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading || !code.trim() || !password}
              className="w-full bg-gray-800 text-white py-3 rounded-xl font-semibold hover:bg-gray-900 disabled:opacity-50 transition-colors"
            >
              {loading ? "ログイン中..." : "ログイン"}
            </button>
          </form>

          <div className="border-t pt-4">
            <p className="text-xs text-gray-500 mb-2 text-center">初めての方は授業を作成してください</p>
            <a
              href="/teacher/courses/new"
              className="block w-full text-center border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm hover:bg-gray-50 transition-colors"
            >
              新しい授業を作成
            </a>
          </div>
        </div>

        <div className="mt-4 text-center">
          <a href="/" className="text-sm text-gray-400 hover:text-gray-600 underline">
            学生ページに戻る
          </a>
        </div>
      </div>
    </main>
  );
}
