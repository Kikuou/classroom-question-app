"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface SessionItem {
  id: number;
  courseId: number;
  title: string;
  isOpen: boolean;
  discussionOpen: boolean;
  sortOrder: number;
  createdAt: string;
}

interface CourseItem {
  id: number;
  name: string;
  isVisible: boolean;
  pendingCount: number;
  sessions: SessionItem[];
}

const SESSION_PREVIEW = 3; // 最初に表示するセッション数

export default function TeacherDashboardPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // パスワード変更
  const [showPwForm, setShowPwForm] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [pwMsg, setPwMsg] = useState("");

  const fetchCourses = async () => {
    setError("");
    try {
      const res = await fetch("/api/courses");
      if (res.status === 401) { router.replace("/teacher/login"); return; }
      if (res.ok) setCourses(await res.json());
      else setError("授業一覧の取得に失敗しました");
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

  // 授業名インライン編集
  const renameCourse = async (courseId: number, name: string) => {
    if (!name.trim()) return;
    const res = await fetch(`/api/courses/${courseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (res.ok) {
      setCourses((prev) => prev.map((c) => c.id === courseId ? { ...c, name: name.trim() } : c));
    }
  };

  // セッション名インライン編集
  const renameSession = async (courseId: number, sessionId: number, title: string) => {
    if (!title.trim()) return;
    const res = await fetch(`/api/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim() }),
    });
    if (res.ok) {
      setCourses((prev) =>
        prev.map((c) =>
          c.id === courseId
            ? { ...c, sessions: c.sessions.map((s) => s.id === sessionId ? { ...s, title: title.trim() } : s) }
            : c
        )
      );
    }
  };

  // 公開・非公開切替
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

  // 授業削除
  const deleteCourse = async (courseId: number, courseName: string) => {
    if (!confirm(`「${courseName}」を削除しますか？\nセッションと質問データもすべて削除されます。`)) return;
    const res = await fetch(`/api/courses/${courseId}`, { method: "DELETE" });
    if (res.ok) setCourses((prev) => prev.filter((c) => c.id !== courseId));
  };

  // セッション作成
  const createSession = async (courseId: number, title: string): Promise<boolean> => {
    if (!title.trim()) return false;
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim(), courseId }),
    });
    if (res.ok) {
      const newSession: SessionItem = await res.json();
      setCourses((prev) =>
        prev.map((c) => c.id === courseId ? { ...c, sessions: [...c.sessions, newSession] } : c)
      );
      return true;
    }
    return false;
  };

  // セッション削除
  const deleteSession = async (courseId: number, sessionId: number) => {
    if (!confirm("このセッションを削除しますか？（質問データは保持されます）")) return;
    const res = await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
    if (res.ok) {
      setCourses((prev) =>
        prev.map((c) =>
          c.id === courseId ? { ...c, sessions: c.sessions.filter((s) => s.id !== sessionId) } : c
        )
      );
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
                className="text-xs px-3 py-1.5 bg-gray-800 text-white rounded-lg disabled:opacity-50"
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

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {loading ? (
          <div className="text-center text-gray-400 py-12 text-sm">読み込み中...</div>
        ) : error ? (
          <div className="text-center py-12 space-y-3">
            <p className="text-red-500 text-sm">{error}</p>
            <button onClick={fetchCourses} className="text-xs px-4 py-2 bg-gray-800 text-white rounded-lg">再試行</button>
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
          courses.map((c) => (
            <CourseCard
              key={c.id}
              course={c}
              onRename={(name) => renameCourse(c.id, name)}
              onToggleVisible={() => toggleVisible(c.id, c.isVisible)}
              onDelete={() => deleteCourse(c.id, c.name)}
              onCreateSession={(title) => createSession(c.id, title)}
              onRenameSession={(sId, title) => renameSession(c.id, sId, title)}
              onDeleteSession={(sId) => deleteSession(c.id, sId)}
              onManageSession={(sId) => router.push(`/teacher/sessions/${sId}`)}
              onManageCourse={() => router.push(`/teacher/courses/${c.id}`)}
            />
          ))
        )}
      </div>
    </main>
  );
}

