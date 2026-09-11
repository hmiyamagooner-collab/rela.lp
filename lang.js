/*
 * 言語の記憶(JP/EN) — LP(rela.info)共通スクリプト
 *  1. localStorage `rela_lp_lang` に 'ja' / 'en' を保存(トップの言語ゲート・言語切替リンク・?lang= で決まる)
 *  2. トップページ(/ と /en/)だけ: 保存された言語がページの言語と違えば、もう一方のトップへ移動する
 *     (下層ページや規約ページは共有リンクで開いた時に飛ばされないよう、移動しない)
 *  3. 言語切替リンク(.lang-sw / .nav-lang, lang属性=行き先の言語)のクリックで保存する
 *  DB・認証・課金には一切触れない。
 */
(function () {
  var KEY = 'rela_lp_lang';
  var page = (document.documentElement.getAttribute('lang') === 'en') ? 'en' : 'ja';
  function get() { try { var v = localStorage.getItem(KEY); return (v === 'en' || v === 'ja') ? v : null; } catch (e) { return null; } }
  function set(v) { if (v !== 'en' && v !== 'ja') return; try { localStorage.setItem(KEY, v); } catch (e) {} }

  // ?lang=en|ja が付いていれば、それを優先して保存(QRやシェアリンク用)
  var q = null;
  try { q = new URLSearchParams(location.search).get('lang'); } catch (e) {}
  if (q === 'en' || q === 'ja') set(q);

  var stored = get();
  var path = location.pathname.replace(/\/index(\.html)?$/, '/');
  var isTop = (path === '/' || path === '/en/' || path === '/en');
  var redirected = false;
  if (isTop && stored && stored !== page && q !== page) {
    var dest = (stored === 'en') ? '/en/' : '/';
    try {
      document.documentElement.style.visibility = 'hidden';   // 移動までの一瞬のちらつきを抑える
      location.replace(dest + location.search + location.hash);
      redirected = true;
    } catch (e) { document.documentElement.style.visibility = ''; }
  }

  // 言語切替リンクのクリックで記憶(捕捉フェーズ: 遷移前に確実に保存)
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var a = t.closest('a.lang-sw, a.nav-lang, [data-lang-choice]');
    if (!a) return;
    var l = a.getAttribute('data-lang-choice') || a.getAttribute('lang');
    if (l === 'en' || l === 'ja') set(l);
  }, true);

  window.RELA_LANG = { get: get, set: set, page: page, redirected: redirected, isTop: isTop };
})();
