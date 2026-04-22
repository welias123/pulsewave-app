// pw-web.js — Web implementation of the Electron preload pw API
// Replaces IPC calls with fetch() so the app runs in any browser (incl. iOS Safari)

(function () {
  async function api(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(path, opts);
    return res.json();
  }

  window.pw = {
    // Window controls — no-ops in browser
    minimize: () => {},
    maximize: () => {},
    close:    () => {},

    // Auth
    register: (d) => api('POST', '/api/register', d),
    login:    (d) => api('POST', '/api/login', d),

    goToApp: (userData) => {
      try { localStorage.setItem('pw_session', JSON.stringify(userData)); } catch {}
      window.location.href = '/app';
    },
    goToLogin: () => {
      try { localStorage.removeItem('pw_session'); } catch {}
      window.location.href = '/login';
    },

    // onUserData: called on app page load — we read from localStorage instead
    onUserData: (cb) => {
      try {
        const s = localStorage.getItem('pw_session');
        if (s) { const d = JSON.parse(s); if (d?.userId) { setTimeout(() => cb(d), 0); return; } }
      } catch {}
      window.location.href = '/login';
    },

    // Music
    search: (q) => api('GET', `/api/search?q=${encodeURIComponent(q)}`),

    // For iOS we use the proxy stream endpoint so audio plays correctly
    getStreamUrl: async (id) => {
      return { ok: true, url: `/api/stream/${id}` };
    },

    // Playlists
    getPlaylists:      (uid)  => api('GET',    `/api/playlists?userId=${uid}`),
    createPlaylist:    (d)    => api('POST',   '/api/playlists', d),
    deletePlaylist:    (id)   => api('DELETE', `/api/playlists/${id}`),
    renamePlaylist:    (d)    => api('PATCH',  `/api/playlists/${d.playlistId}`, { name: d.name }),
    getPlaylistTracks: (id)   => api('GET',    `/api/playlists/${id}/tracks`),
    addToPlaylist:     (d)    => api('POST',   `/api/playlists/${d.playlistId}/tracks`, { track: d.track }),
    removeFromPlaylist:(d)    => api('DELETE', `/api/playlists/${d.playlistId}/tracks/${d.videoId}`),

    // Likes
    getLikedSongs: (uid)  => api('GET',  `/api/liked?userId=${uid}`),
    toggleLike:    (d)    => api('POST', '/api/liked/toggle', d),
    isLiked:       (d)    => api('GET',  `/api/liked/check?userId=${d.userId}&videoId=${d.videoId}`)
                               .then(r => r.liked),

    // History
    addToHistory: (d)    => api('POST', '/api/history', d),
    getHistory:   (uid)  => api('GET',  `/api/history?userId=${uid}`),

    // Premium
    redeemCode: (d) => api('POST', '/api/redeem-code', d),

    // Auto-updater — not applicable in web mode
    onUpdateAvailable:  () => {},
    onUpdateDownloaded: () => {},
    installUpdate:      () => {},
  };
})();
