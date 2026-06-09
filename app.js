/* ══════════════════════════════════════
   CORE — Token system, game picker, balance
   
   ALUR:
   1. User input token (dari bot WA)
   2. Cek token → tampil saldo & pilih game
   3. User pilih game + jumlah bet
   4. Main → hasil update saldo token
   5. User bisa main lagi atau withdraw
══════════════════════════════════════ */

/* ── DOM refs ── */
const statusText = document.getElementById('statusText');
const statusDot  = document.getElementById('statusDot');

/* ── State ── */
let currentFile  = null;   // raw file + sha dari GitHub
let currentToken = null;   // object token yang sedang aktif
let _gameActive  = false;  // ada game yang sedang berjalan

/* ── Multiplier per game (1 bet = 1k) ── */
const GAME_MULTIPLIER = {
  slot3x3:   2,
  roulette:  2,
  coinflip:  2,
  horserace: 2,
  spaceman:  null,  // dynamic, kena pajak 5%
};

const SPACEMAN_TAX = 0.05;  // 5% pajak

const GAME_LABELS = {
  slot3x3:   '🎰 Slot 3×3',
  roulette:  '🎡 Roulette',
  coinflip:  '🪙 Coin Flip',
  horserace: '🏇 Horse Race',
  spaceman:  '🚀 Spaceman',
};

/* ── Game registry ── */
const GAMES = {
  slot3x3:   () => Slot3x3,
  roulette:  () => Roulette,
  coinflip:  () => CoinFlip,
  spaceman:  () => Spaceman,
  horserace: () => HorseRace,
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

function formatRp(amount) {
  return 'Rp ' + Number(amount).toLocaleString('id-ID');
}

/* bet dalam satuan 1k → rupiah */
function betToRp(bet) {
  return bet * 1000;
}

/* ────────────────────────────────────────
   API — GitHub via Netlify Functions
──────────────────────────────────────── */
async function getTokenData() {
  const res = await fetch('/.netlify/functions/gacha?_=' + Date.now());
  if (!res.ok) throw new Error('Gagal mengambil data dari server');
  const json = await res.json();
  if (!json.content) throw new Error(json.message || 'Content tidak ditemukan');
  return {
    sha:  json.sha,
    data: JSON.parse(atob(json.content.replace(/\n/g, '')))
  };
}

async function saveTokenData(data, sha) {
  const res = await fetch('/.netlify/functions/gacha-update', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ data, sha })
  });
  if (!res.ok) throw new Error('Gagal menyimpan data');
}

/* ────────────────────────────────────────
   STEP 1 — CEK TOKEN
──────────────────────────────────────── */
async function startSpin() {
  if (_gameActive) {
    setStatus('⛔ Selesaikan game yang sedang berjalan dulu.');
    shakeInput();
    return;
  }

  const token = document.getElementById('gachaId').value.trim().toUpperCase();
  if (!token) { setStatus('⚠ Masukkan token terlebih dahulu.'); shakeInput(); return; }

  const btn = document.getElementById('spinBtn');
  btn.disabled = true;
  setStatus('Mengecek token...', true);

  try {
    currentFile  = await getTokenData();
    currentToken = (currentFile.data.tokens || []).find(
      t => t.token.toUpperCase() === token
    );

    if (!currentToken) {
      setStatus('❌ Token tidak ditemukan');
      btn.disabled = false;
      return;
    }
    if (currentToken.status === 'withdrawn') {
      setStatus('❌ Token sudah di-withdraw');
      btn.disabled = false;
      return;
    }
    if (currentToken.balance <= 0) {
      setStatus('❌ Saldo token habis');
      btn.disabled = false;
      return;
    }

    setStatus('✅ Token valid — pilih game!');
    showTokenDashboard();
    btn.disabled = false;

  } catch (err) {
    console.error(err);
    setStatus('❌ ERROR: ' + err.message);
    btn.disabled = false;
  }
}

