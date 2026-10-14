const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../content.js'), 'utf8');

function setup({points='5 / 12',ready=true,entry=false,resume=null} = {}) {
  const state = {points,ready,entry,clicks:0,entries:0};
  const url = 'https://s1-tr.gladiatus.gameforge.com/game/index.php?mod=dungeon&loc=2&sh=test';
  let listener, callback, stored = resume && JSON.stringify(resume);
  const attack = {tagName:'AREA',getAttribute: name => name === 'onclick' ? 'fight()' : null,click:() => state.clicks++};
  const entrance = {tagName:'INPUT',getAttribute:() => null,getClientRects:() => [1],click:() => state.entries++};
  const sandbox = {
    URL,location:{href:url,origin:new URL(url).origin,assign: next => {sandbox.location.href = next;}},
    document:{
      title:'Gladiatus',
      querySelector: selector => {
        if (selector.startsWith('#dungeonpoints')) return {textContent:state.points};
        if (selector === '#cooldown_bar_dungeon') return {querySelector:() => state.ready ? {} : null};
        if (selector.startsWith('#content input')) return state.entry ? entrance : null;
        return null;
      },
      querySelectorAll: selector => selector.startsWith('#content area') && !state.entry ? [attack] : [],
    },
    sessionStorage:{getItem:() => stored,setItem:(key,value) => {stored = value;}},
    chrome:{runtime:{id:'test',onMessage:{addListener: fn => {listener = fn;}}}},
    setTimeout: fn => {callback = fn;return 1;},clearTimeout:() => {},
  };
  vm.runInNewContext(source, sandbox);
  return {state,sandbox,url,tick:() => callback(),saved:() => JSON.parse(stored),send(type='START_DUNGEON',difficulty='dif1') {
    let result;
    listener({target:'gladiatus-bot',type,intervalSeconds:10,dungeonDifficulty:difficulty},{id:'test'},value => {result = value;});
    return result;
  }};
}

test('Hazır zindanda tek saldırı; bekleme sonrası sıradaki saldırı', () => {
  const bot = setup();
  assert.equal(bot.send().dungeonRunning, true);
  bot.tick();bot.tick();assert.equal(bot.state.clicks, 1);
  bot.state.ready = false;bot.tick();assert.equal(bot.state.clicks, 1);
  bot.state.ready = true;bot.tick();assert.equal(bot.state.clicks, 2);
  bot.send('STOP_DUNGEON');bot.tick();assert.equal(bot.state.clicks, 2);
});

test('Puan yokken, bekleme sürerken veya puan okunamıyorsa savaşmaz', () => {
  for (const config of [{points:'0 / 12'},{ready:false},{points:'?'}]) {
    const bot = setup(config);
    if (!bot.send().error) bot.tick();
    assert.equal(bot.state.clicks, 0);
  }
});

test('Giriş bir kez tıklanır; harita geldikten sonra savaşır ve sonraki turda tekrar girer', () => {
  const bot = setup({entry:true});
  bot.send();bot.tick();bot.tick();assert.equal(bot.state.entries, 1);
  bot.state.entry = false;bot.tick();assert.equal(bot.state.clicks, 1);
  bot.state.ready = false;bot.tick();
  bot.state.ready = true;bot.state.entry = true;bot.tick();
  assert.equal(bot.state.entries, 2);
});

test('Rapordan kayıtlı zindana güncel oturum anahtarıyla döner', () => {
  const bot = setup();bot.send();
  bot.sandbox.location.href = 'https://s1-tr.gladiatus.gameforge.com/game/index.php?mod=reports&sh=new';
  bot.tick();
  const url = new URL(bot.sandbox.location.href);
  assert.equal(url.searchParams.get('mod'), 'dungeon');
  assert.equal(url.searchParams.get('loc'), '2');
  assert.equal(url.searchParams.get('sh'), 'new');
  assert.equal(bot.state.clicks, 0);
});

test('Yenilemede zindan devam eder; belirsiz saldırı tekrar edilmez', () => {
  const original = setup();original.send();original.tick();
  const bot = setup({resume:original.saved()});
  assert.equal(bot.send('STATUS').dungeonRunning, true);
  bot.tick();assert.equal(bot.state.clicks, 0);
  bot.state.ready = false;bot.tick();bot.state.ready = true;bot.tick();
  assert.equal(bot.state.clicks, 1);
});

test('Yanlış sayfa veya geçersiz zorluk başlangıcı engeller', () => {
  const bot = setup();
  assert.ok(bot.send('START_DUNGEON','dif3').error);
  bot.sandbox.location.href = bot.url.replace('mod=dungeon','mod=overview');
  assert.ok(bot.send().error);
});
