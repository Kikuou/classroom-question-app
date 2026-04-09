# 授業質問アプリ

大学授業向けの質問投稿・管理Webアプリ。学生はスマホから質問を投稿し、教員が管理画面で返信・ステータス管理・CSV出力を行う。

## 技術スタック
- **フロントエンド/バックエンド**: Next.js 14 (App Router)
- **ORM**: Drizzle ORM
- **DB**: Neon Postgres
- **デプロイ**: Render

---

## セットアップ

### 1. 環境変数の設定

`.env.local` を編集して以下を設定:

```
DATABASE_URL=postgresql://...  # NeonのConnection String
TEACHER_SECRET=xxxxxxxxxx      # ランダムな32文字以上の文字列
```

### 2. DBマイグレーション

```bash
npm run db:generate   # マイグレーションファイル生成
npm run db:migrate    # Neonに適用
```

### 3. ローカル起動

```bash
npm run dev
```

---

## Renderデプロイ設定

| 項目 | 値 |
|------|----|
| Environment | Node |
| Build Command | `npm install && npm run build` |
| Start Command | `npm start` |
| 環境変数 `DATABASE_URL` | Neon Connection String |
| 環境変数 `TEACHER_SECRET` | ランダムな長い文字列 |

---

## 使い方

### 学生
1. トップページ (`/`) で授業コードを入力
2. 開いているセッションを選択
3. 質問を投稿（匿名/記名選択可）
4. 他の質問にいいねできる
5. 5秒ごとに自動更新

### 教員
1. `/teacher/login` から授業コードとパスワードでログイン
2. `/teacher/courses/new` で新しい授業を作成（初回のみ）
3. 授業回（セッション）を追加して質問受付開始
4. 質問管理画面 (`/teacher/sessions/[id]`) で：
   - ステータスをワンクリックで変更（未対応/回答済/後で扱う/非表示）
   - 返信を入力
   - CSV出力（いいね順/時系列）

---

## ステータス定義

| ステータス | 意味 | 学生に表示 |
|-----------|------|----------|
| 未対応 | デフォルト | ✓ |
| 回答済 | 授業で回答した | ✓ |
| 後で扱う | 次回以降に扱う | ✓ |
| 非表示 | 不適切・重複等 | ✗ |
