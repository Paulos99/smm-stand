import { h } from '../ui.js';
import { nextBtn } from './_quiz.js';
// Write a post, get AI review (A soft mentor / B strict editor), rewrite and compare.
export default function (stage, ctx) {
  const v = ctx.variant; let round = 0;
  const brief = 'Кофейня «Зерно» запускает тихий час: с 14 до 17 будни, кофе и десерт за 290 ₽. Напишите пост ВКонтакте, чтобы люди пришли днём.';
  const ta = h('textarea', { id: 'aip', maxlength: 2500, placeholder: 'Первая строка решает всё…', style: 'min-height:160px' });
  const cnt = h('span', { class: 'small muted' }, '0 знаков');
  ta.addEventListener('input', () => { cnt.textContent = `${ta.value.length} знаков`; ctx.step('write'); });
  const out = h('div');
  const go = nextBtn('Получить разбор', async () => {
    const t = ta.value.trim(); if (t.length < 60) { out.replaceChildren(h('div', { class: 'explain' }, 'Напишите хотя бы 2–3 предложения, чтобы было что разбирать.')); return; }
    go.disabled = true; go.textContent = 'ИИ читает…'; ctx.step(round ? 'rewrite' : 'review');
    try {
      const r = await ctx.api('/api/ai', { method: 'POST', body: { mode: 'post', variant: v, text: t }, timeout: 40000 });
      round++;
      out.replaceChildren(h('div', { class: 'row', style: 'gap:10px;margin-top:12px' }, h('span', { class: 'big-emoji' }, v === 'B' ? '🧐' : '🤗'), h('b', {}, v === 'B' ? `Редактор, разбор ${round}` : `Наставник, разбор ${round}`)), h('div', { class: 'explain pre' }, r.text),
        h('p', { class: 'small muted' }, round === 1 ? 'Поправьте текст по советам и отправьте ещё раз. За вторую версию будут бонусные баллы.' : 'Отлично, вы прошли полный цикл: черновик, разбор, правка.'));
      await ctx.award(round === 1 ? 15 : 10, { complete: round >= 2, sticker: round >= 2 ? ['first', 'ai_post'] : ['first'] });
    } catch (e) { out.replaceChildren(h('div', { class: 'explain' }, e.message)); }
    go.disabled = false; go.textContent = round ? 'Отправить новую версию' : 'Получить разбор';
  });
  stage.replaceChildren(h('div', { class: 'post' }, h('small', {}, 'ЗАДАНИЕ'), brief), h('label', { class: 'f', for: 'aip' }, 'Ваш пост'), ta,
    h('div', { class: 'row', style: 'justify-content:space-between;margin-top:8px' }, go, cnt), out);
}
