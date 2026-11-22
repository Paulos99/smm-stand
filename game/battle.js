// Battles v2: personal async challenge with a stake. Hub with the VS dossier screen, rounds (format, plan, pitch + «Допрос»),
// round stamps and the final reveal. All scoring and money moves are on the server; this file only shows them.
import { playStep, mech, el, ico, chime, sfx, tone, replay } from './play.js?v=20261122q';
import { attachRecorder, canRecord, toUlaw, decode, b64Blob, voiceBubble, unlockAudio, stopAll } from './voice.js?v=20261122q';
import { apiRaw } from '../js/api.js?v=20261122q';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const icoH = (id, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const num = (n) => Number(n || 0).toLocaleString('ru-RU');
const RM = matchMedia('(prefers-reduced-motion: reduce)');
const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c; };
export const left = (ms) => { ms = Math.max(0, ms); const h = Math.floor(ms / 36e5), m = Math.floor(ms % 36e5 / 6e4); return h >= 24 ? `${Math.floor(h / 24)} д ${h % 24} ч` : h ? `${h} ч ${m} мин` : `${m} мин`; };
const MAXR = 20;
// sounds: a dull stamp hit, a coin, a whoosh; all behind the same mute toggle as the rest of the game
const snd = {
  stamp() { tone(140, 0.16, 0.16, 'triangle', 60); setTimeout(() => tone(90, 0.12, 0.08, 'sine', 50), 30); },
  coin(i = 0) { tone(1046 + i * 90, 0.08, 0.05, 'triangle', 1568 + i * 90); },
  whoosh() { tone(300, 0.25, 0.04, 'sawtooth', 900); },
  win() { chime([523.25, 659.25, 783.99, 1046.5, 1318.5], 0.09, 0.09); }, lose() { chime([392, 330, 262], 0.14, 0.07); }, draw() { chime([523.25, 659.25], 0.12, 0.07); },
};
const counter = (node, to, ms = 700) => new Promise((done) => { if (RM.matches || !to) { node.textContent = num(to); return done(); } const t0 = performance.now();
  const f = (t) => { const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3); node.textContent = num(Math.round(to * e)); if (k < 1) requestAnimationFrame(f); else done(); }; requestAnimationFrame(f); });
const wait = (ms) => new Promise((r) => setTimeout(r, RM.matches ? Math.min(ms, 80) : ms));

