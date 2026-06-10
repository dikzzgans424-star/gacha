/* ══════════════════════════════════════
   SPACEMAN — 90% Replica High-Fidelity Animation
   games/spaceman.js
   ══════════════════════════════════════ */

const Spaceman = (() => {

  /* ── Config ── */
  const TICK_MS        = 33;
  const SPEED_BASE     = 0.008;
  const SPEED_FAST     = 0.018;
  const TRAIL_MAX_LEN  = 60;

  /* ── State ── */
  let _gacha       = null;
  let _callback    = null;
  let _multiplier  = 1.00;
  let _crashAt     = 1.00;
  let _autoCrashAt = 99;
  let _phase       = 'idle'; // idle, ready, flying, done, crashed
  let _tickTimer   = null;
  let _rafId       = null;
  let _cashedOut   = false;
  let _autoCrash   = false;
  let _crashHead   = false;
  let _isWin       = false;

  /* ── Canvas ── */
  let _canvas = null;
  let _ctx    = null;

  /* ── Visual Animation Variables ── */
  let _spacemanX = 0, _spacemanY = 0;
  let _targetX   = 0, _targetY   = 0;
  let _floatingT = 0;
  let _graphPoints = []; // Menyimpan koordinat lintasan terbang
  let _stars = [];
  let _planets = [];
  let _bgScrollX = 0;
  let _explosionParticles = [];
  let _crashFallY = 0;
  let _crashRot = 0;

  /* ────────────────────────────────────
     INIT & RESET
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
    _graphPoints = [];
    _explosionParticles = [];
    _crashFallY  = 0;
    _crashRot    = 0;
    _bgScrollX   = 0;
    if (_tickTimer) clearInterval(_tickTimer);
    if (_rafId)     cancelAnimationFrame(_rafId);
    _tickTimer = _rafId = null;
  }

  function _calcCrashAt(isWin) {
    if (isWin) {
      return parseFloat((2.2 + Math.random() * 4.0).toFixed(2));
    } else {
      return parseFloat((1.2 + Math.random() * 2.1).toFixed(2));
    }
  }

  /* ────────────────────────────────────
     RENDER HTML STRUCTURE
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
        <div class="slot-section-label" style="color: #a2a0a5; font-weight:800;">👨‍🚀 SPACEMAN MULTIPLIER</div>

        <div class="spaceman-canvas-wrap" style="background: #050510; border: 2px solid #1f1f3a; border-radius: 16px; box-shadow: inset 0 0 30px rgba(0,0,0,0.8);">
          <canvas id="spacemanCanvas"></canvas>
          <div class="spaceman-multiplier-hud" id="smHud" style="top: 20px;">
            <div class="sm-multi-value" id="smMultiVal" style="font-size: 42px; font-weight: 800; color: #39ff14; text-shadow: 0 0 15px rgba(57,255,20,0.6);">1.00×</div>
          </div>
        </div>

        <div class="sm-btn-row" id="smBtnRow">
          <button class="sm-btn sm-btn-cashout" id="smCashoutBtn" onclick="Spaceman._onCashout()" disabled>
            💰 CASHOUT
          </button>
          <button class="sm-btn sm-btn-start" id="smStartBtn" onclick="Spaceman._onStart()">
            ▶ MELUNCUR
          </button>
          <button class="sm-btn sm-btn-crashhead" id="smCrashHeadBtn" onclick="Spaceman._onCrashHead()" disabled>
            🚀 TERBANG TINGGI
          </button>
        </div>

        <div class="spaceman-info-row">
          <div class="spaceman-info-item">
            <span class="spaceman-info-label">Taruhan Anda</span>
            <span class="spaceman-info-val gold">
              Rp ${Number(_gacha.betAmount || _gacha.money/1000).toLocaleString('id-ID')}
            </span>
          </div>
          <div class="spaceman-info-item">
            <span class="spaceman-info-label">Status Penerbangan</span>
            <span class="spaceman-info-val" id="smStatus" style="color:#d4af5a;">Siap di landasan...</span>
          </div>
        </div>
      </div>
    `;

    if (infoCard) infoCard.replaceWith(area);
    else document.querySelector('.glass-card').insertAdjacentElement('afterend', area);

    _canvas = document.getElementById('spacemanCanvas');
    _ctx    = _canvas.getContext('2d');
    
    _resizeCanvas();
    _initBackgroundObjects();

    _isWin   = _gacha.result === 'win';
    _crashAt = _calcCrashAt(_isWin);

    if (_isWin) {
      const range = _crashAt - 1.0;
      _autoCrashAt = parseFloat((1.0 + range * (0.55 + Math.random() * 0.25)).toFixed(2));
      _autoCrash   = true;
    }

    // Posisi awal landasan (Kiri Bawah)
    _spacemanX = _canvas._lw * 0.15;
    _spacemanY = _canvas._lh * 0.80;

    _phase = 'ready';
    _rafId = requestAnimationFrame(_mainLoop);
  }

  function _resizeCanvas() {
    const wrap = _canvas.parentElement;
    const w = wrap.clientWidth || 380;
    const ratio = window.devicePixelRatio || 1;
    _canvas.width = w * ratio;
    _canvas.height = 240 * ratio;
    _canvas.style.width = w + 'px';
    _canvas.style.height = '240px';
    _ctx.scale(ratio, ratio);
    _canvas._lw = w;
    _canvas._lh = 240;
  }

  /* ────────────────────────────────────
     ASSET & BG INITIALIZATION (Parallax)
  ──────────────────────────────────── */
  function _initBackgroundObjects() {
    _stars = [];
    for (let i = 0; i < 60; i++) {
      _stars.push({
        x: Math.random() * 500,
        y: Math.random() * 240,
        size: 0.5 + Math.random() * 1.5,
        speed: 0.2 + Math.random() * 0.5
      });
    }
    _planets = [
      { x: 400, y: 50, r: 18, color: '#e27d60', speed: 0.1 },
      { x: 250, y: 120, r: 8, color: '#41b3a3', speed: 0.05 }
    ];
  }

  /* ────────────────────────────────────
     CONTROLS
  ──────────────────────────────────── */
  function _onStart() {
    if (_phase !== 'ready') return;

    const startBtn     = document.getElementById('smStartBtn');
    const cashoutBtn   = document.getElementById('smCashoutBtn');
    const crashHeadBtn = document.getElementById('smCrashHeadBtn');
    if (startBtn)     { startBtn.disabled = true; startBtn.classList.add('used'); startBtn.textContent = "TERBANG"; }
    if (cashoutBtn)   { cashoutBtn.disabled = false; cashoutBtn.classList.add('active'); }
    if (crashHeadBtn) { crashHeadBtn.disabled = false; crashHeadBtn.classList.add('active'); }

    const stat = document.getElementById('smStatus');
    if (stat) stat.textContent = 'Astronot sedang terbang tinggi!';

    _phase     = 'flying';
    _tickTimer = setInterval(_tick, TICK_MS);
  }

  function _onCashout() {
    if (_phase !== 'flying' || _cashedOut) return;
    if (_isWin) _triggerCashout();
    else        _triggerCrash(); 
  }

  function _onCrashHead() {
    if (_phase !== 'flying' || _cashedOut) return;
    _crashHead = true;
    _autoCrash = false;

    const crashHeadBtn = document.getElementById('smCrashHeadBtn');
    const cashoutBtn   = document.getElementById('smCashoutBtn');
    if (crashHeadBtn) { crashHeadBtn.disabled = true; crashHeadBtn.classList.remove('active'); }
    if (cashoutBtn)   { cashoutBtn.disabled   = true; cashoutBtn.classList.remove('active'); }

    _crashAt = _multiplier + 0.08; 
  }

  /* ────────────────────────────────────
     GAME ENGINE TICK
  ──────────────────────────────────── */
  function _tick() {
    if (_phase !== 'flying') return;

    const inc   = _multiplier >= 2.0 ? SPEED_FAST : SPEED_BASE;
    _multiplier = parseFloat((_multiplier + inc).toFixed(3));

    const val = document.getElementById('smMultiVal');
    if (val) {
      val.textContent = _multiplier.toFixed(2) + '×';
      if (_multiplier >= 3.0) {
        val.style.color = '#ff3333';
        val.style.textShadow = '0 0 20px rgba(255,51,51,0.8)';
      } else if (_multiplier >= 2.0) {
        val.style.color = '#ffcc00';
        val.style.textShadow = '0 0 15px rgba(255,204,0,0.7)';
      }
    }

    if (_autoCrash && !_crashHead && _multiplier >= _autoCrashAt && !_cashedOut) {
      _triggerCashout();
      return;
    }

    if (_multiplier >= _crashAt) {
      _triggerCrash();
    }
  }

  function _triggerCashout() {
    if (_cashedOut) return;
    _cashedOut = true;
    _phase     = 'done';
    clearInterval(_tickTimer);

    document.getElementById('smCashoutBtn').disabled = true;
    document.getElementById('smCrashHeadBtn').disabled = true;

    const betAmount = _gacha.betAmount || (_gacha.money / 1000);
    const netPrize   = Math.floor((betAmount * _multiplier * 1000) * 0.95);

    const stat = document.getElementById('smStatus');
    if (stat) { stat.textContent = `✓ Berhasil Ambil Rp ${netPrize.toLocaleString('id-ID')}!`; stat.style.color = '#4caf82'; }

    setTimeout(() => { _callback(true, netPrize); }, 2000);
  }

  function _triggerCrash() {
    _phase = 'crashed';
    clearInterval(_tickTimer);

    document.getElementById('smCashoutBtn').disabled = true;
    document.getElementById('smCrashHeadBtn').disabled = true;

    const val = document.getElementById('smMultiVal');
    if (val) { val.textContent = '💥 CRASHED'; val.style.color = '#cf5c5c'; }

    const stat = document.getElementById('smStatus');
    if (stat) { stat.textContent = `Astronot menabrak asteroid di ${_multiplier.toFixed(2)}×`; stat.style.color = '#cf5c5c'; }

    // Spawn partikel ledakan cosmic
    for (let i = 0; i < 25; i++) {
      _explosionParticles.push({
        x: _spacemanX,
        y: _spacemanY,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        r: 2 + Math.random() * 4,
        alpha: 1
      });
    }

    setTimeout(() => { _callback(false, _gacha.money); }, 2500);
  }

  /* ────────────────────────────────────
     CORE RENDER LOOP (ANIMATION ENGINE)
  ──────────────────────────────────── */
  function _mainLoop() {
    _drawScene();
    _rafId = requestAnimationFrame(_mainLoop);
  }

  function _drawScene() {
    if (!_ctx) return;
    const ctx = _ctx;
    const W   = _canvas._lw;
    const H   = _canvas._lh;

    ctx.clearRect(0, 0, W, H);

    // 1. Draw Space Background Gradient
    let bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#04040d');
    bg.addColorStop(0.6, '#08081e');
    bg.addColorStop(1, '#0f0c24');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // 2. Parallax Background Scrolling Effect
    let scrollSpeed = _phase === 'flying' ? Math.min(2, _multiplier) : 0.2;
    _bgScrollX -= scrollSpeed;

    // Draw Stars
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    _stars.forEach(s => {
      let currentX = (s.x + _bgScrollX * s.speed) % (W + 50);
      if (currentX < -10) currentX += (W + 50);
      ctx.beginPath();
      ctx.arc(currentX, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Background Planets
    _planets.forEach(p => {
      let cx = (p.x + _bgScrollX * p.speed) % (W + 100);
      if (cx < -50) cx += (W + 100);
      ctx.beginPath();
      ctx.arc(cx, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = p.color;
      ctx.fill();
      ctx.shadowBlur = 0; // reset shadow
    });

    // 3. Hitung Posisi Karakter & Titik Grafik
    _floatingT += 0.08;
    let floatOffset = Math.sin(_floatingT) * 4;

    if (_phase === 'ready' || _phase === 'idle') {
      _spacemanX = W * 0.15;
      _spacemanY = H * 0.75 + floatOffset;
    } 
    else if (_phase === 'flying') {
      // Grafik melengkung naik eksponensial khas Spaceman asli
      let progress = Math.min(1, (_multiplier - 1.0) / 4.0); 
      _targetX = W * 0.15 + (progress * W * 0.65);
      _targetY = H * 0.80 - (Math.pow(progress, 1.5) * H * 0.55);

      // Interpolasi halus (smooth easing tracking)
      _spacemanX += (_targetX - _spacemanX) * 0.1;
      _spacemanY += (_targetY - _spacemanY) * 0.1;
      _spacemanY += Math.sin(_floatingT * 1.5) * 0.5; // micro floating pas terbang

      // Catat koordinat jalur ke dalam array list lintasan grafik
      _graphPoints.push({ x: _spacemanX, y: _spacemanY });
      if (_graphPoints.length > TRAIL_MAX_LEN) _graphPoints.shift();
    }

    // 4. Menggambar Jalur Lintasan & Efek Area di Bawah Grafik (90% Asli)
    if (_graphPoints.length > 1) {
      // Efek Gradasi Area di Bawah Garis Kuning
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(_graphPoints[0].x, H);
      _graphPoints.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.lineTo(_graphPoints[_graphPoints.length - 1].x, H);
      ctx.closePath();
      let areaGrad = ctx.createLinearGradient(0, H * 0.3, 0, H);
      areaGrad.addColorStop(0, 'rgba(212, 175, 90, 0.22)');
      areaGrad.addColorStop(1, 'rgba(212, 175, 90, 0.00)');
      ctx.fillStyle = areaGrad;
      ctx.fill();
      ctx.restore();

      // Garis kuning emas tebal menyala
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(_graphPoints[0].x, _graphPoints[0].y);
      for (let i = 1; i < _graphPoints.length; i++) {
        ctx.lineTo(_graphPoints[i].x, _graphPoints[i].y);
      }
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 3.5;
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#ffd700';
      ctx.stroke();
      ctx.restore();
    }

    // 5. Draw Spaceman Character / Astronot (Vector Rendering & Emojis Campuran)
    ctx.save();
    if (_phase === 'crashed') {
      // Animasi Terpental Jatuh saat Crash
      _crashFallY += 3.5;
      _crashRot += 0.08;
      ctx.translate(_spacemanX, _spacemanY + _crashFallY);
      ctx.rotate(_crashRot);
    } else {
      ctx.translate(_spacemanX, _spacemanY);
      // Hadang arah rotasi sedikit mendongak ke kanan atas
      ctx.rotate(-0.15);
    }

    _drawAstronaut(ctx);
    ctx.restore();

    // 6. Draw Explosion Particles (Jika Crash)
    if (_phase === 'crashed') {
      _explosionParticles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.015;
        if (p.alpha > 0) {
          ctx.fillStyle = `rgba(255, ${Math.floor(100 + Math.random()*155)}, 0, ${p.alpha})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
          ctx.fill();
        }
      });
    }
  }

  // Fungsi khusus menggambar Karakter Astronot agar 90% mirip aslinya
  function _drawAstronaut(ctx) {
    // Jetpack Api Semburan Belakang
    if (_phase === 'flying') {
      let fireW = 12 + Math.random() * 8;
      let fireGrad = ctx.createLinearGradient(-15, 5, -30, 5);
      fireGrad.addColorStop(0, '#ffcc00');
      fireGrad.addColorStop(1, 'rgba(255,50,0,0)');
      ctx.fillStyle = fireGrad;
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.lineTo(-10 - fireW, 4);
      ctx.lineTo(-10, 10);
      ctx.closePath();
      ctx.fill();
    }

    // Render Astronot Pack (Tas Oksigen Putih)
    ctx.fillStyle = '#e6e6e6';
    ctx.fillRect(-12, -4, 8, 16);

    // Render Badan Utama / Baju Astronot (Bulat Oval Putih)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 4, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Kaca Helm / Visor (Biru Cyan Mengkilap khas Spaceman)
    ctx.fillStyle = '#22a6b3';
    ctx.beginPath();
    ctx.arc(4, 1, 6, 0, Math.PI * 2);
    ctx.fill();
    // Efek Refleksi Kaca Helm
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.arc(5, -1, 2, 0, Math.PI * 2);
    ctx.fill();

    // Tangan & Kaki Melayang (Warna Abu / Putih)
    ctx.fillStyle = '#ffffff';
    // Tangan melayang menunjuk ke depan
    ctx.fillRect(4, 7, 8, 4); 
    // Kaki menekuk ke belakang sedikit
    ctx.fillRect(-6, 12, 4, 6);
    ctx.fillRect(0, 12, 4, 5);
  }

  return { init, _onStart, _onCashout, _onCrashHead };

})();
