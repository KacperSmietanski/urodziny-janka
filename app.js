const quests = campaignQuests;
const storageKey = 'kroniki-janka-v2';
const defaults = () => ({
  done: [],
  drinks: { Piwo: 0, Shot: 0, Drink: 0, Woda: 0 },
  bag: [],
  finale: false
});

let state;
try {
  state = { ...defaults(), ...JSON.parse(localStorage.getItem(storageKey) || '{}') };
  state.drinks = { ...defaults().drinks, ...(state.drinks || {}) };
  state.bag = Array.isArray(state.bag) ? state.bag : [];
  const saved = new Set(Array.isArray(state.done) ? state.done : []);
  state.done = [];
  for (const quest of quests) {
    if (!saved.has(quest.id)) break;
    state.done.push(quest.id);
  }
  if (state.done.length < quests.length - 1) state.finale = false;
} catch {
  state = defaults();
}

const el = id => document.getElementById(id);
const save = () => localStorage.setItem(storageKey, JSON.stringify(state));
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));
const textBlock = value => escapeHtml(value).replace(/\r?\n/g, '<br>');
let toastTimer;

function toast(message) {
  const node = el('toast');
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), 1800);
}

function activeQuestHtml(quest, index) {
  const isFinal = quest.isFinal === true;
  const videoLink = quest.youtubeUrl
    ? `<a class="video-link" href="${escapeHtml(quest.youtubeUrl.replace(/^http:/, 'https:'))}" target="_blank" rel="noopener noreferrer">▶ Otwórz materiał na YouTube</a>`
    : '';
  const passwordGate = isFinal ? `<div class="password-gate">
    <label for="passwordInput">Hasło finału</label>
    <div class="answer-row"><input class="field" id="passwordInput" placeholder="Wpisz hasło finału" autocomplete="off"><button class="btn" id="checkPassword">Sprawdź hasło</button></div>
    <div class="status" id="passwordStatus" aria-live="polite">${state.finale ? '✦ Hasło przyjęte. Możesz zaliczyć ostatni quest.' : 'Wpisz hasło, aby odebrać gramofon.'}</div>
  </div>` : '';
  const canComplete = !isFinal || state.finale;
  return `<article class="quest active-quest ${quest.isMystery ? 'mystery' : ''} ${isFinal ? 'finale' : ''}">
    <div class="quest-num">Quest ${index + 1} z ${quests.length} ${quest.isMystery ? '· Tajemniczy NPC' : ''}</div>
    <div class="npc-name">${escapeHtml(quest.npcName)}</div>
    <div class="npc-title">${escapeHtml(quest.npcTitle)}</div>
    <h3>${escapeHtml(quest.questTitle)}</h3>
    <p class="lore">${textBlock(quest.lore)}</p>
    <blockquote class="rhyme">${textBlock(quest.rhyme)}</blockquote>
    <div class="task-label">Twoje zadanie</div><p class="task">${textBlock(quest.task)}</p>${videoLink}
    <div class="reward"><span>Nagroda</span><strong>${escapeHtml(quest.reward)}</strong></div>
    ${passwordGate}
    <div class="quest-foot"><span class="hint">${canComplete ? 'Po wykonaniu zadania odblokujesz następne spotkanie.' : 'Najpierw wpisz hasło finału.'}</span><button class="btn primary" id="completeQuest" ${canComplete ? '' : 'disabled'}>Wykonałem questa</button></div>
  </article>`;
}

