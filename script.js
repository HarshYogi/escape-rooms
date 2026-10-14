'use strict';
/* =====================================================================
   CRIMSON PROTOCOL: game logic
   1. CONFIG        2. SOUND         3. HELPERS / UI
   4. PUZZLE TOOLS  5. ROOMS (edit puzzles here)   6. GAME FLOW
   ===================================================================== */

/* ---------- 1. CONFIG ---------- */
const CONFIG = {
  // Get a free key at https://web3forms.com (enter your email, they send the key). Paste it here.
  WEB3FORMS_KEY: '5dc9077a-9f04-48f4-9a4c-c645fe7566c4',
  TOTAL_TIME: 12 * 60,   // seconds for all 3 rooms
  WRONG_PENALTY: 15,     // seconds lost per wrong answer / code
  HINT_COST: 60          // seconds lost per hint or revealed answer
};

/* ---------- 2. SOUND (all synthesised, no audio files) ---------- */
const sfx = (() => {
  let AC, M, E, A, muted = false, stopped = false;
  const g = v => { const n = AC.createGain(); n.gain.value = v; return n; };
  const nb = d => { const b = AC.createBuffer(1, Math.floor(AC.sampleRate * d), AC.sampleRate), a = b.getChannelData(0); for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1; return b; };
  function tone(fr, d, type, v, t, to, bus) {
    const o = AC.createOscillator(), e = AC.createGain(), n = AC.currentTime + (t || 0);
    o.type = type || 'sine'; o.frequency.setValueAtTime(fr, n);
    if (to) o.frequency.exponentialRampToValueAtTime(to, n + d);
    e.gain.setValueAtTime(.0001, n); e.gain.exponentialRampToValueAtTime(v, n + .02); e.gain.exponentialRampToValueAtTime(.0001, n + d);
    o.connect(e); e.connect(bus || M); o.start(n); o.stop(n + d + .05);
  }
  function noise(d, type, fr, v, t, bus, q) {
    const s = AC.createBufferSource(); s.buffer = nb(d);
    const f = AC.createBiquadFilter(); f.type = type; f.frequency.value = fr; f.Q.value = q || 1;
    const e = AC.createGain(), n = AC.currentTime + (t || 0);
    e.gain.setValueAtTime(v, n); e.gain.exponentialRampToValueAtTime(.0001, n + d);
    s.connect(f); f.connect(e); e.connect(bus || M); s.start(n);
  }
  function drone() {
    const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 200; f.Q.value = 4;
    [[55, 'sawtooth', .12], [55.8, 'sawtooth', .12], [82.5, 'sine', .3], [27.5, 'sine', .4]].forEach(([fr, t, v]) => {
      const o = AC.createOscillator(); o.type = t; o.frequency.value = fr; const x = g(v); o.connect(x); x.connect(f); o.start();
    });
    const l = AC.createOscillator(); l.frequency.value = .07; const lg = g(80); l.connect(lg); lg.connect(f.frequency); l.start();
    const out = g(.5); f.connect(out); out.connect(A);
  }
  function wind() {
    const s = AC.createBufferSource(); s.buffer = nb(3); s.loop = true;
    const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = .8;
    const l = AC.createOscillator(); l.frequency.value = .11; const lg = g(250); l.connect(lg); lg.connect(f.frequency); l.start();
    const v = g(.07); s.connect(f); f.connect(v); v.connect(A); s.start();
  }
  function groan() {
    const o = AC.createOscillator(), f = AC.createBiquadFilter(), e = AC.createGain(), n = AC.currentTime;
    o.type = 'sawtooth'; o.frequency.setValueAtTime(95, n); o.frequency.linearRampToValueAtTime(70, n + 1.2); o.frequency.linearRampToValueAtTime(48, n + 2.4);
    const v = AC.createOscillator(), vg = g(6); v.frequency.value = 5; v.connect(vg); vg.connect(o.frequency); v.start(n); v.stop(n + 2.6);
    f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 2.5;
    e.gain.setValueAtTime(.0001, n); e.gain.linearRampToValueAtTime(.22, n + .6); e.gain.linearRampToValueAtTime(.0001, n + 2.5);
    o.connect(f); f.connect(e); e.connect(E); e.connect(M); o.start(n); o.stop(n + 2.6);
  }
  function creak() {
    const o = AC.createOscillator(), f = AC.createBiquadFilter(), e = AC.createGain(), n = AC.currentTime;
    o.type = 'sawtooth'; o.frequency.setValueAtTime(180, n);
    for (let i = 1; i < 14; i++) o.frequency.linearRampToValueAtTime(140 + Math.random() * 160, n + i * .09);
    f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 6;
    e.gain.setValueAtTime(.0001, n); e.gain.linearRampToValueAtTime(.08, n + .3); e.gain.linearRampToValueAtTime(.0001, n + 1.3);
    o.connect(f); f.connect(e); e.connect(E); o.start(n); o.stop(n + 1.4);
  }
  const ev = [
    () => tone(1400, .12, 'sine', .12, 0, 600, E),                       // water drip
    groan, creak,
    () => tone(80, .5, 'sine', .3, 0, 30, E),                            // distant thump
    () => { noise(.15, 'bandpass', 2500, .15, 0, E, 2); noise(.1, 'bandpass', 3500, .1, .2, E, 2); }, // sparks
    groan
  ];
  function sched() {
    setTimeout(() => { if (stopped) return; if (AC.state === 'running') ev[Math.floor(Math.random() * ev.length)](); sched(); }, 4000 + Math.random() * 8000);
  }
  return {
    init() {
      if (AC) return;
      try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
      M = g(muted ? 0 : .9); M.connect(AC.destination);
      E = g(1); const dl = AC.createDelay(1); dl.delayTime.value = .38; const fb = g(.38), lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
      E.connect(M); E.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(M);
      A = g(0); A.connect(M); A.gain.setValueAtTime(0, AC.currentTime); A.gain.linearRampToValueAtTime(1, AC.currentTime + 5);
      drone(); wind(); sched();
      document.addEventListener('visibilitychange', () => { document.hidden ? AC.suspend() : AC.resume(); });
    },
    unlock() { if (!AC) return; noise(.06, 'highpass', 2500, .3); tone(140, .15, 'square', .1, .1, 70); noise(.08, 'bandpass', 900, .4, .12, M, 3); tone(660, .18, 'triangle', .18, .25); tone(990, .4, 'triangle', .18, .4); },
    door() {
      if (!AC) return;
      noise(1, 'highpass', 3500, .25, .1);
      const o = AC.createOscillator(), f = AC.createBiquadFilter(), e = AC.createGain(), n = AC.currentTime + .2;
      o.type = 'sawtooth'; o.frequency.setValueAtTime(45, n); o.frequency.linearRampToValueAtTime(30, n + 2);
      f.type = 'lowpass'; f.frequency.value = 260;
      e.gain.setValueAtTime(.0001, n); e.gain.linearRampToValueAtTime(.35, n + .4); e.gain.linearRampToValueAtTime(.0001, n + 2.1);
      o.connect(f); f.connect(e); e.connect(M); o.start(n); o.stop(n + 2.2);
      noise(1.8, 'bandpass', 300, .25, .2, M, 4); tone(60, .7, 'sine', .5, 2.1, 25, E);
    },
    deny() { if (!AC) return; tone(150, .25, 'square', .06, 0, 110); },
    beat() { if (!AC) return; tone(60, .18, 'sine', .35, 0, 35); tone(55, .18, 'sine', .25, .22, 32); },
    win() {
      if (!AC) return;
      [523, 659, 784, 1047].forEach((f, i) => tone(f, .8, 'triangle', .18, i * .18));
      const s = AC.createBufferSource(); s.buffer = nb(6); s.loop = true;
      const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
      const v = g(.25), l = AC.createOscillator(), lg = g(.25); l.frequency.value = 11; l.connect(lg); lg.connect(v.gain);
      const n = AC.currentTime + .8; v.gain.setValueAtTime(.0001, n);
      s.connect(f); f.connect(v); v.connect(M); s.start(n); l.start(n); s.stop(n + 6); l.stop(n + 6);
    },
    lose() { if (!AC) return; tone(110, 2.5, 'sawtooth', .25, 0, 30); noise(2.5, 'lowpass', 200, .5); for (let i = 0; i < 4; i++) tone(i % 2 ? 800 : 600, .4, 'square', .05, .3 + i * .5); },
    stopAmb() { if (!AC) return; stopped = true; A.gain.linearRampToValueAtTime(0, AC.currentTime + 2); },
    toggle() { muted = !muted; if (M) M.gain.value = muted ? 0 : .9; return muted; }
  };
})();

