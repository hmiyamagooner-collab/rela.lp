// rela-lp の日本語ページから英語版(/en/*.html)を生成する。
//   翻訳は lp_i18n/<page>.en.json(原文→英訳)。分断された段落は __overrides(要素の innerHTML 差し替え)。
//   生成物は rela-lp/en/ に出力。日本語ページには言語切替リンク(EN)だけを追加する。
const fs = require("fs"); const path = require("path"); const { JSDOM } = require("jsdom");
const ROOT = path.resolve(__dirname, "..", ".."); const OUT = path.join(ROOT, "en"); fs.mkdirSync(OUT, { recursive: true });
const I18N = path.join(__dirname, "i18n");
const PAGES = ["index", "lp", "partner", "self", "reading", "karte", "team"];
const LEGAL = ["terms", "privacy", "tokushoho", "company"];
const ja = /[぀-ヿ一-鿿]/;
const norm = s => s.replace(/\s+/g, " ").trim();
const EN_QR = fs.readFileSync(path.join(__dirname, "qr_en_lp.svg"), "utf8");
const report = {};

function deepestContaining(doc, text) {
  let best = null;
  doc.querySelectorAll("p,li,div,h1,h2,h3,h4,span,dd,dt,a,button,small,figcaption").forEach(el => {
    if (el.textContent.includes(text) && (!best || el.textContent.length <= best.textContent.length)) best = el;
  });
  return best;
}

