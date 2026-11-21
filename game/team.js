// Team: leagues, leaderboards (week / all time / my league), partner battles. All checks are on the server; only display names come here.
import { playStep, chime, sfx, stagger, replay } from './play.js?v=20261121t';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = (n) => Number(n || 0).toLocaleString('ru-RU');
const ico = (id, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c; };
export const LEAGUES = ['Рекрут', 'Агент', 'Оперативник', 'Спецагент', 'Легенда'];
const LC = [['#c98a55', '#8a5530'], ['#6ea0e0', '#2f5f9e'], ['#4fc39a', '#1f7a5b'], ['#a98af0', '#5b3cb5'], ['#ffd65c', '#c48a00']];
let uid = 0;
// sticker-style league badge: white die-cut outline, shield, chevrons by tier, a star for the top league
export function badge(i = 0, size = 40, cls = '') {
  i = Math.max(0, Math.min(4, i | 0)); const [a, b] = LC[i]; const id = 'lg' + (++uid);
  const chev = i < 4 ? [...Array(i + 1)].map((_, k) => `<path d="M17 ${31 - k * 6.5 + (i * 3.2)}l7-5 7 5" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`).join('')
    : '<path d="M24 14.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L24 29.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z" fill="#fff"/>';
  return `<svg class="lg lg-${i} ${cls}" width="${size}" height="${size}" viewBox="0 0 48 48" role="img" aria-label="Лига «${LEAGUES[i]}»">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
    <path d="M24 3l17 6v13c0 11-7.4 19.4-17 23C14.4 41.4 7 33 7 22V9z" fill="#fff" stroke="#fff" stroke-width="5" stroke-linejoin="round"/>
    <path d="M24 3l17 6v13c0 11-7.4 19.4-17 23C14.4 41.4 7 33 7 22V9z" fill="url(#${id})"/>
    <path d="M24 6.5l13.5 4.8V22c0 8.6-5.6 15.4-13.5 18.7" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="1.6"/>
    ${chev}</svg>`;
}
const initials = (n) => esc(String(n || '?').trim().slice(0, 1).toUpperCase());
export const avatar = (p, size = 40) => p?.photo ? `<img class="ava" src="${esc(p.photo)}" alt="" width="${size}" height="${size}" loading="lazy">` : `<span class="ava ava-i" style="--s:${size}px" aria-hidden="true">${initials(p?.name)}</span>`;

