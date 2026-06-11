/* ══════════════════════════════════════
   GAME: ROULETTE — Casino Wheel
   Expose: Roulette.init(gacha, onResult)

   BOARD  : 16 slot (8x🔴, 7x⚫, 1x🟢)
   BET    : merah / hitam
   MENANG : merah/hitam = 2x | hijau = 2.5x (tapi hijau selalu lose untuk bet)
   ANIM   : wheel + bola SEARAH, decelerate → fall → bounce → stop
══════════════════════════════════════ */
const Roulette = (() => {

  /* ── Board (searah jarum jam) ── */
  const SLOTS = [
    { color: 'black' }, { color: 'red'   }, { color: 'black' }, { color: 'red'   },
    { color: 'black' }, { color: 'red'   }, { color: 'black' }, { color: 'red'   },
    { color: 'black' }, { color: 'red'   }, { color: 'black' }, { color: 'red'   },
    { color: 'black' }, { color: 'red'   }, { color: 'green' }, { color: 'red'   },
  ];
  const N        = SLOTS.length; // 16
  const SLOT_ANG = (Math.PI * 2) / N;

  /* ── Palette ── */
  const C = {
    red:        '#c0392b', redLight:   '#e74c3c',
    black:      '#1a1a1a', blackLight: '#2c2c2c',
    green:      '#27ae60', greenLight: '#2ecc71',
    gold:       '#d4af5a', goldLight:  '#f0d080', goldDim: '#8a7040',
    rim:        '#2a2010', rimLight:   '#4a3820',
    bg:         '#0c0c0e', ballShadow: 'rgba(0,0,0,0.6)',
  };

  let _gacha    = null;
  let _onResult = null;
  let _bet      = null;
  let _spinning = false;
  let _raf      = null;
  let _done     = false;

  /* ── Render HTML ── */
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
     CANVAS
  ══════════════════════════════════════ */
  let canvas, ctx, CX, CY, R;

  const rWheel      = 0.78;
  const rInner      = 0.40;
  const rRim        = 0.82;
  const rBallOrbit  = 0.91;
  const rBallFall   = 0.80;

  function initCanvas() {
    canvas = document.getElementById('rouletteCanvas');
    const wrap = canvas.parentElement;
    const size = Math.min(wrap.clientWidth, 320);
    canvas.width  = size;
    canvas.height = size;
    ctx = canvas.getContext('2d');
    CX = size / 2; CY = size / 2;
    R  = size / 2 - 4;
  }

  function drawWheel(wheelAng) {
    /* Rim */
    const rimGrad = ctx.createRadialGradient(CX, CY, R * rWheel, CX, CY, R * rRim + 2);
    rimGrad.addColorStop(0,   C.rimLight);
    rimGrad.addColorStop(0.5, C.rim);
    rimGrad.addColorStop(1,   '#0a0800');
    ctx.beginPath();
    ctx.arc(CX, CY, R * (rRim + 0.04), 0, Math.PI * 2);
    ctx.fillStyle = rimGrad; ctx.fill();

    ctx.beginPath();
    ctx.arc(CX, CY, R * rRim, 0, Math.PI * 2);
    ctx.strokeStyle = C.gold; ctx.lineWidth = 2.5; ctx.stroke();

    /* Slots */
    for (let i = 0; i < N; i++) {
      const ang0 = wheelAng + i * SLOT_ANG - SLOT_ANG / 2;
      const ang1 = ang0 + SLOT_ANG;
      const slot = SLOTS[i];

      let baseCol, lightCol;
      if      (slot.color === 'red')   { baseCol = C.red;   lightCol = C.redLight;   }
      else if (slot.color === 'black') { baseCol = C.black; lightCol = C.blackLight; }
      else                             { baseCol = C.green; lightCol = C.greenLight; }

      ctx.beginPath();
      ctx.moveTo(CX, CY);
      ctx.arc(CX, CY, R * rWheel, ang0, ang1);
      ctx.closePath();

      const midAng = wheelAng + i * SLOT_ANG;
      const sg = ctx.createLinearGradient(
        CX + Math.cos(midAng) * R * rInner, CY + Math.sin(midAng) * R * rInner,
        CX + Math.cos(midAng) * R * rWheel, CY + Math.sin(midAng) * R * rWheel
      );
      sg.addColorStop(0, lightCol); sg.addColorStop(1, baseCol);
      ctx.fillStyle = sg; ctx.fill();

      ctx.beginPath();
      ctx.moveTo(CX + Math.cos(ang0) * R * rInner, CY + Math.sin(ang0) * R * rInner);
      ctx.lineTo(CX + Math.cos(ang0) * R * rWheel, CY + Math.sin(ang0) * R * rWheel);
      ctx.strokeStyle = 'rgba(212,175,90,0.35)'; ctx.lineWidth = 1; ctx.stroke();
    }

    /* Inner rim */
    ctx.beginPath();
    ctx.arc(CX, CY, R * rInner, 0, Math.PI * 2);
    ctx.strokeStyle = C.gold; ctx.lineWidth = 2; ctx.stroke();

    /* Hub */
    const hubGrad = ctx.createRadialGradient(CX - 4, CY - 4, 1, CX, CY, R * rInner * 0.9);
    hubGrad.addColorStop(0,   C.goldLight);
    hubGrad.addColorStop(0.4, C.gold);
    hubGrad.addColorStop(1,   C.goldDim);
    ctx.beginPath();
    ctx.arc(CX, CY, R * rInner * 0.9, 0, Math.PI * 2);
    ctx.fillStyle = hubGrad; ctx.fill();

    ctx.save(); ctx.translate(CX, CY); ctx.rotate(wheelAng);
    for (let i = 0; i < 8; i++) {
      ctx.rotate(Math.PI / 4);
      ctx.beginPath();
      ctx.moveTo(0, -R * rInner * 0.55);
      ctx.lineTo( R * rInner * 0.12, 0);
      ctx.lineTo(0,  R * rInner * 0.55);
      ctx.lineTo(-R * rInner * 0.12, 0);
      ctx.closePath();
      ctx.fillStyle = i % 2 === 0 ? 'rgba(10,8,0,0.35)' : 'rgba(255,235,180,0.15)';
      ctx.fill();
    }
    ctx.restore();

    ctx.beginPath();
    ctx.arc(CX, CY, R * 0.04, 0, Math.PI * 2);
    ctx.fillStyle = C.bg; ctx.fill();
    ctx.strokeStyle = C.goldDim; ctx.lineWidth = 1.5; ctx.stroke();
  }

  function drawBall(orbitR, ballAng) {
    const bx = CX + Math.cos(ballAng) * orbitR;
    const by = CY + Math.sin(ballAng) * orbitR;
    const br = R * 0.055;

    ctx.beginPath();
    ctx.arc(bx + br * 0.3, by + br * 0.5, br * 0.9, 0, Math.PI * 2);
    ctx.fillStyle = C.ballShadow; ctx.fill();

    const bg = ctx.createRadialGradient(bx - br * 0.35, by - br * 0.35, br * 0.05, bx, by, br);
    bg.addColorStop(0,   '#ffffff');
    bg.addColorStop(0.3, '#f0ede8');
    bg.addColorStop(0.7, '#c8c4bc');
    bg.addColorStop(1,   '#908c84');
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fillStyle = bg; ctx.fill();

    ctx.beginPath();
    ctx.arc(bx - br * 0.3, by - br * 0.3, br * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
  }

  function drawFrame(wheelAng, ballOrbitR, ballAng) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.arc(CX, CY, R * rBallOrbit, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(212,175,90,0.12)';
    ctx.lineWidth   = R * (rRim - rWheel) * 2;
    ctx.stroke();
    drawWheel(wheelAng);
    drawBall(ballOrbitR, ballAng);
  }

  /* ══════════════════════════════════════
     ANIMASI — wheel & bola SEARAH jarum jam
     Bola lebih cepat dari wheel di awal,
     lalu melambat bersamaan, bola jatuh ke slot.
  ══════════════════════════════════════ */
  function easeOut(t)       { return 1 - Math.pow(1 - t, 3); }
  function easeOutStrong(t) { return 1 - Math.pow(1 - t, 5); }

  async function runSpin(finalSlotIdx) {
    /* Kecepatan — KEDUANYA positif (searah jarum jam) */
    const W_SPD = 0.0025;   // wheel: lebih pelan
    const B_SPD = 0.0060;   // bola : lebih cepat (satu arah, tidak bolak-balik)

    /* Durasi phase (ms) */
    const D = { spin: 3200, slow: 2500, fall: 700, bounce: 600 };
    const T = {
      slow:   D.spin,
      fall:   D.spin + D.slow,
      bounce: D.spin + D.slow + D.fall,
      end:    D.spin + D.slow + D.fall + D.bounce,
    };

    /* Pre-compute posisi wheel di akhir tiap phase */
    const wheelEnd1 = W_SPD * D.spin;
    const wheelEnd2 = wheelEnd1 + W_SPD * D.slow * 0.25;
    const wheelEnd3 = wheelEnd2 + W_SPD * 0.08 * D.fall;

    /* Pre-compute posisi bola di akhir phase 2 */
    const ballEnd1 = B_SPD * D.spin;
    const ballEnd2 = ballEnd1 + B_SPD * D.slow * 0.25;

    /* Start bola acak supaya tiap spin kelihatan beda */
    const ballStart = Math.random() * Math.PI * 2;

    /* Target: posisi slot di world saat phase 3 selesai */
    const slotLocal    = finalSlotIdx * SLOT_ANG;
    const slotWorldEnd = wheelEnd3 + slotLocal;

    /* Hitung jarak terpendek dari posisi bola akhir phase2 → slot target.
       Gunakan modulo positif agar bola TIDAK berbalik arah — selalu maju */
    const rawBallEnd3 = ballStart + ballEnd2;
    let diff = slotWorldEnd - rawBallEnd3;
    /* Normalisasi ke [0, 2π] — bola hanya boleh maju (positif) */
    diff = ((diff % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const ballEnd3 = rawBallEnd3 + diff;

    let wheelAng  = 0;
    let ballAng   = ballStart;
    let ballOrbit = R * rBallOrbit;

    const startTs = performance.now();

    return new Promise(resolve => {
      function frame(now) {
        const e    = now - startTs;
        let   done = false;

        if (e < D.spin) {
          /* Phase 1: full speed — keduanya konstan */
          wheelAng  = W_SPD * e;
          ballAng   = ballStart + B_SPD * e;
          ballOrbit = R * rBallOrbit;

        } else if (e < T.fall) {
          /* Phase 2: melambat bersamaan */
          const t        = (e - D.spin) / D.slow;
          const integral = t - easeOut(t) * 0.75;
          wheelAng  = wheelEnd1 + W_SPD * D.slow * integral;
          ballAng   = ballStart + ballEnd1 + B_SPD * D.slow * integral;
          ballOrbit = R * rBallOrbit;

        } else if (e < T.bounce) {
          /* Phase 3: bola jatuh ke slot — lerp dari posisi akhir phase2 → target */
          const t   = (e - T.fall) / D.fall;
          const tE  = easeOutStrong(t);

          wheelAng  = wheelEnd2 + W_SPD * 0.08 * (e - T.fall);
          const ballPhase2 = ballStart + ballEnd2;
          ballAng   = ballPhase2 + diff * tE;  /* diff selalu positif → tidak balik */
          ballOrbit = R * (rBallOrbit + (rBallFall - rBallOrbit) * tE);

        } else {
          /* Phase 4: bounce settle */
          const t      = (e - T.bounce) / D.bounce;
          wheelAng     = wheelEnd3;
          ballAng      = slotWorldEnd;
          const bounce = Math.sin(t * Math.PI) * (1 - t) * 0.025;
          ballOrbit    = R * (rBallFall + bounce);
          if (e >= T.end) done = true;
        }

        drawFrame(wheelAng, ballOrbit, ballAng);
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
      drawFrame(0, R * rBallOrbit, Math.PI * 1.5);
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

    /* ── Tentukan hasil dari server (FIX Bug #4: tidak lagi Math.random() di client) ── */
    const isWin = _gacha.result === 'win';

    let resultColor;
    if (isWin) {
      resultColor = _bet;
    } else {
      /* Kalah → bola jatuh ke warna lain (termasuk hijau) */
      const losingColors = [...new Set(SLOTS.map(s => s.color).filter(c => c !== _bet))];
      resultColor = losingColors[Math.floor(Math.random() * losingColors.length)];
    }

    /* Pilih slot final sesuai resultColor */
    const candidates = SLOTS
      .map((s, i) => s.color === resultColor ? i : null)
      .filter(v => v !== null);
    const finalSlotIdx  = candidates[Math.floor(Math.random() * candidates.length)];
    const displayNumber = finalSlotIdx + 1;

    /* Update HUD */
    const lbl = document.getElementById('rchLabel');
    if (lbl) { lbl.textContent = '🎡 Spinning...'; lbl.className = 'rch-label rch-spinning'; }

    await runSpin(finalSlotIdx);
    if (_done) return;

    const colorEmoji = resultColor === 'red' ? '🔴' : resultColor === 'black' ? '⚫' : '🟢';
    if (lbl) {
      lbl.textContent = `${colorEmoji} ${displayNumber}`;
      lbl.className   = 'rch-label rch-result ' + (isWin ? 'rch-win' : 'rch-lose');
    }
    window.setStatus(isWin ? '🏆 MENANG!' : '💀 Kalah...', isWin);

    await new Promise(r => setTimeout(r, isWin ? 1200 : 800));
    if (_done) return;
    _done = true;

    /* ── Hitung prize berdasarkan warna hasil ──
       Merah/Hitam menang = 2x bet
       Hijau tidak bisa dibet → selalu lose, prize = 0 */
    const multiplier = 2;
    const prize      = isWin ? _gacha.betAmount * multiplier * 1000 : 0;  /* FIX Bug #5 */
    _onResult(isWin, prize);
  }

  return { init, selectBet, spin };
})();
