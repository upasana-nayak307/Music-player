// ===================================================================
// SAMPLE PLAYLIST DATA
// Using Web Audio API since <audio> is sandboxed
// ===================================================================
const SONGS = [
  { title: "Neon Dreams", artist: "Synthwave Collective", emoji: "🌃", duration: 214 },
  { title: "Midnight Drive", artist: "Lo-Fi Beats", emoji: "🚗", duration: 187 },
  { title: "Crystal Waves", artist: "Ambient Studio", emoji: "🌊", duration: 243 },
  { title: "Purple Horizon", artist: "Chillstep Crew", emoji: "🌅", duration: 198 },
  { title: "Digital Rain", artist: "Cyber Pulse", emoji: "🌧️", duration: 226 },
  { title: "Starlight Cafe", artist: "Jazz Fusion", emoji: "☕", duration: 172 },
  { title: "Aurora Borealis", artist: "Nordic Sound", emoji: "🌌", duration: 259 },
  { title: "Ocean Breath", artist: "Zen Garden", emoji: "🧘", duration: 301 },
];

// ===================================================================
// STATE
// ===================================================================
let currentIndex = -1;
let isPlaying = false;
let shuffle = false;
let repeatMode = 0; // 0=off, 1=all, 2=one
let progress = 0; // seconds elapsed
let volume = 0.8;
let intervalId = null;
let uploadedSongs = [];

// Audio context for generating tones
let audioCtx = null;
let oscillator = null;
let gainNode = null;

// Note frequencies for each song (pentatonic scale patterns)
const SCALES = [
  [261, 293, 329, 392, 440],
  [220, 246, 277, 329, 369],
  [329, 369, 415, 493, 554],
  [196, 220, 261, 293, 329],
  [349, 392, 440, 523, 587],
  [293, 329, 369, 440, 493],
  [415, 466, 523, 587, 659],
  [174, 196, 220, 261, 293],
];

// ===================================================================
// DOM REFS
// ===================================================================
const $ = id => document.getElementById(id);
const playBtn = $('playBtn');
const prevBtn = $('prevBtn');
const nextBtn = $('nextBtn');
const shuffleBtn = $('shuffleBtn');
const repeatBtn = $('repeatBtn');
const progressTrack = $('progressTrack');
const progressFill = $('progressFill');
const currentTimeEl = $('currentTime');
const durationEl = $('duration');
const volumeSlider = $('volumeSlider');
const songTitle = $('songTitle');
const songArtist = $('songArtist');
const albumArt = $('albumArt');
const playlistEl = $('playlist');
const toastEl = $('toast');
const uploadInput = $('uploadInput');

// ===================================================================
// FORMAT TIME
// ===================================================================
function fmt(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m + ':' + (sec < 10 ? '0' : '') + sec;
}

// ===================================================================
// GET ALL SONGS (built-in + uploaded)
// ===================================================================
function allSongs() { return [...SONGS, ...uploadedSongs]; }

// ===================================================================
// RENDER PLAYLIST
// ===================================================================
function renderPlaylist() {
  const songs = allSongs();
  playlistEl.innerHTML = '';
  songs.forEach((s, i) => {
    const div = document.createElement('div');
    div.className = 'pl-item' + (i === currentIndex ? ' active' : '');
    div.innerHTML = `
      <div class="pl-thumb">${s.emoji || '🎵'}</div>
      <div class="flex-1 min-w-0">
        <div class="text-white text-lg font-medium truncate">${s.title}</div>
        <div class="text-gray-500 text-lg truncate">${s.artist}</div>
      </div>
      <div class="eq-bars"><span></span><span></span><span></span></div>
      <span class="text-gray-600 text-lg">${fmt(s.duration)}</span>
    `;
    div.addEventListener('click', () => playSong(i));
    playlistEl.appendChild(div);
  });
}

// ===================================================================
// TOAST
// ===================================================================
let toastTimer;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2500);
}

// ===================================================================
// WEB AUDIO - generate simple melody per song
// ===================================================================
function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    gainNode = audioCtx.createGain();
    gainNode.gain.value = volume;
    gainNode.connect(audioCtx.destination);
  }
}

