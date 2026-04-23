// Pulsewave Web Server — serves the app to any device on your network (iPhone, tablet, etc.)
// Usage: node server.js   then open http://<your-pc-ip>:3000 on your phone

const express  = require('express');
const path     = require('path');
const fs       = require('fs');
const { exec } = require('child_process');
const http     = require('http');
const https    = require('https');
const os       = require('os');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ── Static files ──────────────────────────────────────────────────────────────
// web/ overrides take priority, then src/ for CSS/JS
app.use(express.static(path.join(__dirname, 'web')));
app.use('/css', express.static(path.join(__dirname, 'src', 'css')));
app.use('/js',  express.static(path.join(__dirname, 'src', 'js')));

// ── Data store (same db.json as the Electron app) ────────────────────────────
const DB_FILE = path.join(__dirname, 'data', 'db.json');
if (!fs.existsSync(path.join(__dirname, 'data'))) fs.mkdirSync(path.join(__dirname, 'data'));

function loadDB() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { return { users: [], playlists: [], playlist_tracks: [], liked: [], history: [] }; }
}
function saveDB(db) { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }
function nextId(arr) { return arr.length ? Math.max(...arr.map(x => x.id)) + 1 : 1; }

// ── yt-dlp ────────────────────────────────────────────────────────────────────
function ytdlp() {
  const d = path.join(__dirname, 'bin');
  return process.platform === 'win32' ? path.join(d, 'yt-dlp.exe') : path.join(d, 'yt-dlp');
}
function fmtDur(s) {
  if (!s) return '0:00';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

// ── Search cache ──────────────────────────────────────────────────────────────
const _searchCache = new Map();
const CACHE_TTL = 15 * 60 * 1000;

// ── Auth ──────────────────────────────────────────────────────────────────────
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.json({ ok: false, error: 'Missing fields' });
  const db = loadDB();
  if (db.users.find(u => u.username === username)) return res.json({ ok: false, error: 'Username already taken' });
  const user = { id: nextId(db.users), username, password, is_premium: false, created_at: new Date().toISOString() };
  db.users.push(user);
  saveDB(db);
  res.json({ ok: true, userId: user.id, username });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const db = loadDB();
  const user = db.users.find(u => u.username === username && u.password === password);
  if (!user) return res.json({ ok: false, error: 'Invalid credentials' });
  res.json({ ok: true, userId: user.id, username: user.username, isPremium: user.is_premium });
});

