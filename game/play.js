// Mission player: renders one step (a list of items) with instant feedback, then reports answers to the server.
import { itemErrors, clozeMarks } from './content/grade.js?v=20261122h';
import { MECH } from './data.js?v=20261122h';

const RM = matchMedia('(prefers-reduced-motion: reduce)');
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else if (k === 'html') n.innerHTML = v; else n.setAttribute(k, v === true ? '' : v); }
  for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(c));
  return n;
};
const ico = (id, cls = '') => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('class', 'ic ' + cls); s.setAttribute('aria-hidden', 'true'); s.innerHTML = `<use href="#i-${id}"/>`; return s; };
const wait = ms => new Promise(r => setTimeout(r, RM.matches ? Math.min(ms, 120) : ms));
const shuffle = n => { const a = [...Array(n).keys()]; for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---- short sounds (Web Audio, no files) ----
let actx = null;
export const sound = { get on() { return localStorage.getItem('game-sound') !== 'off'; }, set on(v) { localStorage.setItem('game-sound', v ? 'on' : 'off'); } };
function beep(ok) {
  if (!sound.on) return;
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    const t = actx.currentTime, g = actx.createGain(); g.connect(actx.destination);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + (ok ? 0.26 : 0.3));
    const notes = ok ? [660, 990] : [220, 180];
    notes.forEach((f, i) => { const o = actx.createOscillator(); o.type = ok ? 'triangle' : 'sine'; o.frequency.setValueAtTime(f, t + i * 0.09); o.connect(g); o.start(t + i * 0.09); o.stop(t + 0.3); });
  } catch {}
}
// reward chimes: bell-like note (sine + soft overtone), rising per star
export function chime(freqs, gap = 0.07, vol = 0.11) {
  if (!sound.on) return;
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    const t0 = actx.currentTime + 0.01;
    freqs.forEach((f, i) => {
      const t = t0 + i * gap, g = actx.createGain(); g.connect(actx.destination);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
      [[f, 'sine', 1], [f * 2, 'triangle', 0.25], [f * 3.01, 'sine', 0.08]].forEach(([fr, ty, a]) => {
        const o = actx.createOscillator(), og = actx.createGain(); o.type = ty; o.frequency.setValueAtTime(fr, t); og.gain.value = a; o.connect(og); og.connect(g); o.start(t); o.stop(t + 0.75);
      });
    });
  } catch {}
}
// soft UI sounds: tiny, short, all behind the same mute toggle
function tone(f, dur, vol, type = 'sine', f2) {
  if (!sound.on) return;
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume();
    const t = actx.currentTime + 0.005, g = actx.createGain(), o = actx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + dur + 0.02);
  } catch {}
}
let lastTick = 0;
export const sfx = {
  tick() { const n = performance.now(); if (n - lastTick < 45) return; lastTick = n; tone(1320, 0.045, 0.035, 'sine', 990); },
  page() { // paper swish: short filtered noise
    if (!sound.on) return;
    try {
      actx ||= new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume();
      const t = actx.currentTime + 0.005, len = 0.16, buf = actx.createBuffer(1, Math.floor(actx.sampleRate * len), actx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const src = actx.createBufferSource(), bp = actx.createBiquadFilter(), g = actx.createGain(); src.buffer = buf; bp.type = 'bandpass'; bp.Q.value = 0.8;
      bp.frequency.setValueAtTime(1800, t); bp.frequency.exponentialRampToValueAtTime(4200, t + len);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      src.connect(bp); bp.connect(g); g.connect(actx.destination); src.start(t); src.stop(t + len);
    } catch {}
  },
  unlock() { chime([659.25, 987.77], 0.09, 0.07); },
  badge() { chime([783.99, 1046.5, 1318.5, 1568], 0.07, 0.075); },
};
// helpers shared by screens: stagger the children in, replay a one-shot class
export function stagger(parent, sel = ':scope > *', step = 45, max = 10) { if (!parent) return; [...parent.querySelectorAll(sel)].forEach((n, i) => n.style.setProperty('--i', Math.min(i, max))); }
export function replay(node, cls) { if (!node) return; node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); }
const vibrate = ok => { try { if (!ok && navigator.vibrate) navigator.vibrate(30); } catch {} };

