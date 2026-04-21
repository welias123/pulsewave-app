// ── Pulsewave App Logic ──────────────────────────────────────────────────────

let _userId     = null;
let _username   = null;
let _isPremium  = false;
let _playlists  = [];
let _searchTimeout = null;
let _currentView   = 'home';
let _ctxTrack      = null;
let _atpTrack      = null;

// ─────────────────────────────────────────────────────────────────────────────
// PREMIUM SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

function initPremium(isPremium) {
  _isPremium = isPremium;
  const adBanner     = document.getElementById('ad-banner');
  const premBanner   = document.getElementById('premium-sidebar-banner');
  const premBadge    = document.getElementById('premium-badge-sidebar');
  const sleepBtn     = document.getElementById('btn-sleep');

  if (isPremium) {
    // Hide ads, show premium indicators
    if (adBanner)   adBanner.style.display   = 'none';
    if (premBanner) premBanner.style.display  = 'none';
    if (premBadge)  premBadge.style.display   = 'block';
    if (sleepBtn)   sleepBtn.style.display    = 'flex';
    // Apply premium Gold theme
    document.body.classList.add('premium-theme');
    // Adjust layout: no ad banner means player sits at bottom directly
    document.documentElement.style.setProperty('--ad-h', '0px');
  } else {
    // Show ads and upgrade prompts
    if (adBanner)   adBanner.style.display   = 'block';
    if (premBanner) premBanner.style.display  = 'block';
    if (premBadge)  premBadge.style.display   = 'none';
    if (sleepBtn)   sleepBtn.style.display    = 'none';
    document.body.classList.remove('premium-theme');
    // Rotate ad every 5 minutes
    setInterval(showNextAd, 5 * 60 * 1000);
  }
}

const ADS = [
  { emoji:'⭐', title:'Pulsewave Premium', text:'Keine Werbung · Sleep Timer · Crossfade · Nur €2/Monat', cta:'Jetzt upgraden' },
  { emoji:'🎵', title:'Mehr Musik genießen', text:'Mit Premium hörst du ohne Unterbrechungen. Upgrade jetzt!', cta:'Premium holen' },
  { emoji:'🎛️', title:'Eigene EQ-Presets', text:'Speichere deine perfekten Klangeinstellungen — mit Premium.', cta:'Jetzt testen' },
  { emoji:'⏰', title:'Sleep Timer', text:'Schlafen beim Musik hören? Sleep Timer ist ein Premium-Feature.', cta:'Upgraden' },
];
let _adIndex = 0;
function showNextAd() {
  const ad = ADS[_adIndex % ADS.length];
  _adIndex++;
  const el = document.getElementById('ad-banner');
  if (!el || _isPremium) return;
  el.querySelector('.ad-emoji').textContent      = ad.emoji;
  el.querySelector('.ad-text strong').textContent = ad.title;
  el.querySelector('.ad-text span').textContent   = ad.text;
  el.querySelector('.ad-cta').textContent         = ad.cta + ' →';
  el.style.display = 'block';
}

function openPremiumModal() {
  document.getElementById('premium-modal').style.display = 'flex';
}
function closePremiumModal() {
  document.getElementById('premium-modal').style.display = 'none';
}
function openStripeCheckout() {
  // Open the website's pricing page in the browser — payment happens there
  const { shell } = require('electron');
  shell.openExternal('https://welias123.github.io/pulsewave-website/#pricing');
  closePremiumModal();
  showNotif('🌐 Pricing-Seite geöffnet — zahle dort und starte die App neu');
}

// ─────────────────────────────────────────────────────────────────────────────
// SLEEP TIMER (Premium)
// ─────────────────────────────────────────────────────────────────────────────

let _sleepTimer     = null;
let _sleepEndTime   = null;
let _sleepStatusInt = null;

function openSleepTimer() {
  if (!_isPremium) { openPremiumModal(); return; }
  document.getElementById('sleep-modal').style.display = 'flex';
  updateSleepStatus();
}

function setSleep(minutes) {
  clearSleepTimer();
  _sleepEndTime = Date.now() + minutes * 60000;
  _sleepTimer   = setTimeout(() => {
    // Pause music when timer ends
    if (typeof togglePlay === 'function') {
      const pauseBtn = document.getElementById('btn-play');
      const iconPlay  = document.getElementById('icon-play');
      if (iconPlay && iconPlay.style.display === 'none') togglePlay(); // pause if playing
    }
    showSleepNotif('⏰ Sleep Timer abgelaufen — Musik pausiert');
    clearSleepTimer();
  }, minutes * 60000);
  document.querySelectorAll('.sleep-btn').forEach(b => b.classList.remove('active'));
  updateSleepStatus();
}

