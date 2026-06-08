/* ══════════════════════════════════════
   GAME: SLOT 3×3
   Expose: Slot3x3.init(gacha, onResult)

   GRID LAYOUT (row-major):
     sw1  sw2  sw3   ← baris atas
     sw4  sw5  sw6   ← baris TENGAH = PAYLINE
     sw7  sw8  sw9   ← baris bawah

   WIN: simbol tengah sw4 === sw5 === sw6

   MEKANISME:
   1. Tentukan apakah menang (chance%)
   2. Bangun simbol untuk semua 9 reel — mid sw4/5/6 dikontrol
   3. Jalankan animasi
   4. Setelah animasi berhenti, READ-BACK simbol tengah
      dari DOM secara langsung (getSymbolAtCenter)
   5. Cek menang dari DOM read-back, bukan data internal
   6. console.log CENTER PAYLINE untuk debug
══════════════════════════════════════ */
const Slot3x3 = (() => {

  const EMOJIS = ['🍇','🍉','🍋','🍌','🍎','🍑','🍒','🫐','🥥','🥑'];

  /*
   * ITEM_H: tinggi satu simbol dalam px.
   * HARUS sinkron dengan CSS: .slot-reel div { height: Xpx }
   * Window height = ITEM_H × 3 (3 baris terlihat)
   */
  const ITEM_H = 72;
  const PAD    = 28;   /* item random sebelum 3 simbol target */

  let _gacha    = null;
  let _onResult = null;

  /* ── Helpers ── */
  function rand(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  /*
   * buildReel — isi reel dengan:
   *   [PAD item random] [top] [mid] [bot] [1 buffer]
   *
   * Stop translateY = -(PAD * ITEM_H)
   * → item[PAD]   berada di pixel 0..ITEM_H   = baris atas window
   * → item[PAD+1] berada di pixel ITEM_H..2×ITEM_H = baris TENGAH ✓
   * → item[PAD+2] berada di pixel 2×ITEM_H..3×ITEM_H = baris bawah
   */
  function buildReel(reel, top, mid, bot) {
    const items = [];
    for (let i = 0; i < PAD; i++) items.push(rand(EMOJIS));
    items.push(top);           /* index PAD   → baris atas   */
    items.push(mid);           /* index PAD+1 → baris TENGAH */
    items.push(bot);           /* index PAD+2 → baris bawah  */
    items.push(rand(EMOJIS));  /* buffer      */

    reel.innerHTML = items.map(e => `<div>${e}</div>`).join('');
    reel.style.transition = 'none';
    reel.style.transform  = 'translateY(0px)';
  }

  /*
   * getSymbolAtCenter — baca simbol yang BENAR-BENAR terlihat
   * di baris tengah window setelah animasi berhenti.
   *
   * Cara: ambil computed translateY, hitung item index yang
   * ada di tengah window (offset ITEM_H dari top).
   */
  function getSymbolAtCenter(reel) {
    const style     = window.getComputedStyle(reel);
    const matrix    = new DOMMatrix(style.transform);
    const translateY = matrix.m42;                       /* nilai translateY aktual */
    const scrolled   = Math.abs(translateY);             /* px yang sudah discroll  */
    const centerIdx  = Math.round((scrolled + ITEM_H) / ITEM_H); /* item di tengah  */
    const items      = reel.querySelectorAll('div');
    return items[centerIdx]?.textContent?.trim() ?? '?';
  }

  /* ── Animasi ── */
  function animateReel(reel, top, mid, bot, duration, delay) {
    return new Promise(resolve => {
      buildReel(reel, top, mid, bot);
      const targetY = -(PAD * ITEM_H);
      setTimeout(() => {
        reel.style.transition = `transform ${duration}ms cubic-bezier(0.08, 0.82, 0.17, 1)`;
        reel.style.transform  = `translateY(${targetY}px)`;
        setTimeout(resolve, duration);
      }, delay);
    });
  }

  /* ── Render HTML ── */
  function render() {
    const windows = Array.from({length: 9}, (_, i) =>
      `<div class="slot-window" id="sw${i + 1}">
         <div class="slot-reel"  id="reel${i + 1}"></div>
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

<div class="win-rule">
  <div class="win-rule-title">
    🎯 Cara Menang
  </div>

  <div class="win-rule-grid">
    🍋 🍒 🍇<br>
    🍉 🍉 🍉 ← MENANG<br>
    🍎 🍌 🍑
  </div>

  <div class="win-rule-desc">
    Menang jika 3 simbol pada BARIS TENGAH sama.
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

    /*
     * Cari anchor untuk replace — prioritas:
     * 1. Info card masih di DOM → replace langsung di posisinya
     * 2. Game area lama masih ada → replace
     * 3. Fallback → insert setelah glass-card
     */
    const infoCard  = document.getElementById('gachaInfoCard');
    const existGame = document.getElementById('gameArea');

    if (infoCard) {
  infoCard.parentNode.insertBefore(area, infoCard);
  infoCard.remove();
} else if (existGame) {
  existGame.replaceWith(area);
} else {
  document.querySelector('.glass-card').insertAdjacentElement('afterend', area);
}

    /* State awal reel — semua random */
    for (let i = 1; i <= 9; i++) {
      buildReel(
        document.getElementById('reel' + i),
        rand(EMOJIS), rand(EMOJIS), rand(EMOJIS)
      );
    }
  }

  /* ── Spin ── */
  async function spin() {
    if (window._gameFinished) return;

    const btn = document.getElementById('spinGameBtn');
    if (!btn || btn.disabled) return;
    btn.disabled = true;
    window.setStatus('🎰 Spinning...', true);

    /* ── 1. Tentukan hasil ── */
    const chance = _gacha.isPremium ? 35 : 27;
    const isWin  = Math.random() * 100 < chance;

    /*
     * ── 2. Bangun simbol untuk semua 9 reel ──
     *
     * PAYLINE = baris TENGAH grid = reel index 3, 4, 5
     * (sw4=reel4, sw5=reel5, sw6=reel6 → array index 3,4,5)
     *
     * reelSymbols[i] = { top, mid, bot }
     */
    const reelSymbols = Array.from({length: 9}, () => ({
      top: rand(EMOJIS),
      mid: rand(EMOJIS),
      bot: rand(EMOJIS),
    }));

    if (isWin) {
      /* Paksa ketiga mid payline sama */
      const winSym = rand(EMOJIS);
      reelSymbols[3].mid = winSym;
      reelSymbols[4].mid = winSym;
      reelSymbols[5].mid = winSym;
    } else {
      /* Paksa tidak semua sama — loop sampai pasti berbeda */
      while (
        reelSymbols[3].mid === reelSymbols[4].mid &&
        reelSymbols[4].mid === reelSymbols[5].mid
      ) {
        reelSymbols[5].mid = rand(EMOJIS);
      }
    }

    /* ── 3. Jalankan animasi ── */
    const base   = _gacha.isPremium ? 1000 : 600;
    const durs   = [base + 2000, base + 3000, base + 4200];
    const delays = [0, 200, 400];

    await Promise.all(
      reelSymbols.map((s, i) => {
        const reel = document.getElementById('reel' + (i + 1));
        const col  = i % 3;
        return animateReel(reel, s.top, s.mid, s.bot, durs[col], delays[col]);
      })
    );

    if (window._gameFinished) return;

    /* ── 4. READ-BACK dari DOM — baca simbol tengah payline ── */
    const paylineReels = [
      document.getElementById('reel4'),   /* sw4 — kolom kiri  payline */
      document.getElementById('reel5'),   /* sw5 — kolom tengah payline */
      document.getElementById('reel6'),   /* sw6 — kolom kanan  payline */
    ];

    const middleRow = paylineReels.map(r => getSymbolAtCenter(r));

    /* DEBUG — bandingkan dengan yang terlihat di layar */
    console.log('CENTER PAYLINE:', middleRow);
    console.log('isWin (planned):', isWin);

    /* ── 5. Evaluasi dari DOM read-back ── */
    const actualWin =
      middleRow[0] !== '?' &&
      middleRow[0] === middleRow[1] &&
      middleRow[1] === middleRow[2];

    /* Sanity check — planned vs actual harus sama */
    if (actualWin !== isWin) {
      console.warn('⚠ Mismatch planned vs actual!', { planned: isWin, actual: actualWin, middleRow });
    }

    /* ── 6. Visual feedback ── */
    if (actualWin) {
      [4, 5, 6].forEach(n =>
        document.getElementById('sw' + n)?.classList.add('win-glow')
      );
      window.setStatus('🏆 JACKPOT!', true);
    } else {
      window.setStatus('💀 Belum beruntung...', false);
    }

    await new Promise(r => setTimeout(r, actualWin ? 1200 : 700));

    if (window._gameFinished) return;
    _onResult(actualWin, _gacha.money);
  }

  return { init, spin };
})();
