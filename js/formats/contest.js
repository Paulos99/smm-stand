import { h } from '../ui.js';
import { nextBtn } from './_quiz.js';
// Brief from a business: write a mini strategy. A: the team votes. B: a teacher picks the winner with a note.
export default function (stage, ctx) {
  const v = ctx.variant, vote = ctx.params.mode === 'vote', C = ctx.content.contest;
  const ta = h('textarea', { id: 'ct', maxlength: 3000, style: 'min-height:170px', placeholder: '1) Цель: …\n2) Аудитория: …\n3) Рубрики: …\n4) Первый пост: …' });
  ta.addEventListener('input', () => ctx.step('write'));
  const msg = h('div'), list = h('div');
  const submit = nextBtn('Отправить работу', async () => {
    submit.disabled = true;
    try { await ctx.api('/api/contest/submit', { method: 'POST', body: { text: ta.value, variant: v } }); ctx.step('submit'); await ctx.award(20, { complete: true, sticker: ['first', 'contest'] }); msg.replaceChildren(h('div', { class: 'explain' }, 'Работа принята! Её видят все участники стенда.')); load(); }
    catch (e) { msg.replaceChildren(h('div', { class: 'explain' }, e.message)); }
    submit.disabled = false;
  });
  async function load() {
    list.replaceChildren(h('p', { class: 'small muted' }, 'Загружаем работы…'));
    try {
      const r = await ctx.api('/api/contest');
      const items = r.items.filter(x => x.variant === v);
      if (vote) items.sort((a, b) => b.votes - a.votes);
      const mine = items.find(x => x.mine); if (mine && !ta.value) ta.value = mine.text;
      list.replaceChildren(h('h3', { style: 'font:700 16px var(--heading);margin:18px 0 6px' }, `Работы участников (${items.length})`),
        items.length ? null : h('p', { class: 'small muted' }, 'Пока пусто. Станьте первым!'),
        ...items.map(x => h('div', { class: 'post', style: 'margin:8px 0' + (x.winner ? ';border-color:var(--yellow)' : '') },
          h('small', {}, `${x.winner ? '🏆 ПОБЕДИТЕЛЬ · ' : ''}${x.name}${x.mine ? ' (вы)' : ''}${vote ? ` · ${x.votes} ${x.votes === 1 ? 'голос' : 'голосов'}` : ''}`),
          h('div', { class: 'pre' }, x.text),
          x.judgeNote ? h('div', { class: 'explain' }, h('b', {}, 'Судья: '), x.judgeNote) : null,
          vote && !x.mine ? h('div', { style: 'margin-top:8px' }, nextBtn(x.voted ? '✓ Ваш голос учтён' : '👍 Голосую', async e => { e.currentTarget.disabled = true; try { await ctx.api('/api/contest/vote', { method: 'POST', body: { id: x.id } }); ctx.step('vote'); load(); } catch (er) { ctx.toast(er.message); } }, 'btn')) : null,
          !vote && ctx.isTeacher ? judge(x) : null)));
      if (vote && items.length) ctx.step('vote');
    } catch (e) { list.replaceChildren(h('p', { class: 'small muted' }, e.message)); }
  }
  function judge(x) {
    const note = h('input', { type: 'text', value: x.judgeNote, placeholder: 'Комментарий судьи', maxlength: 500 });
    return h('div', { class: 'row', style: 'margin-top:8px' }, note, nextBtn(x.winner ? 'Снять победу' : '🏆 Победитель', async () => { await ctx.api('/api/contest/judge', { method: 'POST', body: { id: x.id, winner: !x.winner, note: note.value } }); ctx.step('vote'); load(); }, 'btn'),
      nextBtn('Сохранить комментарий', async () => { await ctx.api('/api/contest/judge', { method: 'POST', body: { id: x.id, winner: x.winner, note: note.value } }); ctx.toast('Сохранено'); load(); }, 'btn'));
  }
  stage.replaceChildren(h('div', { class: 'post' }, h('small', {}, 'БРИФ ОТ БИЗНЕСА'), C.brief), h('div', { class: 'explain' }, h('b', {}, 'Задание: '), C.task),
    h('p', { class: 'small muted' }, vote ? 'Победителя выбирает команда голосованием. За свою работу голосовать нельзя.' : 'Победителя выбирает судья-преподаватель и пишет короткий отзыв.'),
    h('label', { class: 'f', for: 'ct' }, 'Ваша работа'), ta, h('div', { style: 'margin-top:8px' }, submit), msg, list);
  load();
}