function cancelSleep() {
  clearSleepTimer();
  document.getElementById('sleep-status').textContent = 'Timer abgebrochen';
}

function clearSleepTimer() {
  if (_sleepTimer) { clearTimeout(_sleepTimer); _sleepTimer = null; }
  if (_sleepStatusInt) { clearInterval(_sleepStatusInt); _sleepStatusInt = null; }
  _sleepEndTime = null;
}

function updateSleepStatus() {
  const el = document.getElementById('sleep-status');
  if (!_sleepEndTime) { if(el) el.textContent = 'Kein Timer aktiv'; return; }
  if (_sleepStatusInt) clearInterval(_sleepStatusInt);
  _sleepStatusInt = setInterval(() => {
    const rem = Math.max(0, _sleepEndTime - Date.now());
    const m   = Math.floor(rem / 60000);
    const s   = Math.floor((rem % 60000) / 1000);
    if (el) el.textContent = rem > 0 ? `⏰ Stoppt in ${m}:${String(s).padStart(2,'0')}` : 'Timer abgelaufen';
    if (rem === 0) clearInterval(_sleepStatusInt);
  }, 1000);
}

function showSleepNotif(msg) {
  // Reuse toast-style notification
  const n = document.createElement('div');
  n.textContent = msg;
  n.style.cssText = 'position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:#1a1a1a;border:1px solid #FFD600;border-radius:12px;padding:12px 24px;color:#FFD600;font-size:14px;font-weight:700;z-index:9999;white-space:nowrap';
  document.body.appendChild(n);
  setTimeout(() => n.remove(), 4000);
}

const HOME_QUERIES = [
  { label: '🔥 Trending Now',     query: 'trending songs 2025 official audio' },
  { label: '✨ New Releases',      query: 'new music 2025 official' },
  { label: '😌 Chill Vibes',      query: 'chill lofi hip hop beats relax' },
  { label: '🎤 Pop Hits',         query: 'top pop songs 2025' },
  { label: '🎧 Hip-Hop & Rap',    query: 'best hip hop rap songs 2025' },
  { label: '⚡ Electronic',       query: 'best electronic dance music 2025' },
  { label: '💪 Workout',          query: 'workout motivation music gym 2025' },
  { label: '🌙 Late Night R&B',   query: 'best rnb songs 2025 late night' },
];

// ── GENRES (Browse) ──────────────────────────────────────────────────────────
const GENRES = [
  { name:'Pop',        query:'top pop songs 2025',                emoji:'🎤', color:'linear-gradient(135deg,#e91e8c,#c2185b)' },
  { name:'Hip-Hop',    query:'best hip hop rap 2025',             emoji:'🎤', color:'linear-gradient(135deg,#ff6b35,#f7931e)' },
  { name:'Rock',       query:'best rock songs 2025',              emoji:'🎸', color:'linear-gradient(135deg,#c62828,#7b1fa2)' },
  { name:'Electronic', query:'best electronic music EDM 2025',    emoji:'⚡', color:'linear-gradient(135deg,#1565c0,#7b1fa2)' },
  { name:'R&B',        query:'best rnb soul 2025',                emoji:'🎵', color:'linear-gradient(135deg,#6a1b9a,#ad1457)' },
  { name:'Latin',      query:'top latin music reggaeton 2025',    emoji:'🎺', color:'linear-gradient(135deg,#f9a825,#e65100)' },
  { name:'Jazz',       query:'best jazz music chill 2024',        emoji:'🎷', color:'linear-gradient(135deg,#4e342e,#bf360c)' },
  { name:'Classical',  query:'best classical music relaxing',     emoji:'🎻', color:'linear-gradient(135deg,#1a237e,#283593)' },
  { name:'Country',    query:'best country songs 2025',           emoji:'🤠', color:'linear-gradient(135deg,#827717,#558b2f)' },
  { name:'Metal',      query:'best metal songs heavy 2024',       emoji:'🤘', color:'linear-gradient(135deg,#212121,#b71c1c)' },
  { name:'K-Pop',      query:'best kpop songs 2025',              emoji:'⭐', color:'linear-gradient(135deg,#ec407a,#ab47bc)' },
  { name:'Indie',      query:'best indie alternative songs 2025', emoji:'🌿', color:'linear-gradient(135deg,#2e7d32,#00695c)' },
  { name:'Reggae',     query:'best reggae music 2024',            emoji:'🌴', color:'linear-gradient(135deg,#388e3c,#f9a825)' },
  { name:'Dance',      query:'best dance club music 2025',        emoji:'🕺', color:'linear-gradient(135deg,#0277bd,#00838f)' },
  { name:'Soul',       query:'best soul music classic hits',      emoji:'❤️', color:'linear-gradient(135deg,#4a148c,#880e4f)' },
  { name:'Workout',    query:'workout music gym motivation 2025',  emoji:'💪', color:'linear-gradient(135deg,#33691e,#1b5e20)' },
];

