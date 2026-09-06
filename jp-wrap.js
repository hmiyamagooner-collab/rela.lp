/*
 * 日本語の改行を「読みやすい位置（文節）」に — BudouX(Google) で全ブラウザ対応。
 *  - 中央寄せの説明文・法務ページ本文を対象に、意味の切れ目で折り返す（スマホで特に効く）。
 *  - 対象要素の中身を <budoux-ja> でラップするだけ。Shadow DOM を使わないので
 *    中央寄せ・色・フォント等の継承はそのまま保たれる。
 *  - budoux-ja.min.js（JAモデル同梱・ローカル配置）を遅延読込し、定義後に適用。
 *  DB・認証・課金には一切触れない。
 */
(function () {
  // 中央寄せの説明文・法務本文で使われているクラス群 + 法務ページの段落/箇条書き
  var SELECTORS = [
    '.subline', '.tagline', '.webapp-lead', '.addhome-note', '.offer-text',
    '.p-note', '.get-note', '.ai-disclaimer', '.rd-sub', '.rd-lead',
    '.sec-sub', '.sec-lead', '.lead', '.note',
    '.doc p', '.doc li'
  ].join(',');
  // ラップ対象から除外（ボタン/ナビ/表/バッジ等、途中改行してほしくない・不要なもの）
  var SKIP = 'button,nav,.nav,table,.pill,.pills,.chip,.badge,.state,.ico';

  function hasJa(t) { return /[぀-ヿ一-鿿]/.test(t); }

  function wrap(el) {
    try {
      if (!el || (el.dataset && el.dataset.jpw)) return;
      if (el.closest && el.closest(SKIP)) return;
      if (el.querySelector && el.querySelector('budoux-ja')) return;
      var t = (el.textContent || '').trim();
      if (t.length < 8 || !hasJa(t)) return;   // 短文・非日本語は対象外
      el.dataset.jpw = '1';
      var w = document.createElement('budoux-ja');
      while (el.firstChild) w.appendChild(el.firstChild);
      el.appendChild(w);
    } catch (e) {}
  }

  function centered(el) {
    try { return getComputedStyle(el).textAlign === 'center'; } catch (e) { return false; }
  }

  function run() {
    try {
      document.querySelectorAll(SELECTORS).forEach(wrap);
      // 取りこぼし防止: 本文中の「中央寄せの段落」も対象にする
      document.querySelectorAll('main p, .stage p, section p').forEach(function (p) {
        if (centered(p)) wrap(p);
      });
    } catch (e) {}
  }

  function boot() {
    if (window.customElements && customElements.get('budoux-ja')) { run(); return; }
    if (window.customElements) { customElements.whenDefined('budoux-ja').then(run); }
  }

  // BudouX 本体（custom element <budoux-ja> を登録）を遅延読込 → 定義後に適用
  var s = document.createElement('script');
  s.src = 'budoux-ja.min.js';
  s.async = true;
  s.onload = boot;
  s.onerror = function () {};
  (document.head || document.documentElement).appendChild(s);
})();
