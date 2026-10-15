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
  charades: { startedAt: null, success: false, expired: false },
  tongueTwister: { attempts: 0, success: false, penalty: false },
  scienceTrivia: { unknown: 0, total: 0, facts: [] },
  billiards: { streak: 0, done: false },
  gymLift: { done: false },
  quizChallenge: { asked: 0, correct: 0, incorrect: 0, baliaRequired: false, baliaDone: false },
  rps: { janekWins: 0, dawidWins: 0, totalLosses: 0, seriesLosses: 0, pendingToast: false }
});

let state;
try {
  state = { ...defaults(), ...JSON.parse(localStorage.getItem(storageKey) || '{}') };
  state.drinks = { ...defaults().drinks, ...(state.drinks || {}) };
  state.bag = Array.isArray(state.bag) ? state.bag : [];
  state.toastHistory = Array.isArray(state.toastHistory) ? state.toastHistory : [];
  state.journalText = typeof state.journalText === 'string' ? state.journalText : '';
  state.rps = { ...defaults().rps, ...(state.rps || {}) };
  state.charades = { ...defaults().charades, ...(state.charades || {}) };
  state.tongueTwister = { ...defaults().tongueTwister, ...(state.tongueTwister || {}) };
  state.scienceTrivia = { ...defaults().scienceTrivia, ...(state.scienceTrivia || {}) };
  state.scienceTrivia.facts = Array.isArray(state.scienceTrivia.facts) ? state.scienceTrivia.facts : [];
  state.billiards = { ...defaults().billiards, ...(state.billiards || {}) };
  state.gymLift = { ...defaults().gymLift, ...(state.gymLift || {}) };
  state.quizChallenge = { ...defaults().quizChallenge, ...(state.quizChallenge || {}) };
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
let charadesTimer;
function playMusic(finale = state.finale) {
  el('musicFrame').src = finale ? finaleMusic : normalMusic;
}
function showHintVideoDialog() {
  const dialog = el('hintVideoDialog');
  if (!dialog?.showModal) return;
  dialog.showModal();
  el('hintVideo').play().catch(() => {});
}

function scrollToActiveQuest() {
  requestAnimationFrame(() => document.querySelector('#questList .active-quest')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
}

function drawScienceTrivia() {
  const challenge = state.scienceTrivia;
  const facts = challenge.facts.map((fact, index) => `<li>${escapeHtml(fact.text)} <span>${fact.known ? 'Grzegorz znał' : 'Grzegorz nie znał'}</span></li>`).join('');
  if (challenge.unknown >= 3) return `<section class="bonus-quest"><div class="task-label">Ciekawostki zaliczone</div><p>Grzegorz nie znał już trzech faktów.</p><ol class="science-facts">${facts}</ol></section>`;
  return `<section class="bonus-quest science-quest"><div class="task-label">Nieznane fakty · ${challenge.unknown}/3</div><label for="scienceFactInput">Opowiedz ciekawostkę naukową, a potem zapiszcie odpowiedź Grzegorza</label><textarea class="field" id="scienceFactInput" maxlength="240" placeholder="Wpisz krótką ciekawostkę"></textarea><div class="rps-buttons"><button class="btn" id="scienceKnown" disabled>Znał</button><button class="btn primary" id="scienceUnknown" disabled>Nie znał</button></div><ol class="science-facts">${facts}</ol></section>`;
}

function drawBilliards() {
  const challenge = state.billiards;
  if (challenge.done) return '<section class="bonus-quest"><strong>Cztery trafienia z rzędu — próba zaliczona!</strong></section>';
  return `<section class="bonus-quest"><div class="task-label">Bilard · ${challenge.streak}/4 trafienia z rzędu</div><p>Traf cztery razy z rzędu bilardową bilę do łuzy. Po pudle licznik wraca do zera.</p><div class="rps-buttons"><button class="btn primary" id="billiardsHit">Trafienie</button><button class="btn" id="billiardsMiss">Pudło</button></div></section>`;
}

function drawGymLift() {
  if (state.gymLift.done) return '<section class="bonus-quest"><strong>Dodatkowa próba siłowa zaliczona!</strong></section>';
  return `<section class="bonus-quest"><div class="task-label">Dodatkowy quest · próba siłowa</div><p>Po beer pongu idźcie wspólnie na siłownię. Janek podejmuje kontrolowaną próbę z ciężarem większym niż Kacper. Nie sprawdzajcie maksymalnego ciężaru; wybierzcie bezpieczne obciążenie, a jeśli nie ma warunków — lekki zamiennik ustalony z Kacprem.</p><label class="toast-confirm"><input type="checkbox" id="gymLiftCheck"> Próba bezpiecznie wykonana albo zamiennik uzgodniony</label><button class="btn" id="gymLiftComplete" disabled>Potwierdź próbę siłową</button></section>`;
}

function drawQuestionnaire() {
  const challenge = state.quizChallenge;
  if (challenge.baliaRequired && !challenge.baliaDone) return `<section class="bonus-quest"><div class="task-label">Dodatkowa próba · balia</div><p>Wskakuj do balii (jacuzzi), aby dokończyć próbę. Wchodź spokojnie, bez skakania. Jeśli balia nie jest dostępna lub bezpieczna, wybierzcie z Mistrzem Gry bezpieczny zamiennik.</p><label class="toast-confirm"><input type="checkbox" id="baliaCheck"> Próba w balii lub bezpieczny zamiennik wykonane</label><button class="btn" id="baliaComplete" disabled>Potwierdź i zalicz próbę</button></section>`;
  const passed = challenge.asked >= 5 && challenge.correct >= 3;
  if (passed || challenge.asked >= 5) return `<section class="bonus-quest"><div class="task-label">Quiz Grzegorza · ${challenge.correct}/3 poprawnych</div><p>${passed ? 'Trzy poprawne odpowiedzi — quiz zaliczony!' : 'Pięć pytań za Tobą. Uruchomiono dodatkową próbę z balią.'}</p></section>`;
  return `<section class="bonus-quest"><div class="task-label">Pytanie ${challenge.asked + 1}/5 · ${challenge.correct}/3 poprawnych · ${challenge.incorrect}/2 niepoprawnych</div><p>Grzegorz zadaje pytanie. Zaznaczcie wynik odpowiedzi Janka.</p><div class="rps-buttons"><button class="btn primary" id="quizCorrect">Poprawnie</button><button class="btn" id="quizIncorrect">Niepoprawnie</button></div></section>`;
}

function activeQuestHtml(quest, index) {
  const isFinal = quest.isFinal === true;
  const videoLink = quest.youtubeUrl
    ? `<a class="video-link" href="${escapeHtml(quest.youtubeUrl.replace(/^http:/, 'https:'))}" target="_blank" rel="noopener noreferrer">▶ Otwórz materiał na YouTube</a>`
    : '';
  const passwordGate = isFinal ? `<div class="password-gate">
    <label for="passwordInput">Hasło finału</label>
    <div class="answer-row"><input class="field" id="passwordInput" placeholder="Wpisz hasło finału" autocomplete="off"><button class="btn" id="checkPassword">Sprawdź hasło</button></div>
    <div class="status" id="passwordStatus" aria-live="polite">${state.finale ? '✦ Pieczęć pękła. Skarb czeka na odkrycie.' : 'Rozbij mroczną pieczęć właściwym hasłem.'}</div>
    ${state.finale ? '<div class="final-reveal"><strong>Pieczęć pękła. Popatrz, co skrywał skarbiec.</strong><img src="media/jankowy-skarb.png" alt="Janek odpoczywa pod biało-czerwoną flagą"><video class="final-song" id="finalSong" aria-label="Sto lat" playsinline preload="auto"><source src="media/sto-lat.mp4" type="video/mp4"></video><span class="hint">W tle gra „Sto lat”.</span></div>' : ''}
  </div>` : '';
  const bonus = quest.bonusQuest ? `<section class="bonus-quest"><div class="task-label">Quest poboczny · ${escapeHtml(quest.bonusQuest.title)}</div><p>${textBlock(quest.bonusQuest.description)}</p>${state.korneliaHint ? `<div class="revealed-hint"><strong>Wskazówka do finału</strong><span>${escapeHtml(quest.bonusQuest.hint)}</span></div><button class="btn" id="openHintVideo">Odtwórz filmik</button>` : `<button class="btn" id="revealHint">Ukończyliśmy próbę — pokaż wskazówkę</button>`}</section>` : '';
  const rps = quest.rpsChallenge ? drawRps() : '';
  const sideQuest = quest.gymLiftChallenge ? drawGymLift() : quest.sideQuest ? `<section class="bonus-quest"><div class="task-label">Dodatkowy quest</div><p>${textBlock(quest.sideQuest)}</p></section>` : '';
  const challenge = quest.charadesChallenge ? drawCharades() : quest.tongueTwisterChallenge ? drawTongueTwister() : quest.scienceTriviaChallenge ? drawScienceTrivia() : quest.billiardsChallenge ? drawBilliards() : quest.quizChallenge ? drawQuestionnaire() : '';
  const challengeReady = (!quest.charadesChallenge || state.charades.success) && (!quest.tongueTwisterChallenge || state.tongueTwister.success || state.tongueTwister.penalty) && (!quest.scienceTriviaChallenge || state.scienceTrivia.unknown >= 3) && (!quest.billiardsChallenge || state.billiards.done) && (!quest.gymLiftChallenge || state.gymLift.done) && (!quest.quizChallenge || (state.quizChallenge.baliaRequired ? state.quizChallenge.baliaDone : (state.quizChallenge.asked >= 5 && state.quizChallenge.correct >= 3)));
  const canComplete = (!isFinal || state.finale) && !quest.rpsChallenge && challengeReady;
  const completionButton = quest.rpsChallenge ? '' : `<button class="btn primary" id="completeQuest" ${canComplete ? '' : 'disabled'}>Wykonałem questa</button>`;
  const completionHint = isFinal && !state.finale ? 'Najpierw wpisz hasło finału.' : quest.charadesChallenge && !state.charades.success ? 'Vlada musi odgadnąć hasło przed upływem minuty.' : quest.tongueTwisterChallenge && !challengeReady ? 'Najpierw ukończ próbę łamańca.' : quest.billiardsChallenge && !challengeReady ? 'Najpierw traf cztery bile z rzędu.' : quest.gymLiftChallenge && !challengeReady ? 'Najpierw potwierdź dodatkową próbę siłową.' : quest.quizChallenge && !challengeReady ? 'Ukończ quiz albo dodatkową próbę z balią.' : '';
  return `<article class="quest active-quest ${quest.isMystery ? 'mystery' : ''} ${isFinal ? 'finale' : ''}">
    <div class="quest-num">Quest ${index + 1} z ${quests.length}${quest.isMystery ? ' · Tajemniczy NPC' : ''}</div>
    <img class="portrait" src="${escapeHtml(quest.portrait)}" alt="Portret: ${escapeHtml(quest.npcName)}" fetchpriority="high">
    <div class="npc-name">${escapeHtml(quest.npcName)}</div>
    <div class="npc-title">${escapeHtml(quest.npcTitle)}</div>
    <h3>${escapeHtml(quest.questTitle)}</h3>
    <p class="lore">${textBlock(quest.lore)}</p>
    <blockquote class="rhyme">${textBlock(quest.rhyme)}</blockquote>
    <div class="task-label">Twoje zadanie</div><p class="task">${textBlock(quest.task)}</p>${videoLink}${rps}${challenge}${sideQuest}${bonus}
    <div class="reward"><span>Nagroda</span><strong>${escapeHtml(quest.reward)}</strong></div>
    ${passwordGate}
    <div class="quest-foot"><span class="hint">${completionHint}</span>${completionButton}</div>
  </article>`;
}

function drawRps() {
  const wins = state.rps.janekWins;
  const losses = state.rps.dawidWins;
  const seriesLost = losses >= 3;
  const penalty = state.rps.pendingToast ? `<div class="rps-penalty"><strong>Janek przegrał BO5 ${state.rps.seriesLosses + 1}.</strong><p>Wznieście toast napojem według wyboru; może być też symboliczny łyk.</p><label><input type="checkbox" id="lossToastCheck"> Toast po przegranym BO5 wzniesiony</label><button class="btn" id="ackLossToast" disabled>Rozpocznij następne BO5</button></div>` : '';
  const controls = seriesLost
    ? '<div class="status">Dawid wygrał ten BO5 — wynik serii zapisany.</div>'
    : `<div class="rps-score">BO5 ${state.rps.seriesLosses + 1} · wynik rund ${wins} : ${losses} · każdy pojedynek kończy się przy 3 wygranych.</div><div class="rps-buttons"><button class="btn" id="janekRound">Janek wygrał rundę</button><button class="btn" id="dawidRound">Dawid wygrał rundę</button></div>`;
  return `<section class="rps-box"><div class="task-label">Zapis pojedynku BO5</div>${penalty}${state.rps.pendingToast ? '' : controls}</section>`;
}

function drawCharades() {
  clearInterval(charadesTimer);
  const challenge = state.charades;
  if (challenge.success) return '<div class="bonus-quest"><strong>Vlada odgadła hasło — próba zaliczona!</strong></div>';
  if (!challenge.startedAt) return `<section class="bonus-quest"><div class="task-label">Kalambury · limit 60 sekund</div><p>${challenge.expired ? 'Czas minął. Mistrz Gry może przekazać nowe hasło i rozpocząć kolejną próbę.' : 'Mistrz Gry przekazuje hasło Jankowi poza ekranem. Gdy będziecie gotowi, uruchomcie minutnik.'}</p><button class="btn" id="startCharades">${challenge.expired ? 'Nowa próba · 60 sekund' : 'Rozpocznij minutę'}</button></section>`;
  charadesTimer = setInterval(() => {
    const remaining = Math.max(0, Math.ceil(60 - (Date.now() - challenge.startedAt) / 1000));
    const timer = el('charadesTimer');
    if (timer) timer.textContent = `${remaining} s`;
    if (remaining <= 0) {
      clearInterval(charadesTimer); challenge.startedAt = null; challenge.expired = true; save(); render();
    }
  }, 250);
  return `<section class="bonus-quest"><div class="task-label">Pozostały czas</div><div class="charades-timer" id="charadesTimer">${Math.max(0, Math.ceil(60 - (Date.now() - challenge.startedAt) / 1000))} s</div><p>Pokazuj hasło bez mówienia i bez pisania.</p><button class="btn primary" id="vladaGuessed">Vlada odgadła hasło!</button></section>`;
}

function drawTongueTwister() {
  const challenge = state.tongueTwister;
  if (challenge.success) return '<div class="bonus-quest"><strong>Łamaniec wypowiedziany poprawnie — próba zaliczona!</strong></div>';
  if (challenge.penalty) return '<div class="bonus-quest"><strong>Konsekwencja po trzech próbach potwierdzona.</strong></div>';
  if (challenge.attempts >= 3) return `<section class="bonus-quest"><div class="task-label">Konsekwencja po 3 próbach</div><p>Wznieście toast wybranym napojem; może być symboliczny. Możesz przerwać lub pominąć napój.</p><label class="toast-confirm"><input type="checkbox" id="tonguePenaltyCheck"> Konsekwencja wykonana lub pominięta</label><button class="btn" id="confirmTonguePenalty" disabled>Potwierdź i zalicz próbę</button></section>`;
  return `<section class="bonus-quest"><div class="task-label">Próba ${challenge.attempts + 1} z 3</div><p>Poproś Kornelię o łamaniec, powiedz go na głos, a ona potwierdzi wynik.</p><div class="rps-buttons"><button class="btn primary" id="tongueSuccess">Udało się bezbłędnie</button><button class="btn" id="tongueMiss">Nie udało się — kolejna próba</button></div></section>`;
}

function toastScreen(quest, index) {
  return `<article class="quest active-quest toast-screen"><div class="quest-num">Quest ${index + 1} · Toast przed kolejną kartą</div>
    <img class="portrait" src="${escapeHtml(quest.portrait)}" alt="Portret: ${escapeHtml(quest.npcName)}">
    <div class="npc-name">Toast z ${escapeHtml(quest.npcName)}</div><h3>Wznieście toast, zanim wyruszysz dalej</h3>
    <p class="lore">Napisz krótkie, własne życzenia dla uczestnika questa. Potem wznieście toast wybranym napojem i potwierdźcie poniżej. Może być alkoholowy albo symboliczny — liczy się wspólny moment.</p>
    <label class="task-label" for="toastDraft">Twój toast</label><textarea class="field toast-draft" id="toastDraft" maxlength="240" placeholder="Za co wznosicie toast?">${escapeHtml(state.toastDraft)}</textarea>
    <label class="toast-confirm"><input type="checkbox" id="toastDoneCheck"> Wznieśliśmy toast</label>
    <button class="btn primary toast-continue" id="continueAfterToast" disabled>Toast wzniesiony — odkryj dalej</button>
  </article>`;
}

function drawQuests() {
  clearInterval(charadesTimer);
  const currentIndex = state.done.length;
  const completed = quests.slice(0, currentIndex).map((quest, index) => `<article class="quest done-compact">
    <img class="done-portrait" src="${escapeHtml(quest.portrait)}" alt=""><div class="quest-num">Quest ${index + 1} · Zaliczone</div>
    <div class="completed-name">${escapeHtml(quest.npcName)}</div><div class="completed-title">${escapeHtml(quest.questTitle)}</div>
  </article>`).join('');
  const activeQuest = quests[currentIndex];
  let active;
  if (!activeQuest) {
    const map = quests.map((quest, index) => `<div class="map-guest"><img src="${escapeHtml(quest.portrait)}" alt=""><span>${String(index + 1).padStart(2, '0')} · ${escapeHtml(quest.npcName)}</span></div>`).join('');
    active = `<article class="quest finale completed-finale"><div class="eyebrow">Kampania ukończona</div><h3>Skarb z najgłębszego skarbca czeka na odkrycie</h3><p>Wszystkie questy z Kronik Janka są zaliczone. Teraz odkryj sam, co kryje skarbiec.</p><div class="final-reveal"><img src="media/jankowy-skarb.png" alt="Janek odpoczywa pod biało-czerwoną flagą"><video class="final-song" id="finalSong" aria-label="Sto lat" playsinline preload="auto"><source src="media/sto-lat.mp4" type="video/mp4"></video><span class="hint">W tle gra „Sto lat”.</span></div><section class="final-map"><h4>Mapa wyprawy</h4><p>Wznieś toast ze wszystkimi i wygłoś mowę o swoich 30 latach życia.</p><div class="map-guests">${map}</div></section></article>`;
  } else if (state.pendingToast === activeQuest.id) {
    active = toastScreen(activeQuest, currentIndex);
  } else {
    active = activeQuestHtml(activeQuest, currentIndex);
  }
  el('questList').innerHTML = completed + active;

  const completeButton = el('completeQuest');
  if (completeButton) completeButton.onclick = () => {
    const quest = quests[state.done.length];
    if (!quest || quest.rpsChallenge || (quest.isFinal && !state.finale)
      || (quest.charadesChallenge && !state.charades.success)
      || (quest.tongueTwisterChallenge && !state.tongueTwister.success && !state.tongueTwister.penalty)
      || (quest.scienceTriviaChallenge && state.scienceTrivia.unknown < 3)
      || (quest.billiardsChallenge && !state.billiards.done)
      || (quest.gymLiftChallenge && !state.gymLift.done)
      || (quest.quizChallenge && (state.quizChallenge.baliaRequired ? !state.quizChallenge.baliaDone : (state.quizChallenge.asked < 5 || state.quizChallenge.correct < 3)))) return;
    state.pendingToast = quest.id; state.toastDraft = ''; save(); render();
    scrollToActiveQuest();
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
      save(); render();
      scrollToActiveQuest();
      if (state.done.length === quests.length) el('finalSong')?.play().catch(() => {});
      toast(state.done.length === quests.length ? 'Kampania ukończona!' : 'Toast wzniesiony — odkryto następny quest!');
    };
  }

  const passwordInput = el('passwordInput');
  if (passwordInput) {
    passwordInput.onkeydown = event => { if (event.key === 'Enter') el('checkPassword').click(); };
    el('checkPassword').onclick = () => {
      const normalized = passwordInput.value.toLocaleLowerCase('pl').normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]/g, '');
      const status = el('passwordStatus');
      if (normalized === 'sawannaafrykenska') {
        state.finale = true; save(); render(); playMusic(true);
        el('finalSong')?.play().catch(() => {});
        toast('Mroczna pieczęć pękła — fotografia skarbca odkryta!');
      } else {
        status.className = 'status error';
        status.textContent = 'To jeszcze nie to hasło. Spróbuj ponownie.';
      }
    };
  }

  const revealHint = el('revealHint');
  if (revealHint) revealHint.onclick = () => {
    state.korneliaHint = true; save(); render();
    showHintVideoDialog();
    toast('Filmik z podpowiedzią odblokowany');
  };
  const openHintButton = el('openHintVideo');
  if (openHintButton) openHintButton.onclick = showHintVideoDialog;
  if (el('closeHintVideo')) el('closeHintVideo').onclick = () => {
    el('hintVideo').pause(); el('hintVideoDialog').close();
  };

  if (el('startCharades')) el('startCharades').onclick = () => {
    state.charades.startedAt = Date.now(); state.charades.expired = false; save(); render();
  };
  if (el('vladaGuessed')) el('vladaGuessed').onclick = () => {
    if (!state.charades.startedAt || Date.now() - state.charades.startedAt > 60000) return;
    state.charades.success = true; state.charades.startedAt = null; save(); render();
    toast('Vlada odgadła — quest zaliczony!');
  };
  if (el('tongueSuccess')) el('tongueSuccess').onclick = () => {
    state.tongueTwister.success = true; save(); render(); toast('Łamaniec zaliczony!');
  };
  if (el('tongueMiss')) el('tongueMiss').onclick = () => {
    state.tongueTwister.attempts = Math.min(3, state.tongueTwister.attempts + 1); save(); render();
  };
  if (el('tonguePenaltyCheck')) el('tonguePenaltyCheck').onchange = () => {
    el('confirmTonguePenalty').disabled = !el('tonguePenaltyCheck').checked;
  };
  if (el('confirmTonguePenalty')) el('confirmTonguePenalty').onclick = () => {
    if (!el('tonguePenaltyCheck').checked) return;
    state.tongueTwister.penalty = true; save(); render(); toast('Próba zaliczona po konsekwencji');
  };

  const scienceInput = el('scienceFactInput');
  if (scienceInput) {
    const updateScienceButtons = () => {
      const disabled = !scienceInput.value.trim();
      el('scienceKnown').disabled = disabled;
      el('scienceUnknown').disabled = disabled;
    };
    scienceInput.oninput = updateScienceButtons;
    const recordFact = known => {
      const fact = scienceInput.value.trim();
      if (!fact) return;
      state.scienceTrivia.facts.push({ text: fact, known });
      state.scienceTrivia.total += 1;
      if (!known) state.scienceTrivia.unknown += 1;
      save(); render();
    };
    el('scienceKnown').onclick = () => recordFact(true);
    el('scienceUnknown').onclick = () => recordFact(false);
  }

  if (el('billiardsHit')) el('billiardsHit').onclick = () => {
    state.billiards.streak += 1;
    if (state.billiards.streak >= 4) state.billiards.done = true;
    save(); render();
    if (state.billiards.done) toast('Cztery trafienia z rzędu — zaliczone!');
  };
  if (el('billiardsMiss')) el('billiardsMiss').onclick = () => { state.billiards.streak = 0; save(); render(); };
  if (el('gymLiftCheck')) el('gymLiftCheck').onchange = () => { el('gymLiftComplete').disabled = !el('gymLiftCheck').checked; };
  if (el('gymLiftComplete')) el('gymLiftComplete').onclick = () => {
    if (!el('gymLiftCheck').checked) return;
    state.gymLift.done = true; save(); render(); toast('Dodatkowa próba siłowa zaliczona!');
  };
  const recordQuizAnswer = correct => {
    const challenge = state.quizChallenge;
    if (challenge.baliaRequired || challenge.asked >= 5) return;
    challenge.asked += 1;
    if (correct) challenge.correct += 1; else challenge.incorrect += 1;
    if (challenge.incorrect >= 2 || (challenge.asked >= 5 && challenge.correct < 3)) challenge.baliaRequired = true;
    save(); render();
    if (challenge.baliaRequired) toast('Odblokowano dodatkową próbę z balią');
  };
  if (el('quizCorrect')) el('quizCorrect').onclick = () => recordQuizAnswer(true);
  if (el('quizIncorrect')) el('quizIncorrect').onclick = () => recordQuizAnswer(false);
  if (el('baliaCheck')) el('baliaCheck').onchange = () => { el('baliaComplete').disabled = !el('baliaCheck').checked; };
  if (el('baliaComplete')) el('baliaComplete').onclick = () => {
    if (!el('baliaCheck').checked || !state.quizChallenge.baliaRequired) return;
    state.quizChallenge.baliaDone = true; save(); render(); toast('Próba z balią zaliczona!');
  };

  if (el('janekRound')) el('janekRound').onclick = () => recordRps('janek');
  if (el('dawidRound')) el('dawidRound').onclick = () => recordRps('dawid');
  if (el('lossToastCheck')) {
    el('lossToastCheck').onchange = () => { el('ackLossToast').disabled = !el('lossToastCheck').checked; };
    el('ackLossToast').onclick = () => {
      if (!el('lossToastCheck').checked) return;
      state.rps.pendingToast = false; state.rps.seriesLosses += 1;
      state.rps.janekWins = 0; state.rps.dawidWins = 0; save(); render();
    };
  }
}