let melodyInterval;
let noteIndex = 0;

function startMelody(songIdx) {
  stopMelody();
  initAudio();
  const scale = SCALES[songIdx % SCALES.length];
  noteIndex = 0;

  function playNote() {
    if (oscillator) { try { oscillator.stop(); } catch(e){} }
    oscillator = audioCtx.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = scale[noteIndex % scale.length];
    oscillator.connect(gainNode);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.4);
    noteIndex++;
  }
  playNote();
  melodyInterval = setInterval(playNote, 500);
}

function stopMelody() {
  clearInterval(melodyInterval);
  if (oscillator) { try { oscillator.stop(); } catch(e){} oscillator = null; }
}

// ===================================================================
// PLAY SONG
// ===================================================================
function playSong(idx) {
  const songs = allSongs();
  if (idx < 0 || idx >= songs.length) return;
  currentIndex = idx;
  progress = 0;
  const song = songs[idx];

  songTitle.textContent = song.title;
  songArtist.textContent = song.artist;
  albumArt.querySelector('.note').textContent = song.emoji || '🎵';
  durationEl.textContent = fmt(song.duration);
  currentTimeEl.textContent = '0:00';
  progressFill.style.width = '0%';

  renderPlaylist();
  showToast(`🎵 Now Playing: ${song.title}`);

  isPlaying = true;
  updatePlayButton();
  albumArt.classList.add('playing');
  startProgress();
  startMelody(idx);
}

// ===================================================================
// PROGRESS SIMULATION
// ===================================================================
function startProgress() {
  clearInterval(intervalId);
  intervalId = setInterval(() => {
    if (!isPlaying) return;
    const song = allSongs()[currentIndex];
    if (!song) return;
    progress += 0.25;
    if (progress >= song.duration) {
      handleSongEnd();
      return;
    }
    progressFill.style.width = (progress / song.duration * 100) + '%';
    currentTimeEl.textContent = fmt(progress);
  }, 250);
}

function handleSongEnd() {
  if (repeatMode === 2) {
    // Repeat one
    progress = 0;
    startMelody(currentIndex);
  } else {
    playNext();
  }
}

// ===================================================================
// CONTROLS
// ===================================================================
function togglePlay() {
  if (currentIndex === -1) { playSong(0); return; }
  isPlaying = !isPlaying;
  updatePlayButton();
  if (isPlaying) {
    albumArt.classList.add('playing');
    startMelody(currentIndex);
    startProgress();
  } else {
    albumArt.classList.remove('playing');
    stopMelody();
  }
}

function updatePlayButton() {
  playBtn.innerHTML = isPlaying
    ? '<i data-lucide="pause" style="width:26px;height:26px"></i>'
    : '<i data-lucide="play" style="width:26px;height:26px"></i>';
  lucide.createIcons();
}

function playNext() {
  const songs = allSongs();
  if (songs.length === 0) return;
  let next;
  if (shuffle) {
    next = Math.floor(Math.random() * songs.length);
    if (next === currentIndex && songs.length > 1) next = (next + 1) % songs.length;
  } else {
    next = currentIndex + 1;
    if (next >= songs.length) next = repeatMode >= 1 ? 0 : songs.length - 1;
  }
  playSong(next);
}

function playPrev() {
  const songs = allSongs();
  if (songs.length === 0) return;
  // If more than 3 seconds in, restart current song
  if (progress > 3) { playSong(currentIndex); return; }
  let prev = currentIndex - 1;
  if (prev < 0) prev = repeatMode >= 1 ? songs.length - 1 : 0;
  playSong(prev);
}

// ===================================================================
// EVENT LISTENERS
// ===================================================================
playBtn.addEventListener('click', togglePlay);
nextBtn.addEventListener('click', playNext);
prevBtn.addEventListener('click', playPrev);

shuffleBtn.addEventListener('click', () => {
  shuffle = !shuffle;
  shuffleBtn.classList.toggle('active', shuffle);
  showToast(shuffle ? '🔀 Shuffle On' : 'Shuffle Off');
});

