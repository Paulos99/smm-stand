import { MECH, OPS, SHOP } from './data.js?v=20261122n';
import { api, store } from '../js/api.js?v=20261122n';
import { playStep, chime, sfx, stagger, replay, sound } from './play.js?v=20261122n';
import { openBriefing } from './theory.js?v=20261122n';
import { playFinale } from './finale.js?v=20261122n';
import { createTeam, badge, LEAGUES, avatar } from './team.js?v=20261122n';
import { createMissions, photoEditor } from './missions.js?v=20261122n';
import { createTeacher } from './teacher.js?v=20261122n';
import { initInstall, showInstallBanner, install, canInstall, canFullscreen, toggleFullscreen, watchUpdates } from './install.js?v=20261122n';

const $ = (s, r = document) => r.querySelector(s);
const ico = (id, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const num = (n) => Number(n || 0).toLocaleString('ru-RU');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sum = (a) => (a || []).reduce((x, y) => x + (y || 0), 0);
const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c; };
const TZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return 'Europe/Moscow'; } })();
const CONTENT = {};
let S = null; // server state

// steps come from the API (answers are not in the public repo); refetched after progress so newly unlocked steps arrive
async function content(op, fresh) { if (!CONTENT[op] || fresh) CONTENT[op] = (await api('/api/game/op?op=' + op)).steps; return CONTENT[op]; }
const starsOf = (op) => S?.stars?.[op] || Array(10).fill(null);
let FIN = null; // during an operation finale the map shows the closing operation open and the next one still locked
const opState = (n) => { if (FIN) { if (n === FIN.op) return 'done'; if (n > FIN.op) return 'locked'; } return S.open.includes(n) ? (n < Math.max(...S.open) ? 'done' : 'current') : 'locked'; };
const opComplete = (n) => { const st = starsOf(n); return st.length === 10 && st.every((k) => k === 3); };
const curOp = () => Math.max(...S.open);
function current(op) {
  const st = starsOf(op);
  let i = st.findIndex((k) => k == null || k < 1);
  if (i < 0) i = st.findIndex((k) => k < 3);
  return i < 0 ? -1 : i;
}
// theory first: step 1 opens only after the operation briefing (older API without lectures → no gate)
const briefed = (op) => !S?.lectures?.includes(op) || (S.briefed || []).includes(op);
function stepState(op, i) {
  const st = starsOf(op), k = st[i];
  if (opState(op) === 'locked') return 'locked';
  if (i === 0 && !briefed(op)) return 'locked';
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
    <button class="chip chip-rank" type="button" data-go="team" title="Лига">${badge(S.league ?? 0, 22)}<span>${esc(S.rank)}</span></button>
    <span class="chip chip-streak" title="Огонёк: дней учёбы подряд">${ico('flame')}<b class="tn">${S.streak}</b>
      ${S.freeze ? `<span class="freeze" title="Заморозка в запасе">${ico('snow')}<b class="tn">${S.freeze}</b></span>` : ''}</span>
    <span class="chip chip-xp" title="Опыт">${ico('bolt')}<b class="tn">${num(hudXp ?? S.xp)}</b></span>`;
  // XP grows with a short count-up and a bump of the chip
  if (hudXp != null && S.xp > hudXp) {
    const chip = $('#hud .chip-xp'), b = chip.querySelector('b'), from = hudXp, to = S.xp, t0 = performance.now(), D = RMQ.matches ? 1 : 700;
    replay(chip, 'bump');
    const step = (t) => { const p = Math.min(1, (t - t0) / D); b.textContent = num(Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  hudXp = S.xp;
}
let hudXp = null;
const RMQ = matchMedia('(prefers-reduced-motion: reduce)');

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
    ${ready && !briefed(op.n) ? `<button class="cta" type="button" data-brief="${op.n}">
      <span class="cta-main">Начать с брифинга ${ico('book')}</span>
      <span class="cta-sub">Видеоурок, лекция и материалы · потом шаг 1</span>
    </button>` : ready ? `<button class="cta" type="button" data-play="${op.n}-${ci + 1}">
      <span class="cta-main">${fresh ? 'Начать миссию' : 'Продолжить миссию'} ${ico('play', 'fill')}</span>
      <span class="cta-sub">Шаг ${ci + 1} из 10 · ${MECH[step.m]}: ${esc(step.t)}</span>
    </button>` : `<p class="soon">${ico('lock')} Штаб готовит эту операцию. Откроем в ближайшем обновлении.</p>`}
    <p class="mission-rule">Следующая операция откроется, когда у всех 10 шагов будет по 3 звезды.${retry.length ? ` Шаг ${retry.join(', ')} стоит перепройти.` : ''}</p>
    ${opComplete(op.n) ? `<button class="btn btn-ghost btn-s fin-again-btn" type="button" data-finale="${op.n}">${ico('star', 'st on')} Посмотреть финал</button>` : ''}</div>`;
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
  const bd = briefed(op.n), bs = opState(op.n) === 'locked' ? 'locked' : bd ? 'gold' : 'now';
  const brief = S.lectures?.includes(op.n) ? `<div class="node-wrap brief-wrap" style="--x:-.6">
      ${bs === 'now' ? '<span class="bubble">Сначала теория</span>' : ''}
      <button class="node node-brief node-${bs}" type="button" ${bs === 'locked' ? 'disabled' : `data-brief="${op.n}"`} aria-label="Брифинг: видеоурок, лекция и материалы. ${bs === 'gold' ? 'пройден' : bs === 'now' ? 'начните отсюда' : 'закрыт'}">
        ${ico(bs === 'locked' ? 'lock' : 'book', 'node-ic')}
        ${bs === 'gold' ? `<span class="badge badge-ok">${ico('check')}</span>` : ''}
      </button>
      <span class="node-t brief-t"><b>Брифинг</b>Видео и лекция</span>
    </div>` : '';
  return `<div class="path" data-op="${op.n}"><svg class="links" aria-hidden="true"></svg>${brief}${op.steps.map((s, i) => {
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
    const isOpen = open.has(String(op.n)) || FIN?.op === op.n;
    return `<li class="op op-${s}${isOpen ? ' is-open' : ''}" data-op="${op.n}">
      <button class="op-h" type="button" aria-expanded="${isOpen}" ${s === 'locked' ? 'disabled' : `data-toggle="${op.n}"`}>
        <span class="op-n">${badge}</span>
        <span class="op-body"><span class="op-t">${esc(op.title)}</span>
          <span class="op-sub">${s === 'done' ? `Допуск получен · <span class="tn">${got}/30</span>` : `Откроет: ${esc(op.reward)}`}</span>
          ${strip(op)}
        </span>
        ${s === 'done' ? ico('chev', 'op-chev') : ''}
      </button>
      ${s === 'locked' ? '' : `<div class="op-path">${path(op)}${s === 'done' && opComplete(op.n) && !FIN ? `<div class="fin-again"><button class="btn btn-ghost btn-s" type="button" data-finale="${op.n}">${ico('star', 'st on')} Посмотреть финал</button></div>` : ''}</div>`}
    </li>`;
  }).join('');
  drawLinks(); requestAnimationFrame(drawLinks);
  markChanges();
}
// remember what each node looked like; on the next render pop the ones that just opened or got more stars
let prevNodes = null;
function markChanges() {
  const now = {}; let opened = false;
  document.querySelectorAll('#ops .node[data-step], #ops .node-brief').forEach((n) => {
    const key = n.dataset.step || 'b' + (n.dataset.brief || n.closest('.path')?.dataset.op);
    const locked = n.classList.contains('node-locked'), stars = n.parentElement.querySelectorAll('.stars .st.on').length;
    now[key] = { locked, stars };
    const was = prevNodes?.[key]; if (!was) return;
    if (was.locked && !locked) { n.classList.add('just-open'); opened = true; }
    if (stars > was.stars) n.parentElement.querySelector('.stars')?.classList.add('stars-new');
  });
  if (opened) setTimeout(() => sfx.unlock(), 120);
  prevNodes = now;
}
// The line is laid out from layout boxes (offsetLeft/Top) plus each node's known zigzag shift (--x × --u),
// so entrance animations and taps (which only change transforms) never bend it or make it straight.
const linkRO = 'ResizeObserver' in window ? new ResizeObserver((es) => es.forEach((e) => drawPath(e.target))) : null;
function drawPath(p) {
  const svg = p.querySelector('.links'); if (!svg || !p.offsetParent) return;
  let probe = p.querySelector(':scope > .u-probe');
  if (!probe) { probe = document.createElement('i'); probe.className = 'u-probe'; probe.setAttribute('aria-hidden', 'true'); p.prepend(probe); }
  const u = probe.offsetWidth, W = p.offsetWidth, H = p.offsetHeight;
  svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const pts = [...p.querySelectorAll(':scope > .node-wrap')].map((w) => {
    const n = w.querySelector('.node'); const x = parseFloat(w.style.getPropertyValue('--x')) || 0;
    return [w.offsetLeft + n.offsetLeft + n.offsetWidth / 2 + x * u, w.offsetTop + n.offsetTop + n.offsetHeight / 2, n];
  });
  let d = '';
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1, a] = pts[i - 1], [x2, y2, n] = pts[i], my = (y1 + y2) / 2;
    const done = !n.classList.contains('node-locked') && !a.classList.contains('node-now') && !a.classList.contains('node-locked');
    d += `<path class="${done ? 'lk-done' : 'lk'}" d="M${x1.toFixed(1)} ${y1.toFixed(1)} C${x1.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}"/>`;
  }
  svg.innerHTML = d;
}
function drawLinks() {
  document.querySelectorAll('.path').forEach((p) => { if (linkRO && !p.dataset.ro) { p.dataset.ro = '1'; linkRO.observe(p); } drawPath(p); });
}

// ---------- side panels ----------
function renderSide() {
  const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const span = Math.max(1, (S.nextXp || S.xp) - S.floor); const pct = S.nextXp ? (S.xp - S.floor) / span : 1;
  const allStars = Object.values(S.stars || {}).flat().reduce((a, b) => a + (b || 0), 0);
  const opsDone = OPS.filter((o) => (S.stars[o.n] || []).length === 10 && S.stars[o.n].every((k) => k === 3)).length;
  const played = Object.values(S.stars || {}).flat().some((k) => k != null);
  const shop = S.shop || SHOP;
  const todayIdx = S.week.indexOf('today') >= 0 ? S.week.indexOf('today') : S.today ? (new Date(S.today + 'T12:00').getDay() + 6) % 7 : -1;
  $('#side').innerHTML = `
    <section class="panel" data-panel="daily" aria-labelledby="p-daily">
      <h2 id="p-daily">${ico('flame', 'h-ic flame')}Тренировка дня</h2>
      <p class="muted">${S.trainedToday ? 'Сегодня тренировка зачтена, огонёк горит. Можно повторить ещё раз ради практики.' : played ? 'Шесть коротких заданий из пройденных шагов. Чаще всего попадаются те, где у вас меньше трёх звёзд.' : 'Шесть коротких заданий. Пока шагов мало, берём из начала первой операции.'}</p>
      <div class="train-cta"><button class="cta cta-sm" type="button" data-play="0-0"><span class="emo" aria-hidden="true">🔥</span>${S.trainedToday ? 'Потренироваться ещё' : 'Начать тренировку'}</button><span class="fine">${S.trainedToday ? 'Повтор: +2 опыта' : 'До +25 опыта, раз в день'}</span></div>
      <ol class="week">${days.map((d, i) => `<li class="day day-${S.week[i] || 'none'}${i === todayIdx ? ' is-today' : ''}"${i === todayIdx ? ' aria-current="date"' : ''}><span class="day-c">${S.week[i] === 'ok' ? '<span class="emo" role="img" aria-label="день засчитан">🔥</span>' : S.week[i] === 'freeze' ? ico('snow') : ''}</span><span class="day-l">${d}</span></li>`).join('')}</ol>
      <p class="fine">Огонёк: <b class="tn">${S.streak}</b> · рекорд <b class="tn">${S.best}</b> ${plural(S.best, 'день', 'дня', 'дней')}. День засчитывается за любой шаг или тренировку. За каждые 7 дней подряд даём заморозку, она спасёт огонёк при пропуске.</p>
    </section>
    <section class="panel" data-panel="agent" aria-labelledby="p-agent">
      <h2 id="p-agent">${badge(S.league ?? 0, 30, 'h-lg')}Агент ${esc(S.name)}</h2>
      <div class="ag-photo"><button class="ag-ava" type="button" data-photo aria-label="${S.photo ? 'Сменить фото' : 'Загрузить фото'}">${avatar({ name: S.name, photo: S.photoHidden ? '' : S.photo, frame: S.frame }, 76)}<span class="ag-cam">${ico('cam')}</span></button>
        <div><b>${S.photo ? (S.photoHidden ? 'Фото скрыто преподавателем' : 'Фото агента') : 'Добавьте фото'}</b><p class="fine">${S.photoHidden ? 'Его не видно команде. Можно загрузить другое.' : 'Его увидят в топе, баттлах и профиле. Только команда штаба.'}</p>
        <div class="ag-pa"><button class="btn-ghost btn-s" type="button" data-photo>${S.photo ? 'Сменить' : 'Загрузить'}</button>${S.photo ? '<button class="btn-ghost btn-s" type="button" data-photo-rm>Убрать</button>' : ''}</div></div></div>
      ${S.hasFrame ? `<label class="ag-frame"><span><b>Рамка «Агент штаба»</b><span class="fine">${S.frame ? 'Её видят все: в топе, баттлах и профиле.' : 'Сейчас снята. Включите, чтобы её видели все.'}</span></span><input type="checkbox" role="switch" data-frame-toggle ${S.frame ? 'checked' : ''}><i class="sw" aria-hidden="true"></i></label>` : ''}
      <div class="rank-row"><span>${esc(S.rank)}</span>${S.nextXp ? `<span class="tn muted">${num(S.xp)} / ${num(S.nextXp)}</span><span>${esc(S.nextRank)}</span>` : '<span>Высшая лига</span>'}</div>
      <div class="bar bar-blue"><i style="--p:${Math.min(1, pct)}"></i></div>
      <p class="fine">${S.nextXp ? `До лиги «${esc(S.nextRank)}» ${num(S.nextXp - S.xp)} опыта. Лига считается по всему опыту, обмен в Лавке её не снижает. Баттлы: ${S.bt?.win || 0} ${plural(S.bt?.win || 0, 'победа', 'победы', 'побед')}, ${S.bt?.draw || 0} вничью.` : 'Вы на вершине штаба.'}</p>
      <dl class="stats">
        <div><dt>Звёзды</dt><dd class="tn">${allStars} <small>из 180</small></dd></div>
        <div><dt>Операции</dt><dd class="tn">${opsDone} <small>из 6</small></dd></div>
        <div><dt>Огонёк</dt><dd class="tn">${S.streak} <small>рекорд ${S.best}</small></dd></div>
        <div><dt>Тренировки</dt><dd class="tn">${S.trainings || 0}</dd></div>
        <div><dt>Опыт</dt><dd class="tn">${num(S.xp)}</dd></div>
        <div><dt>Заморозки</dt><dd class="tn">${S.freeze}</dd></div>
      </dl>
      <h3>Знаки отличия <span class="muted tn">${S.badges.filter((a) => a.on).length} из ${S.badges.length}</span></h3>
      <ul class="ach">${S.badges.map((a) => `<li class="${a.on ? '' : 'off'}"><img src="../assets/stickers/${a.st}.webp" alt="" width="72" height="72" loading="lazy"><b>${esc(a.t)}</b><span>${esc(a.d)}</span></li>`).join('')}</ul>
      ${S.bought?.length ? `<h3>Получено в Лавке</h3><ul class="bought">${S.bought.slice().reverse().map((b) => `<li><span>${esc(b.t)}</span><span class="tn muted">${new Date(b.at).toLocaleDateString('ru-RU')}</span></li>`).join('')}</ul>` : ''}
      ${canInstall() || canFullscreen() ? `<div class="ag-app"><div><b>Приложение</b><p class="fine">Поставьте штаб на рабочий стол: он будет открываться сразу на весь экран.</p></div><div class="ag-pa">${canInstall() ? `<button class="btn-ghost btn-s" type="button" data-app-install>${ico('send')}Установить</button>` : ''}${canFullscreen() ? `<button class="btn-ghost btn-s" type="button" data-fs>${document.fullscreenElement ? 'Обычный экран' : 'Во весь экран'}</button>` : ''}</div></div>` : ''}
      <div class="agent-foot">
        ${S.role === 'teacher' ? `<button class="btn-ghost btn-s" type="button" data-go="teach">${ico('chart')}Кабинет</button>` : ''}
        <button class="btn-ghost btn-s" type="button" data-logout>${ico('user')}Выйти</button>
      </div>
    </section>
    <section class="panel" data-panel="shop" aria-labelledby="p-shop">
      <h2 id="p-shop">${ico('bag', 'h-ic')}Лавка допусков</h2>
      <p class="test-note">${ico('lock')}Тестовый режим: опыт списывается по-настоящему, но реальные награды стенд пока не выдаёт.</p>
      <p class="muted">На счёте <b class="tn">${num(S.balance ?? S.xp)}</b> опыта. Цена видна сразу, звание при обмене не падает.</p>
      <ul class="shop">${shop.map((it) => { const can = (S.balance ?? 0) >= it.p; const own = S.bought?.some((b) => b.id === it.id); return `<li><span>${esc(it.t)}${own ? ' <small class="own">есть</small>' : ''}</span><span class="price tn ${can ? 'ok' : ''}">${ico('bolt')}${num(it.p)}</span><button class="btn-ghost btn-s buy" type="button" data-buy="${it.id}" ${can ? '' : 'disabled'} aria-label="Обменять ${num(it.p)} опыта на «${esc(it.t)}»">${can ? 'Обменять' : `ещё ${num(it.p - (S.balance ?? 0))}`}</button></li>`; }).join('')}</ul>
    </section>`;
}
async function buy(btn) {
  if (btn.dataset.sure !== '1') { btn.dataset.sure = '1'; const p = (S.shop || SHOP).find((x) => x.id === btn.dataset.buy).p; btn.textContent = `Списать ${num(p)}?`; btn.classList.add('sure'); setTimeout(() => { if (btn.isConnected && btn.dataset.sure === '1') { btn.dataset.sure = ''; btn.textContent = 'Обменять'; btn.classList.remove('sure'); } }, 4000); return; }
  btn.disabled = true;
  try { const r = await api('/api/game/buy', { method: 'POST', body: { id: btn.dataset.buy, tz: TZ } }); S = r.state; renderAll(); toast(`Готово: «${r.item}». Это тестовая награда.`); }
  catch (e) { toast(e.message); btn.disabled = false; }
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
    <p class="muted">${!ready ? 'Штаб ещё готовит эту операцию.' : ss === 'locked' ? (opState(o) === 'locked' ? 'Операция откроется, когда прошлая будет на 30 звёзд.' : s === 1 ? 'Откроется после брифинга: посмотрите видео и прочитайте лекцию.' : `Откроется, когда шаг ${s - 1} получит хотя бы 1 звезду.`) : k == null ? 'Три звезды за ответы без ошибок. Перепроходить можно сколько угодно.' : k === 3 ? 'Шаг на 3 звезды. Повтор даёт немного опыта.' : `Сейчас ${k} ${plural(k, 'звезда', 'звезды', 'звёзд')}. Чтобы закрыть операцию, нужно 3.`}</p>
    <div class="sheet-a">${act ? `<button class="cta cta-sm" type="button" data-play="${o}-${s}">${act}</button>` : ''}<button class="btn btn-ghost" value="close">Закрыть</button></div>
  </form>${k != null ? fbForm(o, s, `${o}.${s} ${MECH[step.m]}: ${step.t}`) : ''}`;
  sh.showModal(); sfx.tick();
}