export function createBattle({ api, toast, getState, setState, avatar, badge, LEAGUES, me, player, onChange }) {
  const root = () => document.getElementById('play');
  const sheet = () => document.getElementById('sheet');
  const close = () => { const r = root(); stopAll(); r.hidden = true; r.innerHTML = ''; document.body.classList.remove('playing'); onChange?.(); };
  const show = (html, cls = '') => { const r = root(); r.innerHTML = html; r.hidden = false; document.body.classList.add('playing'); r.querySelector('main')?.classList.add(...cls.split(' ').filter(Boolean)); r.querySelectorAll('[data-bx]').forEach((x) => x.onclick = close); return r; };
  const head = (k) => `<header class="play-h"><button class="icon-btn" type="button" data-bx aria-label="Закрыть">${icoH('x')}</button><div class="play-meta"><span class="play-k">${esc(k)}</span></div></header>`;

  // ---------- challenge: pick the stake ----------
  function challengeSheet(p, b2) {
    const sh = sheet(); const max = b2.maxStake, min = b2.minStake; const can = max >= min;
    let v = Math.min(max, Math.max(min, Math.round(max / 4 / 5) * 5 || min));
    sh.innerHTML = `<form method="dialog" class="sheet-in bx-sheet">
      <div class="bx-duo">${avatar(me(), 56)}<span class="bx-x" aria-hidden="true">VS</span>${avatar(p, 56)}</div>
      <h2 id="sheet-t">Вызов: ${esc(p.name)}</h2>
      <p class="sheet-k">3 раунда: 2 случайных из «${b2.rounds.join('», «')}» и финальный допрос клиента</p>
      ${can ? `<label class="bx-stake"><span>Ваша ставка</span><b class="tn" data-sv>${v}</b><small>опыта</small>
        <input type="range" min="${min}" max="${max}" step="1" value="${v}" aria-label="Ставка в опыте" data-sr></label>
        <p class="bx-pot">${icoH('star', 'fill')}Банк <b class="tn" data-sp>${v * 2}</b><span>— победитель забирает всё</span></p>` : `<p class="pf-lock">${icoH('lock')}Для ставки нужно хотя бы ${min * 2} опыта на счёте. Сейчас ${num(b2.balance)}.</p>`}
      <ul class="bx-rules">
        <li>Соперник видит ставку и, чтобы принять вызов, ставит столько же. На ответ ${b2.acceptH} ч.</li>
        <li>После принятия на баттл ${b2.playH / 24} дня. Играть можно когда удобно, не одновременно.</li>
        <li>Кто не доиграл за ${b2.playH / 24} дня, проигрывает ставку и теряет столько опыта, сколько набрал соперник.</li>
      </ul>
      <div class="sheet-a">${can ? `<button class="cta" type="button" data-send>${icoH('vs')}Бросить вызов</button>` : ''}<button class="btn btn-ghost" value="close">Отмена</button></div></form>`;
    const r = sh.querySelector('[data-sr]'); if (r) r.oninput = () => { v = +r.value; sh.querySelector('[data-sv]').textContent = v; sh.querySelector('[data-sp]').textContent = v * 2; sfx.tick(); };
    const b = sh.querySelector('[data-send]'); if (b) b.onclick = async () => { b.disabled = true; try { const x = await api('/api/game/battle/new', { method: 'POST', hedge: false, body: { to: p.pid, stake: v } }); sh.close(); snd.stamp(); toast(`Вызов отправлен. ${v} опыта отложено до конца баттла`); onChange?.(); } catch (e) { toast(e.message); b.disabled = false; } };
    if (!sh.open) sh.showModal(); sfx.tick();
  }
  // ---------- incoming challenge ----------
  function acceptSheet(b) {
    const sh = sheet(); const bal = getState()?.balance ?? 0; const can = bal >= b.stake;
    sh.innerHTML = `<form method="dialog" class="sheet-in bx-sheet">
      <div class="bx-duo">${avatar(me(), 56)}<span class="bx-x" aria-hidden="true">VS</span>${avatar(player?.(b.opp.pid) || { name: b.opp.name }, 56)}</div>
      <h2 id="sheet-t">Агент ${esc(b.opp.name)} вызывает вас на баттл</h2>
      <p class="bx-pot bx-pot-l">${icoH('star', 'fill')}Ставка <b class="tn">${b.stake}</b> · банк <b class="tn">${b.stake * 2}</b></p>
      <p class="sheet-k">Раунды: ${b.rounds?.length ? b.rounds.map((r) => '«' + esc(r.title) + '»').join(', ') : '2 случайных и финальный допрос клиента'}. Ответить можно ещё ${left(b.acceptBy - b.now)}.</p>
      ${can ? '' : `<p class="pf-lock">${icoH('lock')}Не хватает опыта на ставку: нужно ${b.stake}, на счёте ${num(bal)}. Пройдите шаг или тренировку и возвращайтесь.</p>`}
      <div class="sheet-a"><button class="cta" type="button" data-acc ${can ? '' : 'disabled'}>${icoH('check')}Принять и поставить ${b.stake}</button><button class="btn btn-ghost" type="button" data-dec>Отклонить</button></div></form>`;
    sh.querySelector('[data-acc]').onclick = async (e) => { e.currentTarget.disabled = true; e.currentTarget.textContent = 'Штаб готовит баттл…';
      try { const r = await api('/api/game/battle/accept', { method: 'POST', body: { id: b.id }, timeout: 45000, hedge: false }); sh.close(); onChange?.(); hub(r.battle, true); } catch (er) { toast(er.message); sh.close(); onChange?.(); } };
    sh.querySelector('[data-dec]').onclick = async () => { try { await api('/api/game/battle/decline', { method: 'POST', body: { id: b.id } }); toast('Вызов отклонён'); } catch (er) { toast(er.message); } sh.close(); onChange?.(); };
    if (!sh.open) sh.showModal(); sfx.tick();
  }
  async function cancel(id) { try { await api('/api/game/battle/decline', { method: 'POST', body: { id } }); toast('Вызов отозван, ставка вернулась'); } catch (e) { toast(e.message); } onChange?.(); }

  // ---------- VS hub ----------
  const arena = (b, intro) => { const m = me(), o = player?.(b.opp.pid) || { name: b.opp.name, pid: b.opp.pid };
    return `<div class="bx-arena${intro ? ' intro' : ''}">
      <div class="bx-dos l"><span class="bx-tab">Досье</span>${avatar(m, 76)}<b>${esc(m.name)}</b><span class="tn bx-pts" data-my>${b.my.total}</span></div>
      <svg class="bx-thread" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><path d="M2 20 C 30 4, 70 36, 98 20" pathLength="100"/><circle r="2.2" class="bx-spark"><animateMotion dur="1.6s" repeatCount="indefinite" path="M2 20 C 30 4, 70 36, 98 20"/></circle></svg>
      <span class="bx-vs" aria-hidden="true">VS</span>
      <div class="bx-dos r"><span class="bx-tab">Досье</span>${avatar(o, 76)}<b>${esc(o.name)}</b>${b.status === 'done' ? `<span class="tn bx-pts">${b.opp.score.total}</span>` : '<span class="bx-secret">засекречено</span>'}</div>
    </div>`; };
  const tug = (b) => { const done = b.status === 'done', my = b.my.total, op = done ? b.opp.score.total : 0, max = b.rounds.length * MAXR;
    const k = done ? (my + op ? my / (my + op) : 0.5) : 0.5 + 0.5 * (my / max) * 0.6;
    return `<div class="bx-tug${done ? '' : ' hidden-op'}" role="img" aria-label="${done ? `Счёт ${my} : ${op}` : `Ваши очки ${my}, очки соперника засекречены`}">
      <div class="bx-rope"><i style="--k:${k.toFixed(3)}"></i><span class="bx-knot" style="--k:${k.toFixed(3)}"></span></div>
      <div class="bx-tug-l"><span>Вы <b class="tn">${my}</b></span><span>${done ? `<b class="tn">${op}</b> ${esc(b.opp.name)}` : 'досье противника засекречено, пока он не доиграет'}</span></div></div>`; };
  function hub(b, intro = false) {
    const myN = b.my.rounds, all = b.rounds.length, done = b.status === 'done';
    const next = b.status === 'open' && myN < all ? myN : -1;
    const r = show(`${head(`Баттл · ставка ${b.stake} · банк ${b.stake * 2}`)}<main class="play-b bx-hub">
      ${arena(b, intro)}
      ${tug(b)}
      <p class="bx-clock">${b.status === 'open' ? `${icoH('bolt')}До конца баттла ${left(b.playBy - b.now)}` : b.status === 'pending' ? `Ждём ответа ещё ${left(b.acceptBy - b.now)}` : ''}</p>
      <ol class="bx-rounds">${b.rounds.map((x, i) => { const m = b.my.r[i]; const st = m ? 'done' : i === next ? 'cur' : 'lock';
        return `<li class="bx-rd ${st}"><span class="bx-n tn">${i + 1}</span><div><b>${esc(x.title)}</b><p>${esc(x.about)}</p></div>${m ? `<span class="bx-stamp tn">+${m.pts}</span>` : st === 'lock' ? icoH('lock') : ''}</li>`; }).join('')}</ol>
      ${next >= 0 ? `<button class="cta" type="button" data-go-r="${next}"><span class="cta-main">Раунд ${next + 1}: ${esc(b.rounds[next].title)} ${icoH('play', 'fill')}</span><span class="cta-sub">${next === 0 ? 'Соперник увидит ваши очки только в конце' : 'Раунды идут по порядку'}</span></button>`
        : done ? '<button class="cta" type="button" data-final>Смотреть итог</button>' : b.status === 'open' ? `<p class="muted bx-wait">Ваша часть сыграна. Когда ${esc(b.opp.name)} доиграет, итог придёт уведомлением.</p>` : ''}
    </main>`);
    if (intro && !RM.matches) { snd.whoosh(); setTimeout(() => snd.stamp(), 520); }
    r.querySelector('[data-go-r]')?.addEventListener('click', () => playRound(b, next));
    r.querySelector('[data-final]')?.addEventListener('click', () => final(b));
  }
  async function open(id, intro = true) { try { const r = await api('/api/game/battle?id=' + encodeURIComponent(id)); if (r.battle.v !== 2) return toast('Это баттл старого формата'); if (r.battle.status === 'done') return final(r.battle); hub(r.battle, intro); } catch (e) { toast(e.message); } }

  // ---------- one round ----------
  async function playRound(b, i) {
    let s; try { s = await api('/api/game/battle/start', { method: 'POST', body: { id: b.id, i } }); } catch (e) { return toast(e.message); }
    const label = `Баттл · раунд ${s.i + 1} из ${b.rounds.length} · ${s.title}`;
    const submit = (answer) => api('/api/game/battle/round', { method: 'POST', body: { id: b.id, i: s.i, answer }, timeout: 60000, hedge: false });
    if (s.kind === 'dopros') {
      playStep({ step: { client: s.client, items: [{ type: 'brief', greet: s.greet, stages: [], topics: [] }, { type: 'boffer', client: s.client }] }, api, toast, label,
        battle: { id: b.id, max: s.maxQ, msgs: s.msgs }, submit: (ans) => submit({ offer: ans[1]?.offer || '' }), onDone: (r) => roundDone(r), onClose: () => open(b.id, false) });
    } else {
      playStep({ step: { items: [{ type: 'b' + s.kind, ...s.task, started: s.started, now: s.now, bid: b.id }] }, api, toast, label, submit: (ans) => submit(ans[0] || {}), onDone: (r) => roundDone(r), onClose: () => open(b.id, false) });
    }
  }
  function roundDone(r) {
    if (r.state) setState(r.state);
    const b = r.battle, x = r.round, kind = b.rounds[x.i].kind, last = x.i === b.rounds.length - 1;
    const detail = kind === 'format' ? `<p>${x.hit === 'best' ? 'Лучший формат!' : x.hit === 'ok' ? `Неплохо, но лучше «${esc(x.best)}»` : `Лучший формат здесь: «${esc(x.best)}»`}</p>${x.verdict ? `<p class="bx-verdict">${esc(x.verdict)}</p>` : ''}`
      : kind === 'plan' ? `<p>На своих местах <b class="tn">${x.ok} из ${x.n}</b> идей · ${x.sec} с${x.late ? ` · штраф за время −${x.late}` : ''}</p>`
      : kind === 'pitch' ? `${x.reply ? `<blockquote class="bx-reply">«${esc(x.reply)}»</blockquote>` : ''}${x.verdict ? `<p class="bx-verdict">${esc(x.verdict)}</p>` : ''}`
      : `<p>Факты: <b class="tn">${x.facts} из ${x.n}</b>${x.got?.length ? ` (${x.got.map(esc).join(', ')})` : ''} · идея <b class="tn">${x.idea}/10</b></p>${x.verdict ? `<p class="bx-verdict">${esc(x.verdict)}</p>` : ''}`;
    const rt = show(`${head(`Баттл · раунд ${x.i + 1} из ${b.rounds.length}`)}<main class="play-b bx-rres">
      <p class="bx-k">${esc(b.rounds[x.i].title)}</p>
      <div class="bx-hit"><span class="bx-big-stamp tn">+${x.pts}</span><small>из ${MAXR}</small></div>
      ${x.canned ? '<p class="bx-warn">Ответ похож на ваш прошлый. За повтор заготовки судья снял половину баллов.</p>' : ''}
      <div class="bx-detail">${detail}</div>
      ${tug(b)}
      ${b.status === 'done' ? '<button class="cta" type="button" data-final>Вскрыть досье соперника</button>' : last ? `<p class="muted">Ваша часть сыграна. Итог откроется, когда ${esc(b.opp.name)} доиграет${b.playBy ? ` (ещё до ${left(b.playBy - b.now)})` : ''}.</p><button class="cta cta-sm" type="button" data-bx>К команде</button>` : `<button class="cta" type="button" data-next>Раунд ${x.i + 2}: ${esc(b.rounds[x.i + 1].title)}</button>`}
    </main>`);
    setTimeout(() => { snd.stamp(); x.pts >= 14 ? chime([659.25, 987.77], 0.08, 0.07) : null; }, RM.matches ? 0 : 260);
    rt.querySelector('[data-next]')?.addEventListener('click', () => playRound(b, x.i + 1));
    rt.querySelector('[data-final]')?.addEventListener('click', () => final(b, r));
  }

  // ---------- final reveal ----------
  async function final(b, r) {
    const res = b.result, win = res === 'win', draw = res === 'draw', opp = b.opp.score;
    const pay = b.pay || {}, delta = (pay.xp || 0) + (pay.stake || 0) + (pay.penalty || 0);
    const claim = (r?.claims || []).find((c) => c.id === b.id);
    const stampT = win ? 'Победа' : draw ? 'Ничья' : 'Провал';
    const rt = show(`${head(`Баттл · итог · соперник ${b.opp.name}`)}<main class="play-b bx-final ${res}">
      ${arena(b, false)}
      <table class="bx-table"><thead><tr><th>Раунд</th><th>Вы</th><th>${esc(b.opp.name)}</th></tr></thead><tbody>
        ${b.rounds.map((x, i) => `<tr><td>${esc(x.title)}</td><td class="tn" data-c="${b.my.r[i]?.pts ?? 0}">0</td><td class="tn" data-c="${opp.r[i]?.pts ?? 0}">0</td></tr>`).join('')}
        <tr class="tot"><td>Итого</td><td class="tn" data-c="${b.my.total}">0</td><td class="tn" data-c="${opp.total}">0</td></tr></tbody></table>
      <div class="bx-final-stamp" aria-live="polite"><span>${stampT}</span></div>
      <p class="bx-sum">${b.tech ? (win ? 'Соперник не доиграл за 2 дня: техническая победа. ' : 'Вы не доиграли за 2 дня: техническое поражение. ') : ''}${delta >= 0 ? `+${delta}` : `−${Math.abs(delta)}`} опыта${pay.stake ? ` (ставка ${pay.stake > 0 ? '+' : '−'}${Math.abs(pay.stake)})` : ''}${pay.penalty ? `, штраф ${pay.penalty}` : ''}${claim?.bonus ? `, серия побед +${claim.bonus}` : ''}.</p>
      ${claim?.streak > 1 ? `<p class="bx-streak">${icoH('flame', 'fill')}Серия побед: ${claim.streak}</p>` : ''}
      <div class="bx-verdicts">${[['Вы', b.my.r.at(-1)], [b.opp.name, opp.r.at(-1)]].filter(([, v]) => v?.verdict).map(([n, v]) => `<div><b>${esc(n)} · допрос</b><p>${esc(v.verdict)}</p></div>`).join('')}</div>
      <button class="cta cta-sm" type="button" data-bx>К команде</button>
    </main>`);
    const cells = [...rt.querySelectorAll('[data-c]')];
    const stamp = rt.querySelector('.bx-final-stamp');
    for (let k = 0; k < cells.length; k += 2) { await wait(320); snd.coin(k / 2); await Promise.all([counter(cells[k], +cells[k].dataset.c, 500), counter(cells[k + 1], +cells[k + 1].dataset.c, 500)]);
      const a = +cells[k].dataset.c, o = +cells[k + 1].dataset.c; if (a !== o) (a > o ? cells[k] : cells[k + 1]).classList.add('lead'); }
    await wait(300); stamp.classList.add('in'); snd.stamp(); setTimeout(() => (win ? snd.win() : draw ? snd.draw() : snd.lose()), 200);
    if (!draw && b.stake) potFly(rt, win);
  }
  function potFly(rt, win) { // the pot flies to the winner's dossier
    if (RM.matches) return; const to = rt.querySelector(`.bx-dos.${win ? 'l' : 'r'} .ava, .bx-dos.${win ? 'l' : 'r'} .avf`); const from = rt.querySelector('.bx-final-stamp'); if (!to || !from) return;
    const a = from.getBoundingClientRect(), z = to.getBoundingClientRect();
    for (let i = 0; i < 9; i++) { const c = document.createElement('span'); c.className = 'bx-coin'; c.innerHTML = icoH('star', 'fill'); document.body.append(c);
      const x0 = a.left + a.width / 2 + (Math.random() - 0.5) * 60, y0 = a.top + a.height / 2, x1 = z.left + z.width / 2, y1 = z.top + z.height / 2;
      c.animate([{ transform: `translate(${x0}px,${y0}px) scale(.6)`, opacity: 0 }, { transform: `translate(${(x0 + x1) / 2}px,${Math.min(y0, y1) - 80}px) scale(1.1)`, opacity: 1, offset: 0.5 }, { transform: `translate(${x1}px,${y1}px) scale(.5)`, opacity: 0.2 }],
        { duration: 800, delay: 400 + i * 70, easing: 'cubic-bezier(.33,0,.15,1)', fill: 'forwards' }).onfinish = () => { c.remove(); snd.coin(i % 4); }; }
  }
  return { challengeSheet, acceptSheet, cancel, open, hub };
}