/* ────────────────────────────────────────
   STEP 2 — DASHBOARD TOKEN
──────────────────────────────────────── */
function showTokenDashboard() {
  /* Hapus dashboard lama kalau ada */
  const old = document.getElementById('tokenDashboard');
  if (old) old.remove();
  hideGame();

  const dashboard = document.createElement('div');
  dashboard.id        = 'tokenDashboard';
  dashboard.className = 'info-card';

  const history = (currentToken.history || []).slice(-5).reverse();
  const historyHTML = history.length ? history.map(h => `
    <div class="token-history-row ${h.result}">
      <span class="token-history-game">${GAME_LABELS[h.game] || h.game}</span>
      <span class="token-history-bet">${h.bet} bet</span>
      <span class="token-history-result">${h.result === 'win' ? '▲ +' + h.change : '▼ −' + Math.abs(h.change)} bet</span>
    </div>
  `).join('') : `<div class="token-history-empty">Belum ada riwayat</div>`;

  dashboard.innerHTML = `
    <div class="info-card-header">
      <span class="info-card-title">💳 Token Aktif</span>
      <span class="info-card-id">${currentToken.token}</span>
    </div>

    <!-- Saldo besar -->
    <div class="token-balance-wrap">
      <div class="token-balance-label">SALDO TOKEN</div>
      <div class="token-balance-value" id="tokenBalanceDisplay">
        ${currentToken.balance} <span class="token-balance-unit">bet</span>
      </div>
      <div class="token-balance-rp">${formatRp(betToRp(currentToken.balance))}</div>
    </div>

    <!-- Pilih game -->
    <div class="token-game-section">
      <div class="token-section-label">PILIH GAME</div>
      <div class="token-game-grid">
        ${Object.entries(GAME_LABELS).map(([key, label]) => `
          <button class="token-game-btn" id="gameBtn_${key}"
                  onclick="selectGame('${key}')">
            ${label}
            <span class="token-game-multi">${
              key === 'spaceman'
                ? 'dynamic −5%'
                : GAME_MULTIPLIER[key] + 'x'
            }</span>
          </button>
        `).join('')}
      </div>
    </div>

    <!-- Riwayat 5 terakhir -->
    <div class="token-history-section">
      <div class="token-section-label">RIWAYAT TERAKHIR</div>
      ${historyHTML}
    </div>

    <!-- Withdraw -->
    <button class="token-withdraw-btn" onclick="confirmWithdraw()">
      💸 &nbsp;Withdraw Saldo ke WA
    </button>
  `;

  document.querySelector('.glass-card').insertAdjacentElement('afterend', dashboard);
  requestAnimationFrame(() => dashboard.classList.add('show'));
}

/* ── State game picker ── */
let _selectedGame = null;

function selectGame(game) {
  _selectedGame = game;
  openBetModal(game);
}

/* ────────────────────────────────────────
   BET MODAL
──────────────────────────────────────── */
function openBetModal(game) {
  /* Hapus modal lama kalau ada */
  const old = document.getElementById('betModal');
  if (old) old.remove();

  const label      = GAME_LABELS[game];
  const isSpaceman = game === 'spaceman';
  const multiText  = isSpaceman ? 'Dynamic − 5% pajak' : `${GAME_MULTIPLIER[game]}× kemenangan`;

  const modal = document.createElement('div');
  modal.id        = 'betModal';
  modal.className = 'bet-modal-overlay';
  modal.innerHTML = `
    <div class="bet-modal-box">

      <!-- Header -->
      <div class="bet-modal-header">
        <div class="bet-modal-game">${label}</div>
        <div class="bet-modal-multi">${multiText}</div>
        <button class="bet-modal-close" onclick="closeBetModal()">✕</button>
      </div>

      <!-- Saldo info -->
      <div class="bet-modal-balance">
        Saldo: <strong>${currentToken.balance} bet</strong>
        <span>(${formatRp(betToRp(currentToken.balance))})</span>
      </div>

      <!-- Input bet -->
      <div class="bet-modal-label">Jumlah Bet</div>
      <div class="bet-modal-input-row">
        <input id="betModalInput" type="number"
               min="1" max="${currentToken.balance}"
               placeholder="Masukkan jumlah bet..."
               oninput="onModalBetInput()"
               onkeydown="if(event.key==='Enter') submitBetModal()">
        <button class="bet-modal-max" onclick="setModalMaxBet()">MAX</button>
      </div>

      <!-- Preview prize -->
      <div class="bet-modal-preview" id="betModalPreview"></div>

      <!-- Quick pick -->
      <div class="bet-modal-quick-label">Pilih cepat</div>
      <div class="bet-modal-quick-row">
        ${[10, 25, 50, 100].filter(v => v <= currentToken.balance).map(v => `
          <button class="bet-modal-quick-btn" onclick="setModalBet(${v})">${v}</button>
        `).join('')}
        <button class="bet-modal-quick-btn" onclick="setModalBet(Math.floor(currentToken.balance/2))">½</button>
      </div>

      <!-- Mulai -->
      <button class="bet-modal-start" id="betModalStart"
              onclick="submitBetModal()" disabled>
        ▶ &nbsp;Mulai ${label}
      </button>

    </div>
  `;

  document.body.appendChild(modal);

  /* Animasi masuk */
  requestAnimationFrame(() => modal.classList.add('show'));

  /* Auto fokus input */
  setTimeout(() => {
    const inp = document.getElementById('betModalInput');
    if (inp) inp.focus();
  }, 150);
}

