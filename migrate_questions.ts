// 既存の questions.session_id → course_id のバックフィルスクリプト
// 実行: DATABASE_URL="..." npx ts-node --compiler-options '{"module":"commonjs"}' migrate_questions.ts
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from "./src/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Backfilling questions.course_id from sessions.course_id...");
  const result = await db.execute(sql`
    UPDATE questions
    SET course_id = sessions.course_id
    FROM sessions
    WHERE questions.session_id = sessions.id
      AND questions.course_id IS NULL
  `);
  console.log(`Updated: ${result.rowCount ?? "?"} rows`);
  console.log("Done.");
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