export function createTeam({ api, toast, getState, setState, onReward }) {
  let T = null, tab = 'week', busy = false;
  const root = () => document.getElementById('view-team');
  async function load(fresh) { if (!T || fresh) T = await api('/api/game/team'); return T; }
  async function render(fresh = true) {
    const r = root(); if (!r) return;
    if (!T) r.innerHTML = '<div class="play-wait sm"><span class="spin" aria-hidden="true"></span>Собираем команду…</div>';
    try { await load(fresh); } catch (e) { r.innerHTML = `<p class="muted">${esc(e.message)}</p>`; return; }
    const S = getState(), me = T.players.find((p) => p.me) || {}, lg = T.league;
    const next = T.leagues[lg + 1]; const floor = T.leagues[lg].xp; const pct = next ? (S.xp - floor) / (next.xp - floor) : 1;
    const list = rows();
    const inc = T.battles.filter((b) => b.status === 'open' && b.role === 'to' && b.my == null);
    const wait = T.battles.filter((b) => b.status === 'open' && !(b.role === 'to' && b.my == null));
    const done = T.battles.filter((b) => b.status !== 'open').slice(0, 6);
    r.innerHTML = `
      <section class="tm-card tm-league">
        <div class="tm-lg-big">${badge(lg, 92, 'pop')}</div>
        <div class="tm-lg-txt">
          <p class="tm-k">Ваша лига</p>
          <h2>«${LEAGUES[lg]}»</h2>
          ${next ? `<div class="bar bar-blue" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct * 100)}" aria-label="До следующей лиги"><i style="--p:${Math.min(1, pct)}"></i></div>
          <p class="fine">До лиги «${LEAGUES[lg + 1]}» <b class="tn">${num(next.xp - S.xp)}</b> опыта. Лига растёт от любого опыта: шаги, тренировки, брифинги, баттлы.</p>` : '<p class="fine">Высшая лига штаба. Держите планку!</p>'}
        </div>
        <ol class="tm-ladder" aria-label="Лиги">${T.leagues.map((l) => `<li class="${l.i === lg ? 'on' : l.i > lg ? 'off' : 'past'}">${badge(l.i, 34)}<b>${esc(l.t)}</b><span class="tn">${l.i ? 'от ' + num(l.xp) : 'старт'}</span><span class="tn muted">${l.n} ${plural(l.n, 'агент', 'агента', 'агентов')}</span></li>`).join('')}</ol>
      </section>
      <section class="tm-card tm-teamstat" aria-label="Прогресс команды">
        <h3>${ico('target', 'h-ic')}Прогресс команды</h3>
        <dl class="stats">
          <div><dt>Учеников</dt><dd class="tn">${T.team.players}</dd></div>
          <div><dt>Звёзд у всех</dt><dd class="tn">${num(T.team.stars)}</dd></div>
          <div><dt>Операций закрыто</dt><dd class="tn">${T.team.opsDone}</dd></div>
          <div><dt>Опыт за неделю</dt><dd class="tn">${num(T.team.week)}</dd></div>
        </dl>
        <p class="fine">На этой неделе учились ${T.team.active} из ${T.team.players}. Неделя началась ${new Date(T.weekStart + 'T12:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}.</p>
      </section>
      ${inc.length ? `<section class="tm-card tm-inbox" aria-label="Вас вызвали">
        <h3>${ico('vs', 'h-ic')}Вас вызвали на баттл</h3>
        <ul class="bt-list">${inc.map((b) => btRow(b, true)).join('')}</ul></section>` : ''}
      <section class="tm-card tm-top">
        <div class="tm-top-h"><h3>${ico('rank', 'h-ic')}Топ агентов</h3>
          <div class="seg seg-sm" role="tablist" aria-label="Какой топ">${[['week', 'Неделя'], ['all', 'Всё время'], ['league', 'Моя лига']].map(([k, t]) => `<button role="tab" type="button" aria-selected="${tab === k}" data-ttab="${k}">${t}</button>`).join('')}</div></div>
        <ol class="lb">${list.map((p, i) => lbRow(p, i)).join('') || '<li class="muted lb-empty">Пока никого. Пройдите шаг, и вы появитесь в топе.</li>'}</ol>
        <p class="fine">${tab === 'week' ? 'Опыт с понедельника. Каждую неделю топ начинается заново.' : tab === 'all' ? 'Весь опыт за всё время.' : `Только лига «${LEAGUES[lg]}». С ними можно устроить баттл: нажмите на агента.`}</p>
      </section>
      <section class="tm-card tm-battles">
        <h3>${ico('vs', 'h-ic')}Баттлы</h3>
        <p class="muted">Вызовите агента своей лиги. Оба отвечают на одни и те же 6 вопросов, когда удобно, без таймера. Победа <b>+${T.win.win}</b>, ничья <b>+${T.win.draw}</b>, участие <b>+${T.win.lose}</b> опыта.</p>
        <button class="cta cta-sm" type="button" data-ttab="league" data-scrolltop>${ico('vs')}Выбрать соперника</button>
        ${wait.length ? `<h4>Ждём ответа</h4><ul class="bt-list">${wait.map((b) => btRow(b)).join('')}</ul>` : ''}
        ${done.length ? `<h4>Итоги</h4><ul class="bt-list">${done.map((b) => btRow(b)).join('')}</ul>` : ''}
        <p class="fine">Баттл живёт 3 дня. Если соперник не ответил, победа за тем, кто сыграл.</p>
      </section>`;
    stagger(r, ':scope > .tm-card', 60); replay(r, 'tm-in');
    stagger(r.querySelector('.lb'), ':scope > li', 35, 12);
  }
  function rows() {
    const ps = T.players.slice();
    if (tab === 'league') return ps.filter((p) => p.league === T.league).sort((a, b) => b.xp - a.xp);
    if (tab === 'week') return ps.sort((a, b) => b.week - a.week || b.xp - a.xp);
    return ps.sort((a, b) => b.xp - a.xp);
  }
  function lbRow(p, i) {
    const val = tab === 'week' ? p.week : p.xp;
    return `<li class="lb-r${p.me ? ' me' : ''}${i < 3 ? ' top' + (i + 1) : ''}"><button type="button" data-player="${p.pid}" aria-label="${esc(p.name)}, ${i + 1} место, ${num(val)} опыта">
      <span class="lb-n tn">${i + 1}</span>
      <span class="lb-ava">${avatar(p, 40)}${badge(p.league, 22, 'lb-lg')}</span>
      <span class="lb-name"><b>${esc(p.name)}${p.me ? ' <small>вы</small>' : ''}</b><span class="tn muted">${ico('star', 'st on')}${p.stars} · ${p.ops}/6 опер. ${p.streak ? `· 🔥${p.streak}` : ''}</span></span>
      <span class="lb-xp tn">${num(val)}<small>${tab === 'week' ? 'за неделю' : 'опыта'}</small></span></button></li>`;
  }
  function btRow(b, incoming) {
    const res = b.result === 'win' ? '<span class="bt-res win">Победа</span>' : b.result === 'lose' ? '<span class="bt-res lose">Поражение</span>' : b.result === 'draw' ? '<span class="bt-res draw">Ничья</span>' : b.status === 'declined' ? '<span class="bt-res">Отклонён</span>' : b.status === 'expired' ? '<span class="bt-res">Истёк</span>' : '';
    const score = b.status === 'done' ? `<b class="tn">${b.my ?? 0} : ${b.opp.ok ?? 0}</b>` : b.my != null ? `<span class="muted">вы: ${b.my} из ${b.total}, ждём ${esc(b.opp.name)}</span>` : b.role === 'from' ? '<span class="muted">сыграйте свою часть</span>' : '';
    const act = b.status === 'open' && b.my == null ? `<button class="btn btn-s" type="button" data-bplay="${b.id}">${incoming ? 'Принять' : 'Играть'}</button>${incoming ? `<button class="btn-ghost btn-s" type="button" data-bdecline="${b.id}">Отказаться</button>` : ''}` : b.xp ? `<span class="bt-xp tn">+${b.xp}</span>` : '';
    return `<li class="bt-r">${badge(b.opp.league || 0, 28)}<span class="bt-who"><b>${esc(b.opp.name)}</b>${res}${score}</span><span class="bt-a">${act}</span></li>`;
  }
  function profile(pid) {
    const p = T.players.find((x) => x.pid === pid); if (!p) return;
    const sh = document.getElementById('sheet');
    sh.innerHTML = `<form method="dialog" class="sheet-in pf">
      <div class="pf-top">${avatar(p, 84)}<span class="pf-lg">${badge(p.league, 46, 'pop')}</span></div>
      <h2 id="sheet-t">${esc(p.name)}${p.me ? ' <small class="muted">это вы</small>' : ''}</h2>
      <p class="sheet-k">Лига «${LEAGUES[p.league]}»</p>
      <dl class="stats">
        <div><dt>Опыт</dt><dd class="tn">${num(p.xp)}</dd></div>
        <div><dt>За неделю</dt><dd class="tn">${num(p.week)}</dd></div>
        <div><dt>Звёзды</dt><dd class="tn">${p.stars} <small>из 180</small></dd></div>
        <div><dt>Операции</dt><dd class="tn">${p.ops} <small>из 6</small></dd></div>
        <div><dt>Огонёк</dt><dd class="tn">${p.streak}</dd></div>
        <div><dt>Знаки</dt><dd class="tn">${p.badges}</dd></div>
      </dl>
      ${p.me ? '' : p.can ? `<button class="cta cta-sm" type="button" data-challenge="${p.pid}">${ico('vs')}Вызвать на баттл</button>` : `<p class="pf-lock">${ico('lock')}${esc(p.lock)}</p>`}
      <div class="sheet-a"><button class="btn btn-ghost" value="close">Закрыть</button></div></form>`;
    sh.showModal(); sfx.tick();
  }
  // VS screen → same 6 questions → result
  function intro(bt) {
    const S = getState(); const me = T?.players.find((p) => p.me) || { name: S.name, league: S.league ?? 0 };
    const opp = T?.players.find((p) => p.pid === bt.opp.pid) || { name: bt.opp.name, league: bt.opp.league || 0 };
    const root = document.getElementById('play');
    root.innerHTML = `<header class="play-h"><button class="icon-btn" type="button" data-bclose aria-label="Закрыть">${ico('x')}</button><div class="play-meta"><span class="play-k">Баттл · ${bt.total} вопросов · без таймера</span></div></header>
      <main class="play-b vs-intro">
        <div class="vs-arena">
          <div class="vs-side l">${avatar(me, 96)}${badge(me.league, 40, 'vs-lg')}<b>${esc(me.name)}</b><span class="muted">Лига «${LEAGUES[me.league]}»</span></div>
          <div class="vs-mid" aria-hidden="true"><span>VS</span></div>
          <div class="vs-side r">${avatar(opp, 96)}${badge(opp.league, 40, 'vs-lg')}<b>${esc(opp.name)}</b><span class="muted">${bt.opp.played ? 'ход сделан' : 'ход впереди'}</span></div>
        </div>
        <ul class="vs-rules"><li>${ico('check')}Одни и те же ${bt.total} вопросов для обоих</li><li>${ico('check')}Без таймера, побеждает тот, у кого больше верных</li><li>${ico('check')}Победа +${T?.win.win ?? 30}, ничья +${T?.win.draw ?? 15}, участие +${T?.win.lose ?? 5} опыта</li></ul>
        <button class="cta" type="button" data-bgo><span class="cta-main">В бой ${ico('play', 'fill')}</span><span class="cta-sub">Ответ соперника увидите после своей игры</span></button>
      </main>`;
    root.hidden = false; document.body.classList.add('playing'); replay(root, 'opening'); chime([392, 523.25], 0.1, 0.06);
    const close = () => { root.hidden = true; root.innerHTML = ''; document.body.classList.remove('playing'); };
    root.querySelector('[data-bclose]').onclick = close;
    root.querySelector('[data-bgo]').onclick = () => {
      playStep({ step: { items: bt.items }, api, toast, label: `Баттл · соперник ${bt.opp.name} · ${bt.total} вопросов`,
        submit: (answers) => api('/api/game/battle/play', { method: 'POST', body: { id: bt.id, answers } }),
        onDone: (r) => { setState(r.state); result(r); }, onClose: () => render() });
    };
  }
  function result(r) {
    const b = r.battle, root = document.getElementById('play');
    const done = b.status === 'done', win = b.result === 'win', draw = b.result === 'draw';
    root.innerHTML = `<header class="play-h"><button class="icon-btn" type="button" data-bclose aria-label="Закрыть">${ico('x')}</button><div class="play-meta"><span class="play-k">Баттл · соперник ${esc(b.opp.name)}</span></div></header>
      <main class="play-b bt-result ${done ? b.result : 'wait'}">
        <p class="bt-banner">${done ? (win ? 'Победа!' : draw ? 'Ничья' : 'В этот раз соперник сильнее') : 'Ваш ход принят'}</p>
        <div class="bt-bars">
          <div class="bt-bar bt-me"><span>Вы</span><i style="--p:${(b.my || 0) / b.total}"></i><b class="tn">${b.my} из ${b.total}</b></div>
          <div class="bt-bar bt-op"><span>${esc(b.opp.name)}</span><i style="--p:${done ? (b.opp.ok || 0) / b.total : 0}"></i><b class="tn">${done ? `${b.opp.ok ?? 0} из ${b.total}` : 'ещё играет'}</b></div>
        </div>
        <p class="muted">${done ? (r.gain ? `+${r.gain} опыта уже на счёте.` : '') : `Когда ${esc(b.opp.name)} сыграет, результат придёт уведомлением в штаб, а опыт начислится сам.`}</p>
        ${r.rankUp ? `<div class="promo">${badge(LEAGUES.indexOf(r.rankUp), 72, 'pop')}<b>Новая лига: «${esc(r.rankUp)}»</b></div>` : ''}
        <button class="cta cta-sm" type="button" data-bclose>К команде</button>
      </main>`;
    root.hidden = false; document.body.classList.add('playing');
    root.querySelectorAll('[data-bclose]').forEach((x) => x.onclick = () => { root.hidden = true; root.innerHTML = ''; document.body.classList.remove('playing'); render(); });
    if (done) setTimeout(() => (win ? chime([523.25, 659.25, 783.99, 1046.5], 0.08, 0.09) : draw ? chime([523.25, 659.25], 0.1, 0.07) : chime([392, 330], 0.12, 0.06)), 250);
    if (r.rankUp) setTimeout(() => sfx.badge(), 900);
  }
  async function challenge(pid) {
    if (busy) return; busy = true;
    try { const r = await api('/api/game/battle/new', { method: 'POST', body: { to: pid } }); document.getElementById('sheet').close(); await load(true); intro(r.battle); }
    catch (e) { toast(e.message); } finally { busy = false; }
  }
  async function playBattle(id) {
    try { await load(); const r = await api('/api/game/battle?id=' + encodeURIComponent(id)); if (!r.battle.items) return toast('Вы уже сыграли этот баттл'); intro(r.battle); } catch (e) { toast(e.message); }
  }
  async function decline(id) { try { await api('/api/game/battle/decline', { method: 'POST', body: { id } }); toast('Вызов отклонён'); render(); } catch (e) { toast(e.message); } }
  function onClick(b) {
    if (b.dataset.ttab) { tab = b.dataset.ttab; sfx.tick(); if (T) render(false); if ('scrolltop' in b.dataset) requestAnimationFrame(() => document.querySelector('.tm-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' })); return true; }
    if (b.dataset.player) { profile(b.dataset.player); return true; }
    if (b.dataset.challenge) { challenge(b.dataset.challenge); return true; }
    if (b.dataset.bplay) { playBattle(b.dataset.bplay); return true; }
    if (b.dataset.bdecline) { decline(b.dataset.bdecline); return true; }
    return false;
  }
  return { render, onClick, badge };
}
