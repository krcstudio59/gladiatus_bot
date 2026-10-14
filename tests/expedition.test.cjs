const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../content.js'), 'utf8');

function setup({points = '5 / 12', ready = true, pendingAttack = false, resume = false} = {}) {
  let clicks = 0;
  let listener;
  let callback;
  const url = 'https://s1-tr.gladiatus.gameforge.com/game/index.php?mod=location&loc=1&sh=test';
  const button = {
    getAttribute: name => name === 'onclick' ? "attack(this, 1, 1, 0, '')" : null,
    getClientRects: () => [1], click: () => clicks++,
  };
  let stored = resume ? JSON.stringify({running:true,intervalSeconds:10,opponentIndex:0,expeditionUrl:url,pendingAttack,logs:[]}) : null;
  const sandbox = {
    URL, console, location: {href:url,origin:new URL(url).origin,assign: next => {sandbox.location.href = next;}},
    document: {
      title: 'Gladiatus',
      querySelector: selector => selector.startsWith('#expeditionpoints') ? {textContent:points} : selector === '#cooldown_bar_expedition' ? {querySelector:() => ready ? {} : null} : null,
      querySelectorAll: () => [button],
    },
    sessionStorage: {getItem:() => stored,setItem:(key,value) => {stored = value;}},
    chrome: {runtime:{id:'test',onMessage:{addListener: fn => {listener = fn;}}}},
    setTimeout: fn => {callback = fn;return 1;},clearTimeout:() => {},
  };
  vm.runInNewContext(source, sandbox);
  return {
    send(type) {let result;listener({target:'gladiatus-bot',type,intervalSeconds:10,opponentIndex:0},{id:'test'},value => {result = value;});return result;},
    tick:() => callback(),clicks:() => clicks,sandbox,
  };
}

test('Hazır ve puan varsa bir kez saldırır; sonuç belirsizse tekrarlamaz', () => {
  const bot = setup();
  bot.send('START');bot.tick();bot.tick();
  assert.equal(bot.clicks(), 1);
  bot.send('STOP');bot.tick();
  assert.equal(bot.clicks(), 1);
});

test('Sıfır puan, aktif bekleme veya okunamayan puan saldırıyı engeller', () => {
  for (const settings of [{points:'0 / 12'},{ready:false},{points:'bilinmiyor'}]) {
    const bot = setup(settings);
    const result = bot.send('START');
    if (!result.error) bot.tick();
    assert.equal(bot.clicks(), 0);
  }
});

test('Yenilemede bekleyen saldırı tekrar tıklanmaz', () => {
  const bot = setup({resume:true,pendingAttack:true});
  bot.tick();assert.equal(bot.clicks(), 0);
});

test('Rapordan seçilen bölgeye döner; o sayfada saldırmaz', () => {
  const bot = setup({resume:true});
  bot.sandbox.location.href = 'https://s1-tr.gladiatus.gameforge.com/game/index.php?mod=reports&sh=new';
  bot.tick();
  assert.equal(new URL(bot.sandbox.location.href).searchParams.get('mod'), 'location');
  assert.equal(new URL(bot.sandbox.location.href).searchParams.get('sh'), 'new');
  assert.equal(bot.clicks(), 0);
});
