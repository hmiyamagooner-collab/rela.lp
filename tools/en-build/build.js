// rela-lp の日本語ページから英語版(/en/*.html)を生成する。
//   翻訳は lp_i18n/<page>.en.json(原文→英訳)。分断された段落は __overrides(要素の innerHTML 差し替え)。
//   生成物は rela-lp/en/ に出力。日本語ページには言語切替リンク(EN)だけを追加する。
const fs = require("fs"); const path = require("path"); const { JSDOM } = require("jsdom");
const ROOT = path.resolve(__dirname, "..", ".."); const OUT = path.join(ROOT, "en"); fs.mkdirSync(OUT, { recursive: true });
const I18N = path.join(__dirname, "i18n");
const PAGES = ["index", "lp", "partner", "self", "reading", "karte", "team"];
const LEGAL = ["terms", "privacy", "tokushoho", "company"];
// 英語法務ページ: 出力名 → 日本語の器(ヘッダ/フッタ/スクリプトを流用)。本文は legal/<出力名>.html(先頭に <title> と description)
const LEGAL_EN = { terms: "terms", privacy: "privacy", legal: "tokushoho", company: "company" };
const legalEnName = (ja) => Object.keys(LEGAL_EN).find(k => LEGAL_EN[k] === ja) || ja;
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
  doc.querySelectorAll(".lang-sw, .nav-lang").forEach(e => e.remove());   // 日本語ページ側の言語切替(EN)は複製しない

  // 1) 要素単位の差し替え(分断された段落)
  for (const o of overrides) {
    const els = o.selector ? (o.all ? [...doc.querySelectorAll(o.selector)] : [doc.querySelector(o.selector)].filter(Boolean)) : [deepestContaining(doc, o.contains)].filter(Boolean);
    if (!els.length) { console.warn(`[${pg}] override not found: ${o.contains || o.selector}`); continue; }
    for (const el of els) {
      if (typeof o.html === "string") el.innerHTML = o.html;                                   // 中身の差し替え
      if (o.attrs) for (const [k, v] of Object.entries(o.attrs)) el.setAttribute(k, v);       // 属性の上書き(style/d 等)
      hits++;
    }
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
    if (m) { const name = m[1], hash = m[2] || ""; if (PAGES.includes(name)) return "./" + name + ".html" + hash; if (LEGAL.includes(name)) return "./" + legalEnName(name) + ".html" + hash; }
    if (/^(assets\/|theme\.css|sweep\.css|legal\.css|theme\.js|utm\.js|lang\.js|checkout\.js|budoux-ja\.min\.js|jp-wrap\.js)/.test(v)) return "../" + v;
    return v;
  };
  doc.querySelectorAll("[href],[src],[poster]").forEach(el => ["href", "src", "poster"].forEach(a => { if (el.hasAttribute(a)) el.setAttribute(a, fixPath(el.getAttribute(a))); }));
  // 6b) 英語版の画像: assets/en/<同名> が存在すればそちらを使う(アプリ画面の英語スクショ等)。無ければ日本語版の画像のまま
  const enImg = (v) => { const m = v && v.match(/^\.\.\/assets\/([^/?#]+)$/); if (m && fs.existsSync(path.join(ROOT, "assets", "en", m[1]))) { swapped.add(m[1]); return "../assets/en/" + m[1]; } return v; };
  const swapped = new Set();
  doc.querySelectorAll("img[src],video[poster],source[src]").forEach(el => ["src", "poster"].forEach(a => { if (el.hasAttribute(a)) el.setAttribute(a, enImg(el.getAttribute(a))); }));
  doc.querySelectorAll("a[href]").forEach(el => el.setAttribute("href", enImg(el.getAttribute("href"))));   // 拡大表示リンク(鑑定書カード等)も英語画像へ
  doc.querySelectorAll("img[srcset]").forEach(el => el.setAttribute("srcset", el.getAttribute("srcset").split(",").map(p => { const [u, d] = p.trim().split(/\s+/); return [enImg(u), d].filter(Boolean).join(" "); }).join(", ")));
  const swapUrl = (css) => css.replace(/url\((['"]?)(?:\.\.\/)?assets\/([^'")]+)\1\)/g, (m0, q, f) => fs.existsSync(path.join(ROOT, "assets", "en", f)) ? (swapped.add(f), "url(" + q + "../assets/en/" + f + q + ")") : m0);
  doc.querySelectorAll("[style]").forEach(el => el.setAttribute("style", swapUrl(el.getAttribute("style"))));
  doc.querySelectorAll("style").forEach(st => { st.textContent = swapUrl(st.textContent); });
  if (swapped.size) console.log("  [" + pg + "] 英語画像に差し替え:", [...swapped].join(", "));
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
// ---- 英語法務ページ(en/terms, privacy, legal, company): 日本語ページの器 + legal/*.html の本文 ----
const idxMap = JSON.parse(fs.readFileSync(path.join(I18N, "index.en.json"), "utf8"));
for (const [enName, jaName] of Object.entries(LEGAL_EN)) {
  const frag = fs.readFileSync(path.join(__dirname, "legal", enName + ".html"), "utf8");
  const title = (frag.match(/<title>([\s\S]*?)<\/title>/) || [, ""])[1];
  const desc = (frag.match(/<meta name="description" content="([^"]*)">/) || [, ""])[1];
  const mainHtml = (frag.match(/<main[\s\S]*<\/main>/) || [""])[0];
  if (!title || !mainHtml) throw new Error("legal fragment invalid: " + enName);
  const src = fs.readFileSync(path.join(ROOT, jaName + ".html"), "utf8");
  const dom = new JSDOM(src); const doc = dom.window.document;
  doc.querySelectorAll(".lang-sw, .nav-lang").forEach(e => e.remove());
  const main = doc.querySelector("main"); if (!main) throw new Error("main not found: " + jaName);
  main.outerHTML = mainHtml;
  const t = doc.querySelector("title"); if (t) t.innerHTML = title;
  const md = doc.querySelector("meta[name='description']"); if (md) md.setAttribute("content", desc);
  // ナビ: 「トップへ戻る」→ Back to top + 日本語版へのリンク
  doc.querySelectorAll("nav a").forEach(a => { if (norm(a.textContent) === "トップへ戻る") a.outerHTML = `<span class="nav-r"><a href="../${jaName}.html" class="nav-lang" lang="ja">日本語</a><a href="index.html">Back to top</a></span>`; });
  // 共通部品(BGMボタン等)の文言は index の辞書で置換
  const walker = doc.createTreeWalker(doc.body, 4); const nodes = []; let n;
  while ((n = walker.nextNode())) nodes.push(n);
  for (const node of nodes) { const p = node.parentNode; if (!p || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(p.nodeName) || p.closest("main")) continue; const k = norm(node.nodeValue); if (k && idxMap[k]) node.nodeValue = node.nodeValue.replace(k, idxMap[k]); }
  doc.querySelectorAll("body [alt],body [aria-label]").forEach(el => ["alt", "aria-label"].forEach(a => { if (el.closest("main")) return; const k = norm(el.getAttribute(a) || ""); if (k && idxMap[k]) el.setAttribute(a, idxMap[k]); }));
  const enUrl = "https://rela.info/en/" + enName, jaUrl = "https://rela.info/" + jaName;
  const head = doc.querySelector("head");
  head.querySelectorAll("link[rel='canonical'],link[rel='alternate'][hreflang]").forEach(e => e.remove());
  head.insertAdjacentHTML("beforeend", `\n<link rel="canonical" href="${enUrl}">\n<link rel="alternate" hreflang="en" href="${enUrl}">\n<link rel="alternate" hreflang="ja" href="${jaUrl}">\n<link rel="alternate" hreflang="x-default" href="${jaUrl}">\n`);
  doc.documentElement.setAttribute("lang", "en");
  doc.querySelectorAll("script[src]").forEach(sc => { const v = sc.getAttribute("src"); if (/budoux-ja|jp-wrap/.test(v)) sc.remove(); });
  const fixLegalPath = (v) => {
    if (!v) return v;
    if (/^(https?:|mailto:|tel:|#|data:|\/)/.test(v)) return v;
    if (/^\.\.\//.test(v)) return v;                                  // 本文中の日本語版リンク(../terms.html 等)はそのまま
    let m = v.match(/^\.?\/?([a-z]+)\.html(#.*)?$/);
    if (m) { const name = m[1], hash = m[2] || ""; if (name === "index") return "./index.html" + hash; if (LEGAL.includes(name)) return "./" + legalEnName(name) + ".html" + hash; if (Object.keys(LEGAL_EN).includes(name)) return "./" + name + ".html" + hash; }
    if (/^(assets\/|theme\.css|sweep\.css|legal\.css|theme\.js|utm\.js|lang\.js|checkout\.js)/.test(v)) return "../" + v;
    return v;
  };
  doc.querySelectorAll("[href],[src]").forEach(el => ["href", "src"].forEach(a => { if (el.hasAttribute(a)) el.setAttribute(a, fixLegalPath(el.getAttribute(a))); }));
  fs.writeFileSync(path.join(OUT, enName + ".html"), "<!DOCTYPE html>\n" + doc.documentElement.outerHTML);
  console.log("legal", enName, "生成");
}
// 日本語法務ページ: ナビに英語版リンク(未追加なら)
for (const jaName of LEGAL) {
  const f = path.join(ROOT, jaName + ".html"); let s = fs.readFileSync(f, "utf8");
  if (s.includes('class="nav-lang"')) continue;
  const a = '<a href="index.html">トップへ戻る</a>';
  if (s.split(a).length - 1 !== 1) { console.warn("nav anchor not unique:", jaName); continue; }
  s = s.replace(a, `<span class="nav-r"><a href="/en/${legalEnName(jaName)}" class="nav-lang" lang="en">English</a>${a}</span>`);
  fs.writeFileSync(f, s);
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
