(() => {
  let intervalId = null;
  let startedAt = null;
  let elapsedSeconds = 0;

  function getElapsedSeconds() {
    if (startedAt === null) {
      return elapsedSeconds;
    }
    return Math.floor((Date.now() - startedAt) / 1000);
  }

  function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  function updateDisplay() {
    document.getElementById('timer').textContent = formatTime(getElapsedSeconds());
  }

  function reset() {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
    startedAt = null;
    elapsedSeconds = 0;
    updateDisplay();
  }

  function start() {
    reset();
    startedAt = Date.now();
    updateDisplay();
    intervalId = setInterval(updateDisplay, 1000);
  }

  function stop() {
    if (startedAt !== null) {
      elapsedSeconds = getElapsedSeconds();
    }
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
    startedAt = null;
    updateDisplay();
  }

  window.gameTimer = {
    start,
    stop,
    reset,
    getElapsedSeconds,
    getFormattedTime: () => formatTime(getElapsedSeconds()),
  };
})();