// ─── 授業カード ─────────────────────────────────────────────────

function CourseCard({
  course,
  onRename,
  onToggleVisible,
  onDelete,
  onCreateSession,
  onRenameSession,
  onDeleteSession,
  onManageSession,
  onManageCourse,
}: {
  course: CourseItem;
  onRename: (name: string) => void;
  onToggleVisible: () => void;
  onDelete: () => void;
  onCreateSession: (title: string) => Promise<boolean>;
  onRenameSession: (sessionId: number, title: string) => void;
  onDeleteSession: (sessionId: number) => void;
  onManageSession: (sessionId: number) => void;
  onManageCourse: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const visibleSessions = showAll
    ? course.sessions
    : course.sessions.slice(0, SESSION_PREVIEW);
  const hasMore = course.sessions.length > SESSION_PREVIEW;

  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
      {/* 授業ヘッダー */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start gap-2">
          {/* 折りたたみ + 授業名 */}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-gray-300 hover:text-gray-500 mt-0.5 shrink-0 text-lg leading-none"
            title={expanded ? "折りたたむ" : "展開する"}
          >
            {expanded ? "▾" : "▸"}
          </button>
          <div className="flex-1 min-w-0">
            <InlineEdit
              value={course.name}
              onSave={onRename}
              className="font-semibold text-gray-800 text-sm"
              placeholder="授業名"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {course.pendingCount > 0 && (
              <span className="text-xs bg-yellow-100 text-yellow-700 font-medium px-2 py-0.5 rounded-full">
                未対応 {course.pendingCount}
              </span>
            )}
            <button
              onClick={onToggleVisible}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                course.isVisible
                  ? "border-green-200 text-green-600 bg-green-50 hover:bg-green-100"
                  : "border-gray-200 text-gray-400 bg-gray-50 hover:bg-gray-100"
              }`}
            >
              {course.isVisible ? "公開中" : "非公開"}
            </button>
          </div>
        </div>
      </div>

      {/* セッション一覧（折りたたみ可） */}
      {expanded && (
        <div className="border-t">
          {course.sessions.length === 0 ? (
            <p className="text-xs text-gray-400 px-4 py-3">セッションがありません</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {visibleSessions.map((s) => (
                <SessionRow
                  key={s.id}
                  session={s}
                  onRename={(title) => onRenameSession(s.id, title)}
                  onManage={() => onManageSession(s.id)}
                  onDelete={() => onDeleteSession(s.id)}
                />
              ))}
            </ul>
          )}

          {hasMore && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="w-full text-xs text-blue-500 hover:text-blue-700 py-2 border-t bg-gray-50 hover:bg-blue-50 transition-colors"
            >
              残り {course.sessions.length - SESSION_PREVIEW} 件を表示
            </button>
          )}
          {showAll && hasMore && (
            <button
              onClick={() => setShowAll(false)}
              className="w-full text-xs text-gray-400 hover:text-gray-600 py-2 border-t bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              折りたたむ
            </button>
          )}

          {/* 新規セッション作成フォーム */}
          <div className="border-t bg-gray-50 px-4 py-2">
            <NewSessionForm
              onSubmit={onCreateSession}
              onManageCourse={onManageCourse}
            />
          </div>
        </div>
      )}

      {/* 授業フッター（削除） */}
      <div className="border-t px-4 py-2 flex items-center justify-end">
        <button
          onClick={onDelete}
          className="text-xs text-red-400 hover:text-red-600 transition-colors"
        >
          この授業を削除
        </button>
      </div>
    </div>
  );
}

// ─── セッション行 ─────────────────────────────────────────────────

function SessionRow({
  session,
  onRename,
  onManage,
  onDelete,
}: {
  session: SessionItem;
  onRename: (title: string) => void;
  onManage: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex items-center gap-2 px-4 py-2.5 hover:bg-gray-50 group">
      <div className="flex-1 min-w-0 space-y-1">
        <InlineEdit
          value={session.title}
          onSave={onRename}
          className="text-sm text-gray-800 font-medium"
          placeholder="セッション名"
        />
        {/* 状態バッジ */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <StatusBadge
            label="質問"
            active={session.isOpen}
            activeText="受付中"
            inactiveText="締切"
            activeColor="green"
            inactiveColor="gray"
          />
          <StatusBadge
            label="回答"
            active={session.discussionOpen}
            activeText="受付中"
            inactiveText="締切"
            activeColor="orange"
            inactiveColor="gray"
          />
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onManage}
          className="text-xs px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          管理
        </button>
        <button
          onClick={onDelete}
          className="text-xs text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          削除
        </button>
      </div>
    </li>
  );
}

// ─── インライン編集コンポーネント ─────────────────────────────────

function InlineEdit({
  value,
  onSave,
  className,
  placeholder,
}: {
  value: string;
  onSave: (v: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  const save = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
    else setDraft(value); // キャンセル時は元に戻す
    setEditing(false);
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  // 外部からの value 変更に追従
  useEffect(() => { setDraft(value); }, [value]);

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") cancel();
          }}
          onBlur={save}
          className="flex-1 min-w-0 border border-blue-300 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          maxLength={100}
        />
        <button
          onMouseDown={(e) => { e.preventDefault(); save(); }}
          className="text-green-500 hover:text-green-700 text-xs font-bold"
        >
          ✓
        </button>
        <button
          onMouseDown={(e) => { e.preventDefault(); cancel(); }}
          className="text-gray-400 hover:text-gray-600 text-xs"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => { setDraft(value); setEditing(true); }}
      className={`text-left hover:bg-yellow-50 rounded px-1 -mx-1 transition-colors group/edit ${className ?? ""}`}
      title="クリックして編集"
    >
      {value}
      <span className="ml-1 text-gray-300 group-hover/edit:text-gray-400 text-xs">✎</span>
    </button>
  );
}

// ─── ステータスバッジ ─────────────────────────────────────────────

function StatusBadge({
  label,
  active,
  activeText,
  inactiveText,
  activeColor,
  inactiveColor,
}: {
  label: string;
  active: boolean;
  activeText: string;
  inactiveText: string;
  activeColor: "green" | "orange" | "blue";
  inactiveColor: "gray";
}) {
  const colorMap = {
    green: "bg-green-100 text-green-700",
    orange: "bg-orange-100 text-orange-700",
    blue: "bg-blue-100 text-blue-700",
    gray: "bg-gray-100 text-gray-400",
  };

  return (
    <span
      className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
        active ? colorMap[activeColor] : colorMap[inactiveColor]
      }`}
    >
      {label}:{active ? activeText : inactiveText}
    </span>
  );
}

