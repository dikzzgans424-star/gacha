/* ══════════════════════════════════════
   CORE — ID check, info card, routing
══════════════════════════════════════ */

/* ── DOM refs ── */
const statusText    = document.getElementById('statusText');
const statusDot     = document.getElementById('statusDot');
const resultOverlay = document.getElementById('resultOverlay');
const resultEmoji   = document.getElementById('resultEmoji');
const resultTitle   = document.getElementById('resultTitle');
const resultDesc    = document.getElementById('resultDesc');

/* ── State ── */
let currentFile   = null;
let currentGacha  = null;
let _gameFinished = false; // session lock — reset hanya oleh refresh halaman

/* ── Game registry — daftarkan game baru di sini ── */
const GAMES = {
  slot3x3:  () => Slot3x3,
  roulette: () => Roulette,
};

/* ────────────────────────────────────────
   HELPERS (global agar bisa dipanggil game files)
──────────────────────────────────────── */
function setStatus(msg, active = false) {
  statusText.textContent = msg;
  statusDot.classList.toggle('active', active);
}

function shakeInput() {
  const inp = document.getElementById('gachaId');
  inp.style.animation = 'none';
  inp.getBoundingClientRect();
  inp.style.animation = 'shake 0.4s ease';
}

/* ────────────────────────────────────────
   API
──────────────────────────────────────── */
async function getGachaData() {
  /* Cache-busting agar browser tidak pakai response lama */
  const res = await fetch('/.netlify/functions/gacha?_=' + Date.now());
  if (!res.ok) throw new Error('Gagal mengambil data dari server');
  const json = await res.json();
  if (!json.content) throw new Error(json.message || 'Content tidak ditemukan');
  return {
    sha:  json.sha,
    data: JSON.parse(atob(json.content.replace(/\n/g, '')))
  };
}

async function saveGachaData(data, sha) {
  const res = await fetch('/.netlify/functions/gacha-update', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ data, sha })
  });
  if (!res.ok) throw new Error('Gagal menyimpan data');
}

/* ────────────────────────────────────────
   STEP 1 — CEK ID
   • Re-fetch fresh setiap kali dipanggil
   • Blok jika session sudah selesai
──────────────────────────────────────── */
async function startSpin() {
  /* Kalau session ini sudah ada result, tolak langsung */
  if (_gameFinished) {
    setStatus('⛔ Sesi selesai — refresh halaman untuk ID baru.');
    shakeInput();
    return;
  }

  const id = document.getElementById('gachaId').value.trim().toUpperCase();

  if (!id) {
    setStatus('⚠ Masukkan ID Gacha terlebih dahulu.');
    shakeInput();
    return;
  }

  const btn = document.getElementById('spinBtn');
  btn.disabled = true;
  setStatus('🔍 Mengecek ID...', true);

  try {
    /* Fresh fetch setiap kali — deteksi status terbaru dari server */
    currentFile  = await getGachaData();
    currentGacha = currentFile.data.gacha.find(x => x.idgacha.toUpperCase() === id);

    if (!currentGacha) {
      setStatus('❌ ID Tidak Ditemukan');
      btn.disabled = false;
      return;
    }

    if (currentGacha.status) {
      setStatus('❌ ID Sudah Diproses');
      btn.disabled = false;
      return;
    }

    showGachaInfo(currentGacha);
    btn.disabled = false;

  } catch (err) {
    console.error(err);
    setStatus('❌ ERROR: ' + err.message);
    btn.disabled = false;
  }
}

/* ────────────────────────────────────────
   STEP 2 — INFO CARD
──────────────────────────────────────── */
function showGachaInfo(gacha) {
  const typeLabel = {
    slot3x3:  '🎰 Slot 3×3',
    roulette: '🎡 Roulette',
  }[gacha.type] || '🎰 Slot';

  const badge = gacha.isPremium
    ? `<span class="badge-premium">★ PREMIUM</span>`
    : `<span class="badge-regular">REGULAR</span>`;

  setStatus('✅ ID Valid — siap dimainkan');

  let infoCard = document.getElementById('gachaInfoCard');
  if (!infoCard) {
    infoCard = document.createElement('div');
    infoCard.id = 'gachaInfoCard';
    infoCard.className = 'info-card';
    document.querySelector('.glass-card').insertAdjacentElement('afterend', infoCard);
  }

  infoCard.innerHTML = `
    <div class="info-card-header">
      <span class="info-card-title">Detail Gacha</span>
      <span class="info-card-id">${gacha.idgacha}</span>
    </div>
    <div class="info-grid">
      <div class="info-cell">
        <div class="info-cell-label">Nama</div>
        <div class="info-cell-value">${gacha.name || gacha.idgacha}</div>
      </div>
      <div class="info-cell">
        <div class="info-cell-label">Tier</div>
        <div class="info-cell-value">${badge}</div>
      </div>
      <div class="info-cell">
        <div class="info-cell-label">Game</div>
        <div class="info-cell-value">${typeLabel}</div>
      </div>
      <div class="info-cell">
        <div class="info-cell-label">Hadiah</div>
        <div class="info-cell-value gold">Rp ${Number(gacha.money).toLocaleString('id-ID')}</div>
      </div>
    </div>
    <button class="start-game-btn" onclick="revealGame()">▶ &nbsp;Mulai Game</button>
  `;

  infoCard.classList.remove('hide');
  requestAnimationFrame(() => infoCard.classList.add('show'));

  hideGame();
}

