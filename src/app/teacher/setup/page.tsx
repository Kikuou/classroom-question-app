"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function TeacherSetupPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  // 既にパスワード設定済みならログインへ
  useEffect(() => {
    fetch("/api/teacher/setup")
      .then((r) => r.json())
      .then((data) => {
        if (data.configured) router.replace("/teacher/login");
        else setChecking(false);
      })
      .catch(() => setChecking(false));
  }, [router]);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/teacher/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "設定に失敗しました");
        return;
      }
      router.push("/teacher/dashboard");
    } finally {
      setLoading(false);
    }
  };

  if (checking) return null;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-800">初回パスワード設定</h1>
          <p className="text-gray-500 text-sm mt-2">
            教員ログイン用のパスワードを設定してください
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-6">
          <form onSubmit={handleSetup} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">
                パスワード（4文字以上）
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="新しいパスワード"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                autoFocus
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading || password.length < 4}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "設定中..." : "パスワードを設定してログイン"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
