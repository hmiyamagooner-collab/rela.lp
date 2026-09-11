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
- 法務ページ(terms/privacy/tokushoho/company)は日本語版へリンク(英語版は法務レビュー後に作成)。