/* ---------- 3. HELPERS / UI ---------- */
const $ = s => document.querySelector(s);
const S = { room: 0, t: CONFIG.TOTAL_TIME, name: 'Agent', inv: [], clues: [], f: {}, rev: {}, hints: 0, wrong: 0, over: false };
let timer = null, sheetLocked = false;

const has = n => S.inv.includes(n);
const fmt = t => String(Math.floor(Math.max(t, 0) / 60)).padStart(2, '0') + ':' + String(Math.max(t, 0) % 60).padStart(2, '0');
const norm = s => String(s).toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim().replace(/^(a|an|the) /, '');
const paper = h => '<div class="paper">' + h + '</div>';

function toast(m) {
  const t = $('#toast'); t.textContent = m; t.style.display = 'block';
  clearTimeout(toast.h); toast.h = setTimeout(() => t.style.display = 'none', 2400);
}
function openSheet(title, html, build, lock) {
  sheetLocked = !!lock;
  $('#st').textContent = title; $('#sb').innerHTML = html || '';
  const x = $('#sx'); x.innerHTML = ''; if (build) build(x);
  $('#sdone').hidden = !!lock; $('#sheet').classList.add('on');
}
function closeSheet() { $('#sheet').classList.remove('on'); }

function clue(t) { if (!S.clues.includes(t)) { S.clues.push(t); $('#jcount').textContent = S.clues.length; } }
function item(n) { if (!has(n)) { S.inv.push(n); renderBag(); } }
function dropItem(n) { S.inv = S.inv.filter(x => x !== n); renderBag(); }
function renderBag() {
  $('#inv').innerHTML = S.inv.length ? S.inv.map(i => '<span class="chip">' + i + '</span>').join('') : '<span class="none">Empty</span>';
}
function updateTime() {
  const e = $('#time'); e.textContent = fmt(S.t); e.classList.toggle('low', S.t < 300);
}
function penalize() {
  S.wrong++; S.t -= CONFIG.WRONG_PENALTY; sfx.deny(); updateTime();
  if (S.t <= 0) lose();
}

