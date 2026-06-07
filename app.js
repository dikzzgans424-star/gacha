const emojis = [
  '🍇','🍉','🍋','🍌','🍎','🍑','🍒','🫐','🥥','🥑'
];

const reel1 = document.getElementById('reel1');
const reel2 = document.getElementById('reel2');
const reel3 = document.getElementById('reel3');

const statusText    = document.getElementById('statusText');
const resultOverlay = document.getElementById('resultOverlay');
const resultEmoji   = document.getElementById('resultEmoji');
const resultTitle   = document.getElementById('resultTitle');
const resultDesc    = document.getElementById('resultDesc');

function randomEmoji() {
  return emojis[Math.floor(Math.random() * emojis.length)];
}

function fillReel(reel) {
  let html = '';
  for (let i = 0; i < 40; i++) {
    html += `<div>${randomEmoji()}</div>`;
  }
  reel.innerHTML = html;
}

fillReel(reel1);
fillReel(reel2);
fillReel(reel3);

async function getGachaData() {
  const res = await fetch('/.netlify/functions/gacha');

  if (!res.ok) throw new Error('Gagal mengambil data dari server');

  const json = await res.json();

  if (!json.content) throw new Error(json.message || 'Content tidak ditemukan');

  return {
    sha:  json.sha,
    data: JSON.parse(atob(json.content.replace(/\n/g, '')))
  };
}

async function saveGachaData(data, sha) {
  const res = await fetch('/.netlify/functions/gacha-update', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ data, sha })
  });

  if (!res.ok) throw new Error('Gagal menyimpan data');
}

function animateReel(reel, duration) {
  return new Promise(resolve => {
    fillReel(reel);

    reel.style.transition = 'none';
    reel.style.transform  = 'translateY(0px)';

    setTimeout(() => {
      reel.style.transition = `transform ${duration}ms cubic-bezier(.1,.8,.2,1)`;
      reel.style.transform  = 'translateY(-2100px)';
    }, 20);

    setTimeout(resolve, duration);
  });
}

function showResult(isWin, money) {
  const badge = document.getElementById('resultBadge');

  if (isWin) {
    resultEmoji.innerHTML = '🎉';
    resultTitle.innerHTML = 'Jackpot!';
    resultDesc.innerHTML  = `+ Rp ${money.toLocaleString()}`;
    if (badge) { badge.className = 'result-badge win'; badge.textContent = '● WIN'; }
  } else {
    resultEmoji.innerHTML = '💀';
    resultTitle.innerHTML = 'Belum Beruntung';
    resultDesc.innerHTML  = `- Rp ${money.toLocaleString()}`;
    if (badge) { badge.className = 'result-badge lose'; badge.textContent = '● LOSE'; }
  }

  resultOverlay.style.display = 'flex';
}

function closeResult() {
  resultOverlay.style.display = 'none';
}

async function startSpin() {
  try {
    const id = document.getElementById('gachaId').value.trim().toUpperCase();

    if (!id) {
      setStatus('⚠ Masukkan ID Gacha terlebih dahulu.');
      shakeInput();
      return;
    }

    setStatus('🔍 Mengecek ID...', true);

    const file  = await getGachaData();
    const gacha = file.data.gacha.find(x => x.idgacha.toUpperCase() === id);

    if (!gacha) {
      setStatus('❌ ID Tidak Ditemukan');
      return;
    }

    if (gacha.status) {
      setStatus('❌ Sudah Diproses');
      return;
    }

    setStatus('🎰 SPINNING...', true);

    document.getElementById('spinBtn').disabled = true;

    await Promise.all([
      animateReel(reel1, 2500),
      animateReel(reel2, 3200),
      animateReel(reel3, 4000)
    ]);

    const chance = gacha.isPremium ? 35 : 27;
    const isWin  = Math.random() * 100 < chance;

    gacha.status     = true;
    gacha.result     = isWin ? 'win' : 'lose';
    gacha.finishedAt = Date.now();

    await saveGachaData(file.data, file.sha);

    setStatus(isWin ? '🏆 WIN' : '💀 LOSE');
    document.getElementById('spinBtn').disabled = false;

    showResult(isWin, gacha.money);

  } catch (err) {
    console.error(err);
    setStatus('❌ ERROR: ' + err.message);
    document.getElementById('spinBtn').disabled = false;
    alert(err.message);
  }
}

/* ── Helpers ── */

function setStatus(msg, active = false) {
  statusText.textContent = msg;
  const dot = document.getElementById('statusDot');
  if (dot) dot.classList.toggle('active', active);
}

function shakeInput() {
  const inp = document.getElementById('gachaId');
  inp.style.animation = 'none';
  inp.getBoundingClientRect();
  inp.style.animation = 'shake 0.4s ease';
}

/* Close overlay on backdrop click */
resultOverlay.addEventListener('click', function(e) {
  if (e.target === this) closeResult();
});