function closeBetModal() {
  const modal = document.getElementById('betModal');
  if (!modal) return;
  modal.classList.remove('show');
  setTimeout(() => modal.remove(), 250);
}

function setModalBet(amount) {
  const inp = document.getElementById('betModalInput');
  if (!inp) return;
  inp.value = Math.min(Math.max(1, Math.floor(amount)), currentToken.balance);
  onModalBetInput();
}

function setModalMaxBet() {
  setModalBet(currentToken.balance);
}

function onModalBetInput() {
  const inp = document.getElementById('betModalInput');
  const val = parseInt(inp?.value) || 0;
  const preview = document.getElementById('betModalPreview');
  const startBtn = document.getElementById('betModalStart');

  const valid = val >= 1 && val <= currentToken.balance;
  if (startBtn) startBtn.disabled = !valid;

  if (!preview) return;

  if (!val || val <= 0) {
    preview.textContent = '';
    preview.className   = 'bet-modal-preview';
    return;
  }
  if (val > currentToken.balance) {
    preview.textContent = '⚠ Melebihi saldo token';
    preview.className   = 'bet-modal-preview warn';
    return;
  }

  if (_selectedGame === 'spaceman') {
    preview.innerHTML = `
      Taruhan <strong>${val} bet</strong> (${formatRp(betToRp(val))})
      <br>Menang: <em>tergantung multiplier − 5% pajak</em>
    `;
  } else {
    const prize = val * GAME_MULTIPLIER[_selectedGame];
    preview.innerHTML = `
      Taruhan <strong>${val} bet</strong> (${formatRp(betToRp(val))})
      &nbsp;→&nbsp;
      Menang <strong class="gold">${prize} bet</strong> (${formatRp(betToRp(prize))})
    `;
  }
  preview.className = 'bet-modal-preview active';
}

function submitBetModal() {
  const inp = document.getElementById('betModalInput');
  const val = parseInt(inp?.value) || 0;

  if (val < 1 || val > currentToken.balance) return;

  closeBetModal();
  _currentBet = val;
  _launchGame();
}

/* ────────────────────────────────────────
   STEP 3 — LAUNCH GAME (dipanggil dari submitBetModal)
──────────────────────────────────────── */
let _currentBet = 0;

function _launchGame() {
  if (_gameActive || !_selectedGame || !currentToken) return;

  if (_currentBet < 1 || _currentBet > currentToken.balance) {
    setStatus('⚠ Jumlah bet tidak valid.');
    return;
  }

  _gameActive = true;

  /* Sembunyikan dashboard */
  const dashboard = document.getElementById('tokenDashboard');
  if (dashboard) dashboard.style.display = 'none';

  /* Buat gacha object yang kompatibel dengan game modules */
  const betRp   = betToRp(_currentBet);
  const prizeRp = _selectedGame === 'spaceman'
    ? betRp
    : betToRp(_currentBet * GAME_MULTIPLIER[_selectedGame]);

  const gameObj = {
    token:     currentToken.token,
    type:      _selectedGame,
    money:     prizeRp,
    betAmount: _currentBet,
    isPremium: currentToken.isPremium || false,
  };

  const getGame    = GAMES[_selectedGame] ?? GAMES['slot3x3'];
  const gameModule = getGame();
  gameModule.init(gameObj, onGameResult);

  setStatus(`🎮 ${GAME_LABELS[_selectedGame]} — bet ${_currentBet} bet`, true);
}

function hideGame() {
  const existing = document.getElementById('gameArea');
  if (existing) existing.remove();
}