/* ---------- 4. PUZZLE TOOLS ---------- */
// Text answer. `answers` = accepted answers (case/punctuation ignored).
function ask(el, answers, ok, ph) {
  const num = answers.every(a => /^\d+$/.test(a));
  el.innerHTML = '<div class="row"><input type="text" ' + (num ? 'inputmode="numeric" pattern="[0-9]*"' : '') + ' autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="done" placeholder="' + (ph || 'Your answer') + '" aria-label="Answer"><button class="btn">Submit</button></div><p class="msg" aria-live="polite"></p>';
  const i = el.querySelector('input'), m = el.querySelector('.msg');
  const go = () => {
    const v = norm(i.value); if (!v) return;
    if (answers.map(norm).includes(v)) {
      m.className = 'msg good'; m.textContent = 'Correct.'; sfx.unlock();
      setTimeout(() => { closeSheet(); ok(); }, 600);
    } else {
      m.className = 'msg bad'; m.textContent = 'Wrong. -' + CONFIG.WRONG_PENALTY + ' seconds.'; penalize(); i.select();
    }
  };
  el.querySelector('button').onclick = go;
  i.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
}
// Number pad
function keypad(el, code, ok) {
  let v = '';
  el.innerHTML = '<div class="disp"></div><div class="keys"></div><p class="msg" style="text-align:center" aria-live="polite"></p>';
  const d = el.querySelector('.disp'), m = el.querySelector('.msg'), k = el.querySelector('.keys');
  const show = () => d.textContent = v.padEnd(code.length, '_').split('').join(' ');
  show();
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'OK'].forEach(x => {
    const b = document.createElement('button'); b.textContent = x;
    b.onclick = () => {
      if (x === 'C') { v = ''; m.textContent = ''; }
      else if (x === 'OK') {
        if (v === code) { m.className = 'msg good'; m.textContent = 'Access granted'; sfx.unlock(); setTimeout(() => { closeSheet(); ok(); }, 600); }
        else { m.className = 'msg bad'; m.textContent = 'Access denied. -' + CONFIG.WRONG_PENALTY + ' seconds.'; penalize(); v = ''; }
      } else if (v.length < code.length) v += x;
      show();
    };
    k.appendChild(b);
  });
}
// Pick items in the right order. kind: 'vial' | 'switch'
function sequence(el, items, answer, ok, kind, okText) {
  let seq = [];
  el.innerHTML = '<div class="seq ' + kind + '"></div><p class="msg" aria-live="polite"></p><div class="row"><button class="btn ghost">Reset</button></div>';
  const wrap = el.querySelector('.seq'), m = el.querySelector('.msg');
  const draw = () => wrap.querySelectorAll('button').forEach(b => { const k = seq.indexOf(b.dataset.id); b.classList.toggle('sel', k > -1); b.dataset.n = k > -1 ? k + 1 : ''; });
  items.forEach(it => {
    const b = document.createElement('button');
    b.dataset.id = it.id; b.style.setProperty('--c', it.color); b.setAttribute('aria-label', it.id);
    if (kind === 'switch') b.textContent = it.id;
    b.onclick = () => {
      if (seq.includes(it.id)) return;
      seq.push(it.id); draw();
      if (seq.length === answer.length) {
        if (seq.join() === answer.join()) { m.className = 'msg good'; m.textContent = okText || 'Correct.'; sfx.unlock(); setTimeout(() => { closeSheet(); ok(); }, 700); }
        else { m.className = 'msg bad'; m.textContent = 'Wrong order. -' + CONFIG.WRONG_PENALTY + ' seconds.'; penalize(); seq = []; draw(); }
      }
    };
    wrap.appendChild(b);
  });
  el.querySelector('.ghost').onclick = () => { seq = []; draw(); };
}

