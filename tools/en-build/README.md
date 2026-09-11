# 英語版LP(/en/)の生成

`en/*.html` は日本語ページ(index/lp/partner/self/reading/karte/team)から **自動生成** します。直接編集せず、
翻訳データ `i18n/<page>.en.json`(原文→英訳。分断された段落は `__overrides`)を直してから再生成してください。

```
npm i -g jsdom   # 初回のみ(または npx --package jsdom)
node tools/en-build/build.js
```

- 日本語ページ側には言語切替リンク(EN)だけが追加されます(未追加なら自動で挿入)。
- 未訳が残ると実行結果に「未訳」として一覧表示されます。
- 料金は USD(Basic $4.99 / Standard $9.99 / Premium $24.99 / 180 coins $2.99)。購入モーダルの英語は `checkout.js` 内(`html lang="en"` で切替)。
- 法務ページは英語版(US向け)を `en/terms|privacy|legal|company.html` に生成する。本文は `legal/<名前>.html`(先頭の `<title>`/description + `<main>`)、器(ヘッダ/フッタ/BGM/スクリプト)は日本語版から流用。tokushoho は英語では `legal`(Legal Notice & Subscription Terms)。
- **Google Play の QR(英語トップ)**: 米国で正式ローンチするまで `config.json` の `playAvailable: false` → 「COMING SOON」帯付き・リンク無効で生成。ローンチしたら `true` にして再生成 → `en/index.html` をコミット。
- 言語の記憶は `lang.js`(localStorage `rela_lp_lang`)。トップ(/ と /en/)は記憶がなければ言語ゲート(index.html 内 `#langGate`)を出し、記憶と違う言語のトップに来たらもう一方へ移動する。下層ページは移動しない。`?lang=en|ja` で上書き可。
