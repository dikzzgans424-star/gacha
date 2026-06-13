/* ══════════════════════════════════════
   GAME: ROULETTE — 3D Perspective Wheel
   Expose: Roulette.init(gacha, onResult)

   VISUAL:
   - Wheel diam, ditampilkan perspektif 3D dari atas
   - Bola putih berputar di TRACK LUAR, arah KIRI terus (CCW)
   - Kecepatan dimulai lambat, steady, lalu deselerasi smooth
   - Bola jatuh ke dalam slot dengan bounce
   - Bola 3D dengan radial gradient + specular highlight

   BOARD : 16 slot (8🔴, 7⚫, 1🟢)
   BET   : merah / hitam → 2×
══════════════════════════════════════ */
const Roulette = (() => {

  /* ── Board ── */
  const SLOTS = [
    { color: 'black' }, { color: 'red'   }, { color: 'black' }, { color: 'red'   },
    { color: 'black' }, { color: 'red'   }, { color: 'black' }, { color: 'red'   },
    { color: 'black' }, { color: 'red'   }, { color: 'black' }, { color: 'red'   },
    { color: 'black' }, { color: 'red'   }, { color: 'green' }, { color: 'red'   },
  ];
  const N        = SLOTS.length;
  const SLOT_ANG = (Math.PI * 2) / N;

  /* ── Palette ── */
  const C = {
    red:       '#c0392b', redLight:   '#e74c3c',
    black:     '#1c1c1c', blackLight: '#333333',
    green:     '#27ae60', greenLight: '#2ecc71',
    gold:      '#d4af5a', goldLight:  '#f0d080', goldDim: '#8a7040',
    rim:       '#1e1608', rimLight:   '#3a2e10',
    bg:        '#0c0c0e',
  };

  /* ── State ── */
  let _gacha    = null;
  let _onResult = null;
  let _bet      = null;
  let _spinning = false;
  let _done     = false;
  let _raf      = null;

  /* ── Canvas ── */
  let canvas, ctx, CX, CY, R;

  /* ── Radius ratios ── */
  const rRim    = 0.97;
  const rWheel  = 0.78;
  const rInner  = 0.38;
  const rTrack  = 0.89;   // orbit bola
  const rSlot   = 0.80;   // orbit bola saat di dalam slot

  /* ── Perspektif: elips vertikal ──
     scaleY = seberapa "gepeng" tampilan dari atas
     0.32 = sudut pandang ~30° dari atas, mirip roulette kasino asli */
  const PERSP = 0.32;

  /* ── HTML ── */
  function render() {
    return `
      <div class="roulette-card" id="rouletteCard">
        <div class="slot-section-label">🎡 Roulette</div>
        <div class="roulette-canvas-wrap">
          <canvas id="rouletteCanvas"></canvas>
          <div class="roulette-center-hud" id="rouletteCenterHud">
            <div class="rch-label" id="rchLabel">Pilih Warna</div>
          </div>
        </div>
        <div class="roulette-bet-section">
          <div class="roulette-bet-label">Pilih Taruhan</div>
          <div class="roulette-bet-row">
            <button class="bet-btn bet-red"   id="betRed"   onclick="Roulette.selectBet('red')">🔴 Merah</button>
            <button class="bet-btn bet-black" id="betBlack" onclick="Roulette.selectBet('black')">⚫ Hitam</button>
          </div>
          <div class="roulette-odds">
            <span class="odds-item">🔴 8 slot · 2×</span>
            <span class="odds-sep">·</span>
            <span class="odds-item">⚫ 7 slot · 2×</span>
            <span class="odds-sep">·</span>
            <span class="odds-item">🟢 1 slot · house</span>
          </div>
        </div>
        <button class="spin-game-btn" id="spinGameBtn" onclick="Roulette.spin()" disabled>
          🎡 &nbsp;SPIN
        </button>
      </div>
    `;
  }

  /* ══════════════════════════════════════
     CANVAS SETUP
  ══════════════════════════════════════ */
  function initCanvas() {
    canvas = document.getElementById('rouletteCanvas');
    const wrap = canvas.parentElement;
    const size = Math.min(wrap.clientWidth, 320);
    canvas.width  = size;
    canvas.height = Math.round(size * (0.42 + PERSP * 0.6));
    ctx = canvas.getContext('2d');
    CX = size / 2;
    CY = canvas.height / 2;
    R  = size / 2 - 8;
  }

  /* ── Proyeksi orbit → layar ── */
  function proj(ang, r) {
    return {
      x: CX + Math.cos(ang) * r,
      y: CY + Math.sin(ang) * r * PERSP,
    };
  }

  /* ── Lerp warna hex ── */
  function lerpHex(a, b, t) {
    const ah = parseInt(a.slice(1), 16);
    const bh = parseInt(b.slice(1), 16);
    const ar = (ah >> 16) & 0xff, ag = (ah >> 8) & 0xff, ab = ah & 0xff;
    const br = (bh >> 16) & 0xff, bg = (bh >> 8) & 0xff, bb = bh & 0xff;
    return `rgb(${Math.round(ar+(br-ar)*t)},${Math.round(ag+(bg-ag)*t)},${Math.round(ab+(bb-ab)*t)})`;
  }

  /* ══════════════════════════════════════
     DRAW WHEEL (perspektif 3D, diam)
  ══════════════════════════════════════ */
  function drawWheel() {
    const rimR = R * rRim;

    /* ── Bayangan bawah roda ── */
    const shadowGrad = ctx.createRadialGradient(CX, CY + rimR * PERSP * 0.6, rimR * 0.2, CX, CY + rimR * PERSP * 0.6, rimR * 1.1);
    shadowGrad.addColorStop(0, 'rgba(0,0,0,0.55)');
    shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath();
    ctx.ellipse(CX, CY + rimR * PERSP * 0.7, rimR * 1.05, rimR * PERSP * 0.35, 0, 0, Math.PI * 2);
    ctx.fillStyle = shadowGrad;
    ctx.fill();

    /* ── Rim luar (tebal, elips) ── */
    ctx.beginPath();
    ctx.ellipse(CX, CY, rimR, rimR * PERSP, 0, 0, Math.PI * 2);
    const rimGrad = ctx.createLinearGradient(CX - rimR, CY - rimR * PERSP, CX + rimR, CY + rimR * PERSP);
    rimGrad.addColorStop(0,   C.rimLight);
    rimGrad.addColorStop(0.4, C.rim);
    rimGrad.addColorStop(1,   '#000');
    ctx.fillStyle = rimGrad;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(CX, CY, rimR, rimR * PERSP, 0, 0, Math.PI * 2);
    ctx.strokeStyle = C.goldDim;
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    /* ── Slots — gambar dari Y atas ke bawah (painter's) ── */
    const slotData = Array.from({ length: N }, (_, i) => {
      const midAng = i * SLOT_ANG - Math.PI / 2;  // mulai dari atas (12 o'clock)
      const p      = proj(midAng, R * (rInner + rWheel) / 2);
      return { i, midAng, screenY: p.y };
    }).sort((a, b) => a.screenY - b.screenY);

    for (const { i, midAng } of slotData) {
      const ang0 = midAng - SLOT_ANG / 2;
      const ang1 = midAng + SLOT_ANG / 2;
      const slot  = SLOTS[i];

      let base, lite;
      if      (slot.color === 'red')   { base = C.red;   lite = C.redLight;   }
      else if (slot.color === 'black') { base = C.black; lite = C.blackLight; }
      else                             { base = C.green; lite = C.greenLight; }

      /* Path slot: dalam → luar arc → dalam arc balik */
      const STEPS = 8;
      ctx.beginPath();
      const pi0 = proj(ang0, R * rInner);
      ctx.moveTo(pi0.x, pi0.y);
      const pw0 = proj(ang0, R * rWheel);
      ctx.lineTo(pw0.x, pw0.y);
      for (let k = 1; k <= STEPS; k++) {
        const a = ang0 + (ang1 - ang0) * (k / STEPS);
        const p = proj(a, R * rWheel);
        ctx.lineTo(p.x, p.y);
      }
      const pi1 = proj(ang1, R * rInner);
      ctx.lineTo(pi1.x, pi1.y);
      for (let k = STEPS - 1; k >= 0; k--) {
        const a = ang0 + (ang1 - ang0) * (k / STEPS);
        const p = proj(a, R * rInner);
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();

      /* Shading: bawah (sin positif) lebih terang karena cahaya dari atas */
      const bright = (Math.sin(midAng) + 1) / 2;
      ctx.fillStyle = lerpHex(base, lite, bright * 0.5);
      ctx.fill();

      /* Divider tipis emas */
      ctx.beginPath();
      const d0i = proj(ang0, R * rInner);
      const d0w = proj(ang0, R * rWheel);
      ctx.moveTo(d0i.x, d0i.y);
      ctx.lineTo(d0w.x, d0w.y);
      ctx.strokeStyle = 'rgba(212,175,90,0.2)';
      ctx.lineWidth   = 0.8;
      ctx.stroke();
    }

    /* ── Inner rim & hub ── */
    ctx.beginPath();
    ctx.ellipse(CX, CY, R * rInner, R * rInner * PERSP, 0, 0, Math.PI * 2);
    ctx.strokeStyle = C.gold;
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    const hubR = R * rInner * 0.82;
    const hg   = ctx.createRadialGradient(CX - 3, CY - hubR * PERSP * 0.5, 1, CX, CY, hubR);
    hg.addColorStop(0,   C.goldLight);
    hg.addColorStop(0.5, C.gold);
    hg.addColorStop(1,   C.goldDim);
    ctx.beginPath();
    ctx.ellipse(CX, CY, hubR, hubR * PERSP, 0, 0, Math.PI * 2);
    ctx.fillStyle = hg;
    ctx.fill();

    /* Speeder jari-jari hub */
    ctx.save();
    ctx.translate(CX, CY);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const p0 = { x: Math.cos(a) * hubR * 0.15, y: Math.sin(a) * hubR * PERSP * 0.15 };
      const p1 = { x: Math.cos(a) * R * rInner * 0.9, y: Math.sin(a) * R * rInner * PERSP * 0.9 };
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.strokeStyle = 'rgba(212,175,90,0.18)';
      ctx.lineWidth   = 0.8;
      ctx.stroke();
    }
    ctx.restore();

    /* Center pin */
    ctx.beginPath();
    ctx.arc(CX, CY, R * 0.032, 0, Math.PI * 2);
    ctx.fillStyle   = C.bg;
    ctx.fill();
    ctx.strokeStyle = C.goldDim;
    ctx.lineWidth   = 1;
    ctx.stroke();

    /* ── Track groove (orbit bola) elips ── */
    ctx.beginPath();
    ctx.ellipse(CX, CY, R * rTrack, R * rTrack * PERSP, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth   = R * 0.06;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(CX, CY, R * rTrack, R * rTrack * PERSP, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(212,175,90,0.08)';
    ctx.lineWidth   = 1;
    ctx.stroke();
  }

  /* ══════════════════════════════════════
     DRAW BOLA 3D
  ══════════════════════════════════════ */
  function drawBall(ang, orbitR) {
    const p  = proj(ang, orbitR);
    const br = R * 0.065;

    /* Bola lebih kecil di "atas" elips (jauh), lebih besar di "bawah" (dekat)
       untuk memperkuat ilusi kedalaman */
    const depthScale = 0.82 + (Math.sin(ang) + 1) / 2 * 0.22;
    const r = br * depthScale;

    /* Drop shadow */
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + r * 0.55, r * 0.85, r * 0.28, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fill();

    /* Bola utama — sphere gradient */
    const hx = p.x - r * 0.35;
    const hy = p.y - r * 0.35;
    const bg = ctx.createRadialGradient(hx, hy, r * 0.02, p.x, p.y, r * 1.05);
    bg.addColorStop(0,    '#ffffff');
    bg.addColorStop(0.15, '#f8f5f0');
    bg.addColorStop(0.5,  '#dedad4');
    bg.addColorStop(0.8,  '#b0aca6');
    bg.addColorStop(1,    '#706c66');
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = bg;
    ctx.fill();

    /* Specular utama */
    ctx.beginPath();
    ctx.arc(p.x - r * 0.3, p.y - r * 0.3, r * 0.24, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fill();

    /* Specular sekunder (micro) */
    ctx.beginPath();
    ctx.arc(p.x - r * 0.48, p.y - r * 0.46, r * 0.09, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fill();

    /* Rim gelap bawah bola untuk kesan volumetrik */
    const rimG = ctx.createRadialGradient(p.x, p.y, r * 0.6, p.x, p.y, r);
    rimG.addColorStop(0,   'rgba(0,0,0,0)');
    rimG.addColorStop(1,   'rgba(0,0,0,0.28)');
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = rimG;
    ctx.fill();
  }

  /* ══════════════════════════════════════
     DRAW FRAME
  ══════════════════════════════════════ */
  function drawFrame(ballOrbitR, ballAng) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawWheel();
    drawBall(ballAng, ballOrbitR);
  }

  /* ══════════════════════════════════════
     POSISI BOLA IDLE — disambung ke spin tanpa snap
  ══════════════════════════════════════ */
  let _ballIdleAng = -Math.PI / 2;

  /* ══════════════════════════════════════
     ANIMASI SPIN
     Phase 1 (2.2s): kencang konstan (langsung dari idle, tanpa snap)
     Phase 2 (3.5s): melambat smooth pakai easeOutQuint (sangat halus)
     Phase 3 (0.9s): jatuh ke slot
     Phase 4 (0.7s): bounce settle
  ══════════════════════════════════════ */
  function easeOutQuint(t) { return 1 - Math.pow(1-t, 5); }
  function easeOut5(t)     { return 1 - Math.pow(1-t, 5); }
  function easeOutBounce(t) {
    const n = 7.5625, d = 2.75;
    if (t < 1/d)     return n*t*t;
    if (t < 2/d)     return n*(t-=1.5/d)*t+0.75;
    if (t < 2.5/d)   return n*(t-=2.25/d)*t+0.9375;
    return n*(t-=2.625/d)*t+0.984375;
  }

  async function runSpin(finalSlotIdx) {
    /* Kecepatan puncak CCW (negatif = kiri) */
    const V_PEAK = -0.0058;

    const D = {
      fast:   2200,   // kencang konstan
      decel:  3500,   // melambat smooth
      fall:   900,
      bounce: 700,
    };
    const T = {
      decel:  D.fast,
      fall:   D.fast + D.decel,
      bounce: D.fast + D.decel + D.fall,
      end:    D.fast + D.decel + D.fall + D.bounce,
    };

    /* Akumulasi sudut tiap phase (CCW = negatif) */
    const A_fast  = V_PEAK * D.fast;
    /* Decel: integral easeOutQuint(t) dt dari 0→1
       = t - (1-t)^6/6 |_0^1 → tidak mudah, pakai approx: 1/6 * D * V_PEAK */
    const A_decel = V_PEAK * D.decel * (1/6);

    /* ── Mulai dari posisi idle saat ini (TIDAK snap) ── */
    const ballStart = _ballIdleAng;
    const endDecel  = ballStart + A_fast + A_decel;

    /* ── Target slot ──
       Harus SAMA PERSIS dengan midAng di drawWheel:
       midAng = finalSlotIdx * SLOT_ANG - π/2
       Bola bergerak CCW, kita cari diff negatif terpendek. */
    const slotAng = finalSlotIdx * SLOT_ANG - Math.PI / 2;

    /* Normalisasi diff agar SELALU CCW (negatif) dan minimal 2 putaran penuh
       supaya bola melewati slot dulu (tidak langsung jatuh) */
    let diff = slotAng - endDecel;
    diff = -(( (-diff) % (Math.PI*2) + Math.PI*2 ) % (Math.PI*2));
    if (diff === 0)           diff = -Math.PI * 2;
    if (diff > -Math.PI * 4) diff -= Math.PI * 2;  // paksa min 2 putaran

    const finalAng  = endDecel + diff;
    let   ballAng   = ballStart;
    let   ballOrbit = R * rTrack;
    const t0        = performance.now();

    return new Promise(resolve => {
      function frame(now) {
        const e    = now - t0;
        let   done = false;

        if (e < D.fast) {
          /* Phase 1: kencang konstan — sambung langsung dari idle */
          ballAng   = ballStart + V_PEAK * e;
          ballOrbit = R * rTrack;

        } else if (e < T.fall) {
          /* Phase 2: melambat sangat smooth (easeOutQuint)
             Kecepatan sesaat = V_PEAK * (1-t)^4 → makin lambat, tidak sentakan */
          const t   = (e - D.fast) / D.decel;
          const tE  = easeOutQuint(t);
          /* posisi = integral kecepatan = A_fast + V_PEAK*D.decel*integral(1-(1-t)^4)
             Pakai rumus eksak: t - (1-t)^5/5 + 1/5  */
          const pos = t - (Math.pow(1-t, 5) - 1) / 5;
          ballAng   = ballStart + A_fast + V_PEAK * D.decel * pos;
          ballOrbit = R * rTrack;

        } else if (e < T.bounce) {
          /* Phase 3: jatuh ke slot */
          const t  = (e - T.fall) / D.fall;
          const tE = easeOut5(t);
          ballAng   = endDecel + diff * tE;
          ballOrbit = R * (rTrack + (rSlot - rTrack) * tE);

        } else {
          /* Phase 4: bounce settle */
          const t  = Math.min((e - T.bounce) / D.bounce, 1);
          const tE = easeOutBounce(t);
          ballAng   = finalAng;
          ballOrbit = R * rSlot + R * 0.022 * (1 - tE);
          if (e >= T.end) done = true;
        }

        _ballIdleAng = ballAng;
        drawFrame(ballOrbit, ballAng);
        if (done) { resolve(); return; }
        _raf = requestAnimationFrame(frame);
      }
      _raf = requestAnimationFrame(frame);
    });
  }

  /* ══════════════════════════════════════
     PUBLIC API
  ══════════════════════════════════════ */
  function init(gacha, onResult) {
    _gacha    = gacha;
    _onResult = onResult;
    _bet      = null;
    _spinning = false;
    _done     = false;
    if (_raf) { cancelAnimationFrame(_raf); _raf = null; }

    const area = document.createElement('div');
    area.id        = 'gameArea';
    area.className = 'game-area slide-in';
    area.innerHTML = render();

    const infoCard  = document.getElementById('gachaInfoCard');
    const existGame = document.getElementById('gameArea');
    if (infoCard)       infoCard.replaceWith(area);
    else if (existGame) existGame.replaceWith(area);
    else document.querySelector('.glass-card').insertAdjacentElement('afterend', area);

    requestAnimationFrame(() => {
      initCanvas();
      _ballIdleAng = -Math.PI / 2;
      drawFrame(R * rTrack, _ballIdleAng);
    });
  }

  function selectBet(color) {
    if (_spinning) return;
    _bet = color;
    document.getElementById('betRed').classList.toggle('selected',   color === 'red');
    document.getElementById('betBlack').classList.toggle('selected', color === 'black');

    const spinBtn = document.getElementById('spinGameBtn');
    if (spinBtn) spinBtn.disabled = false;

    const lbl = document.getElementById('rchLabel');
    if (lbl) {
      lbl.textContent = color === 'red' ? '🔴 Merah' : '⚫ Hitam';
      lbl.className   = 'rch-label rch-chosen ' + (color === 'red' ? 'rch-red' : 'rch-black');
    }
  }

  async function spin() {
    if (_done || _spinning || !_bet) return;
    const spinBtn = document.getElementById('spinGameBtn');
    if (!spinBtn || spinBtn.disabled) return;

    _spinning = true;
    spinBtn.disabled = true;
    document.getElementById('betRed').disabled   = true;
    document.getElementById('betBlack').disabled = true;
    window.setStatus('🎡 Bola berputar...', true);

    const isWin = _gacha.result === 'win';

    let resultColor;
    if (isWin) {
      resultColor = _bet;
    } else {
      const losing = [...new Set(SLOTS.map(s => s.color).filter(c => c !== _bet))];
      resultColor  = losing[Math.floor(Math.random() * losing.length)];
    }

    const candidates  = SLOTS.map((s, i) => s.color === resultColor ? i : null).filter(v => v !== null);
    const finalSlotIdx = candidates[Math.floor(Math.random() * candidates.length)];

    const lbl = document.getElementById('rchLabel');
    if (lbl) { lbl.textContent = '🎡 Spinning...'; lbl.className = 'rch-label rch-spinning'; }

    await runSpin(finalSlotIdx);
    if (_done) return;

    const colorEmoji = resultColor === 'red' ? '🔴' : resultColor === 'black' ? '⚫' : '🟢';
    const greenWin   = resultColor === 'green'; // hijau selalu menang 2.5×
    const actualWin  = isWin || greenWin;

    if (lbl) {
      lbl.textContent = `${colorEmoji} Slot ${finalSlotIdx + 1}`;
      lbl.className   = 'rch-label rch-result ' + (actualWin ? 'rch-win' : 'rch-lose');
    }
    window.setStatus(actualWin ? '🏆 MENANG!' : '💀 Kalah...', actualWin);

    await new Promise(r => setTimeout(r, actualWin ? 1200 : 800));
    if (_done) return;
    _done = true;

    let prize;
    if (greenWin) {
      prize = Math.floor(_gacha.betAmount * 2.5 * 1000); // hijau = 2.5×
    } else if (isWin) {
      prize = _gacha.betAmount * 2 * 1000;               // merah/hitam = 2×
    } else {
      prize = 0;
    }
    _onResult(actualWin, prize);
  }

  return { init, selectBet, spin };
})();
