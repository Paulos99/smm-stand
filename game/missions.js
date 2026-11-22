// Weekly missions (real cases), photo editor for the agent profile. Server validates everything.
import { chime, sfx, replay, stagger } from './play.js?v=20261122e';
import { API_BASES } from '../js/config.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ico = (id, cls = '') => `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
export const img = (p) => (p ? (p.startsWith('/api/') ? API_BASES[0] + p : p) : '');
const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c; };
export function left(ms) {
  if (ms <= 0) return 'срок вышел';
  const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60;
  return d ? `${d} ${plural(d, 'день', 'дня', 'дней')} ${h} ч` : h ? `${h} ч ${m} мин` : `${Math.max(1, m)} мин`;
}
const PLACE = ['1 место', '2 место', '3 место'];
const dateRu = (t) => new Date(t).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

// downscale an image file on the client: max side, JPEG quality, returns data URL
export function shrink(file, max = 1100, q = 0.78, limit = 115000) {
  return new Promise((res, rej) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return rej(new Error('Нужна картинка JPG, PNG или WebP'));
    const u = URL.createObjectURL(file), im = new Image();
    im.onload = () => { let w = im.naturalWidth, h = im.naturalHeight, k = Math.min(1, max / Math.max(w, h)); const c = document.createElement('canvas');
      let out = ''; for (let qq = q; qq > 0.4; qq -= 0.08) { c.width = Math.round(w * k); c.height = Math.round(h * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); out = c.toDataURL('image/jpeg', qq); if (out.length * 0.75 < limit) break; k *= 0.88; }
      URL.revokeObjectURL(u); out.length * 0.75 < limit ? res(out) : rej(new Error('Картинка слишком большая')); };
    im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('Не удалось открыть картинку')); }; im.src = u;
  });
}

