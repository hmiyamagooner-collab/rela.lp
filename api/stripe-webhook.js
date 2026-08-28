// RELA Web決済 Stripe Webhook 受信API（Vercel Serverless Function）
//
// 役割: Stripeの決済結果を Supabase 本番に反映する。
//   - checkout.session.completed  … サブスク開始/コイン購入
//   - customer.subscription.updated … status / 期間終了 更新
//   - customer.subscription.deleted … status=canceled
//   - invoice.payment_failed        … status=past_due
//
// 前提テーブル（作成済み・変更しない）:
//   web_subscriptions(user_id, stripe_customer_id, stripe_subscription_id[unique],
//                     plan['basic'|'standard'|'premium'], status, current_period_end, ...)
//   gift_grants(user_id, gift_key, coins)  PK=(user_id, gift_key) … コイン付与の積み上げ
//
// 環境変数（コード直書き禁止・Vercel側に設定）:
//   STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
//   （price→plan 用の PRICE_BASIC / PRICE_STANDARD / PRICE_PREMIUM は lib/plan-config.js 参照）

const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');
const { resolvePlanFromPriceId, COIN_PER_PURCHASE } = require('../lib/plan-config');

// Stripe署名検証には「生のリクエストボディ」が必要なため、Vercelの自動body parseを無効化する。
async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers['stripe-signature'];
  if (!secret || !signature) {
    // 署名 or シークレットが無い＝検証不能。処理せず400で拒否。
    return res.status(400).json({ error: 'Missing stripe-signature or webhook secret' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  let event;
  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    // 署名検証失敗は必ず400（署名なしの受理は不可）。中身はログに出さない。
    console.error('[stripe-webhook] signature verification failed:', err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(stripe, event);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;
      default:
        // 購読外イベントは無視（200で受理）。
        break;
    }
  } catch (err) {
    // DB一時障害・設定漏れなど「後で直れば再処理したい」ものは500 → Stripeが自動リトライ。
    // （冪等化しているので再送で二重加算にはならない。Stripeのリトライは数日で自然終了する）
    console.error(`[stripe-webhook] handler error for ${event.type} (${event.id}):`, err.message);
    return res.status(500).json({ error: 'Handler failed' });
  }

  return res.status(200).json({ received: true });
}

// ---- イベント別処理 ---------------------------------------------------------

async function handleCheckoutCompleted(stripe, event) {
  const session = event.data.object;
  const userId = session.client_reference_id; // 購入URLに付与した Supabase user_id

  if (!userId) {
    // user_id が無いと誰の購入か紐付けられない。再送しても直らないので200で受理し記録だけ残す。
    console.warn('[stripe-webhook] checkout.session.completed without client_reference_id:', session.id);
    return;
  }

  if (session.mode === 'subscription') {
    // サブスク本体を取得して plan / status / 期間終了 を得る
    const subscription = await stripe.subscriptions.retrieve(session.subscription);
    const priceId = subscription.items && subscription.items.data[0] && subscription.items.data[0].price
      ? subscription.items.data[0].price.id
      : null;
    const plan = resolvePlanFromPriceId(priceId);
    if (!plan) {
      // price→plan の設定漏れ。500で返してリトライ&気付けるようにする。
      throw new Error(`No plan mapping for price id: ${priceId}`);
    }

    const { error } = await getSupabase()
      .from('web_subscriptions')
      .upsert(
        {
          user_id: userId,
          stripe_customer_id: typeof session.customer === 'string' ? session.customer : subscription.customer,
          stripe_subscription_id: subscription.id,
          plan,
          status: subscription.status, // 'active' / 'trialing' 等をそのまま格納
          current_period_end: toIso(getPeriodEnd(subscription)),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'stripe_subscription_id' } // 再送は同一subでmerge＝重複行にならない
      );
    if (error) throw error;
    console.log(`[stripe-webhook] subscription upserted: user=${userId} plan=${plan} status=${subscription.status}`);
  } else if (session.mode === 'payment') {
    // コイン都度課金（¥300 / 180枚固定）。gift_grants に1行積む。
    // 冪等化: PK=(user_id, gift_key)。event.id を key にして、再送は ON CONFLICT DO NOTHING。
    const { error } = await getSupabase()
      .from('gift_grants')
      .upsert(
        { user_id: userId, gift_key: `stripe:${event.id}`, coins: COIN_PER_PURCHASE },
        { onConflict: 'user_id,gift_key', ignoreDuplicates: true }
      );
    if (error) throw error;
    console.log(`[stripe-webhook] coins granted: user=${userId} coins=${COIN_PER_PURCHASE} key=stripe:${event.id}`);
  }
}

async function handleSubscriptionUpdated(subscription) {
  // 既存行の status / 期間終了 を更新（行が無い場合は0件更新。checkout側で作成される想定）。
  const { error } = await getSupabase()
    .from('web_subscriptions')
    .update({
      status: subscription.status,
      current_period_end: toIso(getPeriodEnd(subscription)),
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);
  if (error) throw error;
}

async function handleSubscriptionDeleted(subscription) {
  const { error } = await getSupabase()
    .from('web_subscriptions')
    .update({ status: 'canceled', updated_at: new Date().toISOString() })
    .eq('stripe_subscription_id', subscription.id);
  if (error) throw error;
}

async function handleInvoicePaymentFailed(invoice) {
  // 支払い失敗＝past_due（即退会はしない。退会判断は別途ヒロさん決定）。
  const subscriptionId = invoice.subscription;
  if (!subscriptionId) return;
  const { error } = await getSupabase()
    .from('web_subscriptions')
    .update({ status: 'past_due', updated_at: new Date().toISOString() })
    .eq('stripe_subscription_id', subscriptionId);
  if (error) throw error;
}

// ---- ヘルパー ---------------------------------------------------------------

// Supabaseクライアント（service_roleでサーバー側から書き込む）。関数呼び出し時に生成。
let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _supabase;
}

// 期間終了(Unix秒)を取得。新しいStripe APIではサブスク直下ではなくitem側にあるためフォールバック。
function getPeriodEnd(subscription) {
  if (subscription.current_period_end) return subscription.current_period_end;
  const item = subscription.items && subscription.items.data && subscription.items.data[0];
  return item ? item.current_period_end : null;
}

// Unix秒(Stripe) → ISO文字列(timestamptz)。無ければ null。
function toIso(unixSeconds) {
  return unixSeconds ? new Date(unixSeconds * 1000).toISOString() : null;
}

// 生ボディをBufferで読む（署名検証用）。
async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

module.exports = handler;
// Vercelの自動body parseを無効化（生ボディで署名検証するため必須）。
module.exports.config = { api: { bodyParser: false } };
