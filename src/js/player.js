// ── Pulsewave Audio Engine + Equalizer ──────────────────────────────────────

const AudioEngine = (() => {
  let ctx, source, gainNode, analyser, compressor;
  let audioEl = null;
  let eqFilters = [];
  let normEnabled = true; // Lautstärke-Normalisierung (Sound Check)

  // EQ band definitions: [freq, type, label]
  const BANDS = [
    [60,    'lowshelf',  'Sub'],
    [250,   'peaking',   'Bass'],
    [500,   'peaking',   'Low Mid'],
    [1000,  'peaking',   'Mid'],
    [2000,  'peaking',   'Hi Mid'],
    [4000,  'peaking',   'Presence'],
    [8000,  'highshelf', 'Treble'],
  ];

  const PRESETS = {
    flat:       [0,  0,  0,  0,  0,  0,  0],
    bass:       [6,  5,  2,  0, -1, -1, -1],
    vocal:      [-2,-2,  0,  4,  5,  3,  0],
    rock:       [4,  3,  0, -1,  0,  3,  4],
    electronic: [5,  4,  0, -2,  0,  4,  5],
    classical:  [0,  0,  0,  0,  0,  2,  3],
  };

  function ensureCtx(el) {
    if (ctx) return;
    ctx      = new (window.AudioContext || window.webkitAudioContext)();
    source   = ctx.createMediaElementSource(el);
    gainNode = ctx.createGain();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 512; // Higher resolution for better visualizer

    // DynamicsCompressor — Lautstärke-Normalisierung (wie Apple Music "Sound Check")
    compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;  // starts compressing at -18 dBFS
    compressor.knee.value       = 8;   // smooth knee
    compressor.ratio.value      = 3;   // gentle 3:1 ratio
    compressor.attack.value     = 0.003;
    compressor.release.value    = 0.25;

    // Build EQ chain
    eqFilters = BANDS.map(([freq, type]) => {
      const f = ctx.createBiquadFilter();
      f.type      = type;
      f.frequency.value = freq;
      f.gain.value = 0;
      f.Q.value   = 1.4;
      return f;
    });

    // Connect: source → eq[0..n] → gain → compressor → analyser → dest
    let prev = source;
    for (const f of eqFilters) { prev.connect(f); prev = f; }
    prev.connect(gainNode);
    gainNode.connect(compressor);
    compressor.connect(analyser);
    analyser.connect(ctx.destination);
  }

  return {
    init(el) { audioEl = el; },

    play() {
      if (!audioEl) return;
      ensureCtx(audioEl);
      if (ctx.state === 'suspended') ctx.resume();
      return audioEl.play();
    },

    pause() { audioEl?.pause(); },

    setVolume(v) {
      if (audioEl) audioEl.volume = v / 100;
    },

    setEQBand(index, gainDb) {
      if (eqFilters[index]) eqFilters[index].gain.value = gainDb;
    },

    applyPreset(name) {
      const vals = PRESETS[name] || PRESETS.flat;
      vals.forEach((v, i) => this.setEQBand(i, v));
      return vals;
    },

    getBands() { return BANDS; },
    getPresets() { return Object.keys(PRESETS); },
    getBandCount() { return BANDS.length; },

    getAnalyser() { return analyser; },

    setNormalization(enabled) {
      normEnabled = enabled;
      if (!compressor) return;
      if (enabled) {
        // Reconnect with compressor
        gainNode.disconnect();
        gainNode.connect(compressor);
      } else {
        // Bypass compressor — connect gain directly to analyser
        gainNode.disconnect();
        gainNode.connect(analyser);
      }
    },

    isNormalizationEnabled() { return normEnabled; },
  };
})();

// ── Player State ─────────────────────────────────────────────────────────────

let audioEl = null;
let queue   = [];
let queueIdx = -1;
let isShuffle = false;
let repeatMode = 0; // 0=off 1=all 2=one
let isMuted  = false;
let prevVol  = 80;
let isDragging = false;
let currentTrack = null;

let eqValues = [0, 0, 0, 0, 0, 0, 0];

