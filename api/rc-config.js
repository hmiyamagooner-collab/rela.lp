// RELA LP — RevenueCat Web Billing 公開キー配信（Vercel Serverless Function）
// 目的: キーをソースへ直書きしない（指示書準拠）。Vercelの環境変数 RC_WEB_API_KEY を返す。
//   ・rcb_ は Stripe の pk_ 同様「クライアント公開前提」の公開キーなので、配信自体は安全。
//   ・サンドボックス検証中は rcb_sb_ を、本番切替時は rcb_ を環境変数に入れて切り替える。
// 環境変数未設定なら空文字を返す → フロントは「準備中」を表示（誤動作しない）。
module.exports = (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.statusCode = 200;
  res.end(JSON.stringify({ key: process.env.RC_WEB_API_KEY || '' }));
};
