// ============================================================
// DEBUG DUNGEON — Background Music
// music.js: looping BGM with mute toggle, respects browser autoplay
// ============================================================

const Music = (() => {

  const TRACK_URL = 'audio/Pixel%20Caverns%20%E2%80%93%20Level%201.mp3';
  const STORAGE_KEY = 'dd_music_muted';

  let audio = null;
  let muted = localStorage.getItem(STORAGE_KEY) === '1';
  let started = false;  // true once we've attempted playback

  function createAudio() {
    if (audio) return;
    audio = new Audio(TRACK_URL);
    audio.loop = true;
    audio.volume = 0.35;
  }

  // Call this on any user gesture to satisfy autoplay policy
  function play() {
    createAudio();
    if (muted) return;
    if (started && !audio.paused) return;
    started = true;
    audio.play().catch(() => {
      // Browser blocked — will retry on next user gesture
      started = false;
    });
  }

  function pause() {
    if (audio && !audio.paused) {
      audio.pause();
    }
  }

  function toggleMute() {
    muted = !muted;
    localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
    updateButton();
    if (muted) {
      pause();
    } else {
      play();
    }
  }

  function isMuted() {
    return muted;
  }

  function updateButton() {
    document.querySelectorAll('.music-toggle').forEach(btn => {
      btn.textContent = muted ? '🔇' : '🔊';
      btn.title = muted ? 'Unmute music' : 'Mute music';
    });
  }

  function init() {
    // Wire up all music toggle buttons
    document.querySelectorAll('.music-toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMute();
      });
    });
    updateButton();

    // Start music on first meaningful user click (autoplay policy)
    document.addEventListener('click', function firstPlay() {
      if (!muted) play();
      document.removeEventListener('click', firstPlay);
    }, { once: true });
  }

  return { init, play, pause, toggleMute, isMuted };
})();
