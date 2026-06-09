/* ══════════════════════════════════════
   SPACEMAN — Predetermined Crash Game
   games/spaceman.js
══════════════════════════════════════ */

const Spaceman = (() => {

  /* ── Config ── */
  const TICK_MS        = 80;     // update interval
  const SPEED_BASE     = 0.018;  // multiplier increment per tick (normal)
  const SPEED_FAST     = 0.038;  // faster after 2x
  const CASHOUT_WINDOW = 0.35;   // seconds before crash user can still cashout (WIN)
  const ASTEROID_COUNT = 7;      // floating asteroids in canvas

  /* ── State ── */
  let _gacha      = null;
  let _callback   = null;
  let _multiplier = 1.00;
  let _crashAt    = 1.00;
  let _phase      = 'idle';   // idle | flying | crashed | done
  let _tickTimer  = null;
  let _rafId      = null;
  let _cashedOut  = false;
  let _autoCrash  = false;

  /* ── Canvas & ctx ── */
  let _canvas = null;
  let _ctx    = null;

  /* ── Asteroid objects ── */
  let _asteroids = [];

  /* ── Spaceship animation state ── */
  let _shipX = 0, _shipY = 0;
  let _trail  = [];   // [{x,y}] last N positions
  const TRAIL_LEN = 28;

  /* ────────────────────────────────────
     INIT
  ──────────────────────────────────── */
  function init(gacha, callback) {
    _gacha    = gacha;
    _callback = callback;
    _reset();
    _render();
  }

  function _reset() {
    _multiplier = 1.00;
    _phase      = 'idle';
    _cashedOut  = false;
    _autoCrash  = false;
    _trail      = [];
    if (_tickTimer) clearInterval(_tickTimer);
    if (_rafId)     cancelAnimationFrame(_rafId);
    _tickTimer = null;
    _rafId     = null;
  }

  /* ────────────────────────────────────
     CRASH POINT CALCULATION
     - WIN:  crashAt = targetMultiplier + small buffer
     - LOSE: crashAt between 1.05 and 1.60 (crash early)
  ──────────────────────────────────── */
  function _calcCrashAt(isWin) {
    if (isWin) {
      /* Pick a "safe" multiplier between 1.5 – 4.0, auto-cashout before it */
      const target = 1.5 + Math.random() * 2.5;
      return parseFloat((target + 0.15 + Math.random() * 0.25).toFixed(2));
    } else {
      /* Crash before 1.5 so user never gets a good multiplier */
      return parseFloat((1.05 + Math.random() * 0.55).toFixed(2));
    }
  }

  /* ────────────────────────────────────
     RENDER — inject HTML
  ──────────────────────────────────── */
  function _render() {
    /* Remove old gameArea */
    const old = document.getElementById('gameArea');
    if (old) old.remove();

    const infoCard = document.getElementById('gachaInfoCard');

    const area = document.createElement('div');
    area.id        = 'gameArea';
    area.className = 'game-area slide-in';

    area.innerHTML = `
      <div class="spaceman-card" id="spacemanCard">

        <!-- Header label -->
        <div class="slot-section-label">🚀 SPACEMAN</div>

        <!-- Canvas -->
        <div class="spaceman-canvas-wrap">
          <canvas id="spacemanCanvas" width="380" height="240"></canvas>
          <!-- Multiplier overlay -->
          <div class="spaceman-multiplier-hud" id="smHud">
            <div class="sm-multi-label">MULTIPLIER</div>
            <div class="sm-multi-value" id="smMultiVal">1.00×</div>
          </div>
        </div>

        <!-- Cashout button -->
        <button class="spaceman-cashout-btn" id="smCashoutBtn" onclick="Spaceman._onCashout()">
          🚀 &nbsp;CASHOUT
        </button>

        <!-- Info row -->
        <div class="spaceman-info-row">
          <div class="spaceman-info-item">
            <span class="spaceman-info-label">Hadiah</span>
            <span class="spaceman-info-val gold" id="smPrize">
              Rp ${Number(_gacha.money).toLocaleString('id-ID')}
            </span>
          </div>
          <div class="spaceman-info-item">
            <span class="spaceman-info-label">Status</span>
            <span class="spaceman-info-val" id="smStatus">Tekan Cashout!</span>
          </div>
        </div>

        <!-- Win rule -->
        <div class="win-rule">
          <div class="win-rule-title">🛸 Cara Main</div>
          <div class="win-rule-desc">
            Tekan <strong>Cashout</strong> sebelum pesawat menabrak asteroid.<br>
            Cashout = menang hadiah. Nabrak = lose!
          </div>
        </div>

      </div>
    `;

    if (infoCard) {
      infoCard.replaceWith(area);
    } else {
      document.querySelector('.glass-card').insertAdjacentElement('afterend', area);
    }

    /* Setup canvas */
    _canvas = document.getElementById('spacemanCanvas');
    _ctx    = _canvas.getContext('2d');
    _resizeCanvas();

    /* Init asteroids */
    _initAsteroids();

    /* Start flying after short delay */
    setTimeout(_startFlight, 600);
  }

  function _resizeCanvas() {
    const wrap  = _canvas.parentElement;
    const w     = wrap.clientWidth;
    const ratio = window.devicePixelRatio || 1;
    _canvas.width  = w * ratio;
    _canvas.height = 240 * ratio;
    _canvas.style.width  = w + 'px';
    _canvas.style.height = '240px';
    _ctx.scale(ratio, ratio);
    /* Logical size */
    _canvas._lw = w;
    _canvas._lh = 240;
  }

  /* ────────────────────────────────────
     ASTEROIDS
  ──────────────────────────────────── */
  function _initAsteroids() {
    const W = _canvas._lw || 380;
    const H = _canvas._lh || 240;
    _asteroids = [];
    for (let i = 0; i < ASTEROID_COUNT; i++) {
      _asteroids.push({
        x:    20 + Math.random() * (W - 40),
        y:    20 + Math.random() * (H - 60),
        r:    6  + Math.random() * 14,
        vx:  -0.15 - Math.random() * 0.2,
        vy:   (Math.random() - 0.5) * 0.15,
        rot:  Math.random() * Math.PI * 2,
        drot: (Math.random() - 0.5) * 0.012,
        /* color tone */
        tone: Math.floor(60 + Math.random() * 40),
      });
    }
  }

  function _updateAsteroids() {
    const W = _canvas._lw || 380;
    const H = _canvas._lh || 240;
    _asteroids.forEach(a => {
      a.x   += a.vx;
      a.y   += a.vy;
      a.rot += a.drot;
      /* Wrap horizontally */
      if (a.x + a.r < 0)  a.x = W + a.r;
      if (a.x - a.r > W)  a.x = -a.r;
      if (a.y + a.r < 0)  a.y = H + a.r;
      if (a.y - a.r > H)  a.y = -a.r;
    });
  }

  /* ────────────────────────────────────
     FLIGHT LOGIC
  ──────────────────────────────────── */
  function _startFlight() {
    const isWin = _gacha.result === 'win' || (_gacha.result == null && Math.random() < 0.5);
    _crashAt    = _calcCrashAt(isWin);
    _phase      = 'flying';

    /* For WIN: schedule auto-cashout slightly before crash */
    if (isWin) {
      const cashoutAt = _crashAt - 0.10 - Math.random() * 0.08;
      _autoCrashAt    = cashoutAt;
      _autoCrash      = true;
    }

    /* Init ship position */
    const W = _canvas._lw || 380;
    const H = _canvas._lh || 240;
    _shipX  = W * 0.12;
    _shipY  = H * 0.72;

    /* Enable cashout button */
    const btn = document.getElementById('smCashoutBtn');
    if (btn) {
      btn.disabled  = false;
      btn.classList.add('active');
    }

    _tickTimer = setInterval(_tick, TICK_MS);
    _rafId     = requestAnimationFrame(_drawLoop);
  }

  let _autoCrashAt = 99;

  function _tick() {
    if (_phase !== 'flying') return;

    const inc = _multiplier >= 2 ? SPEED_FAST : SPEED_BASE;
    _multiplier = parseFloat((_multiplier + inc).toFixed(2));

    /* Update HUD */
    const val = document.getElementById('smMultiVal');
    if (val) {
      val.textContent = _multiplier.toFixed(2) + '×';
      val.className   = 'sm-multi-value ' + (_multiplier >= 2 ? 'danger' : '');
    }

    /* AUTO CASHOUT (WIN path) */
    if (_autoCrash && _multiplier >= _autoCrashAt && !_cashedOut) {
      _triggerCashout();
      return;
    }

    /* CRASH */
    if (_multiplier >= _crashAt) {
      _triggerCrash();
    }
  }

  /* ────────────────────────────────────
     CASHOUT & CRASH
  ──────────────────────────────────── */
  function _onCashout() {
    if (_phase !== 'flying' || _cashedOut) return;
    /* Manual cashout — only wins if result is win */
    const isWin = _gacha.result === 'win';
    if (isWin) {
      _triggerCashout();
    } else {
      /* Lose: trigger crash immediately on manual cashout */
      _triggerCrash();
    }
  }

  function _triggerCashout() {
    if (_cashedOut) return;
    _cashedOut = true;
    _phase     = 'done';
    clearInterval(_tickTimer);

    const btn = document.getElementById('smCashoutBtn');
    if (btn) {
      btn.disabled    = true;
      btn.textContent = '✓ Cashed Out!';
      btn.classList.remove('active');
      btn.classList.add('success');
    }

    const stat = document.getElementById('smStatus');
    if (stat) { stat.textContent = '✅ Cashout berhasil!'; stat.style.color = 'var(--win-green)'; }

    const hud = document.getElementById('smHud');
    if (hud) hud.classList.add('win');

    setTimeout(() => {
      cancelAnimationFrame(_rafId);
      _callback(true, _gacha.money);
    }, 1400);
  }

  function _triggerCrash() {
    _phase = 'crashed';
    clearInterval(_tickTimer);

    const btn = document.getElementById('smCashoutBtn');
    if (btn) {
      btn.disabled    = true;
      btn.textContent = '💥 NABRAK!';
      btn.classList.remove('active');
      btn.classList.add('exploded');
    }

    const val = document.getElementById('smMultiVal');
    if (val) { val.textContent = '💥 CRASH'; val.className = 'sm-multi-value crash'; }

    const stat = document.getElementById('smStatus');
    if (stat) { stat.textContent = '💀 Pesawat meledak!'; stat.style.color = 'var(--lose-red)'; }

    const hud = document.getElementById('smHud');
    if (hud) hud.classList.add('lose');

    /* Explosion draw */
    _drawExplosion();

    setTimeout(() => {
      cancelAnimationFrame(_rafId);
      _callback(false, _gacha.money);
    }, 1800);
  }

  /* ────────────────────────────────────
     DRAW LOOP
  ──────────────────────────────────── */
  function _drawLoop() {
    if (_phase === 'done') return;
    _draw();
    _rafId = requestAnimationFrame(_drawLoop);
  }

  function _draw() {
    const ctx = _ctx;
    const W   = _canvas._lw || 380;
    const H   = _canvas._lh || 240;

    /* Clear */
    ctx.clearRect(0, 0, W, H);

    /* Background */
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#07070f');
    bgGrad.addColorStop(1, '#0c0c1e');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    /* Stars */
    _drawStars(ctx, W, H);

    /* Asteroids */
    _updateAsteroids();
    _drawAsteroids(ctx);

    if (_phase === 'flying' || _phase === 'done') {
      /* Update ship position — arc upward */
      const t  = (_multiplier - 1) / 4;
      const tE = Math.min(t, 1);
      _shipX   = W * (0.12 + tE * 0.55);
      _shipY   = H * (0.72 - tE * 0.55);

      /* Trail */
      _trail.push({ x: _shipX, y: _shipY });
      if (_trail.length > TRAIL_LEN) _trail.shift();

      _drawTrail(ctx);
      _drawShip(ctx, _shipX, _shipY, false);
    }
  }

  /* ── Stars ── */
  let _stars = null;
  function _drawStars(ctx, W, H) {
    if (!_stars) {
      _stars = [];
      for (let i = 0; i < 80; i++) {
        _stars.push({
          x: Math.random() * 380,
          y: Math.random() * 240,
          r: 0.5 + Math.random() * 1.2,
          a: 0.2 + Math.random() * 0.6,
        });
      }
    }
    _stars.forEach(s => {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${s.a})`;
      ctx.fill();
    });
  }

  /* ── Asteroids ── */
  function _drawAsteroids(ctx) {
    _asteroids.forEach(a => {
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.rot);

      /* Rocky shape */
      ctx.beginPath();
      const sides = 7;
      for (let i = 0; i < sides; i++) {
        const ang  = (i / sides) * Math.PI * 2;
        const jit  = 0.7 + ((i * 37 + a.tone) % 10) / 30;
        const rx   = Math.cos(ang) * a.r * jit;
        const ry   = Math.sin(ang) * a.r * jit;
        i === 0 ? ctx.moveTo(rx, ry) : ctx.lineTo(rx, ry);
      }
      ctx.closePath();

      ctx.fillStyle   = `rgb(${a.tone},${a.tone - 10},${a.tone - 20})`;
      ctx.strokeStyle = `rgba(200,180,140,0.25)`;
      ctx.lineWidth   = 1;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });
  }

  /* ── Trail ── */
  function _drawTrail(ctx) {
    if (_trail.length < 2) return;
    for (let i = 1; i < _trail.length; i++) {
      const alpha = (i / _trail.length) * 0.55;
      const width = (i / _trail.length) * 3;
      ctx.beginPath();
      ctx.moveTo(_trail[i - 1].x, _trail[i - 1].y);
      ctx.lineTo(_trail[i].x, _trail[i].y);
      ctx.strokeStyle = `rgba(255,180,60,${alpha})`;
      ctx.lineWidth   = width;
      ctx.lineCap     = 'round';
      ctx.stroke();
    }
    /* Glow at tip */
    const tip = _trail[_trail.length - 1];
    const g   = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, 10);
    g.addColorStop(0, 'rgba(255,140,40,0.5)');
    g.addColorStop(1, 'rgba(255,140,40,0)');
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 10, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
  }

  /* ── Ship ── */
  function _drawShip(ctx, x, y, exploded) {
    ctx.save();
    ctx.translate(x, y);
    /* Tilt upward based on speed */
    const tilt = -0.45 - (_multiplier - 1) * 0.04;
    ctx.rotate(Math.min(tilt, -0.1));

    if (exploded) {
      ctx.font      = '28px serif';
      ctx.textAlign = 'center';
      ctx.fillText('💥', 0, 0);
    } else {
      ctx.font      = '26px serif';
      ctx.textAlign = 'center';
      ctx.fillText('🚀', 0, 0);
    }

    ctx.restore();
  }

  /* ── Explosion ── */
  function _drawExplosion() {
    let frame  = 0;
    const maxF = 22;
    const loop = () => {
      if (!_ctx || frame > maxF) return;
      _draw();
      const ctx = _ctx;
      const r   = frame * 5;
      const a   = 1 - frame / maxF;
      const g   = ctx.createRadialGradient(_shipX, _shipY, 0, _shipX, _shipY, r);
      g.addColorStop(0,   `rgba(255,220,80,${a})`);
      g.addColorStop(0.4, `rgba(255,80,20,${a * 0.7})`);
      g.addColorStop(1,   `rgba(255,20,0,0)`);
      ctx.beginPath();
      ctx.arc(_shipX, _shipY, r, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      /* Ship emoji replaced */
      ctx.font = '28px serif'; ctx.textAlign = 'center';
      ctx.fillText('💥', _shipX, _shipY + 10);
      frame++;
      requestAnimationFrame(loop);
    };
    loop();
  }

  /* ── Expose ── */
  return { init, _onCashout };

})();
