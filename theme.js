(function () {
  var audio = document.getElementById("theme-audio");
  var btn = document.getElementById("theme-toggle");
  var stateEl = btn && btn.querySelector(".state");
  var icoEl = btn && btn.querySelector(".ico");
  if (!audio || !btn) return;

  var KEY = "rela-theme";
  var wanted = localStorage.getItem(KEY) !== "off";
  var unlockBound = false;

  audio.loop = true;
  audio.volume = 0.72;
  audio.setAttribute("playsinline", "");

  function paint(on) {
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.setAttribute("aria-label", on ? "テーマソング OFF" : "テーマソング ON");
    if (icoEl) icoEl.textContent = on ? "ON" : "OFF";
    if (stateEl) stateEl.textContent = on ? "ON" : "OFF";
  }

  function stopUnlock() {
    if (!unlockBound) return;
    document.removeEventListener("pointerdown", unlock, true);
    document.removeEventListener("keydown", unlock, true);
    unlockBound = false;
  }

  function waitUnlock() {
    if (unlockBound) return;
    unlockBound = true;
    document.addEventListener("pointerdown", unlock, true);
    document.addEventListener("keydown", unlock, true);
  }

  function unlock(e) {
    if (e && btn.contains(e.target)) return;
    if (!wanted) {
      stopUnlock();
      return;
    }
    audio.play().then(function () {
      paint(true);
      stopUnlock();
    }).catch(function () {});
  }

  function play() {
    wanted = true;
    localStorage.setItem(KEY, "on");
    paint(true);
    return audio.play().then(function () {
      stopUnlock();
    }).catch(function () {
      waitUnlock();
    });
  }

  function pause() {
    wanted = false;
    localStorage.setItem(KEY, "off");
    audio.pause();
    paint(false);
    stopUnlock();
  }

  btn.addEventListener("click", function (e) {
    e.stopPropagation();
    if (wanted) pause();
    else play();
  });

  if (wanted) {
    paint(true);
    play();
  } else {
    paint(false);
  }
})();