for (const pg of PAGES) {
  const src = fs.readFileSync(path.join(ROOT, pg + ".html"), "utf8");
  const map = JSON.parse(fs.readFileSync(path.join(I18N, pg + ".en.json"), "utf8"));
  const overrides = map.__overrides || []; delete map.__overrides;
  const dom = new JSDOM(src); const doc = dom.window.document;
  const missing = new Set(); let hits = 0;

  // 1) 要素単位の差し替え(分断された段落)
  for (const o of overrides) {
    const el = o.selector ? doc.querySelector(o.selector) : deepestContaining(doc, o.contains);
    if (!el) { console.warn(`[${pg}] override not found: ${o.contains || o.selector}`); continue; }
    el.innerHTML = o.html; hits++;
  }
  // 2) テキストノード
  const walker = doc.createTreeWalker(doc.body, 4); const nodes = []; let n;
  while ((n = walker.nextNode())) nodes.push(n);
  for (const node of nodes) {
    const p = node.parentNode; if (!p || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(p.nodeName)) continue;
    const raw = node.nodeValue; const key = norm(raw); if (!key) continue;
    if (Object.prototype.hasOwnProperty.call(map, key)) {
      const lead = raw.match(/^\s*/)[0], trail = raw.match(/\s*$/)[0];
      node.nodeValue = lead + map[key] + trail; hits++;
    } else if (ja.test(key)) missing.add(key);
  }
  // 3) 属性
  doc.querySelectorAll("[alt],[aria-label],[placeholder],[title]").forEach(el => ["alt", "aria-label", "placeholder", "title"].forEach(a => {
    if (!el.hasAttribute(a)) return; const v = el.getAttribute(a); const k = norm(v);
    if (Object.prototype.hasOwnProperty.call(map, k)) { el.setAttribute(a, map[k]); hits++; } else if (ja.test(k)) missing.add(k);
  }));
  // 4) title / meta
  const t = doc.querySelector("title"); if (t && map[norm(t.textContent)]) t.textContent = map[norm(t.textContent)];
  doc.querySelectorAll("meta[name='description'], meta[property^='og:'], meta[name^='twitter:']").forEach(m => {
    const v = m.getAttribute("content") || ""; const k = norm(v);
    if (Object.prototype.hasOwnProperty.call(map, k)) m.setAttribute("content", map[k]); else if (ja.test(k)) missing.add(k);
  });
  const setMeta = (sel, val) => { const m = doc.querySelector(sel); if (m) m.setAttribute("content", val); };
  setMeta("meta[property='og:locale']", "en_US");
  setMeta("meta[property='og:image']", "https://rela.info/assets/og-en.png");
  setMeta("meta[name='twitter:image']", "https://rela.info/assets/og-en.png");
  const enUrl = "https://rela.info/en/" + (pg === "index" ? "" : pg);
  const jaUrl = "https://rela.info/" + (pg === "index" ? "" : pg);
  setMeta("meta[property='og:url']", enUrl);
  const head = doc.querySelector("head");
  head.querySelectorAll("link[rel='canonical'],link[rel='alternate'][hreflang]").forEach(e => e.remove());
  head.insertAdjacentHTML("beforeend", `\n<link rel="canonical" href="${enUrl}">\n<link rel="alternate" hreflang="en" href="${enUrl}">\n<link rel="alternate" hreflang="ja" href="${jaUrl}">\n<link rel="alternate" hreflang="x-default" href="${jaUrl}">\n`);
  doc.documentElement.setAttribute("lang", "en");
  // 5) 日本語専用スクリプト(文節改行)は外す
  doc.querySelectorAll("script[src]").forEach(s => { const v = s.getAttribute("src"); if (/budoux-ja|jp-wrap/.test(v)) s.remove(); });
  // 6) パス書き換え(en/ 配下から親のアセット/共通JS/CSSを参照。ページ間リンクは英語版へ、法務ページは日本語版へ)
  const fixPath = (v) => {
    if (!v) return v;
    if (/^(https?:|mailto:|tel:|#|data:|\/)/.test(v)) {
      if (v === "https://rela.website/") return "https://rela.website/en/";
      if (v.startsWith("https://rela.website/?")) return "https://rela.website/en/" + v.slice("https://rela.website/".length);
      return v;
    }
    let m = v.match(/^\.?\/?([a-z]+)\.html(#.*)?$/) || v.match(/^\.?\/?(lp|index)(#.*)?$/);
    if (m) { const name = m[1], hash = m[2] || ""; if (PAGES.includes(name)) return "./" + name + ".html" + hash; if (LEGAL.includes(name)) return "../" + name + ".html" + hash; }
    if (/^(assets\/|theme\.css|sweep\.css|legal\.css|theme\.js|utm\.js|checkout\.js|budoux-ja\.min\.js|jp-wrap\.js)/.test(v)) return "../" + v;
    return v;
  };
  doc.querySelectorAll("[href],[src],[poster]").forEach(el => ["href", "src", "poster"].forEach(a => { if (el.hasAttribute(a)) el.setAttribute(a, fixPath(el.getAttribute(a))); }));
  doc.querySelectorAll("[style]").forEach(el => { const s = el.getAttribute("style"); if (/url\((['"]?)assets\//.test(s)) el.setAttribute("style", s.replace(/url\((['"]?)assets\//g, "url($1../assets/")); });
  doc.querySelectorAll("style").forEach(st => { st.textContent = st.textContent.replace(/url\((['"]?)assets\//g, "url($1../assets/"); });
  // 7) 言語切替(日本語へ)
  if (pg === "index") {
    doc.body.insertAdjacentHTML("afterbegin", `<a href="/" class="lang-sw" lang="ja" style="position:fixed;top:18px;left:18px;z-index:60;padding:8px 14px;border-radius:999px;border:1px solid rgba(120,200,255,.45);background:rgba(8,13,28,.7);color:#dfe6f5;font-size:12.5px;font-weight:700;text-decoration:none;letter-spacing:.06em">日本語</a>`);
  } else {
    const nl = doc.getElementById("nav-links"); if (nl) nl.insertAdjacentHTML("afterbegin", `<a href="${pg === "lp" ? "/lp" : "/" + pg}" class="nav-lang" lang="ja">日本語</a>`);
  }
  // 8) index: 英語版プラン画面へのQRに差し替え(1枚目のカード)
  if (pg === "index") {
    const qr = doc.querySelector(".get-card .get-qr"); if (qr) qr.innerHTML = EN_QR;
  }
  const out = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
  fs.writeFileSync(path.join(OUT, pg + ".html"), out);
  report[pg] = { hits, missing: [...missing] };
}
// 日本語ページ: 言語切替リンク(EN)を追加(未追加なら)
for (const pg of PAGES) {
  const f = path.join(ROOT, pg + ".html"); let s = fs.readFileSync(f, "utf8");
  if (s.includes('class="lang-sw"') || s.includes('class="nav-lang"')) continue;
  if (pg === "index") {
    s = s.replace("<main", `<a href="/en/" class="lang-sw" lang="en" style="position:fixed;top:18px;left:18px;z-index:60;padding:8px 14px;border-radius:999px;border:1px solid rgba(120,200,255,.45);background:rgba(8,13,28,.7);color:#dfe6f5;font-size:12.5px;font-weight:700;text-decoration:none;letter-spacing:.06em">EN</a>\n<main`);
  } else {
    s = s.replace('<div class="nav-links" id="nav-links">', `<div class="nav-links" id="nav-links"><a href="${pg === "lp" ? "/en/lp" : "/en/" + pg}" class="nav-lang" lang="en">English</a>`);
  }
  fs.writeFileSync(f, s);
}
for (const pg of PAGES) console.log(pg, "置換", report[pg].hits, "件 / 未訳", report[pg].missing.length, report[pg].missing.length ? "\n   " + report[pg].missing.slice(0, 12).join("\n   ") : "");