/* ---------- 5. ROOMS ----------
   Every room is self-contained: bag, journal and flags (S.f) reset when a room starts.
   objs     : things to tap (x,y are % positions). done() draws the green tick.
   nudges   : [condition, text]. The first unmet condition is shown by "Nudge".
   reveals  : answers that can be bought with a hint. The exit door is never listed.  */
const ROOMS = [
  /* ===== ROOM 1: QUARANTINE LOBBY ===== */
  {
    title: 'Quarantine lobby',
    intro: 'You wake in the lobby of Sector 7. Emergency lights flicker. A sealed door leads deeper into the facility.',
    objs: [
      { id: 'locker', icon: '🗄️', label: 'Steel locker', x: 28, y: 17, done: () => S.f.locker, act() {
        if (S.f.locker) return openSheet('Steel locker', '<p>Empty now.</p>');
        openSheet('Steel locker', '<p>A voice-lock panel reads:</p>' + paper('I speak without a mouth<br>and hear without ears.<br>I have no body,<br>but I come alive with the wind.<br><b>What am I?</b>'),
          el => ask(el, ['echo'], () => { S.f.locker = 1; item('UV lamp'); clue('Found a UV lamp in the locker.'); toast('Got: UV lamp'); render(); }));
      } },
      { id: 'poster', icon: '☣️', label: 'Warning poster', x: 72, y: 27, done: () => S.f.uv, act() {
        if (!has('UV lamp') && !S.f.uv) return openSheet('Warning poster', '<p>"SECTOR 7 SEALED. DO NOT ENTER." Under the peeling paint you can see scratch marks, but it is too dark to read them.</p>');
        S.f.uv = 1; clue('Poster under UV light: "DESK DRAWER 7 2 9".'); render();
        openSheet('Warning poster', '<p>Your UV lamp reveals hidden handwriting under the paint:</p>' + paper('Desk drawer: <b>7 2 9</b><br>(Marcus, stop using the same code for everything.)'));
      } },
      { id: 'desk', icon: '🗃️', label: 'Reception desk', x: 28, y: 47, done: () => S.f.desk, act() {
        if (S.f.desk) return openSheet('Reception desk', paper('<b>Blackout log</b><br>Power failed the exact moment the wall clock stopped. It was the afternoon. The system logs time in 24 hour format.<br>- Sec. Marcus'));
        openSheet('Reception desk', '<p>A locked drawer. It needs a 3 digit code.</p>', el => keypad(el, '729', () => {
          S.f.desk = 1; item('Lab keycard'); clue('Desk memo: power died when the clock stopped, in the afternoon, 24 hour format.'); toast('Got: Lab keycard'); render();
          openSheet('Reception desk', '<p>Inside: a Lab keycard and a memo.</p>' + paper('<b>Blackout log</b><br>Power failed the exact moment the wall clock stopped. It was the afternoon. The system logs time in 24 hour format.<br>- Sec. Marcus'));
        }));
      } },
      { id: 'clock', icon: '🕰️', label: 'Stopped clock', x: 72, y: 57, done: () => S.f.clock, act() {
        S.f.clock = 1; clue('The lobby clock froze at 3:47.');
        openSheet('Wall clock', '<p>The hands are frozen at <b>3:47</b>. Dried blood runs down the glass.</p>'); render();
      } },
      { id: 'radio', icon: '📻', label: 'Old radio', x: 28, y: 77, done: () => S.f.radio, act() {
        S.f.radio = 1; clue('Radio static mumbled "4 1 3" before the line died.');
        openSheet('Old radio', '<p>Static. Then a trembling voice: "Unit 4 to base... the roof... four... one... three... do not open the..." A scream. Silence.</p>'); render();
      } },
      { id: 'door', icon: '🚪', label: 'Sealed door', x: 72, y: 87, done: () => S.f.gate, act() {
        if (S.f.gate) return;
        if (!has('Lab keycard')) return openSheet('Sealed door', '<p>The panel is dead. It needs a keycard to power up.</p>');
        openSheet('Sealed door', '<p>Keycard accepted. Enter the 4 digit code.</p>', el => keypad(el, '1547', () => { S.f.gate = 1; finishRoom(); }));
      } }
    ],
    nudges: [
      [() => has('UV lamp') || S.f.locker, 'The steel locker has a riddle. Think of something that repeats what you say.'],
      [() => S.f.uv, 'Walls hide secrets. Use your UV lamp on the poster.'],
      [() => S.f.desk, 'The desk drawer takes a 3 digit code. You have seen it somewhere.'],
      [() => S.f.clock, 'Look at the clock on the wall.'],
      [() => false, 'The door needs a time. The clock face is only half the story. Read the memo again.']
    ],
    reveals: [
      { id: 'locker', label: 'Locker riddle', ans: 'echo', done: () => S.f.locker },
      { id: 'desk', label: 'Desk drawer code', ans: '729', done: () => S.f.desk }
    ]
  },

  /* ===== ROOM 2: GENETICS LAB ===== */
  {
    title: 'Genetics lab',
    intro: 'The airlock hisses open. Rows of cracked tanks glow green. This is where Helix built the Crimson Strain, and where Dr. Hale tried to stop it.',
    objs: [
      { id: 'book', icon: '📓', label: 'Lab notebook', x: 28, y: 17, done: () => S.f.book, act() {
        S.f.book = 1; clue('Antidote order: the colour of rot, spilled blood, the sky before a storm, then a warning light.'); render();
        openSheet('Lab notebook', paper('<b>Antidote recipe</b><br>First, the colour of <b>rot</b>.<br>Then, <b>spilled blood</b>.<br>Then, the <b>sky before a storm</b>.<br>Last, a <b>warning light</b>.<br>Any other order is lethal.'));
      } },
      { id: 'board', icon: '📝', label: 'Whiteboard', x: 72, y: 27, done: () => S.f.board, act() {
        S.f.board = 1; clue('Whiteboard: "Dr. KDOH knew the way out." Letters shifted forward by 3.'); render();
        openSheet('Whiteboard', paper('Dr. <b>K D O H</b> knew the way out.<br><br>Caesar always moved forward.<br>A to D, B to E, C to F...'));
      } },
      { id: 'vials', icon: '🧪', label: 'Vial rack', x: 28, y: 47, done: () => has('Antidote') || S.f.cured, act() {
        if (has('Antidote') || S.f.cured) return openSheet('Vial rack', '<p>The rack is empty.</p>');
        openSheet('Vial rack', '<p>Five vials. Tap them in the right order.</p>', el => sequence(el,
          [{ id: 'red', color: '#d63a3a' }, { id: 'grey', color: '#8a9a9e' }, { id: 'purple', color: '#8f4fd0' }, { id: 'yellow', color: '#e8c43a' }, { id: 'green', color: '#4fbf5a' }],
          ['green', 'red', 'grey', 'yellow'], () => { item('Antidote'); clue('Brewed the antidote.'); toast('Got: Antidote'); render(); }, 'vial', 'The mix turns clear. Antidote made.'));
      } },
      { id: 'term', icon: '💻', label: 'Dr. Hale\u2019s terminal', x: 72, y: 57, done: () => S.f.term, act() {
        const msg = '<p>"I tried to stop it. The vault door code has four digits. The first two are <b>17</b>. The last two... my assistant knows them, if there is anything left of him."</p>';
        if (S.f.term) return openSheet('Terminal', msg);
        openSheet('Terminal', '<p>User: <b>Dr. Hale</b><br>Enter the password (a surname).</p>', el => ask(el, ['hale', 'dr hale'], () => {
          S.f.term = 1; clue('Terminal: the door code starts with 17. The assistant knows the last two digits.'); toast('Terminal unlocked'); render(); openSheet('Terminal', msg);
        }, 'Password'));
      } },
      { id: 'assistant', icon: '🧟', label: 'Infected assistant', x: 28, y: 77, done: () => S.f.cured, act() {
        if (S.f.cured) return openSheet('Assistant', '<p>He sits quietly, himself again.</p>');
        if (!has('Antidote')) return openSheet('Infected assistant', '<p>Chained to a pipe, he lunges at you, groaning. Something in his eyes is still human. You need a cure.</p>');
        openSheet('Infected assistant', '<p>Use the antidote on him?</p>', el => {
          el.innerHTML = '<div class="row"><button class="btn wide">Use antidote</button></div>';
          el.querySelector('button').onclick = () => {
            S.f.cured = 1; dropItem('Antidote'); clue('The assistant said the last two digits are 42.'); sfx.unlock(); closeSheet(); render();
            openSheet('The assistant', paper('"Hale... locked the door. The code ends in <b>4 2</b>. The answer to everything, he used to joke. Go. Please."'));
          };
        });
      } },
      { id: 'door', icon: '🚪', label: 'Vault door', x: 72, y: 87, done: () => S.f.gate, act() {
        if (S.f.gate) return;
        openSheet('Vault door', '<p>A 4 digit code protects the way out.</p>', el => keypad(el, '1742', () => { S.f.gate = 1; finishRoom(); }));
      } }
    ],
    nudges: [
      [() => S.f.book, 'Read the notebook on the bench.'],
      [() => has('Antidote') || S.f.cured, 'The vial rack has five vials but the notebook names only four colours. Follow its order.'],
      [() => S.f.board, 'The whiteboard has a scrambled name.'],
      [() => S.f.term, 'Shift each letter back by 3 (K becomes H). Use the name on the terminal.'],
      [() => S.f.cured, 'The chained assistant may be curable.'],
      [() => false, 'The vault code: two digits from the terminal, two from the cured assistant.']
    ],
    reveals: [
      { id: 'vials', label: 'Vial order', ans: 'Green, Red, Grey, Yellow', done: () => has('Antidote') || S.f.cured },
      { id: 'term', label: 'Terminal password', ans: 'HALE', done: () => S.f.term }
    ]
  },

  /* ===== ROOM 3: HANGAR BAY ===== */
  {
    title: 'Hangar bay',
    intro: 'The last airlock opens onto the hangar. The helicopter waits in the dark behind a dead gate. Whatever Helix did here, it left in a hurry.',
    objs: [
      { id: 'manual', icon: '📘', label: 'Maintenance manual', x: 28, y: 17, done: () => S.f.manual, act() {
        S.f.manual = 1; clue('Manual: restart order has Green first, Yellow last, and Red before Blue.'); render();
        openSheet('Maintenance manual', paper('<b>Generator restart</b><br>Four switches: Blue, Yellow, Green, Red.<br>Flip <b>Green</b> first.<br>Flip <b>Yellow</b> last.<br><b>Red</b> must be flipped before <b>Blue</b>.'));
      } },
      { id: 'panel', icon: '⚡', label: 'Power panel', x: 72, y: 27, done: () => S.f.panel, act() {
        if (S.f.panel) return openSheet('Power panel', '<p>Access granted. The fuse box is unlocked.</p>');
        openSheet('Power panel', '<p>Locked. A riddle scrolls across the screen:</p>' + paper('The more of me you take,<br>the more you leave behind.<br><b>What am I?</b>'),
          el => ask(el, ['footsteps', 'footstep', 'steps', 'your footsteps'], () => { S.f.panel = 1; clue('The power panel unlocked the fuse box.'); toast('Fuse box unlocked'); render(); }));
      } },
      { id: 'fuse', icon: '🔌', label: 'Fuse box', x: 28, y: 47, done: () => S.f.power, act() {
        if (S.f.power) return openSheet('Fuse box', '<p>The generator hums. Power is on.</p>');
        if (!S.f.panel) return openSheet('Fuse box', '<p>The box is locked by the power panel.</p>');
        openSheet('Fuse box', '<p>Flip the four switches in the correct order.</p>', el => sequence(el,
          [{ id: 'Blue', color: '#3a7bd6' }, { id: 'Yellow', color: '#e8c43a' }, { id: 'Red', color: '#d63a3a' }, { id: 'Green', color: '#4fbf5a' }],
          ['Green', 'Red', 'Blue', 'Yellow'], () => { S.f.power = 1; clue('Generator running. The gate has power.'); toast('Power restored'); render(); }, 'switch', 'The generator roars to life.'));
      } },
      { id: 'log', icon: '📒', label: 'Flight log', x: 72, y: 57, done: () => S.f.log, act() {
        if (S.f.log) return openSheet('Flight log', paper('Gate code, <b>first two digits: 32</b>'));
        openSheet('Flight log', '<p>Fuel burned per leg, scribbled by the pilot. The last entry is torn.</p>' + paper('2 &nbsp; 4 &nbsp; 8 &nbsp; 16 &nbsp; <b>?</b><br><br>"Enter the next number to unlock the page."'),
          el => ask(el, ['32'], () => { S.f.log = 1; clue('Flight log: gate code, first two digits 32.'); render(); openSheet('Flight log', paper('Gate code, <b>first two digits: 32</b>')); }, 'Next number'));
      } },
      { id: 'crate', icon: '📦', label: 'Cargo crate', x: 28, y: 77, done: () => S.f.crate, act() {
        if (S.f.crate) return openSheet('Cargo crate', paper('Gate code, <b>last two digits: 36</b>'));
        openSheet('Cargo crate', '<p>A number lock with a note taped to it:</p>' + paper('I am a two digit number.<br>My digits add up to 9.<br>Reverse my digits and the new number is 27 bigger than me.<br><b>What am I?</b>'),
          el => ask(el, ['36'], () => { S.f.crate = 1; clue('Cargo crate: gate code, last two digits 36.'); render(); openSheet('Cargo crate', paper('Gate code, <b>last two digits: 36</b>')); }, 'Two digit number'));
      } },
      { id: 'gate', icon: '🚁', label: 'Extraction gate', x: 72, y: 87, done: () => S.f.gate, act() {
        if (S.f.gate) return;
        if (!S.f.power) return openSheet('Extraction gate', '<p>No power. The gate is dead.</p>');
        openSheet('Extraction gate', '<p>Enter the 4 digit launch code.</p>', el => keypad(el, '3236', () => { S.f.gate = 1; finishRoom(); }));
      } }
    ],
    nudges: [
      [() => S.f.manual, 'The maintenance manual explains the generator.'],
      [() => S.f.panel, 'The power panel asks a riddle about something you leave behind as you walk.'],
      [() => S.f.power, 'Use the manual order on the fuse box.'],
      [() => S.f.log, 'The flight log is a number sequence. Each number doubles.'],
      [() => S.f.crate, 'The crate: try two digit numbers whose digits add to 9.'],
      [() => false, 'The launch code is the flight log digits followed by the crate digits.']
    ],
    reveals: [
      { id: 'panel', label: 'Power panel riddle', ans: 'Footsteps', done: () => S.f.panel },
      { id: 'fuse', label: 'Fuse order', ans: 'Green, Red, Blue, Yellow', done: () => S.f.power },
      { id: 'log', label: 'Flight log number', ans: '32', done: () => S.f.log },
      { id: 'crate', label: 'Cargo crate number', ans: '36', done: () => S.f.crate }
    ]
  }
];