export function createMissions({ api, toast, getState, refresh }) {
  let M = null, tick = null;
  async function load() { M = await api('/api/game/missions'); return M; }
  // card on the map, above the operations
  async function card() {
    const box = document.getElementById('mission-card'); if (!box) return;
    try { await load(); } catch { box.innerHTML = ''; return; }
    const m = M.current; if (!m) { box.innerHTML = ''; return; }
    const draw = () => {
      const ms = m.deadline - Date.now(), open = m.status === 'open' && ms > 0;
      box.innerHTML = `<button class="mc mc-${open ? 'open' : m.status}" type="button" data-mission>
        <img class="mc-st" src="../assets/stickers/mission-best.webp" alt="" width="84" height="91">
        <span class="mc-k">${ico('target')}Миссия недели${m.client ? ` · ${esc(m.client)}` : ''}</span>
        <b class="mc-t">${esc(m.title)}</b>
        <span class="mc-meta">${open ? `<span class="mc-time tn">${ico('flame')}осталось ${left(ms)}</span>` : m.status === 'done' ? '<span class="mc-time">Итоги подведены</span>' : '<span class="mc-time">Идёт отбор работ</span>'}
          <span class="tn">${m.counts?.sent || 0} ${plural(m.counts?.sent || 0, 'работа', 'работы', 'работ')}</span></span>
        <span class="mc-cta">${M.mine?.sent ? 'Ваша работа отправлена' : open ? (M.mine ? 'Отправить работу' : 'Участвовать') : m.status === 'done' ? 'Смотреть победителей' : 'Работы на проверке'} ${ico('chev')}</span>
      </button>`;
    };
    draw(); clearInterval(tick); tick = setInterval(draw, 30000);
  }
  async function open() {
    const root = document.getElementById('play');
    root.innerHTML = '<div class="play-wait"><span class="spin" aria-hidden="true"></span>Открываем миссию…</div>'; root.hidden = false; document.body.classList.add('playing'); replay(root, 'opening');
    try { await load(); } catch (e) { toast(e.message); return close(); }
    const m = M.current, mine = M.mine; if (!m) { toast('Миссии пока нет'); return close(); }
    const ms = m.deadline - Date.now(), isOpen = m.status === 'open' && ms > 0;
    root.innerHTML = `<header class="play-h"><button class="icon-btn" type="button" data-mclose aria-label="Закрыть">${ico('x')}</button><div class="play-meta"><span class="play-k">Миссия недели${m.client ? ' · ' + esc(m.client) : ''}</span></div></header>
      <main class="play-b mis">
        <section class="mis-hero">
          <img src="../assets/stickers/mission-best.webp" alt="Редкий знак «Лучшая работа недели»" width="150" height="163" class="mis-st">
          <div><p class="th-k">${ico('target')}Реальный кейс</p><h1>${esc(m.title)}</h1>
          <p class="mis-time ${isOpen ? '' : 'off'}">${isOpen ? `${ico('flame')}<span>Приём работ до ${dateRu(m.deadline)}<br>Осталось <b class="tn">${left(ms)}</b></span>` : m.status === 'done' ? 'Итоги подведены' : 'Срок вышел, преподаватель выбирает лучшие работы'}</p></div>
        </section>
        <section class="mis-card"><h2>Задание</h2><p class="mis-task">${esc(m.task).replace(/\n/g, '<br>')}</p>
          ${m.criteria.length ? `<h3>Как будем оценивать</h3><ul class="mis-crit">${m.criteria.map((c) => `<li>${ico('check')}${esc(c)}</li>`).join('')}</ul>` : ''}</section>
        <section class="mis-card mis-prize"><h2>Награда лучшим</h2>
          <ol class="mis-places">${m.xp.map((x, i) => `<li><b>${PLACE[i]}</b><span class="tn">+${x} опыта</span></li>`).join('')}</ol>
          <p>Победители получают редкий знак «Лучшая работа недели»${m.perk ? ` и бонус: <b>${esc(m.perk)}</b>` : ''}.</p></section>
        ${m.status === 'done' ? winnersHtml(m) : ''}
        ${isOpen ? formHtml(mine) : mine?.sent ? `<section class="mis-card"><h2>Ваша работа</h2><p class="mis-task">${esc(mine.text)}</p>${mine.img ? `<img class="mis-img" src="${esc(img(mine.img))}" alt="Ваша картинка">` : ''}</section>` : ''}
        ${M.archive.length ? `<section class="mis-card"><h2>Архив миссий</h2>${M.archive.map((a) => `<details class="mis-arch"><summary><b>${esc(a.title)}</b><span class="muted">${a.winners.map((w) => esc(w.name)).join(', ') || 'без победителей'}</span>${ico('chev', 'toc-chev')}</summary>${winnersHtml(a, true)}</details>`).join('')}</section>` : ''}
      </main>`;
    stagger(root.querySelector('.mis'), ':scope > section', 60); root.querySelector('.mis').classList.add('step-in'); sfx.page();
    root.querySelector('[data-mclose]').onclick = close;
    const f = root.querySelector('.mis-form'); if (f) bindForm(f, m, mine);
  }
  function winnersHtml(m, inner) {
    return `${inner ? '' : '<section class="mis-card mis-win"><h2>Победители</h2>'}<ol class="mis-wl">${m.winners.map((w) => `<li class="pl-${w.place}"><span class="mis-place">${w.place}</span><div><b>${esc(w.name)}</b><p>${esc(w.text)}</p>${w.img ? `<img class="mis-img" src="${esc(img(w.img))}" alt="Работа: ${esc(w.name)}" loading="lazy">` : ''}${w.link ? `<a href="${esc(w.link)}" target="_blank" rel="noopener nofollow">${ico('ext')}Ссылка на работу</a>` : ''}</div></li>`).join('')}</ol>${inner ? '' : '</section>'}`;
  }
  function formHtml(mine) {
    return `<form class="mis-card mis-form" novalidate><h2>${mine?.sent ? 'Ваша работа (можно поправить до срока)' : 'Ваша работа'}</h2>
      <label class="fld"><span>Текст работы</span><textarea name="text" rows="7" maxlength="3000" placeholder="Например, текст поста, идея кампании или ответ клиенту">${esc(mine?.text || '')}</textarea></label>
      <label class="fld"><span>Ссылка, если есть <small class="muted">(необязательно)</small></span><input name="link" type="url" inputmode="url" maxlength="300" placeholder="https://" value="${esc(mine?.link || '')}"></label>
      <div class="mis-pic"><img class="mis-prev" alt="Превью картинки" ${mine?.img ? `src="${esc(img(mine.img))}"` : 'hidden'}>
        <div class="mis-pb"><label class="btn-ghost btn-s mis-pick">${ico('file')}<span>${mine?.img ? 'Заменить картинку' : 'Добавить картинку'}</span><input type="file" accept="image/jpeg,image/png,image/webp" class="sr-file"></label>
        <button class="btn-ghost btn-s mis-rm" type="button" ${mine?.img ? '' : 'hidden'}>Убрать</button></div></div>
      <p class="fine">Картинка уменьшится до 1100 px. Работу видит преподаватель, а после итогов все видят работы победителей.</p>
      <p class="err" role="alert"></p>
      <button class="cta" type="submit"><span class="cta-main">${mine?.sent ? 'Обновить работу' : 'Отправить работу'} ${ico('send')}</span></button></form>`;
  }
  function bindForm(f, m, mine) {
    let pic = null, rm = false; const prev = f.querySelector('.mis-prev'), rmb = f.querySelector('.mis-rm');
    if (!mine) api('/api/game/mission/join', { method: 'POST', body: { id: m.id } }).catch(() => {});
    f.querySelector('input[type=file]').onchange = async (e) => { const file = e.target.files[0]; if (!file) return; try { pic = await shrink(file); rm = false; prev.src = pic; prev.hidden = false; rmb.hidden = false; f.querySelector('.mis-pick span').textContent = 'Заменить картинку'; replay(prev, 'pop-in'); sfx.tick(); } catch (er) { toast(er.message); } };
    rmb.onclick = () => { pic = null; rm = true; prev.hidden = true; prev.removeAttribute('src'); rmb.hidden = true; f.querySelector('.mis-pick span').textContent = 'Добавить картинку'; f.querySelector('.sr-file').value = ''; };
    f.onsubmit = async (e) => {
      e.preventDefault(); const b = f.querySelector('[type=submit]'); const errEl = f.querySelector('.err'); errEl.textContent = '';
      const text = f.text.value.trim(); if (text.length < 30) { errEl.textContent = 'Опишите работу хотя бы в паре предложений'; return; }
      b.disabled = true;
      try { await api('/api/game/mission/submit', { method: 'POST', body: { id: m.id, text, link: f.link.value.trim(), img: pic || undefined, removeImg: rm || undefined }, timeout: 45000 });
        chime([523.25, 659.25, 783.99], 0.08, 0.08); toast('Работа отправлена! Итоги после срока сдачи'); close(); card(); }
      catch (er) { errEl.textContent = er.message; b.disabled = false; }
    };
  }
  function close() { const root = document.getElementById('play'); root.hidden = true; root.innerHTML = ''; document.body.classList.remove('playing'); }
  return { card, open };
}