/* ────────────────────────────────────────
   RESULT CALLBACK
   isWin     : boolean
   moneyWon  : Rp yang didapat (dari game module)
               untuk spaceman = bet * multiplier_cashout * (1-tax)
               untuk game lain = betToRp(_currentBet * multiplier)
──────────────────────────────────────── */
async function onGameResult(isWin, moneyWon) {
  _gameActive = false;

  /* Hitung perubahan saldo dalam satuan bet */
  let balanceChange = 0;
  if (isWin) {
    if (_selectedGame === 'spaceman') {
      /* moneyWon sudah kena pajak dari spaceman.js */
      const wonBet = Math.floor(moneyWon / 1000);
      balanceChange = wonBet - _currentBet;   // net gain
    } else {
      const prize = _currentBet * GAME_MULTIPLIER[_selectedGame];
      balanceChange = prize - _currentBet;    // net gain = prize - taruhan
    }
  } else {
    balanceChange = -_currentBet;             // kalah = kurang bet
  }

  const newBalance = currentToken.balance + balanceChange;

  /* Simpan ke riwayat */
  const histEntry = {
    game:   _selectedGame,
    bet:    _currentBet,
    result: isWin ? 'win' : 'lose',
    change: balanceChange,
    at:     Date.now(),
  };

  /* Update currentToken lokal dulu */
  currentToken.balance = newBalance;
  if (!currentToken.history) currentToken.history = [];
  currentToken.history.push(histEntry);

  /* Simpan ke GitHub */
  setStatus('💾 Menyimpan hasil...', true);
  let saveOk = false;
  try {
    const freshFile = await getTokenData();
    const tokens    = freshFile.data.tokens || [];
    const idx       = tokens.findIndex(t => t.token === currentToken.token);
    if (idx !== -1) {
      tokens[idx].balance = newBalance;
      if (!tokens[idx].history) tokens[idx].history = [];
      tokens[idx].history.push(histEntry);
    }
    await saveTokenData(freshFile.data, freshFile.sha);
    saveOk = true;
  } catch (err) {
    console.error('Save error:', err);
  }

  hideGame();
  showResultInline(isWin, moneyWon, balanceChange, newBalance, saveOk);
}

/* ────────────────────────────────────────
   RESULT PANEL — lanjut main / withdraw
──────────────────────────────────────── */
function showResultInline(isWin, moneyWon, balanceChange, newBalance, saveOk) {
  const area       = document.createElement('div');
  area.id          = 'gameArea';
  area.className   = 'game-area';

  const panelClass  = isWin ? 'win-panel'  : 'lose-panel';
  const emoji       = isWin ? '🎉'         : '💀';
  const title       = isWin ? 'Menang!'    : 'Belum Beruntung';
  const changeSign  = balanceChange >= 0 ? '+' : '−';
  const changeAbs   = Math.abs(balanceChange);

  const saveNote = saveOk
    ? `<div class="result-save-ok">✓ Hasil tersimpan</div>`
    : `<div class="result-save-err">⚠ Gagal menyimpan — screenshot ini & hubungi admin (${currentToken?.token})</div>`;

  area.innerHTML = `
    <div class="result-panel ${panelClass}">
      <span class="result-emoji">${emoji}</span>
      <div class="result-badge ${isWin ? 'win' : 'lose'}">${isWin ? '● WIN' : '● LOSE'}</div>
      <div class="result-title">${title}</div>

      <!-- Perubahan saldo -->
      <div class="result-balance-change ${isWin ? 'win' : 'lose'}">
        ${changeSign} ${changeAbs} bet
        <span class="result-balance-change-rp">(${formatRp(betToRp(changeAbs))})</span>
      </div>

      <!-- Saldo baru -->
      <div class="result-balance-new">
        Saldo token sekarang:
        <strong>${newBalance} bet</strong>
        <span>(${formatRp(betToRp(newBalance))})</span>
      </div>

      <div class="result-desc">
        ${isWin ? 'Saldo token bertambah!' : 'Lebih beruntung di ronde berikutnya.'}
      </div>

      <div class="result-meta">${saveNote}</div>
      <div class="result-divider"></div>

      <!-- Aksi -->
      <div class="result-action-row">
        ${newBalance > 0
          ? `<button class="start-game-btn" onclick="continuePlaying()">🎮 &nbsp;Main Lagi</button>`
          : `<div class="token-empty-msg">Saldo token habis!</div>`
        }
        <button class="token-withdraw-btn-sm" onclick="confirmWithdraw()">
          💸 Withdraw
        </button>
      </div>
    </div>
  `;

  document.querySelector('.glass-card').insertAdjacentElement('afterend', area);
}

