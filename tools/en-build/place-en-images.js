// assets/en/_inbox/ の英語スクショを、日本語版と同じファイル名に整えて assets/en/ へ配置する。
//   MAP: 入力ファイル → { out: 日本語版のファイル名, crop: [top, bottom](元画像の高さに対する割合で切り落とす) }
//   幅は日本語版の画像に合わせて縮小(アスペクトは維持)。jpeg 品質 82。
//   実行: node tools/en-build/place-en-images.js  (sharp は renai-crm/node_modules のものを使う)
const fs = require("fs"); const path = require("path");
const sharp = require("C:/Users/miyama/APP/renai-crm/node_modules/sharp");
const ROOT = path.resolve(__dirname, "..", ".."); const IN = path.join(ROOT, "assets", "en", "_inbox"); const OUT = path.join(ROOT, "assets", "en");
const MAP = {
  "S__50159644_0.jpg": { out: "ss-future.jpg" },                         // 未来ビジョン(生成画像)
  "S__50159645_0.jpg": { out: "ss-guardian.jpg" },                       // 守護神
  "S__50159646_0.jpg": { out: "ss-chakra.jpg" },                         // チャクラ分析
  "S__50159647_0.jpg": { out: "ss-shrine.jpg" },                         // 属性神社・守護神
  "S__50159648_0.jpg": { out: "ss-stone.jpg", crop: [0, 0.27] },         // 守護石(下の余白を落とす)
  "S__50159649_0.jpg": { out: "ss-face.jpg", crop: [0.05, 0] },          // 人相(上のステータスバーを落とす)
  "S__50159650_0.jpg": { out: "ss-palm.jpg", crop: [0, 0.52] },          // 手相(日本語の分析本文より上だけ)
  "S__50159651_0.jpg": { out: "ss-self-profile.jpg" },                   // プロフィール分析
  "S__50159652_0.jpg": { out: "ss-partner-hero.jpg" },                   // 相手カード
  "S__50159653_0.jpg": { out: "ss-partner-1.jpg", crop: [0.05, 0.19] },  // 相手詳細(ステータスバーと日本語の返信案を落とす)
  "S__50159655_0.jpg": { out: "ss-partner-2.jpg", crop: [0, 0.645] },    // 関係スコア(日本語の分析より上だけ)
  "S__50159656_0.jpg": { out: "ss-self-score.jpg" },                     // 今日のスコア
  "S__50159657_0.jpg": { out: "ss-biorhythm.jpg" },                      // 運気バイオリズム
  "S__50159658_0.jpg": { out: "karte-chakra2.jpg", crop: [0.06, 0.02] }, // 鑑定書: 12チャクラ解説(周囲の余白を落とす)
};
(async () => {
  for (const [src, cfg] of Object.entries(MAP)) {
    const f = path.join(IN, src); if (!fs.existsSync(f)) { console.log("skip(なし)", src); continue; }
    const ja = path.join(ROOT, "assets", cfg.out); const jm = fs.existsSync(ja) ? await sharp(ja).metadata() : null;
    const m = await sharp(f).metadata(); let img = sharp(f).rotate();
    if (cfg.crop) { const top = Math.round(m.height * cfg.crop[0]), bottom = Math.round(m.height * cfg.crop[1]); img = img.extract({ left: 0, top, width: m.width, height: m.height - top - bottom }); }
    const targetW = jm ? Math.min(jm.width, m.width) : m.width;
    const buf = await img.resize({ width: targetW }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    fs.writeFileSync(path.join(OUT, cfg.out), buf);
    const om = await sharp(buf).metadata();
    console.log(cfg.out.padEnd(22), om.width + "x" + om.height, "(JP " + (jm ? jm.width + "x" + jm.height : "-") + ")", Math.round(buf.length / 1024) + "KB");
  }
})();
