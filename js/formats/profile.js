import { h } from '../ui.js';
// Motivation screen. A: points, level ladder, progress to the next level. B: sticker collection and team leaderboard.
const LEVELS = [[0, 'Стажёр'], [60, 'Джун'], [180, 'СММщик'], [400, 'СММ-агент'], [800, 'Агент 007']];
export default function (stage, ctx) {
  const me = ctx.me; ctx.step('view');
  if (ctx.params.mode === 'points') {
    const next = LEVELS.find(([n]) => n > me.points); const cur = [...LEVELS].reverse().find(([n]) => me.points >= n);
    const pct = next ? Math.round((me.points - cur[0]) / (next[0] - cur[0]) * 100) : 100;
    stage.replaceChildren(
      h('div', { class: 'result' }, h('div', { class: 'eyebrow', style: 'justify-content:center' }, 'ВАШЕ ЗВАНИЕ'), h('h3', { style: 'font:800 30px var(--heading)' }, me.level),
        h('div', { class: 'score', style: 'font-size:22px' }, `${me.points} баллов`)),
      h('div', { class: 'progress', style: 'height:12px' }, h('span', { style: `width:${pct}%` })),
      h('p', { class: 'small muted', style: 'text-align:center' }, next ? `До звания «${next[1]}» осталось ${next[0] - me.points} баллов` : 'Вы на вершине. Агент 007!'),
      h('div', { class: 'tbl' }, h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Звание'), h('th', { class: 'num' }, 'Баллы'))),
        h('tbody', {}, LEVELS.map(([n, t]) => h('tr', { style: me.points >= n ? 'font-weight:700' : 'opacity:.6' }, h('td', {}, (me.points >= n ? '✓ ' : '🔒 ') + t), h('td', { class: 'num' }, n)))))),
      h('p', { class: 'small muted' }, 'Баллы дают за уроки, игры, задания дня и конкурсы. Обмен баллов на призы появится позже.'));
    setTimeout(() => ctx.complete(), 4000);
    return;
  }
  const all = ctx.content.stickers; const lb = h('div', {}, h('p', { class: 'small muted' }, 'Загружаем рейтинг…'));
  stage.replaceChildren(h('h3', { style: 'font:700 16px var(--heading);margin-bottom:10px' }, `Мои стикеры: ${me.stickers.length} из ${Object.keys(all).length}`),
    h('div', { class: 'stickers' }, Object.entries(all).map(([k, s]) => h('div', { class: 'stk' + (me.stickers.includes(k) ? '' : ' locked') }, h('img', { src: `./assets/stickers/${s.img}.webp`, alt: '' }), h('div', {}, s.label)))),
    h('h3', { style: 'font:700 16px var(--heading);margin:18px 0 6px' }, 'Рейтинг команды'), lb);
  ctx.api('/api/leaderboard').then(r => {
    lb.replaceChildren(h('div', { class: 'tbl' }, h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, 'Имя'), h('th', {}, 'Звание'), h('th', { class: 'num' }, 'Стикеры'), h('th', { class: 'num' }, 'Баллы'))),
      h('tbody', {}, r.items.map((x, i) => h('tr', {}, h('td', {}, i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1), h('td', {}, x.name), h('td', {}, x.level), h('td', { class: 'num' }, x.stickers), h('td', { class: 'num' }, x.points)))))));
    ctx.complete();
  }).catch(e => lb.replaceChildren(h('p', { class: 'small muted' }, e.message)));
}
