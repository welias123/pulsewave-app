// ── Pulsewave Audio Engine + Equalizer ──────────────────────────────────────

const AudioEngine = (() => {
  let ctx, source, gainNode, analyser;
  let audioEl = null;
  let eqFilters = [];

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
    analyser.fftSize = 256;

    // Build EQ chain
    eqFilters = BANDS.map(([freq, type]) => {
      const f = ctx.createBiquadFilter();
      f.type      = type;
      f.frequency.value = freq;
      f.gain.value = 0;
      f.Q.value   = 1.4;
      return f;
    });

    // Connect: source → eq[0] → eq[1] → ... → gain → analyser → dest
    let prev = source;
    for (const f of eqFilters) { prev.connect(f); prev = f; }
    prev.connect(gainNode);
    gainNode.connect(analyser);
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

  // Progress bar drag
  const bar = document.getElementById('progress-bar');
  bar.addEventListener('mousedown', (e) => { isDragging = true; seekFromEvent(e); });
  document.addEventListener('mousemove', (e) => { if (isDragging) seekFromEvent(e); });
  document.addEventListener('mouseup',   ()  => { isDragging = false; });
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
      <input type="range" min="-12" max="12" value="0" step="0.5"
        oninput="onEQChange(${i}, this.value)"/>
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
