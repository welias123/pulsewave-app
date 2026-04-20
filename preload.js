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
  getStreamUrl: (id)   => ipcRenderer.invoke('get-stream-url', id),

  // Playlists
  getPlaylists:       (uid)  => ipcRenderer.invoke('get-playlists', uid),
  createPlaylist:     (d)    => ipcRenderer.invoke('create-playlist', d),
  deletePlaylist:     (id)   => ipcRenderer.invoke('delete-playlist', id),
  renamePlaylist:     (d)    => ipcRenderer.invoke('rename-playlist', d),
  getPlaylistTracks:  (id)   => ipcRenderer.invoke('get-playlist-tracks', id),
  addToPlaylist:      (d)    => ipcRenderer.invoke('add-to-playlist', d),
  removeFromPlaylist: (d)    => ipcRenderer.invoke('remove-from-playlist', d),

  // Likes
  getLikedSongs: (uid)  => ipcRenderer.invoke('get-liked-songs', uid),
  toggleLike:    (d)    => ipcRenderer.invoke('toggle-like', d),
  isLiked:       (d)    => ipcRenderer.invoke('is-liked', d),

  // History
  addToHistory: (d)    => ipcRenderer.invoke('add-to-history', d),
  getHistory:   (uid)  => ipcRenderer.invoke('get-history', uid),

  // Auto-updater
  onUpdateAvailable: (cb) => ipcRenderer.on('update-available', (_, v) => cb(v)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', (_, v) => cb(v)),
  installUpdate: () => ipcRenderer.send('install-update'),
});