/* ────────────────────────────────────────
   STEP 3 — LOAD GAME
   • Blok jika session sudah selesai
──────────────────────────────────────── */
function revealGame() {
  if (!currentGacha || _gameFinished) return;

  const infoCard = document.getElementById('gachaInfoCard');
  if (infoCard) {
    infoCard.classList.remove('show');
    infoCard.classList.add('hide');
  }

  hideGame();

  const type       = currentGacha.type || 'slot3x3';
  const getGame    = GAMES[type] ?? GAMES['slot3x3'];
  const gameModule = getGame();

  gameModule.init(currentGacha, onGameResult);
}

function hideGame() {
  const existing = document.getElementById('gameArea');
  if (existing) existing.remove();
}

/* ────────────────────────────────────────
   RESULT CALLBACK (dipanggil dari game file)
   • Set _gameFinished = true → semua entry point terblokir
   • Re-fetch fresh sebelum save untuk dapat SHA terbaru
──────────────────────────────────────── */
async function onGameResult(isWin, money) {
  /* Tandai session selesai — blok semua aksi lebih lanjut */
  _gameFinished = true;

  currentGacha.status     = true;
  currentGacha.result     = isWin ? 'win' : 'lose';
  currentGacha.finishedAt = Date.now();

  /* Lock UI */
  const spinGameBtn = document.getElementById('spinGameBtn');
  if (spinGameBtn) spinGameBtn.disabled = true;
  const spinBtn = document.getElementById('spinBtn');
  if (spinBtn) { spinBtn.disabled = true; spinBtn.textContent = '🔒'; }
  const gachaInput = document.getElementById('gachaId');
  if (gachaInput) gachaInput.disabled = true;

  try {
    /*
     * Re-fetch fresh data sebelum save.
     * Ini penting agar SHA yang kita kirim adalah SHA terbaru dari server,
     * bukan SHA dari fetch pertama (yang bisa sudah stale kalau ada update lain).
     */
    const freshFile = await getGachaData();
    /* Terapkan perubahan ke data fresh */
    const idx = freshFile.data.gacha.findIndex(
      x => x.idgacha.toUpperCase() === currentGacha.idgacha.toUpperCase()
    );
    if (idx !== -1) {
      freshFile.data.gacha[idx].status     = true;
      freshFile.data.gacha[idx].result     = currentGacha.result;
      freshFile.data.gacha[idx].finishedAt = currentGacha.finishedAt;
    }
    await saveGachaData(freshFile.data, freshFile.sha);
  } catch (err) {
    console.error('Save error:', err);
  }

  setStatus(isWin ? '🏆 WIN!' : '💀 LOSE');

  /* Hapus game area dari DOM — cegah spin ulang via tombol yang masih ada */
  hideGame();

  showResult(isWin, money);
}

/* ────────────────────────────────────────
   RESULT OVERLAY
──────────────────────────────────────── */
function showResult(isWin, money) {
  const badge = document.getElementById('resultBadge');

  if (isWin) {
    resultEmoji.textContent = '🎉';
    resultTitle.textContent = 'Jackpot!';
    resultDesc.textContent  = `+ Rp ${Number(money).toLocaleString('id-ID')}`;
    if (badge) { badge.className = 'result-badge win'; badge.textContent = '● WIN'; }
  } else {
    resultEmoji.textContent = '💀';
    resultTitle.textContent = 'Belum Beruntung';
    resultDesc.textContent  = `- Rp ${Number(money).toLocaleString('id-ID')}`;
    if (badge) { badge.className = 'result-badge lose'; badge.textContent = '● LOSE'; }
  }

  resultOverlay.style.display = 'flex';
}

function closeResult() {
  resultOverlay.style.display = 'none';
}

/* ── Events ── */
resultOverlay.addEventListener('click', e => { if (e.target === resultOverlay) closeResult(); });
document.getElementById('gachaId').addEventListener('keydown', e => { if (e.key === 'Enter') startSpin(); });
