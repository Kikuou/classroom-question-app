// シンプルなインメモリレートリミッター
// Render 無料枠はシングルプロセスなので Map で十分
// キー: "action:clientId"、値: 直近のタイムスタンプ配列

const store = new Map<string, number[]>();

/**
 * @param key      一意識別子（例: "question:uuid"）
 * @param limit    windowMs 内の最大リクエスト数
 * @param windowMs ウィンドウ幅（ミリ秒）
 * @returns true = 制限超過（リジェクト）、false = 通過可
 */
export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = store.get(key) ?? [];
  const recent = timestamps.filter((t) => now - t < windowMs);
  if (recent.length >= limit) return true;
  recent.push(now);
  store.set(key, recent);
  return false;
}
