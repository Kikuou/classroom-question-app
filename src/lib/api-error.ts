import { NextResponse } from "next/server";

/**
 * DB接続エラーやその他の予期しないエラーを受け取り、
 * ユーザー向けのメッセージを含む NextResponse を返す。
 */
export function handleApiError(err: unknown): NextResponse {
  const msg = err instanceof Error ? err.message : String(err);

  // DATABASE_URL 未設定
  if (msg.includes("DATABASE_URL")) {
    return NextResponse.json(
      { error: "サーバーの設定に問題があります。管理者に連絡してください。" },
      { status: 503 }
    );
  }

  // DB接続失敗（Neon/Postgres 共通パターン）
  if (
    msg.includes("connection") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("timeout") ||
    msg.includes("NeonDbError")
  ) {
    return NextResponse.json(
      { error: "データベースに接続できませんでした。しばらく待ってから再試行してください。" },
      { status: 503 }
    );
  }

  console.error("[API Error]", err);
  return NextResponse.json(
    { error: "サーバーエラーが発生しました。" },
    { status: 500 }
  );
}