export function playStep({ op, n, step, api, onDone, onClose, toast, submit, label }) {
  const root = document.getElementById('play');
  const items = step.items; const answers = Array(items.length).fill(null);
  const UNGRADED = ['brief', 'field', 'storm']; const graded = items.filter(it => !UNGRADED.includes(it.type)).length || 1;
  let idx = 0, doneCount = 0, closed = false;
  const bar = el('i'); const prog = el('div', { class: 'pbar', role: 'progressbar', 'aria-label': 'Прогресс шага', 'aria-valuemin': 0, 'aria-valuemax': graded }, bar);
  const sndBtn = el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Звук', 'aria-pressed': String(sound.on), onclick: () => { sound.on = !sound.on; sndBtn.setAttribute('aria-pressed', String(sound.on)); sndBtn.classList.toggle('off', !sound.on); } }, ico('sound'));
  sndBtn.classList.toggle('off', !sound.on);
  const head = el('header', { class: 'play-h' },
    el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Выйти на карту', onclick: () => close() }, ico('x')),
    el('div', { class: 'play-meta' }, el('span', { class: 'play-k' }, label ? label : op ? `Операция ${op} · шаг ${n} из 10 · ${MECH[step.m]}` : `Тренировка дня · ${items.length} заданий`), prog), sndBtn);
  const body = el('main', { class: 'play-b' });
  const foot = el('footer', { class: 'play-f' });
  root.replaceChildren(head, body, foot); root.hidden = false; document.body.classList.add('playing'); replay(root, 'opening');
  root.focus?.();
  const setProg = () => { bar.style.setProperty('--p', Math.min(1, doneCount / graded)); prog.setAttribute('aria-valuenow', doneCount); };
  setProg();
  function close() { if (closed) return; closed = true; document.removeEventListener('keydown', onKey); root.hidden = true; root.replaceChildren(); document.body.classList.remove('playing'); onClose?.(); }
  const ctl = {
    body, foot, toast, api, step, op, n,
    // shows the feedback sheet and resolves when the student taps «Дальше»
    feedback(ok, title, why, extra) {
      beep(ok); vibrate(ok);
      return new Promise(res => {
        const btn = el('button', { class: 'cta cta-sm', type: 'button', onclick: () => res() }, 'Дальше');
        const fb = el('div', { class: 'fb ' + (ok ? 'fb-ok' : 'fb-bad'), role: 'status' },
          el('div', { class: 'fb-t' }, el('span', { class: 'fb-ic' }, ico(ok ? 'check' : 'x')), title || (ok ? 'Точно!' : 'Мимо')),
          why ? el('p', {}, why) : null, extra || null, btn);
        foot.replaceChildren(fb); requestAnimationFrame(() => fb.classList.add('in')); btn.focus({ preventScroll: true });
      });
    },
    async answer(value, { silent } = {}) {
      answers[idx] = value; const it = items[idx];
      if (!UNGRADED.includes(it.type)) { doneCount++; setProg(); }
      if (!silent) {}
      idx++; next();
    },
  };
  async function next() {
    if (closed) return;
    foot.replaceChildren(); body.scrollTop = 0; window.scrollTo(0, 0);
    if (idx >= items.length) return finish();
    const it = items[idx];
    const keep = it.type === 'chat' && items[idx - 1]?.type === 'chat';
    if (!keep) body.replaceChildren(); body.className = 'play-b play-' + it.type;
    let run; try { run = R[it.type](it, ctl); } catch (e) { run = Promise.reject(e); }
    if (!keep) { stagger(body); const my = idx; body.classList.add('step-in'); setTimeout(() => { if (idx === my) body.classList.remove('step-in'); }, 900); }
    try { await run; } catch (e) { console.error(e); toast?.('Что-то пошло не так, попробуйте ещё раз'); }
  }
  async function finish() {
    body.replaceChildren(el('div', { class: 'play-wait' }, el('span', { class: 'spin', 'aria-hidden': 'true' }), 'Штаб проверяет ответы…'));
    try {
      const r = submit ? await submit(answers) : await api('/api/game/finish', { method: 'POST', body: { op, step: n, answers, tz: Intl.DateTimeFormat().resolvedOptions().timeZone } });
      closed = true; document.removeEventListener('keydown', onKey); root.hidden = true; root.replaceChildren(); document.body.classList.remove('playing');
      onDone?.(r);
    } catch (e) {
      body.replaceChildren(el('div', { class: 'play-wait' }, el('p', {}, e.message), el('button', { class: 'cta cta-sm', type: 'button', onclick: finish }, 'Отправить ещё раз')));
    }
  }
  const onKey = e => { if (e.key === 'Escape' && !root.hidden) close(); };
  document.addEventListener('keydown', onKey, { once: false });
  // a soft tick on every choice inside the task (not on navigation or «Проверить»)
  body.addEventListener('pointerdown', e => { const b = e.target.closest('button, [role=button], label'); if (b && !b.disabled && !b.closest('.fb') && !b.classList.contains('cta')) sfx.tick(); });
  next();
  return { close };
}

// ---------- mechanics ----------
const R = {};
const optionBtn = (text, i, onPick) => el('button', { class: 'opt', type: 'button', 'data-i': i, onclick: e => onPick(i, e.currentTarget) }, el('span', { class: 'opt-t' }, text));
const lockAll = box => box.querySelectorAll('button').forEach(b => { b.disabled = true; });

R.quiz = (it, c) => new Promise(done => {
  const order = shuffle(it.options.length);
  const box = el('div', { class: 'opts' }, order.map(i => optionBtn(it.options[i], i, pick)));
  c.body.append(el('h2', { class: 'q' }, it.q), box);
  async function pick(i, b) {
    lockAll(box); const ok = i === it.correct; b.classList.add(ok ? 'ok' : 'bad');
    if (!ok) box.querySelector(`[data-i="${it.correct}"]`).classList.add('ok');
    await c.feedback(ok, ok ? 'Точно!' : 'Не совсем', it.why); c.answer(i); done();
  }
});

