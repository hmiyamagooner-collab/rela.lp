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
const PLAN_LABEL = {
  basic: 'BASIC（¥500/月）',
  standard: 'STANDARD（¥1,500/月）',
  premium: 'PREMIUM（¥3,800/月）'
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
  return '<h3 class="rc-h">ログインして購入</h3>'
    + '<p class="rc-p">' + esc(PLAN_LABEL[plan] || '') + ' を購入します。メールにログインリンクを送ります（同じアカウントでアプリでも有効になります）。</p>'
    + '<input id="rc-email" class="rc-input" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com" />'
    + '<button id="rc-send" class="btn btn-grad rc-btn" data-plan="' + esc(plan) + '">ログインリンクを送る</button>'
    + '<p id="rc-msg" class="rc-msg"></p>'
    + '<button class="rc-x" data-rc-close aria-label="閉じる">×</button>';
}
function viewSent() {
  return '<h3 class="rc-h">メールを送りました</h3>'
    + '<p class="rc-p">メール内のリンクを開くと、この画面に戻って購入を続けられます。届かない場合は迷惑メールもご確認ください。</p>'
    + '<button class="btn btn-line rc-btn" data-rc-close>閉じる</button>';
}
function viewProcessing(t) { return '<h3 class="rc-h">' + esc(t || '処理中…') + '</h3><p class="rc-p">しばらくお待ちください。</p>'; }
function viewNotReady() {
  return '<h3 class="rc-h">ただいま準備中です</h3>'
    + '<p class="rc-p">Web決済はまもなく開始します。少しお待ちください。</p>'
    + '<button class="btn btn-line rc-btn" data-rc-close>閉じる</button>';
}
function viewDone(plan) {
  return '<h3 class="rc-h">ご購入ありがとうございます</h3>'
    + '<p class="rc-p">' + esc(PLAN_LABEL[plan] || '') + ' が有効になりました。<br>同じアカウントでアプリからそのままご利用いただけます。</p>'
    + '<a class="btn btn-grad rc-btn" href="https://rela.website/">RELAをひらく</a>';
}
function viewError(msg) {
  return '<h3 class="rc-h">エラー</h3>'
    + '<p class="rc-p">' + esc(msg || '購入を完了できませんでした。時間をおいて再度お試しください。') + '</p>'
    + '<button class="btn btn-line rc-btn" data-rc-close>閉じる</button>';
}

/* ============ 購入フロー ============ */
async function runCheckout(plan) {
  if (!PLAN_LABEL[plan]) return;
  const user = await refreshUser();
  if (!user) { openModal(viewLogin(plan)); return; }
  openModal(viewProcessing('購入手続きを準備中…'));
  const inst = await ensureRC(user.id);
  if (!inst) { openModal(viewNotReady()); return; }
  try {
    const offerings = await inst.getOfferings();
    const cur = offerings && offerings.current;
    const pkgs = (cur && cur.availablePackages) || [];
    const pkg = pkgs.find(p => p.identifier === plan);
    if (!pkg) { openModal(viewNotReady()); return; } // ダッシュボード未整備
    const result = await inst.purchase({ rcPackage: pkg });
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

  if (ev.target.id === 'rc-send') {
    const plan = ev.target.getAttribute('data-plan');
    const email = (($('rc-email') || {}).value || '').trim();
    const msg = $('rc-msg');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { if (msg) msg.textContent = 'メールアドレスを正しく入力してください。'; return; }
    ev.target.disabled = true; if (msg) msg.textContent = '送信中…';
    const err = await sendMagicLink(email, plan);
    if (err) { ev.target.disabled = false; if (msg) msg.textContent = '送信に失敗しました。時間をおいて再度お試しください。'; }
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
