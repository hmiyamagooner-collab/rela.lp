(function () {
  var audio = document.getElementById("theme-audio");
  var btn = document.getElementById("theme-toggle");
  var stateEl = btn && btn.querySelector(".state");
  var icoEl = btn && btn.querySelector(".ico");
  if (!audio || !btn) return;

  var KEY = "rela-theme";
  try { localStorage.removeItem(KEY); } catch (e) {}
  var wanted = sessionStorage.getItem(KEY) !== "off"; // ユーザーが音楽を望むか
  var unlockBound = false;

  audio.loop = true;
  audio.autoplay = true;
  audio.volume = 0.72;
  audio.setAttribute("playsinline", "");
  audio.setAttribute("webkit-playsinline", "");

  // 実際に「音が鳴っている」か（再生中かつミュートでない）。ON/OFF表示はこれに従う。
  // ＝ミュート自動再生中は"鳴っていない"のでOFF表示にする（ONなのに無音＝不具合に見える対策）。
  function audible() { return wanted && !audio.muted && !audio.paused; }

  function paint() {
    var on = audible();
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.setAttribute(
      "aria-label",
      on
        ? "大切な人を、もっと深く理解するために OFF"
        : "大切な人を、もっと深く理解するために ON"
    );
    if (icoEl) icoEl.textContent = on ? "ON" : "OFF";
    if (stateEl) stateEl.textContent = on ? "ON" : "OFF";
  }

  function stopUnlock() {
    if (!unlockBound) return;
    document.removeEventListener("pointerdown", unlock, true);
    document.removeEventListener("touchstart", unlock, true);
    document.removeEventListener("click", unlock, true);
    document.removeEventListener("keydown", unlock, true);
    unlockBound = false;
  }

  function waitUnlock() {
    if (unlockBound || !wanted) return;
    unlockBound = true;
    document.addEventListener("pointerdown", unlock, true);
    document.addEventListener("touchstart", unlock, true);
    document.addEventListener("click", unlock, true);
    document.addEventListener("keydown", unlock, true);
  }

  function unlock(e) {
    if (!wanted) { stopUnlock(); return; }
    if (e && btn.contains(e.target)) return;
    audio.muted = false; // 初回のユーザー操作でミュート解除＝ここで音が出る
    attempt();
  }

  function attempt() {
    if (!wanted) return;
    var p = audio.play();
    if (p && p.then) {
      p.then(function () {
        paint();                 // 音が出ていればON表示になる
        if (audible()) stopUnlock();
      }).catch(function () {
        // 音付き自動再生がブロックされた → ミュートで再生を続けつつ、表示はOFFのまま。
        // 最初のタップ/クリック/キー操作で unlock() が muted=false にして音を出す。
        try { audio.muted = true; audio.play().catch(function () {}); } catch (e2) {}
        paint();                 // ミュート中＝鳴っていないのでOFF表示
        waitUnlock();
      });
    }
  }

  function play() {
    wanted = true;
    sessionStorage.setItem(KEY, "on");
    audio.muted = false;
    attempt();
    paint();
  }

  function pause() {
    wanted = false;
    sessionStorage.setItem(KEY, "off");
    audio.pause();
    stopUnlock();
    paint();
  }

  btn.addEventListener("click", function (e) {
    e.stopPropagation();
    if (audible()) pause();   // 鳴っている → 止める
    else play();              // OFF表示 → 鳴らす（ミュート解除して再生）
  });

  audio.addEventListener("play", paint);
  audio.addEventListener("pause", paint);
  audio.addEventListener("canplay", function () {
    if (wanted && audio.paused) attempt();
  });
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && wanted && audio.paused) attempt();
  });

  paint();          // 初期表示は「まだ鳴っていない」ので OFF
  if (wanted) attempt();
})();
