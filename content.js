(() => {
  if (globalThis.gladiatusBotLoaded) return;
  globalThis.gladiatusBotLoaded = true;

  let running = false;
  let timer = null;
  let intervalSeconds = 10;
  let opponentIndex = 0;
  let expeditionUrl = '';
  let pendingAttack = false;
  let dungeonRunning = false;
  let dungeonUrl = '';
  let dungeonDifficulty = 'dif1';
  let dungeonPending = null;
  let dungeonEntering = null;
  let nextTask = 'expedition';
  let pendingExpeditionPoints = null;
  const sessionKey = 'gladiatus-bot-expedition-v1';
  const logs = [];

  function log(message) {
    logs.push(`${new Date().toLocaleTimeString('tr-TR')} ${message}`);
    if (logs.length > 50) logs.shift();
  }

  function readPage() {
    const url = new URL(location.href);
    return {
      title: document.title,
      host: url.host,
      module: url.searchParams.get('mod'),
      section: url.searchParams.get('submod'),
      gameDetected: Boolean(document.querySelector('#mainnav, #content, #char')),
    };
  }

  function status() {
    return { running, dungeonRunning, expeditionUrl, nextTask, dungeonUrl, dungeonDifficulty, dungeonAvailable: new URL(location.href).searchParams.get('mod') === 'dungeon', intervalSeconds, opponentIndex, opponents: getOpponents().map((button, index) => ({index,label:`Rakip ${index + 1}`})), page: {...readPage(),...readExpedition(),dungeon:readDungeon()}, logs: [...logs] };
  }

  function getOpponents() {
    if (new URL(location.href).searchParams.get('mod') !== 'location') return [];
    return [...document.querySelectorAll('.expedition_button')].filter(button => {
      const handler = button.getAttribute('onclick') || '';
      const attack = handler.match(/\battack\s*\(\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*([^,)]+)/);
      return attack && attack[1].trim() === '0'; // Premium saldırıları çıkar.
    });
  }

  function readExpedition() {
    const pointsElement = document.querySelector('#expeditionpoints_value, #expeditionpoints, #header_values_expedition_points');
    const match = pointsElement?.textContent.trim().match(/^(\d+)(?:\s*\/\s*\d+)?$/);
    const bar = document.querySelector('#cooldown_bar_expedition');
    return {
      points: match ? Number(match[1]) : null,
      ready: bar ? Boolean(bar.querySelector('.cooldown_bar_fill_ready')) : null,
    };
  }

  function saveSession() {
    sessionStorage.setItem(sessionKey, JSON.stringify({running,intervalSeconds,opponentIndex,expeditionUrl,pendingAttack,pendingExpeditionPoints,dungeonRunning,dungeonUrl,dungeonDifficulty,dungeonPending,dungeonEntering,nextTask,logs}));
  }

  function readDungeon() {
    const element = document.querySelector('#dungeonpoints_value_point, #dungeonpoints_value, #dungeonpoints, #header_values_dungeon_points');
    const match = element?.textContent?.trim().match(/^(\d+)(?:\s*\/\s*\d+)?$/);
    const bar = document.querySelector('#cooldown_bar_dungeon');
    return {points:match ? Number(match[1]) : null,ready:bar ? Boolean(bar.querySelector('.cooldown_bar_fill_ready')) : null};
  }

  function dungeonControls() {
    const attack = [...document.querySelectorAll('#content area[onclick], #content area[href], #content img[src*="/combatloc.gif"]')].find(element => {
      if (element.tagName === 'AREA') {
        const href = element.getAttribute('href') || '';
        return Boolean(element.getAttribute('onclick')) || /(?:attack|fight)/i.test(href);
      }
      return Boolean(element.getAttribute('onclick') || element.closest('a[href], [onclick]'));
    });
    const entry = document.querySelector(`#content input[name="${dungeonDifficulty}"][type="submit"], #content button[name="${dungeonDifficulty}"]`);
    return {attack,entry};
  }

  function canClick(element) {
    return element && !element.disabled && element.getAttribute('aria-disabled') !== 'true' && (element.tagName === 'AREA' || element.getClientRects().length > 0);
  }

  function runDungeon() {
    if (!dungeonRunning) return false;
    const state = readDungeon();
    if (state.points === null || state.ready === null) {
      log('Zindan puanı veya bekleme göstergesi okunamadı.');
      return false;
    }
    if (!state.ready) { dungeonPending = null; log('Zindan bekleme süresi devam ediyor.'); return false; }
    if (dungeonPending && state.points < dungeonPending.points) dungeonPending = null;
    if (state.points === 0) { log('Zindan puanı yok; bekleniyor.'); return false; }
    if (dungeonPending) { log('Önceki zindan saldırısının sonucu bekleniyor.'); return false; }
    const current = new URL(location.href);
    const target = new URL(dungeonUrl);
    if (current.pathname !== target.pathname || current.searchParams.get('mod') !== 'dungeon' || current.searchParams.get('loc') !== target.searchParams.get('loc')) {
      if (current.searchParams.has('sh')) target.searchParams.set('sh', current.searchParams.get('sh'));
      log('Seçilen zindana dönülüyor.');
      saveSession();
      location.assign(target.href);
      return true;
    }
    const {attack,entry} = dungeonControls();
    if (attack && canClick(attack)) {
      dungeonEntering = null;
      dungeonPending = {points:state.points};
      nextTask = 'expedition';
      log('Zindanda sıradaki rakibe saldırı tıklandı.');
      saveSession();
      attack.click();
      return true;
    }
    if (entry && canClick(entry)) {
      if (dungeonEntering) { log('Zindana giriş sonucu bekleniyor.'); return false; }
      dungeonEntering = true;
      log(`Zindana giriş tıklandı (${dungeonDifficulty === 'dif1' ? 'Normal' : 'İleri'}).`);
      saveSession();
      entry.click();
      return true;
    }
    log('Zindanda kullanılabilir savaş veya giriş düğmesi bulunamadı.');
    return false;
  }

  function runExpedition() {
    const state = readExpedition();
    if (state.points === null || state.ready === null) {
      log('Keşif puanı veya bekleme göstergesi okunamadı; saldırı yapılmadı.');
      return false;
    }
    if (!state.ready) {
      pendingAttack = false;
      log('Keşif bekleme süresi devam ediyor.');
      return false;
    }
    if (state.points === 0) { log('Keşif puanı yok; bekleniyor.'); return false; }
    if (pendingAttack) { log('Önceki saldırının sonucu bekleniyor; tekrar saldırılmadı.'); return false; }
    const current = new URL(location.href);
    const target = new URL(expeditionUrl);
    if (current.pathname !== target.pathname || current.searchParams.get('mod') !== 'location' || current.searchParams.get('loc') !== target.searchParams.get('loc') || current.searchParams.get('submod') !== target.searchParams.get('submod')) {
      const next = new URL(expeditionUrl);
      // Güncel oturum anahtarını koru.
      if (current.searchParams.has('sh')) next.searchParams.set('sh', current.searchParams.get('sh'));
      log('Seçilen keşif bölgesine dönülüyor.');
      saveSession();
      location.assign(next.href);
      return true;
    }
    const button = getOpponents()[opponentIndex];
    if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true' || button.getClientRects().length === 0) {
      log('Seçilen rakibin saldırı düğmesi kullanılamıyor.');
      return false;
    }
    pendingAttack = true; // Sonuç belirsizken ikinci tıklamayı engelle.
    pendingExpeditionPoints = state.points;
    nextTask = 'dungeon';
    log(`Rakip ${opponentIndex + 1} için saldırı tıklandı.`);
    saveSession();
    button.click();
    return true;
  }

  function tick() {
    if (!running && !dungeonRunning) return;
    try {
      // Her iki beklemeyi de izle; diğer görev çalışırken kilit takılmaz.
      const expedition = readExpedition();
      const dungeon = readDungeon();
      if (expedition.ready === false || (pendingExpeditionPoints !== null && expedition.points !== null && expedition.points < pendingExpeditionPoints)) {
        pendingAttack = false;
        pendingExpeditionPoints = null;
      }
      if (dungeon.ready === false || (dungeonPending && dungeon.points !== null && dungeon.points < dungeonPending.points)) dungeonPending = null;
      // Yönlendirme ve giriş sırayı değiştirmez; yalnızca saldırı değiştirir.
      if (nextTask === 'expedition') {
        if (!(running && runExpedition())) runDungeon();
      } else if (!runDungeon() && running) runExpedition();
      saveSession();
    } catch (error) {
      running = false;
      dungeonRunning = false;
      log(`Bot durdu: ${error.message}`);
      try { saveSession(); } catch {}
    }
    if (running || dungeonRunning) timer = setTimeout(tick, intervalSeconds * 1000);
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (sender.id !== chrome.runtime.id || message?.target !== 'gladiatus-bot') return;
    if (message.type === 'START_BOTH') {
      const interval = Number(message.intervalSeconds);
      if (!Number.isInteger(interval) || interval < 3 || interval > 300) {
        sendResponse({error:'Kontrol aralığı 3–300 arasında tam sayı olmalı.'}); return;
      }
      if (!expeditionUrl || !dungeonUrl) {
        sendResponse({error:'Önce keşif rakibini ve zindanı kendi sayfalarında kaydet.'}); return;
      }
      running = true;
      dungeonRunning = true;
      intervalSeconds = interval;
      log('Keşif ve zindan dönüşümlü başlatıldı.');
      saveSession();
      clearTimeout(timer);
      timer = setTimeout(tick, 1000);
    } else if (message.type === 'STOP_ALL') {
      running = false;
      dungeonRunning = false;
      clearTimeout(timer);
      log('Tüm görevler durduruldu.');
      saveSession();
    } else if (message.type === 'START_DUNGEON' || message.type === 'SAVE_DUNGEON') {
      const interval = Number(message.intervalSeconds);
      const url = new URL(location.href);
      if (!Number.isInteger(interval) || interval < 3 || interval > 300) {
        sendResponse({error:'Kontrol aralığı 3–300 arasında tam sayı olmalı.'}); return;
      }
      if (url.searchParams.get('mod') !== 'dungeon' || !url.searchParams.has('loc') || !['dif1','dif2'].includes(message.dungeonDifficulty)) {
        sendResponse({error:'İstediğin zindanın sayfasını açıp zorluk seç.'}); return;
      }
      const state = readDungeon();
      if (state.points === null || state.ready === null) {
        sendResponse({error:'Zindan puanı veya bekleme göstergesi okunamadı.'}); return;
      }
      dungeonDifficulty = message.dungeonDifficulty;
      const controls = dungeonControls();
      if (!controls.attack && !controls.entry) {
        sendResponse({error:'Seçilen zorluk için giriş veya savaş düğmesi bulunamadı.'}); return;
      }
      dungeonUrl = location.href;
      dungeonPending = null;
      dungeonEntering = null;
      dungeonRunning = message.type === 'START_DUNGEON';
      intervalSeconds = interval;
      log(dungeonRunning ? 'Otomatik zindan başlatıldı.' : 'Zindan seçimi kaydedildi.');
      saveSession();
      clearTimeout(timer);
      if (running || dungeonRunning) timer = setTimeout(tick, 1000);
    } else if (message.type === 'STOP_DUNGEON') {
      dungeonRunning = false;
      log('Otomatik zindan durduruldu.');
      if (!running) clearTimeout(timer);
      saveSession();
    } else if (message.type === 'START' || message.type === 'SAVE_EXPEDITION') {
      const interval = Number(message.intervalSeconds);
      if (!Number.isInteger(interval) || interval < 3 || interval > 300) {
        sendResponse({ error: 'Kontrol aralığı 3–300 arasında tam sayı olmalı.' });
        return;
      }
      const selected = Number(message.opponentIndex);
      const url = new URL(location.href);
      if (url.searchParams.get('mod') !== 'location' || url.searchParams.get('submod') === 'serverQuest' || !Number.isInteger(selected) || !getOpponents()[selected]) {
        sendResponse({ error: 'Keşif bölgesini açıp geçerli bir rakip seçin. Saldırı düğmeleri okunamıyorsa sayfa HTML’i gerekli.' });
        return;
      }
      if (readExpedition().points === null || readExpedition().ready === null) {
        sendResponse({ error: 'Keşif puanı veya bekleme göstergesi okunamadı. Sayfa HTML’i gerekli.' });
        return;
      }
      clearTimeout(timer);
      intervalSeconds = interval;
      opponentIndex = selected;
      expeditionUrl = location.href;
      pendingAttack = false;
      pendingExpeditionPoints = null;
      running = message.type === 'START';
      log(running ? 'Otomatik keşif başlatıldı.' : 'Keşif seçimi kaydedildi.');
      saveSession();
      if (running || dungeonRunning) timer = setTimeout(tick, 1000);
    } else if (message.type === 'STOP') {
      running = false;
      if (!dungeonRunning) clearTimeout(timer);
      log('Otomatik keşif durduruldu.');
      saveSession();
    } else if (message.type !== 'STATUS') {
      return;
    }
    sendResponse(status());
  });
  log('Eklenti sayfaya bağlandı.');
  try {
    const saved = JSON.parse(sessionStorage.getItem(sessionKey) || 'null');
    if (saved && Number.isInteger(saved.intervalSeconds) && saved.intervalSeconds >= 3 && saved.intervalSeconds <= 300) {
      running = Boolean(saved.running && Number.isInteger(saved.opponentIndex) && saved.opponentIndex >= 0 && new URL(saved.expeditionUrl).origin === location.origin);
      intervalSeconds = saved.intervalSeconds;
      opponentIndex = saved.opponentIndex;
      expeditionUrl = saved.expeditionUrl;
      pendingAttack = Boolean(saved.pendingAttack);
      pendingExpeditionPoints = Number.isInteger(saved.pendingExpeditionPoints) ? saved.pendingExpeditionPoints : null;
      nextTask = saved.nextTask === 'dungeon' ? 'dungeon' : 'expedition';
      dungeonRunning = Boolean(saved.dungeonRunning && ['dif1','dif2'].includes(saved.dungeonDifficulty) && new URL(saved.dungeonUrl).origin === location.origin && new URL(saved.dungeonUrl).searchParams.get('mod') === 'dungeon');
      dungeonUrl = saved.dungeonUrl || '';
      dungeonDifficulty = saved.dungeonDifficulty || 'dif1';
      dungeonPending = saved.dungeonPending || null;
      dungeonEntering = saved.dungeonEntering || null;
      if (Array.isArray(saved.logs)) logs.push(...saved.logs.slice(-49));
      if (running || dungeonRunning) timer = setTimeout(tick, 1000);
    }
  } catch { log('Önceki oturum yüklenemedi.'); }
})();
