(function () {
  var audio = document.getElementById("theme-audio");
  var btn = document.getElementById("theme-toggle");
  if (!audio || !btn) return;

  var KEY = "rela-theme-on";

  function setOn(on) {
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    btn.setAttribute("aria-label", on ? "テーマソングを停止" : "テーマソングを再生");
    btn.querySelector(".ico").textContent = on ? "❚❚" : "♪";
  }

  function play() {
    audio.volume = 0.72;
    return audio.play().then(function () {
      sessionStorage.setItem(KEY, "1");
      setOn(true);
    }).catch(function () {
      setOn(false);
    });
  }

  function pause() {
    audio.pause();
    sessionStorage.removeItem(KEY);
    setOn(false);
  }

  btn.addEventListener("click", function () {
    if (audio.paused) play();
    else pause();
  });

  if (sessionStorage.getItem(KEY) === "1") play();
})();