// ── Search ────────────────────────────────────────────────────────────────────
app.get('/api/search', (req, res) => {
  const query = req.query.q;
  if (!query) return res.json({ ok: false, error: 'No query' });

  const bin = ytdlp();
  if (!fs.existsSync(bin)) return res.json({ ok: false, error: 'yt-dlp not found. Run: node setup.js' });

  const key = query.toLowerCase().trim();
  const cached = _searchCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return res.json({ ok: true, results: cached.results, cached: true });

  const safe = query.replace(/"/g, '');
  exec(`"${bin}" "ytsearch20:${safe}" -j --flat-playlist --no-warnings`,
    { maxBuffer: 20 * 1024 * 1024, timeout: 60000 }, (err, out) => {
      if (err) return res.json({ ok: false, error: err.message });
      try {
        const results = out.trim().split('\n').filter(Boolean).map(l => {
          const d = JSON.parse(l);
          return {
            videoId: d.id, title: d.title || 'Unknown',
            artist: d.uploader || d.channel || 'Unknown',
            thumbnail: d.thumbnail || `https://img.youtube.com/vi/${d.id}/hqdefault.jpg`,
            duration: fmtDur(d.duration), durationSec: d.duration || 0
          };
        });
        _searchCache.set(key, { results, ts: Date.now() });
        res.json({ ok: true, results });
      } catch (e) { res.json({ ok: false, error: e.message }); }
    });
});

// ── Stream URL (returns direct URL — for network use) ─────────────────────────
app.get('/api/stream-url', (req, res) => {
  const { id } = req.query;
  if (!id) return res.json({ ok: false, error: 'No id' });
  const bin = ytdlp();
  exec(`"${bin}" -f bestaudio -g "https://www.youtube.com/watch?v=${id}" --no-warnings`,
    { maxBuffer: 1024 * 1024 }, (err, out) => {
      if (err) return res.json({ ok: false, error: err.message });
      res.json({ ok: true, url: out.trim().split('\n')[0] });
    });
});

// ── Audio Stream Proxy (for iOS — avoids CORS + supports Range for seeking) ──
app.get('/api/stream/:id', (req, res) => {
  const { id } = req.params;
  const bin = ytdlp();

  exec(`"${bin}" -f bestaudio -g "https://www.youtube.com/watch?v=${id}" --no-warnings`,
    { maxBuffer: 1024 * 1024 }, (err, out) => {
      if (err) { res.status(500).json({ error: err.message }); return; }
      const audioUrl = out.trim().split('\n')[0];

      const parsedUrl = new URL(audioUrl);
      const proto     = parsedUrl.protocol === 'https:' ? https : http;
      const options   = {
        hostname: parsedUrl.hostname,
        path:     parsedUrl.pathname + parsedUrl.search,
        headers:  { 'User-Agent': 'Mozilla/5.0', Range: req.headers.range || 'bytes=0-' }
      };

      const upstream = proto.get(options, (upRes) => {
        const status = req.headers.range ? 206 : 200;
        res.writeHead(status, {
          'Content-Type':  upRes.headers['content-type'] || 'audio/webm',
          'Content-Length': upRes.headers['content-length'] || '',
          'Content-Range':  upRes.headers['content-range'] || '',
          'Accept-Ranges':  'bytes',
          'Cache-Control':  'no-cache',
        });
        upRes.pipe(res);
      });
      upstream.on('error', () => res.status(500).end());
    });
});

// ── Playlists ─────────────────────────────────────────────────────────────────
app.get('/api/playlists', (req, res) => {
  const userId = parseInt(req.query.userId);
  const db = loadDB();
  const playlists = db.playlists.filter(p => p.user_id === userId).map(p => ({
    ...p, trackCount: db.playlist_tracks.filter(t => t.playlist_id === p.id).length
  })).sort((a, b) => b.id - a.id);
  res.json(playlists);
});

app.post('/api/playlists', (req, res) => {
  const { userId, name } = req.body;
  const db = loadDB();
  const pl = { id: nextId(db.playlists), user_id: userId, name, created_at: new Date().toISOString() };
  db.playlists.push(pl);
  saveDB(db);
  res.json({ ok: true, ...pl });
});

app.delete('/api/playlists/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const db = loadDB();
  db.playlists = db.playlists.filter(p => p.id !== id);
  db.playlist_tracks = db.playlist_tracks.filter(t => t.playlist_id !== id);
  saveDB(db);
  res.json({ ok: true });
});

app.patch('/api/playlists/:id', (req, res) => {
  const db = loadDB();
  const pl = db.playlists.find(p => p.id === parseInt(req.params.id));
  if (pl) pl.name = req.body.name;
  saveDB(db);
  res.json({ ok: true });
});

app.get('/api/playlists/:id/tracks', (req, res) => {
  const db = loadDB();
  res.json(db.playlist_tracks.filter(t => t.playlist_id === parseInt(req.params.id)));
});

app.post('/api/playlists/:id/tracks', (req, res) => {
  const playlistId = parseInt(req.params.id);
  const { track } = req.body;
  const db = loadDB();
  if (!db.playlist_tracks.find(t => t.playlist_id === playlistId && t.video_id === track.videoId)) {
    db.playlist_tracks.push({
      id: nextId(db.playlist_tracks), playlist_id: playlistId,
      video_id: track.videoId, title: track.title, artist: track.artist,
      thumbnail: track.thumbnail, duration: track.duration, added_at: new Date().toISOString()
    });
    saveDB(db);
  }
  res.json({ ok: true });
});

app.delete('/api/playlists/:id/tracks/:videoId', (req, res) => {
  const db = loadDB();
  db.playlist_tracks = db.playlist_tracks.filter(
    t => !(t.playlist_id === parseInt(req.params.id) && t.video_id === req.params.videoId)
  );
  saveDB(db);
  res.json({ ok: true });
});

