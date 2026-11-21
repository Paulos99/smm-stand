import { h, shuffle } from '../ui.js';
import { nextBtn, progress, finale } from './_quiz.js';
// Tap a block to put it into the next slot, tap a slot to take it back. B adds decoy blocks.
export default function (stage, ctx) {
  const tasks = ctx.content.blocks, extra = !!ctx.params.extra; let i = 0, total = 0;
  const task = () => {
    const t = tasks[i]; ctx.step('task' + (i + 1));
    const slots = t.items.map(() => null); let pool = shuffle([...t.items, ...(extra ? t.extra || [] : [])]); let checked = false, tries = 0;
    const slotsEl = h('div', { class: 'slots' }), poolEl = h('div', { class: 'pool' }), ex = h('div');
    const draw = () => {
      slotsEl.replaceChildren(...slots.map((s, k) => h('button', { type: 'button', class: 'slot' + (s ? ' filled' : ''), 'aria-label': s ? `Шаг ${k + 1}: ${s}. Нажмите, чтобы убрать` : `Шаг ${k + 1}, пусто`, disabled: checked && s === t.items[k],
        onclick: () => { if (!s) return; pool.push(s); slots[k] = null; ex.replaceChildren(); draw(); } }, h('b', {}, k + 1), s || '…')));
      poolEl.replaceChildren(...pool.map(p => h('button', { type: 'button', class: 'opt', onclick: () => { const k = slots.indexOf(null); if (k < 0) return; slots[k] = p; pool = pool.filter(x => x !== p); ex.replaceChildren(); draw(); } }, p)));
      check.disabled = slots.includes(null);
    };
    const check = nextBtn('Проверить', () => {
      tries++; ctx.click('check');
      const marks = slots.map((s, k) => s === t.items[k]);
      [...slotsEl.children].forEach((el, k) => el.classList.add(marks[k] ? 'right' : 'wrong'));
      if (marks.every(Boolean)) {
        checked = true; const pts = tries === 1 ? 10 : tries === 2 ? 6 : 3; total += pts;
        ex.replaceChildren(h('div', { class: 'explain' }, h('b', {}, `Собрано! +${pts}. `), t.hint), nextBtn(i + 1 < tasks.length ? 'Следующее задание →' : 'Итоги', () => (i + 1 < tasks.length ? (i++, task()) : end())));
        check.remove(); poolEl.remove();
      } else ex.replaceChildren(h('div', { class: 'explain' }, `Почти. Красным отмечены блоки не на своём месте. Подсказка: ${t.hint}`));
    });
    stage.replaceChildren(progress(i, tasks.length), h('span', { class: 'score' }, `Задание ${i + 1} из ${tasks.length}`), h('h3', { style: 'font:700 17px var(--heading);margin:6px 0' }, t.title),
      h('p', { class: 'small muted' }, extra ? 'Среди блоков есть лишние. Оставьте их в стороне.' : 'Расставьте блоки по порядку.'), slotsEl, h('p', { class: 'small muted' }, 'Блоки:'), poolEl, h('div', { style: 'margin-top:10px' }, check), ex);
    draw();
  };
  const end = async () => { await ctx.award(total, { complete: true, sticker: ['first', 'blocks'] }); finale(stage, { img: 'news-puzzle', title: `Все ${tasks.length} конструктора собраны`, text: `+${total} баллов. Структура поста теперь в руках.`, again: () => { i = 0; total = 0; task(); } }); };
  task();
}
