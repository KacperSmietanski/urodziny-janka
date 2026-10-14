const quests = campaignQuests;
const storageKey = 'kroniki-janka-v2';
const defaults = () => ({
  done: [],
  drinks: { Piwo: 0, Shot: 0, Drink: 0, Woda: 0 },
  bag: [],
  finale: false,
  pendingToast: null,
  toastDraft: '',
  toastHistory: [],
  journalText: '',
  korneliaHint: false,
  rps: { janekWins: 0, dawidWins: 0, totalLosses: 0, pendingToast: false }
});

let state;
try {
  state = { ...defaults(), ...JSON.parse(localStorage.getItem(storageKey) || '{}') };
  state.drinks = { ...defaults().drinks, ...(state.drinks || {}) };
  state.bag = Array.isArray(state.bag) ? state.bag : [];
  state.toastHistory = Array.isArray(state.toastHistory) ? state.toastHistory : [];
  state.journalText = typeof state.journalText === 'string' ? state.journalText : '';
  state.rps = { ...defaults().rps, ...(state.rps || {}) };
  const saved = new Set(Array.isArray(state.done) ? state.done : []);
  state.done = [];
  for (const quest of quests) {
    if (!saved.has(quest.id)) break;
    state.done.push(quest.id);
  }
  if (state.done.length < quests.length - 1) state.finale = false;
  if (state.pendingToast && state.pendingToast !== quests[state.done.length]?.id) state.pendingToast = null;
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

const normalMusic = 'https://www.youtube.com/embed/xKZtSIqPmVY?autoplay=1&list=RDxKZtSIqPmVY&start_radio=1';
const finaleMusic = 'https://www.youtube.com/embed/Uf6pQ9JVBm8?autoplay=1&list=RDUf6pQ9JVBm8&start_radio=1';
function playMusic(finale = state.finale) {
  el('musicFrame').src = finale ? finaleMusic : normalMusic;
}

function activeQuestHtml(quest, index) {
  const isFinal = quest.isFinal === true;
  const videoLink = quest.youtubeUrl
    ? `<a class="video-link" href="${escapeHtml(quest.youtubeUrl.replace(/^http:/, 'https:'))}" target="_blank" rel="noopener noreferrer">▶ Otwórz materiał na YouTube</a>`
    : '';
  const passwordGate = isFinal ? `<div class="password-gate">
    <label for="passwordInput">Hasło finału</label>
    <div class="answer-row"><input class="field" id="passwordInput" placeholder="Wpisz hasło finału" autocomplete="off"><button class="btn" id="checkPassword">Sprawdź hasło</button></div>
    <div class="status" id="passwordStatus" aria-live="polite">${state.finale ? '✦ Pieczęć pękła. W skarbcu czeka gramofon.' : 'Rozbij mroczną pieczęć właściwym hasłem.'}</div>
  </div>` : '';
  const bonus = quest.bonusQuest ? `<section class="bonus-quest"><div class="task-label">Quest poboczny · ${escapeHtml(quest.bonusQuest.title)}</div><p>${textBlock(quest.bonusQuest.description)}</p>${state.korneliaHint ? `<div class="revealed-hint"><strong>Wskazówka do finału</strong><span>${escapeHtml(quest.bonusQuest.hint)}</span></div>` : `<button class="btn" id="revealHint">Ukończyliśmy próbę — pokaż wskazówkę</button>`}</section>` : '';
  const rps = quest.rpsChallenge ? drawRps() : '';
  const canComplete = (!isFinal || state.finale) && (!quest.rpsChallenge || state.rps.janekWins >= 3);
  return `<article class="quest active-quest ${quest.isMystery ? 'mystery' : ''} ${isFinal ? 'finale' : ''}">
    <div class="quest-num">Quest ${index + 1} z ${quests.length}${quest.isMystery ? ' · Tajemniczy NPC' : ''}</div>
    <img class="portrait" src="${escapeHtml(quest.portrait)}" alt="Portret: ${escapeHtml(quest.npcName)}" fetchpriority="high">
    <div class="npc-name">${escapeHtml(quest.npcName)}</div>
    <div class="npc-title">${escapeHtml(quest.npcTitle)}</div>
    <h3>${escapeHtml(quest.questTitle)}</h3>
    <p class="lore">${textBlock(quest.lore)}</p>
    <blockquote class="rhyme">${textBlock(quest.rhyme)}</blockquote>
    <div class="task-label">Twoje zadanie</div><p class="task">${textBlock(quest.task)}</p>${videoLink}${rps}${bonus}
    <div class="reward"><span>Nagroda</span><strong>${escapeHtml(quest.reward)}</strong></div>
    ${passwordGate}
    <div class="quest-foot"><span class="hint">${canComplete ? 'Po queście napiszesz toast wspólnie z uczestnikiem. Dopiero po jego wzniesieniu odkryje się dalsza droga.' : quest.rpsChallenge && state.rps.dawidWins >= 3 ? 'Dawid wygrał serię — zagrajcie kolejną, aż Janek zwycięży.' : 'Najpierw wpisz hasło finału.'}</span><button class="btn primary" id="completeQuest" ${canComplete ? '' : 'disabled'}>Wykonałem questa</button></div>
  </article>`;
}

function drawRps() {
  const wins = state.rps.janekWins;
  const losses = state.rps.dawidWins;
  const seriesWon = wins >= 3;
  const seriesLost = losses >= 3;
  const penalty = state.rps.pendingToast ? `<div class="rps-penalty"><strong>Przegrana runda zapisana.</strong><p>Wznieście mały toast przed dalszą grą — napój alkoholowy lub symboliczny łyk też jest w porządku.</p><label><input type="checkbox" id="lossToastCheck"> Toast po rundzie wzniesiony</label><button class="btn" id="ackLossToast" disabled>Wróć do pojedynku</button></div>` : '';
  const controls = seriesWon
    ? '<div class="status">🏆 Janek wygrał serię! Pojedynek zaliczony.</div>'
    : seriesLost
      ? '<div class="status">Dawid wygrał tę serię. Zagrajcie kolejną, aż Janek zwycięży.</div><button class="btn" id="nextSeries">Rozpocznij kolejną serię</button>'
      : `<div class="rps-score">Seria ${wins} : ${losses} · po każdej przegranej Janka przewidziany jest mały toast.</div><div class="rps-buttons"><button class="btn" id="janekRound">Janek wygrał rundę</button><button class="btn" id="dawidRound">Dawid wygrał rundę</button></div>`;
  return `<section class="rps-box"><div class="task-label">Zapis pojedynku BO5</div>${penalty}${state.rps.pendingToast ? '' : controls}</section>`;
}

function toastScreen(quest, index) {
  return `<article class="quest active-quest toast-screen"><div class="quest-num">Quest ${index + 1} · Toast przed kolejną kartą</div>
    <img class="portrait" src="${escapeHtml(quest.portrait)}" alt="Portret: ${escapeHtml(quest.npcName)}">
    <div class="npc-name">Toast z ${escapeHtml(quest.npcName)}</div><h3>Wznieście toast, zanim wyruszysz dalej</h3>
    <p class="lore">Napisz krótkie, własne życzenia dla uczestnika questa. Potem wznieście toast wybranym napojem i potwierdźcie poniżej. Może być alkoholowy albo symboliczny — liczy się wspólny moment.</p>
    <label class="task-label" for="toastDraft">Twój toast</label><textarea class="field toast-draft" id="toastDraft" maxlength="240" placeholder="Za co wznosicie toast?">${escapeHtml(state.toastDraft)}</textarea>
    <label class="toast-confirm"><input type="checkbox" id="toastDoneCheck"> Wznieśliśmy toast i wypiliśmy wybrany napój (także alkoholowy)</label>
    <button class="btn primary toast-continue" id="continueAfterToast" disabled>Toast wzniesiony — odkryj dalej</button>
  </article>`;
}

function drawQuests() {
  const currentIndex = state.done.length;
  const completed = quests.slice(0, currentIndex).map((quest, index) => `<article class="quest done-compact">
    <img class="done-portrait" src="${escapeHtml(quest.portrait)}" alt=""><div class="quest-num">Quest ${index + 1} · Zaliczone</div>
    <div class="completed-name">${escapeHtml(quest.npcName)}</div><div class="completed-title">${escapeHtml(quest.questTitle)}</div>
  </article>`).join('');
  const activeQuest = quests[currentIndex];
  let active;
  if (!activeQuest) {
    active = `<article class="quest finale completed-finale"><div class="eyebrow">Kampania ukończona</div><h3>Skarb z najgłębszego skarbca zdobyty!</h3><p>Za mroczną pieczęcią czekał gramofon. Wszystkie questy z Kronik Janka są zaliczone.</p></article>`;
  } else if (state.pendingToast === activeQuest.id) {
    active = toastScreen(activeQuest, currentIndex);
  } else {
    active = activeQuestHtml(activeQuest, currentIndex);
  }
  el('questList').innerHTML = completed + active;

  const completeButton = el('completeQuest');
  if (completeButton) completeButton.onclick = () => {
    const quest = quests[state.done.length];
    if (!quest || (quest.isFinal && !state.finale) || (quest.rpsChallenge && state.rps.janekWins < 3)) return;
    state.pendingToast = quest.id; state.toastDraft = ''; save(); render();
    document.getElementById('quest-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const toastDraft = el('toastDraft');
  if (toastDraft) {
    toastDraft.oninput = () => { state.toastDraft = toastDraft.value; save(); updateToastGate(); };
    el('toastDoneCheck').onchange = updateToastGate;
    el('continueAfterToast').onclick = () => {
      const quest = quests[state.done.length];
      if (!quest || state.pendingToast !== quest.id || !state.toastDraft.trim() || !el('toastDoneCheck').checked) return;
      state.toastHistory.push({ id: quest.id, text: state.toastDraft.trim() });
      state.done.push(quest.id); state.pendingToast = null; state.toastDraft = '';
      if (quest.rpsChallenge) state.rps = { janekWins: 0, dawidWins: 0, totalLosses: state.rps.totalLosses, pendingToast: false };
      save(); render();
      toast(state.done.length === quests.length ? 'Kampania ukończona!' : 'Toast wzniesiony — odkryto następny quest!');
      document.getElementById('quest-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
  }

  const passwordInput = el('passwordInput');
  if (passwordInput) {
    passwordInput.onkeydown = event => { if (event.key === 'Enter') el('checkPassword').click(); };
    el('checkPassword').onclick = () => {
      const normalized = passwordInput.value.toLocaleLowerCase('pl').normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]/g, '');
      const status = el('passwordStatus');
      if (normalized === 'sawannaafrykanska') {
        state.finale = true; save(); render(); playMusic(true); toast('Mroczna pieczęć pękła — skarb odkryty!');
      } else {
        status.className = 'status error';
        status.textContent = 'To jeszcze nie to hasło. Spróbuj ponownie.';
      }
    };
  }

  const revealHint = el('revealHint');
  if (revealHint) revealHint.onclick = () => {
    state.korneliaHint = true; save(); render(); toast('Kornelia zdradza wskazówkę do finału');
  };

  if (el('janekRound')) el('janekRound').onclick = () => recordRps('janek');
  if (el('dawidRound')) el('dawidRound').onclick = () => recordRps('dawid');
  if (el('nextSeries')) el('nextSeries').onclick = () => {
    state.rps.janekWins = 0; state.rps.dawidWins = 0; save(); render();
  };
  if (el('lossToastCheck')) {
    el('lossToastCheck').onchange = () => { el('ackLossToast').disabled = !el('lossToastCheck').checked; };
    el('ackLossToast').onclick = () => { state.rps.pendingToast = false; save(); render(); };
  }
}

function updateToastGate() {
  const field = el('toastDraft'); const check = el('toastDoneCheck'); const button = el('continueAfterToast');
  if (field && check && button) button.disabled = !field.value.trim() || !check.checked;
}
function recordRps(winner) {
  if (state.rps.pendingToast || state.rps.janekWins >= 3 || state.rps.dawidWins >= 3) return;
  if (winner === 'janek') state.rps.janekWins += 1;
  else { state.rps.dawidWins += 1; state.rps.totalLosses += 1; state.rps.pendingToast = true; }
  save(); render();
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

function drawJournal() {
  const field = el('journalInput');
  field.value = state.journalText;
  field.oninput = () => { state.journalText = field.value.slice(0, 5000); save(); el('journalStatus').textContent = 'Zapisano na tym urządzeniu.'; };
}

function render() {
  drawQuests(); drawCounters(); drawBag(); drawJournal();
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
  state = defaults(); save(); render(); playMusic(false); toast('Nowy dziennik gotowy');
};

playMusic();
el('soundBtn').onclick = () => { playMusic(); toast('Odtwarzacz muzyki uruchomiony'); };

render();

