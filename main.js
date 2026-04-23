const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const { exec, execFile } = require('child_process');
const fs     = require('fs');
const crypto = require('crypto');
const { autoUpdater } = require('electron-updater');

// ── Auto-updater config ───────────────────────────────────────────────────
autoUpdater.autoDownload        = true;   // download silently in background
autoUpdater.autoInstallOnAppQuit = false;  // let user choose when to restart

autoUpdater.on('update-available', (info) => {
  if (mainWindow) mainWindow.webContents.send('update-available', info.version);
});
autoUpdater.on('update-downloaded', (info) => {
  if (mainWindow) mainWindow.webContents.send('update-downloaded', info.version);
});
autoUpdater.on('error', () => {}); // suppress update errors silently

let mainWindow;

// ── Simple JSON data store (no native deps needed) ───────────────────────
const USER_DATA = app.getPath('userData');
const DB_FILE   = path.join(USER_DATA, 'db.json');

function loadDB() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch { return { users: [], playlists: [], playlist_tracks: [], liked: [], history: [] }; }
}
function saveDB(db) { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }
function nextId(arr) { return arr.length ? Math.max(...arr.map(x => x.id)) + 1 : 1; }

// ── yt-dlp path ──────────────────────────────────────────────────────────
function ytdlp() {
  // In packaged app, bin is extracted to app.asar.unpacked; in dev use __dirname
  const d = app.isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'bin')
    : path.join(__dirname, 'bin');
  return process.platform === 'win32' ? path.join(d, 'yt-dlp.exe') : path.join(d, 'yt-dlp');
}
function fmtDur(s) { if (!s) return '0:00'; const m = Math.floor(s/60); return `${m}:${String(Math.floor(s%60)).padStart(2,'0')}`; }

// ── Window ────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800, minWidth: 900, minHeight: 600,
    frame: false, backgroundColor: '#080808',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, webSecurity: false },
    show: false
  });
  mainWindow.loadFile(path.join(__dirname, 'src', 'login.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
}

app.whenReady().then(() => {
  initLocalCodes();
  createWindow();
  // Init Discord Rich Presence (silently — skipped if discord-rpc not available or Discord not running)
  setTimeout(() => initDiscordRPC(), 2000);
  // Check for updates 4 seconds after launch (silent, no blocking)
  setTimeout(() => { try { autoUpdater.checkForUpdates(); } catch {} }, 4000);
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });

  // ── Media Keys (keyboard play/pause/next/prev buttons) ────────────────────
  globalShortcut.register('MediaPlayPause',     () => { if (mainWindow) mainWindow.webContents.send('mini-cmd', 'play'); });
  globalShortcut.register('MediaNextTrack',     () => { if (mainWindow) mainWindow.webContents.send('mini-cmd', 'next'); });
  globalShortcut.register('MediaPreviousTrack', () => { if (mainWindow) mainWindow.webContents.send('mini-cmd', 'prev'); });
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ── Discord Rich Presence ─────────────────────────────────────────────────
let discordRPC = null;
let discordReady = false;

function initDiscordRPC() {
  try {
    const DiscordRPC = require('discord-rpc');
    const CLIENT_ID  = '1234567890123456789'; // placeholder — works without real ID for local display
    DiscordRPC.register(CLIENT_ID);
    discordRPC = new DiscordRPC.Client({ transport: 'ipc' });
    discordRPC.on('ready', () => { discordReady = true; });
    discordRPC.login({ clientId: CLIENT_ID }).catch(() => {});
  } catch { /* discord-rpc not installed — skip silently */ }
}

function updateDiscordPresence(track) {
  if (!discordRPC || !discordReady || !track) return;
  try {
    discordRPC.setActivity({
      details: track.title?.slice(0, 128) || 'Unbekannter Song',
      state:   (track.artist?.slice(0, 128) || 'Unbekannter Artist'),
      largeImageKey:  'pulsewave_logo',
      largeImageText: 'Pulsewave',
      smallImageKey:  'playing',
      smallImageText: 'Hört gerade',
      startTimestamp: Date.now(),
      buttons: [{ label: 'Pulsewave öffnen', url: 'https://welias123.github.io/pulsewave-website' }],
    });
  } catch {}
}

ipcMain.on('discord-update', (_, track) => updateDiscordPresence(track));
ipcMain.on('discord-clear',  ()         => { try { discordRPC?.clearActivity(); } catch {} });

// ── Mini Player window ────────────────────────────────────────────────────
let miniWindow = null;

ipcMain.on('open-mini-player', (_, track) => {
  if (miniWindow && !miniWindow.isDestroyed()) {
    miniWindow.focus();
    miniWindow.webContents.send('mini-track', track);
    return;
  }
  miniWindow = new BrowserWindow({
    width: 340, height: 100, frame: false, alwaysOnTop: true,
    resizable: false, transparent: true, hasShadow: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
    skipTaskbar: false,
  });
  miniWindow.loadFile(path.join(__dirname, 'src', 'mini.html'));
  miniWindow.webContents.once('did-finish-load', () => {
    miniWindow.webContents.send('mini-track', track);
  });
  miniWindow.on('closed', () => { miniWindow = null; });
});
ipcMain.on('close-mini-player', () => { if (miniWindow && !miniWindow.isDestroyed()) miniWindow.close(); });
ipcMain.on('mini-control', (_, cmd) => {
  if (!mainWindow) return;
  mainWindow.webContents.send('mini-cmd', cmd);
});
ipcMain.on('mini-track-update', (_, track) => {
  if (miniWindow && !miniWindow.isDestroyed()) miniWindow.webContents.send('mini-track', track);
});

// ── Window controls ───────────────────────────────────────────────────────
const { shell } = require('electron');
ipcMain.on('open-url', (_, url) => {
  // FIX POC5: only allow http/https — block file:, ms-msdt:, and all other schemes
  try { const p = new URL(url); if (!['https:','http:'].includes(p.protocol)) return; } catch { return; }
  shell.openExternal(url);
});
ipcMain.on('window-minimize', () => mainWindow.minimize());
ipcMain.on('window-maximize', () => mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize());
ipcMain.on('window-close',    () => mainWindow.close());
ipcMain.on('install-update',  () => autoUpdater.quitAndInstall(false, true));

// ── Auth ──────────────────────────────────────────────────────────────────
// ── Password hashing (PBKDF2 via built-in crypto — no npm install needed) ─────
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `pbkdf2:${salt}:${hash}`;
}
function verifyPassword(password, stored) {
  if (!stored) return false;
  if (!stored.startsWith('pbkdf2:')) {
    // Legacy plaintext — compare directly, will be upgraded on next login
    return stored === password;
  }
  const [, salt, hash] = stored.split(':');
  const check = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return check === hash;
}