// ---------- play + reward ----------
async function play(key) {
  const [o, s] = key.split('-').map(Number);
  if ($('#sheet').open) $('#sheet').close();
  if (o === 0) return training();
  if (s === 1 && !briefed(o)) return briefing(o);
  let steps; try { steps = await content(o); if (steps[s - 1]?.locked) steps = await content(o, true); } catch (e) { return toast(e.message || 'Эта операция ещё готовится'); }
  const step = steps[s - 1]; if (!step) return toast('Этот шаг ещё готовится'); if (step.locked) return toast('Сначала пройдите предыдущий шаг');
  playStep({ op: o, n: s, step, api, toast, onDone: (r) => { S = r.state; renderAll(); reward(o, s, step, r); }, onClose: () => { requestAnimationFrame(drawLinks); } });
}
function briefing(o) {
  if ($('#sheet').open) $('#sheet').close();
  openBriefing({ op: o, api, toast,
    onDone: (r, was) => {
      if (r?.state) { S = r.state; renderAll(); }
      if (r?.gain) toast(`Брифинг пройден · +${r.gain} опыта. Шаг 1 открыт`);
      if (was || r) requestAnimationFrame(() => { const n = document.querySelector(`.path[data-op="${o}"] [data-step="${o}-1"]`); n?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); n?.classList.add('just-open'); });
      if (was) play(`${o}-1`);
    },
    onClose: () => requestAnimationFrame(drawLinks) });
}
async function training() {
  let t; try { t = await api('/api/game/training?tz=' + encodeURIComponent(TZ)); } catch (e) { return toast(e.message); }
  playStep({ op: 0, n: 0, step: t.step, api, toast, onDone: (r) => { S = r.state; renderAll(); reward(0, 0, t.step, r); }, onClose: () => { requestAnimationFrame(drawLinks); } });
}
function reward(o, s, step, r) {
  const box = $('#reward'); const next = o && s < 10 && r.stars >= 1 ? s + 1 : 0; const nextOp = o && r.opDone && o < 6 && S.ops.includes(o + 1);
  const head = !o ? (r.stars >= 1 ? 'Тренировка зачтена' : 'Тренировка не зачтена') : r.stars === 3 ? 'Чистая работа, агент!' : r.stars === 2 ? 'Почти идеально' : r.stars === 1 ? 'Шаг засчитан' : 'Пока не засчитано';
  const sub = !o ? (r.stars >= 1 ? (r.gain > 2 ? 'Огонёк горит, слабые места подтянуты. Новая подборка будет завтра.' : 'Повтор засчитан. Опыт за тренировку даём раз в день.') : 'Нужна хотя бы 1 звезда. Попробуйте ещё раз.') : r.stars === 3 ? (r.opDone ? 'Операция закрыта на все 30 звёзд. Допуск к следующей получен!' : 'Все три звезды. Так держать.') : r.stars >= 1 ? 'Для допуска к следующей операции нужно 3 звезды. Можно перепройти сейчас или позже.' : 'Нужна хотя бы 1 звезда, чтобы открыть следующий шаг. Попробуйте ещё раз, вы справитесь.';
  const kind = step.items[0].type;
  const err = kind === 'field' ? `Лучшая оценка куратора: ${r.score ?? 0} из 10` : kind === 'storm' ? `Рабочих идей: ${r.total - r.errors} из ${r.total}` : step.items[0].type === 'brief' ? `Фактов в брифе: ${r.total - r.errors} из ${r.total}` : r.errors ? `Ошибок: ${r.errors}` : 'Без ошибок';
  box.innerHTML = `<div class="rw" role="dialog" aria-modal="true" aria-labelledby="rw-t" tabindex="-1">
    <div class="rw-stars${r.stars === 3 ? ' all' : ''}" role="img" aria-label="Звёзд: ${r.stars} из 3">${[0, 1, 2].map((i) => `<span class="rsw ${i < r.stars ? 'on' : ''}" style="--d:${STAR0 + i * STAR_GAP}ms">${i < r.stars ? `<i class="rs-glow"></i><i class="rs-ring"></i><i class="rs-sp">${[0, 1, 2, 3, 4, 5, 6, 7].map((k) => `<b style="--a:${k * 45 + (k % 2 ? 0 : 22)}deg"></b>`).join('')}</i>` : ''}<svg class="rs" aria-hidden="true"><use href="#i-star"/></svg></span>`).join('')}</div>
    <h2 id="rw-t">${head}</h2>
    <p class="rw-sub">${sub}</p>
    <div class="rw-xp"><span class="rw-xp-n tn" data-to="${r.gain}">+0</span> опыта <span class="muted">· ${err}</span></div>
    ${r.rankUp ? `<div class="rw-rank promo">${badge(Math.max(0, LEAGUES.indexOf(r.rankUp)), 64, 'pop')}<span>Новая лига: <b>${esc(r.rankUp)}</b></span></div>` : ''}
    ${r.newBadges?.length ? `<ul class="rw-badges">${r.newBadges.map((b) => `<li><img src="../assets/stickers/${b.st}.webp" alt="" width="96" height="96"><b>${esc(b.t)}</b><span>${esc(b.d)}</span></li>`).join('')}</ul>` : ''}
    <div class="rw-a">
      ${r.opDone ? `<button class="cta cta-sm" type="button" data-close-reward>${o < 6 ? 'Закрыть операцию' : 'Финал курса'}</button>` : next ? `<button class="cta cta-sm" type="button" data-play="${o}-${next}">Следующий шаг</button>` : nextOp ? `<button class="cta cta-sm" type="button" data-play="${o + 1}-1">Операция ${o + 1}</button>` : ''}
      ${r.stars < 3 ? `<button class="${next ? 'btn btn-ghost' : 'cta cta-sm'}" type="button" data-play="${o}-${s}">Перепройти</button>` : ''}
      <button class="btn btn-ghost" type="button" data-close-reward>На карту</button>
    </div>
    ${fbForm(o, s, o ? `${o}.${s} ${MECH[step.m]}: ${step.t}` : 'Тренировка дня')}
  </div>`;
  if (o && r.opDone) pendingFinale = o;
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
  if (r.newBadges?.length || r.rankUp) timers.push(setTimeout(() => sfx.badge(), reduce ? 700 : xpAt + D - 120));
  rw.addEventListener('pointerdown', () => { skip = true; box.classList.add('skip'); timers.forEach(clearTimeout); }, { once: true });
}
const STAR0 = 220, STAR_GAP = 280;
function closeReward() { const b = $('#reward'); const was = !b.hidden; b.hidden = true; b.className = ''; b.innerHTML = ''; document.body.classList.remove('playing'); requestAnimationFrame(drawLinks); if (was && pendingFinale) { const o = pendingFinale; pendingFinale = 0; setTimeout(() => finale(o, { auto: true }), 250); } }
let pendingFinale = 0;
// ---------- operation finale: camera walks the path, stars light up, stamp, next operation unlocks ----------
let finRunning = false;
function checkFinale() { // auto-play once for operations finished but not celebrated yet (tracked on the server)
  if (!S || finRunning || !$('#play').hidden || !$('#reward').hidden || $('#sheet').open) return;
  const todo = [1, 2, 3, 4, 5, 6].filter((n) => opComplete(n) && !(S.celebrated || []).includes(n));
  if (todo.length) finale(Math.max(...todo), { auto: true, mark: todo });
}
function finale(op, { auto = false, mark } = {}) {
  if (finRunning || !S || !opComplete(op)) return;
  finRunning = true;
  if (auto) api('/api/game/celebrated', { method: 'POST', body: { ops: mark || [op] } }).then((r) => { S.celebrated = r.celebrated; }).catch(() => {});
  const b = (S.badges || []).find((x) => x.id === 'op' + op && x.on);
  const since = S.briefAt?.[op], days = since ? Math.max(1, Math.round((Date.now() - since) / 864e5)) : 0;
  playFinale({ op, stars: starsOf(op), xp: 100, badge: b ? { t: b.t, st: b.st } : null, days, reduce: RMQ.matches,
    onClose: ({ start }) => {
      finRunning = false;
      if ($('.app').dataset.view !== 'map') setView('map');
      renderOps(); requestAnimationFrame(drawLinks);
      const nx = op < OPS.length ? op + 1 : op;
      if (start && op < OPS.length) return briefing(nx);
      const li = $(`#ops .op[data-op="${nx}"]`); if (!li) return;
      li.classList.add('fz-new'); setTimeout(() => li.classList.remove('fz-new'), 3600);
      const r = li.getBoundingClientRect(); window.scrollTo({ top: Math.max(0, r.top + scrollY - 90), behavior: RMQ.matches ? 'auto' : 'smooth' });
    } });
}


