/*
 * 流入元（UTM）計測 — LP（rela.info）共通スクリプト
 *  1. URL の utm_* を読み取り、初回接触(first touch)を localStorage `rela_utm` に固定（上書きしない）
 *  2. LP 内の rela.website への遷移リンクすべてに、保存済み utm_* をクエリで引き継ぐ
 *     （別ドメインで localStorage は共有されないため、URL が唯一の橋）
 *  DB・認証・課金には一切触れない。
 */
(function () {
  var KEY = 'rela_utm';
  var FIELDS = ['source', 'medium', 'campaign', 'content', 'term'];

  function clean(v) { return String(v).slice(0, 64).replace(/[^A-Za-z0-9_-]/g, ''); }

  function readFromUrl() {
    var p = new URLSearchParams(location.search);
    var out = {}, has = false;
    FIELDS.forEach(function (f) {
      var v = p.get('utm_' + f);
      if (v) { var c = clean(v); if (c) { out[f] = c; has = true; } }
    });
    return has ? out : null;
  }

  function store() {
    try {
      if (localStorage.getItem(KEY)) return; // first touch を正とし上書きしない
      var u = readFromUrl();
      if (!u) return; // utm が無ければ何もしない
      u.ts = new Date().toISOString();
      localStorage.setItem(KEY, JSON.stringify(u));
    } catch (e) {}
  }

  function getStored() {
    try { var s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; }
  }

  function applyTo(a, utm) {
    try {
      var url = new URL(a.getAttribute('href'), location.href);
      if (url.hostname.indexOf('rela.website') === -1) return;
      FIELDS.forEach(function (f) {
        if (utm[f] && !url.searchParams.has('utm_' + f)) url.searchParams.set('utm_' + f, utm[f]);
      });
      a.setAttribute('href', url.toString());
    } catch (e) {}
  }

  function decorate(node) {
    var utm = getStored();
    if (!utm) return;
    try {
      if (node.nodeType === 1 && node.matches && node.matches('a[href*="rela.website"]')) applyTo(node, utm);
      if (node.querySelectorAll) {
        node.querySelectorAll('a[href*="rela.website"]').forEach(function (a) { applyTo(a, utm); });
      }
    } catch (e) {}
  }

  function init() {
    store();
    decorate(document);
    // checkout.js 等が後から差し込む rela.website ボタンにも引き継ぐ
    try {
      new MutationObserver(function (muts) {
        muts.forEach(function (m) {
          (m.addedNodes || []).forEach(function (n) { if (n.nodeType === 1) decorate(n); });
        });
      }).observe(document.body, { childList: true, subtree: true });
    } catch (e) {}
  }

  store(); // DOM 構築前でも first touch を確実に取得
  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
