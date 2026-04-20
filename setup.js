// Pulsewave first-run setup — downloads yt-dlp binary
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const BIN_DIR = path.join(__dirname, 'bin');
if (!fs.existsSync(BIN_DIR)) fs.mkdirSync(BIN_DIR, { recursive: true });

const RELEASES = {
  win32:  { url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe', file: 'yt-dlp.exe' },
  linux:  { url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp',     file: 'yt-dlp'     },
  darwin: { url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos', file: 'yt-dlp'   },
};

const plat  = process.platform === 'win32' ? 'win32' : (process.platform === 'darwin' ? 'darwin' : 'linux');
const { url, file } = RELEASES[plat];
const dest  = path.join(BIN_DIR, file);

if (fs.existsSync(dest)) { console.log('yt-dlp already present:', dest); process.exit(0); }

console.log('Downloading yt-dlp for', plat, '…');

function download(url, dest, cb) {
  const f = fs.createWriteStream(dest);
  https.get(url, res => {
    if (res.statusCode === 302 || res.statusCode === 301) {
      f.close();
      fs.unlinkSync(dest);
      download(res.headers.location, dest, cb);
      return;
    }
    const total = parseInt(res.headers['content-length'] || '0');
    let done = 0;
    res.on('data', chunk => {
      done += chunk.length;
      if (total) process.stdout.write(`\r  ${Math.round(done/total*100)}%`);
    });
    res.pipe(f);
    f.on('finish', () => { f.close(); cb(null); });
  }).on('error', err => { fs.unlink(dest, () => {}); cb(err); });
}

download(url, dest, (err) => {
  if (err) { console.error('Download failed:', err.message); process.exit(1); }
  if (plat !== 'win32') fs.chmodSync(dest, 0o755);
  console.log('\nyt-dlp ready at', dest);
});
