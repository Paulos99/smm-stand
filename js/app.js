import { api, store } from './api.js';
import { h, $, toast, sticker } from './ui.js';
import { startSession, endSession, flush } from './track.js';
import { feedbackForm } from './feedback.js';

const app = $('#app');
let FORMATS = [], CONTENT = null, ME = null, cleanup = null;

// ---- theme: system by default, remembered after a click ----
const themeBtn = $('#theme-toggle');
function applyTheme() {
  const saved = localStorage.getItem('stand-theme');
  const t = saved || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  document.documentElement.dataset.theme = t;
  themeBtn.textContent = t === 'light' ? '☾' : '☀';
  themeBtn.setAttribute('aria-label', t === 'light' ? 'Включить тёмную тему' : 'Включить светлую тему');
  $('meta[name=theme-color]').content = t === 'light' ? '#f4f1e8' : '#141414';
}
themeBtn.addEventListener('click', () => { localStorage.setItem('stand-theme', document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'); applyTheme(); });
matchMedia('(prefers-color-scheme: light)').addEventListener('change', applyTheme);
applyTheme();

function header() {
  const u = store.user; const box = $('#header-actions'); box.replaceChildren(themeBtn);
  if (!u) return;
  box.prepend(...[
    h('span', { class: 'who' }, store.tester || u.name),
    u.role === 'teacher' ? h('a', { class: 'pill-btn', href: '#/dash', 'aria-label': 'Статистика' }, matchMedia('(max-width:420px)').matches ? '📊' : 'Статистика') : null,
    h('button', { class: 'pill-btn ghost', type: 'button', onclick: async () => { try { await api('/api/logout', { method: 'POST' }); } catch {} store.clear(); location.hash = '#/login'; } }, 'Выйти')].filter(Boolean));
}

async function loadBase() {
  if (!FORMATS.length) FORMATS = (await (await fetch('./data/formats.json?v=' + window.STAND_V)).json()).formats;
  if (!CONTENT && store.token) CONTENT = await api('/api/content');
  if (store.token) ME = await api('/api/me');
}

// ---- views ----
function viewLogin() {
  const login = h('input', { type: 'text', id: 'l-login', autocomplete: 'username', autocapitalize: 'off', required: true });
  const pw = h('input', { type: 'password', id: 'l-pw', autocomplete: 'current-password', required: true });
  const name = h('input', { type: 'text', id: 'l-name', value: store.tester, maxlength: 40, placeholder: 'Как к вам обращаться' });
  const err = h('div', { class: 'err', role: 'alert' });
  const btn = h('button', { class: 'btn primary block', type: 'button' }, 'Войти в лабораторию');
  const go = async () => {
    err.textContent = ''; btn.disabled = true; btn.textContent = 'Входим…';
    try {
      const r = await api('/api/login', { method: 'POST', body: { login: login.value, password: pw.value }, timeout: 35000 });
      store.save(r.token, { login: r.login, name: r.name, role: r.role });
      store.tester = name.value.trim() || (r.role === 'teacher' ? r.name : '') || store.tester;
      CONTENT = null; location.hash = '#/';
    } catch (e) { err.textContent = e.message; } finally { btn.disabled = false; btn.textContent = 'Войти в лабораторию'; }
  };
  btn.onclick = go; [login, pw, name].forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') go(); }));
  app.replaceChildren(hero('ЛАБОРАТОРИЯ ФОРМАТОВ', 'ПРОБУЕМ.<br>ОЦЕНИВАЕМ.<br><span>ВЫБИРАЕМ</span> ЛУЧШЕЕ', 'Тестовый стенд СММ ШКОЛЫ для команды. Здесь живут новые форматы обучения, у каждого два варианта. Пройдите, поставьте оценку, и мы увидим, что заходит.'),
    h('div', { class: 'wrap' }, h('div', { class: 'login' },
      h('h2', {}, 'Вход в штаб'), h('p', { class: 'small muted' }, 'Логины выдаёт Павел. Данные на стенде выдуманные, настоящих учеников тут нет.'),
      h('label', { class: 'f', for: 'l-login' }, 'Логин'), login, h('label', { class: 'f', for: 'l-pw' }, 'Пароль'), pw,
      h('label', { class: 'f', for: 'l-name' }, 'Ваше имя (для отзывов)'), name, err, h('div', { style: 'margin-top:14px' }, btn))));
  login.focus();
}

function hero(eyebrow, title, text, img = 'school') {
  return h('section', { class: 'wrap hero' },
    h('div', {}, h('div', { class: 'eyebrow' }, h('span', { class: 'red-line' }), eyebrow), h('h1', { html: title }), h('p', {}, text)),
    h('div', { class: 'hero-art', 'aria-hidden': 'true' }, h('img', { src: sticker(img), alt: '' })));
}

function viewCatalog() {
  const isT = ME.role === 'teacher';
  const list = FORMATS.filter(f => !f.teacherOnly || isT);
  const card = f => h('a', { class: 'card', href: `#/f/${f.id}` },
    h('div', { class: 'card-top' }, h('img', { src: sticker(f.icon), alt: '', loading: 'lazy' }), h('h3', {}, f.title)),
    h('p', {}, f.short),
    h('div', { class: 'tags' }, h('span', { class: 'tag' }, f.group), h('span', { class: 'tag ' + (f.source === 'встреча' ? 'meet' : 'new') }, f.source === 'встреча' ? 'из встречи' : 'новая идея'),
      h('span', { class: 'tag' }, 'А / Б'), ME.done?.[f.id] ? h('span', { class: 'tag done' }, '✓ пройдено') : null));
  app.replaceChildren(
    hero(`ПРИВЕТ, ${(store.tester || ME.name).toUpperCase()} / ${ME.points} БАЛЛОВ · ${ME.level.toUpperCase()}`, 'ВЫБЕРИ<br><span>ФОРМАТ</span> И ПОПРОБУЙ', 'У каждого формата два варианта: А и Б. Пройдите оба, оцените каждый внизу страницы. Так мы поймём, какой подход оставить.'),
    h('div', { class: 'wrap' }, h('h2', { class: 'section-title' }, `${list.length} форматов в лаборатории`), h('div', { class: 'grid' }, list.map(card))));
}

async function viewFormat(id, variant) {
  const f = FORMATS.find(x => x.id === id);
  if (!f || (f.teacherOnly && ME.role !== 'teacher')) { location.hash = '#/'; return; }
  const v = variant === 'B' ? 'B' : (variant === 'A' ? 'A' : (localStorage.getItem('stand-v-' + id) || 'A'));
  localStorage.setItem('stand-v-' + id, v);
  const stage = h('div', { class: 'stage', id: 'stage' });
  const ab = h('div', { class: 'ab', role: 'group', 'aria-label': 'Вариант' }, ['A', 'B'].map(k => h('button', { type: 'button', 'aria-pressed': String(k === v), onclick: () => { location.hash = `#/f/${id}/${k}`; } }, `Вариант ${k === 'A' ? 'А' : 'Б'}: ${f.variants[k].label}`)));
  app.replaceChildren(h('div', { class: 'wrap' },
    h('a', { class: 'back', href: '#/' }, '← Все форматы'),
    h('div', { class: 'fmt-head' }, h('h2', {}, f.title), ab),
    h('p', { class: 'variant-note' }, f.variants[v].desc),
    stage, feedbackForm(f.id, v)));
  const tr = startSession(f.id, v);
  const ctx = {
    fmt: f, variant: v, params: f.variants[v].params || {}, content: CONTENT, me: ME, isTeacher: ME.role === 'teacher', api, h, toast, sticker,
    step: tr.step, complete: tr.complete, click: tr.click,
    async award(delta, { sticker: st, complete = false } = {}) {
      if (complete) tr.complete();
      try {
        const r = await api('/api/points', { method: 'POST', body: { fmt: f.id, variant: v, delta, complete, sticker: st } });
        Object.assign(ME, { points: r.points, level: r.level, stickers: r.stickers, streak: r.streak }); if (complete) ME.done[f.id] = (ME.done[f.id] || 0) + 1;
        for (const s of r.newStickers || []) toast(`Новый стикер: «${CONTENT.stickers[s]?.label || s}»`, CONTENT.stickers[s]?.img);
        if (!r.newStickers?.length && delta) toast(`+${delta} баллов · ${r.level}`);
        return r;
      } catch (e) { toast(e.message); }
    },
  };
  tr.step('start');
  const mod = await import(`./formats/${f.type}.js?v=${window.STAND_V}`);
  cleanup = mod.default(stage, ctx) || null;
}

async function route() {
  if (typeof cleanup === 'function') { try { cleanup(); } catch {} } cleanup = null;
  endSession();
  const [, page, a, b] = location.hash.split('/');
  header();
  if (!store.token) { if (page !== 'login') location.hash = '#/login'; else viewLogin(); return; }
  try { await loadBase(); } catch (e) { app.replaceChildren(h('div', { class: 'wrap login' }, h('h2', {}, 'Нет связи'), h('p', {}, e.message), h('button', { class: 'btn primary', onclick: route }, 'Повторить'))); return; }
  header();
  window.scrollTo(0, 0);
  if (page === 'f') return viewFormat(a, b);
  if (page === 'dash' && ME.role === 'teacher') { const m = await import(`./dashboard.js?v=${window.STAND_V}`); return m.default(app, { FORMATS, api, store }); }
  if (page === 'login') { location.hash = '#/'; return; }
  viewCatalog();
}
addEventListener('hashchange', route);
route();
