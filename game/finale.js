// Operation finale: a full-screen story in five beats, each with one focal point and a hold.
// 1 title card · 2 steps fill with stars, counter grows · 3 stamp «Операция завершена» · 4 reward · 5 next operation unlocks
import { OPS } from './data.js?v=20261122e';
import { chime, sfx, sound } from './play.js?v=20261122e';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ico = (id, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c; };

let ac = null;
function thud() { // heavy stamp hit: a low sine drop with a short felt-like noise burst
  if (!sound.on) return;
  try {
    ac ||= new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume();
    const t = ac.currentTime + 0.005, g = ac.createGain(), o = ac.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.28);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.4, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.42);
    const len = 0.09, buf = ac.createBuffer(1, Math.floor(ac.sampleRate * len), ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
    const src = ac.createBufferSource(), lp = ac.createBiquadFilter(), ng = ac.createGain(); src.buffer = buf; lp.type = 'lowpass'; lp.frequency.value = 900; ng.gain.value = 0.18;
    src.connect(lp); lp.connect(ng); ng.connect(ac.destination); src.start(t);
  } catch {}
}
function click() { // lock shackle: two short dry clicks
  if (!sound.on) return;
  try {
    ac ||= new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume();
    [0, 0.07].forEach((dt, k) => { const t = ac.currentTime + 0.005 + dt, o = ac.createOscillator(), g = ac.createGain(); o.type = 'square'; o.frequency.setValueAtTime(k ? 1900 : 2600, t);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04); o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.05); });
  } catch {}
}
const LOCK = `<svg class="fz-lock" viewBox="0 0 64 64" aria-hidden="true">
  <path class="fz-shackle" d="M20 30V21a12 12 0 0 1 24 0v9" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>
  <rect class="fz-body" x="12" y="28" width="40" height="30" rx="8" fill="currentColor"/>
  <circle cx="32" cy="41" r="4" class="fz-hole"/><rect x="30.5" y="42" width="3" height="8" rx="1.5" class="fz-hole"/></svg>`;