function drawQuests() {
  const currentIndex = state.done.length;
  const completed = quests.slice(0, currentIndex).map((quest, index) => `<article class="quest done-compact">
    <div class="quest-num">Quest ${index + 1} · Zaliczone</div>
    <div class="completed-name">${escapeHtml(quest.npcName)}</div>
    <div class="completed-title">${escapeHtml(quest.questTitle)}</div>
  </article>`).join('');
  const active = currentIndex < quests.length
    ? activeQuestHtml(quests[currentIndex], currentIndex)
    : `<article class="quest finale completed-finale"><div class="eyebrow">Kampania ukończona</div><h3>Gramofon przeznaczenia zdobyty!</h3><p>Wszystkie questy z Kronik Janka są zaliczone.</p></article>`;
  el('questList').innerHTML = completed + active;
  const completeButton = el('completeQuest');
  if (completeButton) completeButton.onclick = () => {
    const quest = quests[state.done.length];
    if (!quest || (quest.isFinal && !state.finale)) return;
    state.done.push(quest.id);
    save(); render();
    toast(state.done.length === quests.length ? 'Kampania ukończona!' : 'Quest zaliczony — odkryto następny!');
    document.getElementById('quest-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const passwordInput = el('passwordInput');
  if (passwordInput) {
    passwordInput.onkeydown = event => { if (event.key === 'Enter') el('checkPassword').click(); };
    el('checkPassword').onclick = () => {
      const normalized = passwordInput.value.toLocaleLowerCase('pl').normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]/g, '');
      const status = el('passwordStatus');
      if (normalized === 'sawannaafrykanska') {
        state.finale = true; save(); render(); toast('Hasło przyjęte — gramofon czeka!');
      } else {
        status.className = 'status error';
        status.textContent = 'To jeszcze nie to hasło. Spróbuj ponownie.';
      }
    };
  }
}

function drawCounters() {
  el('counters').innerHTML = Object.entries(state.drinks).map(([name, count]) => `<div class="counter"><label>${escapeHtml(name)}</label><div class="stepper"><button aria-label="Odejmij ${escapeHtml(name)}" data-count="${escapeHtml(name)}" data-delta="-1">−</button><strong>${Math.max(0, Number(count) || 0)}</strong><button aria-label="Dodaj ${escapeHtml(name)}" data-count="${escapeHtml(name)}" data-delta="1">+</button></div></div>`).join('');
  el('counters').querySelectorAll('[data-count]').forEach(button => button.onclick = () => {
    const name = button.dataset.count;
    state.drinks[name] = Math.max(0, (Number(state.drinks[name]) || 0) + Number(button.dataset.delta));
    save(); render();
  });
}

function drawBag() {
  el('bagList').innerHTML = state.bag.map((item, index) => `<span class="bag-item">${escapeHtml(item)} <button data-remove="${index}" aria-label="Usuń ${escapeHtml(item)}">×</button></span>`).join('') || '<span class="hint">Pusto — przygoda dopiero się zaczyna.</span>';
  el('bagList').querySelectorAll('[data-remove]').forEach(button => button.onclick = () => {
    state.bag.splice(Number(button.dataset.remove), 1); save(); render();
  });
}

function render() {
  drawQuests(); drawCounters(); drawBag();
  const completed = state.done.length;
  el('doneStat').textContent = completed;
  el('progressText').textContent = `${completed} / ${quests.length} questów`;
  el('progressFill').style.width = `${100 * completed / quests.length}%`;
  el('drinkStat').textContent = Object.values(state.drinks).reduce((sum, count) => sum + (Number(count) || 0), 0);
  el('bagStat').textContent = state.bag.length;
}

el('addItem').onclick = () => {
  const item = el('itemInput').value.trim();
  if (!item) return;
  state.bag.push(item.slice(0, 45)); el('itemInput').value = ''; save(); render(); toast('Dodano do ekwipunku');
};
el('itemInput').onkeydown = event => { if (event.key === 'Enter') el('addItem').click(); };
el('beginBtn').onclick = () => el('quest-section').scrollIntoView({ behavior: 'smooth' });
el('resetBtn').onclick = () => {
  if (!confirm('Zacząć od nowa? Postęp i ekwipunek zostaną wyczyszczone.')) return;
  state = defaults(); save(); render(); toast('Nowy dziennik gotowy');
};

const musicUrl = 'https://www.youtube.com/embed/xKZtSIqPmVY?autoplay=1&list=RDxKZtSIqPmVY&start_radio=1';
el('musicFrame').src = musicUrl;
el('soundBtn').onclick = () => { el('musicFrame').src = musicUrl; toast('Odtwarzacz muzyki uruchomiony'); };

render();

