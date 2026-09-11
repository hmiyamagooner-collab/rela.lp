/* RELA LP — Webチェックアウト（Supabaseマジックリンク + RevenueCat Web Billing）
 * 目的: LP上でログイン→購入まで完結させる。
 *   ・App User ID に Supabase の user_id を使い、アプリ本体(rela.website)/Android と
 *     同一ユーザーで名寄せ（課金の真実の源は RevenueCat が一元管理）。
 *   ・RevenueCat 公開キーはソースに直書きせず /api/rc-config（Vercel環境変数）から取得。
 * 前提: RevenueCatダッシュボードで Offering(default) に basic/standard/premium の
 *   パッケージ（識別子は下記と完全一致）が用意されていること。未整備なら「準備中」を表示。
 */

// Supabase はアプリ本体(renai-crm)と“同一プロジェクト”＝同じ user_id になる（名寄せの要）。
// ここに置くのは publishable(anon) キー＝公開前提なので安全。
const SUPABASE_URL = 'https://xmuvgobfompdwhgxnpis.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_ne7Q3eR3b-9vkfvk6JuLBw_h0FdkxYt';
const SUPABASE_SDK_URL = 'https://esm.sh/@supabase/supabase-js@2';
const RC_SDK_URL = 'https://esm.sh/@revenuecat/purchases-js@1';
const RC_CSS_URL = 'https://esm.sh/@revenuecat/purchases-js@1/dist/Purchases.css';

// UI表示名。identifier は RevenueCat Offering(default) のパッケージ識別子と完全一致必須。
// coins_180 は消費型(サブスクではない)コインパック。購入フローはサブスクと同じ。
// 英語版LP(/en/, <html lang="en">)では英語＋USD表示。JP側の文言・金額は従来どおり。
const EN = (typeof document !== 'undefined' && document.documentElement && document.documentElement.lang === 'en');
const PLAN_LABEL = EN ? {
  basic: 'BASIC ($4.99/month)',
  standard: 'STANDARD ($9.99/month)',
  premium: 'PREMIUM ($24.99/month)',
  coins_180: 'RELA 180 coins ($2.99)'
} : {
  basic: 'BASIC（¥500/月）',
  standard: 'STANDARD（¥1,500/月）',
  premium: 'PREMIUM（¥3,800/月）',
  coins_180: 'RELA 180コイン（¥300）'
};
const COIN_PACKAGES = { coins_180: 180 }; // 消費型: 識別子→付与コイン枚数
// 申込み最終確認画面（特商法：金額・無料期間・自動更新・解約期限/方法を購入確定前に表示）用のメタ
const PLAN_META = EN ? {
  basic:     { name: 'BASIC',          price: '$4.99',  sub: true,  trial: 0 },
  standard:  { name: 'STANDARD',       price: '$9.99',  sub: true,  trial: 3 },
  premium:   { name: 'PREMIUM',        price: '$24.99', sub: true,  trial: 0 },
  coins_180: { name: 'RELA 180 coins', price: '$2.99',  sub: false, trial: 0 }
} : {
  basic:     { name: 'BASIC',        price: '¥500',   sub: true,  trial: 0 },
  standard:  { name: 'STANDARD',     price: '¥1,500', sub: true,  trial: 3 },
  premium:   { name: 'PREMIUM',      price: '¥3,800', sub: true,  trial: 0 },
  coins_180: { name: 'RELA 180コイン', price: '¥300',   sub: false, trial: 0 }
};

let sb = null;           // Supabaseクライアント
let rc = null;           // RevenueCat Purchases インスタンス
let rcKey = null;        // /api/rc-config から取得した公開キー（null=未取得, ''=未設定）
let currentUser = null;  // ログイン中ユーザー

