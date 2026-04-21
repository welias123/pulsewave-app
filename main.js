const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs   = require('fs');
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
  const d = path.join(__dirname, 'bin');
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
  createWindow();
  // Check for updates 4 seconds after launch (silent, no blocking)
  setTimeout(() => { try { autoUpdater.checkForUpdates(); } catch {} }, 4000);
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ── Window controls ───────────────────────────────────────────────────────
ipcMain.on('window-minimize', () => mainWindow.minimize());
ipcMain.on('window-maximize', () => mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize());
ipcMain.on('window-close',    () => mainWindow.close());
ipcMain.on('install-update',  () => autoUpdater.quitAndInstall(false, true));

// ── Auth ──────────────────────────────────────────────────────────────────
ipcMain.handle('auth-register', (_, { username, password }) => {
  const db = loadDB();
  if (db.users.find(u => u.username === username)) return { ok: false, error: 'Username already taken' };
  const user = { id: nextId(db.users), username, password, is_premium: false, created_at: new Date().toISOString() };
  db.users.push(user);
  saveDB(db);
  return { ok: true, userId: user.id, username };
});

// ── Premium code redemption ───────────────────────────────────────────────
const { net } = require('electron');
ipcMain.handle('redeem-code', async (_, { code, userId, username }) => {
  try {
    const backendUrl = 'https://pulsewave-welias.loca.lt';
    const req = net.request({
      method: 'POST', url: backendUrl + '/api/redeem-code-app',
      headers: { 'Content-Type': 'application/json', 'bypass-tunnel-reminder': 'true' }
    });
    const result = await new Promise((resolve, reject) => {
      let body = '';
      req.on('response', r => {
        r.on('data', d => body += d);
        r.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            resolve({ status: r.statusCode, data: parsed });
          } catch { reject(new Error('Invalid response')); }
        });
      });
      req.on('error', reject);
      req.write(JSON.stringify({ code, username }));
      req.end();
    });
    if (result.status !== 200) return { ok: false, error: result.data?.error || 'Ungültiger Code' };
    // Activate locally
    const db = loadDB();
    const user = db.users.find(u => u.id === userId);
    if (user) { user.is_premium = true; saveDB(db); }
    return { ok: true, message: result.data.message || 'Premium aktiviert!' };
  } catch (e) {
    return { ok: false, error: 'Server nicht erreichbar: ' + e.message };
  }
});

ipcMain.handle('auth-login', (_, { username, password }) => {
  const db = loadDB();
  const user = db.users.find(u => u.username === username && u.password === password);
  return user ? { ok: true, userId: user.id, username: user.username } : { ok: false, error: 'Invalid credentials' };
});

// ── Navigation ────────────────────────────────────────────────────────────
ipcMain.on('go-to-app', (_, userData) => {
  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  mainWindow.webContents.once('did-finish-load', async () => {
    // Check premium status from backend (non-blocking)
    let isPremium = false;
    try {
      const token = userData.token;
      if (token) {
        const { net } = require('electron');
        const req = net.request({ method:'GET', url:'https://pulsewave-welias.loca.lt/api/me', headers:{ Authorization:'Bearer '+token, 'bypass-tunnel-reminder':'true' } });
        const data = await new Promise((resolve,reject) => {
          let body='';
          req.on('response', r => { r.on('data',d=>body+=d); r.on('end',()=>{ try{resolve(JSON.parse(body))}catch{reject()} }); });
          req.on('error', reject);
          req.end();
        });
        isPremium = data?.user?.is_premium || false;
      }
    } catch { /* backend unreachable, default to free */ }
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

  const safe = query.replace(/"/g, '');
  exec(`"${bin}" "ytsearch20:${safe}" -j --flat-playlist --no-warnings`,
    { maxBuffer: 20*1024*1024, timeout: 60000 }, (err, out) => {
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
  exec(`"${bin}" -f bestaudio -g "https://www.youtube.com/watch?v=${videoId}" --no-warnings`, { maxBuffer: 1024*1024 }, (err, out) => {
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