// opts: { op, stars:[10], briefed, xp, badge:{t,st}|null, days, reduce, onClose({start}) }
export function playFinale(opts) {
  const { op, reduce } = opts, meta = OPS[op - 1], next = OPS[op], last = !next;
  const rows = [{ brief: true, t: 'Брифинг', s: 'Видео, лекция, презентация', m: 'book' }, ...meta.steps.map((s, i) => ({ t: s.t, s: `Шаг ${i + 1}`, m: s.m, k: opts.stars?.[i] ?? 3 }))];
  const el = document.createElement('div');
  el.className = 'fz' + (reduce ? ' fz-rm' : ''); el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', `Операция ${op} завершена`);
  el.innerHTML = `<div class="fz-bg" aria-hidden="true"></div>
  <button class="fz-skip" type="button">Пропустить</button>
  <section class="fz-beat fz-title"><div class="fz-num" aria-hidden="true">${String(op).padStart(2, '0')}</div><p class="fz-k">Операция ${op} · итоги</p><h2>${esc(meta.title)}</h2></section>
  <section class="fz-beat fz-list">
    <header class="fz-head"><p class="fz-k">Операция ${op} · итоги</p><p class="fz-ht">${esc(meta.title)}</p></header>
    <ol class="fz-rows">${rows.map((r, i) => `<li class="fz-row${r.brief ? ' fz-row-brief' : ''}" style="--i:${i}">
      <span class="fz-ic">${ico(r.m)}</span><span class="fz-tx"><b>${esc(r.t)}</b><small>${esc(r.s)}</small></span>
      ${r.brief ? `<span class="fz-ok">${ico('check')}<span>изучен</span></span>` : `<span class="fz-st" aria-label="${r.k} из 3 звёзд">${[0, 1, 2].map((j) => `<i class="${j < r.k ? 'on' : ''}" style="--j:${j}">${ico('star')}</i>`).join('')}</span>`}
    </li>`).join('')}</ol>
    <div class="fz-count"><span class="fz-cs">${ico('star')}</span><b class="fz-n">0</b><span class="fz-of">/ 30</span></div>
  </section>
  <section class="fz-beat fz-stampwrap" aria-hidden="true"><div class="fz-stamp"><span>Операция ${op}</span><b>завершена</b><i>${ico('star')}${ico('star')}${ico('star')} 30/30</i></div></section>
  <section class="fz-beat fz-reward">
    <p class="fz-k">Награда</p>
    <div class="fz-xp"><b class="fz-xpn">+0</b><span>опыта</span></div>
    ${opts.badge ? `<figure class="fz-badge"><img src="../assets/stickers/${esc(opts.badge.st)}.webp" alt="" width="112" height="112"><figcaption>Знак «${esc(opts.badge.t)}»</figcaption></figure>` : ''}
    <p class="fz-sumline">10 шагов на 3 звезды${opts.days ? ` · ${opts.days} ${plural(opts.days, 'день', 'дня', 'дней')} в деле` : ''}</p>
  </section>
  <section class="fz-beat fz-next">${last ? `
    <img class="fz-course" src="../assets/stickers/mission-best.webp" alt="" width="150" height="150">
    <p class="fz-k">Курс пройден</p><h2>Все 6 операций закрыты</h2><p class="fz-line">Теперь вы агент СММ. Миссии недели и баттлы ждут.</p>
    <div class="fz-btns"><button class="fz-go" type="button" data-fz="map">На карту</button></div>` : `
    <div class="fz-lockwrap"><span class="fz-glow" aria-hidden="true"></span>${LOCK}</div>
    <p class="fz-k fz-k-next"><span class="a">Следующая операция</span><span class="b">Открыта операция ${op + 1}</span></p>
    <h2>${esc(next.title)}</h2>
    <p class="fz-line">Сначала брифинг: видео, лекция и презентация. Потом 10 новых шагов.</p>
    <div class="fz-btns"><button class="fz-go" type="button" data-fz="start">Начать с брифинга ${ico('book')}</button><button class="fz-map" type="button" data-fz="map">На карту</button></div>`}
  </section>`;
  document.body.append(el); document.body.classList.add('fz-on');
  const $ = (s) => el.querySelector(s);
  const timers = []; let ended = false, rest = false;
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  const beat = (b) => { el.dataset.beat = b; };
  const n = $('.fz-n'), rowsEl = [...el.querySelectorAll('.fz-row')];
  let count = 0; const setCount = (v) => { count = v; n.textContent = v; };
  const rollXp = (to, ms) => { const x = $('.fz-xpn'), t0 = performance.now(); const f = (now) => { const p = Math.min(1, (now - t0) / ms), e = 1 - (1 - p) ** 3; x.textContent = '+' + Math.round(to * e); if (p < 1 && !ended) requestAnimationFrame(f); }; requestAnimationFrame(f); };
  const xp = opts.xp || 100;
  const NOTES = [523.25, 587.33, 659.25, 698.46, 783.99, 880, 987.77, 1046.5, 1174.66, 1318.51, 1396.91];

  // ---- timeline (ms) ----
  const T = reduce ? { list: 900, row: 0, glow: 1500, stamp: 1900, reward: 3500, next: 5300, open: 5600 }
                   : { list: 1700, row: 420, glow: 0, stamp: 0, reward: 0, next: 0, open: 0 };
  if (!reduce) { T.glow = T.list + 300 + rows.length * T.row + 500; T.stamp = T.glow + 700; T.reward = T.stamp + 1900; T.next = T.reward + 2300; T.open = T.next + 800; }
  beat('title');
  at(T.list, () => { beat('list'); if (reduce) { rowsEl.forEach((r) => r.classList.add('in')); setCount(30); } });
  if (!reduce) rowsEl.forEach((r, i) => at(T.list + 300 + i * T.row, () => {
    r.classList.add('in'); chime([NOTES[i]], 0.05, 0.045);
    const k = rows[i].brief ? 0 : rows[i].k; for (let j = 0; j < k; j++) at(140 + j * 90, () => setCount(count + 1));
  }));
  at(T.glow, () => { el.classList.add('fz-full'); setCount(30); chime([783.99, 987.77, 1174.66], 0.05, 0.06); });
  at(T.stamp, () => { beat('stamp'); });
  at(T.stamp + (reduce ? 0 : 330), () => { thud(); if (!reduce) { el.classList.add('fz-shake'); at(380, () => el.classList.remove('fz-shake')); } });
  at(T.reward, () => { beat('reward'); rollXp(xp, reduce ? 10 : 900); });
  at(T.reward + (reduce ? 200 : 700), () => sfx.badge());
  at(T.next, () => { beat('next'); if (last) chime([523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98], 0.09, 0.07); });
  if (!last) at(T.open, () => { el.classList.add('fz-open'); click(); at(reduce ? 0 : 450, () => chime([659.25, 783.99, 987.77, 1318.51], 0.08, 0.065)); });
  at((last ? T.next : T.open) + (reduce ? 300 : 1100), () => { rest = true; el.classList.add('fz-rest'); $('.fz-go')?.focus({ preventScroll: true }); });

  function skip() { // jump straight to the last beat at rest
    if (rest || ended) return; timers.splice(0).forEach(clearTimeout);
    el.classList.add('fz-instant'); rowsEl.forEach((r) => r.classList.add('in')); setCount(30); el.classList.add('fz-full'); $('.fz-xpn').textContent = '+' + xp;
    beat('next'); if (!last) el.classList.add('fz-open'); rest = true; el.classList.add('fz-rest');
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('fz-instant'))); $('.fz-go')?.focus({ preventScroll: true });
  }
  function close(start) {
    if (ended) return; ended = true; timers.splice(0).forEach(clearTimeout); document.removeEventListener('keydown', onKey);
    el.classList.add('fz-out'); document.body.classList.remove('fz-on');
    setTimeout(() => el.remove(), reduce ? 200 : 450); opts.onClose?.({ start });
  }
  const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); rest ? close(false) : skip(); } else if (!rest && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); skip(); } };
  document.addEventListener('keydown', onKey);
  el.addEventListener('click', (e) => { const b = e.target.closest('[data-fz]'); if (b) return close(b.dataset.fz === 'start'); if (!rest) skip(); });
  return { skip, close };
}