/* ============ Supabase ============ */
async function ensureSupabase() {
  if (sb) return sb;
  const mod = await import(SUPABASE_SDK_URL);
  const createClient = mod.createClient || (mod.default && mod.default.createClient);
  sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, detectSessionInUrl: true, autoRefreshToken: true }
  });
  return sb;
}
async function refreshUser() {
  await ensureSupabase();
  const { data } = await sb.auth.getSession();
  currentUser = data && data.session ? data.session.user : null;
  return currentUser;
}
// マジックリンク復帰直後はセッション確立が数百ms遅れることがあるので待つ
function waitForSession(ms) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (u) => { if (!done) { done = true; resolve(u); } };
    const { data } = sb.auth.onAuthStateChange((_e, session) => { if (session) finish(session.user); });
    setTimeout(() => { try { data && data.subscription && data.subscription.unsubscribe(); } catch (e) {} finish(currentUser); }, ms);
  });
}
async function sendMagicLink(email, plan) {
  await ensureSupabase();
  // メールのリンクを開くと ?checkout=<plan> 付きでLPに戻り、購入を自動再開する
  const redirectTo = location.origin + location.pathname + '?checkout=' + encodeURIComponent(plan);
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
  return error;
}

/* ============ RevenueCat ============ */
async function ensureRC(userId) {
  if (rcKey === null) {
    try { const r = await fetch('/api/rc-config'); const j = await r.json(); rcKey = (j && j.key) ? String(j.key) : ''; }
    catch (e) { rcKey = ''; }
  }
  if (!rcKey) return null; // 未設定 = 準備中
  const mod = await import(RC_SDK_URL);
  const Purchases = mod.Purchases || (mod.default && mod.default.Purchases) || mod.default;
  if (!document.getElementById('rc-css')) {
    const l = document.createElement('link');
    l.id = 'rc-css'; l.rel = 'stylesheet'; l.href = RC_CSS_URL;
    document.head.appendChild(l);
  }
  if (!rc) rc = Purchases.configure({ apiKey: rcKey, appUserId: String(userId) });
  else if (typeof rc.changeUser === 'function') { try { await rc.changeUser(String(userId)); } catch (e) {} }
  return rc;
}
function isCancel(e) {
  if (!e) return false;
  const s = (String(e.errorCode != null ? e.errorCode : (e.code != null ? e.code : '')) + ' ' + (e.name || '') + ' ' + (e.message || '')).toLowerCase();
  return e.userCancelled === true || s.indexOf('cancel') >= 0;
}

/* ============ モーダルUI ============ */
function $(id) { return document.getElementById(id); }
function openModal(html) { const m = $('rc-modal'); if (!m) return; $('rc-modal-body').innerHTML = html; m.classList.add('open'); }
function closeModal() { const m = $('rc-modal'); if (m) m.classList.remove('open'); }
window.__rcClose = closeModal;

