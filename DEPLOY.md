# Deep Dive - デプロイ手順書

## 必要なアカウント
- [Vercel](https://vercel.com) （無料）
- [Supabase](https://supabase.com) （無料）
- [GitHub](https://github.com) （無料）

---

## STEP 1: Supabase セットアップ

1. **プロジェクト作成**
   - https://supabase.com にアクセス → 「Start your project」
   - プロジェクト名: `deepdive`、パスワードを設定、リージョン: `Northeast Asia (Tokyo)` を選択

2. **DBテーブル作成**
   - 左メニュー「SQL Editor」→「New query」
   - `supabase-schema.sql` の内容を全コピーして貼り付け → 「Run」

3. **認証設定（メール確認を無効化 ※開発中は便利）**
   - 左メニュー「Authentication」→「Providers」→「Email」
   - 「Confirm email」を OFF にする（後から有効にしてもOK）

4. **認証メールのリダイレクト先を設定**
   - 「Authentication」→「URL Configuration」
   - Site URL に Vercel の URL を入力（後でまた戻ってくる）

5. **クレデンシャルをメモ**
   - 左メニュー「Settings」→「API」
   - `Project URL` と `anon public` キーを控えておく

---

## STEP 2: GitHub にコードをアップ

```bash
cd ~/Desktop/deepdive

# Gitを初期化
git init
git add .
git commit -m "Initial commit"

# GitHubで新しいリポジトリを作成し、URLをコピー
git remote add origin https://github.com/YOUR_USERNAME/deepdive.git
git push -u origin main
```

---

## STEP 3: Vercel にデプロイ

1. https://vercel.com にアクセス → 「Add New Project」
2. GitHub連携して `deepdive` リポジトリを選択
3. 「Deploy」をクリック（設定そのままでOK）

4. **環境変数を設定**（デプロイ後に Settings → Environment Variables）

   | Key | Value |
   |-----|-------|
   | `ANTHROPIC_API_KEY` | `sk-ant-...` （Anthropicのダッシュボードから取得） |
   | `SUPABASE_URL` | STEP 1でメモした Project URL |
   | `SUPABASE_ANON_KEY` | STEP 1でメモした anon public キー |

5. 環境変数を保存後、「Redeploy」をクリック

6. デプロイされたURLをコピー（例: `https://deepdive-xxx.vercel.app`）

---

## STEP 4: Supabase の認証URLを更新

1. Supabase ダッシュボード → 「Authentication」→「URL Configuration」
2. `Site URL` に Vercel の URL を入力
3. `Redirect URLs` にも同じURLを追加

---

## 完成！

デプロイされたURLをシェアすれば、誰でもアカウント登録して使えます。
- APIキーの入力不要
- 分析履歴が複数デバイスで同期
- ユーザーごとにデータが独立

---

## ローカル開発（引き続きserver.pyも使えます）

```bash
# 従来のローカルサーバーは server.py で引き続き動作します
# ただし Supabase 連携はローカルでは動作しない（/api/config が404になる）
# ローカルテストは APIキーを settings.html に手動入力してください
python3 server.py
```

---

## コスト目安

| サービス | 無料枠 |
|---------|--------|
| Vercel | 関数100GB-hrs/月、帯域100GB/月 |
| Supabase | DB 500MB、5万MAU、2GB転送/月 |
| Anthropic API | 従量課金（claude-opus-4-6は入力$15/M tokens、出力$75/M tokens） |

小規模利用（〜10ユーザー）なら Vercel・Supabase ともに無料枠で収まります。
