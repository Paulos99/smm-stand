import { h } from '../ui.js';
import { ask, nextBtn, progress, finale } from './_quiz.js';
export default function (stage, ctx) {
  const lessons = ctx.content.lessons;
  let L = lessons[0];
  const pick = () => {
    stage.replaceChildren(h('p', { class: 'small muted' }, ctx.params.mode === 'stories' ? 'Урок в формате сторис: 4 коротких экрана, листайте тапом. Потом 2 вопроса.' : 'Урок одной шпаргалкой: всё на одном экране. Потом 2 вопроса.'),
      h('h3', { style: 'font:700 16px var(--heading);margin:10px 0' }, 'Выберите тему'),
      ...lessons.map(l => h('button', { class: 'opt', type: 'button', onclick: () => { L = l; ctx.click('lesson' + l.n); learn(); } }, h('b', {}, `${l.n}. ${l.title}`), h('div', { class: 'small muted' }, l.topic))));
  };
  const learn = () => (ctx.params.mode === 'stories' ? stories(0) : longread());
  const stories = i => {
    ctx.step('screen' + (i + 1));
    const s = L.screens[i];
    const story = h('div', { class: 'story' },
      h('div', { class: 'story-bars' }, L.screens.map((_, j) => h('i', { class: j <= i ? 'on' : '' }))),
      h('div', { class: 'score' }, `${L.topic}`), h('h3', {}, s.h), h('p', {}, s.t));
    const go = d => { const n = i + d; if (n < 0) return; if (n >= L.screens.length) checks(0, 0); else stories(n); };
    story.addEventListener('click', e => { if (e.target.closest('button')) return; const r = story.getBoundingClientRect(); go(e.clientX - r.left < r.width / 3 ? -1 : 1); });
    stage.replaceChildren(story, h('div', { class: 'story-nav' }, nextBtn('← Назад', () => go(-1), 'btn'), nextBtn(i === L.screens.length - 1 ? 'К вопросам →' : 'Дальше →', () => go(1))));
  };
  const longread = () => {
    L.screens.forEach((_, i) => ctx.step('screen' + (i + 1)));
    stage.replaceChildren(h('div', { class: 'score' }, L.topic), h('h3', { style: 'font:800 20px var(--heading);margin:6px 0 12px' }, L.title),
      h('div', { class: 'cheat' }, L.screens.map((s, i) => h('div', {}, h('b', {}, `${i + 1}. ${s.h}`), s.t))),
      h('div', { style: 'margin-top:14px' }, nextBtn('Проверить себя →', () => checks(0, 0))));
  };
  const checks = async (i, score) => {
    ctx.step('check' + (i + 1));
    const box = h('div'); stage.replaceChildren(progress(i, L.check.length), box);
    const ok = await ask(box, L.check[i], { title: `Вопрос ${i + 1} из ${L.check.length}` });
    score += ok ? 1 : 0;
    box.append(h('div', { style: 'margin-top:12px' }, nextBtn(i + 1 < L.check.length ? 'Следующий вопрос →' : 'Готово', () => (i + 1 < L.check.length ? checks(i + 1, score) : end(score)))));
  };
  const end = async score => {
    const pts = 10 + score * 5;
    await ctx.award(pts, { complete: true, sticker: ['first', 'lesson'] });
    finale(stage, { img: 'skill', title: `Урок пройден! ${score} из ${L.check.length}`, text: `+${pts} баллов. Знания в дело: попробуйте другую тему или переключите вариант сверху.`, again: pick });
  };
  pick();
}
