/* ══════════════════════════════════════
   SPACEMAN — Predetermined Crash Game
   games/spaceman.js
══════════════════════════════════════ */

const Spaceman = (() => {

  /* ── Config ── */
  const TICK_MS        = 33;    // ~60fps tick
  const SPEED_BASE     = 0.012; // multiplier increment per tick (normal)
  const SPEED_FAST     = 0.025; // faster after 2x
  const ASTEROID_COUNT = 8;
  const TRAIL_LEN      = 40;

  /* ── State ── */
  let _gacha       = null;
  let _callback    = null;
  let _multiplier  = 1.00;
  let _crashAt     = 1.00;
  let _autoCrashAt = 99;
  let _phase       = 'idle';  // idle | ready | flying | crashed | done
  let _tickTimer   = null;
  let _rafId       = null;
  let _cashedOut   = false;
  let _autoCrash   = false;
  let _crashHead   = false;   // user picked crashhead
  let _isWin       = false;

  /* ── Canvas ── */
  let _canvas = null;
  let _ctx    = null;

  /* ── Visuals ── */
  let _asteroids = [];
  let _stars     = null;
  let _shipX = 0, _shipY = 0;
  let _trail = [];

  /* ── Idle animation ── */
  let _idleT    = 0;
  let _idleRafId = null;

  /* ────────────────────────────────────
     PUBLIC: INIT
  ──────────────────────────────────── */
  function init(gacha, callback) {
    _gacha    = gacha;
    _callback = callback;
    _reset();
    _render();
  }

  function _reset() {
    _multiplier  = 1.00;
    _phase       = 'idle';
    _cashedOut   = false;
    _autoCrash   = false;
    _crashHead   = false;
    _isWin       = false;
    _autoCrashAt = 99;
    _trail       = [];
    _stars       = null;
    if (_tickTimer)  clearInterval(_tickTimer);
    if (_rafId)      cancelAnimationFrame(_rafId);
    if (_idleRafId)  cancelAnimationFrame(_idleRafId);
    _tickTimer = _rafId = _idleRafId = null;
  }

  /* FIX BUG 10: _gameFinished di app.js adalah `let`, tidak ter-expose ke window.
     Gunakan helper ini untuk semua cek. */
  function isGameDone() {
    return typeof _gameFinished !== 'undefined' ? _gameFinished : !!window._gameFinished;
  }

  /* ────────────────────────────────────
     CRASH POINT
     WIN:  crash 1.5 – 4.0  (cashout sebelumnya)
     LOSE: crash 1.05 – 1.60 (crash early)
  ──────────────────────────────────── */
  function _calcCrashAt(isWin) {
    if (isWin) {
      const target = 1.5 + Math.random() * 2.5;
      return parseFloat((target + 0.15 + Math.random() * 0.25).toFixed(2));
    } else {
      return parseFloat((1.05 + Math.random() * 0.55).toFixed(2));
    }
  }

  /* ────────────────────────────────────
     RENDER — inject HTML
  ──────────────────────────────────── */
  function _render() {
    const old = document.getElementById('gameArea');
    if (old) old.remove();
    const infoCard = document.getElementById('gachaInfoCard');

    const area = document.createElement('div');
    area.id        = 'gameArea';
    area.className = 'game-area slide-in';

    area.innerHTML = `
      <div class="spaceman-card" id="spacemanCard">

        <div class="slot-section-label">🚀 SPACEMAN</div>

        <!-- Canvas -->
        <div class="spaceman-canvas-wrap">
          <canvas id="spacemanCanvas"></canvas>
          <div class="spaceman-multiplier-hud" id="smHud">
            <div class="sm-multi-label">MULTIPLIER</div>
            <div class="sm-multi-value" id="smMultiVal">1.00×</div>
          </div>
        </div>

        <!-- 3-button row -->
        <div class="sm-btn-row" id="smBtnRow">
          <button class="sm-btn sm-btn-cashout" id="smCashoutBtn"
                  onclick="Spaceman._onCashout()" disabled>
            💰 CASHOUT
          </button>
          <button class="sm-btn sm-btn-start" id="smStartBtn"
                  onclick="Spaceman._onStart()">
            ▶ START
          </button>
          <button class="sm-btn sm-btn-crashhead" id="smCrashHeadBtn"
                  onclick="Spaceman._onCrashHead()" disabled>
            ☄️ CRASHHEAD
          </button>
        </div>

        <!-- Info row -->
        <div class="spaceman-info-row">
          <div class="spaceman-info-item">
            <span class="spaceman-info-label">Hadiah</span>
            <span class="spaceman-info-val gold">
              Rp ${Number(_gacha.money).toLocaleString('id-ID')}
            </span>
          </div>
          <div class="spaceman-info-item">
            <span class="spaceman-info-label">Status</span>
            <span class="spaceman-info-val" id="smStatus">Tekan START!</span>
          </div>
        </div>

        <!-- Rule -->
        <div class="win-rule">
          <div class="win-rule-title">🛸 Cara Main</div>
          <div class="win-rule-desc">
            Tekan <strong>START</strong> untuk meluncur.<br>
            <strong>CASHOUT</strong> = ambil hadiah &amp; berhenti.<br>
            <strong>CRASHHEAD</strong> = lanjut terbang sampai meledak.
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
    _initAsteroids();

    /* Determine win/lose NOW so idle draws correct ship pos */
    _isWin   = _gacha.result === 'win';
    _crashAt = _calcCrashAt(_isWin);
    if (_isWin) {
      _autoCrashAt = _crashAt - 0.10 - Math.random() * 0.08;
      _autoCrash   = true;
    }

    /* Set ship to start position */
    const W = _canvas._lw || 380;
    const H = _canvas._lh || 240;
    _shipX  = W * 0.12;
    _shipY  = H * 0.72;

    /* Start idle loop */
    _phase = 'ready';
    _idleLoop();
  }

  /* ────────────────────────────────────
     RESIZE
  ──────────────────────────────────── */
  function _resizeCanvas() {
    const wrap  = _canvas.parentElement;
    const w     = wrap.clientWidth || 380;
    const ratio = window.devicePixelRatio || 1;
    _canvas.width        = w * ratio;
    _canvas.height       = 240 * ratio;
    _canvas.style.width  = w + 'px';
    _canvas.style.height = '240px';
    _ctx.scale(ratio, ratio);
    _canvas._lw = w;
    _canvas._lh = 240;
  }

  /* ────────────────────────────────────
     IDLE LOOP — rocket diam, hover pelan
  ──────────────────────────────────── */
  function _idleLoop() {
    if (_phase !== 'ready') return;
    _idleT += 0.04;

    const W = _canvas._lw || 380;
    const H = _canvas._lh || 240;

    /* Gentle hover */
    const baseX = W * 0.12;
    const baseY = H * 0.72;
    _shipX = baseX + Math.sin(_idleT * 0.7) * 3;
    _shipY = baseY + Math.sin(_idleT) * 5;

    _drawScene(false);
    _idleRafId = requestAnimationFrame(_idleLoop);
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
        r:    5  + Math.random() * 13,
        vx:  -0.18 - Math.random() * 0.22,
        vy:   (Math.random() - 0.5) * 0.18,
        rot:  Math.random() * Math.PI * 2,
        drot: (Math.random() - 0.5) * 0.014,
        tone: Math.floor(55 + Math.random() * 45),
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
      if (a.x + a.r < 0)  a.x = W + a.r;
      if (a.x - a.r > W)  a.x = -a.r;
      if (a.y + a.r < 0)  a.y = H + a.r;
      if (a.y - a.r > H)  a.y = -a.r;
    });
  }

  /* ────────────────────────────────────
     BUTTON HANDLERS
  ──────────────────────────────────── */
  function _onStart() {
    if (_phase !== 'ready') return;

    cancelAnimationFrame(_idleRafId);
    _idleRafId = null;

    /* Hide start, enable cashout + crashhead */
    const startBtn     = document.getElementById('smStartBtn');
    const cashoutBtn   = document.getElementById('smCashoutBtn');
    const crashHeadBtn = document.getElementById('smCrashHeadBtn');

    if (startBtn)     { startBtn.disabled = true; startBtn.classList.add('used'); }
    if (cashoutBtn)   { cashoutBtn.disabled = false; cashoutBtn.classList.add('active'); }
    if (crashHeadBtn) { crashHeadBtn.disabled = false; crashHeadBtn.classList.add('active'); }

    const stat = document.getElementById('smStatus');
    if (stat) stat.textContent = 'Terbang! Cashout atau Crashhead?';

    _phase = 'flying';
    _tickTimer = setInterval(_tick, TICK_MS);
    _rafId     = requestAnimationFrame(_drawLoop);
  }

  function _onCashout() {
    if (_phase !== 'flying' || _cashedOut) return;
    if (_isWin) {
      _triggerCashout();
    } else {
      /* Lose — tekan cashout langsung crash */
      _triggerCrash();
    }
  }

  function _onCrashHead() {
    if (_phase !== 'flying' || _cashedOut) return;
    _crashHead = true;

    const crashHeadBtn = document.getElementById('smCrashHeadBtn');
    const cashoutBtn   = document.getElementById('smCashoutBtn');
    if (crashHeadBtn) { crashHeadBtn.disabled = true; crashHeadBtn.classList.remove('active'); crashHeadBtn.classList.add('used'); }
    if (cashoutBtn)   { cashoutBtn.disabled   = true; cashoutBtn.classList.remove('active'); }

    const stat = document.getElementById('smStatus');
    if (stat) { stat.textContent = '☄️ Lanjut sampai meledak...'; stat.style.color = 'var(--lose-red)'; }

    /* FIX BUG 8: paksa crash segera di tick berikutnya
       dengan set _crashAt ke multiplier saat ini + sedikit delay visual (0.10) */
    _autoCrash = false;                          // FIX BUG 9: batalkan auto-cashout WIN
    _crashAt   = _multiplier + 0.10;            // crash dalam ~3-4 tick
  }

  /* ────────────────────────────────────
     TICK
  ──────────────────────────────────── */
  function _tick() {
    if (_phase !== 'flying') return;

    const inc   = _multiplier >= 2 ? SPEED_FAST : SPEED_BASE;
    _multiplier = parseFloat((_multiplier + inc).toFixed(3));

    const val = document.getElementById('smMultiVal');
    if (val) {
      val.textContent = _multiplier.toFixed(2) + '×';
      val.className   = 'sm-multi-value' +
        (_multiplier >= 2.5 ? ' danger' : _multiplier >= 1.8 ? ' warning' : '');
    }

    /* Auto cashout — WIN path, only if user belum pilih crashhead */
    if (_autoCrash && !_crashHead && _multiplier >= _autoCrashAt && !_cashedOut) {
      _triggerCashout();
      return;
    }

    /* Crash */
    if (_multiplier >= _crashAt) {
      _triggerCrash();
    }
  }

  /* ────────────────────────────────────
     CASHOUT & CRASH
  ──────────────────────────────────── */
  function _triggerCashout() {
    if (_cashedOut) return;
    _cashedOut = true;
    _phase     = 'done';
    clearInterval(_tickTimer);

    _disableAllBtns();
    const cashoutBtn = document.getElementById('smCashoutBtn');
    if (cashoutBtn) { cashoutBtn.textContent = '✓ Cashed Out!'; cashoutBtn.classList.add('success'); }

    /* ── Hitung prize dengan pajak 5% ──
       betAmount dalam satuan bet (1 bet = 1k)
       prize = betAmount * multiplier * (1 - 0.05)
       kembalikan dalam Rupiah agar konsisten dengan game lain */
    const TAX        = 0.05;
    const betAmount  = _gacha.betAmount || (_gacha.money / 1000); // fallback ke money/1k
    const grossPrize = betAmount * _multiplier * 1000;            // dalam Rp
    const netPrize   = Math.floor(grossPrize * (1 - TAX));        // potong pajak, bulatkan

    /* Update HUD multiplier untuk tampilkan info pajak */
    const val = document.getElementById('smMultiVal');
    if (val) {
      val.textContent = `${_multiplier.toFixed(2)}× (−5%)`;
    }

    const stat = document.getElementById('smStatus');
    if (stat) {
      stat.textContent = `✅ Cashout ${_multiplier.toFixed(2)}× − pajak 5%`;
      stat.style.color = 'var(--win-green)';
    }

    const hud = document.getElementById('smHud');
    if (hud) hud.classList.add('win');

    setTimeout(() => {
      cancelAnimationFrame(_rafId);
      _callback(true, netPrize);   // kirim netPrize (sudah kena pajak)
    }, 1500);
  }

  function _triggerCrash() {
    _phase = 'crashed';
    clearInterval(_tickTimer);

    _disableAllBtns();
    const startBtn = document.getElementById('smStartBtn');
    if (startBtn) { startBtn.textContent = '💥'; }

    const val = document.getElementById('smMultiVal');
    if (val) { val.textContent = '💥 CRASH!'; val.className = 'sm-multi-value crash'; }

    const stat = document.getElementById('smStatus');
    if (stat) { stat.textContent = '💀 Pesawat meledak!'; stat.style.color = 'var(--lose-red)'; }

    const hud = document.getElementById('smHud');
    if (hud) hud.classList.add('lose');

    _drawExplosion();

    setTimeout(() => {
      cancelAnimationFrame(_rafId);
      _callback(false, _gacha.money);
    }, 1900);
  }

  function _disableAllBtns() {
    ['smCashoutBtn', 'smStartBtn', 'smCrashHeadBtn'].forEach(id => {
      const b = document.getElementById(id);
      if (b) { b.disabled = true; b.classList.remove('active'); }
    });
  }

  /* ────────────────────────────────────
     DRAW LOOP
  ──────────────────────────────────── */
  function _drawLoop() {
    if (_phase === 'done' || isGameDone()) return;
    _drawScene(true);
    _rafId = requestAnimationFrame(_drawLoop);
  }

  function _drawScene(moving) {
    const ctx = _ctx;
    const W   = _canvas._lw || 380;
    const H   = _canvas._lh || 240;

    ctx.clearRect(0, 0, W, H);

    /* BG gradient */
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0,   '#06060e');
    bg.addColorStop(0.5, '#09091a');
    bg.addColorStop(1,   '#0d0d22');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    /* Nebula glow */
    const neb = ctx.createRadialGradient(W * 0.7, H * 0.3, 0, W * 0.7, H * 0.3, W * 0.5);
    neb.addColorStop(0,   'rgba(80,40,160,0.07)');
    neb.addColorStop(0.5, 'rgba(40,20,100,0.04)');
    neb.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = neb;
    ctx.fillRect(0, 0, W, H);

    _drawStars(ctx, W, H);

    _updateAsteroids();
    _drawAsteroids(ctx);

    /* Update ship position when flying */
    if (moving && _phase === 'flying') {
      const t  = (_multiplier - 1) / 4.5;
      const tE = Math.min(t, 1);
      /* Smooth easing */
      const ease = tE < 0.5 ? 2 * tE * tE : -1 + (4 - 2 * tE) * tE;
      _shipX = W * (0.10 + ease * 0.60);
      _shipY = H * (0.75 - ease * 0.60);
    }

    /* Trail */
    if (_phase === 'flying') {
      _trail.push({ x: _shipX, y: _shipY });
      if (_trail.length > TRAIL_LEN) _trail.shift();
    }

    _drawTrail(ctx);
    _drawShip(ctx, _shipX, _shipY);
  }

  /* ── Stars ── */
  function _drawStars(ctx, W, H) {
    if (!_stars) {
      _stars = [];
      for (let i = 0; i < 100; i++) {
        _stars.push({
          x: Math.random() * 420,
          y: Math.random() * 260,
          r: 0.4 + Math.random() * 1.4,
          a: 0.15 + Math.random() * 0.7,
          tw: Math.random() * Math.PI * 2,   // twinkle phase
          ts: 0.01 + Math.random() * 0.03,   // twinkle speed
        });
      }
    }
    _stars.forEach(s => {
      s.tw += s.ts;
      const alpha = s.a * (0.6 + 0.4 * Math.sin(s.tw));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fill();
    });
  }

  /* ── Asteroids ── */
  function _drawAsteroids(ctx) {
    _asteroids.forEach(a => {
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.rot);

      const sides = 7;
      ctx.beginPath();
      for (let i = 0; i < sides; i++) {
        const ang = (i / sides) * Math.PI * 2;
        const jit = 0.65 + ((i * 41 + a.tone) % 12) / 35;
        const rx  = Math.cos(ang) * a.r * jit;
        const ry  = Math.sin(ang) * a.r * jit;
        i === 0 ? ctx.moveTo(rx, ry) : ctx.lineTo(rx, ry);
      }
      ctx.closePath();

      /* Gradient fill for depth */
      const ag = ctx.createRadialGradient(-a.r * 0.3, -a.r * 0.3, 0, 0, 0, a.r * 1.2);
      ag.addColorStop(0, `rgb(${a.tone + 20},${a.tone + 10},${a.tone})`);
      ag.addColorStop(1, `rgb(${a.tone - 20},${a.tone - 28},${a.tone - 35})`);
      ctx.fillStyle   = ag;
      ctx.strokeStyle = `rgba(200,185,150,0.2)`;
      ctx.lineWidth   = 0.8;
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });
  }

  /* ── Trail ── */
  function _drawTrail(ctx) {
    if (_trail.length < 2) return;
    for (let i = 1; i < _trail.length; i++) {
      const p = i / _trail.length;
      ctx.beginPath();
      ctx.moveTo(_trail[i - 1].x, _trail[i - 1].y);
      ctx.lineTo(_trail[i].x,     _trail[i].y);
      ctx.strokeStyle = `rgba(255,${140 + Math.floor(p * 60)},40,${p * 0.6})`;
      ctx.lineWidth   = p * 3.5;
      ctx.lineCap     = 'round';
      ctx.stroke();
    }
    /* Tip glow */
    if (_trail.length > 0) {
      const tip = _trail[_trail.length - 1];
      const g   = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, 14);
      g.addColorStop(0,   'rgba(255,160,40,0.55)');
      g.addColorStop(0.5, 'rgba(255,80,20,0.2)');
      g.addColorStop(1,   'rgba(255,40,0,0)');
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, 14, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
    }
  }

  /* ── Ship ── */
  function _drawShip(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    const baseTilt = -0.42;
    const flyTilt  = _phase === 'flying' ? -(_multiplier - 1) * 0.03 : 0;
    ctx.rotate(baseTilt + flyTilt);
    ctx.font         = '26px serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    /* Soft glow behind ship */
    const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, 18);
    sg.addColorStop(0,   'rgba(255,180,60,0.2)');
    sg.addColorStop(1,   'rgba(255,180,60,0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillText('🚀', 0, 0);
    ctx.restore();
  }

  /* ── Explosion ── */
  function _drawExplosion() {
    let frame  = 0;
    const maxF = 30;
    const sx   = _shipX;
    const sy   = _shipY;

    const loop = () => {
      if (!_ctx || frame > maxF) return;

      const ctx = _ctx;
      const p   = frame / maxF;
      const r   = frame * 6;
      const a   = 1 - p;

      /* Redraw background so explosion composites correctly */
      _drawScene(false);

      /* Outer ring */
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
      g.addColorStop(0,   `rgba(255,230,80,${a * 0.9})`);
      g.addColorStop(0.3, `rgba(255,100,20,${a * 0.7})`);
      g.addColorStop(0.7, `rgba(200,20,0,${a * 0.4})`);
      g.addColorStop(1,   `rgba(100,0,0,0)`);
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();

      /* Spark particles */
      for (let i = 0; i < 8; i++) {
        const ang  = (i / 8) * Math.PI * 2 + frame * 0.1;
        const dist = frame * 3.5;
        const px   = sx + Math.cos(ang) * dist;
        const py   = sy + Math.sin(ang) * dist;
        ctx.beginPath();
        ctx.arc(px, py, 2.5 * (1 - p), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,200,60,${a})`;
        ctx.fill();
      }

      /* Emoji */
      ctx.font         = '28px serif';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💥', sx, sy);

      frame++;
      requestAnimationFrame(loop);
    };
    loop();
  }

  /* ── Expose ── */
  return { init, _onStart, _onCashout, _onCrashHead };

})();
