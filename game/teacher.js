// Teacher cabinet: students progress, hardest steps, missions editor + judging, photo moderation.
import { sfx, chime, stagger, replay } from './play.js?v=20261122c';
import { img, left } from './missions.js?v=20261122c';
import { badge, avatar } from './team.js?v=20261122c';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ico = (id, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const MECH = { quiz: 'Тест', swipe: 'Свайпы', vs: 'Что лучше', sort: 'Сортировка', pairs: 'Пары', cloze: 'Пропуски', field: 'Поле', chat: 'Чат', brief: 'Бриф', boss: 'Финал', interrogate: 'Допрос', dossier: 'Досье', storm: 'Шторм', blocks: 'Блоки', puzzle: 'Пазл' };
const ago = (t) => { if (!t) return '—'; const m = Math.round((Date.now() - t) / 6e4); return m < 2 ? 'только что' : m < 60 ? `${m} мин назад` : m < 1440 ? `${Math.round(m / 60)} ч назад` : `${Math.round(m / 1440)} дн назад`; };
const STATUS = { draft: 'Черновик', open: 'Идёт приём', judging: 'Ждёт итогов', done: 'Итоги подведены' };
const local = (t) => { const d = new Date(t - new Date(t).getTimezoneOffset() * 6e4); return d.toISOString().slice(0, 16); };

export function createTeacher({ api, toast }) {
  let D = null, tab = 'students', edit = null, pick = {};
  const root = () => document.getElementById('view-teach');
  async function render(reload = true) {
    const r = root(); if (!r) return;
    if (reload || !D) { if (!D) r.innerHTML = '<p class="loading">Собираем данные команды…</p>'; try { D = await api('/api/game/teacher'); } catch (e) { r.innerHTML = `<p class="loading">${esc(e.message)}</p>`; return; } }
    const subsN = D.missions.filter((m) => m.status === 'judging').length;
    r.innerHTML = `<header class="tc-h"><p class="th-k">${ico('chart')}Кабинет преподавателя</p><h1>Как идёт команда</h1></header>
      <div class="seg tc-tabs" role="tablist">${[['students', 'Ученики'], ['missions', `Миссии${subsN ? ` <i class="dot-n">${subsN}</i>` : ''}`], ['photos', 'Фото']].map(([k, t]) => `<button type="button" role="tab" aria-selected="${tab === k}" class="${tab === k ? 'is-on' : ''}" data-tc-tab="${k}">${t}</button>`).join('')}</div>
      <div class="tc-body">${tab === 'students' ? students() : tab === 'missions' ? missions() : photos()}</div>`;
    stagger(r.querySelector('.tc-body'), ':scope > *', 50); replay(r.querySelector('.tc-body'), 'v-in');
  }
  function students() {
    const s = D.students, avg = s.length ? (s.reduce((a, x) => a + x.avg, 0) / s.length).toFixed(1) : '—';
    const active = s.filter((x) => Date.now() - x.last < 7 * 864e5).length;
    return `<dl class="tc-sum"><div><dt>Агентов</dt><dd class="tn">${s.length}</dd></div><div><dt>Активны за неделю</dt><dd class="tn">${active}</dd></div><div><dt>Средняя оценка шага</dt><dd class="tn">${avg} <small>из 3</small></dd></div><div><dt>Звёзд всего</dt><dd class="tn">${s.reduce((a, x) => a + x.stars, 0)}</dd></div></dl>
      <section class="tc-card"><h2>Ученики</h2><p class="muted">Где застрял — первый шаг текущей операции, на котором меньше трёх звёзд.</p>
      <ul class="tc-st">${s.map((x) => `<li><div class="tc-who">${avatar(x, 40)}<div><b>${esc(x.name)}</b><span class="lg-n">${badge(x.league, 16)}${x.xp} опыта · ${x.stars} ★</span></div></div>
        <div class="tc-where"><span class="muted">Сейчас</span><b>Оп. ${x.where.op}, шаг ${x.where.step}</b><span>${esc(x.where.title)}${x.where.stars != null ? ` · ${x.where.stars} ★` : x.where.briefed ? '' : ' · теория не открыта'}</span></div>
        <div class="tc-num"><span class="muted">Средняя</span><b class="tn ${x.avg && x.avg < 2.3 ? 'warn' : ''}">${x.avg || '—'}</b></div>
        <div class="tc-num"><span class="muted">Заходил</span><b>${ago(x.last)}</b></div></li>`).join('') || '<li class="muted">Пока никто не играл</li>'}</ul></section>
      <section class="tc-card"><h2>Самые трудные шаги</h2><p class="muted">Средняя оценка всех попыток. Сюда стоит вернуться на занятии.</p>
      <ol class="tc-hard">${D.hard.filter((h) => h.below).map((h) => `<li><span class="tc-id tn">${h.op}.${h.n}</span><div><b>${esc(h.title)}</b><span class="muted">${MECH[h.m] || h.m} · ${h.tried} ${h.tried === 1 ? 'попытка' : 'попыток'}, ниже трёх звёзд: ${h.below}</span></div><span class="tc-bar" style="--p:${h.avg / 3}"><i></i><b class="tn">${h.avg}</b></span></li>`).join('') || (D.hard.length ? '<li class="muted">Пока все попытки на три звезды. Трудных шагов нет.</li>' : '<li class="muted">Данных пока мало</li>')}</ol></section>`;
  }
  function missions() {
    if (edit) return editor();
    return `<div class="tc-row"><h2>Миссии недели</h2><button class="cta cta-sm" type="button" data-tc-new>${ico('target')}Новая миссия</button></div>
      ${D.missions.map((m) => { const sent = m.subs.filter((s) => s.sent); const p = pick[m.id] || [];
        return `<section class="tc-card tc-m"><div class="tc-mh"><div><span class="tc-badge st-${m.status}">${STATUS[m.status] || m.status}</span><h3>${esc(m.title)}</h3><span class="muted">${m.status === 'open' ? `осталось ${left(m.deadline - Date.now())}` : new Date(m.deadline).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} · ${sent.length} работ из ${m.subs.length} участников</span></div>
          ${m.status !== 'done' ? `<button class="btn-ghost btn-s" type="button" data-tc-edit="${m.id}">Изменить</button>` : ''}</div>
          ${m.status === 'done' ? `<ol class="tc-win">${m.winners.map((w) => `<li><b>${w.place}</b>${esc(w.name)}</li>`).join('')}</ol>` : ''}
          ${sent.length && m.status !== 'done' && m.status !== 'draft' ? `<p class="fine">Нажмите на работы по порядку: первая — 1 место, вторая — 2, третья — 3.</p>` : ''}
          <ul class="tc-subs">${sent.map((s) => { const i = p.indexOf(s.pid); return `<li class="${i >= 0 ? 'is-pick' : ''}"><button type="button" class="tc-sub" ${m.status === 'done' || m.status === 'draft' ? 'disabled' : ''} data-tc-pick="${m.id}|${s.pid}" aria-pressed="${i >= 0}">
            ${i >= 0 ? `<span class="tc-place">${i + 1}</span>` : ''}<b>${esc(s.name)}</b><span class="tc-txt">${esc(s.text)}</span>${s.img ? `<img src="${esc(img(s.img))}" alt="Картинка работы" loading="lazy">` : ''}</button>${s.link ? `<a href="${esc(s.link)}" target="_blank" rel="noopener nofollow">${ico('ext')}${esc(s.link.replace(/^https?:\/\//, '').slice(0, 40))}</a>` : ''}</li>`; }).join('') || (m.status === 'draft' ? '' : '<li class="muted">Работ пока нет</li>')}</ul>
          ${p.length && m.status !== 'done' ? `<button class="cta" type="button" data-tc-judge="${m.id}"><span class="cta-main">Подвести итоги: ${p.length} ${p.length === 1 ? 'победитель' : 'победителя'}</span></button>` : ''}</section>`; }).join('') || '<p class="muted">Миссий пока нет. Создайте первую — она появится на карте у всех агентов.</p>'}`;
  }
  function editor() {
    const m = edit.id ? D.missions.find((x) => x.id === edit.id) : null;
    const dl = m ? m.deadline : (() => { const d = new Date(); d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7)); d.setHours(21, 0, 0, 0); return +d; })();
    return `<form class="tc-card tc-ed" novalidate><h2>${m ? 'Изменить миссию' : 'Новая миссия'}</h2>
      <label class="fld"><span>Название</span><input name="title" maxlength="90" required value="${esc(m?.title || '')}" placeholder="Пост для кофейни на вторник"></label>
      <label class="fld"><span>Клиент <small class="muted">(необязательно)</small></span><input name="client" maxlength="80" value="${esc(m?.client || '')}" placeholder="Кофейня «Точка тепла»"></label>
      <label class="fld"><span>Задание</span><textarea name="task" rows="6" maxlength="2500" required placeholder="Что нужно сделать, для кого, какие ограничения">${esc(m?.task || '')}</textarea></label>
      <label class="fld"><span>Критерии, каждый с новой строки</span><textarea name="criteria" rows="3" maxlength="900" placeholder="Понятная выгода для гостя">${esc((m?.criteria || []).join('\n'))}</textarea></label>
      <label class="fld"><span>Бонус победителям <small class="muted">(необязательно)</small></span><input name="perk" maxlength="90" value="${esc(m?.perk || '')}" placeholder="Разбор работы на занятии"></label>
      <label class="fld"><span>Приём работ до</span><input name="deadline" type="datetime-local" required value="${local(dl)}"></label>
      <p class="fine">Опыт победителям: 150, 100 и 70 за 1–3 место, плюс редкий знак «Лучшая работа недели».</p>
      <p class="err" role="alert"></p>
      <div class="tc-act"><button class="cta cta-sm" type="submit" data-pub="1">${m?.status === 'open' ? 'Сохранить' : 'Опубликовать'}</button>${m?.status !== 'open' ? '<button class="btn btn-ghost" type="submit" data-pub="0">Сохранить черновик</button>' : ''}<button class="btn btn-ghost" type="button" data-tc-cancel>Отмена</button></div></form>`;
  }
  function photos() {
    const ph = D.students.filter((s) => s.photo);
    return `<section class="tc-card"><h2>Фото агентов</h2><p class="muted">Скрытое фото пропадает из топа, баттлов и профиля. Агент видит, что фото скрыто, и может загрузить другое.</p>
      <ul class="tc-ph">${ph.map((s) => `<li class="${s.photoHidden ? 'is-hid' : ''}"><img src="${esc(img(s.photo))}" alt="Фото: ${esc(s.name)}" width="96" height="96" loading="lazy"><b>${esc(s.name)}</b><button class="btn-ghost btn-s" type="button" data-tc-ph="${s.pid}|${s.photoHidden ? 0 : 1}">${s.photoHidden ? 'Вернуть' : 'Скрыть'}</button></li>`).join('') || '<li class="muted">Фото пока никто не загрузил</li>'}</ul></section>`;
  }
  async function onClick(b) {
    if (b.dataset.tcTab) { tab = b.dataset.tcTab; edit = null; sfx.tick(); render(false); return true; }
    if ('tcNew' in b.dataset) { edit = {}; sfx.page(); render(false); return true; }
    if (b.dataset.tcEdit) { edit = { id: b.dataset.tcEdit }; sfx.page(); render(false); return true; }
    if ('tcCancel' in b.dataset) { edit = null; render(false); return true; }
    if (b.dataset.tcPick) { const [mid, pid] = b.dataset.tcPick.split('|'); const p = pick[mid] ||= []; const i = p.indexOf(pid); if (i >= 0) p.splice(i, 1); else if (p.length < 3) p.push(pid); else toast('Можно выбрать до трёх работ'); sfx.tick(); render(false); return true; }
    if (b.dataset.tcJudge) { const id = b.dataset.tcJudge; if (!confirm('Подвести итоги? Победители получат награды, изменить выбор будет нельзя.')) return true; b.disabled = true;
      try { await api('/api/game/teacher/judge', { method: 'POST', body: { id, winners: pick[id] } }); delete pick[id]; chime([523.25, 659.25, 783.99, 1046.5], 0.08, 0.09); toast('Итоги подведены, победители увидят награду'); render(); } catch (e) { toast(e.message); b.disabled = false; } return true; }
    if (b.dataset.tcPh) { const [pid, h] = b.dataset.tcPh.split('|'); b.disabled = true; try { await api('/api/game/teacher/photo', { method: 'POST', body: { pid, hidden: h === '1' } }); toast(h === '1' ? 'Фото скрыто' : 'Фото снова видно'); render(); } catch (e) { toast(e.message); b.disabled = false; } return true; }
    return false;
  }
  document.addEventListener('submit', async (e) => {
    const f = e.target.closest('.tc-ed'); if (!f) return; e.preventDefault(); const sb = e.submitter; const er = f.querySelector('.err'); er.textContent = '';
    const body = { m: { id: edit?.id, title: f.title.value.trim(), client: f.client.value.trim(), task: f.task.value.trim(), criteria: f.criteria.value, perk: f.perk.value.trim(), deadline: new Date(f.deadline.value).toISOString(), publish: sb?.dataset.pub !== '0' } };
    if (body.m.title.length < 4 || body.m.task.length < 20) { er.textContent = 'Заполните название и задание (от 20 знаков)'; return; }
    f.querySelectorAll('button').forEach((x) => (x.disabled = true));
    try { await api('/api/game/teacher/mission', { method: 'POST', body }); edit = null; chime([659.25, 880], 0.08, 0.08); toast(body.m.publish ? 'Миссия на карте у всех агентов' : 'Черновик сохранён'); render(); }
    catch (x) { er.textContent = x.message; f.querySelectorAll('button').forEach((y) => (y.disabled = false)); }
  });
  return { render, onClick };
}
