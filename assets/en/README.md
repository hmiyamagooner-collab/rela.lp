# 英語LP用の画像(assets/en/)

`assets/en/<日本語版と同じファイル名>` を置くと、`tools/en-build/build.js` が英語ページ(`en/*.html`)だけ
その画像に差し替えます。日本語ページは一切変わりません。

## 使い方
1. 英語モードのスクショを `assets/en/_inbox/` に入れる(ファイル名は何でもよい)
2. Claude が中身を見て、対応する日本語版のファイル名(下表)にリネーム・リサイズして `assets/en/` に配置
3. `node tools/en-build/build.js` → `en/` をコミット

## 日本語版の画像と、英語版で撮る画面
| ファイル名 | 画面 | サイズ(px) |
|---|---|---|
| ss-partner-hero.jpg | 相手カード(リスト) | 920x754 |
| ss-partner-1.jpg / ss-partner-2.jpg | 相手詳細(スクショ分析・記録) / 関係スコア | 各 元画像に合わせる |
| ss-self-profile.jpg | プロフィール分析(属性/星座/四柱…) | |
| ss-self-score.jpg | 今日のRELAスコア | |
| ss-biorhythm.jpg | 運気バイオリズム | 853x1710 |
| ss-chakra.jpg | チャクラ分析(生成画像) | |
| ss-energy.jpg | エネルギーカラー(生成画像) | |
| ss-guardian.jpg | 守護神(生成画像) | |
| ss-future.jpg | 未来ビジョン(生成画像) | |
| ss-shrine.jpg | 属性神社・守護神 | |
| ss-stone.jpg | 守護石 | |
| ss-palm.jpg | 手相 | |
| ss-face.jpg | 人相 | |
| ss-team.jpg / ss-team-2.jpg | チーム分析 | |
| ss-add-1.jpg 〜 ss-add-3.jpg | Instagram内ブラウザ→「ブラウザで開く」手順 | 480x988 |
| karte-cover2.jpg 〜 karte-back2.jpg | 鑑定書(表紙/属性/手相/チャクラ/バイオリズム/自己分析/神社/裏表紙) | 720x1044 |

`_inbox/` は作業用なので、配置が終わったら空にしてよい(ビルドには使われない)。
