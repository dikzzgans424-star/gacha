/* ══════════════════════════════════════
   GAME: SLOT 3×3
   Expose: Slot3x3.init(gacha, onResult)
══════════════════════════════════════ */
const Slot3x3 = (() => {

  const EMOJIS = ['🍇','🍉','🍋','🍌','🍎','🍑','🍒','🫐','🥥','🥑'];
  let _gacha    = null;
  let _onResult = null;

  /* ── Helpers ── */
  function randomEmoji() {
    return EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
  }

  function fillReel(reel) {
    let html = '';
    for (let i = 0; i < 40; i++) html += `<div>${randomEmoji()}</div>`;
    reel.innerHTML = html;
  }

  function animateReel(reel, duration) {
    return new Promise(resolve => {
      fillReel(reel);
      reel.style.transition = 'none';
      reel.style.transform  = 'translateY(0px)';
      setTimeout(() => {
        reel.style.transition = `transform ${duration}ms cubic-bezier(.1,.8,.2,1)`;
        reel.style.transform  = 'translateY(-3240px)'; /* 90px × 36 items */
      }, 20);
      setTimeout(resolve, duration);
    });
  }

  /* ── Render HTML ── */
  function render() {
    const reels = Array.from({length: 9}, (_, i) =>
      `<div class="slot-window" id="sw${i+1}">
         <div class="slot-reel" id="reel${i+1}"></div>
       </div>`
    ).join('');

    return `
      <div class="slot-card">
        <div class="slot-section-label">Slot 3 × 3</div>
        <div class="slot-grid-3x3">${reels}</div>
        <div class="payline-wrap">
          <div class="payline-track">
            <div class="payline-dot left"></div>
            <div class="payline-dot center"></div>
            <div class="payline-dot right"></div>
          </div>
        </div>
        <button class="spin-game-btn" id="spinGameBtn" onclick="Slot3x3.spin()">
          🎰 &nbsp;SPIN
        </button>
      </div>
    `;
  }

  /* ── Init ── */
  function init(gacha, onResult) {
    _gacha    = gacha;
    _onResult = onResult;

    const area = document.createElement('div');
    area.id        = 'gameArea';
    area.className = 'game-area slide-in';
    area.innerHTML = render();
    document.querySelector('.status-card').insertAdjacentElement('afterend', area);

    for (let i = 1; i <= 9; i++) {
      fillReel(document.getElementById('reel' + i));
    }
  }

  /* ── Spin ── */
  async function spin() {
    /* Guard: tolak jika session sudah selesai */
    if (window._gameFinished) return;

    const btn = document.getElementById('spinGameBtn');
    if (!btn || btn.disabled) return;   /* cegah double-call */
    btn.disabled = true;
    window.setStatus('🎰 SPINNING...', true);

    /* Stagger by column */
    const colDur = [2400, 3000, 3600];
    const dur    = [0,1,2,0,1,2,0,1,2].map(c => colDur[c]);
    const reels  = Array.from({length: 9}, (_, i) => document.getElementById('reel' + (i + 1)));

    await Promise.all(reels.map((r, i) => animateReel(r, dur[i])));

    /* Cek ulang — kalau game area sudah di-remove saat animasi jalan, abaikan */
    if (window._gameFinished) return;

    const chance = _gacha.isPremium ? 35 : 27;
    const isWin  = Math.random() * 100 < chance;

    if (isWin) {
      document.querySelectorAll('.slot-grid-3x3 .slot-window')
        .forEach(w => w.classList.add('win-glow'));
    }

    /* Biarkan btn tetap disabled — onGameResult akan hapus DOM-nya */
    _onResult(isWin, _gacha.money);
  }

  return { init, spin };
})();
