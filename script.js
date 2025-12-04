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
        cover: 'assets/covers/pee.jpg',
        tracks: [
          { id: 't1', title: 'Soft Hug', artist: 'gyuurin', src: 'assets/songs/soft-hug.mp3', lyrics: ['hey baby','you are my light','tiny hugs','i love you so much'] },
          { id: 't2', title: 'Moonwalk', artist: 'gyuurin', src: 'assets/songs/moonwalk.mp3', lyrics: ['walk with me','under the moon','hold my hand','never let go'] }
        ]
      },
      {
        id: 'p2',
        title: 'me, you, us and ducks',
        artist: 'gyuurin',
        cover: 'assets/covers/buncof.jpg',
        tracks: [ { id: 't3', title: 'Duck Pond', artist: 'gyuurin', src: 'assets/songs/duck-pond.mp3', lyrics: ['quack quack','splash','cute little ducks','i love this'] } ]
      },
      {
        id: 'p3',
        title: 'Lastri, sayang?',
        artist: 'ky',
        cover: 'assets/covers/fart.jpg',
        tracks: [ { id: 't4', title: 'Sayang', artist: 'ky', src: 'assets/songs/sayang.mp3', lyrics: ['sayang','my heart','for you','all the time','a','b','c'] } ]
      }
    ],
    more: [
      { cover: 'assets/covers/weirdass.jpg' },
      { cover: 'assets/covers/orgen.jpg' },
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
      // use class that fades in via CSS
      document.body.classList.add('no-scroll');
    } else {
      // fade out by removing the active class first, then cleanup
      document.body.classList.remove('lyrics-fullscreen-active');
      setTimeout(() => {
        refs.lyricsBox.classList.remove('fullscreen-lyrics');
        document.body.classList.remove('no-scroll');
      }, 260);
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
    // clicking the card opens the playlist modal only (no snake shortcut)
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
  }

  /* ---------- SEARCH ---------- */
  function searchSongs(query) {
    query = (query || '').toLowerCase();
    const results = [];

    DATA.playlists.forEach((pl, pi) => {
      pl.tracks.forEach((t, ti) => {
        const hay = (t.title + ' ' + t.artist).toLowerCase();
        if (hay.includes(query)) results.push({ plIndex: pi, trIndex: ti, track: t, cover: pl.cover });
      });
    });

    return results;
  }

  function renderSearchResults(arr) {
    if (!refs.searchResults) return;
    refs.searchResults.innerHTML = '';
    if (!arr || !arr.length) {
      refs.searchResults.innerHTML = `<div class="no-results">No songs found</div>`;
      refs.searchResults.style.display = 'block';
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
        if (refs.searchInput) refs.searchInput.value = '';
        refs.searchResults.style.display = 'none';
      });
      refs.searchResults.appendChild(el);
    });
    refs.searchResults.style.display = 'block';
  }

  // wire search input handlers (focus to show suggestions, input to filter)
  if (refs.searchInput) {
    let debounce;
    const showTop = () => {
      const all = [];
      DATA.playlists.forEach((pl, pi) => pl.tracks.forEach((t, ti) => all.push({ plIndex: pi, trIndex: ti, track: t, cover: pl.cover })));
      renderSearchResults(all.slice(0, 8));
    };

    refs.searchInput.addEventListener('focus', (e) => {
      const q = (e.target.value || '').trim();
      if (!q) showTop(); else renderSearchResults(searchSongs(q));
    });

    refs.searchInput.addEventListener('input', (e) => {
      const q = (e.target.value || '').trim();
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        if (!q) { showTop(); return; }
        renderSearchResults(searchSongs(q));
      }, 140);
    });

    document.addEventListener('click', (ev) => {
      if (!refs.searchResults) return;
      if (ev.target === refs.searchInput || refs.searchResults.contains(ev.target)) return;
      refs.searchResults.innerHTML = '';
      refs.searchResults.style.display = 'none';
    });
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

  // --- Romantic mini-games: modal wiring with cleanup + tiny games ---
  function openGameModal(title, contentHtml) {
    const overlay = document.createElement('div');
    overlay.className = 'game-overlay';
    const box = document.createElement('div');
    box.className = 'game-box';
    box.innerHTML = `<h3>${title}</h3><div class="game-content">${contentHtml}</div>`;
    const actions = document.createElement('div');
    actions.className = 'game-actions';
    const close = document.createElement('button');
    close.textContent = 'Close';
    close.addEventListener('click', () => {
      if (overlay._cleanup) overlay._cleanup();
      document.body.removeChild(overlay);
    });
    actions.appendChild(close);
    box.appendChild(actions);
    overlay.appendChild(box);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) { if (overlay._cleanup) overlay._cleanup(); document.body.removeChild(overlay); } });
    document.body.appendChild(overlay);
    return overlay;
  }

  // Snake game — playable + touch gamepad
  function startSnakeGame(container){
    if (!container) return null;
    container.innerHTML = '';
    const canvas = document.createElement('canvas');
    canvas.width = 320; canvas.height = 320; canvas.style.width = '100%';
    const wrap = document.createElement('div'); wrap.appendChild(canvas);
    // gamepad
    const pad = document.createElement('div'); pad.className = 'gamepad';
    const btnUp = document.createElement('button'); btnUp.className='btn'; btnUp.textContent='↑';
    const btnLeft = document.createElement('button'); btnLeft.className='btn'; btnLeft.textContent='←';
    const btnRight = document.createElement('button'); btnRight.className='btn'; btnRight.textContent='→';
    const btnDown = document.createElement('button'); btnDown.className='btn'; btnDown.textContent='↓';
    pad.appendChild(btnLeft); pad.appendChild(btnUp); pad.appendChild(btnDown); pad.appendChild(btnRight);
    container.appendChild(wrap); container.appendChild(pad);
    const ctx = canvas.getContext('2d');
    const grid = 16; let cols = canvas.width / grid, rows = canvas.height / grid;
    let snake = [{x:6,y:6}], dir = {x:1,y:0}, apple = {x:10,y:10}, alive = true, speed = 120;
    function draw(){ ctx.fillStyle='#050505'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.fillStyle='#e44'; ctx.fillRect(apple.x*grid,apple.y*grid,grid-2,grid-2); ctx.fillStyle='#fff'; snake.forEach(s=>ctx.fillRect(s.x*grid+2,s.y*grid+2,grid-4,grid-4)); }
    function step(){ if(!alive) return; const head = {x:(snake[snake.length-1].x+dir.x+cols)%cols, y:(snake[snake.length-1].y+dir.y+rows)%rows}; // wrap
      // collision
      for(let i=0;i<snake.length-1;i++){ if(snake[i].x===head.x && snake[i].y===head.y){ alive=false; return; } }
      snake.push(head);
      if(head.x===apple.x && head.y===apple.y){ apple = {x:Math.floor(Math.random()*cols), y:Math.floor(Math.random()*rows)}; } else { snake.shift(); }
      draw(); setTimeout(step, speed);
    }
    function setDir(dx,dy){ if((dx===-dir.x && dy===-dir.y) || (dx===dir.x && dy===dir.y)) return; dir={x:dx,y:dy}; }
    function onKey(e){ if(e.key==='ArrowLeft') setDir(-1,0); if(e.key==='ArrowRight') setDir(1,0); if(e.key==='ArrowUp') setDir(0,-1); if(e.key==='ArrowDown') setDir(0,1); }
    // touch handlers
    btnUp.addEventListener('touchstart',()=>setDir(0,-1)); btnDown.addEventListener('touchstart',()=>setDir(0,1)); btnLeft.addEventListener('touchstart',()=>setDir(-1,0)); btnRight.addEventListener('touchstart',()=>setDir(1,0));
    btnUp.addEventListener('mousedown',()=>setDir(0,-1)); btnDown.addEventListener('mousedown',()=>setDir(0,1)); btnLeft.addEventListener('mousedown',()=>setDir(-1,0)); btnRight.addEventListener('mousedown',()=>setDir(1,0));
    window.addEventListener('keydown', onKey);
    step();
    return ()=>{ alive=false; window.removeEventListener('keydown', onKey); btnUp.replaceWith(btnUp.cloneNode(true)); btnDown.replaceWith(btnDown.cloneNode(true)); btnLeft.replaceWith(btnLeft.cloneNode(true)); btnRight.replaceWith(btnRight.cloneNode(true)); };
  }

  // Dino runner — touch-friendly with jump button
  function startDinoGame(container){
    if(!container) return null;
    container.innerHTML='';
    // create a relative wrapper so we can spawn floating kaomojis behind
    const wrap = document.createElement('div');
    wrap.style.position = 'relative';
    wrap.style.width = '100%';
    wrap.style.height = '260px';
    wrap.style.overflow = 'hidden';

    const canvas = document.createElement('canvas'); canvas.width=480; canvas.height=140; canvas.style.width='100%';
    const pad = document.createElement('div'); pad.className='gamepad'; const jumpBtn = document.createElement('button'); jumpBtn.className='btn'; jumpBtn.textContent='Jump'; pad.appendChild(jumpBtn);
    // position canvas at top of wrap and pad below it
    canvas.style.position = 'relative'; canvas.style.zIndex = '2';
    pad.style.position = 'relative'; pad.style.zIndex = '2';
    wrap.appendChild(canvas);
    wrap.appendChild(pad);
    container.appendChild(wrap);
    const ctx = canvas.getContext('2d'); let x=60,y=100,vy=0,jumping=false,obs=[],running=true,score=0;
    function spawn(){ if(!running) return; obs.push({x:canvas.width,y:110- (10+Math.random()*20),w:12}); setTimeout(spawn,900+Math.random()*700); }
    // floating kaomojis in the background
    let kaomojiInterval = null;
    function spawnKaomoji(){ if(!running) return; const e = document.createElement('div'); e.style.position='absolute'; e.style.left = (10 + Math.random()*80) + '%'; e.style.bottom = '-10px'; e.style.zIndex='1'; e.style.fontSize = (14 + Math.random()*14) + 'px'; const choices = ['ꉂ(˵˃ ᗜ ˂˵)','(˶˃ ᵕ ˂˶) .ᐟ.ᐟ','˚ʚ♡ɞ˚','⸜(｡˃ ᵕ ˂ )⸝♡']; e.textContent = choices[Math.floor(Math.random()*choices.length)]; e.style.opacity = '0.95'; e.style.transition = 'transform 6s linear, opacity 1.2s linear'; wrap.appendChild(e); requestAnimationFrame(()=>{ e.style.transform = 'translateY(-220px)'; e.style.opacity='0'; }); setTimeout(()=>{ if(e.parentNode) e.parentNode.removeChild(e); }, 6200); }
    function loop(){ if(!running) return; ctx.fillStyle='#050505'; ctx.fillRect(0,0,canvas.width,canvas.height); // ground
      ctx.fillStyle='#fff'; ctx.fillRect(0,120,canvas.width,2);
      if(jumping) vy+=0.9; y+=vy; if(y>100){ y=100; jumping=false; vy=0; }
      ctx.fillStyle='#1db954'; ctx.fillRect(x,y-20,20,20);
      for(let i=obs.length-1;i>=0;i--){ obs[i].x-=6; ctx.fillStyle='#e06'; ctx.fillRect(obs[i].x,obs[i].y,obs[i].w,12); if(obs[i].x+obs[i].w < 0) { obs.splice(i,1); score++; } // passed
        // collision
        if(x < obs[i].x+obs[i].w && x+20 > obs[i].x && y-20 < obs[i].y+12 && y > obs[i].y){ running=false; }
      }
      ctx.fillStyle='#9b9b9b'; ctx.fillText('Score: '+score, canvas.width-90, 20);
      requestAnimationFrame(loop);
    }
    function doJump(){ if(!jumping){ jumping=true; vy=-12; } }
    jumpBtn.addEventListener('touchstart', doJump); jumpBtn.addEventListener('mousedown', doJump);
    function onKey(e){ if((e.code==='Space' || e.key===' ') ) doJump(); }
    window.addEventListener('keydown', onKey);
    spawn();
    // start spawning kaomojis
    kaomojiInterval = setInterval(spawnKaomoji, 800);
    loop();
    return ()=>{ running=false; window.removeEventListener('keydown', onKey); jumpBtn.replaceWith(jumpBtn.cloneNode(true)); clearInterval(kaomojiInterval); };
  }

  // Fishing game — fishing-pac replacement, touch controls: left/right and cast
  function startFishingGame(container){
    if(!container) return null;
    container.innerHTML='';
    const canvas = document.createElement('canvas'); canvas.width=480; canvas.height=240; canvas.style.width='100%';
    const pad = document.createElement('div'); pad.className='gamepad'; const leftBtn=document.createElement('button'); leftBtn.className='btn'; leftBtn.textContent='◀'; const rightBtn=document.createElement('button'); rightBtn.className='btn'; rightBtn.textContent='▶'; const castBtn=document.createElement('button'); castBtn.className='btn'; castBtn.textContent='Cast'; pad.appendChild(leftBtn); pad.appendChild(castBtn); pad.appendChild(rightBtn);
    container.appendChild(canvas); container.appendChild(pad);
    const ctx = canvas.getContext('2d'); let bx=canvas.width/2, by=20, hookY=null, hookX=0, caught=0; let fishes=[]; let running=true;
    function spawnFish(){ if(!running) return; fishes.push({x:Math.random()*(canvas.width-40)+20,y:Math.random()*(canvas.height-80)+120,dir:Math.random()>0.5?1:-1}); setTimeout(spawnFish,800+Math.random()*1200); }
    function loop(){ if(!running) return; ctx.fillStyle='#072'; ctx.fillRect(0,0,canvas.width,canvas.height); // sky/sea
      // boat
      ctx.fillStyle='#a67'; ctx.fillRect(bx-20,10,40,12);
      // hook
      if(hookY!==null){ ctx.strokeStyle='#fff'; ctx.beginPath(); ctx.moveTo(bx,22); ctx.lineTo(hookX,hookY); ctx.stroke(); ctx.fillStyle='#fff'; ctx.fillRect(hookX-4,hookY,8,8); hookY+=6; if(hookY>canvas.height){ hookY=null; } else { // check fish
          for(let i=fishes.length-1;i>=0;i--){ const f=fishes[i]; if(Math.hypot(f.x-hookX,f.y-hookY)<14){ fishes.splice(i,1); caught++; hookY=null; } }
        }
      }
      // draw fishes
      ctx.fillStyle='#ffb'; fishes.forEach(f=>{ f.x += f.dir*1.6; if(f.x<10) f.x=canvas.width-10; if(f.x>canvas.width-10) f.x=10; ctx.beginPath(); ctx.arc(f.x,f.y,8,0,Math.PI*2); ctx.fill(); });
      ctx.fillStyle='#fff'; ctx.fillText('Caught: '+caught, 10,20);
      requestAnimationFrame(loop);
    }
    function moveLeft(){ bx = Math.max(30, bx-20); }
    function moveRight(){ bx = Math.min(canvas.width-30, bx+20); }
    function cast(){ if(hookY===null){ hookY=40; hookX=bx; } }
    leftBtn.addEventListener('touchstart', moveLeft); leftBtn.addEventListener('mousedown', moveLeft);
    rightBtn.addEventListener('touchstart', moveRight); rightBtn.addEventListener('mousedown', moveRight);
    castBtn.addEventListener('touchstart', cast); castBtn.addEventListener('mousedown', cast);
    spawnFish(); loop();
    function onKey(e){ if(e.key==='ArrowLeft') moveLeft(); if(e.key==='ArrowRight') moveRight(); if(e.key===' ') cast(); }
    window.addEventListener('keydown', onKey);
    return ()=>{ running=false; window.removeEventListener('keydown', onKey); leftBtn.replaceWith(leftBtn.cloneNode(true)); rightBtn.replaceWith(rightBtn.cloneNode(true)); castBtn.replaceWith(castBtn.cloneNode(true)); };
  }

  // Lyric recital: fade lines in one by one with floating flowers/kaomojis
  function startLyricRecital(container){
    if(!container) return null;
    container.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.style.position = 'relative';
    wrap.style.width = '100%';
    wrap.style.height = '260px';
    wrap.style.overflow = 'hidden';
    wrap.style.display = 'flex';
    wrap.style.alignItems = 'center';
    wrap.style.justifyContent = 'center';
    wrap.style.padding = '12px';

    const textBox = document.createElement('div');
    textBox.style.position = 'relative';
    textBox.style.zIndex = '2';
    textBox.style.width = '100%';
    textBox.style.maxWidth = '520px';
    textBox.style.margin = '0 auto';
    textBox.style.textAlign = 'center';

    const lines = [
      'you are the little spark that lights my mornings (´｡• ᵕ •｡`)',
      'petals fall when you laugh, i collect them 🌸',
      'tiny hands, warm heart, soft night whispers ✨',
      'my favorite place is whatever room you are in (ღ˘⌣˘ღ)'
    ];

    const nodes = lines.map(t => {
      const d = document.createElement('div');
      d.textContent = t;
      d.style.opacity = '0';
      d.style.transition = 'opacity .9s ease, transform .9s ease';
      d.style.transform = 'translateY(8px)';
      d.style.fontSize = '18px';
      d.style.color = 'var(--text)';
      d.style.margin = '8px 0';
      textBox.appendChild(d);
      return d;
    });

    wrap.appendChild(textBox);
    container.appendChild(wrap);

    // floating flowers / kaomoji background
    let floatInterval = null;
    function spawnFloat(){
      const el = document.createElement('div');
      el.style.position = 'absolute';
      el.style.left = Math.random()*90 + '%';
      el.style.bottom = '-10px';
      el.style.zIndex = '1';
      el.style.fontSize = (12 + Math.random()*18) + 'px';
      const choices = ['🌸','🌺','✿','(ˆ⌣ˆ)','(｡♥‿♥｡)','(´｡• ᵕ •｡`)'];
      el.textContent = choices[Math.floor(Math.random()*choices.length)];
      el.style.opacity = '0.95';
      el.style.transition = 'transform 6s linear, opacity 1.2s linear';
      wrap.appendChild(el);
      // force layout
      requestAnimationFrame(()=>{
        el.style.transform = 'translateY(-320px)';
        el.style.opacity = '0.0';
      });
      // cleanup after animation
      setTimeout(()=>{ if(el.parentNode) el.parentNode.removeChild(el); }, 6200);
    }

    floatInterval = setInterval(spawnFloat, 700);

    // reveal lines one by one
    let i = 0;
    const revealInterval = setInterval(()=>{
      if(i < nodes.length){
        nodes[i].style.opacity = '1';
        nodes[i].style.transform = 'translateY(0)';
        i++;
      } else {
        // stop revealing; keep the text visible
        clearInterval(revealInterval);
      }
    }, 900);

    // Return cleanup
    return ()=>{
      clearInterval(floatInterval);
      clearInterval(revealInterval);
      // remove any remaining floats
      const leftovers = wrap.querySelectorAll('div');
      leftovers.forEach(n=>{});
      container.innerHTML = '';
    };
  }

  // wire romantic action elements (non-intrusive)
  document.addEventListener('click', (e) => {
    const el = e.target.closest && e.target.closest('.romantic-action');
    if (!el) return;
    const act = el.getAttribute('data-action');
    if (act === 'love-note') {
      const overlay = openGameModal('Love Note', `<p class="muted">A tiny place-holder for your romantic note. Add lyrics or a sweet message here when ready.</p><textarea id="loveNote" style="width:100%;height:120px;margin-top:8px;border-radius:8px;padding:8px;background:#0b0b0b;color:#fff;border:1px solid rgba(255,255,255,0.04)"></textarea>`);
      const t = document.getElementById('loveNote'); if(t) t.value = 'You are my moonlight...';
      return;
    }
    // Section-level "Show all" opens the lyrical recital (sweet message)
    if (act === 'show-all'){
      const overlay = openGameModal('For You — A Little Recital', `<div id="recitalWrap"></div>`);
      overlay._cleanup = startLyricRecital(overlay.querySelector('#recitalWrap'));
      return;
    }
    // Topbar filter "All" opens the unlimited Dino game
    if (act === 'all-dino'){
      const overlay = openGameModal('Unlimited Dino', `<div id="dinoWrap"></div><p style="font-size:12px;color:var(--muted);margin-top:8px">Tap Jump or press Space. Mobile gamepad available.</p>`);
      overlay._cleanup = startDinoGame(overlay.querySelector('#dinoWrap'));
      return;
    }
    if (act === 'card-action' || act === 'home-snake'){
      const overlay = openGameModal('Snake', `<div id="snakeWrap"></div><p style="font-size:12px;color:var(--muted);margin-top:8px">Arrow keys or on-screen arrows to play.</p>`);
      overlay._cleanup = startSnakeGame(overlay.querySelector('#snakeWrap'));
      return;
    }
    if (act === 'podcasts'){
      const overlay = openGameModal('Fishing — Romantic', `<div id="fishWrap"></div><p style="font-size:12px;color:var(--muted);margin-top:8px">Move boat and cast to catch fish.</p>`);
      overlay._cleanup = startFishingGame(overlay.querySelector('#fishWrap'));
      return;
    }
  });

  init();
  
})();