// ── Crossfade ─────────────────────────────────────────────────────────────────
let _crossfadeSec  = 4;     // crossfade duration in seconds
let _crossfadeAudio = null; // second audio element used during crossfade
let _crossfadeTimer = null; // timeout that starts the crossfade
let _crossfadeActive = false;

function setCrossfade(enabled) {
  _crossfadeActive = enabled;
  if (!enabled && _crossfadeTimer) { clearTimeout(_crossfadeTimer); _crossfadeTimer = null; }
}

function scheduleCrossfade() {
  if (_crossfadeTimer) { clearTimeout(_crossfadeTimer); _crossfadeTimer = null; }
  if (!_crossfadeActive || !window._isPremium) return;
  if (!audioEl || !audioEl.duration) return;
  const remaining = audioEl.duration - audioEl.currentTime;
  if (remaining <= 0) return;
  const delay = Math.max(0, (remaining - _crossfadeSec) * 1000);
  _crossfadeTimer = setTimeout(doCrossfade, delay);
}

async function doCrossfade() {
  if (!_crossfadeActive || !window._isPremium) return;
  if (!queue.length) return;

  // Determine next track
  let nextIdx = isShuffle ? Math.floor(Math.random() * queue.length) : (queueIdx + 1) % queue.length;
  if (repeatMode === 0 && nextIdx === 0 && !isShuffle) return; // at end, no repeat
  const nextTrackObj = queue[nextIdx];
  if (!nextTrackObj) return;

  // Get stream URL for next track
  const res = await pw.getStreamUrl(nextTrackObj.videoId);
  if (!res.ok) return;

  // Fade out current audio
  const startVol = audioEl.volume;
  const steps = 20;
  const stepTime = (_crossfadeSec * 1000) / steps;
  let step = 0;
  const fadeOut = setInterval(() => {
    step++;
    audioEl.volume = Math.max(0, startVol * (1 - step / steps));
    if (step >= steps) { clearInterval(fadeOut); audioEl.pause(); audioEl.volume = startVol; }
  }, stepTime);

  // Create & fade in new audio element
  const nextAudio = new Audio();
  nextAudio.src = res.url;
  nextAudio.volume = 0;
  nextAudio.crossOrigin = 'anonymous';
  nextAudio.play().catch(() => {});

  let stepIn = 0;
  const fadeIn = setInterval(() => {
    stepIn++;
    nextAudio.volume = Math.min(startVol, startVol * (stepIn / steps));
    if (stepIn >= steps) { clearInterval(fadeIn); }
  }, stepTime);

  // After crossfade: swap the audio elements
  setTimeout(() => {
    // Swap state
    audioEl.pause();
    audioEl.src = '';
    audioEl = nextAudio;
    AudioEngine.init(audioEl); // re-bind engine
    queueIdx = nextIdx;
    currentTrack = nextTrackObj;
    updatePlayerUI(nextTrackObj);
    updatePlayBtn(true);
    audioEl.addEventListener('timeupdate', onTimeUpdate);
    audioEl.addEventListener('ended', onEnded);
    audioEl.addEventListener('loadedmetadata', () => {
      document.getElementById('time-total').textContent = fmtTime(audioEl.duration);
    });
    // Save history
    if (window._userId) pw.addToHistory({ userId: window._userId, track: nextTrackObj });
    // Schedule next crossfade once metadata loaded
    audioEl.addEventListener('loadedmetadata', scheduleCrossfade, { once: true });
    // Update like button
    if (window._userId) pw.isLiked({ userId: window._userId, videoId: nextTrackObj.videoId }).then(liked => setLikeBtnState(liked));
    // Highlight row
    document.querySelectorAll('.track-row').forEach(r => r.classList.remove('playing'));
    document.querySelectorAll(`.track-row[data-vid="${nextTrackObj.videoId}"]`).forEach(r => r.classList.add('playing'));
  }, _crossfadeSec * 1000);
}

// ── Pre-roll Ad System ────────────────────────────────────────────────────────
let _songsPlayed = 0;
const AD_EVERY   = 5;       // fallback: every N songs (unused now)
const AD_SECS    = 30;      // ad duration in seconds
const AD_INTERVAL_MS = 14 * 60 * 1000; // show ad every 14 minutes of listening
let _listenMs    = 0;       // total milliseconds listened
let _lastAdAt    = 0;       // _listenMs value when last ad was shown
let _listenTick  = null;    // interval that counts listening time

