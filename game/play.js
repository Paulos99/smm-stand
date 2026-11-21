// Mission player: renders one step (a list of items) with instant feedback, then reports answers to the server.
import { itemErrors } from './content/grade.js?v=20261121l';
import { MECH } from './data.js?v=20261121l';

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
const vibrate = ok => { try { if (!ok && navigator.vibrate) navigator.vibrate(30); } catch {} };

export function playStep({ op, n, step, api, onDone, onClose, toast }) {
  const root = document.getElementById('play');
  const items = step.items; const answers = Array(items.length).fill(null);
  const graded = items.filter(it => it.type !== 'story' && it.type !== 'brief').length || 1;
  let idx = 0, doneCount = 0, closed = false;
  const bar = el('i'); const prog = el('div', { class: 'pbar', role: 'progressbar', 'aria-label': 'Прогресс шага', 'aria-valuemin': 0, 'aria-valuemax': graded }, bar);
  const sndBtn = el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Звук', 'aria-pressed': String(sound.on), onclick: () => { sound.on = !sound.on; sndBtn.setAttribute('aria-pressed', String(sound.on)); sndBtn.classList.toggle('off', !sound.on); } }, ico('sound'));
  sndBtn.classList.toggle('off', !sound.on);
  const head = el('header', { class: 'play-h' },
    el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Выйти на карту', onclick: () => close() }, ico('x')),
    el('div', { class: 'play-meta' }, el('span', { class: 'play-k' }, `Операция ${op} · шаг ${n} из 10 · ${MECH[step.m]}`), prog), sndBtn);
  const body = el('main', { class: 'play-b' });
  const foot = el('footer', { class: 'play-f' });
  root.replaceChildren(head, body, foot); root.hidden = false; document.body.classList.add('playing');
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
      if (it.type !== 'story' && it.type !== 'brief') { doneCount++; setProg(); }
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
    try { await R[it.type](it, ctl); } catch (e) { console.error(e); toast?.('Что-то пошло не так, попробуйте ещё раз'); }
  }
  async function finish() {
    body.replaceChildren(el('div', { class: 'play-wait' }, el('span', { class: 'spin', 'aria-hidden': 'true' }), 'Штаб проверяет ответы…'));
    try {
      const r = await api('/api/game/finish', { method: 'POST', body: { op, step: n, answers, tz: Intl.DateTimeFormat().resolvedOptions().timeZone } });
      closed = true; document.removeEventListener('keydown', onKey); root.hidden = true; root.replaceChildren(); document.body.classList.remove('playing');
      onDone?.(r);
    } catch (e) {
      body.replaceChildren(el('div', { class: 'play-wait' }, el('p', {}, e.message), el('button', { class: 'cta cta-sm', type: 'button', onclick: finish }, 'Отправить ещё раз')));
    }
  }
  const onKey = e => { if (e.key === 'Escape' && !root.hidden) close(); };
  document.addEventListener('keydown', onKey, { once: false });
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
    const errs = itemErrors(it, fill); gapEls.forEach((g, k) => g.classList.add(fill[k] === it.key[k] ? 'ok' : 'bad'));
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
  const mock = el('div', { class: 'vk', role: 'group', 'aria-label': 'Макет сообщества ВКонтакте' },
    spot('cover', 'vk-cover', el('span', {}, S.cover.label.replace(/^Обложка: /, '').replace(/[«»]/g, ''))),
    el('div', { class: 'vk-row' }, el('span', { class: 'vk-ava', 'aria-hidden': 'true' }, 'ТТ'), spot('name', 'vk-name', S.name.label)),
    spot('desc', 'vk-desc', S.desc.label),
    el('div', { class: 'vk-row vk-btns' }, spot('btn', 'vk-btn', S.btn.label.replace(/^Кнопка: /, '').replace(/[«»]/g, '')), spot('addr', 'vk-addr', S.addr.label)),
    spot('menu', 'vk-pin', el('span', {}, ico('pin'), S.menu.label.replace(/^Закреп: /, '').replace(/[«»]/g, ''))),
    spot('post', 'vk-post', el('span', {}, S.post.label.replace(/^Пост: /, '').replace(/[«»]/g, ''))));
  c.body.append(el('h2', { class: 'q' }, it.q), el('div', { class: 'clue-bar' }, el('span', {}, ico('clue'), 'Улики'), cnt), mock, note);
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

