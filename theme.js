(function () {
  var audio = document.getElementById("theme-audio");
  var btn = document.getElementById("theme-toggle");
  var stateEl = btn && btn.querySelector(".state");
  var icoEl = btn && btn.querySelector(".ico");
  if (!audio || !btn) return;

  var KEY = "rela-theme";
  try { localStorage.removeItem(KEY); } catch (e) {}
  var wanted = sessionStorage.getItem(KEY) !== "off";
  var unlockBound = false;

  audio.loop = true;
  audio.autoplay = true;
  audio.volume = 0.72;
  audio.setAttribute("playsinline", "");
  audio.setAttribute("webkit-playsinline", "");

  function paint(on) {
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
    if (!wanted) {
      stopUnlock();
      return;
    }
    if (e && btn.contains(e.target)) return;
    attempt();
  }

  function attempt() {
    if (!wanted) return;
    var p = audio.play();
    if (p && p.then) {
      p.then(function () {
        paint(true);
        stopUnlock();
      }).catch(function () {
        paint(true);
        waitUnlock();
      });
    }
  }

  function play() {
    wanted = true;
    sessionStorage.setItem(KEY, "on");
    paint(true);
    attempt();
  }

  function pause() {
    wanted = false;
    sessionStorage.setItem(KEY, "off");
    audio.pause();
    paint(false);
    stopUnlock();
  }

  btn.addEventListener("click", function (e) {
    e.stopPropagation();
    if (wanted) pause();
    else play();
  });

  audio.addEventListener("canplay", function () {
    if (wanted && audio.paused) attempt();
  });
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && wanted && audio.paused) attempt();
  });

  if (wanted) {
    paint(true);
    attempt();
  } else {
    paint(false);
  }
})();