// ── RADIO STATIONS ────────────────────────────────────────────────────────────
const RADIO_STATIONS = [
  { name:'Top Hits Radio',    desc:'Die größten Charts weltweit',       query:'top chart hits music 2024',        emoji:'🌍', color:'linear-gradient(135deg,#FFD600,#FF9900)' },
  { name:'Chill Radio',       desc:'Lofi, Ambient & Entspannung',       query:'lofi hip hop chill beats',         emoji:'😌', color:'linear-gradient(135deg,#1565c0,#4fc3f7)' },
  { name:'Hip-Hop Station',   desc:'Street Beats & Rap Hits',           query:'hip hop rap songs',                emoji:'🎤', color:'linear-gradient(135deg,#ff6b35,#c62828)' },
  { name:'Pop Station',       desc:'Aktuelle Pop-Hits rund um die Uhr', query:'pop music hits',                   emoji:'🎵', color:'linear-gradient(135deg,#e91e8c,#9c27b0)' },
  { name:'Electronic Beats',  desc:'EDM, House & Techno',               query:'electronic dance music EDM',       emoji:'⚡', color:'linear-gradient(135deg,#1a237e,#7b1fa2)' },
  { name:'Rock Station',      desc:'Classic Rock & Modern Hits',        query:'rock music classic hits',          emoji:'🎸', color:'linear-gradient(135deg,#b71c1c,#4a148c)' },
  { name:'R&B Nights',        desc:'Smooth R&B für den Abend',          query:'rnb soul music hits',              emoji:'🌙', color:'linear-gradient(135deg,#6a1b9a,#c62828)' },
  { name:'Workout Mix',       desc:'Power & Energie für dein Training', query:'workout motivation gym music',     emoji:'💪', color:'linear-gradient(135deg,#1b5e20,#f9a825)' },
  { name:'Latin Vibes',       desc:'Reggaeton, Salsa & mehr',           query:'latin reggaeton music',            emoji:'🎺', color:'linear-gradient(135deg,#e65100,#f9a825)' },
  { name:'K-Pop Station',     desc:'Die besten K-Pop Hits',             query:'kpop songs hits',                  emoji:'⭐', color:'linear-gradient(135deg,#ad1457,#7b1fa2)' },
];

// ── Boot ───────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
  initPlayer();
  pw.onUserData(async (data) => {
    _userId    = data.userId;
    _username  = data.username;
    window._userId = _userId;
    document.getElementById('user-name').textContent   = _username;
    document.getElementById('user-avatar').textContent = _username[0].toUpperCase();
    // Init premium features
    initPremium(data.isPremium || false);
    await loadPlaylists();
    loadHome();
  });

  // Close context menu on click outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#ctx-menu')) hideCtxMenu();
  });
  document.addEventListener('contextmenu', (e) => e.preventDefault());
});

// ── Navigation ──────────────────────────────────────────────────────────────

function navigate(view, el) {
  _currentView = view;
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  if (el) el.classList.add('active');

  // Deactivate sidebar playlists
  document.querySelectorAll('.pl-sidebar-item').forEach(i => i.classList.remove('active'));

  document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
  const target = document.getElementById(`view-${view}`);
  if (target) { target.style.display = 'block'; target.classList.add('active'); }

  if      (view === 'search')  { document.getElementById('search-input').focus(); if (!target.innerHTML.trim()) renderSearchEmpty(); }
  else if (view === 'liked')   { refreshLikedView(); }
  else if (view === 'history') { refreshHistoryView(); }
  else if (view === 'browse')  { loadBrowse(); }
  else if (view === 'radio')   { loadRadio(); }
}