/* ---------- 6. GAME FLOW ---------- */
function render() {
  const r = ROOMS[S.room], sc = $('#scene');
  $('#rname').textContent = 'Room ' + (S.room + 1) + ' of ' + ROOMS.length + ': ' + r.title;
  sc.dataset.room = S.room; sc.innerHTML = '';
  r.objs.forEach(o => {
    const b = document.createElement('button');
    b.className = 'obj' + (o.done() ? ' done' : '');
    b.style.left = o.x + '%'; b.style.top = o.y + '%';
    b.innerHTML = '<span class="i">' + o.icon + '</span><span class="l">' + o.label + '</span>';
    b.onclick = () => o.act();
    sc.appendChild(b);
  });
}

function startRoom() {           // clears everything so nothing carries over
  S.inv = []; S.clues = []; S.f = {};
  $('#jcount').textContent = 0; renderBag(); render();
}

function finishRoom() {          // called when a room's exit door opens
  sfx.door();
  if (S.room >= ROOMS.length - 1) { setTimeout(finale, 1900); return; }
  setTimeout(() => {
    const next = ROOMS[S.room + 1];
    openSheet('Airlock', '<p class="story">' + next.intro + '</p><p class="note">Decontamination strips your pockets. Your bag and journal stay behind.</p>', el => {
      el.innerHTML = '<button class="btn wide">Enter ' + next.title + '</button>';
      el.querySelector('button').onclick = () => { closeSheet(); S.room++; startRoom(); };
    }, true);
  }, 1900);
}

