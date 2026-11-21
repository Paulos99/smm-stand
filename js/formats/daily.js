import { h } from '../ui.js';
import { ask, nextBtn, finale } from './_quiz.js';
// Task of the day + streak. A: one question; B: 3-step mini-case. Day index by MSK date.
export default function (stage, ctx) {
  const day = Math.floor((Date.now() + 3 * 3600e3) / 864e5);
  const key = 'stand-daily-' + ctx.variant + '-' + day;
  const fire = () => h('div', { class: 'row', style: 'gap:6px' }, h('span', { class: 'big-emoji' }, '🔥'), h('span', { class: 'score' }, `Огонёк: ${ctx.me.streak?.count || 0} ${(ctx.me.streak?.count || 0) === 1 ? 'день' : 'дн.'} подряд`));
  const start = async () => {
    ctx.step('answer');
    let ok = 0, n = 1;
    if (ctx.params.mode === 'case') {
      const c = ctx.content.dailyCase[day % ctx.content.dailyCase.length]; n = c.steps.length;
      for (let s = 0; s < n; s++) {
        const box = h('div'); stage.replaceChildren(fire(), h('h3', { style: 'font:700 16px var(--heading);margin:10px 0 0' }, c.title), box);
        ok += (await ask(box, c.steps[s], { title: `Шаг ${s + 1} из ${n}` })) ? 1 : 0;
        if (s + 1 < n) await new Promise(r => box.append(h('div', { style: 'margin-top:10px' }, nextBtn('Дальше →', r))));
      }
    } else {
      const q = ctx.content.daily[day % ctx.content.daily.length];
      const box = h('div'); stage.replaceChildren(fire(), box);
      ok += (await ask(box, q, { title: 'Задание дня' })) ? 1 : 0;
    }
    await new Promise(r => stage.append(h('div', { style: 'margin-top:10px' }, nextBtn('Забрать огонёк', r))));
    ctx.step('done');
    const pts = 5 + ok * 5;
    await ctx.award(pts, { complete: true, sticker: ['first', 'daily'] });
    localStorage.setItem(key, String(ok));
    finale(stage, { img: 'news-phone', title: `Огонёк горит: ${ctx.me.streak?.count || 1}`, text: `${ok} из ${n} верно, +${pts} баллов. Завтра будет новое задание. Три дня подряд дают стикер «Огонёк».` });
  };
  if (localStorage.getItem(key) != null) {
    stage.replaceChildren(h('div', { class: 'result' }, fire(), h('h3', {}, 'Сегодня уже сделано'), h('p', { class: 'muted' }, 'Новое задание появится завтра в 00:00 по Москве. Для теста можно пройти ещё раз.'),
      h('div', { style: 'margin-top:12px' }, nextBtn('Пройти ещё раз', start, 'btn'))));
  } else stage.replaceChildren(h('div', { class: 'result' }, fire(), h('h3', {}, ctx.params.mode === 'case' ? 'Мини-кейс дня, 3 шага' : 'Один вопрос дня'), h('p', { class: 'muted' }, 'Пара минут в день, и огонёк не гаснет.'), h('div', { style: 'margin-top:12px' }, nextBtn('Начать', start))));
}
