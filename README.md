# RELA LP

RELA（リラ）の **Web販売** 用ランディングページ。
App Store（Apple）での公開は廃止。販売の本線は Web（`https://rela-ai.vercel.app`）。Android は Google Play も継続。

- `index.html` … ヒーロー（指定デザイン）
- `lp.html` … できること・料金・FAQ

アプリ本体（`rela-ai`）とは別の Vercel プロジェクトで公開します。

## Stripe決済Webhook

Web版サブスク/コインの決済結果を Supabase 本番に反映する仕組み。分離原則により、購入導線・Webhookは**この rela-lp 側**に置く（`rela-ai.vercel.app` 本体には決済導線を置かない）。

- `api/stripe-webhook.js` … Stripe Webhook 受信API（署名検証 → `web_subscriptions` upsert / `gift_grants` にコイン付与）
- `lib/plan-config.js` … price(Stripe Price ID) → plan 対応表、コイン枚数
- `buy.js` … 料金プランのボタンを Stripe Payment Link へ振り、`?client_reference_id=<user_id>` を付与

### 設定手順
1. `.env.example` を参照し、Vercel(rela-lp) の環境変数に値を設定
   （`STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `PRICE_BASIC` / `PRICE_STANDARD` / `PRICE_PREMIUM`）。
2. `buy.js` の `PAYMENT_LINKS` に各 Payment Link URL を設定。
3. Stripeダッシュボードで Webhookエンドポイントを登録（URL: `https://<このLPのドメイン>/api/stripe-webhook`）。
   購読イベント: `checkout.session.completed` / `customer.subscription.updated` / `customer.subscription.deleted` / `invoice.payment_failed`。
   発行された Signing secret(`whsec_...`) を `STRIPE_WEBHOOK_SECRET` に設定。
4. **テストモードで動作確認 → ヒロさん承認 → 本番キー切替** の順で進める。

### user_id の紐付け
`rela-ai` アプリでログイン後、このLPへ `?uid=<Supabase user_id>` を付けて遷移する。`buy.js` がその uid を Payment Link の `client_reference_id` に引き回し、Webhookが `web_subscriptions.user_id` / `gift_grants.user_id` に保存する。
