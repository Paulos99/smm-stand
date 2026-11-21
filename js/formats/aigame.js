import { h } from '../ui.js';
import { ask, nextBtn, finale } from './_quiz.js';
import { parseGame } from './_game-parse.js';
// Teacher tool: AI turns a lecture into a game. A: quiz with 3 options. B: true or myth.
export default function (stage, ctx) {
  const v = ctx.variant, lectures = ctx.content.lectures || [];
  const sel = h('select', { id: 'ag-l' }, ...lectures.map((l, i) => h('option', { value: i }, `Лекция ${l.n}. ${l.title}`)), h('option', { value: 'own' }, 'Свой текст'));
  const own = h('textarea', { placeholder: 'Вставьте текст урока (до 6000 знаков)', maxlength: 6000, style: 'display:none' });
  sel.addEventListener('change', () => { own.style.display = sel.value === 'own' ? '' : 'none'; });
  const msg = h('div');
  const gen = nextBtn('Собрать игру', async () => {
    const text = sel.value === 'own' ? own.value.trim() : lectures[+sel.value]?.text;
    if (!text || text.length < 200) { msg.replaceChildren(h('div', { class: 'explain' }, 'Нужен текст хотя бы на пару абзацев.')); return; }
    gen.disabled = true; gen.textContent = 'ИИ собирает игру, до минуты…'; ctx.step('generate');
    try {
      const r = await ctx.api('/api/ai', { method: 'POST', body: { mode: 'game', variant: v, text }, timeout: 80000 });
      const items = Array.isArray(r.items) ? r.items : parseGame(r.text, v);
      if (!items.length) throw new Error('ИИ вернул пустую игру, попробуйте ещё раз');
      play(items);
    } catch (e) { msg.replaceChildren(h('div', { class: 'explain' }, /JSON|Unexpected/.test(e.message) ? 'ИИ ответил не в том формате. Нажмите ещё раз.' : e.message)); }
    gen.disabled = false; gen.textContent = 'Собрать игру';
  });
  async function play(items) {
    ctx.step('play'); let ok = 0;
    for (let i = 0; i < items.length; i++) {
      const it = items[i]; const box = h('div'); stage.replaceChildren(box);
      const q = it;
      ok += (await ask(box, q, { title: `${v === 'B' ? 'Правда или миф' : 'Викторина'} · ${i + 1} из ${items.length}` })) ? 1 : 0;
      await new Promise(r => box.append(h('div', { style: 'margin-top:10px' }, nextBtn(i + 1 < items.length ? 'Дальше →' : 'Итоги', r))));
    }
    ctx.step('done'); await ctx.award(10, { complete: true });
    finale(stage, { img: 'news-drag', title: `Игра готова: ${ok} из ${items.length}`, text: 'Так её увидят ученики. Если вопросы хорошие, такую игру можно собирать к каждому уроку за минуту.', again: form });
  }
  function form() {
    stage.replaceChildren(h('p', { class: 'small muted' }, `Инструмент для преподавателя. Выберите лекцию, и ИИ сделает из неё ${v === 'B' ? 'игру «Правда или миф» на 6 утверждений' : 'викторину на 5 вопросов'}. Сразу можно сыграть и оценить качество.`),
      h('label', { class: 'f', for: 'ag-l' }, 'Источник'), sel, own, h('div', { style: 'margin-top:10px' }, gen), msg);
  }
  form();
}
