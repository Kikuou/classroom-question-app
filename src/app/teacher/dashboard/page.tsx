"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface CourseItem {
  id: number;
  name: string;
  code: string;
  isVisible: boolean;
  pendingCount: number;
}

export default function TeacherDashboardPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showPwForm, setShowPwForm] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [pwMsg, setPwMsg] = useState("");

  const fetchCourses = async () => {
    setError("");
    try {
      const res = await fetch("/api/courses");
      if (res.status === 401) {
        router.replace("/teacher/login");
        return;
      }
      if (res.ok) {
        setCourses(await res.json());
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "授業一覧の取得に失敗しました");
      }
    } catch {
      setError("通信エラーが発生しました。ページを再読み込みしてください。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCourses(); }, []);

  const logout = async () => {
    await fetch("/api/teacher/logout", { method: "POST" });
    router.push("/teacher/login");
  };

  const toggleVisible = async (courseId: number, current: boolean) => {
    const res = await fetch(`/api/courses/${courseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isVisible: !current }),
    });
    if (res.ok) {
      setCourses((prev) => prev.map((c) => c.id === courseId ? { ...c, isVisible: !current } : c));
    }
  };

  const deleteCourse = async (courseId: number, courseName: string) => {
    if (!confirm(`「${courseName}」を削除しますか？\nセッションと質問データもすべて削除されます。`)) return;
    const res = await fetch(`/api/courses/${courseId}`, { method: "DELETE" });
    if (res.ok) setCourses((prev) => prev.filter((c) => c.id !== courseId));
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < 4) return;
    const res = await fetch("/api/teacher/setup", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPw }),
    });
    if (res.ok) {
      setPwMsg("パスワードを変更しました");
      setNewPw("");
      setShowPwForm(false);
    } else {
      const data = await res.json();
      setPwMsg(data.error ?? "変更に失敗しました");
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="font-bold text-gray-800 text-base">授業一覧</h1>
          <div className="flex items-center gap-3">
            <a
              href="/teacher/courses/new"
              className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              + 新規授業
            </a>
            <button
              onClick={() => { setShowPwForm((v) => !v); setPwMsg(""); }}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              PW変更
            </button>
            <button onClick={logout} className="text-xs text-gray-400 hover:text-gray-600">
              ログアウト
            </button>
          </div>
        </div>
        {showPwForm && (
          <div className="max-w-2xl mx-auto mt-2 pb-2">
            <form onSubmit={changePassword} className="flex items-center gap-2">
              <input
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="新しいパスワード（4文字以上）"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
                autoFocus
              />
              <button
                type="submit"
                disabled={newPw.length < 4}
                className="text-xs px-3 py-1.5 bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:opacity-50"
              >
                変更
              </button>
              <button
                type="button"
                onClick={() => setShowPwForm(false)}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                閉じる
              </button>
            </form>
            {pwMsg && <p className="text-xs mt-1 text-green-600">{pwMsg}</p>}
          </div>
        )}
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4">
        {loading ? (
          <div className="text-center text-gray-400 py-12 text-sm">読み込み中...</div>
        ) : error ? (
          <div className="text-center py-12 space-y-3">
            <p className="text-red-500 text-sm">{error}</p>
            <button
              onClick={fetchCourses}
              className="text-xs px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900"
            >
              再試行
            </button>
          </div>
        ) : courses.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-sm mb-4">まだ授業がありません</p>
            <a
              href="/teacher/courses/new"
              className="inline-block px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700"
            >
              最初の授業を作成
            </a>
          </div>
        ) : (
          <ul className="space-y-3">
            {courses.map((c) => (
              <li key={c.id}>
                <div className="bg-white rounded-2xl border shadow-sm p-4">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      onClick={() => router.push(`/teacher/courses/${c.id}`)}
                      className="flex-1 text-left"
                    >
                      <p className="font-semibold text-gray-800">{c.name}</p>
                    </button>
                    <div className="flex items-center gap-2 shrink-0">
                      {c.pendingCount > 0 && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 font-medium px-2 py-0.5 rounded-full">
                          未対応 {c.pendingCount}
                        </span>
                      )}
                      <button
                        onClick={() => toggleVisible(c.id, c.isVisible)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                          c.isVisible
                            ? "border-green-200 text-green-600 bg-green-50 hover:bg-green-100"
                            : "border-gray-200 text-gray-400 bg-gray-50 hover:bg-gray-100"
                        }`}
                      >
                        {c.isVisible ? "公開中" : "非公開"}
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => router.push(`/teacher/courses/${c.id}`)}
                      className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    >
                      セッション管理
                    </button>
                    <button
                      onClick={() => deleteCourse(c.id, c.name)}
                      className="text-xs px-3 py-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      削除
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
