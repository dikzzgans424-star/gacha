const githubToken = 'GANTI_TOKEN_KAMU';

const GITHUB_OWNER = 'dikzzgans424-star';
const GITHUB_REPO = 'slot';
const GITHUB_PATH = 'gacha.json';

const emojis = [
'🍇',
'🍉',
'🍋',
'🍌',
'🍎',
'🍑',
'🍒',
'🫐',
'🥥',
'🥑'
];

const reel1 = document.getElementById('reel1');
const reel2 = document.getElementById('reel2');
const reel3 = document.getElementById('reel3');

const statusText =
document.getElementById('statusText');

const resultOverlay =
document.getElementById('resultOverlay');

const resultEmoji =
document.getElementById('resultEmoji');

const resultTitle =
document.getElementById('resultTitle');

const resultDesc =
document.getElementById('resultDesc');

function randomEmoji(){
return emojis[
Math.floor(
Math.random() * emojis.length
)
];
}

function fillReel(reel){

let html = '';

for(let i=0;i<40;i++){

html += `

<div>${randomEmoji()}</div>
`;}

reel.innerHTML = html;

}

fillReel(reel1);
fillReel(reel2);
fillReel(reel3);

async function getGachaData(){

const headers = {
Authorization:
"Bearer ${githubToken}",
Accept:
'application/vnd.github+json'
};

const res = await fetch(
"https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}",
{
headers
}
);

const json = await res.json();

return {
sha: json.sha,
data: JSON.parse(
atob(json.content)
)
};

}

async function saveGachaData(
data,
sha
){

await fetch(
"https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_PATH}",
{
method:'PUT',
headers:{
Authorization:
"Bearer ${githubToken}",
'Content-Type':
'application/json'
},
body:JSON.stringify({
message:'Update Gacha',
content:btoa(
JSON.stringify(
data,
null,
2
)
),
sha
})
}
);

}

function animateReel(
reel,
duration
){

return new Promise(resolve=>{

fillReel(reel);

reel.style.transition =
'none';

reel.style.transform =
'translateY(0px)';

setTimeout(()=>{

reel.style.transition =
"transform ${duration}ms cubic-bezier(.1,.8,.2,1)";

reel.style.transform =
'translateY(-2100px)';

},20);

setTimeout(()=>{
resolve();
},duration);

});

}

function showResult(
isWin,
money
){

resultOverlay.style.display =
'flex';

if(isWin){

resultEmoji.innerHTML =
'🎉';

resultTitle.innerHTML =
'WIN';

resultDesc.innerHTML =
"+ Rp ${money.toLocaleString()}";

}else{

resultEmoji.innerHTML =
'💀';

resultTitle.innerHTML =
'LOSE';

resultDesc.innerHTML =
"- Rp ${money.toLocaleString()}";

}

}

function closeResult(){

resultOverlay.style.display =
'none';

}

async function startSpin(){

try{

const id =
document
.getElementById('gachaId')
.value
.trim()
.toUpperCase();

if(!id){

alert(
'Masukkan ID Gacha'
);

return;

}

statusText.innerHTML =
'🔍 Mengecek ID...';

const file =
await getGachaData();

const gacha =
file.data.gacha.find(
x =>
x.idgacha.toUpperCase()
=== id
);

if(!gacha){

statusText.innerHTML =
'❌ ID Tidak Ditemukan';

return;

}

if(gacha.status){

statusText.innerHTML =
'❌ Sudah Diproses';

return;

}

statusText.innerHTML =
'🎰 SPINNING...';

await Promise.all([

animateReel(
reel1,
2500
),

animateReel(
reel2,
3200
),

animateReel(
reel3,
4000
)

]);

const chance =
gacha.isPremium
? 35
: 27;

const isWin =
Math.random() * 100
< chance;

gacha.status = true;

gacha.result =
isWin
? 'win'
: 'lose';

gacha.finishedAt =
Date.now();

await saveGachaData(
file.data,
file.sha
);

statusText.innerHTML =
isWin
? '🎉 WIN'
: '💀 LOSE';

showResult(
isWin,
gacha.money
);

}catch(err){

console.error(err);

statusText.innerHTML =
'❌ ERROR';

alert(
err.message
);

}

}