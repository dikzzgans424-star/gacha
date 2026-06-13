/* ══════════════════════════════════════
   SPACEMAN — Full HTML/CSS
   Tidak ada canvas. Semua animasi pakai
   CSS keyframes + JS class toggling.
══════════════════════════════════════ */
const Spaceman = (() => {

  const TICK_MS    = 100;
  const SPEED_BASE = 0.015;
  const SPEED_FAST = 0.025;

  let _gacha      = null;
  let _callback   = null;
  let _multiplier = 1.00;
  let _crashAt    = 2.00;
  let _cashedOut  = false;
  let _isWin      = false;
  let _phase      = 'ready';
  let _tickTimer  = null;
  let _multEl     = null;
  let _planetEl   = null;

  /* ══ INIT ══ */
  function init(gacha, callback) {
    _gacha    = gacha;
    _callback = callback;
    _isWin    = gacha.result === 'win';
    _crashAt  = _isWin
      ? parseFloat((3.5 + Math.random() * 5.0).toFixed(2))
      : parseFloat((1.5 + Math.random() * 2.0).toFixed(2));
    _multiplier = 1.00;
    _phase      = 'ready';
    _cashedOut  = false;
    if (_tickTimer) clearInterval(_tickTimer);
    _buildHTML();
  }

  /* ══ HTML ══ */
  function _buildHTML() {
    const old = document.getElementById('gameArea');
    if (old) old.remove();
    const anchor = document.getElementById('gachaInfoCard');

    const area = document.createElement('div');
    area.id = 'gameArea'; area.className = 'game-area slide-in';

    const bet = Number(_gacha.betAmount || _gacha.money / 1000).toLocaleString('id-ID');

    area.innerHTML = `
<div class="sm2-wrap" id="sm2Wrap">
  <div class="slot-section-label">👨‍🚀 SPACEMAN</div>

  <!-- Scene -->
  <div class="sm2-scene" id="sm2Scene">

    <!-- Background stars -->
    <div class="sm2-stars" id="sm2Stars"></div>

    <!-- Mountains (ready/flying) -->
    <div class="sm2-mountains">
      <div class="sm2-mountain sm2-mt-back"></div>
      <div class="sm2-mountain sm2-mt-front"></div>
    </div>

    <!-- UFO (ready only) -->
    <div class="sm2-ufo" id="sm2Ufo">
      <div class="sm2-ufo-dome"></div>
      <div class="sm2-ufo-body">
        <span class="sm2-ufo-light" style="background:#ffcc00"></span>
        <span class="sm2-ufo-light" style="background:#ff5500"></span>
        <span class="sm2-ufo-light" style="background:#88ddff"></span>
      </div>
    </div>

    <!-- Small dark planet left (ready only) -->
    <div class="sm2-planet-dark" id="sm2PlanetDark"></div>

    <!-- Small blue planet top (ready only) -->
    <div class="sm2-planet-blue" id="sm2PlanetBlue"></div>

    <!-- Trail -->
    <div class="sm2-trail-wrap" id="sm2TrailWrap">
      <div class="sm2-trail-line"></div>
    </div>

    <!-- Flying planet with multiplier -->
    <div class="sm2-fly-planet" id="sm2FlyPlanet">
      <div class="sm2-planet-glow"></div>
      <div class="sm2-planet-rays" id="sm2Rays"></div>
      <div class="sm2-planet-body">
        <div class="sm2-planet-ring"></div>
        <div class="sm2-planet-craters"></div>
        <div class="sm2-planet-spec"></div>
        <div class="sm2-orbit-arrows" id="sm2OrbitArrows"></div>
      </div>
      <div class="sm2-multiplier" id="sm2Mult">1.00×</div>
    </div>

    <!-- Crash balloons -->
    <div class="sm2-crash-scene" id="sm2CrashScene">
      <div class="sm2-crash-text" id="sm2CrashText">
        <div class="sm2-crash-label">TERTABRAK</div>
        <div class="sm2-crash-value" id="sm2CrashVal">1.00×</div>
      </div>
      <div class="sm2-balloons" id="sm2Balloons">
        <div class="sm2-balloon sm2-balloon-left">
          <div class="sm2-bal-planet sm2-bal-purple"></div>
          <div class="sm2-bal-string"></div>
        </div>
        <div class="sm2-balloon sm2-balloon-mid">
          <div class="sm2-bal-planet sm2-bal-saturn">
            <div class="sm2-bal-ring"></div>
          </div>
          <div class="sm2-bal-string"></div>
        </div>
        <div class="sm2-balloon sm2-balloon-right">
          <div class="sm2-bal-planet sm2-bal-blue"></div>
          <div class="sm2-bal-string"></div>
        </div>
      </div>
    </div>

    <!-- Astronot -->
    <div class="sm2-astro" id="sm2Astro">
      <div class="sm2-astro-inner">
        <!-- Antena -->
        <div class="sm2-antenna">
          <div class="sm2-antenna-ball"></div>
          <div class="sm2-antenna-pole"></div>
        </div>
        <!-- Helm -->
        <div class="sm2-helmet">
          <div class="sm2-visor">
            <div class="sm2-visor-shine"></div>
            <div class="sm2-eye sm2-eye-l"></div>
            <div class="sm2-eye sm2-eye-r"></div>
          </div>
          <div class="sm2-helmet-trim"></div>
        </div>
        <!-- Body -->
        <div class="sm2-body">
          <div class="sm2-cape"></div>
          <div class="sm2-suit">
            <div class="sm2-badge"></div>
          </div>
          <div class="sm2-arm sm2-arm-l"></div>
          <div class="sm2-arm sm2-arm-r"></div>
        </div>
        <!-- Kaki -->
        <div class="sm2-legs">
          <div class="sm2-leg sm2-leg-l"><div class="sm2-boot"></div></div>
          <div class="sm2-leg sm2-leg-r"><div class="sm2-boot"></div></div>
        </div>
        <!-- Jetpack flame -->
        <div class="sm2-flame" id="sm2Flame"></div>
      </div>
    </div>

  </div><!-- /scene -->

  <!-- Buttons -->
  <div class="sm-btn-row">
    <button class="sm-btn sm-start"   id="smStartBtn" onclick="Spaceman._start()">▶ MELUNCUR</button>
    <button class="sm-btn sm-cashout" id="smCashBtn"  onclick="Spaceman._cashout()" disabled>💰 CASHOUT</button>
  </div>

  <!-- Info -->
  <div class="spaceman-info-row">
    <div class="spaceman-info-item">
      <span class="spaceman-info-label">Taruhan</span>
      <span class="spaceman-info-val gold">Rp ${bet}</span>
    </div>
    <div class="spaceman-info-item">
      <span class="spaceman-info-label">Status</span>
      <span class="spaceman-info-val" id="smStatus">Siap meluncur...</span>
    </div>
  </div>
</div>`;

    if (anchor) anchor.replaceWith(area);
    else document.querySelector('.glass-card').insertAdjacentElement('afterend', area);

    _multEl   = document.getElementById('sm2Mult');
    _planetEl = document.getElementById('sm2FlyPlanet');

    _buildStars();
    _buildRays();
    _buildOrbitArrows();
  }

  function _buildStars() {
    const wrap = document.getElementById('sm2Stars');
    if (!wrap) return;
    wrap.innerHTML = Array.from({ length: 55 }, () => {
      const x = Math.random() * 100;
      const y = Math.random() * 75;
      const s = 0.8 + Math.random() * 2.2;
      const d = (Math.random() * 3).toFixed(1);
      const dur = (1.5 + Math.random() * 2.5).toFixed(1);
      return `<span class="sm2-star" style="
        left:${x}%;top:${y}%;
        width:${s}px;height:${s}px;
        animation-delay:${d}s;
        animation-duration:${dur}s;
      "></span>`;
    }).join('');
  }

  function _buildRays() {
    const wrap = document.getElementById('sm2Rays');
    if (!wrap) return;
    wrap.innerHTML = Array.from({ length: 16 }, (_, i) => {
      const ang = (i / 16) * 360;
      return `<div class="sm2-ray" style="transform:rotate(${ang}deg)"></div>`;
    }).join('');
  }

  function _buildOrbitArrows() {
    const wrap = document.getElementById('sm2OrbitArrows');
    if (!wrap) return;
    wrap.innerHTML = Array.from({ length: 8 }, (_, i) => {
      const ang = (i / 8) * 360;
      return `<div class="sm2-orbit-arrow" style="--ang:${ang}deg">▲</div>`;
    }).join('');
  }

  /* ══ CONTROLS ══ */
  function _start() {
    if (_phase !== 'ready') return;
    _phase = 'flying';

    const sb = document.getElementById('smStartBtn');
    const cb = document.getElementById('smCashBtn');
    if (sb) { sb.disabled = true; sb.textContent = '🚀 Terbang!'; }
    if (cb)   cb.disabled = false;

    const wrap = document.getElementById('sm2Wrap');
    if (wrap) wrap.classList.add('sm2-flying');

    document.getElementById('smStatus').textContent = 'Astronot sedang terbang!';
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
    document.getElementById('smCashBtn').disabled = true;
    const bet   = _gacha.betAmount || (_gacha.money / 1000);
    const prize = Math.floor(bet * _multiplier * 1000 * 0.95);
    const st = document.getElementById('smStatus');
    st.textContent = `✓ Cashout Rp ${prize.toLocaleString('id-ID')}!`;
    st.style.color = '#4caf82';
    const wrap = document.getElementById('sm2Wrap');
    if (wrap) wrap.classList.add('sm2-cashout');
    setTimeout(() => _callback(true, prize), 2200);
  }

  function _doCrash() {
    if (_phase === 'crashed') return;
    _phase = 'crashed';
    clearInterval(_tickTimer);
    const cb = document.getElementById('smCashBtn');
    if (cb) cb.disabled = true;

    /* Update crash value */
    const cv = document.getElementById('sm2CrashVal');
    if (cv) cv.textContent = _multiplier.toFixed(2) + '×';

    /* Trigger crash state */
    const wrap = document.getElementById('sm2Wrap');
    if (wrap) { wrap.classList.remove('sm2-flying'); wrap.classList.add('sm2-crashed'); }

    const st = document.getElementById('smStatus');
    if (st) { st.textContent = `Nabrak di ${_multiplier.toFixed(2)}×`; st.style.color = '#cf5c5c'; }

    setTimeout(() => _callback(false, _gacha.money), 3500);
  }

  /* ══ TICK ══ */
  function _tick() {
    if (_phase !== 'flying') return;
    const inc   = _multiplier >= 2.0 ? SPEED_FAST : SPEED_BASE;
    _multiplier = parseFloat((_multiplier + inc).toFixed(3));

    /* Update multiplier text */
    if (_multEl) _multEl.textContent = _multiplier.toFixed(2) + '×';

    /* Ubah warna planet tiap threshold */
    if (_planetEl) {
      _planetEl.classList.remove('sm2-planet-blue-t','sm2-planet-purple','sm2-planet-deep');
      if      (_multiplier >= 6) _planetEl.classList.add('sm2-planet-deep');
      else if (_multiplier >= 3) _planetEl.classList.add('sm2-planet-purple');
      else                       _planetEl.classList.add('sm2-planet-blue-t');
    }

    if (_multiplier >= _crashAt) _doCrash();
  }

  return { init, _start, _cashout };
})();
