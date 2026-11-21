import { h } from './ui.js';
// Team dashboard: KPIs, A vs B per format, drop-off by step, feedback with tester names, AI usage.
const fmtMs = ms => { if (!ms) return '0 с'; const s = Math.round(ms / 1000); return s < 60 ? `${s} с` : `${Math.floor(s / 60)} мин ${s % 60} с`; };
const msk = t => new Date(t).toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' МСК';
const avg = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const V = k => (k === 'A' ? 'А' : 'Б');
export default async function (app, { FORMATS, api }) {
  app.replaceChildren(h('div', { class: 'wrap' }, h('p', { class: 'muted', style: 'padding:30px 0' }, 'Собираем статистику…')));
  let data; try { data = await api('/api/dashboard', { timeout: 45000 }); } catch (e) { app.replaceChildren(h('div', { class: 'wrap' }, h('p', { class: 'err' }, e.message))); return; }
  const testers = [...new Set([...data.events.map(e => e.tester), ...data.feedback.map(f => f.name)].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'));
  const f = { tester: '', fmt: '', variant: '', dev: '' };
  const mk = (key, label, opts) => { const s = h('select', { 'aria-label': label, onchange: () => { f[key] = s.value; draw(); } }, h('option', { value: '' }, label), ...opts.map(([v, t]) => h('option', { value: v }, t))); return s; };
  const filters = h('div', { class: 'filters' }, mk('tester', 'Все тестировщики', testers.map(t => [t, t])), mk('fmt', 'Все форматы', FORMATS.map(x => [x.id, x.title])), mk('variant', 'Оба варианта', [['A', 'Вариант А'], ['B', 'Вариант Б']]), mk('dev', 'Все устройства', [['mobile', 'Телефон'], ['desktop', 'Компьютер']]));
  const body = h('div');
  app.replaceChildren(h('div', { class: 'wrap' }, h('a', { class: 'back', href: '#/' }, '← К форматам'),
    h('div', { class: 'fmt-head' }, h('h2', {}, 'Статистика стенда'), h('button', { class: 'pill-btn', type: 'button', onclick: csv }, 'Скачать отзывы CSV')), filters, body));
  function sel() {
    const ev = data.events.filter(e => (!f.tester || e.tester === f.tester) && (!f.fmt || e.fmt === f.fmt) && (!f.variant || e.variant === f.variant) && (!f.dev || e.dev === f.dev));
    const fb = data.feedback.filter(x => (!f.tester || x.name === f.tester) && (!f.fmt || x.fmt === f.fmt) && (!f.variant || x.variant === f.variant));
    return { ev, fb };
  }
  function stats(ev, fb, fmt, v) {
    const e = ev.filter(x => x.fmt === fmt && x.variant === v), b = fb.filter(x => x.fmt === fmt && x.variant === v);
    const sids = new Set(e.filter(x => x.type === 'open').map(x => x.sid));
    const leave = {}; e.filter(x => x.type === 'leave').forEach(x => { leave[x.sid] = Math.max(leave[x.sid] || 0, x.ms); });
    const done = new Set(e.filter(x => x.type === 'complete').map(x => x.sid));
    const steps = {}; e.filter(x => x.type === 'step').forEach(x => { (steps[x.step] ||= new Set()).add(x.sid); });
    const eases = b.filter(x => x.ease);
    return { opens: sids.size, testers: new Set(e.map(x => x.tester)).size, time: avg(Object.values(leave)), compl: sids.size ? done.size / sids.size * 100 : 0,
      rating: avg(b.map(x => x.rating)), nfb: b.length, ease: eases.length ? eases.filter(x => x.ease === 'yes').length / eases.length * 100 : 0, steps, n: sids.size };
  }
  function draw() {
    const { ev, fb } = sel();
    const sessions = new Set(ev.filter(e => e.type === 'open').map(e => e.sid));
    const today = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
    const aiToday = data.ai.find(x => x.k.startsWith('ai:all:') && x.k.endsWith(today))?.n || 0;
    const aiTok = data.ai.filter(x => x.k.startsWith('aitok:')).reduce((s, x) => s + (+x.n || 0), 0);
    const kpi = (b, s) => h('div', { class: 'kpi' }, h('b', {}, b), h('span', {}, s));
    const list = FORMATS.filter(x => !f.fmt || x.id === f.fmt);
    body.replaceChildren(
      h('div', { class: 'dash-grid' }, kpi(new Set(ev.map(e => e.tester).filter(Boolean)).size, 'тестировщиков'), kpi(sessions.size, 'запусков форматов'), kpi(new Set(ev.filter(e => e.type === 'complete').map(e => e.sid)).size, 'прохождений до конца'),
        kpi(fb.length, 'отзывов'), kpi(fb.length ? avg(fb.map(x => x.rating)).toFixed(1) : '—', 'средняя оценка'), kpi(aiToday, 'ИИ-запросов сегодня'), kpi(aiTok < 1000 ? aiTok : Math.round(aiTok / 1000) + 'k', 'токенов ИИ всего')),
      h('h3', { class: 'section-title' }, 'Вариант А против Б'),
      h('p', { class: 'small muted' }, h('span', { style: 'color:var(--on-yellow);background:var(--yellow);padding:0 6px;border-radius:6px' }, 'А'), ' жёлтый, ', h('span', { style: 'color:#fff;background:var(--blue);padding:0 6px;border-radius:6px' }, 'Б'), ' синий. Метка «лучше» ставится, если у варианта есть данные и он впереди.'),
      h('div', { class: 'abcmp' }, list.map(fm => cmp(fm, stats(ev, fb, fm.id, 'A'), stats(ev, fb, fm.id, 'B')))),
      h('h3', { class: 'section-title' }, `Отзывы (${fb.length})`),
      h('div', { class: 'tbl' }, fb.length ? [...fb].sort((a, b) => b.at - a.at).map(x => h('div', { class: 'comment' },
        h('div', { class: 'meta' }, h('b', { style: 'color:var(--text)' }, x.name), ` · ${FORMATS.find(z => z.id === x.fmt)?.title || x.fmt} · вариант ${V(x.variant)} · ${msk(x.at)}`),
        h('div', {}, '★'.repeat(x.rating) + '☆'.repeat(5 - x.rating), x.ease ? h('span', { class: 'small muted' }, ` · ${{ yes: 'удобно', mid: 'так себе', no: 'неудобно' }[x.ease] || x.ease}`) : null),
        x.comment ? h('div', { class: 'pre', style: 'font-size:14px' }, x.comment) : null)) : h('p', { class: 'small muted', style: 'padding:10px 0' }, 'Отзывов пока нет.')));
  }
  function cmp(fm, a, b) {
    const rows = [['Запуски', a.opens, b.opens, String], ['Тестировщики', a.testers, b.testers, String], ['Ср. время', a.time, b.time, fmtMs], ['Дошли до конца', a.compl, b.compl, x => Math.round(x) + '%'],
      ['Ср. оценка', a.rating, b.rating, x => (x ? x.toFixed(1) : '—')], ['Удобно', a.ease, b.ease, x => Math.round(x) + '%'], ['Отзывов', a.nfb, b.nfb, String]];
    const better = (a.rating || b.rating) ? (a.rating > b.rating ? 'A' : b.rating > a.rating ? 'B' : '') : (a.compl > b.compl ? 'A' : b.compl > a.compl ? 'B' : '');
    const bar = (k, val, max, fmtv) => h('div', { class: 'barrow' }, h('span', {}, k), h('div', { class: 'bar' }, h('i', { class: k.endsWith('А') ? 'a' : 'b', style: `width:${max ? Math.round(val / max * 100) : 0}%` })), h('span', { class: 'num', style: 'text-align:right' }, fmtv(val)));
    const steps = fm.steps || [];
    return h('div', { class: 'cmp' },
      h('h4', {}, fm.title, better ? h('span', { class: 'lead' }, `лучше ${V(better)}`) : null),
      h('div', { class: 'small muted', style: 'margin-bottom:6px' }, `А: ${fm.variants.A.label} · Б: ${fm.variants.B.label}`),
      ...rows.flatMap(([k, x, y, fv]) => { const m = Math.max(x, y, k === 'Ср. оценка' ? 5 : 0, k.includes('%') ? 100 : 0); return [h('div', { class: 'small', style: 'margin-top:8px;font-weight:600' }, k), bar('Вариант А', x, m, fv), bar('Вариант Б', y, m, fv)]; }),
      steps.length ? h('details', { style: 'margin-top:10px' }, h('summary', { class: 'small', style: 'cursor:pointer;font-weight:600' }, 'Где отваливаются: шаги'),
        h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Шаг'), h('th', { class: 'num' }, 'А'), h('th', { class: 'num' }, 'Б'))),
          h('tbody', {}, steps.map(s => h('tr', {}, h('td', {}, s), h('td', { class: 'num' }, a.n ? Math.round((a.steps[s]?.size || 0) / a.n * 100) + '%' : '—'), h('td', { class: 'num' }, b.n ? Math.round((b.steps[s]?.size || 0) / b.n * 100) + '%' : '—')))))) : null);
  }
  function csv() {
    const { fb } = sel(); const q = s => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const rows = [['Дата МСК', 'Имя', 'Формат', 'Вариант', 'Оценка', 'Удобство', 'Комментарий'], ...fb.map(x => [msk(x.at), x.name, FORMATS.find(z => z.id === x.fmt)?.title || x.fmt, V(x.variant), x.rating, x.ease, x.comment])];
    const blob = new Blob(['\ufeff' + rows.map(r => r.map(q).join(';')).join('\n')], { type: 'text/csv' });
    const a = h('a', { href: URL.createObjectURL(blob), download: 'stand-feedback.csv' }); document.body.append(a); a.click(); a.remove();
  }
  draw();
}
