/* ══════════════════════════════════════
   GAME: ROULETTE (placeholder)
   Expose: Roulette.init(gacha, onResult)
══════════════════════════════════════ */
const Roulette = (() => {

  let _gacha    = null;
  let _onResult = null;

  function render() {
    return `
      <div class="slot-card" style="text-align:center;padding:40px 22px;">
        <div class="slot-section-label">Roulette</div>
        <div style="font-size:64px;margin:24px 0;">🎡</div>
        <p style="color:var(--text-muted);font-size:12px;letter-spacing:2px;text-transform:uppercase;">
          Coming Soon
        </p>
      </div>
    `;
  }

  function init(gacha, onResult) {
    _gacha    = gacha;
    _onResult = onResult;

    const area = document.createElement('div');
    area.id        = 'gameArea';
    area.className = 'game-area slide-in';
    area.innerHTML = render();
    document.querySelector('.status-card').insertAdjacentElement('afterend', area);
  }

  return { init };
})();