// ---------- round screens (registered into the step player) ----------
const timer = (limit, started, now) => { const off = Date.now() - (now || Date.now()); const t0 = (started || Date.now()) + off;
  const box = el('div', { class: 'bx-timer', role: 'timer', 'aria-live': 'off' }, el('span', { class: 'bx-timer-ring' }), el('b', { class: 'tn' }, String(limit)));
  let id = 0; const tick = () => { const sec = (Date.now() - t0) / 1000, l = Math.ceil(limit - sec); box.querySelector('b').textContent = l >= 0 ? String(l) : `+${-l}`; box.style.setProperty('--p', Math.max(0, Math.min(1, sec / limit))); box.classList.toggle('over', l < 0); box.classList.toggle('low', l <= 5 && l >= 0); };
  tick(); id = setInterval(tick, 250); return { box, stop: () => clearInterval(id) }; };

mech.bformat = (it, c) => new Promise((done) => {
  let choice = -1; const reason = el('textarea', { rows: 3, maxlength: 400, placeholder: 'Почему этот формат? Одно-два предложения', 'aria-label': 'Почему этот формат', oninput: () => sync() });
  const go = el('button', { class: 'cta', type: 'button', disabled: true, onclick: () => { c.answer({ choice, reason: reason.value.trim() }); done(); } }, 'Ответить');
  const opts = el('div', { class: 'opts bx-opts', role: 'radiogroup', 'aria-label': 'Формат' }, it.options.map((o, i) => el('button', { class: 'opt', type: 'button', role: 'radio', 'aria-checked': 'false', onclick: (e) => { choice = i; opts.querySelectorAll('.opt').forEach((b) => { b.classList.toggle('on', b === e.currentTarget); b.setAttribute('aria-checked', String(b === e.currentTarget)); }); sync(); } }, el('span', { class: 'opt-t' }, o))));
  function sync() { go.disabled = choice < 0; }
  c.body.append(el('div', { class: 'bx-card' }, el('span', { class: 'bx-k' }, 'Ниша'), el('b', {}, it.niche), el('span', { class: 'bx-k' }, 'Цель'), el('p', {}, it.goal)), el('p', { class: 'q' }, 'Какой формат сработает лучше всего?'), opts, reason);
  c.foot.replaceChildren(go);
});
const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
mech.bplan = (it, c) => new Promise((done) => {
  const t = timer(it.limit || 60, it.started, it.now); const pick = Array(it.ideas.length).fill(-1);
  const go = el('button', { class: 'cta', type: 'button', disabled: true, onclick: () => { t.stop(); c.answer({ days: pick }); done(); } }, 'Готово');
  const rows = it.ideas.map((txt, k) => { const chips = DAYS.map((d, di) => el('button', { class: 'bx-day', type: 'button', 'aria-pressed': 'false', 'aria-label': `${txt}: ${d}`, onclick: () => set(k, di) }, d));
    return { li: el('li', { class: 'bx-pl' }, el('span', { class: 'bx-pl-t' }, txt), el('div', { class: 'bx-days' }, chips)), chips }; });
  function set(k, di) { pick.forEach((v, j) => { if (j !== k && v === di) pick[j] = -1; }); pick[k] = pick[k] === di ? -1 : di;
    rows.forEach((r, j) => r.chips.forEach((ch, x) => { const on = pick[j] === x; ch.setAttribute('aria-pressed', String(on)); ch.classList.toggle('on', on); ch.classList.toggle('taken', !on && pick.includes(x)); }));
    const n = pick.filter((v) => v >= 0).length; go.disabled = n < pick.length; go.textContent = n < pick.length ? `Готово (${n} из ${pick.length})` : 'Готово'; }
  c.body.append(el('div', { class: 'bx-plan-h' }, el('div', {}, el('span', { class: 'bx-k' }, it.client), el('p', { class: 'bx-brief' }, it.brief)), t.box), el('ol', { class: 'bx-plan' }, rows.map((r) => r.li)));
  c.foot.replaceChildren(go); set(-1, -1);
  addEventListener('hashchange', t.stop, { once: true });
});
mech.bpitch = (it, c) => new Promise((done) => {
  const t = timer(it.limit || 30, it.started, it.now);
  const input = el('textarea', { rows: 4, maxlength: 900, placeholder: 'Ваш питч: ответьте на сомнение, дайте выгоду и цифру', 'aria-label': 'Ваш питч', oninput: () => sync() });
  const go = el('button', { class: 'cta', type: 'button', disabled: true, onclick: () => { t.stop(); stopAll(); c.answer({ text: input.value.trim() }); done(); } }, 'Убедить');
  const micB = el('button', { class: 'icon-btn send mic', type: 'button', 'aria-label': 'Сказать голосом: удерживайте и говорите' }, ico('mic'));
  const hear = el('button', { class: 'btn-ghost btn-s', type: 'button', onclick: () => listen() }, ico('sound'), 'Послушать');
  const comp = el('div', { class: 'composer' }, input, micB); const note = el('p', { class: 'fine', 'aria-live': 'polite' });
  function sync() { go.disabled = input.value.trim().length < 5; }
  async function listen() { hear.disabled = true; unlockAudio(); try { const r = await c.api('/api/game/battle/tts', { method: 'POST', body: { id: it.bid }, timeout: 30000 }); const blob = b64Blob(r.audio); let peaks, dur = 0; try { const b = await decode(blob); dur = b.duration; } catch {} const vb = voiceBubble('in', { blob, dur, text: '', name: it.name }); hear.replaceWith(vb.root); vb.play(); } catch (e) { hear.disabled = false; c.toast?.(e.message); } }
  if (canRecord()) attachRecorder(micB, { host: comp, onSend: async (r) => { note.textContent = 'Расшифровываю…'; try { let buf = r.buf; buf ||= await decode(r.blob); const s = await apiRaw('/api/game/stt', await toUlaw(buf)); input.value = (input.value ? input.value + ' ' : '') + s.text; note.textContent = 'Проверьте текст и жмите «Убедить»'; sync(); } catch (e) { note.textContent = e.message; } }, onError: (m) => { note.textContent = m; }, onState: (st) => comp.classList.toggle('recording', st !== 'idle'), tick: () => {} });
  else micB.hidden = true;
  c.body.append(el('div', { class: 'bx-plan-h' }, el('div', { class: 'chat-top' }, el('span', { class: 'ava', 'aria-hidden': 'true' }, it.name[0]), el('div', { class: 'chat-who' }, el('b', {}, it.name), el('span', {}, it.role + ' · играет ИИ'))), t.box),
    el('div', { class: 'bub bub-in bx-doubt' }, it.doubt), hear, el('p', { class: 'q' }, 'У вас 30 секунд, чтобы убедить клиента'));
  c.foot.replaceChildren(comp, note, go); input.focus({ preventScroll: true });
  addEventListener('hashchange', t.stop, { once: true });
});
mech.boffer = (it, c) => new Promise((done) => {
  const input = el('textarea', { rows: 6, maxlength: 1200, placeholder: 'Для кого, что сделать, какое действие читателя и как поймём, что сработало', 'aria-label': 'Ваша идея для клиента', oninput: () => { go.disabled = input.value.trim().length < 20; } });
  const go = el('button', { class: 'cta', type: 'button', disabled: true, onclick: () => { c.answer({ offer: input.value.trim() }); done(); } }, 'Сдать идею судье');
  c.body.append(el('p', { class: 'bx-k' }, `Клиент: ${it.client?.name || ''}`), el('h2', { class: 'q' }, 'Ваша идея для клиента'), el('p', { class: 'muted' }, 'Судья проверит, сколько фактов вы узнали и насколько идея опирается на них. Общие слова и заготовки оцениваются низко.'), input);
  c.foot.replaceChildren(go); input.focus({ preventScroll: true });
});