const PREROLL_ADS = [
  { title: '⭐ Pulsewave Premium',   body: 'Keine Werbung mehr, Sleep Timer, Crossfade & mehr — nur €2/Monat.' },
  { title: '🎵 Musik ohne Pause',    body: 'Mit Premium hörst du jeden Song sofort. Kein Warten, kein Unterbrechen.' },
  { title: '🎛️ Dein persönlicher EQ', body: 'Speichere deine perfekten Klangeinstellungen mit Premium.' },
  { title: '⏰ Sleep Timer',          body: 'Einschlafen bei Musik? Der Sleep Timer ist ein Premium-Feature.' },
];
let _adRotateIdx = 0;

function lockPlayerControls(lock) {
  ['btn-play','btn-prev','btn-next','btn-shuffle','btn-repeat','btn-like'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.disabled = lock;
    el.style.opacity = lock ? '0.25' : '';
    el.style.pointerEvents = lock ? 'none' : '';
  });
  const bar = document.getElementById('progress-bar');
  if (bar) bar.style.pointerEvents = lock ? 'none' : '';
  // Block song card clicks
  document.body.style.pointerEvents = lock ? '' : '';
  if (lock) document.body.classList.add('ad-playing');
  else      document.body.classList.remove('ad-playing');
}

function showPreRollAd() {
  return new Promise(resolve => {
    const ad = PREROLL_ADS[_adRotateIdx % PREROLL_ADS.length];
    _adRotateIdx++;

    // Stop current music during ad
    if (audioEl && !audioEl.paused) {
      audioEl.pause();
      updatePlayBtn(false);
    }

    lockPlayerControls(true);

    const el = document.createElement('div');
    el.id = 'preroll-overlay';
    el.innerHTML = `
      <div class="preroll-inner">
        <div class="preroll-label">WERBUNG</div>
        <div class="preroll-title">${ad.title}</div>
        <div class="preroll-body">${ad.body}</div>
        <button class="preroll-upgrade" onclick="openPremiumModal()">Jetzt upgraden →</button>
        <div class="preroll-countdown">
          Song startet in <span id="preroll-secs">${AD_SECS}</span>s
          <div class="preroll-bar-wrap"><div class="preroll-bar" id="preroll-bar"></div></div>
        </div>
      </div>`;
    document.body.appendChild(el);

    let secs = AD_SECS;
    const secsEl = document.getElementById('preroll-secs');
    const barEl  = document.getElementById('preroll-bar');
    barEl.style.width = '100%';

    const tick = setInterval(() => {
      secs--;
      if (secsEl) secsEl.textContent = secs;
      if (barEl)  barEl.style.width  = (secs / AD_SECS * 100) + '%';
      if (secs <= 0) {
        clearInterval(tick);
        el.remove();
        lockPlayerControls(false);
        _lastAdAt = _listenMs; // reset timer after ad
        resolve();
      }
    }, 1000);
  });
}

function shouldShowPreRoll() {
  if (window._isPremium) return false;
  return (_listenMs - _lastAdAt) >= AD_INTERVAL_MS;
}

function startListenTimer() {
  if (_listenTick) return;
  _listenTick = setInterval(() => {
    if (audioEl && !audioEl.paused && !_adInProgress) {
      _listenMs += 1000;
    }
  }, 1000);
}