repeatBtn.addEventListener('click', () => {
  repeatMode = (repeatMode + 1) % 3;
  repeatBtn.classList.toggle('active', repeatMode > 0);
  const labels = ['Repeat Off', '🔁 Repeat All', '🔂 Repeat One'];
  repeatBtn.innerHTML = repeatMode === 2
    ? '<i data-lucide="repeat-1" style="width:18px;height:18px"></i>'
    : '<i data-lucide="repeat" style="width:18px;height:18px"></i>';
  lucide.createIcons();
  showToast(labels[repeatMode]);
});

// Seek
progressTrack.addEventListener('click', (e) => {
  if (currentIndex === -1) return;
  const rect = progressTrack.getBoundingClientRect();
  const pct = (e.clientX - rect.left) / rect.width;
  const song = allSongs()[currentIndex];
  progress = pct * song.duration;
  progressFill.style.width = (pct * 100) + '%';
  currentTimeEl.textContent = fmt(progress);
});

// Volume
volumeSlider.addEventListener('input', (e) => {
  volume = e.target.value / 100;
  if (gainNode) gainNode.gain.value = volume;
});

// Keyboard controls
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  switch (e.code) {
    case 'Space': e.preventDefault(); togglePlay(); break;
    case 'ArrowRight': playNext(); break;
    case 'ArrowLeft': playPrev(); break;
    case 'ArrowUp': e.preventDefault(); volumeSlider.value = Math.min(100, +volumeSlider.value + 5); volumeSlider.dispatchEvent(new Event('input')); break;
    case 'ArrowDown': e.preventDefault(); volumeSlider.value = Math.max(0, +volumeSlider.value - 5); volumeSlider.dispatchEvent(new Event('input')); break;
  }
});

// Upload songs
uploadInput.addEventListener('change', (e) => {
  const files = e.target.files;
  for (const f of files) {
    uploadedSongs.push({
      title: f.name.replace(/\.[^.]+$/, ''),
      artist: 'My Upload',
      emoji: '📁',
      duration: 180 + Math.floor(Math.random() * 120)
    });
  }
  renderPlaylist();
  showToast(`📁 Added ${files.length} song(s)`);
  // Save names to localStorage
  try {
    localStorage.setItem('uploadedSongs', JSON.stringify(uploadedSongs));
  } catch(e){}
});

// Restore uploads from localStorage
try {
  const saved = JSON.parse(localStorage.getItem('uploadedSongs'));
  if (saved) uploadedSongs = saved;
} catch(e){}

// ===================================================================
// ELEMENT SDK INIT
// ===================================================================
const defaultConfig = {
  hero_title: 'Music Player',
  hero_subtitle: 'Feel every beat',
  background_color: '#0a0a1a',
  surface_color: 'rgba(255,255,255,0.06)',
  text_color: '#e2e8f0',
  primary_action: '#a855f7',
  secondary_action: '#06b6d4',
  font_family: 'Outfit',
  font_size: 16
};

function applyConfig(config) {
  const c = { ...defaultConfig, ...config };
  $('heroTitle').textContent = c.hero_title;
  $('heroSubtitle').textContent = c.hero_subtitle;
  $('app-wrapper').style.background = c.background_color;

  document.querySelectorAll('.glass, .glass-strong').forEach(el => {
    el.style.borderColor = c.surface_color;
  });

  document.querySelectorAll('.text-white, h1, h2, h3').forEach(el => {
    el.style.color = c.text_color;
  });

  const font = c.font_family + ', Outfit, sans-serif';
  document.body.style.fontFamily = font;

  const base = c.font_size || 16;
  $('heroTitle').style.fontSize = `${base * 2.8}px`;
  $('heroSubtitle').style.fontSize = `${base * 1.1}px`;
  $('songTitle').style.fontSize = `${base * 1.5}px`;
  $('songArtist').style.fontSize = `${base * 0.85}px`;
}

// ===================================================================
// INIT
// ===================================================================
renderPlaylist();
lucide.createIcons();