// ─── 新規セッション作成フォーム ───────────────────────────────────

function NewSessionForm({
  onSubmit,
  onManageCourse,
}: {
  onSubmit: (title: string) => Promise<boolean>;
  onManageCourse: () => void;
}) {
  const [showInput, setShowInput] = useState(false);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showInput) inputRef.current?.focus();
  }, [showInput]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    setError("");
    const ok = await onSubmit(title.trim());
    setCreating(false);
    if (ok) {
      setTitle("");
      setShowInput(false);
    } else {
      setError("作成に失敗しました");
    }
  };

  if (!showInput) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowInput(true)}
          className="text-xs text-blue-500 hover:text-blue-700 font-medium py-0.5"
        >
          + セッション追加
        </button>
        <button
          onClick={onManageCourse}
          className="text-xs text-gray-400 hover:text-gray-600 ml-auto"
        >
          並び替え・詳細管理 →
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-1">
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setShowInput(false)}
          placeholder="セッション名を入力（例: 第1回 有機化学入門）"
          className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
          maxLength={100}
        />
        <button
          type="submit"
          disabled={creating || !title.trim()}
          className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {creating ? "作成中..." : "作成"}
        </button>
        <button
          type="button"
          onClick={() => { setShowInput(false); setError(""); }}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          閉じる
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </form>
  );
}
