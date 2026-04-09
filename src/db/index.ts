import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// 遅延初期化: 最初のDB呼び出し時に接続を確立する。
// これにより、DATABASE_URL 未設定でも DB を使わないページ (/) は正常に返せる。
let _db: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getDb() {
  if (!_db) {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL is not set. Render のEnvironment Variables に設定してください。"
      );
    }
    _db = drizzle(neon(process.env.DATABASE_URL), { schema });
  }
  return _db;
}

// 既存の import { db } を変えずに動くようにするエイリアス
// get() 時に初めて初期化されるため、起動クラッシュを防ぐ
export const db = new Proxy(
  {} as ReturnType<typeof drizzle<typeof schema>>,
  { get: (_, prop) => Reflect.get(getDb(), prop) }
);
