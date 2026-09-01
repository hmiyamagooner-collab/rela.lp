# RELA LP

RELA（リラ）の **Web販売** 用ランディングページ（静的サイト）。
App Store（Apple）での公開は廃止。販売の本線は Web（`https://rela-ai.vercel.app`）。Android は Google Play も継続。

- `index.html` … ヒーロー（指定デザイン）
- `lp.html` … できること・料金・FAQ
- `privacy.html` / `terms.html` / `tokushoho.html` / `company.html` … 法務・会社情報

アプリ本体（`rela-ai`）とは別の Vercel プロジェクトで公開します。

## 決済について
決済は **アプリ本体（`rela-ai`）内で完結**します。
- Web（ブラウザ）: RevenueCat **Web Billing**（Stripe）による、アプリ内でのクレジットカード決済
- ネイティブ: iOS=App Store / Android=Google Play のアプリ内課金（RevenueCat）

課金の真実の源は RevenueCat に一元化しており、プラン・コインはすべて RevenueCat の
entitlement / 仮想通貨(RLC) で管理します。**このLP側に決済導線・Webhookは持ちません**
（料金プランのボタンはアプリ `rela-ai.vercel.app` へ誘導するのみ）。

> 旧構成メモ: 以前は本LPに自前の Stripe Payment Link + Webhook（`buy.js` /
> `api/stripe-webhook.js` / `lib/plan-config.js`）を置いていたが、RevenueCat に
> 接続されておらず実効が無かったため撤去。決済はアプリ側の Web Billing に一本化した。