function initPlayer() {
  audioEl = new Audio();
  audioEl.volume = 0.8;
  audioEl.crossOrigin = 'anonymous';
  AudioEngine.init(audioEl);

  audioEl.addEventListener('timeupdate', onTimeUpdate);
  audioEl.addEventListener('ended',      onEnded);
  audioEl.addEventListener('loadedmetadata', () => {
    document.getElementById('time-total').textContent = fmtTime(audioEl.duration);
  });
  audioEl.addEventListener('error', () => {
    showNotif('Stream error — trying next track…');
    setTimeout(nextTrack, 1500);
  });
  // Show buffering state while seeking
  audioEl.addEventListener('waiting', () => {
    document.getElementById('btn-play')?.classList.add('buffering');
  });
  audioEl.addEventListener('playing', () => {
    document.getElementById('btn-play')?.classList.remove('buffering');
  });
  audioEl.addEventListener('canplay', () => {
    document.getElementById('btn-play')?.classList.remove('buffering');
  });

  // Progress bar drag — mute during drag (no noise), unmute instantly on release
  const bar = document.getElementById('progress-bar');
  bar.addEventListener('mousedown', (e) => {
    if (_adInProgress) return;
    isDragging = true;
    audioEl.muted = true;   // silence but keep buffering → instant resume
    seekFromEvent(e);
  });
  document.addEventListener('mousemove', (e) => { if (isDragging) seekFromEvent(e); });
  document.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    audioEl.muted = false;  // unmute immediately — no re-buffer needed
  });
}

function seekFromEvent(e) {
  const bar  = document.getElementById('progress-bar');
  const rect = bar.getBoundingClientRect();
  const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  if (audioEl.duration) audioEl.currentTime = pct * audioEl.duration;
  document.getElementById('progress-fill').style.width = (pct * 100) + '%';
  document.getElementById('progress-thumb').style.left = (pct * 100) + '%';
}

function seekClick(e) { if (!isDragging) seekFromEvent(e); }

function onTimeUpdate() {
  if (!audioEl.duration || isDragging) return;
  const pct = audioEl.currentTime / audioEl.duration * 100;
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('progress-thumb').style.left = pct + '%';
  document.getElementById('time-cur').textContent = fmtTime(audioEl.currentTime);
}

function onEnded() {
  if (repeatMode === 2) { audioEl.currentTime = 0; AudioEngine.play(); return; }
  nextTrack();
}

async function playTrack(track, queueList, startIdx) {
  if (queueList) { queue = [...queueList]; queueIdx = startIdx ?? 0; }
  currentTrack = track;

  // Pre-roll ad every 14 min of listening (free users only)
  _songsPlayed++;
  startListenTimer();
  if (shouldShowPreRoll()) await showPreRollAd();

  updatePlayerUI(track);
  document.getElementById('progress-fill').style.width = '0%';
  document.getElementById('progress-thumb').style.left = '0%';
  document.getElementById('time-cur').textContent = '0:00';
  document.getElementById('time-total').textContent = track.duration || '0:00';

  // Mark currently playing row
  document.querySelectorAll('.track-row').forEach(r => r.classList.remove('playing'));
  document.querySelectorAll(`.track-row[data-vid="${track.videoId}"]`).forEach(r => r.classList.add('playing'));

  try {
    const res = await pw.getStreamUrl(track.videoId);
    if (!res.ok) { showNotif('Could not get stream: ' + res.error); return; }
    audioEl.src = res.url;
    await AudioEngine.play();
    updatePlayBtn(true);
    // Schedule crossfade for next track (premium only)
    audioEl.addEventListener('loadedmetadata', scheduleCrossfade, { once: true });
    // Save to history
    if (window._userId) pw.addToHistory({ userId: window._userId, track });
    // Update like btn
    if (window._userId) {
      const liked = await pw.isLiked({ userId: window._userId, videoId: track.videoId });
      setLikeBtnState(liked);
    }
  } catch (e) {
    showNotif('Playback error');
    console.error(e);
  }
}

function updatePlayerUI(track) {
  document.getElementById('player-title').textContent  = track.title;
  document.getElementById('player-artist').textContent = track.artist;
  const art = document.getElementById('player-art');
  art.onload = () => { art.style.opacity = '1'; };
  art.src = track.thumbnail;
  art.style.opacity = '0';
  document.title = `${track.title} — Pulsewave`;
}

function togglePlay() {
  if (!audioEl.src) return;
  if (audioEl.paused) { AudioEngine.play(); updatePlayBtn(true); }
  else { AudioEngine.pause(); updatePlayBtn(false); }
}

function updatePlayBtn(playing) {
  document.getElementById('icon-play').style.display  = playing ? 'none' : '';
  document.getElementById('icon-pause').style.display = playing ? '' : 'none';
}