function esc(s) { return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function viewLogin(plan) {
  if (EN) return '<h3 class="rc-h">Sign in to subscribe</h3>'
    + '<p class="rc-p">You are subscribing to ' + esc(PLAN_LABEL[plan] || '') + '. We will email you a sign-in link (the same account works in the app).</p>'
    + '<input id="rc-email" class="rc-input" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com" />'
    + '<button id="rc-send" class="btn btn-grad rc-btn" data-plan="' + esc(plan) + '">Send sign-in link</button>'
    + '<p id="rc-msg" class="rc-msg"></p>'
    + '<button class="rc-x" data-rc-close aria-label="Close">×</button>';
  return viewLoginJa(plan);
}
function viewSent() {
  if (EN) return '<h3 class="rc-h">Email sent</h3>'
    + '<p class="rc-p">Open the link in the email to come back here and continue your purchase. If it does not arrive, please check your spam folder.</p>'
    + '<button class="btn btn-line rc-btn" data-rc-close>Close</button>';
  return viewSentJa();
}
function viewProcessing(t) {
  if (EN) return '<h3 class="rc-h">' + esc(t || 'Processing…') + '</h3><p class="rc-p">Please wait a moment.</p>';
  return viewProcessingJa(t);
}
function viewNotReady() {
  if (EN) return '<h3 class="rc-h">Coming soon</h3>'
    + '<p class="rc-p">Web checkout will open shortly. Please check back soon.</p>'
    + '<button class="btn btn-line rc-btn" data-rc-close>Close</button>';
  return viewNotReadyJa();
}
function viewDone(plan) {
  if (EN) {
    var isCoinEn = !!COIN_PACKAGES[plan];
    var noteEn = '<br><span style="opacity:.85">It applies to RELA (app / browser) signed in with the same account. If it takes a moment, reopen the app.<br>💡 To make sure it applies on every device and browser, we recommend registering an <b>email address and password</b> in the app under Settings → “Data transfer”.</span>';
    var bodyEn = isCoinEn ? (COIN_PACKAGES[plan] + ' coins have been added.' + noteEn) : (esc(PLAN_LABEL[plan] || '') + ' is now active.' + noteEn);
    return '<h3 class="rc-h">Thank you for your purchase</h3>'
      + '<p class="rc-p">' + bodyEn + '</p>'
      + '<a class="btn btn-grad rc-btn" href="https://rela.website/en/">Open RELA</a>';
  }
  return viewDoneJa(plan);
}
function viewError(msg) {
  if (EN) return '<h3 class="rc-h">Error</h3>'
    + '<p class="rc-p">' + esc(msg || 'We could not complete your purchase. Please try again later.') + '</p>'
    + '<button class="btn btn-line rc-btn" data-rc-close>Close</button>';
  return viewErrorJa(msg);
}
// 申込み最終確認画面(英語): 金額・無料期間・自動更新・解約期限/方法を購入確定前に表示
function viewConfirm(plan) {
  if (!EN) return viewConfirmJa(plan);
  var m = PLAN_META[plan] || {};
  var r = [];
  function row(k, v) { r.push('<div class="rc-row"><span>' + k + '</span><b>' + v + '</b></div>'); }
  row('Plan', esc(m.name || '') + (m.sub ? ' (monthly plan)' : ' (one-time purchase)'));
  row('Price', esc(m.price || '') + ' + applicable tax' + (m.sub ? ' / month' : ''));
  if (m.trial) {
    row('Free trial', 'First ' + m.trial + ' days free');
    row('First charge', 'After the free period ends (about ' + m.trial + ' days after sign-up)');
  } else if (m.sub) {
    row('First charge', 'At sign-up');
  }
  if (m.sub) {
    row('Renewal', 'Renews automatically every month until you cancel');
    row('Cancellation deadline', 'Up to 24 hours before the next renewal date');
    row('How to cancel', 'From the “Manage subscription” link (billing portal) in your purchase confirmation email.' + (m.trial ? ' Cancel during the free period and you will not be charged.' : ''));
  }
  row('Availability', 'Immediately after payment' + (m.trial ? ' (the trial starts at sign-up)' : ''));
  row('Refunds', 'Digital services and coins are generally non-refundable (see Legal Notice)');
  return '<h3 class="rc-h">Review your order</h3>'
    + '<div class="rc-terms">' + r.join('') + '</div>'
    + '<p class="rc-note">By pressing the button below, you '
    + (m.sub ? 'enter into a <b>paid, auto-renewing subscription</b>' : 'confirm your <b>purchase</b>') + ' on the terms above.</p>'
    + '<button id="rc-confirm" class="btn btn-grad rc-btn" data-plan-confirm="' + esc(plan) + '">Agree and subscribe</button>'
    + '<p class="rc-links"><a href="legal.html" target="_blank" rel="noopener">Legal Notice</a>　<a href="terms.html" target="_blank" rel="noopener">Terms of Service</a></p>'
    + '<button class="rc-x" data-rc-close aria-label="Close">×</button>';
}

/* ---- 日本語版(従来どおり・不変) ---- */
function viewLoginJa(plan) {
  return '<h3 class="rc-h">ログインして申し込む</h3>'
    + '<p class="rc-p">' + esc(PLAN_LABEL[plan] || '') + ' に申し込みます。メールアドレスへログインリンクを送ります（同じアカウントでアプリでも有効になります）。</p>'
    + '<input id="rc-email" class="rc-input" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com" />'
    + '<button id="rc-send" class="btn btn-grad rc-btn" data-plan="' + esc(plan) + '">ログインリンクを送る</button>'
    + '<p id="rc-msg" class="rc-msg"></p>'
    + '<button class="rc-x" data-rc-close aria-label="閉じる">×</button>';
}
function viewSentJa() {
  return '<h3 class="rc-h">メールを送りました</h3>'
    + '<p class="rc-p">メール内のリンクを開くと、この画面に戻って購入を続けられます。届かない場合は迷惑メールもご確認ください。</p>'
    + '<button class="btn btn-line rc-btn" data-rc-close>閉じる</button>';
}
function viewProcessingJa(t) { return '<h3 class="rc-h">' + esc(t || '処理中…') + '</h3><p class="rc-p">しばらくお待ちください。</p>'; }
function viewNotReadyJa() {
  return '<h3 class="rc-h">ただいま準備中です</h3>'
    + '<p class="rc-p">Web決済はまもなく開始します。少しお待ちください。</p>'
    + '<button class="btn btn-line rc-btn" data-rc-close>閉じる</button>';
}
function viewDoneJa(plan) {
  var isCoin = !!COIN_PACKAGES[plan];
  var reflectNote = '<br><span style="opacity:.85">同じアカウントでログインしたRELA（アプリ／ブラウザ）に反映されます。反映まで少し時間がかかる場合は、アプリを開き直してください。<br>💡 どの端末・ブラウザでも確実に反映させるには、アプリの設定「データの引継ぎ」で<b>メールアドレスとパスワードの登録</b>がおすすめです。</span>';
  var body = isCoin
    ? (COIN_PACKAGES[plan] + 'コインを付与しました。' + reflectNote)
    : (esc(PLAN_LABEL[plan] || '') + ' が有効になりました。' + reflectNote);
  return '<h3 class="rc-h">ご購入ありがとうございます</h3>'
    + '<p class="rc-p">' + body + '</p>'
    + '<a class="btn btn-grad rc-btn" href="https://rela.website/">RELAをひらく</a>';
}
function viewErrorJa(msg) {
  return '<h3 class="rc-h">エラー</h3>'
    + '<p class="rc-p">' + esc(msg || '購入を完了できませんでした。時間をおいて再度お試しください。') + '</p>'
    + '<button class="btn btn-line rc-btn" data-rc-close>閉じる</button>';
}
// 申込み最終確認画面（特商法：ボタン押下で課金契約が成立することを明示）
function viewConfirmJa(plan) {
  var m = PLAN_META[plan] || {};
  var r = [];
  function row(k, v) { r.push('<div class="rc-row"><span>' + k + '</span><b>' + v + '</b></div>'); }
  row('プラン', esc(m.name || '') + (m.sub ? '（月額プラン）' : '（単発購入）'));
  row('料金', esc(m.price || '') + '（税込）' + (m.sub ? ' ／ 月' : ''));
  if (m.trial) {
    row('無料お試し', '初回 ' + m.trial + '日間 無料');
    row('初回課金日', '無料期間の終了後（お申し込みから約 ' + m.trial + '日後）');
  } else if (m.sub) {
    row('初回課金', 'お申し込み時');
  }
  if (m.sub) {
    row('更新', '以後、毎月 自動更新（解約するまで継続）');
    row('解約期限', '次回更新日の 24時間前 まで');
    row('解約方法', '購入時の確認メール内「サブスクリプションの管理」リンク（決済管理ポータル）から。' + (m.trial ? '無料期間中に解約すれば料金は発生しません。' : ''));
  }
  row('提供時期', '決済完了後' + (m.trial ? '（お試しはお申し込み後）' : '') + '、ただちに利用可能');
  row('返金', 'デジタル役務・コインの性質上、原則不可（詳細は特商法表記）');
  return '<h3 class="rc-h">お申し込み内容の確認</h3>'
    + '<div class="rc-terms">' + r.join('') + '</div>'
    + '<p class="rc-note">下のボタンを押すと、上記の内容で'
    + (m.sub ? '<b>課金（自動更新サブスクリプション）契約が成立</b>します。' : '<b>購入が確定</b>します。') + '</p>'
    + '<button id="rc-confirm" class="btn btn-grad rc-btn" data-plan-confirm="' + esc(plan) + '">上記に同意して申し込む</button>'
    + '<p class="rc-links"><a href="tokushoho.html" target="_blank" rel="noopener">特定商取引法に基づく表記</a>　<a href="terms.html" target="_blank" rel="noopener">利用規約</a></p>'
    + '<button class="rc-x" data-rc-close aria-label="閉じる">×</button>';
}

/* ============ 購入フロー ============ */
async function runCheckout(plan) {
  if (!PLAN_LABEL[plan]) return;
  const user = await refreshUser();
  if (!user) { openModal(viewLogin(plan)); return; }
  // 未ログインでなければ、購入前に「申込み内容の最終確認」を必ず表示（特商法）
  openModal(viewConfirm(plan));
}
async function doPurchase(plan) {
  if (!PLAN_LABEL[plan]) return;
  openModal(viewProcessing(EN ? 'Preparing checkout…' : '購入手続きを準備中…'));
  const user = await refreshUser();
  if (!user) { openModal(viewLogin(plan)); return; }
  const inst = await ensureRC(user.id);
  if (!inst) { openModal(viewNotReady()); return; }
  try {
    // 英語版(/en/)は USD 価格の Offering を取得(RevenueCat Web商品に追加したUSD価格)。JPは従来どおり既定通貨。
    const offerings = EN ? await inst.getOfferings({ currency: 'USD' }) : await inst.getOfferings();
    const cur = offerings && offerings.current;
    const pkgs = (cur && cur.availablePackages) || [];
    const pkg = pkgs.find(p => p.identifier === plan);
    if (!pkg) { openModal(viewNotReady()); return; } // ダッシュボード未整備
    const result = await inst.purchase(EN ? { rcPackage: pkg, selectedLocale: 'en' } : { rcPackage: pkg });
    if (result && result.customerInfo) openModal(viewDone(plan));
    else openModal(viewError());
  } catch (e) {
    if (isCancel(e)) { closeModal(); return; }
    console.warn('[RELA] purchase failed', e);
    openModal(viewError());
  }
}

/* ============ イベント配線 ============ */
document.addEventListener('click', async (ev) => {
  const buyBtn = ev.target.closest ? ev.target.closest('[data-plan-buy]') : null;
  if (buyBtn) { ev.preventDefault(); runCheckout(buyBtn.getAttribute('data-plan-buy')); return; }

  // 申込み最終確認画面の「上記に同意して申し込む」→ 実際の購入へ
  const confirmBtn = ev.target.closest ? ev.target.closest('[data-plan-confirm]') : null;
  if (confirmBtn) { ev.preventDefault(); doPurchase(confirmBtn.getAttribute('data-plan-confirm')); return; }

  if (ev.target.id === 'rc-send') {
    const plan = ev.target.getAttribute('data-plan');
    const email = (($('rc-email') || {}).value || '').trim();
    const msg = $('rc-msg');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { if (msg) msg.textContent = EN ? 'Please enter a valid email address.' : 'メールアドレスを正しく入力してください。'; return; }
    ev.target.disabled = true; if (msg) msg.textContent = EN ? 'Sending…' : '送信中…';
    const err = await sendMagicLink(email, plan);
    if (err) { ev.target.disabled = false; if (msg) msg.textContent = EN ? 'Failed to send. Please try again later.' : '送信に失敗しました。時間をおいて再度お試しください。'; }
    else openModal(viewSent());
    return;
  }
  const closer = ev.target.closest ? ev.target.closest('[data-rc-close]') : null;
  if (closer) { closeModal(); return; }
  if (ev.target.id === 'rc-modal') closeModal(); // 背景クリックで閉じる
});

/* ============ 初期化: マジックリンク復帰後 ?checkout=plan で購入再開 ============ */
(async function init() {
  try {
    await ensureSupabase();
    const params = new URLSearchParams(location.search);
    const resume = params.get('checkout');
    await refreshUser();
    if (resume && !currentUser) currentUser = await waitForSession(3500);
    if (resume && currentUser) {
      history.replaceState(null, '', location.origin + location.pathname + '#plans');
      runCheckout(resume);
    }
  } catch (e) { /* 初期化失敗時もLPは通常表示のまま */ }
})();
