const statusLabel = document.querySelector('#status');
const intervalInput = document.querySelector('#interval');
const startButton = document.querySelector('#start');
const stopButton = document.querySelector('#stop');
const inspectButton = document.querySelector('#inspect');
let tabId;
const opponentSelect = document.querySelector('#opponent');
const difficultySelect = document.querySelector('#difficulty');
const dungeonStartButton = document.querySelector('#dungeon-start');
const dungeonStopButton = document.querySelector('#dungeon-stop');
let dungeonConfigured = false;
const bothStartButton = document.querySelector('#both-start');
const allStopButton = document.querySelector('#all-stop');
const expeditionSaveButton = document.querySelector('#expedition-save');
const dungeonSaveButton = document.querySelector('#dungeon-save');

function render(state) {
  if (state.error) throw new Error(state.error);
  statusLabel.textContent = state.running ? 'Otomatik keşif çalışıyor' : 'Bağlı · Durduruldu';
  const selected = opponentSelect.value || String(state.opponentIndex);
  opponentSelect.replaceChildren();
  for (const opponent of state.opponents) {
    opponentSelect.add(new Option(opponent.label, String(opponent.index)));
  }
  if (!state.opponents.length) opponentSelect.add(new Option('Keşif bölgesini aç', ''));
  else opponentSelect.value = state.opponents.some(opponent => String(opponent.index) === selected) ? selected : '0';
  opponentSelect.disabled = state.running;
  startButton.disabled = state.running || !state.opponents.length;
  stopButton.disabled = !state.running;
  inspectButton.disabled = false;
  if (!dungeonConfigured) { difficultySelect.value = state.dungeonDifficulty; dungeonConfigured = true; }
  difficultySelect.disabled = state.dungeonRunning;
  dungeonStartButton.disabled = state.dungeonRunning || !state.dungeonAvailable;
  dungeonStopButton.disabled = !state.dungeonRunning;
  expeditionSaveButton.disabled = state.running || !state.opponents.length;
  dungeonSaveButton.disabled = state.dungeonRunning || !state.dungeonAvailable;
  bothStartButton.disabled = !state.expeditionUrl || !state.dungeonUrl || (state.running && state.dungeonRunning);
  allStopButton.disabled = !state.running && !state.dungeonRunning;
  const expeditionLabel = state.expeditionUrl ? `Keşif ${new URL(state.expeditionUrl).searchParams.get('loc')} / Rakip ${state.opponentIndex + 1}` : 'Keşif kaydedilmedi';
  const dungeonLabel = state.dungeonUrl ? `Zindan ${new URL(state.dungeonUrl).searchParams.get('loc')}` : 'Zindan kaydedilmedi';
  document.querySelector('#queue-status').textContent = `${expeditionLabel} · ${dungeonLabel} · Sıra: ${state.nextTask === 'expedition' ? 'Keşif' : 'Zindan'}`;
  document.querySelector('#dungeon-status').textContent = state.dungeonRunning ? `Çalışıyor · ${new URL(state.dungeonUrl).searchParams.get('loc')} · Puan: ${state.page.dungeon.points ?? '?'}` : 'Zindan durduruldu.';
  document.querySelector('#snapshot').textContent = JSON.stringify(state.page);
  document.querySelector('#logs').textContent = state.logs.join('\n');
}

async function send(type) {
  try {
    const state = await chrome.tabs.sendMessage(tabId, {
      target: 'gladiatus-bot', type, intervalSeconds: Number(intervalInput.value), opponentIndex: Number(opponentSelect.value), dungeonDifficulty: difficultySelect.value,
    });
    if (state?.error) { statusLabel.textContent = state.error; return false; }
    render(state);
    return true;
  } catch (error) {
    statusLabel.textContent = error.message.includes('Kontrol aralığı')
      ? error.message
      : 'Gladiatus sekmesini açıp yenileyin; ardından eklentiyi tekrar açın.';
    return false;
  }
}

startButton.addEventListener('click', async () => {
  if (await send('START')) {
    await chrome.storage.local.set({ intervalSeconds: Number(intervalInput.value) });
  }
});
stopButton.addEventListener('click', () => send('STOP'));
inspectButton.addEventListener('click', () => send('STATUS'));
dungeonStartButton.addEventListener('click', async () => {
  if (await send('START_DUNGEON')) await chrome.storage.local.set({intervalSeconds:Number(intervalInput.value)});
});
dungeonStopButton.addEventListener('click', () => send('STOP_DUNGEON'));
expeditionSaveButton.addEventListener('click', () => send('SAVE_EXPEDITION'));
dungeonSaveButton.addEventListener('click', () => send('SAVE_DUNGEON'));
bothStartButton.addEventListener('click', async () => {
  if (await send('START_BOTH')) await chrome.storage.local.set({intervalSeconds:Number(intervalInput.value)});
});
allStopButton.addEventListener('click', () => send('STOP_ALL'));

async function init() {
  try {
    const settings = await chrome.storage.local.get({ intervalSeconds: 10 });
    intervalInput.value = settings.intervalSeconds;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tabId = tab?.id;
    await send('STATUS');
  } catch {
    statusLabel.textContent = 'Eklenti başlatılamadı. Tekrar açın.';
  }
}
init();
