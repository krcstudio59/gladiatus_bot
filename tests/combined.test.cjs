const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../content.js'), 'utf8');

function setup(saved = null) {
  const origin = 'https://s1-tr.gladiatus.gameforge.com';
  const expUrl = `${origin}/game/index.php?mod=location&loc=1&sh=test`;
  const dungeonUrl = `${origin}/game/index.php?mod=dungeon&loc=2&sh=test`;
  const state = {expPoints:5,dungeonPoints:5,expReady:true,dungeonReady:true,actions:[]};
  let listener, callback, stored = saved && JSON.stringify(saved);
  const expedition = {getAttribute: name => name === 'onclick' ? "attack(this, 1, 1, 0, '')" : null,getClientRects:() => [1],click:() => state.actions.push('expedition')};
  const dungeon = {tagName:'AREA',getAttribute: name => name === 'onclick' ? 'fight()' : null,click:() => state.actions.push('dungeon')};
  const sandbox = {
    URL,location:{href:expUrl,origin,assign: next => {sandbox.location.href = next;state.actions.push('navigate');}},
    document:{title:'Gladiatus',querySelector: selector => {
      if (selector.startsWith('#expeditionpoints')) return {textContent:String(state.expPoints)};
      if (selector.startsWith('#dungeonpoints')) return {textContent:String(state.dungeonPoints)};
      if (selector === '#cooldown_bar_expedition') return {querySelector:() => state.expReady ? {} : null};
      if (selector === '#cooldown_bar_dungeon') return {querySelector:() => state.dungeonReady ? {} : null};
      return null;
    },querySelectorAll: selector => selector === '.expedition_button' ? [expedition] : sandbox.location.href.includes('mod=dungeon') ? [dungeon] : []},
    sessionStorage:{getItem:() => stored,setItem:(key,value) => {stored = value;}},
    chrome:{runtime:{id:'test',onMessage:{addListener: fn => {listener = fn;}}}},
    setTimeout: fn => {callback = fn;return 1;},clearTimeout:() => {},
  };
  vm.runInNewContext(source, sandbox);
  const bot = {state,sandbox,expUrl,dungeonUrl,tick:() => callback(),saved:() => JSON.parse(stored),send(type) {
    let result;listener({target:'gladiatus-bot',type,intervalSeconds:10,opponentIndex:0,dungeonDifficulty:'dif1'},{id:'test'},value => {result = value;});return result;
  },configure() {
    assert.equal(bot.send('SAVE_EXPEDITION').running, false);
    sandbox.location.href = dungeonUrl;
    assert.equal(bot.send('SAVE_DUNGEON').dungeonRunning, false);
    bot.send('START_BOTH');
  }};
  return bot;
}

test('Birlikte başlatmak için iki seçim gerekir', () => {
  const bot = setup();assert.ok(bot.send('START_BOTH').error);
  bot.send('SAVE_EXPEDITION');assert.ok(bot.send('START_BOTH').error);
});

test('Sıra yalnızca saldırıda değişir; tek kontrolde tek işlem', () => {
  const bot = setup();bot.configure();
  bot.tick();assert.equal(bot.send('STATUS').nextTask, 'expedition');
  bot.tick();assert.equal(bot.send('STATUS').nextTask, 'dungeon');
  bot.tick();assert.equal(bot.send('STATUS').nextTask, 'dungeon');
  bot.tick();assert.deepEqual(bot.state.actions, ['navigate','expedition','navigate','dungeon']);
  assert.equal(bot.send('STATUS').nextTask, 'expedition');
});

test('Keşif beklerken zindan çalışır; bekleyen iki görev işlem yapmaz', () => {
  const bot = setup();bot.configure();bot.state.expReady = false;
  bot.tick();assert.deepEqual(bot.state.actions, ['dungeon']);
  bot.state.dungeonReady = false;bot.tick();
  assert.deepEqual(bot.state.actions, ['dungeon']);
});

test('Zindan puanı yokken hazır keşif çalışır', () => {
  const bot = setup();bot.configure();bot.state.dungeonPoints = 0;
  bot.tick();bot.tick();
  assert.deepEqual(bot.state.actions, ['navigate','expedition']);
});

test('Yenileme sırayı korur; tümünü durdur seçimleri korur', () => {
  const original = setup();original.configure();original.tick();original.tick();
  const bot = setup(original.saved());
  assert.equal(bot.send('STATUS').nextTask, 'dungeon');
  bot.tick();assert.deepEqual(bot.state.actions, ['navigate']);
  const stopped = bot.send('STOP_ALL');
  assert.equal(stopped.running, false);assert.equal(stopped.dungeonRunning, false);
  assert.equal(stopped.expeditionUrl, bot.expUrl);assert.equal(stopped.dungeonUrl, bot.dungeonUrl);
  bot.tick();assert.deepEqual(bot.state.actions, ['navigate']);
});