function openJournal() {
  openSheet('Journal', S.clues.length ? '<ol class="clues">' + S.clues.map(c => '<li>' + c + '</li>').join('') + '</ol>' : '<p class="note">Nothing yet. Tap things in the room to find clues.</p>');
}

function openHints() {
  const r = ROOMS[S.room];
  const opts = [{ key: 'nudge', label: 'Nudge: what should I try next?', text: () => { const n = r.nudges.find(n => !n[0]()); return n ? n[1] : 'You have what you need. Combine your clues.'; } }]
    .concat(r.reveals.filter(v => !v.done()).map(v => ({ key: v.id, label: 'Show answer: ' + v.label, text: () => 'Answer: ' + v.ans })));
  openSheet('Need a hand?', '<p class="note">Every option costs 1 minute. The exit door code is never shown.</p>', x => {
    opts.forEach(o => {
      const id = S.room + ':' + o.key;
      const w = document.createElement('div'); w.className = 'opt';
      const b = document.createElement('button'); b.className = 'optbtn'; b.innerHTML = '<span>' + o.label + '</span><em>-1 min</em>';
      const out = document.createElement('p'); out.className = 'reveal';
      const show = () => { out.textContent = o.text(); out.style.display = 'block'; };
      if (o.key !== 'nudge' && S.rev[id]) { show(); b.querySelector('em').textContent = 'shown'; }
      b.onclick = () => {
        if (o.key === 'nudge' || !S.rev[id]) {
          S.rev[id] = 1; S.hints++; S.t = Math.max(S.t - CONFIG.HINT_COST, 1); updateTime();
          if (o.key !== 'nudge') b.querySelector('em').textContent = 'shown';
        }
        show();
      };
      w.append(b, out); x.appendChild(w);
    });
  });
}

