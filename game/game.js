import { MECH, OPS, STATE, SHOP } from './data.js?v=20261121h';

const $ = (s, r = document) => r.querySelector(s);
const ico = (id, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const num = (n) => n.toLocaleString('ru-RU');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const starsOf = (op) => STATE.stars[op] || Array(10).fill(null);
const sum = (a) => a.reduce((x, y) => x + (y || 0), 0);
const opState = (n) => (n < STATE.current.op ? 'done' : n === STATE.current.op ? 'current' : 'locked');
const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c; };

function starRow(k, size = 'sm') {
  if (k == null) return '';
  return `<span class="stars stars-${size}" aria-label="${k} из 3 звёзд">${[0, 1, 2].map((i) => `<svg class="st ${i < k ? 'on' : ''}" aria-hidden="true"><use href="#i-star"/></svg>`).join('')}</span>`;
}
function stepState(op, i) {
  const k = starsOf(op)[i];
  if (op === STATE.current.op && i === STATE.current.step - 1) return 'now';
  if (k == null) return 'locked';
  return k === 3 ? 'gold' : 'retry';
}

function renderHud() {
  $('#hud').innerHTML = `
    <span class="chip chip-rank" title="Звание">${ico('rank')}<span>${STATE.rank}</span></span>
    <span class="chip chip-streak" title="Огонёк: дней подряд">${ico('flame')}<b class="tn">${STATE.streak}</b>
      ${STATE.freeze ? `<span class="freeze" title="Заморозка в запасе">${ico('snow')}<b class="tn">${STATE.freeze}</b></span>` : ''}</span>
    <span class="chip chip-xp" title="Опыт">${ico('bolt')}<b class="tn">${num(STATE.xp)}</b></span>`;
}

function missionHtml() {
  const op = OPS[STATE.current.op - 1];
  const st = starsOf(op.n), got = sum(st);
  const step = op.steps[STATE.current.step - 1];
  const fresh = st.every((k) => k == null);
  const retry = st.map((k, i) => (k != null && k < 3 && i !== STATE.current.step - 1 ? i + 1 : 0)).filter(Boolean);
  return `<div class="mission">
    <img class="mission-sticker" src="../assets/stickers/news-phone.webp" alt="" width="132" height="132" loading="lazy">
    <h1 class="mission-t">${esc(op.title)}</h1>
    <p class="mission-meta"><span>Операция ${op.n} из ${OPS.length}</span><span class="dot" aria-hidden="true"></span><span class="tn">${got} из 30 ${ico('star', 'st on')}</span></p>
    <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="30" aria-valuenow="${got}" aria-label="Звёзды операции"><i style="--p:${got / 30}"></i></div>
    <button class="cta" type="button" data-step="${op.n}-${STATE.current.step}">
      <span class="cta-main">${fresh ? 'Начать миссию' : 'Продолжить миссию'} ${ico('play', 'fill')}</span>
      <span class="cta-sub">Шаг ${STATE.current.step} из 10 · ${MECH[step.m]}: ${esc(step.t)}</span>
    </button>
    <p class="mission-rule">Следующая операция откроется, когда у всех 10 шагов будет по 3 звезды.${retry.length ? ` Шаг ${retry.join(', ')} стоит перепройти.` : ''}</p></div>`;
}

function strip(op) {
  const st = starsOf(op.n);
  return `<span class="strip" aria-hidden="true">${op.steps.map((s, i) => {
    const ss = stepState(op.n, i);
    return `<span class="cell cell-${ss}${s.m === 'dossier' || s.m === 'boss' ? ' cell-ev' : ''}">${ss === 'locked' ? '' : `<i style="--k:${st[i] || 0}"></i>`}</span>`;
  }).join('')}</span>`;
}

function path(op) {
  const st = starsOf(op.n);
  return `<div class="path" data-op="${op.n}"><svg class="links" aria-hidden="true"></svg>${op.steps.map((s, i) => {
    const ss = stepState(op.n, i);
    const ev = s.m === 'dossier' ? 'ev-dossier' : s.m === 'boss' ? 'ev-boss' : '';
    const lab = ss === 'locked' ? 'закрыт' : ss === 'now' ? 'текущий шаг' : `${st[i]} из 3 звёзд`;
    return `<div class="node-wrap" style="--x:${[0, 1, 1.5, 1, 0, -1, -1.5, -1, 0, .6][i]}">
      ${ss === 'now' ? '<span class="bubble">Начать</span>' : ''}
      <button class="node node-${ss} ${ev}" type="button" data-step="${op.n}-${i + 1}" aria-label="Шаг ${i + 1}. ${MECH[s.m]}: ${esc(s.t)}. ${lab}">
        ${ico(ss === 'locked' && !ev ? 'lock' : s.m, 'node-ic')}
        ${ss === 'gold' ? `<span class="badge badge-ok">${ico('check')}</span>` : ''}
      </button>
      ${ss === 'locked' || ss === 'now' ? '' : starRow(st[i])}
      ${ss === 'retry' ? '<span class="retry">до 3 звёзд</span>' : ''}
      <span class="node-t">${ev ? `<b>${MECH[s.m]}</b> ` : ''}${esc(ev ? s.t : MECH[s.m])}</span>
    </div>`;
  }).join('')}</div>`;
}

