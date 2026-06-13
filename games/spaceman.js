/* ══════════════════════════════════════
   SPACEMAN — Visual Replica
   Referensi: 4 screenshot asli
   Fase:
     ready   → astronot berdiri di bawah, bg ungu, bintang, UFO, planet kecil
     flying  → terbang diagonal, planet besar di atas, multiplier di dalam planet
                trail putus-putus oranye
     crashed → bg merah burst, astronot pegang balon planet, teks TERTABRAK
══════════════════════════════════════ */

const Spaceman = (() => {

  /* ── Config ── */
  const TICK_MS    = 100;
  const SPEED_BASE = 0.015;
  const SPEED_FAST = 0.025;
  const TRAIL_MAX  = 140;

  /* ── State ── */
  let _gacha       = null;
  let _callback    = null;
  let _multiplier  = 1.00;
  let _crashAt     = 2.00;
  let _autoCrashAt = 99;
  let _autoCrash   = false;
  let _cashedOut   = false;
  let _isWin       = false;
  let _phase       = 'ready';
  let _tickTimer   = null;
  let _rafId       = null;

  /* ── Anim vars ── */
  let _ax = 0, _ay = 0;
  let _tx = 0, _ty = 0;
  let _floatT    = 0;
  let _shineT    = 0;
  let _jetT      = 0;
  let _balloonT  = 0;
  let _crashT    = 0;
  let _trail     = [];
  let _stars     = [];
  let _bgRed     = 0;      // 0=ungu, 1=merah penuh
  let _planetS   = 0;      // planet scale 0→1
  let _tilt      = 0;
  let _ufoX      = 0;      // UFO posisi
  let _ufoT      = 0;

  /* ── Canvas ── */
  let _cv = null, _ctx = null;

  /* ════════════════════════════════
     INIT
  ════════════════════════════════ */
  function init(gacha, callback) {
    _gacha    = gacha;
    _callback = callback;
    _reset();
    _buildHTML();
  }

  function _reset() {
    _multiplier = 1.00;
    _phase      = 'ready';
    _cashedOut  = false;
    _autoCrash  = false;
    _isWin      = false;
    _trail      = [];
    _floatT     = 0; _shineT = 0; _jetT = 0;
    _balloonT   = 0; _crashT = 0;
    _bgRed      = 0;
    _planetS    = 0;
    _tilt       = 0;
    _ufoX       = 40;
    _ufoT       = 0;
    if (_tickTimer) clearInterval(_tickTimer);
    if (_rafId)     cancelAnimationFrame(_rafId);
    _tickTimer = _rafId = null;
  }

  function _calcCrashAt(win) {
    return win
      ? parseFloat((3.5 + Math.random() * 5.0).toFixed(2))
      : parseFloat((1.5 + Math.random() * 2.0).toFixed(2));
  }

  /* ════════════════════════════════
     HTML
  ════════════════════════════════ */
  function _buildHTML() {
    const old = document.getElementById('gameArea');
    if (old) old.remove();
    const anchor = document.getElementById('gachaInfoCard');

    const area = document.createElement('div');
    area.id = 'gameArea'; area.className = 'game-area slide-in';
    area.innerHTML = `
      <div class="spaceman-card" id="spacemanCard">
        <div class="slot-section-label">👨‍🚀 SPACEMAN MULTIPLIER</div>
        <div class="spaceman-canvas-wrap" id="smWrap">
          <canvas id="smCanvas"></canvas>
        </div>
        <div class="sm-btn-row" id="smBtnRow">
          <button class="sm-btn sm-start"   id="smStartBtn" onclick="Spaceman._start()">▶ MELUNCUR</button>
          <button class="sm-btn sm-cashout" id="smCashBtn"  onclick="Spaceman._cashout()" disabled>💰 CASHOUT</button>
        </div>
        <div class="spaceman-info-row">
          <div class="spaceman-info-item">
            <span class="spaceman-info-label">Taruhan</span>
            <span class="spaceman-info-val gold">Rp ${Number(_gacha.betAmount || _gacha.money/1000).toLocaleString('id-ID')}</span>
          </div>
          <div class="spaceman-info-item">
            <span class="spaceman-info-label">Status</span>
            <span class="spaceman-info-val" id="smStatus">Siap di landasan...</span>
          </div>
        </div>
      </div>`;

    if (anchor) anchor.replaceWith(area);
    else document.querySelector('.glass-card').insertAdjacentElement('afterend', area);

    _cv  = document.getElementById('smCanvas');
    _ctx = _cv.getContext('2d');
    _setupCanvas();
    _genStars();

    _isWin       = _gacha.result === 'win';
    _crashAt     = _calcCrashAt(_isWin);

    const W = _cv._lw, H = _cv._lh;
    _ax = W * 0.35; _ay = H * 0.78;
    _tx = _ax;      _ty = _ay;

    _rafId = requestAnimationFrame(_loop);
  }

  function _setupCanvas() {
    const w     = _cv.parentElement.clientWidth || 360;
    const ratio = window.devicePixelRatio || 1;
    const h     = 280;
    _cv.width        = w * ratio;
    _cv.height       = h * ratio;
    _cv.style.width  = w + 'px';
    _cv.style.height = h + 'px';
    _ctx.scale(ratio, ratio);
    _cv._lw = w; _cv._lh = h;
  }

  function _genStars() {
    const W = _cv._lw, H = _cv._lh;
    _stars = Array.from({ length: 60 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H * 0.75,
      r: 0.3 + Math.random() * 1.4,
      t: Math.random() * Math.PI * 2,
      spd: 0.01 + Math.random() * 0.025,
    }));
  }

  /* ════════════════════════════════
     CONTROLS
  ════════════════════════════════ */
  function _start() {
    if (_phase !== 'ready') return;
    _phase = 'flying';
    const sb = document.getElementById('smStartBtn');
    const cb = document.getElementById('smCashBtn');
    if (sb) { sb.disabled = true; sb.textContent = '🚀 Terbang!'; }
    if (cb)   cb.disabled = false;
    const st = document.getElementById('smStatus');
    if (st) st.textContent = 'Astronot sedang terbang!';
    _tickTimer = setInterval(_tick, TICK_MS);
  }

  function _cashout() {
    if (_phase !== 'flying' || _cashedOut) return;
    _isWin ? _doCashout() : _doCrash();
  }

  function _doCashout() {
    if (_cashedOut) return;
    _cashedOut = true;
    _phase     = 'done';
    clearInterval(_tickTimer);
    const cb = document.getElementById('smCashBtn');
    if (cb) cb.disabled = true;
    const bet   = _gacha.betAmount || (_gacha.money / 1000);
    const prize = Math.floor(bet * _multiplier * 1000 * 0.95);
    const st = document.getElementById('smStatus');
    if (st) { st.textContent = `✓ Cashout Rp ${prize.toLocaleString('id-ID')}!`; st.style.color = '#4caf82'; }
    setTimeout(() => _callback(true, prize), 2000);
  }

  function _doCrash() {
    if (_phase === 'crashed') return;
    _phase = 'crashed';
    clearInterval(_tickTimer);
    const cb = document.getElementById('smCashBtn');
    if (cb) cb.disabled = true;
    const st = document.getElementById('smStatus');
    if (st) { st.textContent = `Nabrak di ${_multiplier.toFixed(2)}×`; st.style.color = '#cf5c5c'; }
    setTimeout(() => _callback(false, _gacha.money), 3200);
  }

  /* ════════════════════════════════
     TICK
  ════════════════════════════════ */
  function _tick() {
    if (_phase !== 'flying') return;
    const inc   = _multiplier >= 2.0 ? SPEED_FAST : SPEED_BASE;
    _multiplier = parseFloat((_multiplier + inc).toFixed(3));
    if (_multiplier >= _crashAt) _doCrash();
  }

  /* ════════════════════════════════
     RENDER LOOP
  ════════════════════════════════ */
  function _loop() {
    _draw();
    _rafId = requestAnimationFrame(_loop);
  }

  function _draw() {
    if (!_ctx) return;
    const ctx = _ctx, W = _cv._lw, H = _cv._lh;

    _floatT  += 0.028;
    _shineT  += 0.016;
    _jetT    += 0.20;
    _balloonT+= 0.032;
    _ufoT    += 0.012;

    /* Lerp bg merah */
    const targetRed = _phase === 'crashed' ? 1 : 0;
    _bgRed += (targetRed - _bgRed) * 0.035;
    if (_phase === 'crashed') _crashT += 0.03;

    /* ── Background ── */
    _drawBg(ctx, W, H);

    /* ── Stars ── */
    _drawStars(ctx, W, H);

    /* ── Idle: UFO + deco ── */
    if (_phase === 'ready') {
      _drawIdleDeco(ctx, W, H);
    }

    /* ── Trail ── */
    if (_trail.length > 1 && (_phase === 'flying' || _phase === 'done')) {
      _drawTrail(ctx);
    }

    /* ── Posisi astronot ── */
    _updatePos(W, H);

    /* ── Planet terbang ── */
    if (_phase === 'flying' || _phase === 'done') {
      const ts = Math.min(1, (_multiplier - 1) / 2);
      _planetS += (ts - _planetS) * 0.045;
      _drawFlyingPlanet(ctx, W, H);
    }

    /* ── Crash overlay + balon ── */
    if (_phase === 'crashed') {
      _drawCrashOverlay(ctx, W, H);
      _drawBalloons(ctx, W, H);
    }

    /* ── Astronot ── */
    _drawAstronaut(ctx, W, H);

    /* ── Crash text TERTABRAK ── */
    if (_phase === 'crashed') {
      _drawCrashText(ctx, W, H);
    }
  }

  /* ─────────────────────────────────
     BACKGROUND
  ───────────────────────────────── */
  function _drawBg(ctx, W, H) {
    /* Lerp ungu → merah */
    const r0 = Math.round(30  + _bgRed * 160);
    const g0 = Math.round(8   - _bgRed * 8);
    const b0 = Math.round(80  - _bgRed * 80);
    const r1 = Math.round(55  + _bgRed * 150);
    const g1 = Math.round(10  - _bgRed * 10);
    const b1 = Math.round(120 - _bgRed * 120);

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0,   `rgb(${r0},${g0},${b0})`);
    bg.addColorStop(0.5, `rgb(${r1},${g1},${b1})`);
    bg.addColorStop(1,   `rgb(${Math.round(r0*0.7)},${g0},${Math.round(b0*0.8)})`);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    /* Awan ungu (tampak di fase ready & flying) */
    if (_bgRed < 0.5) {
      const alpha = (1 - _bgRed * 2) * 0.25;
      _drawCloud(ctx, W * 0.15, H * 0.62, 90, 22, alpha);
      _drawCloud(ctx, W * 0.78, H * 0.55, 70, 18, alpha * 0.8);
      _drawCloud(ctx, W * 0.5,  H * 0.70, 110, 20, alpha * 0.6);
    }

    /* Burst rays saat crash */
    if (_bgRed > 0.1) {
      const cx = W * 0.5, cy = H * 0.42;
      const alpha = _bgRed * 0.12;
      for (let i = 0; i < 18; i++) {
        const a   = (i / 18) * Math.PI * 2 + _shineT * 0.2;
        const len = W * 0.85;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a - 0.055) * 18, cy + Math.sin(a - 0.055) * 18);
        ctx.lineTo(cx + Math.cos(a - 0.055) * len, cy + Math.sin(a - 0.055) * len);
        ctx.lineTo(cx + Math.cos(a + 0.055) * len, cy + Math.sin(a + 0.055) * len);
        ctx.lineTo(cx + Math.cos(a + 0.055) * 18, cy + Math.sin(a + 0.055) * 18);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fill();
      }
    }
  }

  function _drawCloud(ctx, cx, cy, w, h, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = 'rgba(160,80,200,1)';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.ellipse(cx + i * w * 0.28, cy + Math.abs(i) * h * 0.15, w * (0.55 - Math.abs(i)*0.1), h, 0, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }

  /* ─────────────────────────────────
     STARS
  ───────────────────────────────── */
  function _drawStars(ctx, W, H) {
    _stars.forEach(s => {
      s.t += s.spd;
      const a = 0.35 + Math.sin(s.t) * 0.35;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.fill();
    });
    /* Satu titik biru besar (planet kecil, gambar 1) */
    const px = _cv._lw * 0.62, py = _cv._lh * 0.10;
    const pg = ctx.createRadialGradient(px-2, py-2, 1, px, py, 7);
    pg.addColorStop(0, '#aaddff'); pg.addColorStop(1, '#2288cc');
    ctx.beginPath(); ctx.arc(px, py, 6, 0, Math.PI*2);
    ctx.fillStyle = pg; ctx.fill();
  }

  /* ─────────────────────────────────
     IDLE DECO: UFO + planet kecil
  ───────────────────────────────── */
  function _drawIdleDeco(ctx, W, H) {
    /* UFO bergerak pelan dari kiri */
    _ufoX = W * 0.08 + Math.sin(_ufoT) * W * 0.04;
    const uy = H * 0.12 + Math.sin(_ufoT * 1.3) * 5;
    _drawUFO(ctx, _ufoX, uy);

    /* Planet gelap kiri (gambar 1, kiri tengah) */
    const dpx = W * 0.06, dpy = H * 0.42;
    const dg = ctx.createRadialGradient(dpx-3, dpy-3, 1, dpx, dpy, 14);
    dg.addColorStop(0, '#555'); dg.addColorStop(1, '#111');
    ctx.beginPath(); ctx.arc(dpx, dpy, 14, 0, Math.PI*2);
    ctx.fillStyle = dg; ctx.fill();
  }

  function _drawUFO(ctx, x, y) {
    ctx.save(); ctx.translate(x, y);
    /* Body UFO: elips gelap */
    const bg = ctx.createRadialGradient(0, -3, 1, 0, 0, 16);
    bg.addColorStop(0, '#888'); bg.addColorStop(1, '#222');
    ctx.beginPath(); ctx.ellipse(0, 0, 16, 6, 0, 0, Math.PI*2);
    ctx.fillStyle = bg; ctx.fill();
    /* Kubah atas */
    const dg = ctx.createRadialGradient(-3, -7, 1, 0, -5, 9);
    dg.addColorStop(0, '#aaddff'); dg.addColorStop(1, '#225588');
    ctx.beginPath(); ctx.ellipse(0, -4, 9, 6, 0, 0, Math.PI*2);
    ctx.fillStyle = dg; ctx.fill();
    /* Lampu kecil */
    [-8, 0, 8].forEach((lx, i) => {
      ctx.beginPath(); ctx.arc(lx, 2, 2, 0, Math.PI*2);
      ctx.fillStyle = ['#ffdd00','#ff6600','#aaddff'][i]; ctx.fill();
    });
    ctx.restore();
  }

  /* ─────────────────────────────────
     TRAIL
  ───────────────────────────────── */
  function _drawTrail(ctx) {
    ctx.save();
    ctx.setLineDash([8, 7]);
    ctx.lineDashOffset = -(_shineT * 12 % 15);
    ctx.beginPath();
    ctx.moveTo(_trail[0].x, _trail[0].y);
    for (let i = 1; i < _trail.length - 1; i++) {
      const mx = (_trail[i].x + _trail[i+1].x) / 2;
      const my = (_trail[i].y + _trail[i+1].y) / 2;
      ctx.quadraticCurveTo(_trail[i].x, _trail[i].y, mx, my);
    }
    const last = _trail[_trail.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.strokeStyle = '#f5a623';
    ctx.lineWidth   = 2.8;
    ctx.shadowBlur  = 8;
    ctx.shadowColor = '#f07000';
    ctx.stroke();
    ctx.restore();
  }

  /* ─────────────────────────────────
     UPDATE POSISI
  ───────────────────────────────── */
  function _updatePos(W, H) {
    if (_phase === 'ready') {
      _tx   = W * 0.35;
      _ty   = H * 0.76 + Math.sin(_floatT) * 3;
      _ax   = _tx; _ay = _ty;
      _tilt = 0;
    } else if (_phase === 'flying') {
      const prog = Math.min(1, (_multiplier - 1.0) / 5.0);
      _tx   = W * 0.18 + prog * W * 0.60;
      _ty   = H * 0.82 - Math.pow(prog, 1.3) * H * 0.62;
      _tilt = -0.42 - prog * 0.18;
      _ax  += (_tx - _ax) * 0.05;
      _ay  += (_ty - _ay) * 0.05;
      _trail.push({ x: _ax, y: _ay });
      if (_trail.length > TRAIL_MAX) _trail.shift();
    } else if (_phase === 'crashed') {
      _tx = W * 0.5;
      _ty = H * 0.63 + Math.sin(_balloonT * 0.9) * 4;
      _ax += (_tx - _ax) * 0.04;
      _ay += (_ty - _ay) * 0.04;
      _tilt = 0;
    }
  }

  /* ─────────────────────────────────
     PLANET TERBANG (flying phase)
     - Planet biru/ungu besar di atas
     - Multiplier di dalam/atas planet
     - Orbit ring berputar
     - Panah merah berputar di orbit (seperti gambar 2 & 4)
  ───────────────────────────────── */
  function _drawFlyingPlanet(ctx, W, H) {
    /* Planet muncul di atas astronot */
    const cx = _ax + 15;
    const cy = _ay - 80 - _planetS * 20;
    const pr = 44 * _planetS;
    if (pr < 3) return;

    /* Tentukan warna planet berdasarkan multiplier */
    let pC0, pC1, glowC;
    if (_multiplier >= 5) {
      pC0 = '#c060ff'; pC1 = '#6010aa'; glowC = 'rgba(180,80,255,0.25)';
    } else if (_multiplier >= 2) {
      pC0 = '#8855ee'; pC1 = '#4420aa'; glowC = 'rgba(140,80,255,0.2)';
    } else {
      pC0 = '#55aaee'; pC1 = '#1155aa'; glowC = 'rgba(80,160,255,0.2)';
    }

    /* Glow luar */
    const glow = ctx.createRadialGradient(cx, cy, pr * 0.4, cx, cy, pr * 2.2);
    glow.addColorStop(0, glowC); glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.arc(cx, cy, pr * 2.2, 0, Math.PI*2);
    ctx.fillStyle = glow; ctx.fill();

    /* Body planet */
    const pg = ctx.createRadialGradient(cx - pr*0.32, cy - pr*0.32, pr*0.05, cx, cy, pr);
    pg.addColorStop(0,   _lighten(pC0, 0.4));
    pg.addColorStop(0.45, pC0);
    pg.addColorStop(0.8,  pC1);
    pg.addColorStop(1,    '#050210');
    ctx.beginPath(); ctx.arc(cx, cy, pr, 0, Math.PI*2);
    ctx.fillStyle = pg; ctx.fill();

    /* Crater */
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, pr, 0, Math.PI*2); ctx.clip();
    [[-.22,.12,.11],[.28,-.18,.08],[.06,.30,.07]].forEach(([dx,dy,r]) => {
      ctx.beginPath(); ctx.arc(cx+dx*pr, cy+dy*pr, r*pr, 0, Math.PI*2);
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fill();
    });
    ctx.restore();

    /* Specular */
    ctx.beginPath();
    ctx.arc(cx - pr*0.3, cy - pr*0.3, pr*0.22, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(255,255,255,0.38)'; ctx.fill();

    /* Orbit ring */
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(_shineT * 0.5); ctx.scale(1, 0.28);
    ctx.beginPath(); ctx.arc(0, 0, pr * 1.5, 0, Math.PI*2);
    ctx.strokeStyle = `rgba(${pC0 === '#55aaee' ? '120,200,255' : '180,120,255'},0.55)`;
    ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();

    /* Panah merah berputar di orbit (ciri khas gambar asli) */
    const arrowCount = 8;
    for (let i = 0; i < arrowCount; i++) {
      const a   = (i / arrowCount) * Math.PI * 2 + _shineT * 1.2;
      const orR = pr * 1.55;
      const px2 = cx + Math.cos(a) * orR;
      const py2 = cy + Math.sin(a) * orR * 0.3;
      ctx.save();
      ctx.translate(px2, py2);
      ctx.rotate(a + Math.PI * 0.5);
      ctx.scale(0.85, 0.85);
      /* Panah kecil merah */
      ctx.beginPath();
      ctx.moveTo(0, -5); ctx.lineTo(4, 2); ctx.lineTo(-4, 2);
      ctx.closePath();
      ctx.fillStyle = '#dd2222'; ctx.fill();
      ctx.restore();
    }

    /* Multiplier di dalam planet */
    const fs = Math.max(14, Math.round(16 * _planetS + 4));
    ctx.save();
    ctx.font      = `bold ${fs}px Syne, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur  = 14;
    ctx.shadowColor = '#f07000';
    /* Outline hitam supaya terbaca di atas planet gelap */
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth   = 3;
    ctx.strokeText(_multiplier.toFixed(2) + '×', cx, cy + 2);
    /* Fill kuning emas */
    ctx.fillStyle   = '#f5d020';
    ctx.fillText(_multiplier.toFixed(2) + '×', cx, cy + 2);
    ctx.restore();

    ctx.textBaseline = 'alphabetic';
    ctx.textAlign    = 'start';
  }

  /* ─────────────────────────────────
     CRASH OVERLAY
  ───────────────────────────────── */
  function _drawCrashOverlay(ctx, W, H) {
    /* Vignette merah */
    const vg = ctx.createRadialGradient(W/2, H/2, H*0.18, W/2, H/2, H*0.9);
    vg.addColorStop(0, 'rgba(180,0,0,0)');
    vg.addColorStop(1, `rgba(180,0,0,${Math.min(0.6, _crashT * 0.35)})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }

  /* ─────────────────────────────────
     BALON PLANET (crash state)
     Tiga planet kecil seperti balon di atas astronot
  ───────────────────────────────── */
  function _drawBalloons(ctx, W, H) {
    const balloons = [
      { ox: -32, oy: -85,  r: 19, c0: '#7b68ee', c1: '#3322aa', ring: false },
      { ox:   2, oy:-112,  r: 25, c0: '#c8940a', c1: '#7a5a00', ring: true  },
      { ox:  34, oy: -82,  r: 17, c0: '#5588dd', c1: '#224488', ring: false },
    ];

    const bx = _ax, by = _ay;

    /* Tali */
    balloons.forEach(b => {
      const sw = Math.sin(_balloonT + b.ox * 0.08) * 5;
      ctx.beginPath();
      ctx.moveTo(bx, by - 20);
      ctx.quadraticCurveTo(bx + b.ox * 0.3 + sw, by + b.oy * 0.45, bx + b.ox, by + b.oy + b.r);
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1.2; ctx.stroke();
    });

    /* Planet-balon */
    balloons.forEach(b => {
      const sw = Math.sin(_balloonT * 0.85 + b.ox * 0.08) * 3;
      const sh = Math.cos(_balloonT * 0.7  + b.ox * 0.06) * 2;
      const cx = bx + b.ox + sw;
      const cy = by + b.oy + sh;

      const pg = ctx.createRadialGradient(cx-b.r*.3, cy-b.r*.3, b.r*.05, cx, cy, b.r);
      pg.addColorStop(0, _lighten(b.c0, 0.5));
      pg.addColorStop(0.5, b.c0);
      pg.addColorStop(1, b.c1);
      ctx.beginPath(); ctx.arc(cx, cy, b.r, 0, Math.PI*2);
      ctx.fillStyle = pg; ctx.fill();

      /* Crater kecil */
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, b.r, 0, Math.PI*2); ctx.clip();
      ctx.beginPath(); ctx.arc(cx - b.r*.2, cy + b.r*.15, b.r*.18, 0, Math.PI*2);
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fill();
      ctx.restore();

      /* Ring untuk planet tengah */
      if (b.ring) {
        ctx.save(); ctx.translate(cx, cy); ctx.scale(1, 0.28);
        ctx.beginPath(); ctx.arc(0, 0, b.r * 1.6, 0, Math.PI*2);
        ctx.strokeStyle = 'rgba(245,200,66,0.65)'; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.restore();
      }

      /* Specular */
      ctx.beginPath();
      ctx.arc(cx - b.r*.28, cy - b.r*.28, b.r*.26, 0, Math.PI*2);
      ctx.fillStyle = 'rgba(255,255,255,0.48)'; ctx.fill();
    });
  }

  /* ─────────────────────────────────
     CRASH TEXT
  ───────────────────────────────── */
  function _drawCrashText(ctx, W, H) {
    const alpha = Math.min(1, _crashT * 1.5);
    if (alpha < 0.05) return;

    ctx.save();
    ctx.globalAlpha  = alpha;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    /* TERTABRAK */
    ctx.font        = `bold 22px Syne, sans-serif`;
    ctx.fillStyle   = '#ffffff';
    ctx.shadowBlur  = 10;
    ctx.shadowColor = 'rgba(255,80,80,0.8)';
    ctx.fillText('TERTABRAK', W * 0.5, H * 0.22);

    /* Nilai multiplier merah besar */
    ctx.font        = `bold 38px Syne, sans-serif`;
    ctx.fillStyle   = '#ff4466';
    ctx.shadowColor = 'rgba(255,0,0,0.7)';
    ctx.shadowBlur  = 20;
    ctx.fillText(_multiplier.toFixed(2) + '×', W * 0.5, H * 0.34);

    ctx.restore();
    ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
  }

  /* ─────────────────────────────────
     ASTRONOT
  ───────────────────────────────── */
  function _drawAstronaut(ctx, W, H) {
    ctx.save();
    ctx.translate(_ax, _ay);

    if (_phase === 'flying') {
      ctx.rotate(_tilt);

      /* Jetpack flame */
      const fl = 16 + Math.sin(_jetT) * 6;
      const fg = ctx.createLinearGradient(-9, 0, -9 - fl, 5);
      fg.addColorStop(0,   '#ffee00');
      fg.addColorStop(0.45,'#ff6600');
      fg.addColorStop(1,   'rgba(255,60,0,0)');
      ctx.beginPath();
      ctx.moveTo(-9, 2); ctx.lineTo(-9 - fl, 6 + Math.sin(_jetT) * 3); ctx.lineTo(-9, 11);
      ctx.fillStyle = fg; ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-9, 4); ctx.lineTo(-9 - fl * 0.55, 7 + Math.sin(_jetT+1)*2); ctx.lineTo(-9, 10);
      ctx.fillStyle = 'rgba(255,150,0,0.65)'; ctx.fill();
    }

    if (_phase === 'crashed') {
      /* Tangan kiri angkat pegang tali balon */
      ctx.strokeStyle = '#ddd'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-4, -4); ctx.lineTo(-5, -20); ctx.stroke();
    }

    const sc = _phase === 'flying' ? 0.88 : 1.05;
    ctx.scale(sc, sc);
    _drawBody(ctx);
    ctx.restore();
  }

  function _drawBody(ctx) {
    /* Kaki */
    ctx.fillStyle = '#3344bb';
    ctx.beginPath(); ctx.roundRect(-7, 14, 5, 9, 2); ctx.fill();
    ctx.beginPath(); ctx.roundRect(2, 14, 5, 9, 2); ctx.fill();
    /* Sepatu putih */
    ctx.fillStyle = '#ddddee';
    ctx.beginPath(); ctx.roundRect(-8, 21, 6, 4, 2); ctx.fill();
    ctx.beginPath(); ctx.roundRect(2, 21, 6, 4, 2); ctx.fill();

    /* Cape merah */
    ctx.fillStyle = '#cc2200';
    ctx.beginPath();
    ctx.moveTo(-2, 4);
    ctx.quadraticCurveTo(-18, 9, -16, 20);
    ctx.quadraticCurveTo(-12, 15, -2, 14);
    ctx.closePath(); ctx.fill();

    /* Body putih */
    const bg = ctx.createLinearGradient(-8, 0, 8, 14);
    bg.addColorStop(0, '#f4f4f6'); bg.addColorStop(1, '#c8c8d2');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.roundRect(-8, 2, 16, 14, 4); ctx.fill();

    /* Badge biru */
    ctx.fillStyle = '#2255cc';
    ctx.beginPath(); ctx.roundRect(-4, 7, 8, 5, 2); ctx.fill();
    ctx.fillStyle = '#55ccff';
    ctx.beginPath(); ctx.arc(0, 9.5, 1.5, 0, Math.PI*2); ctx.fill();

    /* Tangan */
    ctx.fillStyle = '#e2e2e8';
    ctx.beginPath(); ctx.roundRect(7, 5, 5, 4, 2); ctx.fill();
    ctx.beginPath(); ctx.roundRect(-12, 5, 5, 4, 2); ctx.fill();

    /* Helm putih */
    const hg = ctx.createRadialGradient(-3, -10, 2, 0, -8, 13);
    hg.addColorStop(0, '#ffffff'); hg.addColorStop(0.6, '#eaeaee'); hg.addColorStop(1, '#c2c2cc');
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(0, -8, 13, 0, Math.PI*2); ctx.fill();
    /* Trim emas */
    ctx.strokeStyle = '#d4af5a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, -8, 13, 0, Math.PI*2); ctx.stroke();

    /* Visor biru */
    const vg = ctx.createRadialGradient(-2, -10, 1, 1, -8, 8.5);
    vg.addColorStop(0,   '#88ddff');
    vg.addColorStop(0.4, '#2288cc');
    vg.addColorStop(1,   '#003d99');
    ctx.fillStyle = vg;
    ctx.beginPath(); ctx.ellipse(0, -8, 8, 7, 0, 0, Math.PI*2); ctx.fill();

    /* Refleksi visor */
    ctx.fillStyle = 'rgba(255,255,255,0.52)';
    ctx.beginPath(); ctx.ellipse(-3, -12, 2.5, 1.7, -0.4, 0, Math.PI*2); ctx.fill();

    /* Mata putih */
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.roundRect(-5.5, -11, 4, 4, 1.5); ctx.fill();
    ctx.beginPath(); ctx.roundRect(1.5,  -11, 4, 4, 1.5); ctx.fill();
    /* Pupil biru */
    ctx.fillStyle = '#44aaff';
    ctx.beginPath(); ctx.arc(-3.5, -9, 1.3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(3.5,  -9, 1.3, 0, Math.PI*2); ctx.fill();

    /* Antena */
    ctx.strokeStyle = '#d4af5a'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, -21); ctx.lineTo(0, -17); ctx.stroke();
    ctx.fillStyle = '#d4af5a';
    ctx.beginPath(); ctx.arc(0, -22.5, 2.2, 0, Math.PI*2); ctx.fill();
  }

  /* ─── Helper: lighten hex ─── */
  function _lighten(hex, t) {
    const h = parseInt(hex.slice(1), 16);
    const r = (h>>16)&0xff, g = (h>>8)&0xff, b = h&0xff;
    return `rgb(${Math.round(r+(255-r)*t)},${Math.round(g+(255-g)*t)},${Math.round(b+(255-b)*t)})`;
  }

  /* ════════════════════════════════
     EXPOSE
  ════════════════════════════════ */
  return { init, _start, _cashout };
})();