// ---------- views ----------
function setView(v) {
  const was = $('.app').dataset.view; $('.app').dataset.view = v;
  if (v === 'team') { team.render(); window.scrollTo({ top: 0 }); }
  if (v === 'teach') { teacher.render(); window.scrollTo({ top: 0 }); }
  if (v === 'map' && was && was !== 'map') mis.card();
  if (was && was !== v) { sfx.tick(); const wide = matchMedia('(min-width: 1100px)').matches; if (!wide) replay(v === 'map' ? $('.view-map') : $(`[data-panel="${v}"]`), 'v-in'); }
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
// ---------- team + in-app notifications ----------
const team = createTeam({ api, toast, getState: () => S, setState: (st) => { if (st) { S = { ...st, battles: S?.battles }; renderAll(); } } });
const mis = createMissions({ api, toast, getState: () => S });
const teacher = createTeacher({ api, toast });
function missionWin(w) { // celebration for a mission winner, shown once (the server hands wins out once)
  const sh = $('#sheet');
  sh.innerHTML = `<form method="dialog" class="sheet-in mw"><img class="mw-st pop" src="../assets/stickers/mission-best.webp" alt="" width="180" height="195"><p class="sheet-k">Миссия недели</p><h2 id="sheet-t">${w.place} место: «${esc(w.title)}»</h2><p>Преподаватель выбрал вашу работу. Редкий знак «Лучшая работа недели» уже в профиле.</p><p class="mw-xp tn">+${w.xp} опыта</p><div class="sheet-a"><button class="cta cta-sm" value="close">Отлично</button></div></form>`;
  sh.showModal(); chime([523.25, 659.25, 783.99, 1046.5], 0.09, 0.1); setTimeout(() => sfx.badge(), 500);
}
function notify() {
  if (S?.missionWins?.length) { const w = S.missionWins; S.missionWins = []; setTimeout(() => missionWin(w[0]), 700); }
  document.querySelector('.app').classList.toggle('is-teacher', S?.role === 'teacher');
  const bt = S?.battles; if (!bt) return;
  const n = bt.incoming.length; document.querySelectorAll('[data-go="team"] .dot-n').forEach((d) => { d.hidden = !n; d.textContent = n; });
  const seen = new Set(JSON.parse(localStorage.getItem('game-bt-seen') || '[]')); const msgs = [];
  bt.incoming.forEach((x) => { if (!seen.has('i' + x.id)) { msgs.push(`${x.name} вызывает вас на баттл. Загляните в «Команду»`); seen.add('i' + x.id); } });
  bt.done.forEach((x) => { if (!seen.has('d' + x.id)) { msgs.push(`${x.result === 'win' ? 'Победа в баттле!' : x.result === 'draw' ? 'Ничья в баттле.' : 'Баттл проигран.'} Соперник: ${x.name}${bt.gain ? `. +${bt.gain} опыта` : ''}`); seen.add('d' + x.id); } });
  localStorage.setItem('game-bt-seen', JSON.stringify([...seen].slice(-80)));
  msgs.slice(0, 2).forEach((m, i) => setTimeout(() => { toast(m); chime([659.25, 880], 0.08, 0.06); }, 600 + i * 3600));
  if (bt.rankUp) setTimeout(() => { toast(`Новая лига: «${bt.rankUp}»!`); sfx.badge(); }, 400);
}
setInterval(async () => { // light refresh so challenges and results arrive without reload
  if (document.hidden || !S || finRunning || !$('#play').hidden || !$('#reward').hidden || $('#sheet').open) return;
  try { const st = await api('/api/game/state?tz=' + encodeURIComponent(TZ)); const changed = st.xp !== S.xp || JSON.stringify(st.battles) !== JSON.stringify(S.battles); S = st; if (changed) { renderAll(); notify(); if ($('.app').dataset.view === 'team') team.render(); } } catch {}
}, 60000);
let introDone = false;
function renderAll() {
  renderHud(); renderOps(); renderSide();
  if (!introDone) { // first paint: cards and map nodes rise in with a light stagger
    introDone = true; const app = $('.app');
    stagger($('#ops'), ':scope > .op'); document.querySelectorAll('.op-current .path').forEach((p) => stagger(p, ':scope > .node-wrap', 40, 12)); stagger($('.side'), '.panel');
    app.classList.add('intro'); setTimeout(() => app.classList.remove('intro'), 1400);
  }
}

const SCHOOL = 'https://smmorbita.ru/admin.html';
// School login: the password goes straight to the school API (smmorbita.ru), never to the game server.
// The school checks it with its own limits, returns a 60-second signed pass, and only the pass reaches the game.
const SCHOOL_APIS = ['https://api.smmorbita.ru', 'https://bba2iub2khhe4eg3fagq.containers.yandexcloud.net'];
async function schoolFetch(path, { body, token } = {}) {
  let last;
  for (const base of SCHOOL_APIS) {
    try {
      const r = await fetch(base + path, { method: 'POST', mode: 'cors', credentials: 'omit', cache: 'no-store', headers: { 'Content-Type': 'application/json', ...(token ? { 'X-School-Token': token } : {}) }, body: JSON.stringify(body || {}) });
      const j = await r.json().catch(() => ({})); return { ok: r.ok, status: r.status, j, base };
    } catch (er) { last = er; }
  }
  throw Object.assign(new Error('Школа не отвечает. Проверьте интернет и попробуйте ещё раз.'), { cause: last });
}
async function schoolLogin(login, password) {
  const r = await schoolFetch('/api/login', { body: { login, password } });
  if (!r.ok || !r.j.token) throw new Error(r.j.error || 'Не получилось войти. Попробуйте ещё раз.');
  const tok = r.j.token; let h;
  try { h = await schoolFetch('/api/game-handoff', { token: tok }); }
  finally { schoolFetch('/api/logout', { token: tok }).catch(() => {}); } // the school session is not needed after the pass is issued
  if (!h.ok || !h.j.token) throw new Error(h.j.error || 'Школа не выдала пропуск. Попробуйте ещё раз.');
  window.__schoolPass = h.j.token; await schoolPass();
}
function entry(msg = '') {
  $('.app').hidden = true; const e = $('#entry'); e.hidden = false;
  e.innerHTML = `<section class="entry-f" aria-labelledby="entry-t">
    <span class="logo"><span class="beacon" aria-hidden="true"></span>ШТАБ</span>
    <img src="../assets/stickers/accepted.webp" alt="Задание принято" width="150" height="150" class="entry-st">
    <div class="login-card">
      <div class="lc-top"><span>Протокол авторизации</span><b aria-hidden="true">⊕</b></div>
      <h1 id="entry-t">Вход в штаб</h1>
      <p class="muted">Логин и пароль те же, что в СММ ШКОЛЕ.</p>
      <form id="login-form" novalidate>
        <label for="lg-login">Логин</label>
        <input id="lg-login" name="login" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="Ваш логин" maxlength="64" required>
        <label for="lg-pass">Пароль</label>
        <div class="pw-field"><input id="lg-pass" name="password" type="password" autocomplete="current-password" placeholder="Ваш пароль" maxlength="128" required><button type="button" class="pw-eye" aria-label="Показать пароль" aria-pressed="false">Показать</button></div>
        <p class="err" id="lg-err" role="alert" aria-live="polite">${msg ? esc(msg) : ''}</p>
        <button class="cta" type="submit" id="lg-go"><span class="cta-main">Войти</span></button>
      </form>
      <p class="fine">Забыли пароль? Восстановить его можно на <a href="https://smmorbita.ru/login" rel="noopener">smmorbita.ru</a>. Из кабинета школы можно зайти и без пароля: кнопка «Играть» в блоке «Режим игры».</p>
    </div>
  </section>`;
  const f = $('#login-form'), err = $('#lg-err'), go = $('#lg-go'), pw = $('#lg-pass'), eye = e.querySelector('.pw-eye');
  eye.onclick = () => { const show = pw.type === 'password'; pw.type = show ? 'text' : 'password'; eye.textContent = show ? 'Скрыть' : 'Показать'; eye.setAttribute('aria-pressed', String(show)); eye.setAttribute('aria-label', show ? 'Скрыть пароль' : 'Показать пароль'); };
  f.onsubmit = async (ev) => {
    ev.preventDefault(); const login = f.login.value.trim(), password = pw.value;
    if (!login || !password) { err.textContent = 'Введите логин и пароль.'; (login ? pw : f.login).focus(); return; }
    go.disabled = true; go.querySelector('.cta-main').textContent = 'Проверяем…'; err.textContent = '';
    try { await schoolLogin(login, password); pw.value = ''; boot(); }
    catch (er) { entry(er.message); $('#lg-login').value = login; $('#lg-pass').focus(); }
  };
  if (!msg) setTimeout(() => f.login.focus({ preventScroll: true }), 50);
}
async function schoolPass() { // one-time pass from smmorbita.ru, already removed from the address bar by theme-init.js
  const pass = window.__schoolPass; if (!pass) return; window.__schoolPass = '';
  $('#entry').hidden = false; $('#entry').innerHTML = '<div class="play-wait"><span class="spin" aria-hidden="true"></span>Проверяем пропуск из школы…</div>';
  try { const r = await api('/api/school-login', { method: 'POST', body: { pass }, timeout: 35000 }); store.save(r.token, { login: r.login, name: r.name, role: r.role }); store.tester = r.name; history.replaceState(null, '', location.pathname + location.search); }
  catch (er) { history.replaceState(null, '', location.pathname + location.search); throw er; }
}
async function boot() {
  try { await schoolPass(); } catch (er) { return entry(er.message); }
  if (!store.token) return entry();
  $('.app').hidden = false; $('#entry').hidden = true;
  if (!S) $('#ops').innerHTML = '<li class="loading">Связываемся со штабом…</li>';
  try { S = await api('/api/game/state?tz=' + encodeURIComponent(TZ), { timeout: 30000 }); renderAll(); notify(); mis.card(); setTimeout(() => showInstallBanner(toast), 4000); setTimeout(checkFinale, 900); }
  catch (e) { if (!store.token) return entry('Сессия закончилась, войдите снова'); $('#ops').innerHTML = `<li class="loading">${esc(e.message)} <button class="btn btn-ghost btn-s" type="button" data-retry>Повторить</button></li>`; }
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('button, a'); if (!b) return;
  if (team.onClick(b)) return;
  if ('mission' in b.dataset) return mis.open();
  if ('appInstall' in b.dataset) return install(toast);
  if ('fs' in b.dataset) return toggleFullscreen(toast);
  if ('photo' in b.dataset) return photoEditor({ api, toast, onDone: (ph) => { S.photo = ph; S.photoHidden = false; renderSide(); } });
  if ('photoRm' in b.dataset) { if (!confirm('Убрать фото?')) return; return api('/api/game/photo', { method: 'POST', body: { remove: true } }).then(() => { S.photo = ''; renderSide(); toast('Фото убрано'); }).catch((er) => toast(er.message)); }
  if (b.closest('#view-teach')) { teacher.onClick(b); if (!b.dataset.go) return; }
  if (b.dataset.finale) { pendingFinale = 0; closeReward(); return finale(+b.dataset.finale); }
  if (b.dataset.play) { pendingFinale = 0; closeReward(); return play(b.dataset.play); }
  if (b.dataset.brief) { pendingFinale = 0; closeReward(); return briefing(+b.dataset.brief); }
  if (b.dataset.step) return openSheet(b.dataset.step);
  if (b.dataset.buy) return buy(b);
  if (b.dataset.toggle) { const li = b.closest('.op'); li.classList.toggle('is-open'); sfx.tick(); b.setAttribute('aria-expanded', li.classList.contains('is-open')); return requestAnimationFrame(drawLinks); }
  if (b.dataset.go) return setView(b.dataset.go);
  if ('closeReward' in b.dataset) return closeReward();
  if ('retry' in b.dataset) return boot();
  if ('logout' in b.dataset) { api('/api/logout', { method: 'POST', body: {} }).catch(() => {}); store.clear(); S = null; return entry(); }
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
document.addEventListener('change', (e) => { // wear / take off the bought avatar frame (seen by everyone)
  const t = e.target; if (!t.matches?.('[data-frame-toggle]')) return; t.disabled = true;
  api('/api/game/frame', { method: 'POST', body: { on: t.checked } }).then((r) => { S.frame = r.frame; renderSide(); sfx.tick(); toast(r.frame ? 'Рамка надета, её видят все' : 'Рамка снята'); })
    .catch((er) => { t.checked = !t.checked; t.disabled = false; toast(er.message); });
});
$('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') e.target.close(); });
addEventListener('resize', () => requestAnimationFrame(drawLinks));
document.fonts?.ready.then(drawLinks);
setTheme(document.documentElement.dataset.theme || 'dark');
initInstall({ toast, onChange: () => { if (S) renderSide(); } });
watchUpdates({ toast, busy: () => !document.getElementById('play')?.hidden || !!document.querySelector('dialog[open], .sheet.open, #lg-pass:not(:placeholder-shown)') });
boot();