R.story = (it, c) => new Promise(done => {
  const flat = []; it.groups.forEach((g, gi) => g.slides.forEach((s, si) => flat.push({ ...s, gi, si })));
  let k = 0; const seen = new Set();
  const rings = it.groups.map((g, gi) => el('button', { class: 'hl', type: 'button', onclick: () => { k = flat.findIndex(s => s.gi === gi); draw(); } }, el('span', { class: 'hl-c' }, ico(['user', 'pairs', 'target', 'swipe'][gi % 4])), el('span', { class: 'hl-t' }, g.name)));
  const segs = el('div', { class: 'segs', 'aria-hidden': 'true' });
  const stage = el('div', { class: 'story', 'aria-live': 'polite' });
  const prev = el('button', { class: 'tapzone tz-prev', type: 'button', 'aria-label': 'Назад', onclick: () => { if (k > 0) { k--; draw(); } } });
  const nextB = el('button', { class: 'tapzone tz-next', type: 'button', 'aria-label': 'Дальше', onclick: () => { if (k < flat.length - 1) { k++; draw(); } else end(); } });
  const frame = el('div', { class: 'story-frame' }, segs, stage, prev, nextB);
  c.body.append(el('div', { class: 'hls', role: 'tablist', 'aria-label': 'Актуальное' }, rings), el('div', { class: 'story-wrap' }, frame));
  const go = el('button', { class: 'cta cta-sm', type: 'button', onclick: () => end() }, 'К вопросам');
  c.foot.replaceChildren(el('p', { class: 'hint' }, 'Нажимайте справа, чтобы листать'), go);
  const onKey = e => { if (!document.body.contains(frame)) return document.removeEventListener('keydown', onKey); if (e.key === 'ArrowRight') nextB.click(); if (e.key === 'ArrowLeft') prev.click(); };
  document.addEventListener('keydown', onKey);
  function slideEl(s) {
    const t = el('h3', { class: 'st-t' }, s.title);
    switch (s.lay) {
      case 'cover': return el('div', { class: 'sl sl-cover' }, s.st ? el('img', { src: `../assets/stickers/${s.st}.webp`, alt: '', class: 'sl-st' }) : null, t, el('p', {}, s.text));
      case 'list': return el('div', { class: 'sl sl-list' }, t, el('ol', {}, s.list.map(x => el('li', {}, x))), s.text ? el('p', { class: 'sl-foot' }, s.text) : null);
      case 'compare': return el('div', { class: 'sl sl-compare' }, t, el('div', { class: 'cmp2' }, el('div', { class: 'c-a' }, s.a.join(' ')), el('span', { class: 'vs', 'aria-hidden': 'true' }, 'VS'), el('div', { class: 'c-b' }, s.b.join(' '))), el('p', { class: 'sl-foot' }, s.text));
      case 'two': return el('div', { class: 'sl sl-two' }, t, el('div', { class: 'two' }, [s.a, s.b].map(([h, d]) => el('div', {}, el('b', {}, h), el('span', {}, d)))), el('p', { class: 'sl-foot' }, s.text));
      case 'chain': return el('div', { class: 'sl sl-chain' }, t, el('div', { class: 'chain' }, s.chain.map((x, i) => [i ? el('span', { class: 'arr', 'aria-hidden': 'true' }, ico('chev')) : null, el('span', { class: 'link' }, x)]).flat().filter(Boolean)), el('p', { class: 'sl-foot' }, s.text));
      case 'steps': return el('div', { class: 'sl sl-steps' }, t, el('ol', { class: 'stairs' }, s.chain.map((x, i) => el('li', { style: `--i:${i}` }, x))), el('p', { class: 'sl-foot' }, s.text));
      case 'big': return el('div', { class: 'sl sl-big' }, t, s.big.map(([b, d], i) => el('div', { class: 'big ' + (i ? 'big-b' : 'big-a') }, el('b', {}, b), el('span', {}, d))));
      case 'pic': return el('div', { class: 'sl sl-pic' }, el('img', { src: `../assets/stickers/${s.st}.webp`, alt: '', class: 'sl-pic-img' }), t, el('p', {}, s.text));
      default: return el('div', { class: 'sl' }, t, el('p', {}, s.text || ''));
    }
  }
  function draw() {
    const s = flat[k]; seen.add(k);
    segs.replaceChildren(...flat.filter(x => x.gi === s.gi).map(x => el('i', { class: x.si < s.si ? 'on' : x.si === s.si ? 'cur' : '' })));
    rings.forEach((r, gi) => { r.classList.toggle('cur', gi === s.gi); r.classList.toggle('seen', flat.every((x, j) => x.gi !== gi || seen.has(j))); r.setAttribute('aria-selected', String(gi === s.gi)); });
    const n = slideEl(s); n.classList.add('enter'); stage.replaceChildren(n); requestAnimationFrame(() => n.classList.remove('enter'));
    go.textContent = k === flat.length - 1 ? 'К вопросам' : 'Пропустить к вопросам';
  }
  draw();
  function end() { document.removeEventListener('keydown', onKey); c.answer(null); done(); }
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
function bubble(dir, text) { return el('div', { class: 'bub bub-' + dir }, text); }
async function typing(thread, name) {
  const t = el('div', { class: 'bub bub-in typing', 'aria-label': `${name} печатает` }, el('span', { class: 'dots', 'aria-hidden': 'true' }, el('i'), el('i'), el('i')), el('span', { class: 'typing-t' }, `${name} печатает…`));
  thread.append(t); await wait(650 + Math.random() * 450); t.remove();
}

R.brief = (it, c) => new Promise(done => {
  const sid = 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const who = c.step.client; const covered = new Set(); let asked = 0, busy = false;
  const stageEls = it.stages.map((s, i) => el('li', { class: 'stg' }, el('span', { class: 'stg-d', 'aria-hidden': 'true' }), el('span', { class: 'stg-t' }, s)));
  const stageNow = el('p', { class: 'stg-now', 'aria-live': 'polite' });
  const checks = it.topics.map(t => el('li', { 'data-id': t.id }, el('span', { class: 'chk', 'aria-hidden': 'true' }, ico('check')), t.t));
  const thread = el('div', { class: 'thread', 'aria-live': 'polite' });
  const input = el('textarea', { rows: 2, maxlength: 600, placeholder: 'Ваш вопрос клиенту…', 'aria-label': 'Ваш вопрос клиенту', onkeydown: e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } } });
  const sendB = el('button', { class: 'icon-btn send', type: 'button', 'aria-label': 'Отправить', onclick: () => send() }, ico('send'));
  const hintB = el('button', { class: 'btn-ghost btn-s', type: 'button', onclick: () => hint() }, ico('storm'), 'Подсказка');
  const endB = el('button', { class: 'cta cta-sm', type: 'button', disabled: true, onclick: () => finish() }, 'Завершить бриф');
  const hintBox = el('p', { class: 'brief-hint', hidden: true });
  c.body.append(
    el('div', { class: 'brief-top' },
      el('ol', { class: 'stages', 'aria-label': 'Этапы переговоров' }, stageEls), stageNow,
      el('details', { class: 'brief-list', open: matchMedia('(min-width: 900px)').matches }, el('summary', {}, el('span', { class: 'tn cov-n' }, `0 из ${it.topics.length}`), ' фактов в брифе'), el('ul', { class: 'checks' }, checks))),
    el('div', { class: 'chat-top' }, el('span', { class: 'ava', 'aria-hidden': 'true' }, who.name[0]), el('div', {}, el('b', {}, who.name), el('span', {}, who.role + ' · играет ИИ'))), thread, hintBox);
  c.foot.replaceChildren(el('div', { class: 'composer' }, input, sendB), el('div', { class: 'brief-actions' }, hintB, endB));
  thread.append(bubble('in', 'Здравствуйте! Я Марина, у меня кофейня «Точка тепла» у центра. Подруга сказала, вы разбираетесь в соцсетях. Сделаете нам ленту поярче?'));
  draw();
  function stageIdx() {
    const h = id => covered.has(id);
    if (!asked) return 0; if (!h('goal')) return 1; if (!(h('aud') && h('offer'))) return 2; if (!(h('metric') && h('res') && h('time'))) return 3; return 4;
  }
  function draw() {
    const si = stageIdx();
    stageEls.forEach((s, i) => { s.classList.toggle('done', i < si); s.classList.toggle('cur', i === si); });
    stageNow.textContent = si >= 4 ? 'Все факты собраны. Подведите итог и завершайте бриф.' : `Сейчас: ${it.stages[si]}. Ведите разговор к этапу «${it.stages[Math.min(si + 1, 4)]}».`;
    checks.forEach(li => li.classList.toggle('on', covered.has(li.dataset.id)));
    c.body.querySelector('.cov-n').textContent = `${covered.size} из ${it.topics.length}`;
    endB.disabled = asked < 3; endB.textContent = asked < 3 ? `Завершить бриф (ещё ${3 - asked} вопр.)` : 'Завершить бриф';
  }
  function hint() { const t = it.topics.find(x => !covered.has(x.id)); hintBox.hidden = false; hintBox.textContent = t ? `Подсказка: ${t.hint} Задавайте точные вопросы, на расплывчатые клиент отвечает расплывчато.` : 'Всё собрано. Коротко перескажите клиенту договорённости и завершайте.'; }
  async function send() {
    const text = input.value.trim(); if (!text || busy) return; busy = true; sendB.disabled = true; input.value = '';
    const b = bubble('out', text); b.classList.add('sending'); thread.append(b); requestAnimationFrame(() => b.classList.remove('sending'));
    const t = el('div', { class: 'bub bub-in typing' }, el('span', { class: 'dots', 'aria-hidden': 'true' }, el('i'), el('i'), el('i')), el('span', { class: 'typing-t' }, `${who.name} печатает…`));
    thread.append(t); t.scrollIntoView({ block: 'nearest' });
    try {
      const r = await c.api('/api/game/brief', { method: 'POST', body: { sid, text }, timeout: 40000 });
      t.remove(); const before = covered.size; r.covered.forEach(x => covered.add(x)); asked = r.asked;
      thread.append(bubble('in', r.reply)); if (covered.size > before) beep(true);
      draw();
    } catch (e) { t.remove(); thread.append(el('p', { class: 'sys' }, e.message)); input.value = text; }
    busy = false; sendB.disabled = false; thread.lastElementChild?.scrollIntoView({ block: 'nearest' }); input.focus({ preventScroll: true });
  }
  function finish() { c.answer({ sid }); done(); }
});