function renderOps() {
  $('#ops').innerHTML = OPS.map((op) => {
    const s = opState(op.n), got = sum(starsOf(op.n));
    const open = s === 'current';
    const badge = s === 'done' ? ico('check') : s === 'locked' ? ico('lock') : `<span class="tn">${op.n}</span>`;
    if (s === 'current') return `<li class="op op-current is-open">${missionHtml()}<div class="op-path">${path(op)}</div></li>`;
    return `<li class="op op-${s}${open ? ' is-open' : ''}">
      <button class="op-h" type="button" aria-expanded="${open}" ${s === 'locked' ? '' : `data-toggle="${op.n}"`}>
        <span class="op-n">${badge}</span>
        <span class="op-body"><span class="op-t">${esc(op.title)}</span>
          <span class="op-sub">${s === 'done' ? `Допуск получен · <span class="tn">${got}/30</span>` : s === 'current' ? `Идёт операция · <span class="tn">${got}/30</span>` : `Откроет: ${esc(op.reward)}`}</span>
          ${strip(op)}
        </span>
        ${s === 'done' ? ico('chev', 'op-chev') : ''}
      </button>
      ${s === 'locked' ? '' : `<div class="op-path">${path(op)}</div>`}
    </li>`;
  }).join('');
  requestAnimationFrame(drawLinks);
}

function drawLinks() {
  document.querySelectorAll('.path').forEach((p) => {
    const svg = p.querySelector('.links');
    if (!p.offsetParent) return;
    const box = p.getBoundingClientRect();
    svg.setAttribute('width', box.width); svg.setAttribute('height', box.height);
    const pts = [...p.querySelectorAll('.node')].map((n) => { const r = n.getBoundingClientRect(); return [r.left + r.width / 2 - box.left, r.top + r.height / 2 - box.top, n]; });
    let d = '';
    for (let i = 1; i < pts.length; i++) {
      const [x1, y1] = pts[i - 1], [x2, y2, n] = pts[i], my = (y1 + y2) / 2;
      const done = !n.classList.contains('node-locked') && !pts[i - 1][2].classList.contains('node-now');
      d += `<path class="${done ? 'lk-done' : 'lk'}" d="M${x1} ${y1} C${x1} ${my} ${x2} ${my} ${x2} ${y2}"/>`;
    }
    svg.innerHTML = d;
  });
}

