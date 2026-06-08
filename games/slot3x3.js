/* ══════════════════════════════════════
   GAME: SLOT 3×3
   Expose: Slot3x3.init(gacha, onResult)

   WIN MECHANIC:
   - Baris tengah = index 3,4,5 (row ke-2)
   - Menang jika ketiga simbol baris tengah identik
   - Simbol final ditentukan SEBELUM animasi
══════════════════════════════════════ */
const Slot3x3 = (() => {

  const EMOJIS = ['🍇','🍉','🍋','🍌','🍎','🍑','🍒','🫐','🥥','🥑'];
  const ITEM_H = 80;   /* tinggi 1 item — sinkron dengan CSS .slot-reel div */
  const PAD    = 30;   /* item padding sebelum simbol final */

  let _gacha    = null;
  let _onResult = null;

  /* ── Helpers ── */
  function rand(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /*
   * Bangun reel dengan simbol final di posisi PAD.
   * translateY target = -((PAD - 1) * ITEM_H)
   * → simbol PAD muncul di tengah window (row ke-2 dari 3)
   */
  function buildReel(reel, finalSymbol) {
    const items = [];
    for (let i = 0; i < PAD; i++) items.push(rand(EMOJIS));
    items.push(finalSymbol);   /* index PAD → tengah */
    items.push(rand(EMOJIS));
    items.push(rand(EMOJIS));
    reel.innerHTML = items.map(e => `<div>${e}</div>`).join('');
    reel.style.transition = 'none';
    reel.style.transform  = 'translateY(0px)';
  }

  function animateReel(reel, finalSymbol, duration, delay) {
    return new Promise(resolve => {
      buildReel(reel, finalSymbol);
      setTimeout(() => {
        reel.style.transition = `transform ${duration}ms cubic-bezier(0.08, 0.82, 0.17, 1)`;
        reel.style.transform  = `translateY(${-((PAD - 1) * ITEM_H)}px)`;
        setTimeout(resolve, duration);
      }, delay);
    });
  }

  /* ── Render HTML ── */
  function render() {
    const windows = Array.from({length: 9}, (_, i) =>
      `<div class="slot-window" id="sw${i+1}">
         <div class="slot-reel" id="reel${i+1}"></div>
       </div>`
    ).join('');

    return `
      <div class="slot-card">
        <div class="slot-section-label">Slot 3 × 3</div>
        <div class="slot-grid-3x3">${windows}</div>
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
      buildReel(document.getElementById('reel' + i), rand(EMOJIS));
    }
  }

  /* ── Spin ── */
  async function spin() {
    if (window._gameFinished) return;

    const btn = document.getElementById('spinGameBtn');
    if (!btn || btn.disabled) return;
    btn.disabled = true;
    window.setStatus('🎰 Spinning...', true);

    /* Tentukan hasil SEBELUM animasi */
    const chance = _gacha.isPremium ? 35 : 27;
    const isWin  = Math.random() * 100 < chance;

    /*
     * 9 simbol final, row-major:
     *   [0][1][2]  ← atas
     *   [3][4][5]  ← tengah (PAYLINE)
     *   [6][7][8]  ← bawah
     */
    const finals = Array.from({length: 9}, () => rand(EMOJIS));

    if (isWin) {
      const winSymbol = rand(EMOJIS);
      finals[3] = finals[4] = finals[5] = winSymbol;
    } else {
      /* Pastikan baris tengah tidak semua sama */
      while (finals[3] === finals[4] && finals[4] === finals[5]) {
        finals[5] = rand(EMOJIS);
      }
    }

    /* Durasi & delay per kolom — premium lebih dramatis */
    const base = _gacha.isPremium ? 1000 : 600;
    const durs  = [base + 2000, base + 3000, base + 4200];
    const delays = [0, 200, 400];

    const promises = finals.map((symbol, i) => {
      const reel = document.getElementById('reel' + (i + 1));
      const col  = i % 3;
      return animateReel(reel, symbol, durs[col], delays[col]);
    });

    await Promise.all(promises);

    if (window._gameFinished) return;

    if (isWin) {
      [4, 5, 6].forEach(n =>
        document.getElementById('sw' + n)?.classList.add('win-glow')
      );
      window.setStatus('🏆 JACKPOT!', true);
    } else {
      window.setStatus('💀 Belum beruntung...', false);
    }

    /* Jeda singkat sebelum result */
    await new Promise(r => setTimeout(r, isWin ? 1200 : 700));

    if (window._gameFinished) return;
    _onResult(isWin, _gacha.money);
  }

  return { init, spin };
})();