/* ----- Endings ----- */
function stopGame() { S.over = true; clearInterval(timer); sfx.stopAmb(); closeSheet(); $('#game').hidden = true; $('#end').hidden = false; }
function stats() {
  return '<div class="stats"><div class="stat"><b>' + fmt(S.t) + '</b><span>Time left</span></div><div class="stat"><b>' + S.hints + '</b><span>Hints used</span></div><div class="stat"><b>' + S.wrong + '</b><span>Wrong tries</span></div></div>';
}
function lose() {
  if (S.over) return; sfx.lose(); stopGame();
  $('#end').innerHTML = '<h1 class="lose">Incinerated</h1><p class="story">The countdown reaches zero. The vents roar. The sector burns, and so do all its secrets.</p><p>Try again, ' + S.name + '. You can do better.</p><button class="btn wide" onclick="location.reload()">Play again</button>';
}
function finale() {
  if (S.over) return; sfx.win(); stopGame();
  const end = $('#end');
  end.innerHTML = '<h1 class="win">Escaped</h1>' +
    '<p class="story">The gate screams open. You sprint across the hangar as the first charges ignite behind you. The helicopter lifts off, and Ravenwood vanishes in a bloom of fire. Dr. Hale\u2019s last words ring in your ears.</p>' +
    '<p>Well done, ' + S.name + '.</p>' + stats() +
    '<h2 style="margin:26px 0 6px">Are you ready for round two?</h2>' +
    '<p class="note">Helix never told us how many other sectors there are...</p>' +
    '<div class="row col" id="choices"><button class="btn" data-a="Yes, I am ready">Yes, I\u2019m ready</button><button class="btn ghost" data-a="Not yet">Not yet</button></div>' +
    '<div id="reply"></div>';
  end.querySelectorAll('#choices button').forEach(b => b.onclick = () => answerRound2(b.dataset.a));
}
async function sendAnswer(answer) {
  if (CONFIG.WEB3FORMS_KEY.startsWith('YOUR_')) { console.warn('Add your Web3Forms access key in script.js'); return { ok: false, nokey: true }; }
  try {
    const res = await fetch('https://api.web3forms.com/submit', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        access_key: CONFIG.WEB3FORMS_KEY,
        subject: 'Crimson Protocol: ' + S.name + ' answered "' + answer + '"',
        from_name: 'Crimson Protocol', name: S.name, answer: answer,
        time_left: fmt(S.t), hints_used: S.hints, wrong_attempts: S.wrong,
        message: S.name + ' finished round one with ' + fmt(S.t) + ' left, ' + S.hints + ' hints and ' + S.wrong + ' wrong tries. Round two answer: ' + answer
      })
    });
    const j = await res.json(); return { ok: !!j.success };
  } catch (e) { return { ok: false }; }
}
async function answerRound2(answer) {
  const box = $('#reply'), yes = answer.startsWith('Yes');
  $('#choices').hidden = true;
  box.innerHTML = '<p class="note">Sending your answer...</p>';
  const r = await sendAnswer(answer);
  const main = yes
    ? '<h2 class="type" style="color:var(--amber);margin:10px 0">Round two is coming soon...</h2><p>Stay sharp, ' + S.name + '. The next sector is already waking up.</p>'
    : '<h2 class="type" style="color:var(--amber);margin:10px 0">Take your time.</h2><p>The sector will wait for you.</p>';
  box.innerHTML = main;
  const rt = $('#retry'); if (rt) rt.onclick = () => answerRound2(answer);
}