/* Kembali ke dashboard untuk main lagi */
function continuePlaying() {
  hideGame();
  showTokenDashboard();
}

/* ────────────────────────────────────────
   WITHDRAW
──────────────────────────────────────── */
function confirmWithdraw() {
  if (!currentToken || currentToken.balance <= 0) {
    setStatus('⚠ Tidak ada saldo untuk di-withdraw.');
    return;
  }

  const area = document.getElementById('tokenDashboard') || document.getElementById('gameArea');

  /* Tampilkan konfirmasi sederhana */
  const confirm = document.createElement('div');
  confirm.id        = 'withdrawConfirm';
  confirm.className = 'withdraw-confirm-card';
  confirm.innerHTML = `
    <div class="withdraw-confirm-inner">
      <div class="withdraw-confirm-title">💸 Konfirmasi Withdraw</div>
      <div class="withdraw-confirm-amount">
        ${currentToken.balance} bet
        <span>(${formatRp(betToRp(currentToken.balance))})</span>
      </div>
      <div class="withdraw-confirm-note">
        Saldo akan dikirim ke akun WA kamu.<br>
        Token <strong>${currentToken.token}</strong> akan hangus setelah withdraw.
      </div>
      <div class="withdraw-confirm-btns">
        <button class="withdraw-confirm-yes" onclick="doWithdraw()">✓ &nbsp;Ya, Withdraw</button>
        <button class="withdraw-confirm-no"  onclick="cancelWithdraw()">✕ &nbsp;Batal</button>
      </div>
    </div>
  `;

  document.querySelector('.glass-card').insertAdjacentElement('afterend', confirm);
}

function cancelWithdraw() {
  const el = document.getElementById('withdrawConfirm');
  if (el) el.remove();
}

async function doWithdraw() {
  const el = document.getElementById('withdrawConfirm');
  if (el) el.remove();

  setStatus('💾 Memproses withdraw...', true);

  try {
    const freshFile = await getTokenData();
    const tokens    = freshFile.data.tokens || [];
    const idx       = tokens.findIndex(t => t.token === currentToken.token);

    if (idx !== -1) {
      tokens[idx].status      = 'withdrawn';
      tokens[idx].withdrawAt  = Date.now();
      tokens[idx].withdrawAmt = currentToken.balance;
      tokens[idx].balance     = 0;
    }

    await saveTokenData(freshFile.data, freshFile.sha);

    currentToken.status  = 'withdrawn';
    currentToken.balance = 0;

    setStatus('✅ Withdraw berhasil! Cek WA kamu.', true);

    /* Sembunyikan semua area game */
    hideGame();
    const dashboard = document.getElementById('tokenDashboard');
    if (dashboard) dashboard.remove();

    /* Lock input */
    const spinBtn    = document.getElementById('spinBtn');
    const gachaInput = document.getElementById('gachaId');
    if (spinBtn)    { spinBtn.disabled = true; spinBtn.textContent = '🔒'; }
    if (gachaInput) { gachaInput.disabled = true; }

    /* Tampilkan pesan selesai */
    showWithdrawDone();

  } catch (err) {
    console.error('Withdraw error:', err);
    setStatus('❌ Withdraw gagal: ' + err.message);
  }
}

function showWithdrawDone() {
  const area       = document.createElement('div');
  area.id          = 'gameArea';
  area.className   = 'game-area';
  area.innerHTML   = `
    <div class="result-panel win-panel">
      <span class="result-emoji">💸</span>
      <div class="result-title">Withdraw Berhasil!</div>
      <div class="result-desc">
        Saldo kamu sedang diproses.<br>
        Ketik <code>.ceksaldo</code> di bot WA untuk konfirmasi.
      </div>
      <div class="result-divider"></div>
      <div class="result-save-ok">✓ Token ${currentToken?.token} sudah hangus</div>
    </div>
  `;
  document.querySelector('.glass-card').insertAdjacentElement('afterend', area);
}

/* ────────────────────────────────────────
   EVENTS
──────────────────────────────────────── */
document.getElementById('gachaId').addEventListener('keydown', e => {
  if (e.key === 'Enter') startSpin();
});
