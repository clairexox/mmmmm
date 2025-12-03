/* ==========================
   spotify-ui advanced - script.js
   Separated JS file (modular, feature-rich)
   - Dynamic DOM rendering for playlists + library
   - Real audio playback (HTMLAudioElement)
   - Progress bar, click-to-seek
   - Lyrics engine: simple timed lines OR LRC parsing fallback
   - Animated glass blobs
   - Theme toggle + keyboard shortcuts
   - Placeholder asset paths in DATA; replace with your real file paths
   ==========================
*/

// IIFE to avoid globals
(function(){
  'use strict';

  /* ---------- CONFIG / DATA (replace asset paths) ---------- */
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
        tracks: [ { id: 't4', title: 'Sayang', artist: 'ky', src: 'assets/songs/sayang.mp3', lyrics: ['sayang','my heart','for you','all the time'] } ]
      }
    ],
    more: [
      { cover: 'assets/covers/cover4.jpg' },
      { cover: 'assets/covers/cover5.jpg' },
      { cover: 'assets/covers/cover6.jpg' }
    ]
  };

  /* ---------- DOM refs ---------- */
  const refs = {
    libList: document.getElementById('libList'),
    cardsGrid: document.getElementById('cardsGrid'),
    moreGrid: document.getElementById('moreGrid'),
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

  /* ===== NEW LYRIC SYSTEM VARS ===== */
let lyricScrollInterval = null;
let lyricsFullscreen = false;

const lyricsBox = document.querySelector('.lyrics-box');
const lyricsContent = document.querySelector('.lyrics-content');

  /* ---------- AUDIO ENGINE ---------- */
  const audio = new Audio();
  audio.preload = 'metadata';
  audio.crossOrigin = 'anonymous';

  let state = {
    playlistIndex: 0,
    trackIndex: 0,
    isPlaying: false,
    lyricInterval: null,
    lrcLines: null // if using LRC parsing
  };

  function setTrack(pi, ti, {autoplay=false} = {}){
    const playlist = DATA.playlists[pi];
    if(!playlist) return console.warn('playlist missing',pi);
    const track = playlist.tracks[ti];
    if(!track) return console.warn('track missing',pi,ti);

    state.playlistIndex = pi; state.trackIndex = ti; state.lrcLines = null; // reset any LRC

    // update UI
    refs.cover.style.backgroundImage = `url('${playlist.cover}')`;
    refs.miniCover.style.backgroundImage = `url('${playlist.cover}')`;
    refs.nowTitle.textContent = track.title;
    refs.nowArtist.textContent = track.artist;
    refs.barTitle.textContent = track.title;
    refs.barArtist.textContent = track.artist;

    // set audio source
    audio.src = track.src || '';

    // render lyrics (deferred until metadata loaded if duration matters)
    renderLyricsPlaceholder(track.lyrics || []);

    if(autoplay) play();
    /* ============================================================
   FULLSCREEN LYRICS MODE
   ============================================================ */
function toggleLyricsFullscreen() {
    lyricsFullscreen = !lyricsFullscreen;

    if (lyricsFullscreen) {
        lyricsBox.classList.add("fullscreen-lyrics");
        document.body.classList.add("no-scroll");
    } else {
        lyricsBox.classList.remove("fullscreen-lyrics");
        document.body.classList.remove("no-scroll");
    }
}

    /* ============================================================
   AUTO-SCROLL LYRICS (like Spotify)
   ============================================================ */
function startAutoScrollLyrics() {
    stopAutoScrollLyrics(); // just in case

    lyricScrollInterval = setInterval(() => {
        // smooth continuous scroll
        lyricsContent.scrollTop += 0.4; 
    }, 16); // 60fps
}

function stopAutoScrollLyrics() {
    if (lyricScrollInterval) {
        clearInterval(lyricScrollInterval);
        lyricScrollInterval = null;
    }
}

  }

  function play(){
    if(!audio.src) { console.warn('no audio src'); }
    audio.play().then(()=>{ state.isPlaying = true; refs.playBtn.textContent = '❚❚'; }).catch(err=>console.warn('play error',err));
  }
  function pause(){ audio.pause(); state.isPlaying = false; refs.playBtn.textContent = '▶'; }
  function togglePlay(){ state.isPlaying ? pause() : play(); }
  function prev(){ let pi=state.playlistIndex, ti=state.trackIndex-1; if(ti<0){ pi=(pi-1+DATA.playlists.length)%DATA.playlists.length; ti=DATA.playlists[pi].tracks.length-1; } setTrack(pi,ti,{autoplay:true}); }
  function next(){ let pi=state.playlistIndex, ti=state.trackIndex+1; if(ti>=DATA.playlists[pi].tracks.length){ pi=(pi+1)%DATA.playlists.length; ti=0; } setTrack(pi,ti,{autoplay:true}); }

  // progress
  audio.addEventListener('timeupdate', ()=>{
    const cur = audio.currentTime || 0; const dur = audio.duration || 0;
    refs.curTime.textContent = formatTime(cur); refs.durTime.textContent = formatTime(dur);
    const pct = dur ? (cur/dur)*100 : 0; refs.progressFill.style.width = pct+'%';
    // if we have an LRC map, show appropriate line
    if(state.lrcLines) syncLrc(cur);
  });

  audio.addEventListener('ended', ()=>{ next(); });

  refs.progressBar.addEventListener('click', (e)=>{
    const rect = refs.progressBar.getBoundingClientRect(); const x = e.clientX - rect.left; const pct = x / rect.width; if(isFinite(audio.duration)) audio.currentTime = pct * audio.duration;
  });

  function formatTime(s){ if(!isFinite(s)) return '0:00'; const m=Math.floor(s/60); const sec=Math.floor(s%60); return `${m}:${sec.toString().padStart(2,'0')}`; }

  /* ---------- UI RENDERING ---------- */
  function makeLibCard(pl, idx){ const el = document.createElement('div'); el.className='lib-card'; el.tabIndex = 0; el.innerHTML = `<h4>${pl.title}</h4><p>${pl.artist}</p>`; el.addEventListener('click', ()=>{ setTrack(idx,0,{autoplay:true}); }); el.addEventListener('keydown', (e)=>{ if(e.key==='Enter') setTrack(idx,0,{autoplay:true}); }); return el; }

  function makePlaylistCard(pl, idx){ const el=document.createElement('div'); el.className='card'; const img = `<img src='${pl.cover}' alt='cover'>`; el.innerHTML = `${img}<div><h4>${pl.title}</h4><p>${pl.artist}</p></div>`; el.addEventListener('click', ()=>{ openPlaylistModal(idx); }); return el; }

  function render(){ refs.libList.innerHTML = ''; refs.cardsGrid.innerHTML = ''; refs.moreGrid.innerHTML = '';
    DATA.playlists.forEach((p,i)=>{ refs.libList.appendChild(makeLibCard(p,i)); refs.cardsGrid.appendChild(makePlaylistCard(p,i)); });
    DATA.more.forEach(m=>{ const d=document.createElement('div'); d.className='card'; d.innerHTML = `<img src='${m.cover}' alt='cover'><div><h4>Playlist</h4><p>curated</p></div>`; refs.moreGrid.appendChild(d); });
  }

  /* ---------- PLAYLIST QUICK VIEW + TRACK LIST (simple modal) ---------- */
  function openPlaylistModal(pi){ // simple quick view replacement: replace card grid with track list temporarily
    const pl = DATA.playlists[pi];
    if(!pl) return;

    // create overlay
    const overlay = document.createElement('div'); overlay.style.position='fixed'; overlay.style.inset='0'; overlay.style.background='rgba(0,0,0,0.6)'; overlay.style.display='flex'; overlay.style.alignItems='center'; overlay.style.justifyContent='center'; overlay.style.zIndex = 9999;
    const box = document.createElement('div'); box.style.width='720px'; box.style.maxHeight='80vh'; box.style.overflow='auto'; box.style.background='linear-gradient(180deg, #0c0c0c, #0a0a0a)'; box.style.borderRadius='16px'; box.style.padding='18px';
    box.innerHTML = `<div style="display:flex;align-items:center;gap:14px;margin-bottom:12px"><img src='${pl.cover}' style='width:96px;height:96px;border-radius:12px;object-fit:cover'><div><h3 style='margin:0'>${pl.title}</h3><p style='margin:0;color:#9b9b9b'>${pl.artist}</p></div></div>`;

    const list = document.createElement('div'); list.style.display='flex'; list.style.flexDirection='column'; list.style.gap='10px';
    pl.tracks.forEach((t,ti)=>{
      const tr = document.createElement('div'); tr.style.display='flex'; tr.style.alignItems='center'; tr.style.justifyContent='space-between'; tr.style.padding='10px'; tr.style.borderRadius='10px'; tr.style.cursor='pointer';
      tr.innerHTML = `<div><strong>${t.title}</strong><div style='color:#9b9b9b;font-size:13px'>${t.artist}</div></div><div style='color:#9b9b9b;font-size:13px'>▶</div>`;
      tr.addEventListener('click', ()=>{ setTrack(pi,ti,{autoplay:true}); document.body.removeChild(overlay); });
      list.appendChild(tr);
    });

    box.appendChild(list);
    overlay.appendChild(box);
    overlay.addEventListener('click', (e)=>{ if(e.target===overlay) document.body.removeChild(overlay); });
    document.body.appendChild(overlay);
  }

  /* ---------- LYRICS ENGINE ---------- */
  // Simple engine: if provided an array of lines, show each line for equal portion of duration.
  // Optional: parse LRC (timestamped .lrc) and sync exactly. We'll include a light LRC parser function.

  function renderLyricsPlaceholder(lines){ refs.lyricsBox.innerHTML = ''; if(!lines || !lines.length) return; const elems = lines.map(l=>{ const el=document.createElement('div'); el.className='lyric-line'; el.textContent = l; refs.lyricsBox.appendChild(el); return el; });

    // Clear previous interval
    if(state.lyricInterval) clearInterval(state.lyricInterval);

    // Wait for metadata then start cycling lines based on duration
    const startSync = ()=>{
      const dur = isFinite(audio.duration) ? audio.duration : (lines.length * 2);
      const per = Math.max(1.2, dur / lines.length);
      let i = 0;
      elems.forEach(e=>e.classList.remove('show'));
      // show first after tiny delay
      setTimeout(()=>{ elems[0].classList.add('show'); i = 1; }, 160);
      state.lyricInterval = setInterval(()=>{
        elems.forEach(e=>e.classList.remove('show'));
        if(i >= elems.length){ clearInterval(state.lyricInterval); return; }
        elems[i].classList.add('show'); i++;
      }, per * 1000);
    };

    if(isFinite(audio.duration)){
      startSync();
    } else {
      const onloaded = ()=>{ startSync(); audio.removeEventListener('loadedmetadata', onloaded); };
      audio.addEventListener('loadedmetadata', onloaded);
    }
  }

  // LRC parser: returns array of {time: seconds, text: string}
  function parseLrc(lrcText){
    const lines = lrcText.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
    const result = [];
    const timeRegex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;
    for(const line of lines){
      let match; const times = [];
      while((match = timeRegex.exec(line)) !== null){ const m = match; const mm = parseInt(m[1],10); const ss = parseInt(m[2],10); const ms = m[3] ? parseInt(m[3].padEnd(3,'0'),10) : 0; times.push(mm*60 + ss + (ms/1000)); }
      const text = line.replace(timeRegex,'').trim(); times.forEach(t => { result.push({time:t,text}); });
    }
    result.sort((a,b)=>a.time - b.time);
    return result;
  }

  // If we had LRC lines in state.lrcLines (array), sync that instead
  function syncLrc(curTime){ if(!state.lrcLines || !state.lrcLines.length) return; // find last index <= curTime
    let idx = 0; for(let i=0;i<state.lrcLines.length;i++){ if(curTime >= state.lrcLines[i].time) idx = i; else break; }
    // show only idx line
    const nodes = refs.lyricsBox.querySelectorAll('.lyric-line'); nodes.forEach((n,i)=>{ n.classList.toggle('show', i===idx); }); }

  /* ---------- GLASS BLOBS ---------- */
  function makeBlob({size=320,x=10,y=10,gradient}){ const d = document.createElement('div'); d.className='blob'; d.style.width = size+'px'; d.style.height = size+'px'; d.style.left = x+'%'; d.style.top = y+'%'; d.style.background = gradient || 'radial-gradient(circle at 30% 30%, rgba(29,185,84,0.9), rgba(29,185,84,0.12))'; refs.blobs.appendChild(d); d.animate([{transform:'translateY(0)'},{transform:'translateY(-20px)'},{transform:'translateY(0)'}],{duration:4200 + Math.random()*3000,iterations:Infinity,easing:'ease-in-out'}); }
  function genBlobs(){ refs.blobs.innerHTML = ''; makeBlob({size:360,x:4,y:8,gradient:'radial-gradient(circle at 20% 20%, rgba(29,185,84,0.85), rgba(29,185,84,0.12))'}); makeBlob({size:300,x:62,y:6,gradient:'radial-gradient(circle at 30% 30%, rgba(255,90,90,0.9), rgba(255,90,90,0.14))'}); makeBlob({size:260,x:30,y:48,gradient:'radial-gradient(circle at 35% 35%, rgba(40,120,255,0.85), rgba(40,120,255,0.12))'}); }

  /* ---------- THEME & SHORTCUTS ---------- */
  refs.themeToggle.addEventListener('change', ()=>{ if(refs.themeToggle.checked){ document.body.classList.add('light'); } else { document.body.classList.remove('light'); } });

  // keyboard shortcuts
  window.addEventListener('keydown', (e)=>{
    if(e.code === 'Space' && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); togglePlay(); }
    if(e.key === 'ArrowRight') next();
    if(e.key === 'ArrowLeft') prev();
  });

  /* ---------- INIT ---------- */
  function init(){ render(); genBlobs(); setTrack(0,0); // preload first
    // hookup controls
    refs.playBtn.addEventListener('click', ()=>{ togglePlay(); });
    refs.prevBtn.addEventListener('click', ()=> prev());
    refs.nextBtn.addEventListener('click', ()=> next());

    // small touch: click cover to toggle lyrics show/hide
    refs.cover.addEventListener('click', ()=>{ refs.lyricsBox.classList.toggle('hidden'); });

    // progress drag/seek support (pointer events)
    let dragging = false;
    refs.progressBar.addEventListener('pointerdown', (e)=>{ dragging = true; seekFromEvent(e); });
    window.addEventListener('pointermove', (e)=>{ if(dragging) seekFromEvent(e); });
    window.addEventListener('pointerup', ()=>{ dragging = false; });

    function seekFromEvent(e){ const rect = refs.progressBar.getBoundingClientRect(); const x = e.clientX - rect.left; const pct = Math.max(0, Math.min(1, x / rect.width)); if(isFinite(audio.duration)) audio.currentTime = pct * audio.duration; }

    // click on lyric box toggles manual each-line visibility
    refs.lyricsBox.addEventListener('click', ()=>{ const nodes = refs.lyricsBox.querySelectorAll('.lyric-line'); nodes.forEach(n=>n.classList.toggle('show')); });

    // handle LRC files if you later provide them (example usage: fetch and parse then set state.lrcLines and render DOM)
    // usage: loadLrcTextAndRender(lrcText)

    // respond to resize for blob regen
    let t; window.addEventListener('resize', ()=>{ clearTimeout(t); t=setTimeout(genBlobs,300); });
  }

  function loadLrcTextAndRender(lrcText){ // call this if you load an lrc file for current track
    const parsed = parseLrc(lrcText); state.lrcLines = parsed; // render DOM lines
    refs.lyricsBox.innerHTML = ''; parsed.forEach(p=>{ const el = document.createElement('div'); el.className='lyric-line'; el.textContent = p.text; refs.lyricsBox.appendChild(el); });
  }

  // expose some helpers for dev console
  window.SpotifyClone = {setTrack, play, pause, next, prev, DATA, loadLrcTextAndRender};

  init();

})();