function navigateToPlaylist(playlistId) {
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  document.querySelectorAll('.pl-sidebar-item').forEach(i => i.classList.remove('active'));
  const el = document.querySelector(`.pl-sidebar-item[data-id="${playlistId}"]`);
  if (el) el.classList.add('active');

  document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
  const view = document.getElementById('view-playlist');
  view.style.display = 'block';
  view.classList.add('active');
  _currentView = 'playlist';
  loadPlaylistView(playlistId);
}

// ── Home ────────────────────────────────────────────────────────────────────

async function loadHome() {
  const view = document.getElementById('view-home');
  const h = new Date().getHours();
  const greeting = h < 12 ? 'Guten Morgen' : h < 18 ? 'Guten Tag' : 'Guten Abend';

  view.innerHTML = `
    <div class="home-hero">
      <div class="home-hero-text">
        <p class="home-hero-eyebrow">${greeting}, <strong>${esc(_username)}</strong> 👋</p>
        <h1 class="home-hero-title">Deine Musik.<br>Dein Moment.</h1>
        <p class="home-hero-sub">Entdecke neue Hits, entspanne mit Lofi oder pumpe dein Workout hoch.</p>
        <div class="home-hero-btns">
          <button class="hero-btn-primary" onclick="navigate('browse',document.querySelector('[onclick*=browse]'))">
            <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            Genres
          </button>
          <button class="hero-btn-secondary" onclick="navigate('radio',document.querySelector('[onclick*=radio]'))">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path d="M3 18v-6a9 9 0 0118 0v6"/><path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z"/></svg>
            Radio
          </button>
        </div>
      </div>
      <div class="home-hero-visual">
        <div class="hero-wave">
          ${[...Array(22)].map((_,i)=>`<div class="hero-bar" style="animation-delay:${(i*0.08).toFixed(2)}s"></div>`).join('')}
        </div>
      </div>
    </div>
    <div class="home-quick-picks">
      <h3 class="section-title">⚡ Quick Picks</h3>
      <div class="quick-genre-row">
        ${GENRES.slice(0,8).map(g=>`<button class="quick-genre-pill" style="background:${g.color}" onclick="openGenre('${esc(g.name)}','${esc(g.query)}')">${g.emoji} ${g.name}</button>`).join('')}
      </div>
    </div>`;

  for (const { label, query } of HOME_QUERIES) {
    const id = 'grid-' + label.replace(/[^\w]/g,'_');
    const sec = document.createElement('div');
    sec.className = 'home-section';
    sec.innerHTML = `<h3 class="section-title">${label}</h3>
      <div class="card-grid" id="${id}">
        ${Array(6).fill(0).map(()=>`<div class="music-card"><div class="card-art skeleton" style="aspect-ratio:1"></div><div class="card-body"><div class="skeleton" style="height:13px;width:80%;margin-bottom:6px"></div><div class="skeleton" style="height:11px;width:60%"></div></div></div>`).join('')}
      </div>`;
    view.appendChild(sec);
    loadSection(query, id);
  }
}

async function loadSection(query, gridId) {
  const res = await pw.search(query);
  const grid = document.getElementById(gridId);
  if (!grid) return;
  if (!res.ok || !res.results?.length) { grid.innerHTML = '<p style="color:var(--muted);font-size:13px;padding:8px 0">Keine Ergebnisse</p>'; return; }
  grid.innerHTML = '';
  res.results.slice(0,6).forEach((track,i) => grid.appendChild(makeCard(track, res.results, i)));
}

// ── Browse ────────────────────────────────────────────────────────────────────

function loadBrowse() {
  const view = document.getElementById('view-browse');
  if (view._loaded) return;
  view._loaded = true;
  view.innerHTML = `
    <h2 class="section-title">Browse</h2>
    <p style="color:var(--muted);font-size:14px;margin:-8px 0 24px">Wähle ein Genre und entdecke Musik</p>
    <div class="genre-grid">
      ${GENRES.map(g=>`
        <div class="genre-tile" style="background:${g.color}" onclick="openGenre('${esc(g.name)}','${esc(g.query)}')">
          <div class="genre-tile-emoji">${g.emoji}</div>
          <div class="genre-tile-name">${g.name}</div>
        </div>`).join('')}
    </div>`;
}

