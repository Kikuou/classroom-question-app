"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewCoursePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim() || !password) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), code: code.trim(), password }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "作成に失敗しました");
        return;
      }
      // 作成後にログインへ
      router.push("/teacher/login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">授業を作成</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-6 space-y-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">授業名</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: 有機化学 I"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
                maxLength={100}
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">
                授業コード <span className="text-gray-400 font-normal">(学生が入室に使う)</span>
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ""))}
                placeholder="例: CHEM2024"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 font-mono uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-400"
                maxLength={20}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">パスワード</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="管理画面へのログインに使います"
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading || !name.trim() || !code.trim() || !password}
              className="w-full bg-gray-800 text-white py-3 rounded-xl font-semibold hover:bg-gray-900 disabled:opacity-50 transition-colors"
            >
              {loading ? "作成中..." : "授業を作成"}
            </button>
          </form>
        </div>

        <div className="mt-4 text-center">
          <a href="/teacher/login" className="text-sm text-gray-400 hover:text-gray-600 underline">
            ログインページに戻る
          </a>
        </div>
      </div>
    </main>
  );
}