/* ----- Wiring ----- */
function tick() {
  S.t--; updateTime();
  if (S.t < 300 && S.t > 0) sfx.beat();
  if (S.t <= 0) lose();
}
$('#go').onclick = () => {
  sfx.init(); S.name = $('#nm').value.trim() || 'Agent';
  $('#intro').hidden = true; $('#game').hidden = false;
  updateTime(); startRoom(); timer = setInterval(tick, 1000);
  openSheet('Room 1', '<p class="story">' + ROOMS[0].intro + '</p><p class="note">Tap objects to investigate. Your bag and journal reset in every room.</p>', el => {
    el.innerHTML = '<button class="btn wide">Start searching</button>'; el.querySelector('button').onclick = closeSheet;
  }, true);
};
$('#nm').addEventListener('keydown', e => { if (e.key === 'Enter') $('#go').click(); });
$('#jbtn').onclick = openJournal;
$('#hbtn').onclick = openHints;
$('#sdone').onclick = closeSheet;
$('#sheet').addEventListener('click', e => { if (e.target.id === 'sheet' && !sheetLocked) closeSheet(); });
$('#mute').onclick = () => { $('#mute').textContent = sfx.toggle() ? '🔇' : '🔊'; };

// Keep the bottom sheet above the iPhone keyboard
if (window.visualViewport) {
  const vv = window.visualViewport;
  const fit = () => document.documentElement.style.setProperty('--kb', Math.max(0, window.innerHeight - vv.height - vv.offsetTop) + 'px');
  vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit);
}