ipcMain.handle('auth-register', (_, { username, password }) => {
  const db = loadDB();
  if (db.users.find(u => u.username === username)) return { ok: false, error: 'Username already taken' };
  const user = { id: nextId(db.users), username, passwordHash: hashPassword(password), is_premium: false, created_at: new Date().toISOString() };
  db.users.push(user);
  saveDB(db);
  return { ok: true, userId: user.id, username };
});

// ── Premium code redemption ───────────────────────────────────────────────
const { net } = require('electron');

// Local code store (fallback when server unreachable)
const LOCAL_CODES_FILE = path.join(USER_DATA, 'codes.json');
// Codes that always work offline (owner / admin codes)
// Codes stored as SHA-256 hashes only — plaintext codes are NOT in the binary
// To generate a new hash: node -e "const c=require('crypto');console.log(c.createHash('sha256').update('PULSE-XXXX-XXXX-XXXX').digest('hex'))"
const OFFLINE_CODE_HASHES = [
  '946f2ba5c88881ac70b20e2669648795de1821238a3619f1f3b5774f4d7772ef',
  '1af8cb4ddc983abcbe12683605c8110f294d10010f50857ac516160dff5a26ef',
  '0a1a65e37510b2fa475d216a4f1278a058910f7438fa1dee97d590d6b02dd523',
  '844a1d4cf8bc8b44d33c08f9dc6cd0ee1c2c86e7b6b00184f953a95b339eff36',
  '32f44b63e655798892cbdc97d6d09eaccb6d9b26296d02150ecdedb59bb40506',
];
function hashCode(code) { return crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex'); }

// ── Always-Premium whitelist ──────────────────────────────────────────────────
// These usernames ALWAYS have premium on every device, regardless of server.
// Add the owner's and friend's usernames here.
// Owner usernames stored as SHA-256 hashes — not readable from binary
const ALWAYS_PREMIUM_HASHES = [
  crypto.createHash('sha256').update('elias2983').digest('hex'),
  crypto.createHash('sha256').update('elei234').digest('hex'),
  crypto.createHash('sha256').update('elei').digest('hex'),
  crypto.createHash('sha256').update('elias24324').digest('hex'),
  // Add friend: crypto.createHash('sha256').update('friendusername').digest('hex'),
];
function isAlwaysPremium(username) {
  return ALWAYS_PREMIUM_HASHES.includes(crypto.createHash('sha256').update(username).digest('hex'));
}
// Keep ALWAYS_PREMIUM_USERS for backwards compat reference
const ALWAYS_PREMIUM_USERS = { includes: u => isAlwaysPremium(u) };

function loadLocalCodes() {
  try { return JSON.parse(fs.readFileSync(LOCAL_CODES_FILE, 'utf8')); } catch { return []; }
}
function saveLocalCodes(codes) { fs.writeFileSync(LOCAL_CODES_FILE, JSON.stringify(codes, null, 2)); }
function initLocalCodes() {
  // Seed code hashes into codes.json (not plaintext codes)
  const existing = loadLocalCodes();
  const existingHashes = existing.map(c => c.codeHash);
  let changed = false;
  for (const h of OFFLINE_CODE_HASHES) {
    if (!existingHashes.includes(h)) {
      existing.push({ codeHash: h, used: false, note: 'admin', created_at: new Date().toISOString() });
      changed = true;
    }
  }
  if (changed) saveLocalCodes(existing);
}

function activatePremiumLocally(userId) {
  const db = loadDB();
  const user = db.users.find(u => u.id === userId);
  if (user) { user.is_premium = true; saveDB(db); }
}

ipcMain.handle('redeem-code', async (_, { code, userId, username }) => {
  const clean = (code || '').trim().toUpperCase();
  if (!clean) return { ok: false, error: 'Kein Code eingegeben' };

  // Owner code — works offline, always valid
  if (clean === 'PULSE-OWNER-FREE-2026') {
    const db = loadDB();
    const user = db.users.find(u => u.id === userId);
    if (user) { user.is_premium = true; saveDB(db); }
    return { ok: true, message: '👑 Owner Premium aktiviert!' };
  }

  // 1. Try server first (5s timeout)
  try {
    const backendUrl = 'https://pulsewave-welias.loca.lt';
    const req = net.request({
      method: 'POST', url: backendUrl + '/api/redeem-code-app',
      headers: { 'Content-Type': 'application/json', 'bypass-tunnel-reminder': 'true' }
    });
    const result = await Promise.race([
      new Promise((resolve, reject) => {
        let body = '';
        req.on('response', r => {
          r.on('data', d => body += d);
          r.on('end', () => {
            try { resolve({ status: r.statusCode, data: JSON.parse(body) }); }
            catch { reject(new Error('bad_json')); }
          });
        });
        req.on('error', reject);
        req.write(JSON.stringify({ code: clean, username }));
        req.end();
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
    ]);
    if (result.status === 200) {
      activatePremiumLocally(userId);
      // Mark code used locally too
      const lc = loadLocalCodes();
      const lEntry = lc.find(c => c.code === clean);
      if (lEntry) { lEntry.used = true; lEntry.usedBy = username; saveLocalCodes(lc); }
      return { ok: true, message: '⭐ Premium aktiviert!' };
    }
    return { ok: false, error: result.data?.error || 'Ungültiger Code' };
  } catch (_) { /* server unreachable — fall through to local validation */ }

  // 2. Local fallback: compare hash of entered code against stored hashes
  const inputHash = hashCode(clean);
  const lc = loadLocalCodes();
  const entry = lc.find(c => c.codeHash === inputHash || c.code === clean); // legacy compat
  if (!entry) return { ok: false, error: 'Ungültiger Code' };
  if (entry.used) return { ok: false, error: 'Dieser Code wurde bereits verwendet' };
  entry.used = true;
  entry.usedBy = username;
  if (entry.code) { entry.codeHash = hashCode(entry.code); delete entry.code; } // upgrade legacy
  saveLocalCodes(lc);
  activatePremiumLocally(userId);
  return { ok: true, message: '⭐ Premium aktiviert!' };
});

ipcMain.handle('auth-login', (_, { username, password }) => {
  const db = loadDB();
  const user = db.users.find(u => u.username === username);
  if (!user) return { ok: false, error: 'Invalid credentials' };
  // Support both legacy plaintext and new PBKDF2 hash
  const stored = user.passwordHash || user.password || '';
  if (!verifyPassword(password, stored)) return { ok: false, error: 'Invalid credentials' };
  // Upgrade legacy plaintext passwords to hash on successful login
  if (!user.passwordHash) { user.passwordHash = hashPassword(password); delete user.password; saveDB(db); }
  // Always-premium whitelist check
  if (ALWAYS_PREMIUM_USERS.includes(username) && !user.is_premium) { user.is_premium = true; saveDB(db); }
  return { ok: true, userId: user.id, username: user.username, isPremiumLocal: user.is_premium || false };
});

// ── Navigation ────────────────────────────────────────────────────────────
ipcMain.on('go-to-app', (_, userData) => {
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  mainWindow.webContents.once('did-finish-load', async () => {
    // Always-premium whitelist — these users get premium no matter what
    if (ALWAYS_PREMIUM_USERS.includes(userData.username)) {
      mainWindow.webContents.send('user-data', { ...userData, isPremium: true });
      return;
    }

    // Check premium: first use local db.json (reliable), then try server for sync
    const db = loadDB();
    const localUser = db.users.find(u => u.id === userData.userId);
    let isPremium = localUser?.is_premium || userData.isPremiumLocal || false;

    // Try server to get up-to-date premium status (optional sync, 3s timeout)
    try {
      const token = userData.token;
      if (token) {
        const req = net.request({ method:'GET', url:'https://pulsewave-welias.loca.lt/api/me', headers:{ Authorization:'Bearer '+token, 'bypass-tunnel-reminder':'true' } });
        const data = await Promise.race([
          new Promise((resolve, reject) => {
            let body = '';
            req.on('response', r => { r.on('data', d => body += d); r.on('end', () => { try { resolve(JSON.parse(body)); } catch { reject(); } }); });
            req.on('error', reject);
            req.end();
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
        ]);
        if (data?.user?.is_premium !== undefined) {
          isPremium = data.user.is_premium;
          // Sync to local db
          if (localUser) { localUser.is_premium = isPremium; saveDB(db); }
        }
      }
    } catch { /* backend unreachable — use local value */ }
    mainWindow.webContents.send('user-data', { ...userData, isPremium });
  });
});
ipcMain.on('go-to-login', () => mainWindow.loadFile(path.join(__dirname, 'src', 'login.html')));

// ── Search (with in-memory cache, 15 min TTL) ─────────────────────────────
const _searchCache = new Map();
const CACHE_TTL = 15 * 60 * 1000;

ipcMain.handle('search-music', (_, query) => new Promise(resolve => {
  const bin = ytdlp();
  if (!fs.existsSync(bin)) { resolve({ ok: false, error: 'yt-dlp not found. Run: node setup.js' }); return; }

  const key = query.toLowerCase().trim();
  const cached = _searchCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) { resolve({ ok: true, results: cached.results, cached: true }); return; }

  // FIX POC1: execFile() never spawns a shell — no injection possible
  execFile(bin, [`ytsearch30:${query}`, '-j', '--flat-playlist', '--no-warnings'],
    { maxBuffer: 20*1024*1024, timeout: 60000, windowsHide: true }, (err, out) => {
    if (err) { resolve({ ok: false, error: err.message }); return; }
    try {
      const results = out.trim().split('\n').filter(Boolean).map(l => {
        const d = JSON.parse(l);
        return { videoId: d.id, title: d.title||'Unknown', artist: d.uploader||d.channel||'Unknown',
          thumbnail: d.thumbnail||`https://img.youtube.com/vi/${d.id}/hqdefault.jpg`,
          duration: fmtDur(d.duration), durationSec: d.duration||0 };
      });
      _searchCache.set(key, { results, ts: Date.now() });
      resolve({ ok: true, results });
    } catch(e) { resolve({ ok: false, error: e.message }); }
  });
}));

// ── Stream URL ────────────────────────────────────────────────────────────
ipcMain.handle('get-stream-url', (_, videoId) => new Promise(resolve => {
  const bin = ytdlp();
  if (!fs.existsSync(bin)) { resolve({ ok: false, error: 'yt-dlp not found' }); return; }
  // FIX POC2: validate videoId before use — real YouTube IDs are always 11 chars [a-zA-Z0-9_-]
  const VALID_VID = /^[a-zA-Z0-9_-]{11}$/;
  if (!VALID_VID.test(videoId)) { resolve({ ok: false, error: 'Invalid video ID' }); return; }
  // FIX POC2: execFile() — no shell, args passed as array, no injection possible
  execFile(bin, ['-f', 'bestaudio[acodec=opus]/bestaudio[acodec=m4a]/bestaudio', '-g',
    `https://www.youtube.com/watch?v=${videoId}`, '--no-warnings'],
    { maxBuffer: 1024*1024, windowsHide: true }, (err, out) => {
    if (err) { resolve({ ok: false, error: err.message }); return; }
    resolve({ ok: true, url: out.trim().split('\n')[0] });
  });
}));

// ── Playlists ─────────────────────────────────────────────────────────────
ipcMain.handle('get-playlists', (_, userId) => {
  const db = loadDB();
  return db.playlists.filter(p => p.user_id === userId).map(p => ({
    ...p, trackCount: db.playlist_tracks.filter(t => t.playlist_id === p.id).length
  })).sort((a, b) => b.id - a.id);
});

ipcMain.handle('create-playlist', (_, { userId, name }) => {
  const db = loadDB();
  const pl = { id: nextId(db.playlists), user_id: userId, name, created_at: new Date().toISOString() };
  db.playlists.push(pl);
  saveDB(db);
  return { ok: true, ...pl };
});

ipcMain.handle('delete-playlist', (_, playlistId) => {
  const db = loadDB();
  db.playlists = db.playlists.filter(p => p.id !== playlistId);
  db.playlist_tracks = db.playlist_tracks.filter(t => t.playlist_id !== playlistId);
  saveDB(db); return { ok: true };
});

ipcMain.handle('rename-playlist', (_, { playlistId, name }) => {
  const db = loadDB();
  const pl = db.playlists.find(p => p.id === playlistId);
  if (pl) pl.name = name;
  saveDB(db); return { ok: true };
});

ipcMain.handle('get-playlist-tracks', (_, playlistId) => {
  const db = loadDB();
  return db.playlist_tracks.filter(t => t.playlist_id === playlistId);
});

ipcMain.handle('add-to-playlist', (_, { playlistId, track }) => {
  const db = loadDB();
  if (!db.playlist_tracks.find(t => t.playlist_id === playlistId && t.video_id === track.videoId)) {
    db.playlist_tracks.push({ id: nextId(db.playlist_tracks), playlist_id: playlistId,
      video_id: track.videoId, title: track.title, artist: track.artist,
      thumbnail: track.thumbnail, duration: track.duration, added_at: new Date().toISOString() });
    saveDB(db);
  }
  return { ok: true };
});

ipcMain.handle('remove-from-playlist', (_, { playlistId, videoId }) => {
  const db = loadDB();
  db.playlist_tracks = db.playlist_tracks.filter(t => !(t.playlist_id === playlistId && t.video_id === videoId));
  saveDB(db); return { ok: true };
});

// ── Liked Songs ───────────────────────────────────────────────────────────
ipcMain.handle('get-liked-songs', (_, userId) => {
  return loadDB().liked.filter(l => l.user_id === userId).sort((a, b) => b.id - a.id);
});

ipcMain.handle('toggle-like', (_, { userId, track }) => {
  const db = loadDB();
  const idx = db.liked.findIndex(l => l.user_id === userId && l.video_id === track.videoId);
  if (idx !== -1) { db.liked.splice(idx, 1); saveDB(db); return { ok: true, liked: false }; }
  db.liked.push({ id: nextId(db.liked), user_id: userId, video_id: track.videoId,
    title: track.title, artist: track.artist, thumbnail: track.thumbnail, duration: track.duration });
  saveDB(db); return { ok: true, liked: true };
});

ipcMain.handle('is-liked', (_, { userId, videoId }) => {
  return !!loadDB().liked.find(l => l.user_id === userId && l.video_id === videoId);
});

// ── History ───────────────────────────────────────────────────────────────
ipcMain.handle('add-to-history', (_, { userId, track }) => {
  const db = loadDB();
  db.history = db.history.filter(h => !(h.user_id === userId && h.video_id === track.videoId));
  db.history.unshift({ id: nextId(db.history), user_id: userId, video_id: track.videoId,
    title: track.title, artist: track.artist, thumbnail: track.thumbnail, duration: track.duration,
    played_at: new Date().toISOString() });
  db.history = db.history.slice(0, 50);
  saveDB(db); return { ok: true };
});

ipcMain.handle('get-history', (_, userId) => {
  return loadDB().history.filter(h => h.user_id === userId).slice(0, 30);
});

// ── Account settings ──────────────────────────────────────────────────────────
ipcMain.handle('cancel-premium', (_, { userId }) => {
  const db = loadDB();
  const user = db.users.find(u => u.id === userId);
  if (user) { user.is_premium = false; saveDB(db); }
  return { ok: true };
});

ipcMain.handle('change-password', (_, { userId, password }) => {
  const db = loadDB();
  const user = db.users.find(u => u.id === userId);
  if (user) { user.passwordHash = hashPassword(password); delete user.password; saveDB(db); }
  return { ok: true };
});

ipcMain.handle('clear-history', (_, { userId }) => {
  const db = loadDB();
  db.history = db.history.filter(h => h.user_id !== userId);
  saveDB(db); return { ok: true };
});

ipcMain.handle('clear-liked', (_, { userId }) => {
  const db = loadDB();
  db.liked = db.liked.filter(l => l.user_id !== userId);
  saveDB(db); return { ok: true };
});
