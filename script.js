/* script.js — fixed & integrated for your HTML */
(function () {
  'use strict';

  /* ---------- DATA (keep your real asset paths) ---------- */
  const DATA = {
    playlists: [
      {
        id: 'p1',
        title: 'Dump playlist',
        artist: 'gyuurin',
        cover: 'assets/covers/cover1.jpg',
        tracks: [
          { id: 't1', title: 'Soft Hug', artist: 'gyuurin', src: 'assets/songs/soft-hug.mp3', lyrics: ['hey baby','you are my light','tiny hugs','i love you so much'] },
          { id: 't2', title: 'Moonwalk', artist: 'gyuurin', src: 'assets/songs/moonwalk.mp3', lyrics: ['walk with me','under the moon','hold my hand','never let go'] }
        ]
      },
      {
        id: 'p2',
        title: 'me, you, us and ducks',
        artist: 'gyuurin',
        cover: 'assets/covers/cover2.jpg',
        tracks: [ { id: 't3', title: 'Duck Pond', artist: 'gyuurin', src: 'assets/songs/duck-pond.mp3', lyrics: ['quack quack','splash','cute little ducks','i love this'] } ]
      },
      {
        id: 'p3',
        title: 'Lastri, sayang?',
        artist: 'ky',
        cover: 'assets/covers/cover3.jpg',
        tracks: [ { id: 't4', title: 'Sayang', artist: 'ky', src: 'assets/songs/sayang.mp3', lyrics: ['sayang','my heart','for you','all the time','a','b','c'] } ]
      }
    ],
    more: [
      { cover: 'assets/covers/cover4.jpg' },
      { cover: 'assets/covers/cover5.jpg' },
      { cover: 'assets/covers/cover6.jpg' }
    ]
  };

  /* ---------- DOM refs (match your HTML) ---------- */
  const refs = {
    libList: document.getElementById('libList'),
    cardsGrid: document.getElementById('cardsGrid'),
    moreGrid: document.getElementById('moreGrid'),
    searchInput: document.getElementById('searchInput'),
    searchResults: document.getElementById('searchResults'),

    cover: document.getElementById('cover'),
    nowTitle: document.getElementById('nowTitle'),
    nowArtist: document.getElementById('nowArtist'),

    miniCover: document.getElementById('miniCover'),
    barTitle: document.getElementById('barTitle'),
    barArtist: document.getElementById('barArtist'),

    lyricsBox: document.getElementById('lyricsBox'),

    playBtn: document.getElementById('play'),
    prevBtn: document.getElementById('prev'),
    nextBtn: document.getElementById('next'),

    progressBar: document.getElementById('progressBar'),
    progressFill: document.getElementById('progressFill'),

    curTime: document.getElementById('curTime'),
    durTime: document.getElementById('durTime'),

    themeToggle: document.getElementById('themeToggle'),
    blobs: document.getElementById('blobs')
  };

  /* ---------- SAFETY: bail early if critical dom missing ---------- */
  if (!refs.playBtn || !refs.prevBtn || !refs.nextBtn || !refs.progressBar || !refs.progressFill) {
    console.warn('Some player controls are missing in DOM. Check IDs: play, prev, next, progressBar, progressFill.');
  }

  /* ---------- AUDIO + STATE ---------- */
  const audio = new Audio();
  audio.preload = 'metadata';
  audio.crossOrigin = 'anonymous';

  const state = {
    playlistIndex: 0,
    trackIndex: 0,
    isPlaying: false,
    lyricInterval: null,
    lrcLines: null
  };

  /* ---------- LYRICS: fullscreen + autosync ---------- */
  let lyricsFullscreen = false;
  let rafId = null;

  function toggleLyricsFullscreen() {
    if (!refs.lyricsBox) return;
    lyricsFullscreen = !lyricsFullscreen;
    if (lyricsFullscreen) {
      document.body.classList.add('lyrics-fullscreen-active'); // optional helper class for global styles
      refs.lyricsBox.classList.add('fullscreen-lyrics');
      document.body.classList.add('no-scroll');
    } else {
      refs.lyricsBox.classList.remove('fullscreen-lyrics');
      document.body.classList.remove('no-scroll');
      document.body.classList.remove('lyrics-fullscreen-active');
    }
    // recalc or reset scroll if needed
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  // map audio time -> scroll position of lyricsBox
  function startLyricsAutoSync() {
    if (!refs.lyricsBox) return;
    if (rafId) cancelAnimationFrame(rafId);
    const inner = refs.lyricsBox; // we append lines directly into this element
    function loop() {
      // If we have LRC timestamped lines, we highlight them elsewhere via syncLrc()
      // For auto-scroll, we simply map audio.currentTime -> total scroll height
      const dur = isFinite(audio.duration) ? audio.duration : 1;
      const cur = audio.currentTime || 0;
      const pct = Math.max(0, Math.min(1, cur / dur));
      const maxScroll = Math.max(0, inner.scrollHeight - inner.clientHeight);
      // smooth step a bit by lerp
      const currentTop = inner.scrollTop;
      const targetTop = pct * maxScroll;
      inner.scrollTop = currentTop + (targetTop - currentTop) * 0.15;
      // highlight logic (if using LRC)
      if (state.lrcLines && state.lrcLines.length) syncLrc(cur);
      rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);
  }

  function stopLyricsAutoSync() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  /* ---------- SET TRACK ---------- */
  function setTrack(pi, ti, { autoplay=false } = {}) {
    const playlist = DATA.playlists[pi];
    if (!playlist) return console.warn('playlist missing', pi);
    const track = playlist.tracks[ti];
    if (!track) return console.warn('track missing', pi, ti);

    state.playlistIndex = pi;
    state.trackIndex = ti;
    state.lrcLines = null;

    // UI updates
    if (refs.cover) refs.cover.style.backgroundImage = `url('${playlist.cover}')`;
    if (refs.miniCover) refs.miniCover.style.backgroundImage = `url('${playlist.cover}')`;
    if (refs.nowTitle) refs.nowTitle.textContent = track.title;
    if (refs.nowArtist) refs.nowArtist.textContent = track.artist;
    if (refs.barTitle) refs.barTitle.textContent = track.title;
    if (refs.barArtist) refs.barArtist.textContent = track.artist;

    // audio
    audio.src = track.src || '';
    audio.currentTime = 0;

    // render lyrics
    renderLyricsPlaceholder(track.lyrics || []);

    if (autoplay) play();
  }

  /* ---------- PLAY / PAUSE / NEXT / PREV ---------- */
  function play() {
    if (!audio.src) { console.warn('no audio src'); }
    audio.play().then(() => {
      state.isPlaying = true;
      if (refs.playBtn) refs.playBtn.textContent = '❚❚';
      startLyricsAutoSync();
    }).catch(err => console.warn('play error', err));
  }

  function pause() {
    audio.pause();
    state.isPlaying = false;
    if (refs.playBtn) refs.playBtn.textContent = '▶';
    stopLyricsAutoSync();
  }

  function togglePlay() {
    state.isPlaying ? pause() : play();
  }

  function prev() {
    let pi = state.playlistIndex;
    let ti = state.trackIndex - 1;
    if (ti < 0) {
      pi = (pi - 1 + DATA.playlists.length) % DATA.playlists.length;
      ti = DATA.playlists[pi].tracks.length - 1;
    }
    setTrack(pi, ti, { autoplay: true });
  }

  function next() {
    let pi = state.playlistIndex;
    let ti = state.trackIndex + 1;
    if (ti >= DATA.playlists[pi].tracks.length) {
      pi = (pi + 1) % DATA.playlists.length;
      ti = 0;
    }
    setTrack(pi, ti, { autoplay: true });
  }

  /* ---------- PROGRESS BAR ---------- */
  audio.addEventListener('timeupdate', () => {
    const cur = audio.currentTime || 0;
    const dur = audio.duration || 0;
    if (refs.curTime) refs.curTime.textContent = formatTime(cur);
    if (refs.durTime) refs.durTime.textContent = formatTime(dur);
    if (refs.progressFill && dur) refs.progressFill.style.width = (cur / dur) * 100 + '%';
    if (state.lrcLines) syncLrc(cur);
  });

  audio.addEventListener('ended', () => next());

  if (refs.progressBar) {
    refs.progressBar.addEventListener('click', (e) => {
      const rect = refs.progressBar.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = x / rect.width;
      if (audio.duration) audio.currentTime = pct * audio.duration;
    });
  }

  function formatTime(s) {
    if (!isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  }

  /* ---------- RENDER UI: library/cards ---------- */
  function makeLibCard(pl, idx) {
    const el = document.createElement('div');
    el.className = 'lib-card';
    el.tabIndex = 0;
    el.innerHTML = `<h4>${pl.title}</h4><p>${pl.artist}</p>`;
    el.addEventListener('click', () => setTrack(idx, 0, { autoplay: true }));
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') setTrack(idx, 0, { autoplay: true }); });
    return el;
  }

  function makePlaylistCard(pl, idx) {
    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML = `<img src="${pl.cover}" alt="cover"><div><h4>${pl.title}</h4><p>${pl.artist}</p></div>`;
    el.addEventListener('click', () => openPlaylistModal(idx));
    return el;
  }

  function render() {
    if (refs.libList) refs.libList.innerHTML = '';
    if (refs.cardsGrid) refs.cardsGrid.innerHTML = '';
    if (refs.moreGrid) refs.moreGrid.innerHTML = '';

    DATA.playlists.forEach((p, i) => {
      if (refs.libList) refs.libList.appendChild(makeLibCard(p, i));
      if (refs.cardsGrid) refs.cardsGrid.appendChild(makePlaylistCard(p, i));
    });

    DATA.more.forEach(m => {
      const d = document.createElement('div');
      d.className = 'card';
      d.innerHTML = `<img src="${m.cover}" alt="cover"><div><h4>Playlist</h4><p>curated</p></div>`;
      if (refs.moreGrid) refs.moreGrid.appendChild(d);
    });
  }

  /* ---------- PLAYLIST POPUP ---------- */
  function openPlaylistModal(pi) {
    const pl = DATA.playlists[pi];
    if (!pl) return;
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(0,0,0,0.6)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = 9999;

    const box = document.createElement('div');
    box.style.width = '720px';
    box.style.maxHeight = '80vh';
    box.style.overflow = 'auto';
    box.style.background = 'linear-gradient(180deg, #0c0c0c, #0a0a0a)';
    box.style.borderRadius = '16px';
    box.style.padding = '18px';

    box.innerHTML = `<div style="display:flex;align-items:center;gap:14px;margin-bottom:12px">
      <img src="${pl.cover}" style="width:96px;height:96px;border-radius:12px;object-fit:cover">
      <div><h3 style="margin:0">${pl.title}</h3><p style="margin:0;color:#9b9b9b">${pl.artist}</p></div>
    </div>`;

    const list = document.createElement('div');
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '10px';

    pl.tracks.forEach((t, ti) => {
      const tr = document.createElement('div');
      tr.style.display = 'flex';
      tr.style.alignItems = 'center';
      tr.style.justifyContent = 'space-between';
      tr.style.padding = '10px';
      tr.style.borderRadius = '10px';
      tr.style.cursor = 'pointer';
      tr.innerHTML = `<div><strong>${t.title}</strong><div style='color:#9b9b9b;font-size:13px'>${t.artist}</div></div><div style='color:#9b9b9b;font-size:13px'>▶</div>`;
      tr.addEventListener('click', () => {
        setTrack(pi, ti, { autoplay: true });
        document.body.removeChild(overlay);
      });
      list.appendChild(tr);
    });

    box.appendChild(list);
    overlay.appendChild(box);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) document.body.removeChild(overlay); });
    document.body.appendChild(overlay);
  }

  /* ---------- LYRICS: placeholder rendering and LRC parsing ---------- */
  function renderLyricsPlaceholder(lines) {
    if (!refs.lyricsBox) return;
    refs.lyricsBox.innerHTML = '';
    if (!lines || !lines.length) return;

    const elems = lines.map(l => {
      const el = document.createElement('div');
      el.className = 'lyric-line';
      el.textContent = l;
      refs.lyricsBox.appendChild(el);
      return el;
    });

    // clear any previous interval-like behavior
    if (state.lyricInterval) {
      clearInterval(state.lyricInterval);
      state.lyricInterval = null;
    }

    const startSync = () => {
      const dur = isFinite(audio.duration) ? audio.duration : (lines.length * 2);
      const per = Math.max(1.2, dur / lines.length);
      let i = 0;
      elems.forEach(e => e.classList.remove('show'));
      if (elems[0]) elems[0].classList.add('show');

      state.lyricInterval = setInterval(() => {
        elems.forEach(e => e.classList.remove('show'));
        i++;
        if (i >= elems.length) {
          clearInterval(state.lyricInterval);
          state.lyricInterval = null;
          return;
        }
        elems[i].classList.add('show');
      }, per * 1000);
    };

    if (isFinite(audio.duration) && audio.duration > 0) startSync();
    else audio.addEventListener('loadedmetadata', startSync, { once: true });
  }

  function parseLrc(lrcText) {
    if (!lrcText) return [];
    const lines = lrcText.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const result = [];
    const timeRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;
    for (const line of lines) {
      let m;
      const times = [];
      while ((m = timeRegex.exec(line)) !== null) {
        const mm = parseInt(m[1], 10);
        const ss = parseInt(m[2], 10);
        const ms = m[3] ? parseInt(m[3].padEnd(3, '0'), 10) : 0;
        times.push(mm * 60 + ss + (ms / 1000));
      }
      const text = line.replace(timeRegex, '').trim();
      times.forEach(t => result.push({ time: t, text }));
    }
    result.sort((a, b) => a.time - b.time);
    return result;
  }

  function syncLrc(curTime) {
    if (!state.lrcLines || !state.lrcLines.length || !refs.lyricsBox) return;
    let idx = 0;
    for (let i = 0; i < state.lrcLines.length; i++) {
      if (curTime >= state.lrcLines[i].time) idx = i;
      else break;
    }
    const nodes = refs.lyricsBox.querySelectorAll('.lyric-line');
    nodes.forEach((n, i) => n.classList.toggle('show', i === idx));
  }

  function loadLrcTextAndRender(lrcText) {
    state.lrcLines = parseLrc(lrcText);
    if (!refs.lyricsBox) return;
    refs.lyricsBox.innerHTML = '';
    state.lrcLines.forEach(item => {
      const el = document.createElement('div');
      el.className = 'lyric-line';
      el.textContent = item.text;
      refs.lyricsBox.appendChild(el);
    });
  }

  /* ---------- GLASS BLOBS ---------- */
  function makeBlob({size = 320, x = 10, y = 10, gradient}) {
    if (!refs.blobs) return;
    const d = document.createElement('div');
    d.className = 'blob';
    d.style.width = size + 'px';
    d.style.height = size + 'px';
    d.style.left = x + '%';
    d.style.top = y + '%';
    d.style.background = gradient || 'radial-gradient(circle at 30% 30%, rgba(29,185,84,0.9), rgba(29,185,84,0.12))';
    refs.blobs.appendChild(d);
    d.animate([{transform: 'translateY(0)'}, {transform: 'translateY(-20px)'}, {transform: 'translateY(0)'}], {
      duration: 4200 + Math.random() * 3000,
      iterations: Infinity,
      easing: 'ease-in-out'
    });
  }

  function genBlobs() {
    if (!refs.blobs) return;
    refs.blobs.innerHTML = '';
    makeBlob({size: 360, x: 4, y: 8});
    makeBlob({size: 300, x: 62, y: 6});
    makeBlob({size: 260, x: 30, y: 48});
  }

  /* ---------- THEME & SHORTCUTS ---------- */
  if (refs.themeToggle) {
    refs.themeToggle.addEventListener('change', () => {
      if (refs.themeToggle.checked) document.body.classList.add('light');
      else document.body.classList.remove('light');
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault();
      togglePlay();
    }
    if (e.key === 'ArrowRight') next();
    if (e.key === 'ArrowLeft') prev();
    if (e.key === 'Escape' && lyricsFullscreen) toggleLyricsFullscreen();
  });

  /* ---------- INIT ---------- */
  function init() {
    render();
    genBlobs();
    // Hook controls
    if (refs.playBtn) refs.playBtn.addEventListener('click', togglePlay);
    if (refs.prevBtn) refs.prevBtn.addEventListener('click', prev);
    if (refs.nextBtn) refs.nextBtn.addEventListener('click', next);

    // Click lyrics box to toggle fullscreen
    if (refs.lyricsBox) {
      refs.lyricsBox.addEventListener('click', (e) => {
        // if user selected text or clicked a link, don't toggle
        const sel = window.getSelection();
        if (sel && sel.toString()) return;
        toggleLyricsFullscreen();
      });
    }

    // Start with first track loaded (no autoplay)
    setTrack(0, 0, { autoplay: false });
    /* ---------- SEARCH ---------- */
function searchSongs(query) {
  query = query.toLowerCase();
  const results = [];

  DATA.playlists.forEach((pl, pi) => {
    pl.tracks.forEach((t, ti) => {
      const hay = (t.title + ' ' + t.artist).toLowerCase();
      if (hay.includes(query)) {
        results.push({ plIndex: pi, trIndex: ti, track: t, cover: pl.cover });
      }
    });
  });

  return results;
}

function renderSearchResults(arr) {
  if (!refs.searchResults) return;
  refs.searchResults.innerHTML = '';

  if (!arr.length) {
    refs.searchResults.innerHTML = `<div class="no-results">No songs found</div>`;
    return;
  }

  arr.forEach(item => {
    const el = document.createElement('div');
    el.className = 'search-item';
    el.innerHTML = `
      <img src="${item.cover}">
      <div>
        <strong>${item.track.title}</strong>
        <p>${item.track.artist}</p>
      </div>
    `;
    el.addEventListener('click', () => {
      setTrack(item.plIndex, item.trIndex, { autoplay: true });
      refs.searchResults.innerHTML = '';
      refs.searchInput.value = '';
    });
    refs.searchResults.appendChild(el);
  });
}

  }

  /* ---------- expose helpers for console debugging ---------- */
  window.SpotifyClone = {
    setTrack,
    play,
    pause,
    next,
    prev,
    DATA,
    loadLrcTextAndRender
  };

  init();
  // ===== SEARCH BAR SYSTEM ===== 
const songs = [
    { title: "Song 1", artist: "Artist A" },
    { title: "Song 2", artist: "Artist B" },
    { title: "Song 3", artist: "Artist C" },
    // add your real songs here
];

const searchInput = document.getElementById("songSearch");
const suggestionsBox = document.getElementById("searchSuggestions");

// show suggestions
searchInput.addEventListener("input", () => {
    const q = searchInput.value.toLowerCase().trim();
    suggestionsBox.innerHTML = "";

    if (q.length === 0) {
        suggestionsBox.style.display = "none";
        return;
    }

    const filtered = songs.filter(s =>
        s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)
    );

    if (filtered.length === 0) {
        suggestionsBox.style.display = "none";
        return;
    }

    filtered.forEach(song => {
        const div = document.createElement("div");
        div.textContent = `${song.title} – ${song.artist}`;
        div.addEventListener("click", () => {
            searchInput.value = song.title;
            suggestionsBox.style.display = "none";

            // --- HOOK THIS TO YOUR PLAYER ---
            // loadSong(song.title);
        });

        suggestionsBox.appendChild(div);
    });

    suggestionsBox.style.display = "block";
});

})();
