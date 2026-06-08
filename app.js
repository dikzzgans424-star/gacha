/* ══════════════════════════════════════
   CORE — ID check, info card, routing
══════════════════════════════════════ */

/* ── DOM refs ── */
const statusText = document.getElementById('statusText');
const statusDot  = document.getElementById('statusDot');

/* ── State ── */
let currentFile   = null;
let currentGacha  = null;
let _gameFinished = false;

/* ── Game registry ── */
const GAMES = {
  slot3x3:  () => Slot3x3,
  roulette: () => Roulette,
};

/* ────────────────────────────────────────
   HELPERS
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
──────────────────────────────────────── */
async function startSpin() {
  if (_gameFinished) {
    setStatus('⛔ Sesi selesai — refresh halaman untuk ID baru.');
    shakeInput();
    return;
  }

  const id = document.getElementById('gachaId').value.trim().toUpperCase();
  if (!id) { setStatus('⚠ Masukkan ID Gacha terlebih dahulu.'); shakeInput(); return; }

  const btn = document.getElementById('spinBtn');
  btn.disabled = true;
  setStatus('Mengecek ID...', true);

  try {
    currentFile  = await getGachaData();
    currentGacha = currentFile.data.gacha.find(x => x.idgacha.toUpperCase() === id);

    if (!currentGacha) { setStatus('❌ ID Tidak Ditemukan'); btn.disabled = false; return; }
    if (currentGacha.status) { setStatus('❌ ID Sudah Diproses'); btn.disabled = false; return; }

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
  const typeLabel = { slot3x3: '🎰 Slot 3×3', roulette: '🎡 Roulette' }[gacha.type] || '🎰 Slot';
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

  /* Hapus gameArea lama kalau ada */
  hideGame();
}

/* ────────────────────────────────────────
   STEP 3 — LOAD GAME
──────────────────────────────────────── */
function revealGame() {
  if (!currentGacha || _gameFinished) return;

  const type       = currentGacha.type || 'slot3x3';
  const getGame    = GAMES[type] ?? GAMES['slot3x3'];
  const gameModule = getGame();

  /*
   * Init game — modul akan replaceWith info card di posisi yang sama.
   * Info card TIDAK dihapus di sini; gameModule.init() yang handle replace.
   */
  gameModule.init(currentGacha, onGameResult);
}

function hideGame() {
  const existing = document.getElementById('gameArea');
  if (existing) existing.remove();
}

/* ────────────────────────────────────────
   RESULT CALLBACK
──────────────────────────────────────── */
async function onGameResult(isWin, money) {
  _gameFinished = true;

  currentGacha.status     = true;
  currentGacha.result     = isWin ? 'win' : 'lose';
  currentGacha.finishedAt = Date.now();

  /* Lock input */
  const spinBtn    = document.getElementById('spinBtn');
  const gachaInput = document.getElementById('gachaId');
  if (spinBtn)    { spinBtn.disabled = true; spinBtn.textContent = '🔒'; }
  if (gachaInput) gachaInput.disabled = true;

  /* Simpan hasil */
  setStatus('💾 Menyimpan hasil...', true);

  let saveOk = false;
  try {
    const freshFile = await getGachaData();
    const idx = freshFile.data.gacha.findIndex(
      x => x.idgacha.toUpperCase() === currentGacha.idgacha.toUpperCase()
    );
    if (idx !== -1) {
      freshFile.data.gacha[idx].status     = true;
      freshFile.data.gacha[idx].result     = currentGacha.result;
      freshFile.data.gacha[idx].finishedAt = currentGacha.finishedAt;
    }
    await saveGachaData(freshFile.data, freshFile.sha);
    saveOk = true;
  } catch (err) {
    console.error('Save error:', err);
  }

  /* Update status card */
  if (isWin) {
    setStatus(
      `🎉 SELAMAT! Kamu menang!\n` +
      `💰 Hadiah: Rp ${Number(money).toLocaleString('id-ID')}\n` +
      `📌 Ketik .cekgacha di bot WhatsApp untuk klaim.\n` +
      `🆔 ID: ${currentGacha.idgacha}\n` +
      `${saveOk ? '✓ Hasil tersimpan' : '⚠ Gagal menyimpan'}`,
      true
    );
  } else {
    setStatus(
      `💀 Belum beruntung kali ini...\n` +
      `${saveOk ? '✓ Hasil tersimpan' : '⚠ Gagal menyimpan'}`,
      false
    );
  }

  hideGame();
  showResultInline(isWin, money, saveOk);
}

/* ────────────────────────────────────────
   RESULT — inline (enhanced)
──────────────────────────────────────── */
function showResultInline(isWin, money, saveOk = true) {
  const area = document.createElement('div');
  area.id        = 'gameArea';
  area.className = 'game-area';

  const panelClass  = isWin ? 'win-panel'  : 'lose-panel';
  const badgeClass  = isWin ? 'win'        : 'lose';
  const badgeLabel  = isWin ? '● WIN'      : '● LOSE';
  const emoji       = isWin ? '🎉'         : '💀';
  const title       = isWin ? 'Jackpot!'   : 'Belum Beruntung';
  const moneyClass  = isWin ? 'win'        : 'lose';
  const moneyPrefix = isWin ? '+'          : '−';
  const desc        = isWin
    ? 'Selamat! Hadiah akan segera diproses.'
    : 'Lebih beruntung di lain kesempatan.';

  const saveNote = saveOk
    ? `<div class="result-save-ok">✓ Hasil tersimpan</div>`
    : `<div class="result-save-err">⚠ Gagal menyimpan — hubungi admin dengan ID: ${currentGacha?.idgacha || '-'}</div>`;

  /* Claim info hanya tampil saat WIN */
  const claimInfo = isWin ? `
    <div class="result-claim-box">
      <div class="result-claim-title">📌 Cara Klaim Hadiah</div>
      <div class="result-claim-step">
        <span class="result-claim-num">1</span>
        <span>Buka bot WhatsApp Miwa</span>
      </div>
      <div class="result-claim-step">
        <span class="result-claim-num">2</span>
        <span>Ketik perintah <code>.cekgacha</code></span>
      </div>
      <div class="result-claim-step">
        <span class="result-claim-num">3</span>
        <span>Hadiah akan otomatis diproses</span>
      </div>
      <div class="result-claim-id">
        <span class="result-claim-id-label">ID GACHA</span>
        <span class="result-claim-id-value">${currentGacha?.idgacha || '-'}</span>
      </div>
    </div>
  ` : '';

  /* Extra motivasi saat lose */
  const loseExtra = !isWin ? `
    <div class="result-lose-extra">
      <div class="result-lose-icon">🎲</div>
      <div class="result-lose-msg">Jangan menyerah! Coba lagi dengan ID baru.</div>
    </div>
  ` : '';

  area.innerHTML = `
    <div class="result-panel ${panelClass}">
      <span class="result-emoji">${emoji}</span>
      <div class="result-badge ${badgeClass}">${badgeLabel}</div>
      <div class="result-title">${title}</div>
      <div class="result-money ${moneyClass}">${moneyPrefix} Rp ${Number(money).toLocaleString('id-ID')}</div>
      <div class="result-desc">${desc}</div>
      ${claimInfo}
      ${loseExtra}
      <div class="result-meta">${saveNote}</div>
      <div class="result-divider"></div>
      <button class="close-btn" onclick="closeResultInline()">Tutup</button>
    </div>
  `;

  /* Selalu insert tepat setelah glass-card */
  document.querySelector('.glass-card').insertAdjacentElement('afterend', area);
}

function closeResultInline() {
  hideGame();
}

/* ── Events ── */
document.getElementById('gachaId').addEventListener('keydown', e => {
  if (e.key === 'Enter') startSpin();
});