function updateToastGate() {
  const field = el('toastDraft'); const check = el('toastDoneCheck'); const button = el('continueAfterToast');
  if (field && check && button) button.disabled = !field.value.trim() || !check.checked;
}
function recordRps(winner) {
  if (state.rps.pendingToast || state.rps.janekWins >= 3 || state.rps.dawidWins >= 3) return;
  if (winner === 'janek') {
    state.rps.janekWins += 1;
    if (state.rps.janekWins === 3) {
      const quest = quests[state.done.length];
      if (quest?.rpsChallenge) {
        state.pendingToast = quest.id;
        state.toastDraft = '';
        state.rps = { ...defaults().rps, totalLosses: state.rps.totalLosses, seriesLosses: state.rps.seriesLosses };
        save(); render();
        scrollToActiveQuest();
        toast('BO5 wygrane — wznosicie toast z Dawidem!');
        return;
      }
    }
  } else {
    state.rps.dawidWins += 1; state.rps.totalLosses += 1;
    if (state.rps.dawidWins === 3) state.rps.pendingToast = true;
  }
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

function drawArtifacts() {
  const artifacts = quests.slice(0, state.done.length).map(quest => quest.reward).filter(Boolean);
  el('artifactList').innerHTML = artifacts.map((item, index) => `<div class="artifact"><span>${String(index + 1).padStart(2, '0')}</span><strong>${escapeHtml(item)}</strong></div>`).join('')
    || '<p class="hint">Nagrody pojawią się tutaj po ukończeniu questów.</p>';
}

function drawJournal() {
  const field = el('journalInput');
  field.value = state.journalText;
  field.oninput = () => { state.journalText = field.value.slice(0, 5000); save(); el('journalStatus').textContent = 'Zapisano na tym urządzeniu.'; };
}

function render() {
  drawQuests(); drawCounters(); drawBag(); drawJournal(); drawArtifacts();
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
el('beginBtn').onclick = () => scrollToActiveQuest();
el('resetBtn').onclick = () => {
  if (!confirm('Zacząć od nowa? Postęp i ekwipunek zostaną wyczyszczone.')) return;
  state = defaults(); save(); render(); playMusic(false); toast('Nowy dziennik gotowy');
};

playMusic();
el('soundBtn').onclick = () => { playMusic(); toast('Odtwarzacz muzyki uruchomiony'); };

render();

