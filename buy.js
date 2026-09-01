// 購入導線: プラン/コインの購入ボタンを Stripe Payment Link へ振り、
// 購入URLに ?client_reference_id=<Supabase user_id> を付ける。
//
// 前提（ヒロさん承認済みフロー）:
//   rela-ai アプリ側でログイン後、このLPへ  ?uid=<Supabase user_id>  を付けて遷移してくる。
//   → その uid を各Payment Linkの client_reference_id として引き回す。
//   uid が無いとき（未ログインで直接LPに来た等）は、まずアプリでログインしてもらう。
//
// ★設定必須: Stripeダッシュボードで発行した Payment Link の URL を PAYMENT_LINKS に入れる。
//   （Price ID とは別物。こちらは https://buy.stripe.com/xxxx の購入リンクURL）
(function () {
  // ⚠ 現在は【テストモード(test_)】のPayment Link。本番切替時に本番URLへ差し替えること。
  var PAYMENT_LINKS = {
    basic: 'https://buy.stripe.com/test_eVq00jb7caf0ao3ffmcs803', // RELA ベーシック ¥500/月
    standard: 'https://buy.stripe.com/test_fZu3cva3886S67N7MUcs802', // RELA スタンダード ¥1,500/月(3日トライアル)
    premium: 'https://buy.stripe.com/test_5kQ28r4IOdrc7bR9V2cs801', // RELA プレミアム ¥3,800/月
    coin180: 'https://buy.stripe.com/test_5kQfZha3872O2VB7MUcs800', // RELA 180コイン ¥300(都度)
  };

  // uid が取れないときの誘導先（アプリでログインさせる）
  var LOGIN_URL = 'https://rela-ai.vercel.app';

  var params = new URLSearchParams(location.search);
  var uid = params.get('uid') || params.get('user_id') || '';

  var buttons = document.querySelectorAll('[data-plan]');
  for (var i = 0; i < buttons.length; i++) {
    (function (el) {
      var plan = el.getAttribute('data-plan');
      var link = PAYMENT_LINKS[plan];
      if (!link) return;

      if (!uid) {
        // 未ログイン → まずアプリでログイン（アプリ側でuid付きでLPへ戻す想定）
        el.setAttribute('href', LOGIN_URL);
        return;
      }
      var sep = link.indexOf('?') === -1 ? '?' : '&';
      el.setAttribute('href', link + sep + 'client_reference_id=' + encodeURIComponent(uid));
    })(buttons[i]);
  }
})();