// circle-crop photo editor: drag to move, slider to zoom, saves a 320×320 JPEG
export function photoEditor({ api, toast, onDone }) {
  const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/jpeg,image/png,image/webp';
  input.onchange = () => { const f = input.files[0]; if (!f) return; if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return toast('Нужна картинка JPG, PNG или WebP'); if (f.size > 15e6) return toast('Файл больше 15 МБ'); const u = URL.createObjectURL(f); const im = new Image(); im.onload = () => edit(im, u); im.onerror = () => toast('Не удалось открыть картинку'); im.src = u; };
  input.click();
  function edit(im, url) {
    const sh = document.getElementById('sheet'); const S = 260;
    sh.innerHTML = `<form method="dialog" class="sheet-in pe"><h2 id="sheet-t">Фото агента</h2><p class="muted">Подвиньте фото пальцем или мышкой, масштаб внизу.</p>
      <div class="pe-stage"><canvas width="${S * 2}" height="${S * 2}" style="width:${S}px;height:${S}px" aria-label="Кадрирование фото"></canvas></div>
      <label class="pe-zoom"><span>Масштаб</span><input type="range" min="1" max="3" step="0.01" value="1"></label>
      <p class="err" role="alert"></p>
      <div class="sheet-a"><button class="cta cta-sm" type="button" data-pe-save>Сохранить</button><button class="btn btn-ghost" value="close">Отмена</button></div></form>`;
    sh.showModal();
    const c = sh.querySelector('canvas'), ctx = c.getContext('2d'), z = sh.querySelector('input[type=range]');
    const base = Math.max(S * 2 / im.naturalWidth, S * 2 / im.naturalHeight); let k = 1, x = 0, y = 0;
    const clamp = () => { const w = im.naturalWidth * base * k, h = im.naturalHeight * base * k; x = Math.min(0, Math.max(S * 2 - w, x)); y = Math.min(0, Math.max(S * 2 - h, y)); };
    const draw = () => { clamp(); ctx.clearRect(0, 0, S * 2, S * 2); ctx.drawImage(im, x, y, im.naturalWidth * base * k, im.naturalHeight * base * k); };
    x = (S * 2 - im.naturalWidth * base) / 2; y = (S * 2 - im.naturalHeight * base) / 2; draw();
    let drag = null;
    c.onpointerdown = (e) => { c.setPointerCapture(e.pointerId); drag = { px: e.clientX, py: e.clientY, x, y }; };
    c.onpointermove = (e) => { if (!drag) return; x = drag.x + (e.clientX - drag.px) * 2; y = drag.y + (e.clientY - drag.py) * 2; draw(); };
    c.onpointerup = c.onpointercancel = () => { drag = null; };
    z.oninput = () => { const cx = S - x, cy = S - y, old = k; k = +z.value; x = S - cx * k / old; y = S - cy * k / old; draw(); };
    sh.querySelector('[data-pe-save]').onclick = async (e) => {
      const b = e.currentTarget; b.disabled = true; const out = document.createElement('canvas'); out.width = out.height = 320; out.getContext('2d').drawImage(c, 0, 0, 320, 320);
      try { const r = await api('/api/game/photo', { method: 'POST', body: { img: out.toDataURL('image/jpeg', 0.84) } }); URL.revokeObjectURL(url); sh.close(); chime([659.25, 987.77], 0.09, 0.07); toast('Фото обновлено'); onDone?.(r.photo); }
      catch (er) { sh.querySelector('.err').textContent = er.message; b.disabled = false; }
    };
  }
}