async function openGenre(name, query) {
  document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
  const view = document.getElementById('view-genre');
  view.style.display = 'block';
  _currentView = 'genre';

  const genre = GENRES.find(g => g.name === name) || { color:'linear-gradient(135deg,#222,#333)', emoji:'🎵' };
  view.innerHTML = `
    <div class="genre-header" style="background:${genre.color}">
      <button class="genre-back-btn" onclick="navigate('browse',document.querySelector('[onclick*=browse]'))">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><polyline points="15 18 9 12 15 6"/></svg>
        Browse
      </button>
      <span class="genre-header-emoji">${genre.emoji}</span>
      <h2 class="genre-header-name">${esc(name)}</h2>
    </div>
    <div class="genre-body">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <h3 class="section-title" style="margin:0">Top Songs</h3>
        <button class="btn-pl-play" onclick="playGenreAll()">▶ Alle abspielen</button>
      </div>
      <div id="genre-track-list" class="track-list">
        ${Array(10).fill(0).map(()=>skeletonRow()).join('')}
      </div>
    </div>`;

  const res = await pw.search(query);
  const list = document.getElementById('genre-track-list');
  if (!list) return;
  if (!res.ok || !res.results?.length) { list.innerHTML = '<p style="color:var(--muted);padding:20px">Keine Ergebnisse</p>'; return; }
  window._genreTracks = res.results;
  list.innerHTML = res.results.map((t,i) => trackRowHTML(t,i,res.results)).join('');
  bindTrackRows(view, res.results);
}

function playGenreAll() {
  if (!window._genreTracks?.length) return;
  playTrack(window._genreTracks[0], window._genreTracks, 0);
}

// ── Radio ─────────────────────────────────────────────────────────────────────

let _radioActive = null;

function loadRadio() {
  const view = document.getElementById('view-radio');
  if (view._loaded) return;
  view._loaded = true;
  view.innerHTML = `
    <h2 class="section-title">Radio</h2>
    <p style="color:var(--muted);font-size:14px;margin:-8px 0 24px">Starte eine Station — Musik spielt automatisch weiter</p>
    <div class="radio-grid">
      ${RADIO_STATIONS.map((s,i)=>`
        <div class="radio-card" id="radio-card-${i}" onclick="startRadio(${i})">
          <div class="radio-card-bg" style="background:${s.color}"></div>
          <div class="radio-card-content">
            <div class="radio-emoji">${s.emoji}</div>
            <div class="radio-info">
              <div class="radio-name">${s.name}</div>
              <div class="radio-desc">${s.desc}</div>
            </div>
            <div class="radio-play-icon">
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </div>
          </div>
        </div>`).join('')}
    </div>`;
}

async function startRadio(idx) {
  const station = RADIO_STATIONS[idx];
  document.querySelectorAll('.radio-card').forEach((c,i) => c.classList.toggle('radio-active', i === idx));
  showNotif(`📻 ${station.name} lädt…`);
  const res = await pw.search(station.query);
  if (!res.ok || !res.results?.length) { showNotif('Station konnte nicht geladen werden'); return; }
  _radioActive = { station, idx };
  playTrack(res.results[0], res.results, 0);
  showNotif(`📻 ${station.name} — läuft!`);
}

// ── Search ──────────────────────────────────────────────────────────────────

function onSearchInput() {
  clearTimeout(_searchTimeout);
  const q = document.getElementById('search-input').value.trim();
  if (!q) { renderSearchEmpty(); return; }
  document.getElementById('search-spinner').style.display = '';
  _searchTimeout = setTimeout(() => doSearch(q), 500);
}

function onSearchKey(e) {
  if (e.key === 'Enter') {
    clearTimeout(_searchTimeout);
    const q = e.target.value.trim();
    if (q) doSearch(q);
  }
}

