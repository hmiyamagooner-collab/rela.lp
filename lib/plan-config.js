// RELA Web決済の設定値（price→plan 対応・コイン付与枚数）。
// ここだけ触れば商品差し替えに対応できるように集約している。
//
// ★設定必須: Stripeダッシュボードの各サブスク商品の「Price ID（price_xxx）」を
//   環境変数に入れる。Payment Link の URL ではなく Price ID なので注意。
//   （checkout.session.completed で取得した price.id をこの表で plan に変換する）
//
//   Vercelプロジェクト rela-lp の環境変数に設定:
//     PRICE_BASIC    = price_xxxxxxxx   (¥500/月)
//     PRICE_STANDARD = price_xxxxxxxx   (¥1,500/月・3日トライアル)
//     PRICE_PREMIUM  = price_xxxxxxxx   (¥3,800/月)

const PRICE_TO_PLAN = {
  [process.env.PRICE_BASIC || 'price_REPLACE_BASIC']: 'basic',
  [process.env.PRICE_STANDARD || 'price_REPLACE_STANDARD']: 'standard',
  [process.env.PRICE_PREMIUM || 'price_REPLACE_PREMIUM']: 'premium',
};

// Stripe Price ID から plan（basic/standard/premium）へ変換。未登録なら null。
function resolvePlanFromPriceId(priceId) {
  if (!priceId) return null;
  return PRICE_TO_PLAN[priceId] || null;
}

// コイン都度課金（¥300）で付与する枚数。既存のウェルカム付与と同じく180枚固定。
const COIN_PER_PURCHASE = 180;

module.exports = { PRICE_TO_PLAN, resolvePlanFromPriceId, COIN_PER_PURCHASE };
