// ==== BASIC INTERACTIVITY FOR SPOTIFY UI CLONE ====
// This is your main script file. Plug it into your HTML with:
// <script src="script.js"></script>

// ======== DYNAMIC PLAYLIST DATA ========
const playlists = [
  {
    title: "Dump playlist",
    artist: "gyuurin",
    img: "https://via.placeholder.com/80x80/1db954/ffffff?text=♫"
  },
  {
    title: "me, you, us and ducks",
    artist: "gyuurin",
    img: "https://via.placeholder.com/80x80/333333/ffffff?text=🦆"
  },
  {
    title: "Lastri, sayang?",
    artist: "ky",
    img: "https://via.placeholder.com/80x80/ff5555/ffffff?text=❤"
  }
];

// Insert playlists into sidebar
const libraryContainer = document.querySelector('.library-items');

function loadLibrary() {
  playlists.forEach((pl) => {
    const item = document.createElement('div');
    item.classList.add('card');

    item.innerHTML = `
      <img src="${pl.img}" style="width:60px;height:60px;border-radius:8px;" />
      <div>
        <h4>${pl.title}</h4>
        <p style="color:#aaa;font-size:0.9rem;">${pl.artist}</p>
      </div>
    `;

    // click → update now playing preview
    item.addEventListener('click', () => setNowPlaying(pl));

    libraryContainer.appendChild(item);
  });
}

// ======== NOW PLAYING SECTION ========
const nowTitle = document.querySelector('.text-box h3');
const nowArtist = document.querySelector('.text-box p');
const nowImg = document.querySelector('.img-box');

function setNowPlaying(song) {
  nowTitle.textContent = song.title;
  nowArtist.textContent = song.artist;
  nowImg.style.backgroundImage = `url(${song.img})`;
  nowImg.style.backgroundSize = "cover";
  nowImg.style.backgroundPosition = "center";
}

// ======== PLAYER BAR ========
const playBtn = document.querySelector('.controls button:nth-child(2)');
let isPlaying = false;

playBtn.addEventListener('click', () => {
  isPlaying = !isPlaying;
  playBtn.textContent = isPlaying ? '❚❚' : '▶';
});

// ======== SEARCH BAR INTERACTION ========
const searchBar = document.querySelector('.search-bar');
searchBar.addEventListener('focus', () => {
  searchBar.style.background = '#2b2b2b';
});
searchBar.addEventListener('blur', () => {
  searchBar.style.background = '#1b1b1b';
});

// Init
loadLibrary();