async function doSearch(q) {
  navigate('search', null);
  const view = document.getElementById('view-search');
  view.innerHTML = `<h3 class="section-title">Results for "<span style="color:var(--yellow)">${esc(q)}</span>"</h3>
    <div class="track-list">${Array(8).fill(0).map(() => skeletonRow()).join('')}</div>`;

  const res = await pw.search(q);
  document.getElementById('search-spinner').style.display = 'none';
  if (!res.ok || !res.results?.length) {
    view.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg><h3>No results found</h3><p>Try a different search term</p></div>`;
    return;
  }
  view.innerHTML = `<h3 class="section-title">Results for "<span style="color:var(--yellow)">${esc(q)}</span>"<span class="section-sub">${res.results.length} songs</span></h3>
    <div class="track-list">${res.results.map((t, i) => trackRowHTML(t, i, res.results)).join('')}</div>`;
  bindTrackRows(view, res.results);
}

function renderSearchEmpty() {
  document.getElementById('view-search').innerHTML = `
    <div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
      <h3>Search for music</h3><p>Type an artist, song, or album name</p>
    </div>`;
}

// ── Liked Songs ──────────────────────────────────────────────────────────────

async function refreshLikedView() {
  const view = document.getElementById('view-liked');
  const songs = await pw.getLikedSongs(_userId);
  if (!songs.length) {
    view.innerHTML = `<h2 class="section-title">Liked Songs</h2><div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg><h3>No liked songs yet</h3><p>Heart a track to save it here</p></div>`;
    return;
  }
  const tracks = songs.map(s => ({ videoId: s.video_id, title: s.title, artist: s.artist, thumbnail: s.thumbnail, duration: s.duration }));
  view.innerHTML = `<h2 class="section-title">Liked Songs <span class="section-sub">${tracks.length} songs</span></h2>
    <div class="track-list">${tracks.map((t, i) => trackRowHTML(t, i, tracks)).join('')}</div>`;
  bindTrackRows(view, tracks);
}

// ── History ──────────────────────────────────────────────────────────────────

async function refreshHistoryView() {
  const view = document.getElementById('view-history');
  const rows = await pw.getHistory(_userId);
  if (!rows.length) {
    view.innerHTML = `<h2 class="section-title">Recently Played</h2><div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><h3>Nothing played yet</h3><p>Your listening history will appear here</p></div>`;
    return;
  }
  const tracks = rows.map(s => ({ videoId: s.video_id, title: s.title, artist: s.artist, thumbnail: s.thumbnail, duration: s.duration }));
  view.innerHTML = `<h2 class="section-title">Recently Played <span class="section-sub">${tracks.length} songs</span></h2>
    <div class="track-list">${tracks.map((t, i) => trackRowHTML(t, i, tracks)).join('')}</div>`;
  bindTrackRows(view, tracks);
}

// ── Playlists ─────────────────────────────────────────────────────────────────

async function loadPlaylists() {
  _playlists = await pw.getPlaylists(_userId);
  renderSidebarPlaylists();
}

function renderSidebarPlaylists() {
  const container = document.getElementById('sidebar-playlists');
  if (!_playlists.length) {
    container.innerHTML = `<div style="padding:8px 10px;font-size:12px;color:var(--muted2)">No playlists yet</div>`;
    return;
  }
  container.innerHTML = _playlists.map(p => `
    <div class="pl-sidebar-item" data-id="${p.id}" onclick="navigateToPlaylist(${p.id})">
      <div class="pl-sidebar-icon">♪</div>
      <span>${esc(p.name)}</span>
      <span style="margin-left:auto;font-size:11px;color:var(--muted2)">${p.trackCount}</span>
    </div>`).join('');
}

async function loadPlaylistView(playlistId) {
  const pl = _playlists.find(p => p.id === playlistId);
  const view = document.getElementById('view-playlist');
  if (!pl) { view.innerHTML = '<p style="padding:20px;color:var(--muted)">Playlist not found</p>'; return; }

  const rawTracks = await pw.getPlaylistTracks(playlistId);
  const tracks = rawTracks.map(t => ({ videoId: t.video_id, title: t.title, artist: t.artist, thumbnail: t.thumbnail, duration: t.duration }));

  view.innerHTML = `
    <div class="pl-header">
      <div class="pl-cover">♪</div>
      <div class="pl-meta">
        <p style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px">Playlist</p>
        <h2>${esc(pl.name)}</h2>
        <p>${tracks.length} songs</p>
        <div class="pl-actions">
          <button class="btn-pl-play" onclick="playAllPlaylist(${playlistId})">
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Play All
          </button>
          <button class="btn-icon" onclick="showPlaylistMenu(event,${playlistId})" style="background:rgba(255,255,255,.07);border-radius:8px">
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
          </button>
        </div>
      </div>
    </div>
    ${tracks.length ? `<div class="track-list">${tracks.map((t, i) => trackRowHTML(t, i, tracks, { showRemove: playlistId })).join('')}</div>`
      : `<div class="empty-state"><h3>Empty playlist</h3><p>Search for songs and add them here</p></div>`}
  `;
  bindTrackRows(view, tracks);
}

async function playAllPlaylist(playlistId) {
  const rawTracks = await pw.getPlaylistTracks(playlistId);
  if (!rawTracks.length) { showNotif('Playlist is empty'); return; }
  const tracks = rawTracks.map(t => ({ videoId: t.video_id, title: t.title, artist: t.artist, thumbnail: t.thumbnail, duration: t.duration }));
  playTrack(tracks[0], tracks, 0);
}

function showPlaylistMenu(e, playlistId) {
  e.stopPropagation();
  showCtxMenu(e.clientX, e.clientY, [
    { label: '✏️ Rename', action: () => renamePlaylistPrompt(playlistId) },
    { sep: true },
    { label: '🗑️ Delete Playlist', danger: true, action: () => deletePlaylist(playlistId) },
  ]);
}

async function deletePlaylist(playlistId) {
  await pw.deletePlaylist(playlistId);
  await loadPlaylists();
  navigate('home', document.querySelector('.nav-item'));
  showNotif('Playlist deleted');
}

function renamePlaylistPrompt(playlistId) {
  const pl = _playlists.find(p => p.id === playlistId);
  if (!pl) return;
  document.getElementById('cpl-name').value = pl.name;
  const modal = document.getElementById('modal-cpl');
  modal.style.display = 'flex';
  modal.dataset.renameId = playlistId;
  document.getElementById('cpl-name').focus();
}

// ── Add to Playlist modal ──────────────────────────────────────────────────

function openAddToPlaylistModal(track) {
  _atpTrack = track;
  const list = document.getElementById('atp-list');
  if (!_playlists.length) {
    list.innerHTML = `<p style="color:var(--muted);font-size:13px;padding:8px">No playlists yet</p>`;
  } else {
    list.innerHTML = _playlists.map(p => `
      <div class="atp-item" onclick="addTrackToPlaylist(${p.id})">
        <div class="pl-sidebar-icon">♪</div>
        <span>${esc(p.name)}</span>
        <span style="margin-left:auto;font-size:11px;color:var(--muted2)">${p.trackCount} songs</span>
      </div>`).join('');
  }
  document.getElementById('modal-atp').style.display = 'flex';
}

async function addTrackToPlaylist(playlistId) {
  if (!_atpTrack) return;
  await pw.addToPlaylist({ playlistId, track: _atpTrack });
  await loadPlaylists();
  closeModal('modal-atp');
  showNotif('Added to playlist');
  if (_currentView === 'playlist') loadPlaylistView(playlistId);
}

async function confirmCreatePlaylist() {
  const name = document.getElementById('cpl-name').value.trim();
  if (!name) return;
  const modal = document.getElementById('modal-cpl');
  const renameId = parseInt(modal.dataset.renameId);
  if (renameId) {
    await pw.renamePlaylist({ playlistId: renameId, name });
    delete modal.dataset.renameId;
  } else {
    await pw.createPlaylist({ userId: _userId, name });
  }
  await loadPlaylists();
  closeModal('modal-cpl');
  document.getElementById('cpl-name').value = '';
  showNotif(renameId ? 'Playlist renamed' : `Created "${name}"`);
  if (_currentView === 'playlist') loadPlaylistView(renameId);
}

function createPlaylistPrompt() {
  document.getElementById('modal-cpl').style.display = 'flex';
  document.getElementById('cpl-name').value = '';
  document.getElementById('cpl-name').focus();
  delete document.getElementById('modal-cpl').dataset.renameId;
}

function closeModal(id) { document.getElementById(id).style.display = 'none'; }

// ── Context menu ───────────────────────────────────────────────────────────

function showCtxMenu(x, y, items) {
  const menu = document.getElementById('ctx-menu');
  const cont = document.getElementById('ctx-items');
  cont.innerHTML = '';
  items.forEach(item => {
    if (item.sep) { const d = document.createElement('div'); d.className = 'ctx-sep'; cont.appendChild(d); return; }
    const div = document.createElement('div');
    div.className = 'ctx-item' + (item.danger ? ' danger' : '');
    div.textContent = item.label;
    div.onclick = () => { hideCtxMenu(); item.action(); };
    cont.appendChild(div);
  });
  menu.style.display = 'block';
  const vw = window.innerWidth, vh = window.innerHeight;
  menu.style.left = Math.min(x, vw - 200) + 'px';
  menu.style.top  = Math.min(y, vh - items.length * 36 - 20) + 'px';
}

function hideCtxMenu() { document.getElementById('ctx-menu').style.display = 'none'; }

function trackCtxMenu(e, track, allTracks, idx, opts = {}) {
  e.preventDefault(); e.stopPropagation();
  _ctxTrack = track;
  const items = [
    { label: '▶ Play',            action: () => playTrack(track, allTracks, idx) },
    { label: '⏭ Play Next',       action: () => { queue.splice(queueIdx + 1, 0, track); showNotif('Added to queue'); } },
    { sep: true },
    { label: '♥ Add to Liked',    action: () => pw.toggleLike({ userId: _userId, track }).then(() => refreshLikedView()) },
    { label: '＋ Add to Playlist', action: () => openAddToPlaylistModal(track) },
  ];
  if (opts.showRemove) {
    items.push({ sep: true });
    items.push({ label: '✕ Remove from Playlist', danger: true,
      action: async () => { await pw.removeFromPlaylist({ playlistId: opts.showRemove, videoId: track.videoId }); loadPlaylistView(opts.showRemove); }
    });
  }
  showCtxMenu(e.clientX, e.clientY, items);
}

// ── Track row helpers ────────────────────────────────────────────────────────

function trackRowHTML(track, idx, allTracks, opts = {}) {
  return `<div class="track-row" data-idx="${idx}" data-vid="${track.videoId}"
    ondblclick="playTrack(${JSON.stringify(track).replace(/"/g,'&quot;')}, null, null)"
    oncontextmenu="">
    <span class="track-num">${idx + 1}</span>
    <img class="track-thumb" src="${esc(track.thumbnail)}" alt="" loading="lazy"/>
    <div class="track-info">
      <span class="track-title">${esc(track.title)}</span>
      <span class="track-artist">${esc(track.artist)}</span>
    </div>
    <span class="track-dur">${track.duration}</span>
    <div class="track-actions">
      <button class="btn-track-action" title="Play" onclick="playTrack(${JSON.stringify(track).replace(/"/g,'&quot;')}, null, null)">
        <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      </button>
      <button class="btn-track-action" title="Add to playlist" onclick="openAddToPlaylistModal(${JSON.stringify(track).replace(/"/g,'&quot;')})">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
      <button class="btn-track-action" title="Like" onclick="pw.toggleLike({userId:_userId,track:${JSON.stringify(track).replace(/"/g,'&quot;')}}).then(()=>refreshLikedView())">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
      </button>
    </div>
  </div>`;
}

function bindTrackRows(view, allTracks) {
  view.querySelectorAll('.track-row').forEach((row, i) => {
    const track = allTracks[i];
    if (!track) return;
    row.addEventListener('dblclick', () => playTrack(track, allTracks, i));
    row.addEventListener('contextmenu', (e) => {
      const inPL = row.closest('#view-playlist');
      const plId = inPL ? parseInt(document.querySelector('.pl-sidebar-item.active')?.dataset.id) : null;
      trackCtxMenu(e, track, allTracks, i, { showRemove: plId });
    });
  });
}

function makeCard(track, allTracks, idx) {
  const card = document.createElement('div');
  card.className = 'music-card';
  card.innerHTML = `
    <img class="card-art" src="${esc(track.thumbnail)}" alt="" loading="lazy"/>
    <div class="card-body">
      <div class="card-title">${esc(track.title)}</div>
      <div class="card-sub">${esc(track.artist)}</div>
    </div>
    <button class="card-play-btn" title="Play">
      <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><polygon points="5 3 19 12 5 21 5 3"/></svg>
    </button>`;
  card.querySelector('.card-play-btn').onclick = (e) => { e.stopPropagation(); playTrack(track, allTracks, idx); };
  card.addEventListener('dblclick', () => playTrack(track, allTracks, idx));
  card.addEventListener('contextmenu', (e) => trackCtxMenu(e, track, allTracks, idx));
  return card;
}

// ── Misc ────────────────────────────────────────────────────────────────────

function logout() {
  try { localStorage.removeItem('pw_session'); } catch {}
  pw.goToLogin();
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 18) return 'Afternoon';
  return 'Evening';
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function skeletonRow() {
  return `<div class="track-row"><span class="track-num skeleton" style="width:20px;height:14px;display:inline-block"></span><div class="track-thumb skeleton"></div><div class="track-info"><span class="skeleton" style="display:block;height:13px;width:60%;margin-bottom:6px"></span><span class="skeleton" style="display:block;height:11px;width:40%"></span></div></div>`;
}