function renderSide() {
  const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const week = STATE.week;
  const pct = STATE.xp / STATE.nextXp;
  const ach = [
    { t: 'Первое задание', s: 'accepted', on: STATE.badges.includes('first') },
    { t: 'Полный допуск: операция 1', s: 'news-progress', on: STATE.badges.includes('op1') },
    { t: 'Точно в ЦА: карта сегмента без ошибок', s: 'target', on: false },
    { t: 'Только нужное: пост 10 из 10 после правок', s: 'news-puzzle', on: false },
  ];
  $('#side').innerHTML = `
    <section class="panel" data-panel="daily" aria-labelledby="p-daily">
      <h2 id="p-daily">${ico('flame', 'h-ic flame')}Тренировка дня</h2>
      <p class="muted">Три минуты на повтор слабых мест. Огонёк засчитываем, даже когда новых уроков нет.</p>
      <ol class="week">${days.map((d, i) => `<li class="day day-${week[i] || 'none'}"><span class="day-c">${week[i] === 'ok' ? ico('check') : week[i] === 'freeze' ? ico('snow') : ''}</span><span class="day-l">${d}</span></li>`).join('')}</ol>
      <button class="btn" type="button">Начать тренировку <span class="tn">+30</span>${ico('bolt')}</button>
      <p class="fine">Пропустили день? Заморозка спасёт огонёк, а двойная тренировка на следующий день вернёт его.</p>
    </section>
    <section class="panel" data-panel="agent" aria-labelledby="p-agent">
      <h2 id="p-agent">${ico('rank', 'h-ic')}Агент ${STATE.name}</h2>
      <div class="rank-row"><span>${STATE.rank}</span><span class="tn muted">${num(STATE.xp)} / ${num(STATE.nextXp)}</span><span>${STATE.nextRank}</span></div>
      <div class="bar bar-blue"><i style="--p:${pct}"></i></div>
      <p class="fine">До звания «${STATE.nextRank}» ${num(STATE.nextXp - STATE.xp)} опыта.</p>
      <h3>Знаки отличия</h3>
      <ul class="ach">${ach.map((a) => `<li class="${a.on ? '' : 'off'}"><img src="../assets/stickers/${a.s}.webp" alt="" width="72" height="72" loading="lazy"><span>${a.t}</span></li>`).join('')}</ul>
    </section>
    <section class="panel" data-panel="shop" aria-labelledby="p-shop">
      <h2 id="p-shop">${ico('bag', 'h-ic')}Лавка допусков</h2>
      <p class="muted">Баланс <b class="tn">${num(STATE.xp)}</b> опыта. Цену видно сразу, без сюрпризов.</p>
      <ul class="shop">${SHOP.map((s) => `<li><span>${s.t}</span><span class="price tn ${s.p <= STATE.xp ? 'ok' : ''}">${ico('bolt')}${num(s.p)}</span></li>`).join('')}</ul>
      <p class="fine">Набор и цены пока черновик для согласования.</p>
    </section>`;
}

function openSheet(key) {
  const [o, s] = key.split('-').map(Number);
  const op = OPS[o - 1], step = op.steps[s - 1], i = s - 1, ss = stepState(o, i), k = starsOf(o)[i];
  const act = ss === 'locked' ? '' : ss === 'gold' ? 'Повторить ради опыта' : ss === 'retry' ? 'Перепройти до 3 звёзд' : 'Начать шаг';
  const sh = $('#sheet');
  sh.innerHTML = `<form method="dialog" class="sheet-in">
    <span class="sheet-ic node node-${ss === 'locked' ? 'locked' : ss}">${ico(step.m, 'node-ic')}</span>
    <p class="sheet-k">Операция ${o} · шаг ${s} из 10 · ${MECH[step.m]}</p>
    <h2 id="sheet-t">${esc(step.t)}</h2>
    ${k != null && ss !== 'now' ? starRow(k, 'lg') : ''}
    <p class="muted">${ss === 'locked' ? `Откроется после шага ${s - 1}.` : ss === 'gold' ? 'Шаг пройден на 3 звезды. Повтор даёт немного опыта.' : ss === 'retry' ? `Сейчас ${k} ${plural(k, 'звезда', 'звезды', 'звёзд')}. Чтобы закрыть операцию, нужно 3.` : 'Три звезды за ответы без ошибок. Перепроходить можно сколько угодно.'}</p>
    <div class="sheet-a">${act ? `<button class="cta cta-sm" value="go">${act}</button>` : ''}<button class="btn btn-ghost" value="close">Закрыть</button></div>
  </form>`;
  sh.showModal();
}

function setView(v) {
  $('.app').dataset.view = v;
  document.querySelectorAll('[data-go]').forEach((b) => { const on = b.dataset.go === v; b.classList.toggle('is-on', on); b.setAttribute('aria-current', on ? 'page' : 'false'); });
  if (matchMedia('(min-width: 1100px)').matches && v !== 'map') $(`[data-panel="${v}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  else window.scrollTo({ top: 0 });
  requestAnimationFrame(drawLinks);
}

function setTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('stand-theme', t); } catch (e) {}
  $('meta[name="theme-color"]').content = t === 'light' ? '#f4f1e8' : '#141414';
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('button, a'); if (!b) return;
  if (b.dataset.step) return openSheet(b.dataset.step);
  if (b.dataset.toggle) { const li = b.closest('.op'); li.classList.toggle('is-open'); b.setAttribute('aria-expanded', li.classList.contains('is-open')); return requestAnimationFrame(drawLinks); }
  if (b.dataset.go) return setView(b.dataset.go);
  if (b.classList.contains('theme-btn')) setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
});
$('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') e.target.close(); });
addEventListener('resize', () => requestAnimationFrame(drawLinks));
document.fonts?.ready.then(drawLinks);

setTheme(document.documentElement.dataset.theme || 'dark');
renderHud(); renderOps(); renderSide();