R.swipe = (it, c) => new Promise(done => {
  const card = el('div', { class: 'swipe-card', tabindex: 0, 'aria-label': 'Утверждение: ' + it.text }, el('span', { class: 'swipe-stamp', 'aria-hidden': 'true' }), el('p', {}, it.text));
  const no = el('button', { class: 'sw-btn sw-no', type: 'button', onclick: () => pick(false) }, ico('x'), 'Дезинформация');
  const yes = el('button', { class: 'sw-btn sw-yes', type: 'button', onclick: () => pick(true) }, ico('check'), 'Правда');
  c.body.append(el('p', { class: 'hint' }, 'Перехват: правда или дезинформация? Смахните карточку или нажмите кнопку.'), el('div', { class: 'swipe-zone' }, card), el('div', { class: 'sw-row' }, no, yes));
  let x0 = null, dx = 0, picked = false;
  card.addEventListener('pointerdown', e => { x0 = e.clientX; card.setPointerCapture(e.pointerId); card.classList.add('drag'); });
  card.addEventListener('pointermove', e => { if (x0 == null) return; dx = e.clientX - x0; card.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`; card.dataset.dir = dx > 40 ? 'yes' : dx < -40 ? 'no' : ''; });
  const up = () => { if (x0 == null) return; x0 = null; card.classList.remove('drag'); if (Math.abs(dx) > 90) pick(dx > 0); else { card.style.transform = ''; card.dataset.dir = ''; } dx = 0; };
  card.addEventListener('pointerup', up); card.addEventListener('pointercancel', up);
  card.addEventListener('keydown', e => { if (e.key === 'ArrowRight') pick(true); if (e.key === 'ArrowLeft') pick(false); });
  async function pick(v) {
    if (picked) return; picked = true; no.disabled = yes.disabled = true;
    const ok = v === it.truth; card.dataset.dir = v ? 'yes' : 'no';
    card.style.transform = `translateX(${v ? 18 : -18}px) rotate(${v ? 3 : -3}deg)`; card.classList.add('done', ok ? 'is-ok' : 'is-bad');
    await c.feedback(ok, ok ? (it.truth ? 'Верно, это правда' : 'Верно, это дезинформация') : (it.truth ? 'Это как раз правда' : 'Это дезинформация'), it.why);
    c.answer(v); done();
  }
});

R.vs = (it, c) => new Promise(done => {
  const order = shuffle(it.options.length); let over = false;
  const cards = order.map((i, k) => [k ? el('span', { class: 'vs', 'aria-hidden': 'true' }, 'VS') : null,
    el('button', { class: 'vs-card', type: 'button', 'data-i': i, onclick: e => pick(i, e.currentTarget) }, el('span', { class: 'vs-l' }, 'ABC'[k]), el('span', {}, it.options[i].t))]).flat().filter(Boolean);
  const box = el('div', { class: 'vs-box' }, cards);
  c.body.append(el('h2', { class: 'q' }, it.q), el('p', { class: 'hint' }, 'Подумайте спокойно, время не ограничено.'), box);
  async function pick(i, b) {
    if (over) return; over = true; lockAll(box);
    const ok = i === it.correct; if (b) b.classList.add(ok ? 'ok' : 'bad'); box.querySelector(`[data-i="${it.correct}"]`).classList.add('ok');
    const why = el('ul', { class: 'why-list' }, order.map((j, k) => el('li', { class: j === it.correct ? 'w-ok' : 'w-bad' }, el('b', {}, 'ABC'[k] + '. '), it.options[j].why)));
    await c.feedback(ok, ok ? 'Сильный выбор!' : 'Не этот вариант', null, why); c.answer(i); done();
  }
});

// ---- drag & drop for assembly steps (pointer events: mouse + touch), tap and keyboard stay as fallback ----
function dnd({ root, chips, targets, fill, label, draw, locked }) {
  let drag = null, lastDrop = 0;
  root.addEventListener('click', ev => { if (performance.now() - lastDrop < 350) { ev.stopImmediatePropagation(); ev.preventDefault(); } }, true);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hit = (x, y) => { const e = document.elementFromPoint(x, y); if (!e) return null; const t = e.closest('[data-drop]'); if (t && root.contains(t)) return t; return e.closest('.pool') && root.contains(e.closest('.pool')) ? 'pool' : null; };
  const start = (e, src) => {
    if (locked() || e.button > 0) return;
    const val = src.kind === 'chip' ? src.i : fill[src.k]; if (val == null) return;
    drag = { src, val, x0: e.clientX, y0: e.clientY, on: false, el: e.currentTarget, id: e.pointerId, over: null };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const move = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.on) {
      if (Math.hypot(dx, dy) < 6) return;
      drag.on = true; const r = drag.el.getBoundingClientRect();
      const g = el('div', { class: 'dnd-ghost', 'aria-hidden': 'true' }, label(drag.val)); g.style.width = Math.min(r.width, 320) + 'px';
      document.body.append(g); drag.g = g; drag.ox = e.clientX - r.left; drag.oy = e.clientY - r.top;
      drag.el.classList.add('dnd-src'); document.body.classList.add('dnd-on');
    }
    e.preventDefault();
    drag.g.style.transform = `translate(${e.clientX - drag.ox}px,${e.clientY - drag.oy}px) rotate(-2deg) scale(1.04)`;
    const t = hit(e.clientX, e.clientY);
    if (t !== drag.over) { if (drag.over && drag.over !== 'pool') drag.over.classList.remove('over'); root.querySelector('.pool')?.classList.toggle('over', t === 'pool' && drag.src.kind === 'slot'); if (t && t !== 'pool') t.classList.add('over'); drag.over = t; }
  };
  const end = e => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null; d.el.classList.remove('dnd-src'); document.body.classList.remove('dnd-on');
    root.querySelectorAll('.over').forEach(x => x.classList.remove('over'));
    if (!d.on) return; // plain tap: the click handler does the tap-to-place
    lastDrop = performance.now(); // swallow the click that follows a drag
    const t = e.type === 'pointercancel' ? null : hit(e.clientX, e.clientY);
    let to = null;
    if (t && t !== 'pool') {
      const k = +t.dataset.k;
      if (d.src.kind === 'chip') { const j = fill.indexOf(d.val); if (j >= 0) fill[j] = null; fill[k] = d.val; }
      else { const j = d.src.k; [fill[j], fill[k]] = [fill[k], fill[j]]; }
      to = t;
    } else if (d.src.kind === 'slot') fill[d.src.k] = null;
    const g = d.g;
    if (to && !reduce) {
      const r = to.getBoundingClientRect(), gr = g.getBoundingClientRect();
      g.style.transition = 'transform .18s cubic-bezier(.3,1.3,.5,1), opacity .18s';
      g.style.transform = `translate(${r.left + 8}px,${r.top + (r.height - gr.height) / 2}px) scale(.92)`; g.style.opacity = '.0';
      setTimeout(() => g.remove(), 190);
    } else g.remove();
    draw();
    if (to) { to.classList.remove('snap'); void to.offsetWidth; to.classList.add('snap'); }
  };
  const wire = (node, src) => { node.addEventListener('pointerdown', e => start(e, src)); node.addEventListener('pointermove', move); node.addEventListener('pointerup', end); node.addEventListener('pointercancel', end); node.addEventListener('dragstart', e => e.preventDefault()); };
  chips.forEach(ch => wire(ch, { kind: 'chip', i: +ch.dataset.i }));
  targets.forEach((t, k) => { t.dataset.drop = '1'; t.dataset.k = k; wire(t, { kind: 'slot', k });
    t.addEventListener('keydown', e => { // keyboard: arrows move a placed block to the neighbouring slot (swap)
      if (locked() || fill[k] == null) return; const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]; if (!dir) return;
      const j = k + dir; if (j < 0 || j >= targets.length) return; e.preventDefault(); [fill[j], fill[k]] = [fill[k], fill[j]]; draw(); targets[j].focus(); targets[j].classList.add('snap'); });
  });
}

R.blocks = (it, c) => new Promise(done => {
  const order = shuffle(it.blocks.length); const fill = Array(it.slots.length).fill(null);
  const slots = it.slots.map((s, k) => el('button', { class: 'slot', type: 'button', 'data-k': k, onclick: () => { if (fill[k] == null || checked) return; fill[k] = null; draw(); } }, el('span', { class: 'slot-l' }, s), el('span', { class: 'slot-v' }, '')));
  const chips = order.map(i => el('button', { class: 'chip-b', type: 'button', 'data-i': i, onclick: () => { if (checked) return; const k = fill.indexOf(null); if (k < 0) return; fill[k] = i; draw(); } }, it.blocks[i]));
  const check = el('button', { class: 'cta cta-sm', type: 'button', disabled: true, onclick: () => go() }, 'Проверить');
  let checked = false;
  c.body.append(el('h2', { class: 'q' }, it.q), el('p', { class: 'hint' }, 'Перетащите блоки в ячейки или нажимайте на них по очереди.'), el('div', { class: 'slots' + (it.slots.length > 4 ? ' slots-chain' : '') }, slots), el('div', { class: 'pool' }, chips));
  c.foot.replaceChildren(check);
  dnd({ root: c.body, chips, targets: slots, fill, label: i => it.blocks[i], draw: () => draw(), locked: () => checked });
  function draw() {
    slots.forEach((s, k) => { s.querySelector('.slot-v').textContent = fill[k] == null ? '' : it.blocks[fill[k]]; s.classList.toggle('filled', fill[k] != null); s.setAttribute('aria-label', `${it.slots[k]}: ${fill[k] == null ? 'пусто' : it.blocks[fill[k]] + '. Нажмите, чтобы убрать, стрелки меняют местами'}`); });
    chips.forEach(ch => { const used = fill.includes(+ch.dataset.i); ch.classList.toggle('used', used); ch.disabled = used; });
    check.disabled = fill.includes(null);
  }
  draw();
  async function go() {
    checked = true; check.disabled = true; chips.forEach(ch => { ch.disabled = true; });
    const errs = itemErrors(it, fill); slots.forEach((s, k) => s.classList.add(fill[k] === it.key[k] ? 'ok' : 'bad'));
    const right = errs ? el('ol', { class: 'why-list' }, it.key.map((i, k) => el('li', {}, `${it.slots[k]}: ${it.blocks[i]}`))) : null;
    await c.feedback(!errs, errs ? 'Шифр не сошёлся' : 'Шифр собран!', it.why, right); c.answer([...fill]); done();
  }
});

R.cloze = (it, c) => new Promise(done => {
  const order = shuffle(it.chips.length); const fill = Array(it.gaps.length).fill(null); let checked = false;
  const gapEls = it.gaps.map((g, k) => el('button', { class: 'gap', type: 'button', onclick: () => { if (checked || fill[k] == null) return; fill[k] = null; draw(); } }, '…'));
  const line = el('p', { class: 'cloze-line' }, it.parts.map((p, i) => { const k = it.gaps.indexOf(i); return k >= 0 ? gapEls[k] : (p ? el('span', {}, p) : null); }));
  const chips = order.map(i => el('button', { class: 'chip-b', type: 'button', 'data-i': i, onclick: () => { if (checked) return; const k = fill.indexOf(null); if (k < 0) return; fill[k] = i; draw(); } }, it.chips[i]));
  const check = el('button', { class: 'cta cta-sm', type: 'button', disabled: true, onclick: () => go() }, 'Проверить');
  c.body.append(el('h2', { class: 'q' }, it.q), line, el('div', { class: 'pool' }, chips)); c.foot.replaceChildren(check);
  dnd({ root: c.body, chips, targets: gapEls, fill, label: i => it.chips[i], draw: () => draw(), locked: () => checked });
  function draw() {
    gapEls.forEach((g, k) => { g.textContent = fill[k] == null ? '…' : it.chips[fill[k]]; g.classList.toggle('filled', fill[k] != null); });
    chips.forEach(ch => { const used = fill.includes(+ch.dataset.i); ch.classList.toggle('used', used); ch.disabled = used; });
    check.disabled = fill.includes(null);
  }
  draw();
  async function go() {
    checked = true; check.disabled = true; chips.forEach(ch => { ch.disabled = true; });
    const errs = itemErrors(it, fill); const marks = clozeMarks(it, fill); gapEls.forEach((g, k) => g.classList.add(marks[k] ? 'ok' : 'bad'));
    await c.feedback(!errs, errs ? 'Расшифровка с ошибкой' : 'Расшифровано!', it.why); c.answer([...fill]); done();
  }
});

R.pairs = (it, c) => new Promise(done => {
  const rOrder = shuffle(it.right.length); const first = Array(it.left.length).fill(null); const matched = new Set(); let sel = null, errs = 0;
  const L = it.left.map((t, i) => el('button', { class: 'pair', type: 'button', 'data-i': i, onclick: () => { if (matched.has(i)) return; sel = i; L.forEach(b => b.classList.toggle('sel', +b.dataset.i === i)); } }, t));
  const Rb = rOrder.map(j => el('button', { class: 'pair pair-r', type: 'button', 'data-j': j, onclick: e => pick(j, e.currentTarget) }, it.right[j]));
  c.body.append(el('h2', { class: 'q' }, it.q), el('p', { class: 'hint' }, 'Нажмите слева, потом справа.'), el('div', { class: 'pairs' }, el('div', { class: 'pcol' }, L), el('div', { class: 'pcol' }, Rb)));
  async function pick(j, b) {
    if (sel == null) { c.toast?.('Сначала выберите карточку слева'); return; }
    if (b.disabled) return;
    const i = sel; if (first[i] == null) first[i] = j;
    if (it.key[i] === j) {
      matched.add(i); beep(true); [L[i], b].forEach(x => { x.classList.remove('sel'); x.classList.add('ok'); x.disabled = true; }); sel = null;
      if (matched.size === it.left.length) { const e = itemErrors(it, first); await c.feedback(!e, e ? `Опознано, но с ошибками: ${e}` : 'Все опознаны!', it.why); c.answer(first); done(); }
    } else { errs++; beep(false); vibrate(false); b.classList.add('bad'); L[i].classList.add('bad'); setTimeout(() => { b.classList.remove('bad'); L[i].classList.remove('bad'); }, 450); }
  }
});

R.clue = (it, c) => new Promise(done => {
  const need = it.spots.filter(s => s.bad).length; const taps = []; const found = new Set();
  const S = Object.fromEntries(it.spots.map(s => [s.id, s]));
  const note = el('p', { class: 'clue-note', 'aria-live': 'polite' }, 'Нажимайте на подозрительные места.');
  const cnt = el('span', { class: 'clue-cnt tn' }, `0 из ${need}`);
  const spot = (id, cls, inner) => el('button', { class: 'spot ' + cls, type: 'button', 'data-id': id, onclick: e => tap(id, e.currentTarget) }, inner);
  const mock = it.mock === 'text'
    ? el('div', { class: 'clue-post', role: 'group', 'aria-label': 'Текст поста' }, el('div', { class: 'cp-head' }, el('span', { class: 'vk-ava', 'aria-hidden': 'true' }, it.ava || 'Б'), el('b', {}, it.brand || 'Сообщество')),
        el('p', { class: 'cp-text' }, it.spots.map(x => [spot(x.id, 'cp-seg', x.label), ' ']).flat()))
    : it.mock === 'cover'
    ? el('div', { class: 'clue-cover', role: 'group', 'aria-label': 'Макет обложки', style: `--bg:${it.bg || '#2b2b2b'}` },
        el('span', { class: 'safe', 'aria-hidden': 'true' }, el('i', {}, 'безопасная зона')),
        it.spots.map(x => { const b = spot(x.id, 'cv-el cv-' + (x.kind || 'text'), x.label); b.style.cssText = `left:${x.x}%;top:${x.y}%;width:${x.w}%;`; return b; }))
    : el('div', { class: 'vk', role: 'group', 'aria-label': 'Макет сообщества ВКонтакте' },
    spot('cover', 'vk-cover', el('span', {}, S.cover.label.replace(/^Обложка: /, '').replace(/[«»]/g, ''))),
    el('div', { class: 'vk-row' }, el('span', { class: 'vk-ava', 'aria-hidden': 'true' }, 'ТТ'), spot('name', 'vk-name', S.name.label)),
    spot('desc', 'vk-desc', S.desc.label),
    el('div', { class: 'vk-row vk-btns' }, spot('btn', 'vk-btn', S.btn.label.replace(/^Кнопка: /, '').replace(/[«»]/g, '')), spot('addr', 'vk-addr', S.addr.label)),
    spot('menu', 'vk-pin', el('span', {}, ico('pin'), S.menu.label.replace(/^Закреп: /, '').replace(/[«»]/g, ''))),
    spot('post', 'vk-post', el('span', {}, S.post.label.replace(/^Пост: /, '').replace(/[«»]/g, ''))));
  c.body.append(el('h2', { class: 'q' }, it.q), el('div', { class: 'clue-bar' }, el('span', {}, ico('clue'), 'Улики'), cnt), mock, note);
  if (it.mock === 'cover') mock.after(el('p', { class: 'cv-cap' }, it.caption || 'Пунктир: безопасная зона. На телефоне всё, что за ней, обрежется.'));
  async function tap(id, b) {
    if (b.classList.contains('found')) return; taps.push(id); const s = S[id];
    if (s.bad) { found.add(id); b.classList.add('found'); b.disabled = true; beep(true); note.textContent = 'Улика: ' + s.why; cnt.textContent = `${found.size} из ${need}`; }
    else { b.classList.remove('miss'); void b.offsetWidth; b.classList.add('miss'); beep(false); vibrate(false); note.textContent = 'Чисто: ' + s.why; }
    if (found.size === need) {
      mock.querySelectorAll('button').forEach(x => { x.disabled = true; });
      const misses = taps.filter(x => !S[x].bad).length;
      const list = el('ul', { class: 'why-list' }, it.spots.filter(x => x.bad).map(x => el('li', { class: 'w-bad' }, x.why)));
      await c.feedback(misses === 0, misses ? `Все улики найдены, лишних нажатий: ${misses}` : 'Досье собрано без промахов!', null, list);
      c.answer(taps); done();
    }
  }
});

R.chat = (it, c) => new Promise(async done => {
  const who = c.step.client || { name: 'Клиент', role: '' };
  let thread = c.body.querySelector('.thread');
  if (!thread) {
    thread = el('div', { class: 'thread', 'aria-live': 'polite' });
    c.body.append(el('div', { class: 'chat-top' }, el('span', { class: 'ava', 'aria-hidden': 'true' }, who.name[0]), el('div', {}, el('b', {}, who.name), el('span', {}, who.role))), thread);
  }
  for (const m of it.client) { await typing(thread, who.name); thread.append(bubble('in', m)); scroll(); }
  const order = shuffle(it.options.length);
  const box = el('div', { class: 'replies' }, el('p', { class: 'hint' }, 'Ваш ответ:'), order.map(i => el('button', { class: 'opt opt-reply', type: 'button', 'data-i': i, onclick: () => pick(i) }, it.options[i].t)));
  c.foot.replaceChildren(box); scroll();
  function scroll() { requestAnimationFrame(() => { c.body.scrollTop = c.body.scrollHeight; thread.lastElementChild?.scrollIntoView({ block: 'nearest', behavior: RM.matches ? 'auto' : 'smooth' }); }); }
  async function pick(i) {
    lockAll(box); const o = it.options[i]; const ok = i === it.correct;
    const b = bubble('out', o.t); b.classList.add('sending'); thread.append(b); requestAnimationFrame(() => b.classList.remove('sending'));
    c.foot.replaceChildren(); scroll(); await wait(450);
    await typing(thread, who.name); thread.append(bubble('in', o.react)); scroll();
    const best = ok ? null : el('p', { class: 'best' }, el('b', {}, 'Сильнее было бы: '), it.options[it.correct].t);
    await c.feedback(ok, ok ? 'Клиент вам доверяет' : 'Клиент засомневался', o.why, best);
    c.answer(i); done();
  }
});
// «Под прикрытием»: answer as the brand, following its tone of voice card
R.tone = (it, c) => new Promise(done => {
  const order = shuffle(it.options.length);
  const card = el('div', { class: 'tov' }, el('div', { class: 'tov-h' }, ico('mask'), el('b', {}, 'Легенда: ' + it.brand)),
    el('ul', { class: 'tov-l' }, it.tov.map(t => el('li', { class: 'tov-y' }, ico('check'), t)), (it.dont || []).map(t => el('li', { class: 'tov-n' }, ico('x'), t))));
  const box = el('div', { class: 'opts' }, order.map(i => optionBtn(it.options[i], i, pick)));
  c.body.append(el('h2', { class: 'q' }, it.q), card, el('div', { class: 'thread tone-thread' }, el('div', { class: 'bub bub-in' }, it.msg)), el('p', { class: 'hint' }, 'Какой ответ звучит как этот бренд?'), box);
  async function pick(i, b) {
    lockAll(box); const ok = i === it.correct; b.classList.add(ok ? 'ok' : 'bad');
    if (!ok) box.querySelector(`[data-i="${it.correct}"]`).classList.add('ok');
    await c.feedback(ok, ok ? 'Легенда не раскрыта' : 'Вас раскусили', it.why); c.answer(i); done();
  }
});

// «Слежка»: sort cards into columns
R.sort = (it, c) => new Promise(done => {
  const order = shuffle(it.cards.length); const ans = Array(it.cards.length).fill(null); let k = 0;
  const cnt = el('span', { class: 'tn sort-n' }); const cur = el('div', { class: 'sort-card', 'aria-live': 'polite' });
  const cols = it.cols.map((t, j) => el('div', { class: 'sort-col' }, el('button', { class: 'sort-btn', type: 'button', onclick: () => put(j) }, t), el('ul', { class: 'sort-got' })));
  c.body.append(el('h2', { class: 'q' }, it.q), el('div', { class: 'sort-top' }, el('span', { class: 'hint' }, 'Куда отнести карточку?'), cnt), cur, el('div', { class: 'sort-cols', style: `--n:${it.cols.length}` }, cols));
  show();
  function show() { cnt.textContent = `${Math.min(k + 1, order.length)} из ${order.length}`; if (k < order.length) { cur.textContent = it.cards[order[k]].t; cur.classList.remove('in'); void cur.offsetWidth; cur.classList.add('in'); } }
  async function put(j) {
    if (k >= order.length) return; const i = order[k]; ans[i] = j; const ok = it.cards[i].col === j;
    beep(ok); if (!ok) vibrate(false);
    cols[j].querySelector('.sort-got').append(el('li', { class: ok ? 'ok' : 'bad', title: ok ? '' : 'Правильно: ' + it.cols[it.cards[i].col] }, it.cards[i].t));
    k++; if (k < order.length) return show();
    cur.textContent = 'Все карточки разложены'; cols.forEach(x => x.querySelector('.sort-btn').disabled = true);
    const wrong = it.cards.map((x, i) => [x, ans[i]]).filter(([x, a]) => a !== x.col);
    const list = wrong.length ? el('ul', { class: 'why-list' }, wrong.map(([x]) => el('li', { class: 'w-bad' }, el('b', {}, x.t + ' → ' + it.cols[x.col] + '. '), x.why || ''))) : null;
    await c.feedback(!wrong.length, wrong.length ? `Ошибок: ${wrong.length}` : 'Слежка без промахов!', it.why, list); c.answer([...ans]); done();
  }
});

// «Полевое задание»: write, get an AI review 0–10, fix and resubmit; the review compares with the previous version
R.field = (it, c) => new Promise(done => {
  const sid = 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); let tries = 0, best = 0, busy = false;
  const ta = el('textarea', { class: 'field-ta', rows: 7, maxlength: 2500, placeholder: it.placeholder || 'Ваш текст…', 'aria-label': 'Ваш ответ' }); ta.value = it.draft || '';
  const len = el('span', { class: 'tn field-len' }); const upd = () => { len.textContent = `${ta.value.trim().length} / мин. ${it.minLen || 60}`; }; ta.addEventListener('input', upd); upd();
  const hist = el('ol', { class: 'field-hist', 'aria-label': 'История оценок' });
  const out = el('div', { class: 'field-out', 'aria-live': 'polite' });
  const sendB = el('button', { class: 'cta cta-sm', type: 'button', onclick: () => send() }, 'Отправить на разбор');
  const endB = el('button', { class: 'btn btn-ghost', type: 'button', disabled: true, onclick: () => { c.answer({ sid }); done(); } }, 'Завершить задание');
  c.body.append(el('h2', { class: 'q' }, it.q),
    el('div', { class: 'field-task' }, el('p', {}, it.task), el('ul', { class: 'field-crit' }, it.criteria.map(t => el('li', {}, ico('check'), t)))),
    el('label', { class: 'field-l' }, el('span', {}, 'Ваш вариант'), ta), el('div', { class: 'field-meta' }, len, hist), out);
  c.foot.replaceChildren(el('p', { class: 'fine' }, '3 звезды от 9 из 10. Исправляйте и отправляйте снова, куратор сравнит с прошлой версией.'), endB, sendB);
  async function send() {
    if (busy) return; const text = ta.value.trim(); if (text.length < (it.minLen || 60)) { c.toast?.(`Нужно хотя бы ${it.minLen || 60} символов`); return; }
    busy = true; sendB.disabled = true; out.replaceChildren(el('div', { class: 'play-wait sm' }, el('span', { class: 'spin', 'aria-hidden': 'true' }), 'Куратор читает…'));
    try {
      const r = await c.api('/api/game/review', { method: 'POST', body: { op: c.op, step: c.n, sid, text }, timeout: 45000 });
      tries = r.tries; best = r.best; beep(r.score >= 9);
      hist.append(el('li', { class: r.score >= 9 ? 'hi' : r.score >= 7 ? 'mid' : 'lo' }, String(r.score)));
      out.replaceChildren(el('div', { class: 'field-res' },
        el('div', { class: 'score', style: `--p:${r.score / 10}` }, el('b', { class: 'tn' }, String(r.score)), el('span', {}, 'из 10')),
        el('div', { class: 'field-txt' },
          r.prev != null ? el('p', { class: 'vsprev ' + (r.score > r.prev ? 'up' : r.score < r.prev ? 'down' : '') }, `Было ${r.prev}, стало ${r.score}. ${r.vsPrev || ''}`) : null,
          r.good.length ? el('div', {}, el('b', {}, 'Получилось'), el('ul', {}, r.good.map(t => el('li', {}, t)))) : null,
          r.fix.length ? el('div', {}, el('b', {}, 'Исправить'), el('ul', {}, r.fix.map(t => el('li', {}, t)))) : el('p', {}, 'Замечаний нет. Можно завершать.'))));
      endB.disabled = false; sendB.textContent = 'Отправить исправленную версию';
      if (best >= 9) { endB.className = 'cta cta-sm'; sendB.className = 'btn btn-ghost'; }
    } catch (e) { out.replaceChildren(el('p', { class: 'err' }, e.message)); }
    busy = false; sendB.disabled = tries >= 6; if (tries >= 6) sendB.textContent = 'Попытки закончились';
  }
});

// «Штурм»: several ideas, AI marks relevant and fresh ones (no timer)
R.storm = (it, c) => new Promise(done => {
  const sid = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); let busy = false, tries = 0;
  const min = it.min || 5; const list = el('ol', { class: 'storm-l' });
  const addRow = (v = '') => { if (list.children.length >= 8) return; const inp = el('input', { type: 'text', maxlength: 200, placeholder: `Идея ${list.children.length + 1}`, 'aria-label': `Идея ${list.children.length + 1}` }); inp.value = v; list.append(el('li', {}, inp, el('span', { class: 'storm-m' }))); return inp; };
  for (let i = 0; i < min; i++) addRow();
  const more = el('button', { class: 'btn-ghost btn-s', type: 'button', onclick: () => addRow()?.focus() }, '+ ещё идея');
  const sum = el('p', { class: 'storm-sum', 'aria-live': 'polite' });
  const sendB = el('button', { class: 'cta cta-sm', type: 'button', onclick: () => send() }, 'Проверить идеи');
  const endB = el('button', { class: 'btn btn-ghost', type: 'button', disabled: true, onclick: () => { c.answer({ sid }); done(); } }, 'Завершить штурм');
  c.body.append(el('h2', { class: 'q' }, it.q), el('div', { class: 'field-task' }, el('p', {}, it.task), it.tips ? el('ul', { class: 'field-crit' }, it.tips.map(t => el('li', {}, ico('storm'), t))) : null), list, more, sum);
  c.foot.replaceChildren(el('p', { class: 'fine' }, `3 звезды: ${min} рабочих идей, из них хотя бы 2 свежие.`), endB, sendB);
  async function send() {
    if (busy) return; const ideas = [...list.querySelectorAll('input')].map(x => x.value.trim());
    if (ideas.filter(x => x.length >= 4).length < min) { c.toast?.(`Нужно ${min} идей`); return; }
    busy = true; sendB.disabled = true; sum.textContent = 'Креативный директор смотрит идеи…';
    try {
      const r = await c.api('/api/game/storm', { method: 'POST', body: { op: c.op, step: c.n, sid, ideas }, timeout: 45000 }); tries++;
      const rows = [...list.children].filter(li => li.querySelector('input').value.trim().length >= 4);
      r.marks.forEach((m, i) => { const li = rows[i]; if (!li) return; li.className = m.fresh ? 'fresh' : m.ok ? 'ok' : 'bad'; li.querySelector('.storm-m').textContent = (m.fresh ? 'Свежо · ' : m.ok ? 'Рабочая · ' : 'Мимо · ') + m.note; });
      beep(r.stars === 3);
      sum.textContent = `Рабочих идей: ${r.good}, свежих: ${r.fresh}. Сейчас ${r.stars} ${r.stars === 1 ? 'звезда' : r.stars ? 'звезды' : 'звёзд'}. ${r.stars < 3 && tries < 3 ? 'Замените слабые идеи и проверьте снова.' : ''}`;
      endB.disabled = false; if (r.best >= 3) { endB.className = 'cta cta-sm'; sendB.className = 'btn btn-ghost'; }
    } catch (e) { sum.textContent = e.message; }
    busy = false; sendB.disabled = tries >= 3; if (tries >= 3) sendB.textContent = 'Попытки закончились';
  }
});

function bubble(dir, text) { return el('div', { class: 'bub bub-' + dir }, text); }
async function typing(thread, name) {
  const t = el('div', { class: 'bub bub-in typing', 'aria-label': `${name} печатает` }, el('span', { class: 'dots', 'aria-hidden': 'true' }, el('i'), el('i'), el('i')), el('span', { class: 'typing-t' }, `${name} печатает…`));
  thread.append(t); await wait(650 + Math.random() * 450); t.remove();
}

R.brief = (it, c) => new Promise(done => {
  const sid = 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const who = c.step.client; const covered = new Set(); let asked = 0, busy = false;
  const stageEls = it.stages.map((s, i) => el('li', { class: 'stg' }, el('span', { class: 'stg-d', 'aria-hidden': 'true' }), el('span', { class: 'stg-t' }, s)));
  const thread = el('div', { class: 'thread', 'aria-live': 'polite' });
  const input = el('textarea', { rows: 2, maxlength: 600, placeholder: 'Ваш вопрос клиенту…', 'aria-label': 'Ваш вопрос клиенту', onkeydown: e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } } });
  const sendB = el('button', { class: 'icon-btn send', type: 'button', 'aria-label': 'Отправить', onclick: () => send() }, ico('send'));
  const hintB = el('button', { class: 'btn-ghost btn-s', type: 'button', 'aria-pressed': 'false', 'aria-controls': 'brief-hint', onclick: () => toggleHint() }, ico('storm'), 'Подсказка');
  const endB = el('button', { class: 'cta cta-sm', type: 'button', disabled: true, onclick: () => finish() }, 'Завершить бриф');
  const hintBox = el('p', { class: 'brief-hint', id: 'brief-hint', 'aria-live': 'polite' }); const hintWrap = el('div', { class: 'brief-hint-wrap', 'aria-hidden': 'true' }, hintBox); let hintOpen = false, hintKey = '';
  c.body.append(
    el('div', { class: 'brief-top' },
      el('ol', { class: 'stages', 'aria-label': 'Этапы переговоров' }, stageEls)),
    el('div', { class: 'chat-top' }, el('span', { class: 'ava', 'aria-hidden': 'true' }, who.name[0]), el('div', {}, el('b', {}, who.name), el('span', {}, who.role + ' · играет ИИ'))), thread, hintWrap);
  c.foot.replaceChildren(el('div', { class: 'composer' }, input, sendB), el('div', { class: 'brief-actions' }, hintB, endB));
  thread.append(bubble('in', it.greet || 'Здравствуйте! Я Марина, у меня кофейня «Точка тепла» у центра. Подруга сказала, вы разбираетесь в соцсетях. Сделаете нам ленту поярче?'));
  draw();
  function stageIdx() {
    const h = id => covered.has(id);
    const map = it.stageMap || [['goal'], ['aud', 'offer'], ['metric', 'res', 'time']];
    if (!asked) return 0; for (let i = 0; i < map.length; i++) if (!map[i].every(h)) return i + 1; return map.length + 1;
  }
  function draw() {
    const si = stageIdx();
    stageEls.forEach((s, i) => { s.classList.toggle('done', i < si); s.classList.toggle('cur', i === si); if (i === si) s.setAttribute('aria-current', 'step'); else s.removeAttribute('aria-current'); });
    if (hintOpen) paintHint();
    endB.disabled = asked < 3; endB.textContent = asked < 3 ? `Завершить бриф (ещё ${3 - asked} вопр.)` : 'Завершить бриф';
  }
  function hintText() { // hint for the current stage first, then any fact that is still missing
    const si = stageIdx(), map = it.stageMap || [['goal'], ['aud', 'offer'], ['metric', 'res', 'time']];
    const want = map[Math.max(0, Math.min(si - 1, map.length - 1))] || [];
    const t = it.topics.find(x => want.includes(x.id) && !covered.has(x.id)) || it.topics.find(x => !covered.has(x.id));
    const stage = it.stages[Math.min(si, it.stages.length - 1)];
    return t ? { key: t.id, stage, text: `${t.hint} Задавайте точные вопросы, на расплывчатые клиент отвечает расплывчато.` } : { key: 'done', stage: it.stages[it.stages.length - 1], text: 'Всё собрано. Коротко перескажите клиенту договорённости и завершайте.' };
  }
  function paintHint() {
    const h = hintText(); const changed = hintKey && h.key !== hintKey; hintKey = h.key;
    hintBox.replaceChildren(el('span', { class: 'bh-stage' }, `Подсказка · ${h.stage}`), h.text);
    if (changed) { hintBox.classList.remove('swap'); void hintBox.offsetWidth; hintBox.classList.add('swap'); }
  }
  function toggleHint(force) {
    hintOpen = force ?? !hintOpen; if (hintOpen) paintHint();
    hintWrap.classList.toggle('open', hintOpen); hintWrap.setAttribute('aria-hidden', String(!hintOpen)); hintB.setAttribute('aria-pressed', String(hintOpen));
  }
  async function send() {
    const text = input.value.trim(); if (!text || busy) return; busy = true; sendB.disabled = true; input.value = '';
    const b = bubble('out', text); b.classList.add('sending'); thread.append(b); requestAnimationFrame(() => b.classList.remove('sending'));
    const t = el('div', { class: 'bub bub-in typing' }, el('span', { class: 'dots', 'aria-hidden': 'true' }, el('i'), el('i'), el('i')), el('span', { class: 'typing-t' }, `${who.name} печатает…`));
    thread.append(t); thread.scrollTo({ top: thread.scrollHeight, behavior: 'smooth' });
    try {
      const r = await c.api('/api/game/brief', { method: 'POST', body: { sid, text, op: c.op, step: c.n }, timeout: 40000 });
      t.remove(); const before = covered.size; r.covered.forEach(x => covered.add(x)); asked = r.asked;
      thread.append(bubble('in', r.reply)); if (covered.size > before) beep(true);
      draw();
    } catch (e) { t.remove(); thread.append(el('p', { class: 'sys' }, e.message)); input.value = text; }
    busy = false; sendB.disabled = false; thread.scrollTo({ top: thread.scrollHeight, behavior: 'smooth' }); input.focus({ preventScroll: true });
  }
  function finish() { c.answer({ sid }); done(); }
});
