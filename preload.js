const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pw', {
  // Window
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close:    () => ipcRenderer.send('window-close'),

  // Auth
  register: (d) => ipcRenderer.invoke('auth-register', d),
  login:    (d) => ipcRenderer.invoke('auth-login', d),
  goToApp:  (u) => ipcRenderer.send('go-to-app', u),
  goToLogin:()  => ipcRenderer.send('go-to-login'),
  onUserData:(cb) => ipcRenderer.on('user-data', (_, d) => cb(d)),

  // Music
  search:       (q)    => ipcRenderer.invoke('search-music', q),
  getStreamUrl: (id, quality) => ipcRenderer.invoke('get-stream-url', { videoId: id, quality: quality || 'best' }),

  // Playlists
  getPlaylists:       (uid)  => ipcRenderer.invoke('get-playlists', uid),
  createPlaylist:     (d)    => ipcRenderer.invoke('create-playlist', d),
  deletePlaylist:     (id)   => ipcRenderer.invoke('delete-playlist', id),
  renamePlaylist:     (d)    => ipcRenderer.invoke('rename-playlist', d),
  getPlaylistTracks:  (id)   => ipcRenderer.invoke('get-playlist-tracks', id),
  addToPlaylist:      (d)    => ipcRenderer.invoke('add-to-playlist', d),
  removeFromPlaylist: (d)    => ipcRenderer.invoke('remove-from-playlist', d),

  // Community Playlists
  getPublicPlaylists:    (q)  => ipcRenderer.invoke('get-public-playlists', q),
  togglePlaylistPublic:  (d)  => ipcRenderer.invoke('toggle-playlist-public', d),
  saveCommunityPlaylist: (d)  => ipcRenderer.invoke('save-community-playlist', d),

  // Likes
  getLikedSongs: (uid)  => ipcRenderer.invoke('get-liked-songs', uid),
  toggleLike:    (d)    => ipcRenderer.invoke('toggle-like', d),
  isLiked:       (d)    => ipcRenderer.invoke('is-liked', d),

  // History
  addToHistory: (d)    => ipcRenderer.invoke('add-to-history', d),
  getHistory:   (uid)  => ipcRenderer.invoke('get-history', uid),

  // Premium
  redeemCode:      (d) => ipcRenderer.invoke('redeem-code', d),
  cancelPremium:   (d) => ipcRenderer.invoke('cancel-premium', d),
  changePassword:  (d) => ipcRenderer.invoke('change-password', d),
  clearHistory:    (d) => ipcRenderer.invoke('clear-history', d),
  clearLiked:      (d) => ipcRenderer.invoke('clear-liked', d),

  // Auto-updater
  onUpdateAvailable:  (cb) => ipcRenderer.on('update-available',  (_, v) => cb(v)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', (_, v) => cb(v)),
  installUpdate: () => ipcRenderer.send('install-update'),

  // Open external URL in browser
  openUrl: (url) => ipcRenderer.send('open-url', url),

  // Discord Rich Presence
  discordUpdate: (track) => ipcRenderer.send('discord-update', track),
  discordClear:  ()      => ipcRenderer.send('discord-clear'),

  // Mini Player
  openMiniPlayer:  (track) => ipcRenderer.send('open-mini-player', track),
  closeMiniPlayer: ()      => ipcRenderer.send('close-mini-player'),
  miniTrackUpdate: (track) => ipcRenderer.send('mini-track-update', track),
  miniControl:     (cmd)   => ipcRenderer.send('mini-control', cmd),
  onMiniCmd:       (cb)    => ipcRenderer.on('mini-cmd', (_, cmd) => cb(cmd)),
  onMiniTrack:     (cb)    => ipcRenderer.on('mini-track', (_, t)  => cb(t)),
});
