/* ══════════════════════════════════════
   GAME: ROULETTE — Casino Wheel
   Expose: Roulette.init(gacha, onResult)

   VISUAL : Canvas — wheel muter + bola di ring luar
   BOARD  : 16 slot (8x🔴, 7x⚫, 1x🟢) — sinkron bot WA
   BET    : merah / hitam
   ANIM   : bola muter berlawanan arah wheel,
            decelerate → fall ke slot → bounce → stop
══════════════════════════════════════ */
const Roulette = (() => {

  /* ── Board (sama persis bot WA, searah jarum jam) ── */
  const SLOTS = [
    { color: 'black' }, { color: 'red'   }, { color: 'black' }, { color: 'red'   },
    { color: 'black' }, { color: 'red'   }, { color: 'black' }, { color: 'red'   },
    { color: 'black' }, { color: 'red'   }, { color: 'black' }, { color: 'red'   },
    { color: 'black' }, { color: 'red'   }, { color: 'green' }, { color: 'red'   },
  ];
  const N = SLOTS.length; // 16
  const SLOT_ANG = (Math.PI * 2) / N;

  /* ── Palette ── */
  const C = {
    red:         '#c0392b',
    redLight:    '#e74c3c',
    black:       '#1a1a1a',
    blackLight:  '#2c2c2c',
    green:       '#27ae60',
    greenLight:  '#2ecc71',
    gold:        '#d4af5a',
    goldLight:   '#f0d080',
    goldDim:     '#8a7040',
    rim:         '#2a2010',
    rimLight:    '#4a3820',
    bg:          '#0c0c0e',
    ballShadow:  'rgba(0,0,0,0.6)',
  };

  let _gacha    = null;
  let _onResult = null;
  let _bet      = null;
  let _spinning = false;
  let _raf      = null;

  /* ── Render HTML shell ── */
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

        <!-- Bet selector -->
        <div class="roulette-bet-section">
          <div class="roulette-bet-label">Pilih Taruhan</div>
          <div class="roulette-bet-row">
            <button class="bet-btn bet-red"   id="betRed"   onclick="Roulette.selectBet('red')">🔴 Merah</button>
            <button class="bet-btn bet-black" id="betBlack" onclick="Roulette.selectBet('black')">⚫ Hitam</button>
          </div>
          <div class="roulette-odds">
            <span class="odds-item">🔴 8 slot</span>
            <span class="odds-sep">·</span>
            <span class="odds-item">⚫ 7 slot</span>
            <span class="odds-sep">·</span>
            <span class="odds-item">🟢 1 slot</span>
          </div>
        </div>

        <button class="spin-game-btn" id="spinGameBtn" onclick="Roulette.spin()" disabled>
          🎡 &nbsp;SPIN
        </button>
      </div>
    `;
  }

  /* ══════════════════════════════════════
     CANVAS RENDERER
  ══════════════════════════════════════ */
  let canvas, ctx, CX, CY, R;

  /* Radius constants (fraction of R) */
  const rWheel   = 0.78;   // outer edge of slots
  const rInner   = 0.40;   // inner hub edge
  const rRim     = 0.82;   // outer rim inner edge
  const rBallOrbit = 0.91; // ball orbit radius (center of ball track)
  const rBallFall  = 0.80; // ball final resting radius (inside slots)

  function initCanvas() {
    canvas = document.getElementById('rouletteCanvas');
    const wrap = canvas.parentElement;
    const size = Math.min(wrap.clientWidth, 320);
    canvas.width  = size;
    canvas.height = size;
    ctx = canvas.getContext('2d');
    CX = size / 2;
    CY = size / 2;
    R  = size / 2 - 4;
  }

  /* ── Draw wheel at angle `wheelAng` ── */
  function drawWheel(wheelAng) {
    // Outer rim ring
    const rimGrad = ctx.createRadialGradient(CX, CY, R * rWheel, CX, CY, R * rRim + 2);
    rimGrad.addColorStop(0,   C.rimLight);
    rimGrad.addColorStop(0.5, C.rim);
    rimGrad.addColorStop(1,   '#0a0800');
    ctx.beginPath();
    ctx.arc(CX, CY, R * (rRim + 0.04), 0, Math.PI * 2);
    ctx.fillStyle = rimGrad;
    ctx.fill();

    // Gold rim line
    ctx.beginPath();
    ctx.arc(CX, CY, R * rRim, 0, Math.PI * 2);
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Slots
    for (let i = 0; i < N; i++) {
      const ang0 = wheelAng + i * SLOT_ANG - SLOT_ANG / 2;
      const ang1 = ang0 + SLOT_ANG;
      const slot = SLOTS[i];

      // Fill
      let baseCol, lightCol;
      if (slot.color === 'red')        { baseCol = C.red;   lightCol = C.redLight;   }
      else if (slot.color === 'black') { baseCol = C.black; lightCol = C.blackLight; }
      else                             { baseCol = C.green; lightCol = C.greenLight; }

      ctx.beginPath();
      ctx.moveTo(CX, CY);
      ctx.arc(CX, CY, R * rWheel, ang0, ang1);
      ctx.closePath();

      const midAng  = wheelAng + i * SLOT_ANG;
      const gx0 = CX + Math.cos(midAng) * R * rInner;
      const gy0 = CY + Math.sin(midAng) * R * rInner;
      const gx1 = CX + Math.cos(midAng) * R * rWheel;
      const gy1 = CY + Math.sin(midAng) * R * rWheel;
      const sg = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
      sg.addColorStop(0, lightCol);
      sg.addColorStop(1, baseCol);
      ctx.fillStyle = sg;
      ctx.fill();

      // Divider lines
      ctx.beginPath();
      ctx.moveTo(
        CX + Math.cos(ang0) * R * rInner,
        CY + Math.sin(ang0) * R * rInner
      );
      ctx.lineTo(
        CX + Math.cos(ang0) * R * rWheel,
        CY + Math.sin(ang0) * R * rWheel
      );
      ctx.strokeStyle = 'rgba(212,175,90,0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Gold inner rim circle
    ctx.beginPath();
    ctx.arc(CX, CY, R * rInner, 0, Math.PI * 2);
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Hub center
    const hubGrad = ctx.createRadialGradient(CX - 4, CY - 4, 1, CX, CY, R * rInner * 0.9);
    hubGrad.addColorStop(0,   C.goldLight);
    hubGrad.addColorStop(0.4, C.gold);
    hubGrad.addColorStop(1,   C.goldDim);
    ctx.beginPath();
    ctx.arc(CX, CY, R * rInner * 0.9, 0, Math.PI * 2);
    ctx.fillStyle = hubGrad;
    ctx.fill();

    // Hub diamond pattern
    ctx.save();
    ctx.translate(CX, CY);
    ctx.rotate(wheelAng);
    for (let i = 0; i < 8; i++) {
      ctx.rotate(Math.PI / 4);
      ctx.beginPath();
      ctx.moveTo(0, -R * rInner * 0.55);
      ctx.lineTo(R * rInner * 0.12, 0);
      ctx.lineTo(0, R * rInner * 0.55);
      ctx.lineTo(-R * rInner * 0.12, 0);
      ctx.closePath();
      ctx.fillStyle = i % 2 === 0
        ? 'rgba(10,8,0,0.35)'
        : 'rgba(255,235,180,0.15)';
      ctx.fill();
    }
    ctx.restore();

    // Hub center dot
    ctx.beginPath();
    ctx.arc(CX, CY, R * 0.04, 0, Math.PI * 2);
    ctx.fillStyle = C.bg;
    ctx.fill();
    ctx.strokeStyle = C.goldDim;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  /* ── Draw ball ── */
  function drawBall(orbitR, ballAng) {
    const bx = CX + Math.cos(ballAng) * orbitR;
    const by = CY + Math.sin(ballAng) * orbitR;
    const br = R * 0.055;

    // Shadow
    ctx.beginPath();
    ctx.arc(bx + br * 0.3, by + br * 0.5, br * 0.9, 0, Math.PI * 2);
    ctx.fillStyle = C.ballShadow;
    ctx.fill();

    // Ball gradient (shiny ivory)
    const bg = ctx.createRadialGradient(
      bx - br * 0.35, by - br * 0.35, br * 0.05,
      bx, by, br
    );
    bg.addColorStop(0,   '#ffffff');
    bg.addColorStop(0.3, '#f0ede8');
    bg.addColorStop(0.7, '#c8c4bc');
    bg.addColorStop(1,   '#908c84');
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fillStyle = bg;
    ctx.fill();

    // Specular highlight
    ctx.beginPath();
    ctx.arc(bx - br * 0.3, by - br * 0.3, br * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fill();
  }

  /* ── Full frame ── */
  function drawFrame(wheelAng, ballOrbitR, ballAng) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Track circle (ball lane)
    ctx.beginPath();
    ctx.arc(CX, CY, R * rBallOrbit, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(212,175,90,0.12)';
    ctx.lineWidth = R * (rRim - rWheel) * 2;
    ctx.stroke();

    drawWheel(wheelAng);
    drawBall(ballOrbitR, ballAng);
  }

  /* ══════════════════════════════════════
     ANIMATION LOGIC
  ══════════════════════════════════════ */
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  async function runSpin(finalSlotIdx) {
    const WHEEL_SPEED  = 0.008;  // rad/frame wheel rotation
    const BALL_SPEED_0 = -0.045; // initial ball rad/frame (opposite dir)

    /* Phase durations in ms */
    const phaseDur = {
      spin:   3200,  // ball spinning fast
      slow:   2400,  // decelerating
      fall:   600,   // ball falling inward
      bounce: 500,   // settle bounce
    };

    const totalMs = phaseDur.spin + phaseDur.slow + phaseDur.fall + phaseDur.bounce;

    /* Target: center angle of final slot */
    const targetSlotAng = finalSlotIdx * SLOT_ANG;

    /* We'll compute where ball needs to land */
    let wheelAng = 0;
    let ballAng  = Math.random() * Math.PI * 2; // random start

    const start = performance.now();
    let lastT   = start;

    return new Promise(resolve => {
      function frame(now) {
        const elapsed = now - start;
        const dt      = now - lastT;
        lastT = now;

        let ballOrbitR = R * rBallOrbit;
        let done = false;

        if (elapsed < phaseDur.spin) {
          /* Phase 1: full speed */
          wheelAng += WHEEL_SPEED * dt * 0.06;
          ballAng  += BALL_SPEED_0 * dt * 0.06;

        } else if (elapsed < phaseDur.spin + phaseDur.slow) {
          /* Phase 2: decelerate */
          const t = (elapsed - phaseDur.spin) / phaseDur.slow;
          const factor = 1 - easeOut(t);
          wheelAng += WHEEL_SPEED * factor * dt * 0.06;
          ballAng  += BALL_SPEED_0 * factor * dt * 0.06;

        } else if (elapsed < phaseDur.spin + phaseDur.slow + phaseDur.fall) {
          /* Phase 3: ball falls inward — compute current wheel angle to find slot center */
          const t = (elapsed - phaseDur.spin - phaseDur.slow) / phaseDur.fall;

          /* Where should the ball land? slot center in world coords = targetSlotAng + wheelAng */
          const slotWorldAng = wheelAng + targetSlotAng;

          /* Lerp ballAng toward slotWorldAng */
          let diff = slotWorldAng - ballAng;
          diff = ((diff + Math.PI) % (Math.PI * 2)) - Math.PI; // normalize to -π..π
          ballAng += diff * t * 0.12;

          /* Fall inward */
          ballOrbitR = R * (rBallOrbit - (rBallOrbit - rBallFall) * easeOut(t));

          /* Slow wheel too */
          wheelAng += WHEEL_SPEED * 0.15 * dt * 0.06;

        } else {
          /* Phase 4: settled with tiny bounce */
          const t = (elapsed - phaseDur.spin - phaseDur.slow - phaseDur.fall) / phaseDur.bounce;
          const slotWorldAng = wheelAng + targetSlotAng;
          ballAng   = slotWorldAng;
          ballOrbitR = R * (rBallFall + Math.sin(t * Math.PI) * 0.025);
          wheelAng  += WHEEL_SPEED * 0.05 * dt * 0.06;

          if (elapsed >= totalMs) done = true;
        }

        drawFrame(wheelAng, ballOrbitR, ballAng);
        if (done) { resolve(wheelAng); return; }
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
    if (_raf) { cancelAnimationFrame(_raf); _raf = null; }

    const area = document.createElement('div');
    area.id        = 'gameArea';
    area.className = 'game-area slide-in';
    area.innerHTML = render();

    const infoCard  = document.getElementById('gachaInfoCard');
    const existGame = document.getElementById('gameArea');

    if (infoCard)        infoCard.replaceWith(area);
    else if (existGame)  existGame.replaceWith(area);
    else document.querySelector('.glass-card').insertAdjacentElement('afterend', area);

    /* Init canvas after DOM insert */
    requestAnimationFrame(() => {
      initCanvas();
      drawFrame(0, R * rBallOrbit, Math.PI * 1.5);
    });
  }

  function selectBet(color) {
    if (_spinning) return;
    _bet = color;

    document.getElementById('betRed').classList.toggle('selected', color === 'red');
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
    if (window._gameFinished || _spinning || !_bet) return;

    const spinBtn = document.getElementById('spinGameBtn');
    if (!spinBtn || spinBtn.disabled) return;

    _spinning = true;
    spinBtn.disabled = true;
    document.getElementById('betRed').disabled   = true;
    document.getElementById('betBlack').disabled = true;
    window.setStatus('🎡 Bola berputar...', true);

    /* Tentukan hasil */
    const chance = _gacha.isPremium ? 0.45 : 0.35;
    const isWin  = Math.random() < chance;
    const resultColor = isWin ? _bet : (_bet === 'red' ? 'black' : 'red');

    /* Pilih slot final */
    const candidates = SLOTS
      .map((s, i) => s.color === resultColor ? i : null)
      .filter(v => v !== null);
    const finalSlotIdx = candidates[Math.floor(Math.random() * candidates.length)];

    /* Update HUD */
    const lbl = document.getElementById('rchLabel');
    if (lbl) { lbl.textContent = '🎡 Spinning...'; lbl.className = 'rch-label rch-spinning'; }

    /* Run animation */
    await runSpin(finalSlotIdx);

    if (window._gameFinished) return;

    /* Result HUD */
    const colorEmoji = resultColor === 'red' ? '🔴' : resultColor === 'black' ? '⚫' : '🟢';
    const number = resultColor === 'red'
      ? (Math.floor(Math.random() * 18) * 2 + 1)
      : (Math.floor(Math.random() * 18) * 2);

    if (lbl) {
      lbl.textContent = `${colorEmoji} ${number}`;
      lbl.className   = 'rch-label rch-result ' + (isWin ? 'rch-win' : 'rch-lose');
    }

    window.setStatus(isWin ? '🏆 MENANG!' : '💀 Kalah...', isWin);

    await new Promise(r => setTimeout(r, isWin ? 1200 : 800));
    if (window._gameFinished) return;
    _onResult(isWin, _gacha.money);
  }

  return { init, selectBet, spin };
})();
