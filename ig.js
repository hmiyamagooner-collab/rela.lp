/*
 * Instagram DM(Manychat)流入 — 英語トップ(/en/)専用スクリプト(rela-lp)
 *  Manychat からのリンク: /en/?lang=en&utm_source=instagram&utm_medium=dm&utm_campaign=us_launch&utm_content=<intent>
 *  intent は relationship | self | someone の3値だけを受け付け、それ以外・無指定は何もしない(通常の英語トップのまま)。
 *  1. 見出し・サブ文・メインCTAの文言を intent に合わせて差し替える(textContent/createElement で描画。URLの値をHTMLへ出力しない)
 *  2. オープニング(第一幕)を省略する(window.RELA_IG_SKIP_INTRO を index.html のオープニング制御が参照)
 *  3. 保存は一切しない(utm.js の first-touch と衝突させない)。アプリへの引き継ぎは utm.js が utm_content として行う。
 *  日本語ページでは html の lang 属性が ja のため即終了する。DB・認証・課金には触れない。
 */
(function () {
  if (document.documentElement.getAttribute('lang') !== 'en') return;
  var INTENTS = {
    relationship: {
      h1: [['Discover', true], [" what's really happening ", false], ['between you two', true], ['.', false]],
      sub: 'Understand your relationship through AI × Psychology × Astrology',
      cta: 'Start Free'
    },
    self: {
      h1: [['Understand yourself', true], [' on a deeper level.', false]],
      sub: 'Discover your personality, patterns and energy.',
      cta: 'Discover Myself'
    },
    someone: {
      h1: [['Understand someone', true], [' important to you.', false]],
      sub: 'Explore their personality, tendencies and compatibility.',
      cta: 'Understand Someone'
    }
  };
  var v = null;
  try { v = new URLSearchParams(location.search).get('utm_content'); } catch (e) {}
  if (!v || !Object.prototype.hasOwnProperty.call(INTENTS, v)) return;   // allowlist 外は通常表示
  var t = INTENTS[v];
  window.RELA_IG_SKIP_INTRO = true;   // DM流入はオープニングを飛ばして本題へ
  window.RELA_IG_INTENT = v;
  function apply() {
    try {
      var h1 = document.querySelector('main h1.seq.s1');
      if (h1) {
        while (h1.firstChild) h1.removeChild(h1.firstChild);
        t.h1.forEach(function (part) {
          var node;
          if (part[1]) { node = document.createElement('span'); node.className = 'big'; node.textContent = part[0]; }
          else node = document.createTextNode(part[0]);
          h1.appendChild(node);
        });
      }
      var sub = document.querySelector('main p.subline');
      if (sub) sub.textContent = t.sub;
      var cta = document.querySelector('main a.btn.btn-glow[href*="rela.website"]');
      if (cta) cta.textContent = t.cta;
      document.body.classList.add('ig-dm');
    } catch (e) {}
  }
  if (document.readyState !== 'loading') apply();
  else document.addEventListener('DOMContentLoaded', apply);
})();
