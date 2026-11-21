import { MECH, OPS, SHOP } from './data.js?v=20261121k';
import { api, store } from '../js/api.js?v=20261121k';
import { playStep, chime } from './play.js?v=20261121k';

const $ = (s, r = document) => r.querySelector(s);
const ico = (id, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const num = (n) => Number(n || 0).toLocaleString('ru-RU');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sum = (a) => (a || []).reduce((x, y) => x + (y || 0), 0);
const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c; };
const TZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'Europe/Moscow'; } })();
const CONTENT = {};
let S = null; // server state

async function content(op) { if (!CONTENT[op]) CONTENT[op] = (await import(`./content/op${op}.js?v=20261121k`)).default; return CONTENT[op]; }
const starsOf = (op) => S?.stars?.[op] || Array(10).fill(null);
const opState = (n) => (S.open.includes(n) ? (n < Math.max(...S.open) ? 'done' : 'current') : 'locked');
const curOp = () => Math.max(...S.open);
function current(op) {
  const st = starsOf(op);
  let i = st.findIndex((k) => k == null || k < 1);
  if (i < 0) i = st.findIndex((k) => k < 3);
  return i < 0 ? -1 : i;
}
function stepState(op, i) {
  const st = starsOf(op), k = st[i];
  if (opState(op) === 'locked') return 'locked';
  if (opState(op) === 'current' && i === current(op)) return 'now';
  if (i > 0 && !(st[i - 1] >= 1)) return 'locked';
  if (k == null) return 'open';
  return k === 3 ? 'gold' : 'retry';
}
function starRow(k, size = 'sm') {
  if (k == null) return '';
  return `<span class="stars stars-${size}" aria-label="${k} из 3 звёзд">${[0, 1, 2].map((i) => `<svg class="st ${i < k ? 'on' : ''}" aria-hidden="true"><use href="#i-star"/></svg>`).join('')}</span>`;
}
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false; t.classList.add('in');
  clearTimeout(toast.t); toast.t = setTimeout(() => { t.classList.remove('in'); setTimeout(() => { t.hidden = true; }, 250); }, 3200);
}

// ---------- header ----------
function renderHud() {
  $('#hud').innerHTML = `
    <span class="chip chip-rank" title="Звание">${ico('rank')}<span>${esc(S.rank)}</span></span>
    <span class="chip chip-streak" title="Огонёк: дней учёбы подряд">${ico('flame')}<b class="tn">${S.streak}</b>
      ${S.freeze ? `<span class="freeze" title="Заморозка в запасе">${ico('snow')}<b class="tn">${S.freeze}</b></span>` : ''}</span>
    <span class="chip chip-xp" title="Опыт">${ico('bolt')}<b class="tn">${num(S.xp)}</b></span>`;
}