function nextTrack() {
  if (!queue.length) return;
  if (isShuffle) { queueIdx = Math.floor(Math.random() * queue.length); }
  else { queueIdx = (queueIdx + 1) % queue.length; }
  if (repeatMode === 0 && queueIdx === 0 && !isShuffle) { updatePlayBtn(false); return; }
  playTrack(queue[queueIdx]);
}

function prevTrack() {
  if (audioEl.currentTime > 3) { audioEl.currentTime = 0; return; }
  if (!queue.length) return;
  queueIdx = (queueIdx - 1 + queue.length) % queue.length;
  playTrack(queue[queueIdx]);
}

function toggleShuffle() {
  isShuffle = !isShuffle;
  document.getElementById('btn-shuffle').classList.toggle('active', isShuffle);
}

function toggleRepeat() {
  repeatMode = (repeatMode + 1) % 3;
  const btn = document.getElementById('btn-repeat');
  btn.classList.toggle('active', repeatMode > 0);
  btn.style.color = repeatMode === 2 ? 'var(--yellow)' : '';
}

function setVolume(v) {
  AudioEngine.setVolume(v);
  prevVol = v;
  isMuted = false;
  document.getElementById('vol-slider').value = v;
}

function toggleMute() {
  isMuted = !isMuted;
  audioEl.volume = isMuted ? 0 : prevVol / 100;
  document.getElementById('btn-vol').classList.toggle('active', isMuted);
}

async function toggleLikeCurrent() {
  if (!currentTrack || !window._userId) return;
  const res = await pw.toggleLike({ userId: window._userId, track: currentTrack });
  setLikeBtnState(res.liked);
  if (typeof refreshLikedView === 'function') refreshLikedView();
}

function setLikeBtnState(liked) {
  const btn = document.getElementById('btn-like');
  if (liked) {
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="var(--yellow)" width="18" height="18"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>`;
  } else {
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>`;
  }
}

// ── EQ UI ─────────────────────────────────────────────────────────────────

function buildEQBands() {
  const container = document.getElementById('eq-bands');
  container.innerHTML = '';
  AudioEngine.getBands().forEach(([freq, , label], i) => {
    const div = document.createElement('div');
    div.className = 'eq-band';
    div.innerHTML = `
      <span class="eq-val" id="eq-val-${i}">0 dB</span>
      <div class="eq-band-slider-wrap">
        <input type="range" min="-12" max="12" value="0" step="0.5"
          oninput="onEQChange(${i}, this.value)"/>
      </div>
      <label>${label}</label>`;
    container.appendChild(div);
  });
}

function onEQChange(i, v) {
  const val = parseFloat(v);
  eqValues[i] = val;
  AudioEngine.setEQBand(i, val);
  const display = document.getElementById(`eq-val-${i}`);
  if (display) display.textContent = (val >= 0 ? '+' : '') + val.toFixed(1) + ' dB';
}

function applyPreset(name) {
  const vals = AudioEngine.applyPreset(name);
  eqValues = [...vals];
  const bands = document.querySelectorAll('#eq-bands input[type=range]');
  bands.forEach((inp, i) => {
    inp.value = vals[i];
    const display = document.getElementById(`eq-val-${i}`);
    if (display) display.textContent = (vals[i] >= 0 ? '+' : '') + vals[i].toFixed(1) + ' dB';
  });
}

function toggleEQ() {
  const panel = document.getElementById('eq-panel');
  const isVisible = panel.style.display !== 'none';
  panel.style.display = isVisible ? 'none' : 'block';
  document.getElementById('btn-eq').classList.toggle('active', !isVisible);
  if (!isVisible) buildEQBands();
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtTime(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function showNotif(msg) {
  let n = document.getElementById('notif');
  if (!n) {
    n = document.createElement('div');
    n.id = 'notif';
    n.style.cssText = 'position:fixed;top:44px;left:50%;transform:translateX(-50%);background:#222;color:#fff;padding:8px 18px;border-radius:20px;font-size:13px;z-index:999;pointer-events:none;transition:opacity .3s;border:1px solid #333';
    document.body.appendChild(n);
  }
  n.textContent = msg;
  n.style.opacity = '1';
  clearTimeout(n._t);
  n._t = setTimeout(() => n.style.opacity = '0', 2500);
}