// ── Liked Songs ───────────────────────────────────────────────────────────────
app.get('/api/liked', (req, res) => {
  const userId = parseInt(req.query.userId);
  res.json(loadDB().liked.filter(l => l.user_id === userId).sort((a, b) => b.id - a.id));
});

app.post('/api/liked/toggle', (req, res) => {
  const { userId, track } = req.body;
  const db = loadDB();
  const idx = db.liked.findIndex(l => l.user_id === userId && l.video_id === track.videoId);
  if (idx !== -1) { db.liked.splice(idx, 1); saveDB(db); return res.json({ ok: true, liked: false }); }
  db.liked.push({ id: nextId(db.liked), user_id: userId, video_id: track.videoId,
    title: track.title, artist: track.artist, thumbnail: track.thumbnail, duration: track.duration });
  saveDB(db);
  res.json({ ok: true, liked: true });
});

app.get('/api/liked/check', (req, res) => {
  const { userId, videoId } = req.query;
  res.json({ liked: !!loadDB().liked.find(l => l.user_id === parseInt(userId) && l.video_id === videoId) });
});

// ── History ───────────────────────────────────────────────────────────────────
app.post('/api/history', (req, res) => {
  const { userId, track } = req.body;
  const db = loadDB();
  db.history = db.history.filter(h => !(h.user_id === userId && h.video_id === track.videoId));
  db.history.unshift({ id: nextId(db.history), user_id: userId, video_id: track.videoId,
    title: track.title, artist: track.artist, thumbnail: track.thumbnail, duration: track.duration,
    played_at: new Date().toISOString() });
  db.history = db.history.slice(0, 50);
  saveDB(db);
  res.json({ ok: true });
});

app.get('/api/history', (req, res) => {
  const userId = parseInt(req.query.userId);
  res.json(loadDB().history.filter(h => h.user_id === userId).slice(0, 30));
});

// ── Premium code redeem (proxy to backend) ────────────────────────────────────
app.post('/api/redeem-code', async (req, res) => {
  const { code, userId, username } = req.body;
  if ((code || '').trim().toUpperCase() === 'PULSE-OWNER-FREE-2026') {
    const db = loadDB();
    const user = db.users.find(u => u.id === userId);
    if (user) { user.is_premium = true; saveDB(db); }
    return res.json({ ok: true, message: '👑 Owner Premium aktiviert!' });
  }
  try {
    const r = await fetch('https://pulsewave-welias.loca.lt/api/redeem-code-app', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'bypass-tunnel-reminder': 'true' },
      body: JSON.stringify({ code, username })
    });
    const data = await r.json();
    if (!r.ok || !data.ok) return res.json({ ok: false, error: data?.error || 'Ungültiger Code' });
    const db = loadDB();
    const user = db.users.find(u => u.id === userId);
    if (user) { user.is_premium = true; saveDB(db); }
    res.json({ ok: true, message: data.message || 'Premium aktiviert!' });
  } catch (e) {
    res.json({ ok: false, error: 'Server nicht erreichbar: ' + e.message });
  }
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/',      (_, res) => res.sendFile(path.join(__dirname, 'web', 'login.html')));
app.get('/app',   (_, res) => res.sendFile(path.join(__dirname, 'web', 'index.html')));
app.get('/login', (_, res) => res.sendFile(path.join(__dirname, 'web', 'login.html')));

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  const ifaces = os.networkInterfaces();
  let localIp  = 'localhost';
  for (const name of Object.values(ifaces)) {
    for (const iface of name) {
      if (iface.family === 'IPv4' && !iface.internal) { localIp = iface.address; break; }
    }
  }
  console.log('\n🎵 Pulsewave Web Server gestartet!\n');
  console.log(`   Auf diesem PC:    http://localhost:${PORT}`);
  console.log(`   iPhone / Handy:   http://${localIp}:${PORT}`);
  console.log('\n   Öffne die URL auf deinem iPhone in Safari und tippe\n   dann auf "Teilen" → "Zum Home-Bildschirm" für die App!\n');
});