// ---------- map ----------
function missionHtml(op) {
  const meta = OPS[op.n - 1]; const st = starsOf(op.n), got = sum(st);
  const ci = current(op.n); const ready = S.ops.includes(op.n);
  const fresh = st.every((k) => k == null);
  const step = meta.steps[Math.max(0, ci)];
  const retry = st.map((k, i) => (k != null && k < 3 && i !== ci ? i + 1 : 0)).filter(Boolean);
  return `<div class="mission">
    <img class="mission-sticker" src="../assets/stickers/news-phone.webp" alt="" width="132" height="132" loading="lazy">
    <h1 class="mission-t">${esc(meta.title)}</h1>
    <p class="mission-meta"><span>Операция ${op.n} из ${OPS.length}</span><span class="dot" aria-hidden="true"></span><span class="tn">${got} из 30 ${ico('star', 'st on')}</span></p>
    <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="30" aria-valuenow="${got}" aria-label="Звёзды операции"><i style="--p:${got / 30}"></i></div>
    ${ready ? `<button class="cta" type="button" data-play="${op.n}-${ci + 1}">
      <span class="cta-main">${fresh ? 'Начать миссию' : 'Продолжить миссию'} ${ico('play', 'fill')}</span>
      <span class="cta-sub">Шаг ${ci + 1} из 10 · ${MECH[step.m]}: ${esc(step.t)}</span>
    </button>` : `<p class="soon">${ico('lock')} Штаб готовит эту операцию. Откроем в ближайшем обновлении.</p>`}
    <p class="mission-rule">Следующая операция откроется, когда у всех 10 шагов будет по 3 звезды.${retry.length ? ` Шаг ${retry.join(', ')} стоит перепройти.` : ''}</p></div>`;
}
function strip(op) {
  const st = starsOf(op.n);
  return `<span class="strip" aria-hidden="true">${op.steps.map((s, i) => {
    const ss = stepState(op.n, i);
    return `<span class="cell cell-${ss}${s.m === 'dossier' || s.m === 'boss' ? ' cell-ev' : ''}">${st[i] == null ? '' : `<i style="--k:${st[i] || 0}"></i>`}</span>`;
  }).join('')}</span>`;
}
function path(op) {
  const st = starsOf(op.n);
  return `<div class="path" data-op="${op.n}"><svg class="links" aria-hidden="true"></svg>${op.steps.map((s, i) => {
    const ss = stepState(op.n, i);
    const ev = s.m === 'dossier' ? 'ev-dossier' : s.m === 'boss' ? 'ev-boss' : '';
    const lab = ss === 'locked' ? 'закрыт' : ss === 'now' ? 'текущий шаг' : st[i] == null ? 'не начат' : `${st[i]} из 3 звёзд`;
    return `<div class="node-wrap" style="--x:${[0, 1, 1.5, 1, 0, -1, -1.5, -1, 0, .6][i]}">
      ${ss === 'now' ? `<span class="bubble">${st[i] == null ? 'Начать' : 'До 3 звёзд'}</span>` : ''}
      <button class="node node-${ss} ${ev}" type="button" data-step="${op.n}-${i + 1}" aria-label="Шаг ${i + 1}. ${MECH[s.m]}: ${esc(s.t)}. ${lab}">
        ${ico(ss === 'locked' && !ev ? 'lock' : s.m, 'node-ic')}
        ${ss === 'gold' ? `<span class="badge badge-ok">${ico('check')}</span>` : ''}
      </button>
      ${st[i] == null ? '' : starRow(st[i])}
      ${ss === 'retry' ? '<span class="retry">до 3 звёзд</span>' : ''}
      <span class="node-t">${ev ? `<b>${MECH[s.m]}</b> ` : ''}${esc(ev ? s.t : MECH[s.m])}</span>
    </div>`;
  }).join('')}</div>`;
}
function renderOps() {
  const open = new Set([...document.querySelectorAll('.op-done.is-open')].map((x) => x.dataset.op));
  $('#ops').innerHTML = OPS.map((op) => {
    const s = opState(op.n), got = sum(starsOf(op.n));
    if (s === 'current') return `<li class="op op-current is-open" data-op="${op.n}">${missionHtml(op)}<div class="op-path">${path(op)}</div></li>`;
    const badge = s === 'done' ? ico('check') : ico('lock');
    return `<li class="op op-${s}${open.has(String(op.n)) ? ' is-open' : ''}" data-op="${op.n}">
      <button class="op-h" type="button" aria-expanded="${open.has(String(op.n))}" ${s === 'locked' ? 'disabled' : `data-toggle="${op.n}"`}>
        <span class="op-n">${badge}</span>
        <span class="op-body"><span class="op-t">${esc(op.title)}</span>
          <span class="op-sub">${s === 'done' ? `Допуск получен · <span class="tn">${got}/30</span>` : `Откроет: ${esc(op.reward)}`}</span>
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
      const [x1, y1, a] = pts[i - 1], [x2, y2, n] = pts[i], my = (y1 + y2) / 2;
      const done = !n.classList.contains('node-locked') && !a.classList.contains('node-now') && !a.classList.contains('node-locked');
      d += `<path class="${done ? 'lk-done' : 'lk'}" d="M${x1} ${y1} C${x1} ${my} ${x2} ${my} ${x2} ${y2}"/>`;
    }
    svg.innerHTML = d;
  });
}

// ---------- side panels ----------
function renderSide() {
  const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const span = Math.max(1, (S.nextXp || S.xp) - S.floor); const pct = S.nextXp ? (S.xp - S.floor) / span : 1;
  $('#side').innerHTML = `
    <section class="panel" data-panel="daily" aria-labelledby="p-daily">
      <h2 id="p-daily">${ico('flame', 'h-ic flame')}Тренировка дня</h2>
      <p class="muted">Огонёк горит, пока вы учитесь каждый день: подходит любой пройденный шаг. Скоро здесь появится трёхминутный повтор слабых мест.</p>
      <ol class="week">${days.map((d, i) => `<li class="day day-${S.week[i] || 'none'}"><span class="day-c">${S.week[i] === 'ok' ? ico('check') : S.week[i] === 'freeze' ? ico('snow') : ''}</span><span class="day-l">${d}</span></li>`).join('')}</ol>
      <p class="fine">Рекорд: <b class="tn">${S.best}</b> ${plural(S.best, 'день', 'дня', 'дней')}. За каждые 7 дней подряд даём заморозку: она спасёт огонёк, если пропустите день.</p>
    </section>
    <section class="panel" data-panel="agent" aria-labelledby="p-agent">
      <h2 id="p-agent">${ico('rank', 'h-ic')}Агент ${esc(S.name)}</h2>
      <div class="rank-row"><span>${esc(S.rank)}</span>${S.nextXp ? `<span class="tn muted">${num(S.xp)} / ${num(S.nextXp)}</span><span>${esc(S.nextRank)}</span>` : '<span>Высшее звание</span>'}</div>
      <div class="bar bar-blue"><i style="--p:${Math.min(1, pct)}"></i></div>
      <p class="fine">${S.nextXp ? `До звания «${esc(S.nextRank)}» ${num(S.nextXp - S.xp)} опыта.` : 'Вы на вершине штаба.'}</p>
      <h3>Знаки отличия</h3>
      <ul class="ach">${S.badges.map((a) => `<li class="${a.on ? '' : 'off'}"><img src="../assets/stickers/${a.st}.webp" alt="" width="72" height="72" loading="lazy"><b>${esc(a.t)}</b><span>${esc(a.d)}</span></li>`).join('')}</ul>
      <div class="agent-foot">
        ${S.role === 'teacher' ? `<a class="btn-ghost btn-s" href="../#/dash">${ico('chart')}Статистика</a>` : ''}
        <button class="btn-ghost btn-s" type="button" data-logout>${ico('user')}Сменить имя</button>
      </div>
    </section>
    <section class="panel" data-panel="shop" aria-labelledby="p-shop">
      <h2 id="p-shop">${ico('bag', 'h-ic')}Лавка допусков</h2>
      <p class="muted">Баланс <b class="tn">${num(S.xp)}</b> опыта. Цену видно сразу, без сюрпризов.</p>
      <ul class="shop">${SHOP.map((s) => `<li><span>${s.t}</span><span class="price tn ${s.p <= S.xp ? 'ok' : ''}">${ico('bolt')}${num(s.p)}</span></li>`).join('')}</ul>
      <p class="fine">Обмен включим в следующем обновлении. Это тестовые награды: на стенде они ничего реального не выдают.</p>
    </section>`;
}

// ---------- step sheet ----------
function fbForm(op, n, title) {
  return `<details class="fbk"><summary>${ico('chat')}Отзыв о задании</summary>
    <form class="fbk-f" data-fb="${op}-${n}" data-title="${esc(title)}">
      <fieldset><legend>Как вам механика?</legend><div class="rate">${[1, 2, 3, 4, 5].map((r) => `<label><input type="radio" name="r" value="${r}" required><span class="tn">${r}</span></label>`).join('')}</div></fieldset>
      <label class="fbk-c"><span>Комментарий</span><textarea name="c" rows="3" maxlength="1500" placeholder="Что понравилось, что поправить"></textarea></label>
      <button class="btn" type="submit">Отправить отзыв</button>
    </form></details>`;
}
async function openSheet(key) {
  const [o, s] = key.split('-').map(Number);
  const meta = OPS[o - 1], step = meta.steps[s - 1], i = s - 1, ss = stepState(o, i), k = starsOf(o)[i];
  const ready = S.ops.includes(o);
  const act = !ready || ss === 'locked' ? '' : k == null ? 'Начать шаг' : k === 3 ? 'Повторить ради опыта' : 'Перепройти до 3 звёзд';
  const sh = $('#sheet');
  sh.innerHTML = `<form method="dialog" class="sheet-in">
    <span class="sheet-ic node node-${ss === 'locked' ? 'locked' : ss === 'now' ? 'now' : ss}">${ico(step.m, 'node-ic')}</span>
    <p class="sheet-k">Операция ${o} · шаг ${s} из 10 · ${MECH[step.m]}</p>
    <h2 id="sheet-t">${esc(step.t)}</h2>
    ${k != null ? starRow(k, 'lg') : ''}
    <p class="muted">${!ready ? 'Штаб ещё готовит эту операцию.' : ss === 'locked' ? (opState(o) === 'locked' ? 'Операция откроется, когда прошлая будет на 30 звёзд.' : `Откроется, когда шаг ${s - 1} получит хотя бы 1 звезду.`) : k == null ? 'Три звезды за ответы без ошибок. Перепроходить можно сколько угодно.' : k === 3 ? 'Шаг на 3 звезды. Повтор даёт немного опыта.' : `Сейчас ${k} ${plural(k, 'звезда', 'звезды', 'звёзд')}. Чтобы закрыть операцию, нужно 3.`}</p>
    <div class="sheet-a">${act ? `<button class="cta cta-sm" type="button" data-play="${o}-${s}">${act}</button>` : ''}<button class="btn btn-ghost" value="close">Закрыть</button></div>
  </form>${k != null ? fbForm(o, s, `${o}.${s} ${MECH[step.m]}: ${step.t}`) : ''}`;
  sh.showModal();
}

// ---------- play + reward ----------
async function play(key) {
  const [o, s] = key.split('-').map(Number);
  if ($('#sheet').open) $('#sheet').close();
  let steps; try { steps = await content(o); } catch { return toast('Эта операция ещё готовится'); }
  const step = steps[s - 1]; if (!step) return toast('Этот шаг ещё готовится');
  playStep({ op: o, n: s, step, api, toast, onDone: (r) => { S = r.state; renderAll(); reward(o, s, step, r); }, onClose: () => { requestAnimationFrame(drawLinks); } });
}
function reward(o, s, step, r) {
  const box = $('#reward'); const next = s < 10 && r.stars >= 1 ? s + 1 : 0;
  const head = r.stars === 3 ? 'Чистая работа, агент!' : r.stars === 2 ? 'Почти идеально' : r.stars === 1 ? 'Шаг засчитан' : 'Пока не засчитано';
  const sub = r.stars === 3 ? (r.opDone ? 'Операция закрыта на все 30 звёзд. Допуск к следующей получен!' : 'Все три звезды. Так держать.') : r.stars >= 1 ? 'Для допуска к следующей операции нужно 3 звезды. Можно перепройти сейчас или позже.' : 'Нужна хотя бы 1 звезда, чтобы открыть следующий шаг. Попробуйте ещё раз, вы справитесь.';
  const err = step.items[0].type === 'brief' ? `Фактов в брифе: ${r.total - r.errors} из ${r.total}` : r.errors ? `Ошибок: ${r.errors}` : 'Без ошибок';
  box.innerHTML = `<div class="rw" role="dialog" aria-modal="true" aria-labelledby="rw-t" tabindex="-1">
    <div class="rw-stars${r.stars === 3 ? ' all' : ''}" role="img" aria-label="Звёзд: ${r.stars} из 3">${[0, 1, 2].map((i) => `<span class="rsw ${i < r.stars ? 'on' : ''}" style="--d:${STAR0 + i * STAR_GAP}ms">${i < r.stars ? `<i class="rs-glow"></i><i class="rs-ring"></i><i class="rs-sp">${[0, 1, 2, 3, 4, 5, 6, 7].map((k) => `<b style="--a:${k * 45 + (k % 2 ? 0 : 22)}deg"></b>`).join('')}</i>` : ''}<svg class="rs" aria-hidden="true"><use href="#i-star"/></svg></span>`).join('')}</div>
    <h2 id="rw-t">${head}</h2>
    <p class="rw-sub">${sub}</p>
    <div class="rw-xp"><span class="rw-xp-n tn" data-to="${r.gain}">+0</span> опыта <span class="muted">· ${err}</span></div>
    ${r.rankUp ? `<p class="rw-rank">${ico('rank')}Новое звание: <b>${esc(r.rankUp)}</b></p>` : ''}
    ${r.newBadges?.length ? `<ul class="rw-badges">${r.newBadges.map((b) => `<li><img src="../assets/stickers/${b.st}.webp" alt="" width="96" height="96"><b>${esc(b.t)}</b><span>${esc(b.d)}</span></li>`).join('')}</ul>` : ''}
    <div class="rw-a">
      ${next ? `<button class="cta cta-sm" type="button" data-play="${o}-${next}">Следующий шаг</button>` : ''}
      ${r.stars < 3 ? `<button class="${next ? 'btn btn-ghost' : 'cta cta-sm'}" type="button" data-play="${o}-${s}">Перепройти</button>` : ''}
      <button class="btn btn-ghost" type="button" data-close-reward>На карту</button>
    </div>
    ${fbForm(o, s, `${o}.${s} ${MECH[step.m]}: ${step.t}`)}
  </div>`;
  box.hidden = false; document.body.classList.add('playing');
  const rw = box.firstElementChild; rw.focus({ preventScroll: true });
  const n = box.querySelector('.rw-xp-n'), to = r.gain;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let skip = reduce; const t0 = performance.now();
  // stars first (one by one), then XP count-up, then badges
  const xpAt = STAR0 + r.stars * STAR_GAP + (r.stars === 3 ? 260 : 120), D = r.stars === 3 ? 650 : 800;
  box.style.setProperty('--after', xpAt + D - 200 + 'ms');
  box.classList.add('celebrate'); if (reduce) box.classList.add('skip');
  const NOTES = [523.25, 659.25, 783.99];
  const timers = [];
  for (let i = 0; i < r.stars; i++) timers.push(setTimeout(() => chime([NOTES[i]]), (reduce ? 120 + i * 160 : STAR0 + i * STAR_GAP + 60)));
  if (r.stars === 3) timers.push(setTimeout(() => chime([1046.5, 1318.5, 1568, 2093], 0.055, 0.07), reduce ? 640 : STAR0 + 2 * STAR_GAP + 330));
  if (r.stars === 0) timers.push(setTimeout(() => chime([392, 330], 0.12, 0.06), 250));
  const tick = (t) => { const p = skip ? 1 : Math.min(1, (t - t0 - xpAt) / D); n.textContent = '+' + Math.max(0, Math.round(to * (p < 0 ? 0 : 1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(tick); else box.classList.add('skip'); };
  requestAnimationFrame(tick);
  rw.addEventListener('pointerdown', () => { skip = true; box.classList.add('skip'); timers.forEach(clearTimeout); }, { once: true });
}
const STAR0 = 220, STAR_GAP = 280;
function closeReward() { const b = $('#reward'); b.hidden = true; b.className = ''; b.innerHTML = ''; document.body.classList.remove('playing'); requestAnimationFrame(drawLinks); }

// ---------- views ----------
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
function renderAll() { renderHud(); renderOps(); renderSide(); }

function entry(msg = '') {
  $('.app').hidden = true; const e = $('#entry'); e.hidden = false;
  const role = localStorage.getItem('stand-role') || 'student';
  e.innerHTML = `<form class="entry-f" novalidate>
    <span class="logo"><span class="beacon" aria-hidden="true"></span>ШТАБ</span>
    <img src="../assets/stickers/accepted.webp" alt="" width="150" height="150" class="entry-st">
    <h1>Агент, представьтесь</h1>
    <p class="muted">Без паролей. Имя увидит только команда в статистике.</p>
    <label class="fld"><span>Ваше имя</span><input name="name" autocomplete="given-name" maxlength="40" required value="${esc(store.user?.name || '')}"></label>
    <div class="seg" role="radiogroup" aria-label="Роль">${[['student', 'Ученик'], ['teacher', 'Учитель']].map(([v, t]) => `<label><input type="radio" name="role" value="${v}" ${role === v ? 'checked' : ''}><span>${t}</span></label>`).join('')}</div>
    <p class="err" role="alert">${esc(msg)}</p>
    <button class="cta" type="submit"><span class="cta-main">Войти в штаб ${ico('play', 'fill')}</span></button>
  </form>`;
  e.querySelector('input[name=name]').focus();
  e.querySelector('form').addEventListener('submit', async (ev) => {
    ev.preventDefault(); const f = ev.currentTarget; const b = f.querySelector('button'); const name = f.name.value.trim();
    if (name.length < 2) { f.querySelector('.err').textContent = 'Напишите имя, хотя бы 2 буквы'; return; }
    b.disabled = true; f.querySelector('.err').textContent = '';
    try {
      const r = await api('/api/guest', { method: 'POST', body: { name, role: f.role.value }, timeout: 35000 });
      store.save(r.token, { login: r.login, name: r.name, role: r.role }); store.tester = r.name; localStorage.setItem('stand-role', r.role); localStorage.setItem('stand-fb-name', r.name);
      e.hidden = true; boot();
    } catch (er) { f.querySelector('.err').textContent = er.message; b.disabled = false; }
  });
}
async function boot() {
  if (!store.token) return entry();
  $('.app').hidden = false; $('#entry').hidden = true;
  if (!S) $('#ops').innerHTML = '<li class="loading">Связываемся со штабом…</li>';
  try { S = await api('/api/game/state?tz=' + encodeURIComponent(TZ), { timeout: 30000 }); renderAll(); }
  catch (e) { if (!store.token) return entry('Сессия закончилась, войдите снова'); $('#ops').innerHTML = `<li class="loading">${esc(e.message)} <button class="btn btn-ghost btn-s" type="button" data-retry>Повторить</button></li>`; }
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('button, a'); if (!b) return;
  if (b.dataset.play) { closeReward(); return play(b.dataset.play); }
  if (b.dataset.step) return openSheet(b.dataset.step);
  if (b.dataset.toggle) { const li = b.closest('.op'); li.classList.toggle('is-open'); b.setAttribute('aria-expanded', li.classList.contains('is-open')); return requestAnimationFrame(drawLinks); }
  if (b.dataset.go) return setView(b.dataset.go);
  if ('closeReward' in b.dataset) return closeReward();
  if ('retry' in b.dataset) return boot();
  if ('logout' in b.dataset) { store.clear(); S = null; return entry(); }
  if (b.classList.contains('theme-btn')) setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
});
document.addEventListener('submit', async (e) => {
  const f = e.target.closest('form[data-fb]'); if (!f) return; e.preventDefault();
  const rating = +(new FormData(f).get('r') || 0); if (!rating) return toast('Поставьте оценку от 1 до 5');
  const b = f.querySelector('button[type=submit]'); b.disabled = true;
  try {
    await api('/api/feedback', { method: 'POST', body: { name: store.user?.name || S?.name, fmt: 'g' + f.dataset.fb, variant: 'G', title: 'Игра · ' + f.dataset.title, rating, comment: f.c.value } });
    f.closest('details').outerHTML = `<p class="fbk-ok">${ico('check')}Спасибо! Отзыв ушёл в статистику команды.</p>`;
  } catch (er) { toast(er.message); b.disabled = false; }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#reward').hidden) closeReward(); });
$('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') e.target.close(); });
addEventListener('resize', () => requestAnimationFrame(drawLinks));
document.fonts?.ready.then(drawLinks);
setTheme(document.documentElement.dataset.theme || 'dark');
boot();
